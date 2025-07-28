#!/usr/bin/env node

/**
 * Complete NEAR Side Atomic Swap Execution
 * 
 * This script completes the atomic swap by executing the NEAR side of the transaction.
 * It demonstrates real token transfers on NEAR to complete the end-to-end atomic swap.
 */

const fs = require('fs');
const path = require('path');

// Order details from previous execution
const EXISTING_ORDER = {
    orderHash: "0x5ed6c10e16b90322506840fb3bc13deb37e0564f956ea20e66a3d751a9d80a04",
    hashlock: "53027d93350a6b4dd1a37575fc7f1559059ef02d4d31d47b9465036f47678f1c",
    secret: "3492fd723381662c281107dad435230496e9aef907a765982db816f3fd3d7cdc",
    ethEscrowSrc: "0x6576F4BED96bbeC27b5D87d3A07B2Cb5648E69e4",
    ethEscrowDst: "0xA5D21E8304192DFB305067B35D0a1B53670fEA4c",
    tokenTransferTx: "0xadd5c28ebfd894aa4da95b061398e7b7144f0a3141c6819db470db29bcd70806"
};

const NEAR_CONFIG = {
    contractId: "fusion-plus.demo.cuteharbor3573.testnet",
    resolverId: "demo.cuteharbor3573.testnet",
    userId: "demo.cuteharbor3573.testnet", // For demo, user is same as resolver
    amount: "4000000000000000000000",      // 0.004 NEAR in yoctoNEAR
    resolverFee: "20000000000000000000000",  // 0.02 NEAR fee
    totalDeposit: "0.024"                  // Total NEAR needed (amount + fee + safety deposit)
};

async function executeNearSide() {
    console.log("🚀 Starting NEAR Side Atomic Swap Execution");
    console.log("=".repeat(60));
    
    console.log("\n📋 Order Details:");
    console.log(`Order Hash: ${EXISTING_ORDER.orderHash}`);
    console.log(`Hashlock: ${EXISTING_ORDER.hashlock}`);
    console.log(`Secret: ${EXISTING_ORDER.secret}`);
    console.log(`Ethereum Token Transfer: https://sepolia.etherscan.io/tx/${EXISTING_ORDER.tokenTransferTx}`);
    
    console.log("\n📊 NEAR Execution Parameters:");
    console.log(`Contract: ${NEAR_CONFIG.contractId}`);
    console.log(`Resolver: ${NEAR_CONFIG.resolverId}`);
    console.log(`User: ${NEAR_CONFIG.userId}`);
    console.log(`Amount: ${NEAR_CONFIG.amount} yoctoNEAR (0.004 NEAR)`);
    console.log(`Resolver Fee: ${NEAR_CONFIG.resolverFee} yoctoNEAR (0.02 NEAR)`);
    console.log(`Total Deposit: ${NEAR_CONFIG.totalDeposit} NEAR`);
    
    console.log("\n" + "=".repeat(60));
    console.log("🔄 STEP 1: Execute Fusion Order on NEAR");
    console.log("=".repeat(60));
    
    // Prepare execute_fusion_order command
    const executeFusionOrderArgs = {
        order_hash: EXISTING_ORDER.orderHash,
        hashlock: EXISTING_ORDER.hashlock,
        maker: NEAR_CONFIG.userId,
        resolver: NEAR_CONFIG.resolverId,
        amount: NEAR_CONFIG.amount,
        resolver_fee: NEAR_CONFIG.resolverFee,
        timelocks: "0",
        source_chain_id: 11155111
    };
    
    console.log("\n📝 Executing NEAR command:");
    const executeCommand = `near call ${NEAR_CONFIG.contractId} execute_fusion_order '${JSON.stringify(executeFusionOrderArgs)}' --accountId ${NEAR_CONFIG.resolverId} --amount ${NEAR_CONFIG.totalDeposit}`;
    console.log(executeCommand);
    
    try {
        const { execSync } = require('child_process');
        const executeResult = execSync(executeCommand, { 
            encoding: 'utf8',
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        console.log("\n✅ Execute Fusion Order Result:");
        console.log(executeResult);
        
        // Extract transaction hash if possible
        const txHashMatch = executeResult.match(/Transaction Id ([A-Za-z0-9]+)/);
        const executeTxHash = txHashMatch ? txHashMatch[1] : 'Unknown';
        
        console.log("\n" + "=".repeat(60));
        console.log("🔑 STEP 2: Reveal Secret and Claim");
        console.log("=".repeat(60));
        
        // Wait a moment for the transaction to be processed
        console.log("⏳ Waiting 3 seconds for transaction processing...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Prepare claim_fusion_order command
        const claimArgs = {
            order_hash: EXISTING_ORDER.orderHash,
            secret: EXISTING_ORDER.secret
        };
        
        console.log("\n📝 Revealing secret:");
        const claimCommand = `near call ${NEAR_CONFIG.contractId} claim_fusion_order '${JSON.stringify(claimArgs)}' --accountId ${NEAR_CONFIG.resolverId}`;
        console.log(claimCommand);
        
        const claimResult = execSync(claimCommand, { 
            encoding: 'utf8',
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        console.log("\n✅ Claim Fusion Order Result:");
        console.log(claimResult);
        
        const claimTxHashMatch = claimResult.match(/Transaction Id ([A-Za-z0-9]+)/);
        const claimTxHash = claimTxHashMatch ? claimTxHashMatch[1] : 'Unknown';
        
        console.log("\n" + "=".repeat(60));
        console.log("💸 STEP 3: Transfer NEAR Tokens to User");
        console.log("=".repeat(60));
        
        // Wait a moment for the claim to be processed
        console.log("⏳ Waiting 3 seconds for claim processing...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Prepare transfer_to_maker command
        const transferArgs = {
            order_hash: EXISTING_ORDER.orderHash
        };
        
        console.log("\n📝 Transferring NEAR tokens to user:");
        const transferCommand = `near call ${NEAR_CONFIG.contractId} transfer_to_maker '${JSON.stringify(transferArgs)}' --accountId ${NEAR_CONFIG.resolverId}`;
        console.log(transferCommand);
        
        const transferResult = execSync(transferCommand, { 
            encoding: 'utf8',
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        console.log("\n✅ Transfer to Maker Result:");
        console.log(transferResult);
        
        const transferTxHashMatch = transferResult.match(/Transaction Id ([A-Za-z0-9]+)/);
        const transferTxHash = transferTxHashMatch ? transferTxHashMatch[1] : 'Unknown';
        
        console.log("\n" + "=".repeat(60));
        console.log("🎉 ATOMIC SWAP COMPLETED SUCCESSFULLY!");
        console.log("=".repeat(60));
        
        console.log("\n📊 Final Transaction Summary:");
        console.log("Ethereum Side (COMPLETED):");
        console.log(`  ✅ Token Transfer: https://sepolia.etherscan.io/tx/${EXISTING_ORDER.tokenTransferTx}`);
        console.log(`  ✅ Source Escrow: ${EXISTING_ORDER.ethEscrowSrc}`);
        console.log(`  ✅ Destination Escrow: ${EXISTING_ORDER.ethEscrowDst}`);
        
        console.log("\nNEAR Side (COMPLETED):");
        console.log(`  ✅ Execute Order: ${executeTxHash}`);
        console.log(`  ✅ Reveal Secret: ${claimTxHash}`);
        console.log(`  ✅ Transfer NEAR: ${transferTxHash}`);
        
        console.log("\n🔄 User Token Flow:");
        console.log(`  📤 Sent: 0.22 DT tokens (Ethereum)`);
        console.log(`  📥 Received: 0.004 NEAR tokens (NEAR Protocol)`);
        console.log(`  💰 Net: Successfully swapped DT ↔ NEAR across chains`);
        
        console.log("\n🔄 Resolver Economics:");
        console.log(`  📤 Provided: 0.004 NEAR tokens (upfront liquidity)`);
        console.log(`  📥 Earned: 0.22 DT + 0.02 DT fee (after secret revelation)`);
        console.log(`  💰 Net: Cross-chain market making fee earned`);
        
        // Save complete results
        const completeResults = {
            timestamp: new Date().toISOString(),
            status: "COMPLETED",
            orderHash: EXISTING_ORDER.orderHash,
            hashlock: EXISTING_ORDER.hashlock,
            secret: EXISTING_ORDER.secret,
            ethereum: {
                tokenTransferTx: EXISTING_ORDER.tokenTransferTx,
                sourceEscrow: EXISTING_ORDER.ethEscrowSrc,
                destinationEscrow: EXISTING_ORDER.ethEscrowDst,
                tokenAmount: "0.22 DT",
                etherscanUrl: `https://sepolia.etherscan.io/tx/${EXISTING_ORDER.tokenTransferTx}`
            },
            near: {
                contractId: NEAR_CONFIG.contractId,
                executeTxHash: executeTxHash,
                claimTxHash: claimTxHash,
                transferTxHash: transferTxHash,
                nearAmount: "0.004 NEAR",
                resolverFee: "0.02 NEAR"
            },
            atomicSwap: {
                userSent: "0.22 DT (Ethereum)",
                userReceived: "0.004 NEAR (NEAR Protocol)",
                resolverProvided: "0.004 NEAR (NEAR Protocol)",
                resolverEarned: "0.22 DT + 0.02 DT fee (Ethereum)",
                swapType: "Cross-chain DT ↔ NEAR"
            }
        };
        
        const resultsPath = path.join(__dirname, 'complete-atomic-swap-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(completeResults, null, 2));
        
        console.log(`\n💾 Complete results saved to: ${resultsPath}`);
        console.log("\n🏆 END-TO-END ATOMIC SWAP DEMONSTRATION COMPLETE!");
        console.log("✨ Both Ethereum and NEAR sides executed with real token transfers");
        
        return completeResults;
        
    } catch (error) {
        console.error("\n❌ Error executing NEAR commands:");
        console.error(error.message);
        
        console.log("\n🔧 Manual Execution Commands:");
        console.log("\n1. Execute Fusion Order:");
        console.log(executeCommand);
        
        console.log("\n2. Reveal Secret:");
        console.log(`near call ${NEAR_CONFIG.contractId} claim_fusion_order '{"order_hash": "${EXISTING_ORDER.orderHash}", "secret": "${EXISTING_ORDER.secret}"}' --accountId ${NEAR_CONFIG.resolverId}`);
        
        console.log("\n3. Transfer NEAR:");
        console.log(`near call ${NEAR_CONFIG.contractId} transfer_to_maker '{"order_hash": "${EXISTING_ORDER.orderHash}"}' --accountId ${NEAR_CONFIG.resolverId}`);
        
        throw error;
    }
}

// Execute if run directly
if (require.main === module) {
    executeNearSide()
        .then(() => {
            console.log("\n🎯 Script completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n💥 Script failed:", error.message);
            process.exit(1);
        });
}

module.exports = { executeNearSide, EXISTING_ORDER, NEAR_CONFIG };