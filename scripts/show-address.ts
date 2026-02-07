/**
 * Print the Ethereum address for a private key in env.
 * Usage (from repo root, with .env loaded):
 *   npx hardhat run scripts/show-address.ts
 * Reads DEPLOYER_PRIVATE_KEY from env (or CRE_ETH_PRIVATE_KEY if you set that in root .env).
 * Use this address as FORWARDER_ADDRESS when using the same key for CRE workflow simulate.
 */
import { ethers } from "hardhat";

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY || process.env.CRE_ETH_PRIVATE_KEY;
  if (!pk) {
    console.error("Set DEPLOYER_PRIVATE_KEY or CRE_ETH_PRIVATE_KEY in .env");
    process.exitCode = 1;
    return;
  }
  const key = pk.startsWith("0x") ? pk : "0x" + pk;
  const wallet = new ethers.Wallet(key);
  console.log("Address (use as FORWARDER_ADDRESS for CRE simulate):", wallet.address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
