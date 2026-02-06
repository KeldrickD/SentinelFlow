import { expect } from "chai";
import { ethers } from "hardhat";

describe("DecisionJournal", () => {
  it("emits DecisionLogged", async () => {
    const [caller] = await ethers.getSigners();
    const Journal = await ethers.getContractFactory("DecisionJournal");
    const j = await Journal.deploy();

    const decisionId = ethers.keccak256(ethers.toUtf8Bytes("d1"));
    const policyId = ethers.keccak256(ethers.toUtf8Bytes("p1"));

    await expect(
      j.connect(caller).logDecision(
        decisionId,
        policyId,
        "PRICE_DEVIATION_BPS",
        620,
        "SET_RISK_MODE",
        true,
        "Deviation 6.2% > 5.0%"
      )
    ).to.emit(j, "DecisionLogged");
  });
});
