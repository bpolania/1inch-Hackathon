#!/usr/bin/env node

/**
 * Analyze Working Transaction to Find Correct Format
 * 
 * Examines the successful NEAR transaction to understand the correct parameters
 */

const { ethers } = require('ethers');

async function analyzeWorkingTransaction() {
    console.log('🔍 Analyze Working NEAR Transaction');
    console.log('==================================\n');
    
    try {
        const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu');
        
        // Transaction hash from near-compatible-order.json
        const workingTxHash = '0x8c19ce71fe6bf8da763d2f5242e9c22e78beaabdc393aa077bddd0a1f4117f37';
        
        console.log(`📋 Analyzing transaction: ${workingTxHash}`);
        
        const tx = await provider.getTransaction(workingTxHash);
        const receipt = await provider.getTransactionReceipt(workingTxHash);
        
        console.log(`✅ Transaction found`);
        console.log(`   Block: ${tx.blockNumber}`);
        console.log(`   To: ${tx.to}`);
        console.log(`   Value: ${ethers.formatEther(tx.value)} ETH`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}\n`);
        
        // Analyze the transaction data
        console.log('📝 Transaction Data Analysis:');
        console.log(`   Data length: ${tx.data.length} chars`);
        console.log(`   Function selector: ${tx.data.slice(0, 10)}\n`);
        
        // Try to decode with known factory ABI
        const FACTORY_ABI = [
            "function createFusionOrder((address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,(bytes,bytes,uint256,bytes),bytes32)) external returns (bytes32)"
        ];
        
        try {
            const iface = new ethers.Interface(FACTORY_ABI);
            const decoded = iface.parseTransaction({ data: tx.data });
            
            console.log('✅ Successfully decoded transaction:');
            console.log(`   Function: ${decoded.name}`);
            console.log(`   Parameters:`);
            
            const params = decoded.args[0]; // The struct parameter
            console.log(`     sourceToken: ${params[0]}`);
            console.log(`     sourceAmount: ${ethers.formatEther(params[1])} tokens`);
            console.log(`     destinationChainId: ${params[2]}`);
            console.log(`     destinationToken: ${ethers.toUtf8String(params[3])}`);
            console.log(`     destinationAmount: ${ethers.formatEther(params[4])}`);
            console.log(`     destinationAddress: ${ethers.toUtf8String(params[5])}`);
            console.log(`     resolverFeeAmount: ${ethers.formatEther(params[6])}`);
            console.log(`     expiryTime: ${new Date(Number(params[7]) * 1000).toISOString()}`);
            console.log(`     chainParams:`);
            console.log(`       destinationAddress: ${ethers.toUtf8String(params[8][0])}`);
            console.log(`       executionParams: ${params[8][1].length} bytes`);
            console.log(`       estimatedGas: ${params[8][2].toString()}`);
            console.log(`       additionalData: ${params[8][3]}`);
            console.log(`     hashlock: ${params[9]}\n`);
            
            // Check what factory this transaction used
            console.log(`🏭 Factory used: ${tx.to}`);
            
            if (tx.to.toLowerCase() === '0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a'.toLowerCase()) {
                console.log('   This is the OLD factory that worked');
            } else if (tx.to.toLowerCase() === '0xbeEab741D2869404FcB747057f5AbdEffc3A138d'.toLowerCase()) {
                console.log('   This is the NEW factory with Bitcoin support');
            } else {
                console.log('   This is a DIFFERENT factory!');
            }
            
            // Test if we can recreate this exact transaction
            console.log('\n🔄 Testing Recreation of Exact Parameters');
            
            const testFactory = new ethers.Contract(tx.to, FACTORY_ABI, provider);
            
            try {
                await testFactory.createFusionOrder.estimateGas(params, { 
                    value: tx.value,
                    from: tx.from 
                });
                console.log('✅ Exact recreation would work');
            } catch (recreateError) {
                console.log(`❌ Exact recreation failed: ${recreateError.message}`);
                console.log('💡 Factory state may have changed since the working transaction');
            }
            
        } catch (decodeError) {
            console.log(`❌ Could not decode transaction: ${decodeError.message}`);
            console.log('💡 ABI format might be incorrect');
            
            // Try alternative ABI formats
            console.log('\n🔍 Trying Alternative ABI Formats...');
            
            const altABIs = [
                // Named parameters
                ["function createFusionOrder(tuple(address sourceToken, uint256 sourceAmount, uint256 destinationChainId, bytes destinationToken, uint256 destinationAmount, bytes destinationAddress, uint256 resolverFeeAmount, uint256 expiryTime, tuple(bytes destinationAddress, bytes executionParams, uint256 estimatedGas, bytes additionalData) chainParams, bytes32 hashlock) params) external returns (bytes32)"],
                
                // Simple struct
                ["function createFusionOrder(tuple params) external returns (bytes32)"],
                
                // No struct wrapping
                ["function createFusionOrder(address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,tuple(bytes,bytes,uint256,bytes),bytes32) external returns (bytes32)"]
            ];
            
            for (let i = 0; i < altABIs.length; i++) {
                try {
                    const altIface = new ethers.Interface(altABIs[i]);
                    const altDecoded = altIface.parseTransaction({ data: tx.data });
                    console.log(`✅ Alternative ABI ${i + 1} worked!`);
                    console.log(`   Function: ${altDecoded.name}`);
                    break;
                } catch (altError) {
                    console.log(`❌ Alternative ABI ${i + 1} failed`);
                }
            }
        }
        
        return true;
        
    } catch (error) {
        console.error(`❌ Analysis failed: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    analyzeWorkingTransaction().then(success => {
        console.log(`\nResult: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { analyzeWorkingTransaction };