#!/usr/bin/env node

/**
 * Complete NEAR Side Atomic Swap Execution
 * 
 * This script completes the atomic swap by executing the NEAR side of the transaction.
 * It demonstrates real token transfers on NEAR to complete the end-to-end atomic swap.
 */

const fs = require('fs');
const path = require('path');

// Order details from NEAR-compatible order
const EXISTING_ORDER = {
    orderHash: "0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4",
    hashlock: "dc10e49df5552b2daadb1864d6f38c59764669b67ac9bcc81a03f292ffed1515",
    secret: "a9aab023149fea18759fd15443bd11bfca388dfe7f0813e372a75ce8a37dd7bc",
    ethTxHash: "0xf45e3f29a382dbb79df313a9382923898105915f48b610ab605cb13861c9b029",
    hashAlgorithm: "SHA-256"
};

const NEAR_CONFIG = {
    contractId: "fusion-plus.demo.cuteharbor3573.testnet",
    resolverId: "demo.cuteharbor3573.testnet",
    userId: "demo.cuteharbor3573.testnet", // For demo, user is same as resolver
    amount: "4000000000000000000000",      // 0.004 NEAR in yoctoNEAR
    resolverFee: "20000000000000000000000",  // 0.02 NEAR fee
    safetyDeposit: "200000000000000000000", // 0.0002 NEAR (5% of amount)
    totalDeposit: "0.0242"                  // Total NEAR needed (amount + fee + safety deposit)
};

async function executeNearSide() {
    console.log(" Starting NEAR Side Atomic Swap Execution");
    console.log("=".repeat(60));
    
    console.log("\n Order Details:");
    console.log(`Order Hash: ${EXISTING_ORDER.orderHash}`);
    console.log(`Hashlock: ${EXISTING_ORDER.hashlock}`);
    console.log(`Secret: ${EXISTING_ORDER.secret}`);
    console.log(`Hash Algorithm: ${EXISTING_ORDER.hashAlgorithm}`);
    console.log(`Ethereum Order Creation: https://sepolia.etherscan.io/tx/${EXISTING_ORDER.ethTxHash}`);
    
    console.log("\n NEAR Execution Parameters:");
    console.log(`Contract: ${NEAR_CONFIG.contractId}`);
    console.log(`Resolver: ${NEAR_CONFIG.resolverId}`);
    console.log(`User: ${NEAR_CONFIG.userId}`);
    console.log(`Amount: ${NEAR_CONFIG.amount} yoctoNEAR (0.004 NEAR)`);
    console.log(`Resolver Fee: ${NEAR_CONFIG.resolverFee} yoctoNEAR (0.02 NEAR)`);
    console.log(`Safety Deposit: ${NEAR_CONFIG.safetyDeposit} yoctoNEAR (0.0002 NEAR)`);
    console.log(`Total Deposit: ${NEAR_CONFIG.totalDeposit} NEAR`);
    
    console.log("\n" + "=".repeat(60));
    console.log(" STEP 1: Execute Fusion Order on NEAR");
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
    
    console.log("\n Executing NEAR command:");
    const executeCommand = `near call ${NEAR_CONFIG.contractId} execute_fusion_order '${JSON.stringify(executeFusionOrderArgs)}' --accountId ${NEAR_CONFIG.resolverId} --amount ${NEAR_CONFIG.totalDeposit}`;
    console.log(executeCommand);
    
    try {
        const { execSync } = require('child_process');
        const executeResult = execSync(executeCommand, { 
            encoding: 'utf8',
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        console.log("\n Execute Fusion Order Result:");
        console.log(executeResult);
        
        // Extract transaction hash if possible
        const txHashMatch = executeResult.match(/Transaction Id ([A-Za-z0-9]+)/);
        const executeTxHash = txHashMatch ? txHashMatch[1] : 'Unknown';
        
        console.log("\n" + "=".repeat(60));
        console.log(" STEP 2: Reveal Secret and Claim");
        console.log("=".repeat(60));
        
        // Wait a moment for the transaction to be processed
        console.log(" Waiting 3 seconds for transaction processing...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Prepare claim_fusion_order command
        const claimArgs = {
            order_hash: EXISTING_ORDER.orderHash,
            preimage: EXISTING_ORDER.secret
        };
        
        console.log("\n Revealing secret:");
        const claimCommand = `near call ${NEAR_CONFIG.contractId} claim_fusion_order '${JSON.stringify(claimArgs)}' --accountId ${NEAR_CONFIG.resolverId}`;
        console.log(claimCommand);
        
        const claimResult = execSync(claimCommand, { 
            encoding: 'utf8',
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        console.log("\n Claim Fusion Order Result:");
        console.log(claimResult);
        
        const claimTxHashMatch = claimResult.match(/Transaction Id ([A-Za-z0-9]+)/);
        const claimTxHash = claimTxHashMatch ? claimTxHashMatch[1] : 'Unknown';
        
        console.log("\n" + "=".repeat(60));
        console.log(" STEP 3: Transfer NEAR Tokens to User");
        console.log("=".repeat(60));
        
        // Wait a moment for the claim to be processed
        console.log(" Waiting 3 seconds for claim processing...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Prepare transfer_to_maker command
        const transferArgs = {
            order_hash: EXISTING_ORDER.orderHash
        };
        
        console.log("\n Transferring NEAR tokens to user:");
        const transferCommand = `near call ${NEAR_CONFIG.contractId} transfer_to_maker '${JSON.stringify(transferArgs)}' --accountId ${NEAR_CONFIG.resolverId}`;
        console.log(transferCommand);
        
        const transferResult = execSync(transferCommand, { 
            encoding: 'utf8',
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        console.log("\n Transfer to Maker Result:");
        console.log(transferResult);
        
        const transferTxHashMatch = transferResult.match(/Transaction Id ([A-Za-z0-9]+)/);
        const transferTxHash = transferTxHashMatch ? transferTxHashMatch[1] : 'Unknown';
        
        console.log("\n" + "=".repeat(60));
        console.log(" ATOMIC SWAP COMPLETED SUCCESSFULLY!");
        console.log("=".repeat(60));
        
        console.log("\n Final Transaction Summary:");
        console.log("Ethereum Side (COMPLETED):");
        console.log(`   Order Creation: https://sepolia.etherscan.io/tx/${EXISTING_ORDER.ethTxHash}`);
        console.log(`   Hash Algorithm: ${EXISTING_ORDER.hashAlgorithm}`);
        
        console.log("\nNEAR Side (COMPLETED):");
        console.log(`   Execute Order: ${executeTxHash}`);
        console.log(`   Reveal Secret: ${claimTxHash}`);
        console.log(`   Transfer NEAR: ${transferTxHash}`);
        
        console.log("\n User Token Flow:");
        console.log(`   Sent: 0.2 DT tokens (Ethereum order created)`);
        console.log(`   Received: 0.004 NEAR tokens (NEAR Protocol)`);
        console.log(`   Net: Successfully swapped DT  NEAR across chains`);
        
        console.log("\n Resolver Economics:");
        console.log(`   Provided: 0.004 NEAR tokens (upfront liquidity)`);
        console.log(`   Will earn: 0.2 DT + 0.02 DT fee (when claiming on Ethereum)`);
        console.log(`   Net: Cross-chain market making with SHA-256 coordination`);
        
        // Save complete results
        const completeResults = {
            timestamp: new Date().toISOString(),
            status: "COMPLETED",
            orderHash: EXISTING_ORDER.orderHash,
            hashlock: EXISTING_ORDER.hashlock,
            secret: EXISTING_ORDER.secret,
            ethereum: {
                orderCreationTx: EXISTING_ORDER.ethTxHash,
                hashAlgorithm: EXISTING_ORDER.hashAlgorithm,
                orderAmount: "0.2 DT",
                etherscanUrl: `https://sepolia.etherscan.io/tx/${EXISTING_ORDER.ethTxHash}`
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
                userSent: "0.2 DT (Ethereum)",
                userReceived: "0.004 NEAR (NEAR Protocol)",
                resolverProvided: "0.004 NEAR (NEAR Protocol)",
                resolverEarned: "0.2 DT + 0.02 DT fee (Ethereum)",
                swapType: "Cross-chain DT  NEAR (SHA-256 coordinated)"
            }
        };
        
        const resultsPath = path.join(__dirname, 'complete-atomic-swap-results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(completeResults, null, 2));
        
        console.log(`\n Complete results saved to: ${resultsPath}`);
        console.log("\n END-TO-END ATOMIC SWAP DEMONSTRATION COMPLETE!");
        console.log(" Both Ethereum and NEAR sides executed with real token transfers");
        
        return completeResults;
        
    } catch (error) {
        console.error("\n Error executing NEAR commands:");
        console.error(error.message);
        
        console.log("\n Manual Execution Commands:");
        console.log("\n1. Execute Fusion Order:");
        console.log(executeCommand);
        
        console.log("\n2. Reveal Secret:");
        console.log(`near call ${NEAR_CONFIG.contractId} claim_fusion_order '{"order_hash": "${EXISTING_ORDER.orderHash}", "preimage": "${EXISTING_ORDER.secret}"}' --accountId ${NEAR_CONFIG.resolverId}`);
        
        console.log("\n3. Transfer NEAR:");
        console.log(`near call ${NEAR_CONFIG.contractId} transfer_to_maker '{"order_hash": "${EXISTING_ORDER.orderHash}"}' --accountId ${NEAR_CONFIG.resolverId}`);
        
        throw error;
    }
}

// Execute if run directly
if (require.main === module) {
    executeNearSide()
        .then(() => {
            console.log("\n Script completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n Script failed:", error.message);
            process.exit(1);
        });
}

module.exports = { executeNearSide, EXISTING_ORDER, NEAR_CONFIG };