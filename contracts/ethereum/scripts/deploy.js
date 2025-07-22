const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment of cross-chain contracts...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy MockERC20 for testing (only on testnets)
  console.log("📄 Deploying MockERC20 test token...");
  const MockToken = await ethers.getContractFactory("MockERC20");
  const testToken = await MockToken.deploy("Test USDC", "USDC", 18);
  await testToken.waitForDeployment();
  console.log("✅ MockERC20 deployed to:", testToken.target);

  // Mint some test tokens to deployer
  const mintAmount = ethers.parseEther("10000"); // 10,000 test tokens
  await testToken.mint(deployer.address, mintAmount);
  console.log("✅ Minted", ethers.formatEther(mintAmount), "test tokens to deployer\n");

  // Deploy CrossChainFactory
  console.log("🏭 Deploying CrossChainFactory...");
  const CrossChainFactory = await ethers.getContractFactory("CrossChainFactory");
  const factory = await CrossChainFactory.deploy();
  await factory.waitForDeployment();
  console.log("✅ CrossChainFactory deployed to:", factory.target);

  // Add deployer as an authorized resolver for testing
  console.log("🔧 Adding deployer as authorized resolver...");
  await factory.addResolver(deployer.address);
  console.log("✅ Deployer added as resolver\n");

  // Deploy a sample CrossChainEscrow for reference
  console.log("🔒 Deploying sample CrossChainEscrow...");
  const CrossChainEscrow = await ethers.getContractFactory("CrossChainEscrow");
  const sampleEscrow = await CrossChainEscrow.deploy();
  await sampleEscrow.waitForDeployment();
  console.log("✅ Sample CrossChainEscrow deployed to:", sampleEscrow.target);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(50));
  console.log("📋 Contract Addresses:");
  console.log("├── CrossChainFactory:", factory.target);
  console.log("├── Sample CrossChainEscrow:", sampleEscrow.target);
  console.log("└── Test Token (USDC):", testToken.target);
  console.log("\n📝 Deployment Summary:");
  console.log("├── Network:", (await ethers.provider.getNetwork()).name);
  console.log("├── Deployer:", deployer.address);
  console.log("├── Gas Price:", ethers.formatUnits(await ethers.provider.getFeeData().then(f => f.gasPrice), 'gwei'), "gwei");
  console.log("└── Block Number:", await ethers.provider.getBlockNumber());
  
  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId), // Convert BigInt to Number
    deployer: deployer.address,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    contracts: {
      CrossChainFactory: factory.target,
      SampleCrossChainEscrow: sampleEscrow.target,
      TestToken: testToken.target
    }
  };

  console.log("\n📦 Deployment info saved to deployments.json");
  
  // For hackathon demo purposes
  console.log("\n🎯 HACKATHON DEMO READY!");
  console.log("Next steps:");
  console.log("1. Verify contracts on Etherscan");
  console.log("2. Test creating an intent");
  console.log("3. Demonstrate cross-chain swap flow");
  console.log("4. Deploy destination chain contracts (Aptos/Bitcoin/Cosmos)");

  return deploymentInfo;
}

main()
  .then((info) => {
    const fs = require('fs');
    fs.writeFileSync('deployments.json', JSON.stringify(info, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });