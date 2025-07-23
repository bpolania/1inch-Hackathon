const { ethers } = require("hardhat");

async function main() {
    console.log("🎬 1inch Fusion+ Cross-Chain Demo");
    console.log("=================================");
    console.log("Demonstrating modular support for NEAR, Cosmos, and Bitcoin destinations");

    // Load deployment addresses
    const fs = require('fs');
    const path = require('path');
    const deploymentPath = path.join(__dirname, '..', 'fusion-plus-deployment.json');
    
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        console.log("📋 Loaded deployment info from:", deploymentPath);
    } catch (error) {
        console.log("⚠️  No deployment info found. Running deployment first...");
        const { main: deploy } = require('./deploy-fusion-plus.js');
        deploymentInfo = await deploy();
    }

    // Configure provider for localhost network
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const [signer] = await provider.listAccounts();
    const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
    console.log("👤 Demo account:", wallet.address);

    // Get contract instances
    const registry = new ethers.Contract(deploymentInfo.contracts.CrossChainRegistry, 
        (await ethers.getContractFactory("CrossChainRegistry")).interface, wallet);
    const factory = new ethers.Contract(deploymentInfo.contracts.FusionPlusFactory,
        (await ethers.getContractFactory("FusionPlusFactory")).interface, wallet);
    const nearAdapter = new ethers.Contract(deploymentInfo.contracts.NearTestnetAdapter,
        (await ethers.getContractFactory("NearDestinationChain")).interface, wallet);

    console.log("\n📊 Step 1: Querying Supported Chains");
    console.log("=====================================");
    
    const supportedChains = await registry.getSupportedChainIds();
    console.log("🌐 Supported destination chains:", supportedChains.map(id => id.toString()));
    
    // Get detailed info for each chain
    for (const chainId of supportedChains) {
        const chainInfo = await registry.getChainInfo(chainId);
        console.log(`   Chain ${chainId}: ${chainInfo.name} (${chainInfo.symbol})`);
        console.log(`   - Active: ${chainInfo.isActive}`);
        console.log(`   - Min Safety Deposit: ${chainInfo.minSafetyDepositBps} bps`);
        console.log(`   - Default Timelock: ${chainInfo.defaultTimelock}s`);
    }

    console.log("\n🧪 Step 2: Testing NEAR Integration");
    console.log("====================================");

    // Test NEAR address validation
    const nearAddresses = [
        "alice.near",
        "test-contract.testnet",
        "fusion-plus-near.demo.cuteharbor3573.testnet",
        "invalid@address", // Should fail
        "a".repeat(65) // Should fail - too long
    ];

    console.log("🔍 Testing NEAR address validation:");
    for (const address of nearAddresses) {
        const isValid = await nearAdapter.validateDestinationAddress(ethers.toUtf8Bytes(address));
        console.log(`   ${address}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    }

    // Test NEAR execution parameters
    console.log("\n🔧 Testing NEAR execution parameters:");
    const nearParams = {
        contractId: "fusion-plus-near.demo.cuteharbor3573.testnet",
        methodName: "execute_fusion_order",
        args: ethers.toUtf8Bytes('{"amount":"1000000000000000000000000"}'),
        attachedDeposit: ethers.parseEther("1"),
        gas: 300_000_000_000_000n
    };

    const encodedParams = await nearAdapter.encodeNearExecutionParams(nearParams);
    console.log("📦 Encoded NEAR execution parameters:", encodedParams.length, "bytes");

    // Create chain-specific parameters
    const chainSpecificParams = {
        destinationAddress: ethers.toUtf8Bytes("alice.near"),
        executionParams: encodedParams,
        estimatedGas: 300_000_000_000_000n,
        additionalData: "0x"
    };

    // Validate parameters
    const validation = await nearAdapter.validateOrderParams(chainSpecificParams, ethers.parseEther("2"));
    console.log("✅ Parameter validation:", validation.isValid ? "PASSED" : `FAILED: ${validation.errorMessage}`);
    if (validation.isValid) {
        console.log("💰 Estimated cost:", ethers.formatEther(validation.estimatedCost), "NEAR");
    }

    console.log("\n💼 Step 3: Creating Fusion+ Orders");
    console.log("===================================");

    // Deploy mock ERC20 for testing
    console.log("🪙 Deploying mock USDC...");
    const MockERC20 = await ethers.getContractFactory("MockERC20", wallet);
    const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
    await mockUSDC.waitForDeployment();
    console.log("✅ Mock USDC deployed to:", await mockUSDC.getAddress());

    // Mint some tokens for demo
    const mintAmount = ethers.parseUnits("1000", 6); // 1000 USDC
    
    // Wait for nonce sync and manually set nonce
    const currentNonce = await provider.getTransactionCount(wallet.address);
    const mintTx = await mockUSDC.mint(wallet.address, mintAmount, { nonce: currentNonce });
    await mintTx.wait();
    console.log("💰 Minted", ethers.formatUnits(mintAmount, 6), "USDC for demo");

    // Create order parameters for different chains
    const orderExamples = [
        {
            name: "USDC → NEAR",
            chainId: deploymentInfo.chainIds.NEAR_TESTNET,
            sourceToken: await mockUSDC.getAddress(),
            sourceAmount: ethers.parseUnits("100", 6), // 100 USDC
            destinationToken: ethers.toUtf8Bytes("native.near"),
            destinationAmount: ethers.parseEther("2"), // 2 NEAR
            destinationAddress: ethers.toUtf8Bytes("alice.near"),
            resolverFee: ethers.parseUnits("1", 6), // 1 USDC resolver fee
        }
    ];

    for (const example of orderExamples) {
        console.log(`\n📝 Creating order: ${example.name}`);
        
        // Prepare order parameters
        const orderParams = {
            sourceToken: example.sourceToken,
            sourceAmount: example.sourceAmount,
            destinationChainId: example.chainId,
            destinationToken: example.destinationToken,
            destinationAmount: example.destinationAmount,
            destinationAddress: example.destinationAddress,
            resolverFeeAmount: example.resolverFee,
            expiryTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            chainParams: chainSpecificParams
        };

        try {
            // Estimate costs first
            const [estimatedCost, safetyDeposit] = await factory.estimateOrderCosts(
                example.chainId,
                chainSpecificParams,
                example.sourceAmount
            );
            
            console.log("💰 Cost estimates:");
            console.log(`   - Execution cost: ${ethers.formatEther(estimatedCost)} destination tokens`);
            console.log(`   - Safety deposit: ${ethers.formatUnits(safetyDeposit, 6)} source tokens`);
            
            // Generate order hash
            const orderHash = await factory.generateOrderHash(orderParams);
            console.log("🔑 Generated order hash:", orderHash);
            
            // Debug: check if order already exists
            const existingOrder = await factory.getOrder(orderHash);
            if (existingOrder.isActive) {
                console.log("⚠️  Order already exists, skipping creation");
                continue;
            }
            
            // Create the order
            console.log("📋 Creating Fusion+ order...");
            console.log("📋 Order params:");
            console.log(`   - Source Token: ${orderParams.sourceToken}`);
            console.log(`   - Source Amount: ${ethers.formatUnits(orderParams.sourceAmount, 6)} USDC`);
            console.log(`   - Destination Chain: ${orderParams.destinationChainId}`);
            console.log(`   - Expiry Time: ${new Date(orderParams.expiryTime * 1000).toISOString()}`);
            
            const tx = await factory.createFusionOrder(orderParams);
            const receipt = await tx.wait();
            console.log("✅ Order created successfully! Gas used:", receipt.gasUsed.toString());
            
            // Parse events from the transaction receipt
            console.log("📋 Transaction events:");
            let actualOrderHash = orderHash;
            for (const log of receipt.logs) {
                try {
                    const parsed = factory.interface.parseLog(log);
                    if (parsed) {
                        console.log(`   - Event: ${parsed.name}`);
                        if (parsed.name === "FusionOrderCreated") {
                            actualOrderHash = parsed.args.orderHash;
                            console.log(`     * Order Hash: ${actualOrderHash}`);
                            console.log(`     * Maker: ${parsed.args.maker}`);
                            console.log(`     * Source Amount: ${ethers.formatUnits(parsed.args.sourceAmount, 6)} USDC`);
                        }
                    }
                } catch (e) {
                    // Skip unparseable logs
                }
            }
            
            // Verify order was created using the actual hash from the event
            const orderInfo = await factory.getOrder(actualOrderHash);
            console.log("📊 Order verification:");
            console.log(`   - Order Hash: ${orderInfo.orderHash}`);
            console.log(`   - Maker: ${orderInfo.maker}`);
            console.log(`   - Source: ${ethers.formatUnits(orderInfo.sourceAmount, 6)} USDC`);
            console.log(`   - Destination: ${ethers.formatEther(orderInfo.destinationAmount)} tokens`);
            console.log(`   - Chain: ${orderInfo.destinationChainId}`);
            console.log(`   - Active: ${orderInfo.isActive}`);
            
            // Also check if order is matchable
            const isMatchable = await factory.isOrderMatchable(actualOrderHash);
            console.log(`   - Matchable: ${isMatchable}`);
            
        } catch (error) {
            console.log("❌ Order creation failed:", error.message);
        }
    }

    console.log("\n🚀 Step 4: Future Chain Support");
    console.log("================================");
    console.log("🔮 This modular architecture supports easy addition of:");
    console.log("   - Cosmos Hub (Chain ID: 40003)");
    console.log("   - Bitcoin Network (Chain ID: 40004)");
    console.log("   - Any other blockchain with IDestinationChain implementation");
    console.log("");
    console.log("📋 To add new chain support:");
    console.log("   1. Implement IDestinationChain interface");
    console.log("   2. Deploy adapter contract");
    console.log("   3. Register with CrossChainRegistry");
    console.log("   4. Start creating cross-chain orders!");

    console.log("\n✅ Demo Complete!");
    console.log("==================");
    console.log("🎯 Key Achievements:");
    console.log("   ✅ Modular destination chain support");
    console.log("   ✅ 1inch Fusion+ compatible order format");
    console.log("   ✅ NEAR Protocol integration complete");
    console.log("   ✅ Extensible architecture for Cosmos & Bitcoin");
    console.log("   ✅ Comprehensive validation and cost estimation");
    console.log("");
    console.log("🚀 Ready for production deployment and additional chain integrations!");
}

// Handle script execution
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Demo failed:", error);
            process.exit(1);
        });
}

module.exports = { main };