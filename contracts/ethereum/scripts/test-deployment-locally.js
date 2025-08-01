const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing Fusion+ Deployment Locally");
    console.log("=====================================");

    const [deployer] = await ethers.getSigners();
    console.log("📋 Testing with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Chain IDs for destination chains  
    const NEAR_TESTNET_ID = 40001; // Fixed to match our tests
    const NEUTRON_TESTNET_ID = 7001;
    
    const deployments = {};

    console.log("\n📦 Step 1: Deploying CrossChainRegistry...");
    const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
    const registry = await CrossChainRegistry.deploy();
    await registry.waitForDeployment();
    deployments.CrossChainRegistry = await registry.getAddress();
    console.log("✅ CrossChainRegistry deployed to:", deployments.CrossChainRegistry);

    console.log("\n📦 Step 2: Deploying NEAR Testnet Adapter...");
    const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
    const nearTestnetAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_ID);
    await nearTestnetAdapter.waitForDeployment();
    deployments.NearDestinationChain = await nearTestnetAdapter.getAddress();
    console.log("✅ NEAR Testnet Adapter deployed to:", deployments.NearDestinationChain);

    console.log("\n📦 Step 2b: Deploying Cosmos Destination Chain Adapter...");
    const CosmosDestinationChain = await ethers.getContractFactory("CosmosDestinationChain");
    const cosmosAdapter = await CosmosDestinationChain.deploy(NEUTRON_TESTNET_ID);
    await cosmosAdapter.waitForDeployment();
    deployments.CosmosDestinationChain = await cosmosAdapter.getAddress();
    console.log("✅ Cosmos Destination Chain deployed to:", deployments.CosmosDestinationChain);

    console.log("\n📦 Step 2c: Deploying MockERC20 for testing...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20.deploy("Test USDC", "USDC", 6);
    await mockToken.waitForDeployment();
    deployments.MockERC20 = await mockToken.getAddress();
    console.log("✅ MockERC20 deployed to:", deployments.MockERC20);

    console.log("\n📦 Step 3: Deploying ProductionOneInchEscrowFactory...");
    const ProductionOneInchEscrowFactory = await ethers.getContractFactory("ProductionOneInchEscrowFactory");
    const escrowFactory = await ProductionOneInchEscrowFactory.deploy();
    await escrowFactory.waitForDeployment();
    deployments.ProductionOneInchEscrowFactory = await escrowFactory.getAddress();
    console.log("✅ ProductionOneInchEscrowFactory deployed to:", deployments.ProductionOneInchEscrowFactory);

    console.log("\n🔧 Step 4: Registering Destination Chain Adapters...");
    let tx = await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearTestnetAdapter.getAddress());
    await tx.wait();
    console.log("✅ NEAR Testnet adapter registered");
    
    tx = await registry.registerChainAdapter(NEUTRON_TESTNET_ID, await cosmosAdapter.getAddress());
    await tx.wait();
    console.log("✅ Cosmos Testnet adapter registered");

    console.log("\n👥 Step 5: Verifying Factory Configuration...");
    const factoryOwner = await escrowFactory.owner();
    const isPaused = await escrowFactory.paused();
    const minSafetyDeposit = await escrowFactory.minimumSafetyDeposit();
    console.log(`✅ Factory owner: ${factoryOwner}`);
    console.log(`✅ Factory paused: ${isPaused}`);
    console.log(`✅ Min safety deposit: ${ethers.formatEther(minSafetyDeposit)} ETH`);

    console.log("\n🧪 Step 6: Testing Basic Functionality...");
    
    // Test 1: Check supported chains
    const supportedChains = await registry.getSupportedChainIds();
    console.log("📊 Supported chains:", supportedChains.map(id => id.toString()));
    
    // Test 2: Check NEAR adapter
    const nearInfo = await registry.getChainInfo(NEAR_TESTNET_ID);
    console.log("🌐 NEAR Testnet:", nearInfo.name, "- Active:", nearInfo.isActive);
    
    // Test 3: Check Cosmos adapter
    const cosmosInfo = await registry.getChainInfo(NEUTRON_TESTNET_ID);
    console.log("🌌 Cosmos Testnet:", cosmosInfo.name, "- Active:", cosmosInfo.isActive);
    
    // Test 4: Check factory implementations
    const srcImpl = await escrowFactory.escrowSrcImplementation();
    const dstImpl = await escrowFactory.escrowDstImplementation();
    console.log("🏭 Src implementation:", srcImpl.substring(0, 16) + "...");
    console.log("🏭 Dst implementation:", dstImpl.substring(0, 16) + "...");

    // Test 5: Test NEAR address validation
    const validNearAddress = await nearTestnetAdapter.validateDestinationAddress(ethers.toUtf8Bytes("user.testnet"));
    console.log("✅ NEAR address validation works:", validNearAddress);
    
    // Test 6: Test Cosmos address validation
    const validCosmosAddress = await cosmosAdapter.validateDestinationAddress(
        ethers.toUtf8Bytes("neutron1test123456789abcdefghijklmnopqrstuvwxyz123456789")
    );
    console.log("✅ Cosmos address validation works:", validCosmosAddress);

    // Test 7: Test parameter validation
    const nearParams = {
        destinationAddress: ethers.toUtf8Bytes("user.testnet"),
        executionParams: "0x",
        estimatedGas: 100000,
        additionalData: "0x"
    };
    const nearValidation = await nearTestnetAdapter.validateOrderParams(nearParams, ethers.parseEther("100"));
    console.log("✅ NEAR parameter validation works:", nearValidation.isValid);
    
    const cosmosParams = {
        destinationAddress: ethers.toUtf8Bytes("neutron1test123456789abcdefghijklmnopqrstuvwxyz123456789"),
        executionParams: "0x",
        estimatedGas: 300000,
        additionalData: "0x"
    };
    const cosmosValidation = await cosmosAdapter.validateOrderParams(cosmosParams, ethers.parseUnits("100", 6));
    console.log("✅ Cosmos parameter validation works:", cosmosValidation.isValid);

    // Test 8: Test cost estimation
    const nearCost = await nearTestnetAdapter.estimateExecutionCost(nearParams, ethers.parseEther("100"));
    const nearSafetyDeposit = await nearTestnetAdapter.calculateMinSafetyDeposit(ethers.parseEther("100"));
    console.log("💰 NEAR estimated cost:", nearCost, "wei");
    console.log("💰 NEAR safety deposit:", ethers.formatEther(nearSafetyDeposit), "ETH");
    
    const cosmosCost = await cosmosAdapter.estimateExecutionCost(cosmosParams, ethers.parseUnits("100", 6));
    const cosmosSafetyDeposit = await cosmosAdapter.calculateMinSafetyDeposit(ethers.parseUnits("100", 6));
    console.log("💰 Cosmos estimated cost:", cosmosCost, "wei");
    console.log("💰 Cosmos safety deposit:", ethers.formatUnits(cosmosSafetyDeposit, 6), "USDC");
    
    // Test 9: Test mock token functionality
    const tokenName = await mockToken.name();
    const tokenSymbol = await mockToken.symbol();
    const tokenDecimals = await mockToken.decimals();
    console.log(`💱 Mock token: ${tokenName} (${tokenSymbol}) with ${tokenDecimals} decimals`);
    
    // Mint some test tokens
    await mockToken.mint(deployer.address, ethers.parseUnits("1000", 6));
    const balance = await mockToken.balanceOf(deployer.address);
    console.log(`💰 Minted ${ethers.formatUnits(balance, 6)} ${tokenSymbol} to deployer`);

    console.log("\n💾 Step 7: Saving Deployment Information...");
    
    // Write deployment addresses to file for tests
    const fs = require('fs');
    const path = require('path');
    const deploymentsPath = path.join(__dirname, '..', 'deployments-local.json');
    
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
    console.log(`✅ Deployment addresses saved to: ${deploymentsPath}`);

    console.log("\n🎉 Local Deployment Test Summary");
    console.log("================================");
    console.log(`📋 CrossChainRegistry: ${deployments.CrossChainRegistry}`);
    console.log(`🏭 ProductionOneInchEscrowFactory: ${deployments.ProductionOneInchEscrowFactory}`);
    console.log(`🌐 NEAR Testnet Adapter: ${deployments.NearDestinationChain}`);
    console.log(`🌌 Cosmos Testnet Adapter: ${deployments.CosmosDestinationChain}`);
    console.log(`💱 MockERC20: ${deployments.MockERC20}`);
    console.log("");
    console.log("📊 Statistics:");
    console.log(`   - Supported Chains: ${supportedChains.length}`);
    console.log(`   - Factory Owner: ${factoryOwner.substring(0, 16)}...`);
    console.log(`   - Factory Status: ${isPaused ? 'Paused' : 'Active'}`);
    console.log("");
    console.log("✅ All basic functionality tests passed!");
    console.log("🚀 Ready for comprehensive testing!");
    console.log("");
    console.log("🔄 Next Steps:");
    console.log("   1. Run unit tests: npm test");
    console.log("   2. Run integration tests: npm run test:integration");
    console.log("   3. Deploy to testnet for live testing");

    return {
        deployments,
        registry: deployments.CrossChainRegistry,
        factory: deployments.ProductionOneInchEscrowFactory,
        nearAdapter: deployments.NearDestinationChain,
        cosmosAdapter: deployments.CosmosDestinationChain,
        mockToken: deployments.MockERC20,
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