#!/usr/bin/env node

/**
 * Bitcoin Atomic Swap End-to-End Test
 * 
 * This script demonstrates a complete Bitcoin atomic swap using the deployed 
 * 1inch Fusion+ contracts and the Bitcoin relayer service.
 */

const { ethers } = require('ethers');
const { loadConfig } = require('./dist/config/config');
const crypto = require('crypto');

// 1inch Fusion+ Factory ABI (simplified for order creation)
const FACTORY_ABI = [
    "function createFusionOrder(bytes32 orderHash, address maker, address srcToken, uint256 srcAmount, uint256 dstChainId, bytes calldata dstExecutionParams, uint256 expiryTime, bytes32 hashlock) external",
    "function getOrder(bytes32 orderHash) external view returns (bool isActive, uint256 expiryTime, bytes32 hashlock, address maker, address resolver)",
    "event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, uint256 dstChainId, uint256 srcAmount)"
];

// Mock ERC20 ABI for token approval
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)"
];

// Bitcoin destination chain adapter ABI
const BITCOIN_ADAPTER_ABI = [
    "function validateDestinationAddress(bytes calldata addressBytes) external pure returns (bool)",
    "function encodeExecutionParams(string memory btcAddress, uint256 htlcTimelock, uint256 feeRate) external pure returns (bytes memory)",
    "function calculateMinSafetyDeposit(uint256 amount) external pure returns (uint256)"
];

async function testBitcoinAtomicSwap() {
    console.log('🚀 Starting Bitcoin Atomic Swap Test');
    console.log('=====================================\n');
    
    try {
        // 1. Load configuration
        const config = await loadConfig();
        console.log('✅ Configuration loaded');
        
        // 2. Initialize Ethereum provider and signer
        const provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
        const signer = new ethers.Wallet(config.wallet.ethereum.privateKey, provider);
        console.log(`🔗 Connected to ${config.ethereum.name}`);
        console.log(`💰 Wallet: ${signer.address}`);
        
        // 3. Get current balance
        const balance = await provider.getBalance(signer.address);
        console.log(`💎 ETH Balance: ${ethers.formatEther(balance)} ETH\n`);
        
        // 4. Initialize contracts
        const factory = new ethers.Contract(config.ethereum.contracts.factory, FACTORY_ABI, signer);
        const token = new ethers.Contract(config.ethereum.contracts.token, ERC20_ABI, signer);
        console.log('📋 Contracts initialized');
        console.log(`🏭 Factory: ${config.ethereum.contracts.factory}`);
        console.log(`🪙 Token: ${config.ethereum.contracts.token}\n`);
        
        // 5. Check token balance
        const tokenBalance = await token.balanceOf(signer.address);
        console.log(`🪙 Token Balance: ${ethers.formatEther(tokenBalance)} DT`);
        
        if (tokenBalance === 0n) {
            console.log('❌ No tokens available for swap. Please mint some tokens first.');
            return false;
        }
        
        // 6. Generate atomic swap parameters
        const secret = crypto.randomBytes(32);
        const hashlock = ethers.keccak256(secret);
        const orderHash = ethers.keccak256(ethers.toUtf8Bytes(`bitcoin_swap_${Date.now()}`));
        
        console.log('🔐 Atomic swap parameters generated:');
        console.log(`   Order Hash: ${orderHash}`);
        console.log(`   Hashlock: ${hashlock}`);
        console.log(`   Secret: 0x${secret.toString('hex')}\n`);
        
        // 7. Bitcoin destination parameters
        const btcAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'; // Example testnet address
        const htlcTimelock = 144; // ~24 hours in blocks
        const feeRate = 10; // sat/byte
        const dstChainId = 40004; // Bitcoin testnet
        
        // 8. Encode Bitcoin execution parameters
        const bitcoinAdapter = new ethers.Contract(
            '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8', // Bitcoin testnet adapter
            BITCOIN_ADAPTER_ABI, 
            signer
        );
        
        const dstExecutionParams = await bitcoinAdapter.encodeExecutionParams(
            btcAddress,
            htlcTimelock,
            feeRate
        );
        
        console.log('₿ Bitcoin parameters:');
        console.log(`   Address: ${btcAddress}`);
        console.log(`   HTLC Timelock: ${htlcTimelock} blocks`);
        console.log(`   Fee Rate: ${feeRate} sat/byte`);
        console.log(`   Chain ID: ${dstChainId} (Bitcoin Testnet)`);
        console.log(`   Encoded Params: ${dstExecutionParams}\n`);
        
        // 9. Validate Bitcoin address
        const isValidAddress = await bitcoinAdapter.validateDestinationAddress(
            ethers.toUtf8Bytes(btcAddress)
        );
        console.log(`✅ Bitcoin address validation: ${isValidAddress ? 'VALID' : 'INVALID'}`);
        
        if (!isValidAddress) {
            console.log('❌ Invalid Bitcoin address provided');
            return false;
        }
        
        // 10. Calculate safety deposit
        const swapAmount = ethers.parseEther('0.1'); // 0.1 DT
        const safetyDeposit = await bitcoinAdapter.calculateMinSafetyDeposit(swapAmount);
        console.log(`💰 Swap Amount: ${ethers.formatEther(swapAmount)} DT`);
        console.log(`🛡️ Safety Deposit: ${ethers.formatEther(safetyDeposit)} ETH\n`);
        
        // 11. Check if we have enough ETH for safety deposit
        if (balance < safetyDeposit) {
            console.log(`❌ Insufficient ETH for safety deposit. Need ${ethers.formatEther(safetyDeposit)} ETH`);
            return false;
        }
        
        // 12. Approve tokens for the factory
        console.log('🔐 Approving tokens...');
        const approveTx = await token.approve(factory.target, swapAmount);
        await approveTx.wait();
        console.log(`✅ Token approval: ${approveTx.hash}\n`);
        
        // 13. Create Fusion+ order
        console.log('🚀 Creating Bitcoin Fusion+ order...');
        const expiryTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        
        const createOrderTx = await factory.createFusionOrder(
            orderHash,
            signer.address,
            token.target,
            swapAmount,
            dstChainId,
            dstExecutionParams,
            expiryTime,
            hashlock,
            { value: safetyDeposit }
        );
        
        console.log(`📝 Order creation transaction: ${createOrderTx.hash}`);
        const receipt = await createOrderTx.wait();
        console.log(`✅ Order created successfully (Block: ${receipt.blockNumber})\n`);
        
        // 14. Verify order was created
        const order = await factory.getOrder(orderHash);
        console.log('📊 Order verification:');
        console.log(`   Active: ${order.isActive}`);
        console.log(`   Expiry: ${new Date(order.expiryTime * 1000).toISOString()}`);
        console.log(`   Hashlock: ${order.hashlock}`);
        console.log(`   Maker: ${order.maker}`);
        console.log(`   Resolver: ${order.resolver}\n`);
        
        // 15. Summary
        console.log('🎉 Bitcoin Atomic Swap Test COMPLETED!');
        console.log('=====================================');
        console.log('✅ Order created on Ethereum');
        console.log('✅ Bitcoin parameters encoded');
        console.log('✅ Safety deposit provided');
        console.log('✅ Ready for relayer execution');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('1. The relayer service will detect this order');
        console.log('2. It will create a Bitcoin HTLC');
        console.log('3. Fund the HTLC with the equivalent Bitcoin amount');
        console.log('4. Monitor for secret revelation on Ethereum');
        console.log('5. Claim Bitcoin when secret is revealed');
        console.log('');
        console.log(`🔗 Track on Etherscan: https://sepolia.etherscan.io/tx/${createOrderTx.hash}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Bitcoin atomic swap test failed:', error.message);
        if (error.data) {
            console.error('Error data:', error.data);
        }
        return false;
    }
}

if (require.main === module) {
    testBitcoinAtomicSwap().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testBitcoinAtomicSwap };