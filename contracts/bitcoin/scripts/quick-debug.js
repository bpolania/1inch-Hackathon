#!/usr/bin/env node

/**
 * Quick Debug - Focus on Gas Estimation Issue
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

const ERC20_ABI = [
    "function approve(address,uint256) external returns (bool)",
    "function balanceOf(address) external view returns (uint256)",
    "function allowance(address,address) external view returns (uint256)"
];

const BITCOIN_ADAPTER_ABI = [
    "function calculateMinSafetyDeposit(uint256) external pure returns (uint256)"
];

async function quickDebug() {
    console.log('🔍 Quick Debug - Gas Estimation Issue');
    console.log('====================================\n');
    
    try {
        const ETHEREUM_PRIVATE_KEY = '3a7bb163d352f1c19c2fcd439e3dc70568efa4efb5163d8209084fcbfd531d47';
        const RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu';
        
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(ETHEREUM_PRIVATE_KEY, provider);
        
        const FACTORY_ADDRESS = '0xbeEab741D2869404FcB747057f5AbdEffc3A138d';
        const TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
        const BITCOIN_ADAPTER = '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8';
        
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        const bitcoinAdapter = new ethers.Contract(BITCOIN_ADAPTER, BITCOIN_ADAPTER_ABI, signer);
        
        console.log('✅ Contracts initialized');
        
        // 1. Ensure sufficient approval
        const sourceAmount = ethers.parseEther('0.2');
        const resolverFee = ethers.parseEther('0.02');
        const totalNeeded = sourceAmount + resolverFee;
        
        const currentAllowance = await token.allowance(signer.address, FACTORY_ADDRESS);
        console.log(`Current allowance: ${ethers.formatEther(currentAllowance)} DT`);
        console.log(`Total needed: ${ethers.formatEther(totalNeeded)} DT`);
        
        if (currentAllowance < totalNeeded) {
            console.log('🔄 Increasing token approval...');
            const approveTx = await token.approve(FACTORY_ADDRESS, totalNeeded);
            await approveTx.wait();
            console.log('✅ Approval complete\n');
        }
        
        // 2. Try minimal order parameters first
        console.log('🔍 Testing Minimal Order Parameters');
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const btcAddress = 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc';
        const expiryTime = Math.floor(Date.now() / 1000) + 3600;
        
        const minimalOrderParams = [
            TOKEN_ADDRESS,                              // sourceToken
            sourceAmount,                               // sourceAmount
            40004,                                     // destinationChainId (Bitcoin testnet)
            ethers.toUtf8Bytes('BTC'),                 // destinationToken
            200000,                                    // destinationAmount (200k satoshis)
            ethers.toUtf8Bytes(btcAddress),            // destinationAddress
            resolverFee,                               // resolverFeeAmount
            expiryTime,                                // expiryTime
            [                                          // chainParams
                ethers.toUtf8Bytes(btcAddress),        // destinationAddress
                ethers.toUtf8Bytes(""),                // executionParams (empty)
                1000000n,                              // estimatedGas (smaller value)
                hashlock                               // additionalData
            ],
            hashlock                                   // hashlock
        ];
        
        const safetyDeposit = await bitcoinAdapter.calculateMinSafetyDeposit(sourceAmount);
        console.log(`Safety deposit: ${ethers.formatEther(safetyDeposit)} ETH`);
        
        // 3. Try gas estimation
        console.log('🔍 Attempting gas estimation...');
        try {
            const gasEstimate = await factory.createFusionOrder.estimateGas(
                minimalOrderParams,
                { value: safetyDeposit }
            );
            console.log(`✅ SUCCESS! Gas estimate: ${gasEstimate.toString()}`);
            
            // Try actual transaction
            console.log('🚀 Attempting actual transaction...');
            const tx = await factory.createFusionOrder(minimalOrderParams, { 
                value: safetyDeposit,
                gasLimit: gasEstimate * 120n / 100n // 20% buffer
            });
            
            console.log(`📝 Transaction submitted: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
            
            return true;
            
        } catch (gasError) {
            console.log(`❌ Gas estimation failed: ${gasError.message}`);
            
            // Try different variations
            console.log('\n🔍 Trying Alternative Parameters...');
            
            // Test 1: Different gas value
            const altParams1 = [...minimalOrderParams];
            altParams1[8][2] = 300_000_000_000_000n; // Use NEAR-style large gas
            
            try {
                await factory.createFusionOrder.estimateGas(altParams1, { value: safetyDeposit });
                console.log('✅ Large gas value works!');
            } catch (e) {
                console.log('❌ Large gas value failed');
            }
            
            // Test 2: Check if it's a registry issue
            const registryAddress = await factory.registry();
            const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
            const isSupported = await registry.isChainSupported(40004);
            console.log(`Bitcoin supported in registry: ${isSupported}`);
            
            // Test 3: Try with different chain ID
            const altParams2 = [...minimalOrderParams];
            altParams2[2] = 40002; // NEAR testnet (known working)
            
            try {
                await factory.createFusionOrder.estimateGas(altParams2, { value: safetyDeposit });
                console.log('✅ NEAR chain ID works - Bitcoin registration issue!');
            } catch (e) {
                console.log('❌ NEAR chain ID also failed - broader issue');
            }
            
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Debug failed: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    quickDebug().then(success => {
        console.log(`\nResult: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { quickDebug };