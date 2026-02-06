import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const executor = deployer.address; // for now; later set to the CRE workflow executor/relayer
  const OpsTarget = await ethers.getContractFactory("OpsTarget");
  const ops = await OpsTarget.deploy(deployer.address, executor);

  const Journal = await ethers.getContractFactory("DecisionJournal");
  const journal = await Journal.deploy();

  console.log("Deployer:", deployer.address);
  console.log("OpsTarget:", await ops.getAddress());
  console.log("DecisionJournal:", await journal.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
