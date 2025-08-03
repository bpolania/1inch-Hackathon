const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying contracts for testing...");
  console.log("=====================================");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`📋 Deploying with account: ${deployer.address}`);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

  const deployments = {};

  try {
    // Deploy CrossChainRegistry
    console.log("📦 Deploying CrossChainRegistry...");
    const CrossChainRegistry = await hre.ethers.getContractFactory("CrossChainRegistry");
    const registry = await CrossChainRegistry.deploy();
    await registry.waitForDeployment();
    deployments.CrossChainRegistry = await registry.getAddress();
    console.log(`✅ CrossChainRegistry deployed to: ${deployments.CrossChainRegistry}\n`);

    // Deploy CosmosDestinationChain for Neutron
    console.log("📦 Deploying CosmosDestinationChain for Neutron...");
    const CosmosDestinationChain = await hre.ethers.getContractFactory("CosmosDestinationChain");
    const cosmosAdapter = await CosmosDestinationChain.deploy(7001); // NEUTRON_TESTNET
    await cosmosAdapter.waitForDeployment();
    deployments.CosmosDestinationChain = await cosmosAdapter.getAddress();
    console.log(`✅ CosmosDestinationChain deployed to: ${deployments.CosmosDestinationChain}\n`);

    // Deploy NearDestinationChain
    console.log("📦 Deploying NearDestinationChain...");
    const NearDestinationChain = await hre.ethers.getContractFactory("NearDestinationChain");
    const nearAdapter = await NearDestinationChain.deploy(40001); // NEAR_TESTNET
    await nearAdapter.waitForDeployment();
    deployments.NearDestinationChain = await nearAdapter.getAddress();
    console.log(`✅ NearDestinationChain deployed to: ${deployments.NearDestinationChain}\n`);

    // Deploy MockERC20 for testing
    console.log("📦 Deploying MockERC20 for testing...");
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20.deploy("Test USDC", "USDC", 6);
    await mockToken.waitForDeployment();
    deployments.MockERC20 = await mockToken.getAddress();
    console.log(`✅ MockERC20 deployed to: ${deployments.MockERC20}\n`);

    // Deploy Production Escrow Factory (simplified version)
    console.log("📦 Deploying ProductionOneInchEscrowFactory...");
    const ProductionOneInchEscrowFactory = await hre.ethers.getContractFactory("ProductionOneInchEscrowFactory");
    const escrowFactory = await ProductionOneInchEscrowFactory.deploy();
    await escrowFactory.waitForDeployment();
    deployments.ProductionOneInchEscrowFactory = await escrowFactory.getAddress();
    console.log(`✅ ProductionOneInchEscrowFactory deployed to: ${deployments.ProductionOneInchEscrowFactory}\n`);


    

    // Save deployment info
    const fs = require('fs');
    fs.writeFileSync('deployments-local.json', JSON.stringify(deployments, null, 2));

    console.log("🎉 All contracts deployed successfully!");
    console.log("📄 Deployment addresses saved to deployments-local.json");
    console.log("\n📋 Deployment Summary:");
    Object.entries(deployments).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });

    return deployments;

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;