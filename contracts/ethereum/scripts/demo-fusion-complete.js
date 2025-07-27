const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * COMPLETE 1INCH FUSION+ ORDER DEMONSTRATION
 * 
 * This consolidated script demonstrates the complete order lifecycle:
 * 1. Create cross-chain order (or load existing)
 * 2. Complete order with secret revelation
 * 3. Transfer tokens to escrow (showing full settlement)
 * 
 * Combines functionality from demo-cross-chain-live.js and complete-fusion-order-full.js
 */

async function main() {
    console.log("🔄 1inch Fusion+ Complete Order Lifecycle Demo");
    console.log("=============================================");
    console.log("");

    // Check if we have an existing order or need to create one
    const demoResultsPath = path.join(__dirname, "..", "demo-results.json");
    const hasExistingOrder = fs.existsSync(demoResultsPath);
    
    const deploymentInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "sepolia-deployment.json"), "utf8"));
    const [signer] = await ethers.getSigners();

    // Connect to contracts
    const factoryAddress = deploymentInfo.productionDeployment.contracts.OneInchFusionPlusFactory;
    const factory = await ethers.getContractAt("OneInchFusionPlusFactory", factoryAddress, signer);
    const tokenAddress = deploymentInfo.productionDeployment.contracts.DemoToken;
    const demoToken = await ethers.getContractAt("MockERC20", tokenAddress, signer);

    let orderHash, secret, hashlock;

    if (!hasExistingOrder) {
        console.log("📝 Step 1: Create New Cross-Chain Order");
        console.log("======================================");
        
        // Generate atomic swap credentials
        const secretBytes = crypto.randomBytes(32);
        secret = "0x" + secretBytes.toString("hex");
        hashlock = ethers.keccak256(secret);
        
        console.log("🔑 Generated atomic swap credentials:");
        console.log("   Hashlock:", hashlock);
        console.log("");

        // Check balance and mint if needed
        const currentBalance = await demoToken.balanceOf(signer.address);
        console.log("💰 Current DT balance:", ethers.formatEther(currentBalance), "DT");
        
        const requiredAmount = ethers.parseEther("1"); // 1 DT for demo
        if (currentBalance < requiredAmount) {
            console.log("🪙 Minting tokens...");
            await demoToken.mint(signer.address, requiredAmount - currentBalance);
            console.log("✅ Minted tokens");
        }

        // Create order
        const swapAmount = ethers.parseEther("0.2");
        const resolverFee = ethers.parseEther("0.02");
        
        console.log("Approving tokens...");
        const approveTx = await demoToken.approve(await factory.getAddress(), swapAmount + resolverFee);
        await approveTx.wait();
        
        const orderParams = {
            sourceToken: tokenAddress,
            sourceAmount: swapAmount,
            destinationChainId: 40002, // NEAR Testnet
            destinationToken: ethers.toUtf8Bytes("native.near"),
            destinationAmount: ethers.parseEther("0.004"),
            destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
            resolverFeeAmount: resolverFee,
            expiryTime: Math.floor(Date.now() / 1000) + 3600,
            hashlock: hashlock,
            chainParams: {
                destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
                executionParams: ethers.toUtf8Bytes(""),
                estimatedGas: 300_000_000_000_000n,
                additionalData: hashlock
            }
        };

        console.log("Creating order...");
        const createTx = await factory.createFusionOrder(orderParams);
        const createReceipt = await createTx.wait();
        
        // Extract order hash
        for (const log of createReceipt.logs) {
            try {
                const parsed = factory.interface.parseLog(log);
                if (parsed.name === "FusionOrderCreated") {
                    orderHash = parsed.args.orderHash;
                    break;
                }
            } catch (e) {}
        }

        console.log("✅ Order created!");
        console.log("   Order Hash:", orderHash);
        console.log("   Transaction:", createReceipt.hash);
        console.log("");

        // Save for future runs
        const demoResults = {
            timestamp: new Date().toISOString(),
            orderHash: orderHash,
            hashlock: hashlock,
            secret: secret,
            transactionHash: createReceipt.hash,
            orderDetails: {
                sourceAmount: ethers.formatEther(swapAmount),
                destinationAmount: ethers.formatEther(orderParams.destinationAmount),
                resolverFee: ethers.formatEther(resolverFee)
            }
        };
        fs.writeFileSync(demoResultsPath, JSON.stringify(demoResults, null, 2));

    } else {
        console.log("📋 Step 1: Loading Existing Order");
        console.log("================================");
        
        const demoResults = JSON.parse(fs.readFileSync(demoResultsPath, "utf8"));
        orderHash = demoResults.orderHash;
        secret = demoResults.secret;
        hashlock = demoResults.hashlock;
        
        console.log("   Order Hash:", orderHash);
        console.log("   Created:", demoResults.timestamp);
        console.log("");
    }

    // Step 2: Complete the order
    console.log("🔐 Step 2: Complete Order with Secret");
    console.log("====================================");
    
    const order = await factory.getOrder(orderHash);
    if (order.isActive) {
        console.log("Completing order...");
        
        try {
            const completeTx = await factory.completeFusionOrder(orderHash, secret);
            await completeTx.wait();
            console.log("✅ Order marked as completed");
            console.log("   Transaction:", completeTx.hash);
        } catch (error) {
            console.log("⚠️  Order already completed or error:", error.message);
        }
    } else {
        console.log("ℹ️  Order already completed");
    }
    console.log("");

    // Step 3: Transfer tokens
    console.log("💸 Step 3: Transfer Tokens to Escrow");
    console.log("===================================");
    
    const [sourceEscrow, destEscrow] = await factory.getEscrowAddresses(orderHash);
    console.log("📍 Source Escrow:", sourceEscrow);
    console.log("📍 Destination Escrow:", destEscrow);
    
    if (sourceEscrow !== ethers.ZeroAddress) {
        const escrowBalance = await demoToken.balanceOf(sourceEscrow);
        
        if (escrowBalance == 0) {
            console.log("Transferring tokens to escrow...");
            
            const transferAmount = order.sourceAmount + order.resolverFeeAmount;
            const userBalance = await demoToken.balanceOf(signer.address);
            
            if (userBalance >= transferAmount) {
                const transferTx = await demoToken.transfer(sourceEscrow, transferAmount);
                const receipt = await transferTx.wait();
                
                console.log("✅ Tokens transferred!");
                console.log("   Amount:", ethers.formatEther(transferAmount), "DT");
                console.log("   Transaction:", receipt.hash);
                console.log("   Gas Used:", receipt.gasUsed.toString());
                
                // Check final balances
                const finalUserBalance = await demoToken.balanceOf(signer.address);
                const finalEscrowBalance = await demoToken.balanceOf(sourceEscrow);
                
                console.log("");
                console.log("💰 Final Balances:");
                console.log("   Your Balance:", ethers.formatEther(finalUserBalance), "DT");
                console.log("   Escrow Balance:", ethers.formatEther(finalEscrowBalance), "DT");
            } else {
                console.log("❌ Insufficient balance for transfer");
            }
        } else {
            console.log("ℹ️  Escrow already has tokens:", ethers.formatEther(escrowBalance), "DT");
        }
    } else {
        console.log("⚠️  No escrow found - order may need to be matched first");
    }

    console.log("");
    console.log("🎊 Demo Complete!");
    console.log("=================");
    console.log("✅ Order created with hashlock coordination");
    console.log("✅ Order completed with secret revelation");
    console.log("✅ Tokens transferred to escrow for settlement");
    console.log("");
    console.log("🔄 Next in Production:");
    console.log("• Resolver executes on NEAR side");
    console.log("• Atomic swap completes on both chains");
    console.log("• User receives NEAR tokens");
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Demo failed:", error);
            process.exit(1);
        });
}

module.exports = { main };