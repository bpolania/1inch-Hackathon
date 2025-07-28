/**
 * Status CLI Tool
 * 
 * Command-line tool to check the status of the automated relayer
 * without starting the full service.
 */

import { loadConfig } from '../config/config';
import { WalletManager } from '../wallet/WalletManager';
import { logger } from '../utils/logger';

async function main() {
    try {
        console.log('🔍 1inch Fusion+ NEAR Relayer - Status Check');
        console.log('===========================================\n');

        // Load configuration
        const config = await loadConfig();
        console.log(`📋 Configuration loaded for networks: ${config.networks.join(', ')}\n`);

        // Initialize wallet manager
        const walletManager = new WalletManager(config);
        await walletManager.initialize();

        // Get detailed status
        const status = await walletManager.getDetailedStatus();
        
        console.log('💼 Wallet Status:');
        console.log('================');
        console.log(`Ethereum Address: ${(status as any).ethereum.address}`);
        console.log(`Ethereum Network: ${(status as any).ethereum.network} (Chain ID: ${(status as any).ethereum.chainId})`);
        console.log(`Ethereum Balance: ${(status as any).balances.ethereum.balance} (${(status as any).balances.ethereum.sufficient ? '✅ Sufficient' : '❌ Insufficient'})`);
        console.log();
        console.log(`NEAR Account: ${(status as any).near.accountId}`);
        console.log(`NEAR Network: ${(status as any).near.networkId}`);
        console.log(`NEAR Balance: ${(status as any).balances.near.balance} NEAR (${(status as any).balances.near.sufficient ? '✅ Sufficient' : '❌ Insufficient'})`);
        console.log();

        // Contract status
        console.log('📄 Contract Configuration:');
        console.log('=========================');
        console.log(`Factory Contract: ${config.ethereum.contracts.factory}`);
        console.log(`Registry Contract: ${config.ethereum.contracts.registry}`);
        console.log(`Token Contract: ${config.ethereum.contracts.token}`);
        console.log(`NEAR Contract: ${config.near.contracts.factory}`);
        console.log();

        // Execution configuration
        console.log('⚙️  Execution Configuration:');
        console.log('===========================');
        console.log(`Loop Interval: ${config.execution.loopInterval}ms`);
        console.log(`Min Profit Threshold: ${config.execution.minProfitThreshold} ETH`);
        console.log(`Max Gas Price: ${config.execution.maxGasPrice} gwei`);
        console.log(`Max Concurrent Executions: ${config.execution.maxConcurrentExecutions}`);
        console.log();

        // Ready status
        console.log('🚀 Readiness Status:');
        console.log('===================');
        if ((status as any).readyForExecution) {
            console.log('✅ Ready for automated execution');
            console.log('   All wallets have sufficient balances');
            console.log('   Configuration is valid');
            console.log();
            console.log('💡 To start the automated relayer:');
            console.log('   npm run dev');
        } else {
            console.log('❌ Not ready for execution');
            if (!(status as any).balances.ethereum.sufficient) {
                console.log('   ⚠️  Insufficient Ethereum balance for gas fees');
            }
            if (!(status as any).balances.near.sufficient) {
                console.log('   ⚠️  Insufficient NEAR balance for operations');
            }
            console.log();
            console.log('💡 Please fund your wallets before starting the relayer');
        }

    } catch (error) {
        console.error('💥 Status check failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}