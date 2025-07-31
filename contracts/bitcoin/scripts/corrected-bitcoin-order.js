#!/usr/bin/env node

/**
 * Corrected Bitcoin Order Creation
 * 
 * Uses the exact format from the working NEAR transaction
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

const FACTORY_ABI = [
    "function createFusionOrder((address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,(bytes,bytes,uint256,bytes),bytes32)) external returns (bytes32)",
    "event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, uint256 dstChainId, uint256 srcAmount)"
];

const ERC20_ABI = [
    "function approve(address,uint256) external returns (bool)",
    "function allowance(address,address) external view returns (uint256)"
];

async function createCorrectedBitcoinOrder() {
    console.log('₿ Corrected Bitcoin Order Creation');
    console.log('==================================\n');
    
    try {
        const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu');
        const signer = new ethers.Wallet('3a7bb163d352f1c19c2fcd439e3dc70568efa4efb5163d8209084fcbfd531d47', provider);
        
        // Use OLD factory that worked for NEAR
        const FACTORY_ADDRESS = '0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a';
        const TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
        
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        
        console.log('✅ Using working OLD factory');
        console.log(`   Factory: ${FACTORY_ADDRESS}`);
        console.log(`   Wallet: ${signer.address}\n`);
        
        // Use exact same parameters as working NEAR order, but for Bitcoin
        const sourceAmount = ethers.parseEther('0.2');
        const resolverFee = ethers.parseEther('0.02');
        const destinationAmount = 200000; // 200k satoshis
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const expiryTime = Math.floor(Date.now() / 1000) + 3600;
        const btcAddress = 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc';
        
        console.log('📋 Order Parameters:');
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
        
        // Create order parameters matching EXACTLY the working NEAR format
        const orderParams = [
            TOKEN_ADDRESS,                              // sourceToken
            sourceAmount,                               // sourceAmount  
            40004,                                     // destinationChainId (Bitcoin testnet)
            ethers.toUtf8Bytes('BTC'),                 // destinationToken
            destinationAmount,                          // destinationAmount (as number, not BigInt)
            ethers.toUtf8Bytes(btcAddress),            // destinationAddress
            resolverFee,                               // resolverFeeAmount
            expiryTime,                                // expiryTime (as number)
            [                                          // chainParams tuple
                ethers.toUtf8Bytes(btcAddress),        // destinationAddress
                ethers.toUtf8Bytes("BTC"),             // executionParams (2 bytes like working tx)
                300_000_000_000_000n,                  // estimatedGas (exact same as NEAR)
                hashlock                               // additionalData
            ],
            hashlock                                   // hashlock
        ];
        
        console.log('🔍 Testing Gas Estimation...');
        
        try {
            // Try with NO ETH value (like working transaction)
            const gasEstimate = await factory.createFusionOrder.estimateGas(orderParams);
            console.log(`✅ Gas estimation successful: ${gasEstimate.toString()}`);
            
            console.log('\n🚀 Creating Bitcoin Order...');
            
            // Create the order with NO ETH value
            const createTx = await factory.createFusionOrder(orderParams, {
                gasLimit: gasEstimate * 120n / 100n // 20% buffer
            });
            
            console.log(`📝 Transaction submitted: ${createTx.hash}`);
            console.log('⏳ Waiting for confirmation...');
            
            const receipt = await createTx.wait();
            console.log(`✅ Order created in block: ${receipt.blockNumber}`);
            
            // Extract order hash from events
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
            
            if (orderHash) {
                console.log(`📋 Order Hash: ${orderHash}`);
            }
            
            console.log('\n🎉 Bitcoin Order Created Successfully!');
            console.log('====================================');
            console.log(`🔗 Transaction: https://sepolia.etherscan.io/tx/${createTx.hash}`);
            console.log(`₿ Chain ID: 40004 (Bitcoin Testnet)`);
            console.log(`💰 Amount: ${ethers.formatEther(sourceAmount)} DT → ${destinationAmount} satoshis`);
            console.log(`🔒 Hashlock: ${hashlock}`);
            console.log(`🔓 Secret: 0x${secret.toString('hex')}`);
            
            // Save order info
            const orderInfo = {
                orderHash: orderHash || 'unknown',
                secret: secret.toString('hex'),
                hashlock,
                btcAddress,
                sourceAmount: sourceAmount.toString(),
                destinationAmount,
                expiryTime,
                transactionHash: createTx.hash,
                blockNumber: receipt.blockNumber,
                created: new Date().toISOString(),
                factory: FACTORY_ADDRESS
            };
            
            const fs = require('fs');
            fs.writeFileSync('../bitcoin/live-bitcoin-order-success.json', JSON.stringify(orderInfo, null, 2));
            console.log('\n💾 Order information saved to live-bitcoin-order-success.json');
            
            return true;
            
        } catch (gasError) {
            console.log(`❌ Gas estimation failed: ${gasError.message}`);
            
            // Try with ETH value as backup
            console.log('\n🔄 Trying with ETH safety deposit...');
            try {
                const gasEstimate2 = await factory.createFusionOrder.estimateGas(
                    orderParams,
                    { value: ethers.parseEther('0.01') }
                );
                console.log(`✅ With ETH value works: ${gasEstimate2.toString()}`);
            } catch (ethError) {
                console.log(`❌ With ETH value also failed: ${ethError.message}`);
            }
            
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Order creation failed: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    createCorrectedBitcoinOrder().then(success => {
        console.log(`\nResult: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { createCorrectedBitcoinOrder };