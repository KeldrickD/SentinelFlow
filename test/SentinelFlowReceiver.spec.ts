import { expect } from "chai";
import { ethers } from "hardhat";

const COOLDOWN = 60;

function encodeReport(
  setRiskMode: boolean,
  decisionId: string,
  policyId: string,
  signalType: string,
  signalValue: number,
  actionType: string,
  success: boolean,
  reason: string
): string {
  const decisionIdBytes =
    decisionId.length === 66
      ? decisionId
      : ethers.keccak256(ethers.toUtf8Bytes(decisionId));
  const policyIdBytes =
    policyId.length === 66
      ? policyId
      : ethers.keccak256(ethers.toUtf8Bytes(policyId));
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bool", "bytes32", "bytes32", "string", "int256", "string", "bool", "string"],
    [
      setRiskMode,
      decisionIdBytes,
      policyIdBytes,
      signalType,
      signalValue,
      actionType,
      success,
      reason,
    ]
  );
}

describe("SentinelFlowReceiver", () => {
  async function deploy() {
    const [owner, stranger] = await ethers.getSigners();
    const MockForwarder = await ethers.getContractFactory("MockForwarder");
    const forwarder = await MockForwarder.deploy();
    const OpsTarget = await ethers.getContractFactory("OpsTarget");
    const ops = await OpsTarget.deploy(owner.address, owner.address);
    const Journal = await ethers.getContractFactory("DecisionJournal");
    const journal = await Journal.deploy();
    const Receiver = await ethers.getContractFactory("SentinelFlowReceiver");
    const receiver = await Receiver.deploy(
      await forwarder.getAddress(),
      await ops.getAddress(),
      await journal.getAddress(),
      COOLDOWN
    );
    await ops.setExecutor(await receiver.getAddress());
    return {
      owner,
      stranger,
      forwarder,
      ops,
      journal,
      receiver,
    };
  }

  it("reverts when caller is not the forwarder", async () => {
    const { receiver, stranger } = await deploy();
    const report = encodeReport(
      false,
      "dec1",
      "policy1",
      "PRICE_DEVIATION_BPS",
      100,
      "NO_ACTION",
      true,
      "within band"
    );
    await expect(
      receiver.connect(stranger).onReport("0x", report)
    ).to.be.revertedWithCustomError(receiver, "InvalidSender");
  });

  it("NO_ACTION: only logs to DecisionJournal, OpsTarget unchanged", async () => {
    const { forwarder, ops, journal, receiver } = await deploy();
    const report = encodeReport(
      false,
      "dec-noop",
      "SENTINELFLOW_POLICY_V0",
      "PRICE_DEVIATION_BPS",
      100,
      "NO_ACTION",
      true,
      "within band"
    );
    await expect(
      forwarder.forward(await receiver.getAddress(), "0x", report)
    ).to.emit(journal, "DecisionLogged");
    expect(await ops.riskMode()).to.equal(0);
    expect(await ops.paused()).to.equal(false);
  });

  it("SET_RISK_MODE: logs and sets risk mode to 2", async () => {
    const { forwarder, ops, journal, receiver } = await deploy();
    const report = encodeReport(
      true,
      "dec-risk",
      "SENTINELFLOW_POLICY_V0",
      "PRICE_DEVIATION_BPS",
      300,
      "SET_RISK_MODE",
      true,
      "price feed drift"
    );
    await expect(
      forwarder.forward(await receiver.getAddress(), "0x", report)
    )
      .to.emit(journal, "DecisionLogged")
      .and.to.emit(ops, "RiskModeUpdated")
      .withArgs(0, 2, await receiver.getAddress());
    expect(await ops.riskMode()).to.equal(2);
  });

  it("PAUSE: logs and pauses OpsTarget", async () => {
    const { forwarder, ops, journal, receiver } = await deploy();
    const report = encodeReport(
      false,
      "dec-pause",
      "SENTINELFLOW_POLICY_V0",
      "PRICE_DEVIATION_BPS",
      800,
      "PAUSE",
      true,
      "extreme move"
    );
    await expect(
      forwarder.forward(await receiver.getAddress(), "0x", report)
    )
      .to.emit(journal, "DecisionLogged")
      .and.to.emit(ops, "Paused")
      .withArgs(await receiver.getAddress());
    expect(await ops.paused()).to.equal(true);
  });

  it("cooldown blocks repeated action, then allows after cooldown", async () => {
    const { forwarder, ops, journal, receiver } = await deploy();
    const policyId = "SENTINELFLOW_POLICY_V0";
    const report1 = encodeReport(
      true,
      "dec-1",
      policyId,
      "PRICE_DEVIATION_BPS",
      300,
      "SET_RISK_MODE",
      true,
      "drift"
    );
    const report2 = encodeReport(
      true,
      "dec-2",
      policyId,
      "PRICE_DEVIATION_BPS",
      310,
      "SET_RISK_MODE",
      true,
      "drift again"
    );
    const report3 = encodeReport(
      true,
      "dec-3",
      policyId,
      "PRICE_DEVIATION_BPS",
      320,
      "SET_RISK_MODE",
      true,
      "after cooldown"
    );

    await forwarder.forward(await receiver.getAddress(), "0x", report1);
    expect(await ops.riskMode()).to.equal(2);

    await forwarder.forward(await receiver.getAddress(), "0x", report2);
    expect(await ops.riskMode()).to.equal(2);
    const filter = journal.filters.DecisionLogged();
    const logs = await journal.queryFilter(filter);
    const lastLog = logs[logs.length - 1];
    expect(lastLog.args.actionType).to.equal("COOLDOWN_BLOCKED");
    expect(lastLog.args.reason).to.include("Cooldown");

    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine", []);

    await forwarder.forward(await receiver.getAddress(), "0x", report3);
    expect(await ops.riskMode()).to.equal(2);
    const logsAfter = await journal.queryFilter(filter);
    const thirdLog = logsAfter[logsAfter.length - 1];
    expect(thirdLog.args.actionType).to.equal("SET_RISK_MODE");
  });
});
