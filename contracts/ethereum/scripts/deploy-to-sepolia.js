const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🚀 Deploying 1inch Fusion+ Cross-Chain Extension to Sepolia...");
    console.log("========================================================");

    const [deployer] = await ethers.getSigners();
    console.log("📋 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    console.log("🌐 Network:", (await ethers.provider.getNetwork()).name);
    console.log("⛓️  Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());

    // Chain IDs for destination chains
    const NEAR_MAINNET_ID = 40001;
    const NEAR_TESTNET_ID = 40002;
    const COSMOS_MAINNET_ID = 40003;
    const BITCOIN_MAINNET_ID = 40004;

    console.log("\n📦 Step 1: Deploying CrossChainRegistry...");
    const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
    const registry = await CrossChainRegistry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log("✅ CrossChainRegistry deployed to:", registryAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + registryAddress);

    console.log("\n📦 Step 2: Deploying NEAR Destination Chain Adapters...");
    
    // Deploy NEAR Mainnet adapter
    const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
    const nearMainnetAdapter = await NearDestinationChain.deploy(NEAR_MAINNET_ID);
    await nearMainnetAdapter.waitForDeployment();
    const nearMainnetAddress = await nearMainnetAdapter.getAddress();
    console.log("✅ NEAR Mainnet Adapter deployed to:", nearMainnetAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + nearMainnetAddress);

    // Deploy NEAR Testnet adapter
    const nearTestnetAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_ID);
    await nearTestnetAdapter.waitForDeployment();
    const nearTestnetAddress = await nearTestnetAdapter.getAddress();
    console.log("✅ NEAR Testnet Adapter deployed to:", nearTestnetAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + nearTestnetAddress);

    console.log("\n📦 Step 3: Deploying FusionPlusFactory...");
    const FusionPlusFactory = await ethers.getContractFactory("FusionPlusFactory");
    const factory = await FusionPlusFactory.deploy(registryAddress);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("✅ FusionPlusFactory deployed to:", factoryAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + factoryAddress);

    console.log("\n🔧 Step 4: Registering Destination Chain Adapters...");
    
    // Register NEAR adapters
    console.log("📝 Registering NEAR Mainnet adapter...");
    let tx = await registry.registerChainAdapter(NEAR_MAINNET_ID, nearMainnetAddress);
    await tx.wait();
    console.log("✅ NEAR Mainnet adapter registered");

    console.log("📝 Registering NEAR Testnet adapter...");
    tx = await registry.registerChainAdapter(NEAR_TESTNET_ID, nearTestnetAddress);
    await tx.wait();
    console.log("✅ NEAR Testnet adapter registered");

    console.log("\n👥 Step 5: Setting up Initial Resolver Authorization...");
    // Add deployer as initial authorized resolver for testing
    tx = await factory.authorizeResolver(deployer.address);
    await tx.wait();
    console.log("✅ Deployer authorized as resolver");

    console.log("\n🧪 Step 6: Verifying Deployment...");
    
    // Verify registry
    const supportedChains = await registry.getSupportedChainIds();
    console.log("📊 Supported chains:", supportedChains.map(id => id.toString()));
    
    // Verify NEAR adapters
    const nearMainnetInfo = await registry.getChainInfo(NEAR_MAINNET_ID);
    const nearTestnetInfo = await registry.getChainInfo(NEAR_TESTNET_ID);
    console.log("🌐 NEAR Mainnet:", nearMainnetInfo.name, "- Active:", nearMainnetInfo.isActive);
    console.log("🌐 NEAR Testnet:", nearTestnetInfo.name, "- Active:", nearTestnetInfo.isActive);
    
    // Verify factory
    const resolverCount = await factory.resolverCount();
    const isResolverAuthorized = await factory.authorizedResolvers(deployer.address);
    console.log("👥 Authorized resolvers:", resolverCount.toString());
    console.log("✅ Deployer is authorized resolver:", isResolverAuthorized);

    console.log("\n🎉 Deployment Summary");
    console.log("====================");
    console.log(`📋 CrossChainRegistry: ${registryAddress}`);
    console.log(`🏭 FusionPlusFactory: ${factoryAddress}`);
    console.log(`🌐 NEAR Mainnet Adapter: ${nearMainnetAddress}`);
    console.log(`🌐 NEAR Testnet Adapter: ${nearTestnetAddress}`);
    console.log("");
    console.log("📊 Statistics:");
    console.log(`   - Network: Sepolia`);
    console.log(`   - Chain ID: 11155111`);
    console.log(`   - Supported Chains: ${supportedChains.length}`);
    console.log(`   - Authorized Resolvers: ${resolverCount}`);
    console.log("");
    console.log("🔗 Etherscan Links:");
    console.log(`   - Registry: https://sepolia.etherscan.io/address/${registryAddress}`);
    console.log(`   - Factory: https://sepolia.etherscan.io/address/${factoryAddress}`);
    console.log(`   - NEAR Mainnet: https://sepolia.etherscan.io/address/${nearMainnetAddress}`);
    console.log(`   - NEAR Testnet: https://sepolia.etherscan.io/address/${nearTestnetAddress}`);
    console.log("");
    console.log("🔗 Next Steps:");
    console.log("   1. Verify contracts on Etherscan");
    console.log("   2. Test cross-chain order creation");
    console.log("   3. Authorize 1inch resolvers");
    console.log("   4. Create end-to-end demo with NEAR testnet");

    // Save deployment addresses
    const deploymentInfo = {
        network: "sepolia",
        chainId: "11155111",
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            CrossChainRegistry: registryAddress,
            FusionPlusFactory: factoryAddress,
            NearMainnetAdapter: nearMainnetAddress,
            NearTestnetAdapter: nearTestnetAddress,
        },
        chainIds: {
            NEAR_MAINNET: NEAR_MAINNET_ID,
            NEAR_TESTNET: NEAR_TESTNET_ID,
            COSMOS_MAINNET: COSMOS_MAINNET_ID,
            BITCOIN_MAINNET: BITCOIN_MAINNET_ID,
        },
        supportedChains: supportedChains.map(id => id.toString()),
        initialResolvers: [deployer.address],
        etherscanLinks: {
            registry: `https://sepolia.etherscan.io/address/${registryAddress}`,
            factory: `https://sepolia.etherscan.io/address/${factoryAddress}`,
            nearMainnet: `https://sepolia.etherscan.io/address/${nearMainnetAddress}`,
            nearTestnet: `https://sepolia.etherscan.io/address/${nearTestnetAddress}`
        }
    };

    // Write deployment info to file
    const deploymentPath = path.join(__dirname, '..', 'sepolia-deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);
    
    return deploymentInfo;
}

// Handle script execution
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = { main };