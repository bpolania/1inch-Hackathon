#!/usr/bin/env node

/**
 * Debug Bitcoin Order Creation Issues
 * 
 * Step-by-step validation to identify what's causing the gas estimation failure
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

const FACTORY_ABI = [
    "function createFusionOrder((address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,(bytes,bytes,uint256,bytes),bytes32)) external returns (bytes32)",
    "function registry() external view returns (address)"
];

const REGISTRY_ABI = [
    "function isChainSupported(uint256) external view returns (bool)"
];

const BITCOIN_ADAPTER_ABI = [
    "function validateDestinationAddress(bytes) external pure returns (bool)",
    "function encodeExecutionParams(string,uint256,uint256) external pure returns (bytes)",
    "function calculateMinSafetyDeposit(uint256) external pure returns (uint256)"
];

async function debugBitcoinOrder() {
    console.log('🔍 Debug Bitcoin Order Creation');
    console.log('===============================\n');
    
    try {
        // 1. Connect to Ethereum
        const ETHEREUM_PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY || '3a7bb163d352f1c19c2fcd439e3dc70568efa4efb5163d8209084fcbfd531d47';
        const RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu';
        
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(ETHEREUM_PRIVATE_KEY, provider);
        
        console.log('🔗 Connected to Ethereum Sepolia');
        console.log(`💰 Wallet: ${signer.address}\n`);
        
        // 2. Initialize contracts
        const FACTORY_ADDRESS = '0xbeEab741D2869404FcB747057f5AbdEffc3A138d';
        const BITCOIN_ADAPTER = '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8';
        const TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
        
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const bitcoinAdapter = new ethers.Contract(BITCOIN_ADAPTER, BITCOIN_ADAPTER_ABI, signer);
        
        console.log('📋 Contracts:');
        console.log(`   Factory: ${FACTORY_ADDRESS}`);
        console.log(`   Bitcoin Adapter: ${BITCOIN_ADAPTER}`);
        console.log(`   Token: ${TOKEN_ADDRESS}\n`);
        
        // 3. Check registry
        console.log('🔍 Step 1: Check Registry Integration');
        const registryAddress = await factory.registry();
        console.log(`   Registry: ${registryAddress}`);
        
        const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
        const isSupported = await registry.isChainSupported(40004);
        console.log(`   Bitcoin testnet supported: ${isSupported ? '✅' : '❌'}\n`);
        
        // 4. Test Bitcoin address validation
        console.log('🔍 Step 2: Bitcoin Address Validation');
        const btcAddress = 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc';
        const isValidAddress = await bitcoinAdapter.validateDestinationAddress(
            ethers.toUtf8Bytes(btcAddress)
        );
        console.log(`   Address ${btcAddress}: ${isValidAddress ? '✅ Valid' : '❌ Invalid'}\n`);
        
        // 5. Generate order parameters
        console.log('🔍 Step 3: Generate Order Parameters');
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const sourceAmount = ethers.parseEther('0.05');
        const destinationAmount = 50000;
        const resolverFee = ethers.parseEther('0.005');
        const expiryTime = Math.floor(Date.now() / 1000) + 3600;
        const dstChainId = 40004;
        
        console.log(`   Source Amount: ${ethers.formatEther(sourceAmount)} DT`);
        console.log(`   Destination: ${destinationAmount} satoshis`);
        console.log(`   Chain ID: ${dstChainId}`);
        console.log(`   Hashlock: ${hashlock}\n`);
        
        // 6. Encode execution parameters
        console.log('🔍 Step 4: Execution Parameters');
        try {
            const executionParams = await bitcoinAdapter.encodeExecutionParams(
                btcAddress, 144, 10
            );
            console.log(`   Encoded params: ${executionParams}\n`);
        } catch (error) {
            console.log(`   ❌ Encoding failed: ${error.message}\n`);
            return;
        }
        
        // 7. Build order parameters
        console.log('🔍 Step 5: Order Parameters Structure');
        const orderParams = [
            TOKEN_ADDRESS,                              // sourceToken
            sourceAmount,                               // sourceAmount
            dstChainId,                                // destinationChainId
            ethers.toUtf8Bytes('BTC'),                 // destinationToken
            destinationAmount,                          // destinationAmount
            ethers.toUtf8Bytes(btcAddress),            // destinationAddress
            resolverFee,                               // resolverFeeAmount
            expiryTime,                                // expiryTime
            [                                          // chainParams
                ethers.toUtf8Bytes(btcAddress),        // destinationAddress
                await bitcoinAdapter.encodeExecutionParams(btcAddress, 144, 10), // executionParams
                50000,                                 // estimatedGas
                hashlock                               // additionalData
            ],
            hashlock                                   // hashlock
        ];
        
        console.log('   Order parameters built successfully\n');
        
        // 8. Calculate safety deposit
        console.log('🔍 Step 6: Safety Deposit Calculation');
        try {
            const safetyDeposit = await bitcoinAdapter.calculateMinSafetyDeposit(sourceAmount);
            console.log(`   Safety deposit: ${ethers.formatEther(safetyDeposit)} ETH\n`);
            
            // 9. Estimate gas for transaction
            console.log('🔍 Step 7: Gas Estimation');
            const gasEstimate = await factory.createFusionOrder.estimateGas(
                orderParams, 
                { value: safetyDeposit }
            );
            console.log(`   ✅ Gas estimate: ${gasEstimate.toString()}`);
            console.log(`   🎉 Order creation should succeed!`);
            
        } catch (gasError) {
            console.log(`   ❌ Gas estimation failed: ${gasError.message}`);
            console.log(`   ❌ This indicates a contract validation error`);
            
            // Try to get more specific error
            console.log('\n🔍 Step 8: Detailed Error Analysis');
            try {
                await factory.createFusionOrder.staticCall(
                    orderParams,
                    { value: await bitcoinAdapter.calculateMinSafetyDeposit(sourceAmount) }
                );
            } catch (staticError) {
                console.log(`   Static call error: ${staticError.message}`);
                if (staticError.reason) {
                    console.log(`   Revert reason: ${staticError.reason}`);
                }
                if (staticError.data) {
                    console.log(`   Error data: ${staticError.data}`);
                }
            }
            
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error(`❌ Debug failed: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    debugBitcoinOrder().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { debugBitcoinOrder };