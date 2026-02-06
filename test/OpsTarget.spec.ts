import { expect } from "chai";
import { ethers } from "hardhat";

describe("OpsTarget", () => {
  it("only executor can call ops functions", async () => {
    const [owner, exec, attacker] = await ethers.getSigners();

    const OpsTarget = await ethers.getContractFactory("OpsTarget");
    const ops = await OpsTarget.deploy(owner.address, exec.address);

    await expect(ops.connect(attacker).pause()).to.be.revertedWithCustomError(ops, "NotExecutor");
    await expect(ops.connect(exec).pause()).to.emit(ops, "Paused").withArgs(exec.address);

    await expect(ops.connect(attacker).setRiskMode(2)).to.be.revertedWithCustomError(ops, "NotExecutor");
    await expect(ops.connect(exec).setRiskMode(2)).to.emit(ops, "RiskModeUpdated");
  });

  it("owner can rotate executor", async () => {
    const [owner, exec, exec2] = await ethers.getSigners();
    const OpsTarget = await ethers.getContractFactory("OpsTarget");
    const ops = await OpsTarget.deploy(owner.address, exec.address);

    await expect(ops.connect(exec2).pause()).to.be.revertedWithCustomError(ops, "NotExecutor");

    await expect(ops.connect(owner).setExecutor(exec2.address))
      .to.emit(ops, "ExecutorUpdated")
      .withArgs(exec.address, exec2.address);

    await expect(ops.connect(exec2).pause()).to.emit(ops, "Paused").withArgs(exec2.address);
  });
});
