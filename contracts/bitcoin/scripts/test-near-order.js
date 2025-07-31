#!/usr/bin/env node

/**
 * Test NEAR Order Creation - Compare with Bitcoin
 * 
 * Tests if NEAR orders work with the current factory setup
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

const FACTORY_ABI = [
    "function createFusionOrder((address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,(bytes,bytes,uint256,bytes),bytes32)) external returns (bytes32)"
];

const ERC20_ABI = [
    "function approve(address,uint256) external returns (bool)",
    "function allowance(address,address) external view returns (uint256)"
];

async function testNearOrder() {
    console.log('🔍 Test NEAR Order Creation vs Bitcoin');
    console.log('====================================\n');
    
    try {
        const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu');
        const signer = new ethers.Wallet('3a7bb163d352f1c19c2fcd439e3dc70568efa4efb5163d8209084fcbfd531d47', provider);
        
        // Test with both factory addresses
        const factories = [
            { name: 'New Factory (Bitcoin support)', address: '0xbeEab741D2869404FcB747057f5AbdEffc3A138d' },
            { name: 'Old Factory (NEAR working)', address: '0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a' }
        ];
        
        const TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
        const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        
        // Common parameters
        const sourceAmount = ethers.parseEther('0.2');
        const resolverFee = ethers.parseEther('0.02');
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const expiryTime = Math.floor(Date.now() / 1000) + 3600;
        
        console.log('📋 Common Parameters:');
        console.log(`   Source: ${ethers.formatEther(sourceAmount)} DT`);
        console.log(`   Fee: ${ethers.formatEther(resolverFee)} DT`);
        console.log(`   Expiry: ${new Date(expiryTime * 1000).toISOString()}\n`);
        
        for (const factory of factories) {
            console.log(`🏭 Testing ${factory.name}`);
            console.log(`   Address: ${factory.address}`);
            
            const contract = new ethers.Contract(factory.address, FACTORY_ABI, signer);
            
            // Ensure approval
            const allowance = await token.allowance(signer.address, factory.address);
            if (allowance < sourceAmount + resolverFee) {
                console.log('   🔄 Approving tokens...');
                const approveTx = await token.approve(factory.address, sourceAmount + resolverFee);
                await approveTx.wait();
            }
            
            // Test NEAR order
            console.log('   📝 Testing NEAR order...');
            const nearOrderParams = [
                TOKEN_ADDRESS,                              // sourceToken
                sourceAmount,                               // sourceAmount
                40002,                                     // destinationChainId (NEAR testnet)
                ethers.toUtf8Bytes("native.near"),         // destinationToken
                ethers.parseEther("0.004"),                // destinationAmount
                ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"), // destinationAddress
                resolverFee,                               // resolverFeeAmount
                expiryTime,                                // expiryTime
                [                                          // chainParams
                    ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
                    ethers.toUtf8Bytes(""),                // Empty execution params
                    300_000_000_000_000n,                  // Large gas
                    hashlock
                ],
                hashlock                                   // hashlock
            ];
            
            try {
                const gasEstimate = await contract.createFusionOrder.estimateGas(
                    nearOrderParams,
                    { value: ethers.parseEther('0.01') } // 1% safety deposit
                );
                console.log(`   ✅ NEAR order: Gas estimate ${gasEstimate.toString()}`);
                
                // Try Bitcoin order with same factory
                console.log('   📝 Testing Bitcoin order...');
                const bitcoinOrderParams = [
                    TOKEN_ADDRESS,                              
                    sourceAmount,                               
                    40004,                                     // Bitcoin testnet
                    ethers.toUtf8Bytes('BTC'),                 
                    200000,                                    // 200k satoshis
                    ethers.toUtf8Bytes('tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc'),
                    resolverFee,                                
                    expiryTime,                                 
                    [                                           
                        ethers.toUtf8Bytes('tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc'),
                        ethers.toUtf8Bytes(""),                
                        300_000_000_000_000n,                  
                        hashlock
                    ],
                    hashlock                                   
                ];
                
                const btcGasEstimate = await contract.createFusionOrder.estimateGas(
                    bitcoinOrderParams,
                    { value: ethers.parseEther('0.01') }
                );
                console.log(`   ✅ Bitcoin order: Gas estimate ${btcGasEstimate.toString()}`);
                
            } catch (error) {
                console.log(`   ❌ Failed: ${error.message}`);
                
                // Check if it's a registry issue
                if (error.message.includes('ChainNotSupported') || error.message.includes('not supported')) {
                    console.log(`   💡 Chain registration issue detected`);
                }
            }
            
            console.log('');
        }
        
        // Test if the issue is in the actual working script
        console.log('🔍 Testing with Exact NEAR Script Parameters');
        try {
            const workingFactory = new ethers.Contract('0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a', FACTORY_ABI, signer);
            
            // Use exact parameters from the working NEAR script
            const workingOrderParams = {
                sourceToken: TOKEN_ADDRESS,
                sourceAmount: ethers.parseEther("0.2"),
                destinationChainId: 40002, // NEAR Testnet
                destinationToken: ethers.toUtf8Bytes("native.near"),
                destinationAmount: ethers.parseEther("0.004"),
                destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
                resolverFeeAmount: ethers.parseEther("0.02"),
                expiryTime: Math.floor(Date.now() / 1000) + 3600,
                hashlock: hashlock,
                chainParams: {
                    destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
                    executionParams: ethers.toUtf8Bytes(""),
                    estimatedGas: 300_000_000_000_000n,
                    additionalData: hashlock
                }
            };
            
            const gasEstimate = await workingFactory.createFusionOrder.estimateGas(workingOrderParams);
            console.log(`✅ Working NEAR script format: Gas estimate ${gasEstimate.toString()}`);
            console.log('💡 The issue might be in parameter format, not chain support');
            
        } catch (exactError) {
            console.log(`❌ Even exact NEAR format failed: ${exactError.message}`);
            console.log('💡 The factory contracts may have changed or require updates');
        }
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    testNearOrder().then(() => {
        console.log('\n🎯 Analysis Complete');
        process.exit(0);
    });
}

module.exports = { testNearOrder };