#!/usr/bin/env node

/**
 * Simple configuration test for the Bitcoin relayer service
 */

const { loadConfig } = require('./dist/config/config');

async function testConfig() {
    console.log('🔧 Testing relayer configuration...');
    
    try {
        const config = await loadConfig();
        
        console.log('✅ Configuration loaded successfully');
        console.log(`📱 Networks: ${config.networks.join(', ')}`);
        console.log(`🌐 Ethereum: ${config.ethereum.name} (${config.ethereum.chainId})`);
        console.log(`🔗 Factory: ${config.ethereum.contracts.factory}`);
        console.log(`📋 Registry: ${config.ethereum.contracts.registry}`);
        console.log(`🪙 Token: ${config.ethereum.contracts.token}`);
        console.log(`🌙 NEAR: ${config.near.name} (${config.near.chainId})`);
        console.log(`📝 NEAR Contract: ${config.near.contracts.factory}`);
        console.log(`₿ Bitcoin Network: ${config.bitcoin.network}`);
        console.log(`⚡ Bitcoin Fee Rate: ${config.bitcoin.feeRate} sat/byte`);
        console.log(`💰 Wallet Ethereum: ${config.wallet.ethereum.address}`);
        console.log(`🔑 Wallet NEAR: ${config.wallet.near.accountId}`);
        console.log(`⏰ Loop Interval: ${config.execution.loopInterval}ms`);
        
        console.log('\n🎉 Configuration test passed!');
        return true;
    } catch (error) {
        console.error('❌ Configuration test failed:', error.message);
        return false;
    }
}

if (require.main === module) {
    testConfig().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testConfig };