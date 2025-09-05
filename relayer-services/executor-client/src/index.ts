/**
 * 1inch Fusion+ NEAR Extension - Automated Relayer Service
 * 
 * This service automates the cross-chain atomic swap execution that was
 * previously done manually via scripts. It continuously monitors for new
 * orders and executes profitable swaps automatically.
 */

import { ExecutorEngine } from './core/ExecutorEngine';
import { logger } from './utils/logger';
import { loadConfig } from './config/config';

async function main() {
    try {
        logger.info(' Starting 1inch Fusion+ NEAR Relayer Service');
        
        // Load configuration
        const config = await loadConfig();
        logger.info(` Configuration loaded for networks: ${config.networks.join(', ')}`);
        
        // Initialize executor engine
        const executor = new ExecutorEngine(config);
        await executor.initialize();
        
        logger.info(' Executor engine initialized successfully');
        logger.info(' Starting automated order monitoring and execution...');
        logger.info(' Monitoring for profitable atomic swap opportunities');
        
        // Start automated execution loop
        await executor.start();
        
    } catch (error) {
        logger.error(' Failed to start relayer service:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info(' Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info(' Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Start the service
if (require.main === module) {
    main().catch((error) => {
        logger.error(' Unhandled error in main:', error);
        process.exit(1);
    });
}

export { main };