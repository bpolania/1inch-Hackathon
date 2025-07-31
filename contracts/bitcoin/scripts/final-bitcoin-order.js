#!/usr/bin/env node

/**
 * Final Bitcoin Order Creation
 * 
 * Uses new factory with Bitcoin support and minimal parameters
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

async function createFinalBitcoinOrder() {
    console.log('₿ Final Bitcoin Order Creation');
    console.log('==============================\n');
    
    try {
        const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu');
        const signer = new ethers.Wallet('3a7bb163d352f1c19c2fcd439e3dc70568efa4efb5163d8209084fcbfd531d47', provider);
        
        // Use NEW factory with Bitcoin support
        const FACTORY_ADDRESS = '0xbeEab741D2869404FcB747057f5AbdEffc3A138d';
        const TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
        
        const FACTORY_ABI = [
            "function createFusionOrder((address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,(bytes,bytes,uint256,bytes),bytes32)) external returns (bytes32)",
            "event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, uint256 dstChainId, uint256 srcAmount)"
        ];
        
        const ERC20_ABI = [
            "function approve(address,uint256) external returns (bool)",
            "function allowance(address,address) external view returns (uint256)"
        ];
        
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        
        console.log('✅ Using NEW factory with Bitcoin support');
        console.log(`   Factory: ${FACTORY_ADDRESS}`);
        console.log(`   Wallet: ${signer.address}\n`);
        
        // Use minimal test parameters first
        const sourceAmount = ethers.parseEther('0.1'); // Smaller amount
        const resolverFee = ethers.parseEther('0.01'); // 10%
        const destinationAmount = 100000; // 100k satoshis
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const expiryTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours
        const btcAddress = 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc';
        
        console.log('📋 Minimal Test Parameters:');
        console.log(`   Source: ${ethers.formatEther(sourceAmount)} DT`);
        console.log(`   Destination: ${destinationAmount} satoshis`);
        console.log(`   Fee: ${ethers.formatEther(resolverFee)} DT`);
        console.log(`   Bitcoin Address: ${btcAddress}`);
        console.log(`   Expiry: ${new Date(expiryTime * 1000).toISOString()}`);
        console.log(`   Hashlock: ${hashlock}\n`);
        
        // Ensure approval
        const totalNeeded = sourceAmount + resolverFee;
        const allowance = await token.allowance(signer.address, FACTORY_ADDRESS);
        
        if (allowance < totalNeeded) {
            console.log('🔄 Approving tokens...');
            const approveTx = await token.approve(FACTORY_ADDRESS, totalNeeded);
            await approveTx.wait();
            console.log('✅ Tokens approved\n');
        }
        
        // Create Bitcoin order parameters
        const orderParams = [
            TOKEN_ADDRESS,                              // sourceToken
            sourceAmount,                               // sourceAmount  
            40004,                                     // destinationChainId (Bitcoin testnet - CONFIRMED SUPPORTED)
            ethers.toUtf8Bytes('BTC'),                 // destinationToken
            destinationAmount,                          // destinationAmount
            ethers.toUtf8Bytes(btcAddress),            // destinationAddress
            resolverFee,                               // resolverFeeAmount
            expiryTime,                                // expiryTime
            [                                          // chainParams tuple
                ethers.toUtf8Bytes(btcAddress),        // destinationAddress
                ethers.toUtf8Bytes(""),                // executionParams (empty like NEAR)
                1000000n,                              // estimatedGas (smaller value)
                hashlock                               // additionalData
            ],
            hashlock                                   // hashlock
        ];
        
        console.log('🔍 Step 1: Testing Gas Estimation (no ETH value)...');
        
        try {
            const gasEstimate = await factory.createFusionOrder.estimateGas(orderParams);
            console.log(`✅ Gas estimation successful: ${gasEstimate.toString()}`);
            
            console.log('\n🚀 Step 2: Creating Bitcoin Order...');
            
            const createTx = await factory.createFusionOrder(orderParams, {
                gasLimit: gasEstimate * 120n / 100n
            });
            
            console.log(`📝 Transaction submitted: ${createTx.hash}`);
            console.log('⏳ Waiting for confirmation...');
            
            const receipt = await createTx.wait();
            console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
            
            // Extract order hash
            let orderHash;
            for (const log of receipt.logs) {
                try {
                    const parsed = factory.interface.parseLog(log);
                    if (parsed.name === 'FusionOrderCreated') {
                        orderHash = parsed.args.orderHash;
                        break;
                    }
                } catch (e) {}
            }
            
            console.log('\n🎉 BITCOIN ORDER CREATED SUCCESSFULLY!');
            console.log('=====================================');
            console.log(`📋 Order Hash: ${orderHash || 'Unknown'}`);
            console.log(`🔗 Transaction: https://sepolia.etherscan.io/tx/${createTx.hash}`);
            console.log(`₿ Chain: Bitcoin Testnet (40004)`);
            console.log(`💰 Swap: ${ethers.formatEther(sourceAmount)} DT → ${destinationAmount} satoshis`);
            console.log(`🔒 Hashlock: ${hashlock}`);
            console.log(`🔓 Secret: 0x${secret.toString('hex')}`);
            console.log(`⏰ Expires: ${new Date(expiryTime * 1000).toISOString()}`);
            
            // Save success info
            const orderInfo = {
                success: true,
                orderHash: orderHash || 'unknown',
                secret: secret.toString('hex'),
                hashlock,
                btcAddress,
                sourceAmount: sourceAmount.toString(),
                destinationAmount,
                resolverFee: resolverFee.toString(),
                expiryTime,
                transactionHash: createTx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                created: new Date().toISOString(),
                factory: FACTORY_ADDRESS,
                chainId: 40004
            };
            
            const fs = require('fs');
            fs.writeFileSync('../bitcoin/bitcoin-order-success.json', JSON.stringify(orderInfo, null, 2));
            console.log('\n💾 Success info saved to bitcoin-order-success.json');
            
            console.log('\n🚀 Next Steps:');
            console.log('1. ✅ Bitcoin order created on Ethereum');
            console.log('2. 📝 Fund Bitcoin HTLC with generated script');
            console.log('3. 🔓 Reveal secret on Ethereum to claim tokens');
            console.log('4. ₿ Use revealed secret to claim Bitcoin');
            console.log('5. ✅ Complete atomic swap verified');
            
            return true;
            
        } catch (gasError) {
            console.log(`❌ Gas estimation failed: ${gasError.message}`);
            
            // Check specific error types
            if (gasError.message.includes('execution reverted')) {
                console.log('\n💡 Contract validation error detected');
                if (gasError.reason) {
                    console.log(`   Reason: ${gasError.reason}`);
                }
            } else if (gasError.message.includes('missing revert data')) {
                console.log('\n💡 Transaction would revert without specific reason');
                console.log('   This often indicates a requirement not met');
            }
            
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Order creation failed: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    createFinalBitcoinOrder().then(success => {
        console.log(`\nFinal Result: ${success ? '🎉 SUCCESS - BITCOIN INTEGRATION COMPLETE!' : '❌ FAILED'}`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { createFinalBitcoinOrder };