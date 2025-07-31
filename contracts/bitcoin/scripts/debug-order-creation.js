#!/usr/bin/env node

/**
 * Comprehensive Bitcoin Order Creation Debug
 * 
 * Step-by-step debugging to identify the exact cause of gas estimation failure
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

// Extended ABIs for debugging
const FACTORY_ABI = [
    "function createFusionOrder((address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,(bytes,bytes,uint256,bytes),bytes32)) external returns (bytes32)",
    "function registry() external view returns (address)",
    "function getOrder(bytes32) external view returns (bool,uint256,bytes32,address,address)",
    "event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, uint256 dstChainId, uint256 srcAmount)"
];

const REGISTRY_ABI = [
    "function isChainSupported(uint256) external view returns (bool)",
    "function getChainAdapter(uint256) external view returns (address)",
    "function getSupportedChains() external view returns (uint256[])"
];

const BITCOIN_ADAPTER_ABI = [
    "function validateDestinationAddress(bytes) external pure returns (bool)",
    "function encodeExecutionParams(string,uint256,uint256) external pure returns (bytes)",
    "function calculateMinSafetyDeposit(uint256) external pure returns (uint256)",
    "function validateOrderParams((bytes,bytes,uint256,bytes),uint256) external view returns ((bool,string,uint256))"
];

const ERC20_ABI = [
    "function approve(address,uint256) external returns (bool)",
    "function balanceOf(address) external view returns (uint256)",
    "function allowance(address,address) external view returns (uint256)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
];

async function debugOrderCreation() {
    console.log('🔍 Comprehensive Bitcoin Order Creation Debug');
    console.log('============================================\n');
    
    try {
        // 1. Setup
        const ETHEREUM_PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY || '3a7bb163d352f1c19c2fcd439e3dc70568efa4efb5163d8209084fcbfd531d47';
        const RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu';
        
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(ETHEREUM_PRIVATE_KEY, provider);
        
        // Contract addresses
        const FACTORY_ADDRESS = '0xbeEab741D2869404FcB747057f5AbdEffc3A138d';
        const TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
        const BITCOIN_ADAPTER = '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8';
        
        console.log('🔗 Connection Info:');
        console.log(`   Network: Ethereum Sepolia`);
        console.log(`   Wallet: ${signer.address}`);
        console.log(`   Factory: ${FACTORY_ADDRESS}`);
        console.log(`   Token: ${TOKEN_ADDRESS}`);
        console.log(`   Bitcoin Adapter: ${BITCOIN_ADAPTER}\n`);
        
        // Initialize contracts
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
        const bitcoinAdapter = new ethers.Contract(BITCOIN_ADAPTER, BITCOIN_ADAPTER_ABI, signer);
        
        // 2. Basic validations
        console.log('🔍 Step 1: Basic Contract Validations');
        
        // Check registry
        const registryAddress = await factory.registry();
        const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
        console.log(`   Registry: ${registryAddress}`);
        
        const isSupported = await registry.isChainSupported(40004);
        console.log(`   Bitcoin testnet supported: ${isSupported ? '✅' : '❌'}`);
        
        if (!isSupported) {
            throw new Error('Bitcoin testnet not supported in registry');
        }
        
        const adapterAddress = await registry.getChainAdapter(40004);
        console.log(`   Bitcoin adapter: ${adapterAddress}`);
        console.log(`   Adapter matches: ${adapterAddress.toLowerCase() === BITCOIN_ADAPTER.toLowerCase() ? '✅' : '❌'}\n`);
        
        // 3. Token validations
        console.log('🔍 Step 2: Token Validations');
        const tokenBalance = await token.balanceOf(signer.address);
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        console.log(`   Balance: ${ethers.formatUnits(tokenBalance, decimals)} ${symbol}`);
        
        const sourceAmount = ethers.parseEther('0.2');
        const resolverFee = ethers.parseEther('0.02');
        const totalNeeded = sourceAmount + resolverFee;
        
        console.log(`   Needed: ${ethers.formatEther(totalNeeded)} ${symbol}`);
        console.log(`   Sufficient: ${tokenBalance >= totalNeeded ? '✅' : '❌'}`);
        
        if (tokenBalance < totalNeeded) {
            throw new Error(`Insufficient tokens. Need ${ethers.formatEther(totalNeeded)} ${symbol}`);
        }
        
        // Check allowance
        const allowance = await token.allowance(signer.address, FACTORY_ADDRESS);
        console.log(`   Current allowance: ${ethers.formatEther(allowance)} ${symbol}`);
        console.log(`   Allowance sufficient: ${allowance >= totalNeeded ? '✅' : '❌'}\n`);
        
        // 4. Bitcoin-specific validations
        console.log('🔍 Step 3: Bitcoin-Specific Validations');
        const btcAddress = 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc';
        
        const isValidAddress = await bitcoinAdapter.validateDestinationAddress(
            ethers.toUtf8Bytes(btcAddress)
        );
        console.log(`   Address valid: ${isValidAddress ? '✅' : '❌'}`);
        
        if (!isValidAddress) {
            throw new Error(`Invalid Bitcoin address: ${btcAddress}`);
        }
        
        const safetyDeposit = await bitcoinAdapter.calculateMinSafetyDeposit(sourceAmount);
        console.log(`   Safety deposit: ${ethers.formatEther(safetyDeposit)} ETH`);
        
        const ethBalance = await provider.getBalance(signer.address);
        console.log(`   ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
        console.log(`   ETH sufficient: ${ethBalance >= safetyDeposit ? '✅' : '❌'}\n`);
        
        // 5. Order parameter validation
        console.log('🔍 Step 4: Order Parameter Validation');
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const expiryTime = Math.floor(Date.now() / 1000) + 3600;
        const destinationAmount = 200000;
        
        console.log(`   Source amount: ${ethers.formatEther(sourceAmount)} ${symbol}`);
        console.log(`   Destination amount: ${destinationAmount} satoshis`);
        console.log(`   Resolver fee: ${ethers.formatEther(resolverFee)} ${symbol}`);
        console.log(`   Expiry: ${new Date(expiryTime * 1000).toISOString()}`);
        console.log(`   Hashlock: ${hashlock}\n`);
        
        // 6. Chain parameters validation
        console.log('🔍 Step 5: Chain Parameters Validation');
        const chainParams = {
            destinationAddress: ethers.toUtf8Bytes(btcAddress),
            executionParams: ethers.toUtf8Bytes(""), // Empty like NEAR
            estimatedGas: 300_000_000_000_000n,
            additionalData: hashlock
        };
        
        console.log(`   Destination address: ${btcAddress}`);
        console.log(`   Execution params: Empty (${chainParams.executionParams.length} bytes)`);
        console.log(`   Estimated gas: ${chainParams.estimatedGas.toString()}`);
        console.log(`   Additional data: ${chainParams.additionalData}\n`);
        
        // Test adapter validation if available
        try {
            const validationResult = await bitcoinAdapter.validateOrderParams(chainParams, sourceAmount);
            console.log(`   Adapter validation: ${validationResult.isValid ? '✅' : '❌'}`);
            if (!validationResult.isValid) {
                console.log(`   Validation error: ${validationResult.errorMessage}`);
            }
        } catch (validationError) {
            console.log(`   Adapter validation: ⚠️  Function not available (${validationError.message})`);
        }
        
        // 7. Token approval
        console.log('🔍 Step 6: Token Approval');
        if (allowance < totalNeeded) {
            console.log('   Approving tokens...');
            const approveTx = await token.approve(FACTORY_ADDRESS, totalNeeded);
            await approveTx.wait();
            console.log(`   ✅ Approval confirmed: ${approveTx.hash}`);
        } else {
            console.log('   ✅ Tokens already approved');
        }
        
        // 8. Build order parameters
        console.log('\n🔍 Step 7: Order Parameters Construction');
        const orderParams = [
            TOKEN_ADDRESS,                              // sourceToken
            sourceAmount,                               // sourceAmount  
            40004,                                     // destinationChainId
            ethers.toUtf8Bytes('BTC'),                 // destinationToken
            destinationAmount,                          // destinationAmount
            ethers.toUtf8Bytes(btcAddress),            // destinationAddress
            resolverFee,                               // resolverFeeAmount
            expiryTime,                                // expiryTime
            [                                          // chainParams
                chainParams.destinationAddress,
                chainParams.executionParams,
                chainParams.estimatedGas,
                chainParams.additionalData
            ],
            hashlock                                   // hashlock
        ];
        
        console.log('   Order parameters constructed ✅\n');
        
        // 9. Individual parameter validation
        console.log('🔍 Step 8: Individual Parameter Validation');
        console.log(`   sourceToken: ${orderParams[0]} (${typeof orderParams[0]})`);
        console.log(`   sourceAmount: ${orderParams[1].toString()} (${typeof orderParams[1]})`);
        console.log(`   destinationChainId: ${orderParams[2]} (${typeof orderParams[2]})`);
        console.log(`   destinationToken: ${ethers.toUtf8String(orderParams[3])} (${orderParams[3].length} bytes)`);
        console.log(`   destinationAmount: ${orderParams[4]} (${typeof orderParams[4]})`);
        console.log(`   destinationAddress: ${ethers.toUtf8String(orderParams[5])} (${orderParams[5].length} bytes)`);
        console.log(`   resolverFeeAmount: ${orderParams[6].toString()} (${typeof orderParams[6]})`);
        console.log(`   expiryTime: ${orderParams[7]} (${typeof orderParams[7]})`);
        console.log(`   chainParams: [${orderParams[8].length} elements]`);
        console.log(`   hashlock: ${orderParams[9]} (${typeof orderParams[9]})\n`);
        
        // 10. Gas estimation with detailed error catching
        console.log('🔍 Step 9: Gas Estimation with Error Analysis');
        
        try {
            console.log('   Attempting gas estimation...');
            const gasEstimate = await factory.createFusionOrder.estimateGas(
                orderParams,
                { value: safetyDeposit }
            );
            console.log(`   ✅ Gas estimation successful: ${gasEstimate.toString()}`);
            console.log(`   🎉 Order creation should work!`);
            return true;
            
        } catch (gasError) {
            console.log(`   ❌ Gas estimation failed`);
            console.log(`   Error message: ${gasError.message}`);
            
            // Try to get more specific error information
            console.log('\n🔍 Step 10: Detailed Error Analysis');
            
            try {
                // Try static call to get revert reason
                await factory.createFusionOrder.staticCall(
                    orderParams,
                    { value: safetyDeposit }
                );
                console.log('   ⚠️  Static call succeeded but gas estimation failed (unusual)');
                
            } catch (staticError) {
                console.log(`   Static call error: ${staticError.message}`);
                
                if (staticError.reason) {
                    console.log(`   Revert reason: ${staticError.reason}`);
                }
                
                if (staticError.data) {
                    console.log(`   Error data: ${staticError.data}`);
                    
                    // Try to decode error data
                    try {
                        const errorInterface = new ethers.Interface([
                            "error InvalidAmount()",
                            "error InvalidExpiry()",
                            "error InvalidHashlock()",
                            "error ChainNotSupported(uint256)",
                            "error InsufficientSafetyDeposit()"
                        ]);
                        
                        const decodedError = errorInterface.parseError(staticError.data);
                        console.log(`   Decoded error: ${decodedError.name}(${decodedError.args.join(', ')})`);
                        
                    } catch (decodeError) {
                        console.log(`   Could not decode error data`);
                    }
                }
            }
            
            // Additional debugging suggestions
            console.log('\n💡 Debugging Suggestions:');
            console.log('   1. Check if factory contract has been upgraded');
            console.log('   2. Verify Bitcoin adapter is properly registered');
            console.log('   3. Test with smaller amounts');
            console.log('   4. Check if there are additional validation requirements');
            console.log('   5. Compare with working NEAR order parameters');
            
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Debug failed: ${error.message}`);
        if (error.stack) {
            console.error(`Stack trace: ${error.stack}`);
        }
        return false;
    }
}

if (require.main === module) {
    debugOrderCreation().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { debugOrderCreation };