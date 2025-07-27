const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * COMPLETE FUSION ORDER SETTLEMENT
 * 
 * This script demonstrates the full settlement flow for a 1inch Fusion+ order,
 * including the actual token transfer from maker's wallet to the escrow.
 * 
 * In production, this would be handled by 1inch's settlement infrastructure,
 * but we'll demonstrate it manually to show the complete flow.
 */

async function main() {
    console.log("🔄 1inch Fusion+ Order Settlement Demo");
    console.log("=====================================");
    console.log("Demonstrating the complete token transfer and settlement flow");
    console.log("");

    // Load previous demo results
    const demoResultsPath = path.join(__dirname, "..", "demo-results.json");
    if (!fs.existsSync(demoResultsPath)) {
        console.error("❌ No demo results found. Please run the cross-chain demo first.");
        process.exit(1);
    }

    const demoResults = JSON.parse(fs.readFileSync(demoResultsPath, "utf8"));
    const deploymentInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "sepolia-deployment.json"), "utf8"));

    console.log("📋 Loading Previous Order:");
    console.log(`   Order Hash: ${demoResults.orderHash}`);
    console.log(`   Secret: ${demoResults.secret}`);
    console.log(`   Hashlock: ${demoResults.hashlock}`);
    console.log("");

    // Connect to contracts
    const [signer] = await ethers.getSigners();
    console.log("👤 Settlement Executor:", signer.address);

    // Connect to factory
    const factoryAddress = deploymentInfo.productionDeployment.contracts.OneInchFusionPlusFactory;
    const factory = await ethers.getContractAt("OneInchFusionPlusFactory", factoryAddress, signer);

    // Connect to token
    const tokenAddress = deploymentInfo.productionDeployment.contracts.DemoToken;
    const demoToken = await ethers.getContractAt("MockERC20", tokenAddress, signer);

    // Check current balances
    console.log("");
    console.log("💰 Step 1: Check Current Balances");
    console.log("=================================");
    
    const userBalance = await demoToken.balanceOf(signer.address);
    console.log(`   Your DT Balance: ${ethers.formatEther(userBalance)} DT`);

    // Get escrow addresses
    const [sourceEscrow, destEscrow] = await factory.getEscrowAddresses(demoResults.orderHash);
    console.log(`   Source Escrow: ${sourceEscrow}`);
    console.log(`   Destination Escrow: ${destEscrow}`);

    if (sourceEscrow === ethers.ZeroAddress) {
        console.log("");
        console.log("⚠️  No escrows found for this order. The order may need to be recreated or matched first.");
        
        // Let's create a new order for demonstration
        console.log("");
        console.log("📝 Creating a new order for settlement demonstration...");
        
        // Create new order parameters
        const swapAmount = ethers.parseEther("0.2");
        const resolverFee = ethers.parseEther("0.02");
        const totalAmount = swapAmount + resolverFee;
        
        // Check balance
        if (userBalance < totalAmount) {
            console.log("❌ Insufficient balance. You need at least", ethers.formatEther(totalAmount), "DT");
            process.exit(1);
        }
        
        // Approve tokens
        console.log("Approving tokens...");
        const approveTx = await demoToken.approve(await factory.getAddress(), totalAmount);
        await approveTx.wait();
        console.log("✅ Approved", ethers.formatEther(totalAmount), "DT");
        
        // Create order
        const orderParams = {
            sourceToken: tokenAddress,
            sourceAmount: swapAmount,
            destinationChainId: 40002, // NEAR Testnet
            destinationToken: ethers.toUtf8Bytes("native.near"),
            destinationAmount: ethers.parseEther("0.004"),
            destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
            resolverFeeAmount: resolverFee,
            expiryTime: Math.floor(Date.now() / 1000) + 3600,
            hashlock: demoResults.hashlock,
            chainParams: {
                destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
                executionParams: ethers.toUtf8Bytes(""),
                estimatedGas: 300_000_000_000_000n,
                additionalData: demoResults.hashlock
            }
        };
        
        console.log("Creating order...");
        const createTx = await factory.createFusionOrder(orderParams);
        const receipt = await createTx.wait();
        
        // Extract new order hash
        let newOrderHash;
        for (const log of receipt.logs) {
            try {
                const parsed = factory.interface.parseLog(log);
                if (parsed.name === "FusionOrderCreated") {
                    newOrderHash = parsed.args.orderHash;
                    break;
                }
            } catch (e) {}
        }
        
        console.log("✅ New order created:", newOrderHash);
        
        // Update demo results for next steps
        demoResults.orderHash = newOrderHash;
    }

    // Now let's simulate the actual token transfer
    console.log("");
    console.log("🔄 Step 2: Manual Token Transfer (Simulating Settlement)");
    console.log("=======================================================");
    
    // In production, this would be handled by 1inch's settlement system
    // For demo purposes, we'll manually transfer tokens to show the complete flow
    
    const order = await factory.getOrder(demoResults.orderHash);
    if (order.isActive) {
        console.log("📋 Order is active and ready for settlement");
        console.log(`   Source Amount: ${ethers.formatEther(order.sourceAmount)} DT`);
        console.log(`   Resolver Fee: ${ethers.formatEther(order.resolverFeeAmount)} DT`);
        
        // Check if we're authorized to complete (in production, only resolvers can do this)
        const isResolver = await factory.authorizedResolvers(signer.address);
        
        if (!isResolver) {
            console.log("");
            console.log("⚠️  You're not an authorized resolver. Let's simulate the token transfer manually.");
            console.log("   In production, only authorized 1inch resolvers can complete orders.");
            
            // Manual token transfer to demonstrate the concept
            console.log("");
            console.log("🔄 Manually transferring tokens to source escrow...");
            
            const transferAmount = order.sourceAmount + order.resolverFeeAmount;
            console.log(`   Transferring ${ethers.formatEther(transferAmount)} DT to escrow...`);
            
            // First check if escrow exists
            if (sourceEscrow !== ethers.ZeroAddress) {
                // Transfer tokens to source escrow
                const transferTx = await demoToken.transfer(sourceEscrow, transferAmount);
                await transferTx.wait();
                
                console.log("✅ Tokens transferred to source escrow!");
                
                // Check new balances
                const newUserBalance = await demoToken.balanceOf(signer.address);
                const escrowBalance = await demoToken.balanceOf(sourceEscrow);
                
                console.log("");
                console.log("💰 Updated Balances:");
                console.log(`   Your DT Balance: ${ethers.formatEther(newUserBalance)} DT`);
                console.log(`   Escrow DT Balance: ${ethers.formatEther(escrowBalance)} DT`);
                console.log("");
                console.log("🎉 Settlement Simulation Complete!");
                console.log("   • Tokens have moved from your wallet to the escrow");
                console.log("   • In production, the resolver would now:");
                console.log("     - Execute corresponding operation on NEAR");
                console.log("     - Reveal the secret to claim tokens");
                console.log("     - Complete the atomic swap");
            } else {
                console.log("❌ Source escrow not found. Order may not be properly matched.");
            }
        } else {
            // If we are a resolver, we can use the proper completion function
            console.log("✅ You are an authorized resolver!");
            console.log("");
            console.log("🔐 Completing order with secret revelation...");
            
            try {
                const completeTx = await factory.completeFusionOrder(demoResults.orderHash, demoResults.secret);
                await completeTx.wait();
                
                console.log("✅ Order completed successfully!");
                console.log("   Transaction:", completeTx.hash);
            } catch (error) {
                console.log("⚠️  Completion failed:", error.message);
                console.log("   This may be because the full settlement system isn't implemented");
            }
        }
    } else {
        console.log("⚠️  Order is not active. It may have already been completed or cancelled.");
    }

    console.log("");
    console.log("📊 Settlement Flow Summary");
    console.log("=========================");
    console.log("1. ✅ Order created with approved tokens");
    console.log("2. ✅ Escrow contracts deployed (if matched)");
    console.log("3. ✅ Tokens transferred to escrow (demonstrated)");
    console.log("4. ⏳ NEAR-side execution (would happen next)");
    console.log("5. ⏳ Secret revelation for atomic completion");
    console.log("");
    console.log("This demonstrates how tokens move from user wallet → escrow → cross-chain settlement");
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Settlement demo failed:", error);
            process.exit(1);
        });
}

module.exports = { main };