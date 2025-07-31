#!/usr/bin/env node

/**
 * Check Bitcoin Chain Registration in CrossChainRegistry
 * 
 * Verifies if Bitcoin chain 40004 is registered and available for orders
 */

const { ethers } = require('ethers');

const REGISTRY_ABI = [
    "function isChainSupported(uint256) external view returns (bool)",
    "function getChainAdapter(uint256) external view returns (address)",
    "function getSupportedChains() external view returns (uint256[])"
];

async function checkBitcoinRegistration() {
    console.log('🔍 Checking Bitcoin Chain Registration');
    console.log('=====================================\n');
    
    try {
        // Connect to Ethereum
        const RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu';
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        console.log('🔗 Connected to Ethereum Sepolia');
        
        // Registry address from README
        const REGISTRY_ADDRESS = '0x09Ab998Cb3448ad281C116c9fC9e4b01e4533beD';
        const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
        
        console.log(`📋 Registry: ${REGISTRY_ADDRESS}\n`);
        
        // Check Bitcoin testnet chain ID 40004
        const BITCOIN_TESTNET_ID = 40004;
        
        console.log('🔍 Checking Bitcoin Testnet (Chain ID 40004):');
        
        const isSupported = await registry.isChainSupported(BITCOIN_TESTNET_ID);
        console.log(`   Supported: ${isSupported ? '✅ YES' : '❌ NO'}`);
        
        if (isSupported) {
            const adapterAddress = await registry.getChainAdapter(BITCOIN_TESTNET_ID);
            console.log(`   Adapter: ${adapterAddress}`);
            console.log(`   Etherscan: https://sepolia.etherscan.io/address/${adapterAddress}`);
        }
        
        // Get all supported chains
        console.log('\n📋 All Supported Chains:');
        const supportedChains = await registry.getSupportedChains();
        
        for (const chainId of supportedChains) {
            const adapter = await registry.getChainAdapter(chainId);
            const chainName = getChainName(Number(chainId));
            console.log(`   ${chainId}: ${chainName} → ${adapter}`);
        }
        
        console.log('\n💡 Summary:');
        if (isSupported) {
            console.log('✅ Bitcoin testnet is registered and ready for orders');
        } else {
            console.log('❌ Bitcoin testnet is NOT registered');
            console.log('📝 Bitcoin adapter needs to be registered with CrossChainRegistry');
            console.log('🔧 Expected adapter address: 0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8');
        }
        
        return { isSupported, supportedChains };
        
    } catch (error) {
        console.error('❌ Failed to check registration:', error.message);
        return null;
    }
}

function getChainName(chainId) {
    const chains = {
        40001: 'NEAR Mainnet',
        40002: 'NEAR Testnet', 
        40003: 'Bitcoin Mainnet',
        40004: 'Bitcoin Testnet',
        40005: 'Dogecoin',
        40006: 'Litecoin',
        40007: 'Bitcoin Cash'
    };
    return chains[chainId] || `Unknown (${chainId})`;
}

if (require.main === module) {
    checkBitcoinRegistration().then(result => {
        process.exit(result ? 0 : 1);
    });
}

module.exports = { checkBitcoinRegistration };