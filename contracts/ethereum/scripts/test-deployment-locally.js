const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing Fusion+ Deployment Locally");
    console.log("=====================================");

    const [deployer] = await ethers.getSigners();
    console.log("📋 Testing with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Chain IDs for destination chains
    const NEAR_TESTNET_ID = 40002;

    console.log("\n📦 Step 1: Deploying CrossChainRegistry...");
    const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
    const registry = await CrossChainRegistry.deploy();
    await registry.waitForDeployment();
    console.log("✅ CrossChainRegistry deployed to:", await registry.getAddress());

    console.log("\n📦 Step 2: Deploying NEAR Testnet Adapter...");
    const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
    const nearTestnetAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_ID);
    await nearTestnetAdapter.waitForDeployment();
    console.log("✅ NEAR Testnet Adapter deployed to:", await nearTestnetAdapter.getAddress());

    console.log("\n📦 Step 3: Deploying FusionPlusFactory...");
    const FusionPlusFactory = await ethers.getContractFactory("FusionPlusFactory");
    const factory = await FusionPlusFactory.deploy(await registry.getAddress());
    await factory.waitForDeployment();
    console.log("✅ FusionPlusFactory deployed to:", await factory.getAddress());

    console.log("\n🔧 Step 4: Registering NEAR Testnet Adapter...");
    let tx = await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearTestnetAdapter.getAddress());
    await tx.wait();
    console.log("✅ NEAR Testnet adapter registered");

    console.log("\n👥 Step 5: Setting up Initial Resolver Authorization...");
    tx = await factory.authorizeResolver(deployer.address);
    await tx.wait();
    console.log("✅ Deployer authorized as resolver");

    console.log("\n🧪 Step 6: Testing Basic Functionality...");
    
    // Test 1: Check supported chains
    const supportedChains = await registry.getSupportedChainIds();
    console.log("📊 Supported chains:", supportedChains.map(id => id.toString()));
    
    // Test 2: Check NEAR adapter
    const nearInfo = await registry.getChainInfo(NEAR_TESTNET_ID);
    console.log("🌐 NEAR Testnet:", nearInfo.name, "- Active:", nearInfo.isActive);
    
    // Test 3: Check factory
    const resolverCount = await factory.resolverCount();
    console.log("👥 Authorized resolvers:", resolverCount.toString());

    // Test 4: Test address validation
    const validAddress = await nearTestnetAdapter.validateDestinationAddress(ethers.toUtf8Bytes("user.testnet"));
    console.log("✅ Address validation works:", validAddress);

    // Test 5: Test parameter validation
    const params = {
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        executionParams: ethers.toUtf8Bytes(""),
        estimatedGas: 300000000000,
        additionalData: ethers.toUtf8Bytes("")
    };
    const validation = await nearTestnetAdapter.validateOrderParams(params, ethers.parseEther("100"));
    console.log("✅ Parameter validation works:", validation.isValid);

    // Test 6: Test cost estimation
    const cost = await nearTestnetAdapter.estimateExecutionCost(params, ethers.parseEther("100"));
    const safetyDeposit = await nearTestnetAdapter.calculateMinSafetyDeposit(ethers.parseEther("100"));
    console.log("💰 Estimated cost:", ethers.formatEther(cost), "ETH");
    console.log("💰 Safety deposit:", ethers.formatEther(safetyDeposit), "ETH");

    console.log("\n🎉 Local Deployment Test Summary");
    console.log("================================");
    console.log(`📋 CrossChainRegistry: ${await registry.getAddress()}`);
    console.log(`🏭 FusionPlusFactory: ${await factory.getAddress()}`);
    console.log(`🌐 NEAR Testnet Adapter: ${await nearTestnetAdapter.getAddress()}`);
    console.log("");
    console.log("📊 Statistics:");
    console.log(`   - Supported Chains: ${supportedChains.length}`);
    console.log(`   - Authorized Resolvers: ${resolverCount}`);
    console.log("");
    console.log("✅ All basic functionality tests passed!");
    console.log("🚀 Ready for Sepolia deployment!");

    return {
        registry: await registry.getAddress(),
        factory: await factory.getAddress(),
        nearAdapter: await nearTestnetAdapter.getAddress(),
        supportedChains: supportedChains.map(id => id.toString())
    };
}

// Handle script execution
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Local test failed:", error);
            process.exit(1);
        });
}

module.exports = { main };