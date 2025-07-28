const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * COMPLETE FUSION ORDER WITH ACTUAL TOKEN TRANSFER
 * 
 * This script demonstrates the FULL settlement flow including actual token transfers.
 * Since our simplified completeFusionOrder doesn't transfer tokens, we'll show
 * the complete mechanics of how tokens should move in a production system.
 */

async function main() {
    console.log("💸 1inch Fusion+ COMPLETE Token Transfer Demo");
    console.log("============================================");
    console.log("Demonstrating ACTUAL token movement from wallet → escrow → settlement");
    console.log("");

    // Load previous demo results
    const demoResultsPath = path.join(__dirname, "..", "demo-results.json");
    const demoResults = JSON.parse(fs.readFileSync(demoResultsPath, "utf8"));
    const deploymentInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "sepolia-deployment.json"), "utf8"));

    console.log("📋 Previous Order Details:");
    console.log(`   Order Hash: ${demoResults.orderHash}`);
    console.log(`   Source Amount: ${demoResults.orderDetails.sourceAmount} DT`);
    console.log(`   Resolver Fee: ${demoResults.orderDetails.resolverFee} DT`);
    console.log(`   Total: ${parseFloat(demoResults.orderDetails.sourceAmount) + parseFloat(demoResults.orderDetails.resolverFee)} DT`);
    console.log("");

    // Connect to contracts
    const [signer] = await ethers.getSigners();
    const tokenAddress = deploymentInfo.productionDeployment.contracts.DemoToken;
    const demoToken = await ethers.getContractAt("MockERC20", tokenAddress, signer);
    
    // Check initial balance
    const initialBalance = await demoToken.balanceOf(signer.address);
    console.log("💰 Your Current Balance:", ethers.formatEther(initialBalance), "DT");
    console.log("");

    // Since completeFusionOrder doesn't actually transfer tokens, let's do it manually
    console.log("🔄 Step 1: Manual Token Transfer to Escrow");
    console.log("==========================================");
    console.log("Since our completeFusionOrder is simplified, we'll manually transfer tokens");
    console.log("to demonstrate the complete flow that would happen in production.");
    console.log("");

    // Get the source escrow address from the order
    const sourceEscrow = "0x6576F4BED96bbeC27b5D87d3A07B2Cb5648E69e4";
    console.log("📍 Source Escrow Address:", sourceEscrow);

    // Calculate transfer amount
    const swapAmount = ethers.parseEther("0.2");
    const resolverFee = ethers.parseEther("0.02");
    const totalAmount = swapAmount + resolverFee;

    console.log("💸 Transferring tokens to escrow...");
    console.log(`   Amount: ${ethers.formatEther(totalAmount)} DT`);

    try {
        // First check if we have enough balance
        if (initialBalance < totalAmount) {
            console.log("❌ Insufficient balance for transfer");
            return;
        }

        // Check current allowance
        const currentAllowance = await demoToken.allowance(signer.address, sourceEscrow);
        console.log(`   Current Allowance: ${ethers.formatEther(currentAllowance)} DT`);

        // Transfer tokens directly to escrow
        console.log("   Executing transfer...");
        const transferTx = await demoToken.transfer(sourceEscrow, totalAmount);
        const transferReceipt = await transferTx.wait();
        
        console.log("✅ Transfer Complete!");
        console.log(`   Transaction: ${transferReceipt.hash}`);
        console.log(`   Gas Used: ${transferReceipt.gasUsed.toString()}`);
        console.log(`   View on Etherscan: https://sepolia.etherscan.io/tx/${transferReceipt.hash}`);

        // Check balances after transfer
        const finalBalance = await demoToken.balanceOf(signer.address);
        const escrowBalance = await demoToken.balanceOf(sourceEscrow);

        console.log("");
        console.log("💰 Updated Balances:");
        console.log("===================");
        console.log(`   Your Balance: ${ethers.formatEther(initialBalance)} DT → ${ethers.formatEther(finalBalance)} DT`);
        console.log(`   Transferred: ${ethers.formatEther(initialBalance - finalBalance)} DT`);
        console.log(`   Escrow Balance: ${ethers.formatEther(escrowBalance)} DT`);

        console.log("");
        console.log("🎉 SUCCESS! Tokens have been transferred!");
        console.log("=========================================");
        console.log("✅ Your tokens have moved from your wallet to the escrow");
        console.log("✅ The escrow now holds the tokens for cross-chain settlement");
        console.log("✅ This demonstrates the complete token flow");

        console.log("");
        console.log("🔄 What Would Happen Next in Production:");
        console.log("========================================");
        console.log("1. Resolver executes corresponding operation on NEAR");
        console.log("2. NEAR contract locks 0.004 NEAR with same hashlock");
        console.log("3. Resolver reveals secret to claim tokens on both chains:");
        console.log(`   - Claims ${ethers.formatEther(swapAmount)} DT + ${ethers.formatEther(resolverFee)} DT fee on Ethereum`);
        console.log("   - User claims 0.004 NEAR on NEAR testnet");
        console.log("4. Atomic swap completes successfully");

        console.log("");
        console.log("🔐 Security Guarantees:");
        console.log("======================");
        console.log("• Hashlock ensures only valid secret can claim tokens");
        console.log("• Timelock allows refund if swap doesn't complete");
        console.log("• Both chains must succeed or both can refund");
        console.log("• No trust required between parties");

        // Save the transfer details
        const completeResults = {
            ...demoResults,
            settlement: {
                timestamp: new Date().toISOString(),
                transferTx: transferReceipt.hash,
                amountTransferred: ethers.formatEther(totalAmount),
                finalUserBalance: ethers.formatEther(finalBalance),
                escrowBalance: ethers.formatEther(escrowBalance),
                status: "tokens_in_escrow"
            }
        };

        fs.writeFileSync(
            path.join(__dirname, "..", "complete-demo-results.json"),
            JSON.stringify(completeResults, null, 2)
        );

        console.log("");
        console.log("💾 Complete results saved to: complete-demo-results.json");

    } catch (error) {
        console.error("❌ Transfer failed:", error.message);
        
        if (error.message.includes("insufficient allowance")) {
            console.log("");
            console.log("💡 Note: You may need to approve the tokens first");
            console.log("   The escrow needs permission to receive tokens");
        }
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Full settlement demo failed:", error);
            process.exit(1);
        });
}

module.exports = { main };