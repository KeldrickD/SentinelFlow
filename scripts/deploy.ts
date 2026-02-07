import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const forwarderAddress = process.env.FORWARDER_ADDRESS as string | undefined;
  const cooldownSeconds = Number(process.env.COOLDOWN_SECONDS ?? "60");

  // Resolve forwarder: use env (must be valid 0x address) or deploy mock for local
  let forwarder: string;
  if (forwarderAddress && ethers.isAddress(forwarderAddress)) {
    forwarder = forwarderAddress;
  } else if (forwarderAddress) {
    throw new Error("FORWARDER_ADDRESS must be a valid 0x address (40 hex chars). Leave unset to deploy MockForwarder.");
  } else {
    const MockForwarder = await ethers.getContractFactory("MockForwarder");
    const mock = await MockForwarder.deploy();
    forwarder = await mock.getAddress();
    console.log("MockForwarder (local):", forwarder);
  }

  const OpsTarget = await ethers.getContractFactory("OpsTarget");
  const ops = await OpsTarget.deploy(deployer.address, deployer.address);

  const Journal = await ethers.getContractFactory("DecisionJournal");
  const journal = await Journal.deploy();

  const Receiver = await ethers.getContractFactory("SentinelFlowReceiver");
  const receiver = await Receiver.deploy(
    forwarder,
    await ops.getAddress(),
    await journal.getAddress(),
    cooldownSeconds
  );

  await ops.setExecutor(await receiver.getAddress());

  console.log("Deployer:", deployer.address);
  console.log("OpsTarget:", await ops.getAddress());
  console.log("DecisionJournal:", await journal.getAddress());
  console.log("SentinelFlowReceiver:", await receiver.getAddress());
  console.log("CooldownSeconds:", cooldownSeconds);

  if (process.env.UPDATE_CRE_CONFIG === "1") {
    const configPath = path.join(__dirname, "..", "cre", "sentinelflow", "config.staging.json");
    const config = {
      chainName: process.env.CRE_CHAIN_NAME ?? "ethereum-testnet-sepolia-base-1",
      receiver: await receiver.getAddress(),
      gasLimit: "500000",
      deviationBpsThreshold: 250,
      pauseBpsThreshold: 700,
      riskModeWhenExceeded: 2,
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("Updated CRE config:", configPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
