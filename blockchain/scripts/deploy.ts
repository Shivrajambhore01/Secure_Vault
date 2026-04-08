import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SecureVaultInheritance contract...");

  const SecureVaultInheritance = await ethers.getContractFactory("SecureVaultInheritance");
  const contract = await SecureVaultInheritance.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`SecureVaultInheritance deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
