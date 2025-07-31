#!/usr/bin/env node

/**
 * Check Factory Registry Configurations
 * 
 * Compares registry configurations between old and new factories
 */

const { ethers } = require('ethers');

const FACTORY_ABI = [
    "function registry() external view returns (address)"
];

const REGISTRY_ABI = [
    "function isChainSupported(uint256) external view returns (bool)",
    "function getChainAdapter(uint256) external view returns (address)",
    "function getSupportedChains() external view returns (uint256[])",
    "function owner() external view returns (address)"
];

async function checkFactoryRegistries() {
    console.log('🔍 Check Factory Registry Configurations');
    console.log('======================================\n');
    
    try {
        const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu');
        
        const factories = [
            { name: 'Old Factory (NEAR working)', address: '0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a' },
            { name: 'New Factory (Bitcoin support)', address: '0xbeEab741D2869404FcB747057f5AbdEffc3A138d' }
        ];
        
        const chains = [
            { name: 'NEAR Mainnet', id: 40001 },
            { name: 'NEAR Testnet', id: 40002 },
            { name: 'Bitcoin Mainnet', id: 40003 },
            { name: 'Bitcoin Testnet', id: 40004 }
        ];
        
        for (const factory of factories) {
            console.log(`🏭 ${factory.name}`);
            console.log(`   Address: ${factory.address}`);
            
            const factoryContract = new ethers.Contract(factory.address, FACTORY_ABI, provider);
            
            try {
                const registryAddress = await factoryContract.registry();
                console.log(`   Registry: ${registryAddress}`);
                
                const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
                
                // Check registry owner
                try {
                    const owner = await registry.owner();
                    console.log(`   Registry Owner: ${owner}`);
                } catch (ownerError) {
                    console.log(`   Registry Owner: Unknown (${ownerError.message})`);
                }
                
                // Check chain support
                console.log('   Chain Support:');
                for (const chain of chains) {
                    try {
                        const isSupported = await registry.isChainSupported(chain.id);
                        console.log(`     ${chain.name} (${chain.id}): ${isSupported ? '✅' : '❌'}`);
                        
                        if (isSupported) {
                            try {
                                const adapter = await registry.getChainAdapter(chain.id);
                                console.log(`       Adapter: ${adapter}`);
                            } catch (adapterError) {
                                console.log(`       Adapter: Failed (${adapterError.message})`);
                            }
                        }
                    } catch (supportError) {
                        console.log(`     ${chain.name} (${chain.id}): Error (${supportError.message})`);
                    }
                }
                
                // Try to get all supported chains
                try {
                    const supportedChains = await registry.getSupportedChains();
                    console.log(`   All supported chains: [${supportedChains.join(', ')}]`);
                } catch (allChainsError) {
                    console.log(`   All supported chains: Failed (${allChainsError.message})`);
                }
                
            } catch (registryError) {
                console.log(`   ❌ Registry access failed: ${registryError.message}`);
            }
            
            console.log('');
        }
        
        // Direct check on the Bitcoin adapter
        console.log('🔍 Direct Bitcoin Adapter Check');
        const BITCOIN_ADAPTER = '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8';
        console.log(`   Bitcoin Adapter: ${BITCOIN_ADAPTER}`);
        
        // Check if adapter exists
        const code = await provider.getCode(BITCOIN_ADAPTER);
        console.log(`   Has Code: ${code !== '0x' ? '✅' : '❌'}`);
        
        if (code !== '0x') {
            console.log(`   Code Length: ${code.length} chars`);
            
            // Try basic adapter functions
            const ADAPTER_ABI = [
                "function validateDestinationAddress(bytes) external pure returns (bool)",
                "function chainId() external view returns (uint256)"
            ];
            
            try {
                const adapter = new ethers.Contract(BITCOIN_ADAPTER, ADAPTER_ABI, provider);
                
                const chainId = await adapter.chainId();
                console.log(`   Chain ID: ${chainId}`);
                
                const testAddress = 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc';
                const isValid = await adapter.validateDestinationAddress(ethers.toUtf8Bytes(testAddress));
                console.log(`   Address Validation: ${isValid ? '✅' : '❌'}`);
                
            } catch (adapterError) {
                console.log(`   Adapter functions failed: ${adapterError.message}`);
            }
        }
        
        return true;
        
    } catch (error) {
        console.error(`❌ Check failed: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    checkFactoryRegistries().then(success => {
        console.log(`\nResult: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { checkFactoryRegistries };