#!/usr/bin/env node

/**
 * Create Clean 10k Satoshi Bitcoin Order
 * 
 * Creates a properly matched order: 0.01 DT → 10,000 satoshis
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');

async function createClean10kOrder() {
    console.log('₿ Create Clean 10k Satoshi Bitcoin Order');
    console.log('=========================================\n');
    
    try {
        const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu');
        const signer = new ethers.Wallet('3a7bb163d352f1c19c2fcd439e3dc70568efa4efb5163d8209084fcbfd531d47', provider);
        
        // Contract setup
        const FACTORY_ADDRESS = '0xbeEab741D2869404FcB747057f5AbdEffc3A138d';
        const TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
        
        const FACTORY_ABI = [
            "function createFusionOrder((address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,(bytes,bytes,uint256,bytes),bytes32)) external returns (bytes32)",
            "event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, uint256 dstChainId, uint256 srcAmount)"
        ];
        
        const ERC20_ABI = [
            "function approve(address,uint256) external returns (bool)",
            "function allowance(address,address) external view returns (uint256)",
            "function balanceOf(address) external view returns (uint256)",
            "function symbol() external view returns (string)"
        ];
        
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        
        console.log('✅ Connected to Ethereum Sepolia');
        console.log(`   Factory: ${FACTORY_ADDRESS}`);
        console.log(`   Token: ${TOKEN_ADDRESS}`);
        console.log(`   Wallet: ${signer.address}\n`);
        
        // Check token balance
        const tokenBalance = await token.balanceOf(signer.address);
        const symbol = await token.symbol();
        console.log(`💰 Current ${symbol} balance: ${ethers.formatEther(tokenBalance)} ${symbol}`);
        
        // Clean 10k satoshi order parameters
        const sourceAmount = ethers.parseEther('0.01');     // 0.01 DT (smaller amount)
        const resolverFee = ethers.parseEther('0.001');     // 0.001 DT (10% fee)
        const destinationAmount = 10000;                    // 10,000 satoshis (0.0001 BTC)
        const btcAddress = 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc';
        
        // Generate new secret/hashlock for clean order
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const expiryTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours
        
        console.log('📋 Clean Order Parameters:');
        console.log(`   Source: ${ethers.formatEther(sourceAmount)} ${symbol}`);
        console.log(`   Destination: ${destinationAmount} satoshis (${destinationAmount/100000000} BTC)`);
        console.log(`   Resolver Fee: ${ethers.formatEther(resolverFee)} ${symbol}`);
        console.log(`   Bitcoin Address: ${btcAddress}`);
        console.log(`   Expiry: ${new Date(expiryTime * 1000).toISOString()}`);
        console.log(`   Secret: 0x${secret.toString('hex')}`);
        console.log(`   Hashlock: ${hashlock}\n`);
        
        // Ensure sufficient token approval
        const totalNeeded = sourceAmount + resolverFee;
        const allowance = await token.allowance(signer.address, FACTORY_ADDRESS);
        
        console.log(`🔍 Token Approval Check:`);
        console.log(`   Required: ${ethers.formatEther(totalNeeded)} ${symbol}`);
        console.log(`   Current: ${ethers.formatEther(allowance)} ${symbol}`);
        
        if (allowance < totalNeeded) {
            console.log('🔄 Approving tokens...');
            const approveTx = await token.approve(FACTORY_ADDRESS, totalNeeded);
            await approveTx.wait();
            console.log('✅ Token approval confirmed\n');
        } else {
            console.log('✅ Sufficient approval already exists\n');
        }
        
        // Create order parameters
        const orderParams = [
            TOKEN_ADDRESS,                              // sourceToken
            sourceAmount,                               // sourceAmount  
            40004,                                     // destinationChainId (Bitcoin testnet)
            ethers.toUtf8Bytes('BTC'),                 // destinationToken
            destinationAmount,                          // destinationAmount (10k satoshis)
            ethers.toUtf8Bytes(btcAddress),            // destinationAddress
            resolverFee,                               // resolverFeeAmount
            expiryTime,                                // expiryTime
            [                                          // chainParams
                ethers.toUtf8Bytes(btcAddress),        // destinationAddress
                ethers.toUtf8Bytes(""),                // executionParams (empty)
                1000000n,                              // estimatedGas
                hashlock                               // additionalData
            ],
            hashlock                                   // hashlock
        ];
        
        console.log('🔍 Gas Estimation...');
        const gasEstimate = await factory.createFusionOrder.estimateGas(orderParams);
        console.log(`✅ Gas estimate: ${gasEstimate.toString()}`);
        
        console.log('\n🚀 Creating Clean Bitcoin Order...');
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
                    console.log(`📋 Order Hash: ${orderHash}`);
                    break;
                }
            } catch (e) {}
        }
        
        console.log('\n🎉 CLEAN 10K BITCOIN ORDER CREATED!');
        console.log('===================================');
        console.log(`🔗 Transaction: https://sepolia.etherscan.io/tx/${createTx.hash}`);
        console.log(`₿ Chain: Bitcoin Testnet (40004)`);
        console.log(`💰 Swap: ${ethers.formatEther(sourceAmount)} ${symbol} → ${destinationAmount} satoshis`);
        console.log(`🔒 Hashlock: ${hashlock}`);
        console.log(`🔓 Secret: 0x${secret.toString('hex')}`);
        console.log(`⏰ Expires: ${new Date(expiryTime * 1000).toISOString()}`);
        console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);
        
        // Save clean order info
        const cleanOrderInfo = {
            orderType: 'clean-10k-satoshi',
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
            chainId: 40004,
            nextSteps: [
                'Generate Bitcoin HTLC for 10,000 satoshis',
                'Fund Bitcoin HTLC with exact amount',
                'Execute atomic swap'
            ]
        };
        
        fs.writeFileSync('../bitcoin/clean-10k-order.json', JSON.stringify(cleanOrderInfo, null, 2));
        console.log('\n💾 Clean order info saved to clean-10k-order.json');
        
        console.log('\n🚀 Next Steps:');
        console.log('1. ✅ Clean Ethereum order created');
        console.log('2. 📝 Generate Bitcoin HTLC for 10k satoshis');
        console.log('3. 💰 Fund Bitcoin HTLC address');
        console.log('4. 🔓 Execute atomic swap');
        
        return cleanOrderInfo;
        
    } catch (error) {
        console.error(`❌ Clean order creation failed: ${error.message}`);
        return null;
    }
}

if (require.main === module) {
    createClean10kOrder().then(result => {
        console.log(`\nResult: ${result ? '🎉 SUCCESS' : '❌ FAILED'}`);
        process.exit(result ? 0 : 1);
    });
}

module.exports = { createClean10kOrder };