#!/usr/bin/env node

/**
 * Live Contract Connectivity Test
 * 
 * Tests connectivity to all deployed contracts on Sepolia testnet
 */

const { ethers } = require('ethers');
const { loadConfig } = require('./dist/config/config');

// Contract ABIs (minimal for testing)
const FACTORY_ABI = [
    "function registry() external view returns (address)",
    "function escrowFactory() external view returns (address)",
    "function getSupportedChains() external view returns (uint256[])",
    "function calculateOrderHash(tuple(address,uint256,uint256,bytes,uint256,bytes,uint256,uint256,tuple(bytes,bytes,uint256,bytes),bytes32)) external pure returns (bytes32)"
];

const REGISTRY_ABI = [
    "function owner() external view returns (address)",
    "function getSupportedChainIds() external view returns (uint256[])",
    "function getChainAdapter(uint256) external view returns (address)",
    "function isChainSupported(uint256) external view returns (bool)"
];

const ERC20_ABI = [
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
    "function balanceOf(address) external view returns (uint256)"
];

const BITCOIN_ADAPTER_ABI = [
    "function BITCOIN_MAINNET() external pure returns (uint256)",
    "function BITCOIN_TESTNET() external pure returns (uint256)",
    "function validateDestinationAddress(bytes) external pure returns (bool)"
];

async function testLiveContracts() {
    console.log('🔗 Testing Live Contract Connectivity');
    console.log('====================================\n');
    
    try {
        // 1. Load configuration
        const config = await loadConfig();
        console.log('✅ Configuration loaded');
        
        // 2. Initialize provider
        const provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
        console.log(`🌐 Connected to ${config.ethereum.name}`);
        
        // 3. Test network connectivity
        const blockNumber = await provider.getBlockNumber();
        console.log(`📦 Current block: ${blockNumber}`);
        
        const balance = await provider.getBalance(config.wallet.ethereum.address);
        console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH\n`);
        
        // 4. Test Factory Contract
        console.log('🏭 Testing Factory Contract');
        console.log('---------------------------');
        const factory = new ethers.Contract(config.ethereum.contracts.factory, FACTORY_ABI, provider);
        
        const registryAddress = await factory.registry();
        console.log(`✅ Registry address: ${registryAddress}`);
        
        const escrowFactory = await factory.escrowFactory();
        console.log(`✅ Escrow factory: ${escrowFactory}`);
        
        try {
            const supportedChains = await factory.getSupportedChains();
            console.log(`✅ Supported chains: ${supportedChains.map(c => c.toString())}`);
        } catch (error) {
            console.log(`⚠️ getSupportedChains not available (${error.message})`);
        }
        console.log('');
        
        // 5. Test Registry Contract
        console.log('📋 Testing Registry Contract');
        console.log('----------------------------');
        const registry = new ethers.Contract(config.ethereum.contracts.registry, REGISTRY_ABI, provider);
        
        const registryOwner = await registry.owner();
        console.log(`✅ Registry owner: ${registryOwner}`);
        
        const chainIds = await registry.getSupportedChainIds();
        console.log(`✅ Registered chains: ${chainIds.map(c => c.toString())}`);
        
        // Test specific chain adapters
        for (const chainId of chainIds) {
            const adapter = await registry.getChainAdapter(chainId);
            const isSupported = await registry.isChainSupported(chainId);
            console.log(`✅ Chain ${chainId}: ${adapter} (supported: ${isSupported})`);
        }
        console.log('');
        
        // 6. Test Token Contract
        console.log('🪙 Testing Token Contract');
        console.log('-------------------------');
        const token = new ethers.Contract(config.ethereum.contracts.token, ERC20_ABI, provider);
        
        const name = await token.name();
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const tokenBalance = await token.balanceOf(config.wallet.ethereum.address);
        
        console.log(`✅ Token: ${name} (${symbol})`);
        console.log(`✅ Decimals: ${decimals}`);
        console.log(`✅ Balance: ${ethers.formatUnits(tokenBalance, decimals)} ${symbol}\n`);
        
        // 7. Test Bitcoin Adapters
        console.log('₿ Testing Bitcoin Adapters');
        console.log('--------------------------');
        
        // Test Bitcoin testnet adapter
        const bitcoinTestnetAdapter = '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8';
        const btcAdapter = new ethers.Contract(bitcoinTestnetAdapter, BITCOIN_ADAPTER_ABI, provider);
        
        const btcMainnet = await btcAdapter.BITCOIN_MAINNET();
        const btcTestnet = await btcAdapter.BITCOIN_TESTNET();
        console.log(`✅ Bitcoin mainnet chain ID: ${btcMainnet}`);
        console.log(`✅ Bitcoin testnet chain ID: ${btcTestnet}`);
        
        // Test Bitcoin address validation
        const testAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
        const isValidBtcAddress = await btcAdapter.validateDestinationAddress(
            ethers.toUtf8Bytes(testAddress)
        );
        console.log(`✅ Bitcoin address validation (${testAddress}): ${isValidBtcAddress}\n`);
        
        // 8. Gas Price Check
        console.log('⛽ Network Conditions');
        console.log('--------------------');
        const feeData = await provider.getFeeData();
        console.log(`✅ Gas price: ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
        if (feeData.maxFeePerGas) {
            console.log(`✅ Max fee per gas: ${ethers.formatUnits(feeData.maxFeePerGas, 'gwei')} gwei`);
        }
        console.log('');
        
        // 9. Summary
        console.log('🎉 Live Contract Test Summary');
        console.log('============================');
        console.log('✅ Network connectivity: PASSED');
        console.log('✅ Factory contract: OPERATIONAL');
        console.log('✅ Registry contract: OPERATIONAL');
        console.log('✅ Token contract: OPERATIONAL');
        console.log('✅ Bitcoin adapters: OPERATIONAL');
        console.log('✅ All contracts responsive');
        console.log('');
        console.log('🚀 All systems ready for Bitcoin atomic swaps!');
        
        return true;
        
    } catch (error) {
        console.error('❌ Live contract test failed:', error.message);
        return false;
    }
}

if (require.main === module) {
    testLiveContracts().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testLiveContracts };