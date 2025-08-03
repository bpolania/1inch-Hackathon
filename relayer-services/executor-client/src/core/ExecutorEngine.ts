/**
 * Core Executor Engine - Automated Cross-Chain Atomic Swap Execution
 * 
 * This is the heart of the automated relayer. It wraps the functionality from
 * our manual scripts into a continuous monitoring and execution service.
 */

import { ethers } from 'ethers';
import { OrderMonitor } from '../monitoring/OrderMonitor';
import { ProfitabilityAnalyzer } from '../analysis/ProfitabilityAnalyzer';
import { CrossChainExecutor } from '../execution/CrossChainExecutor';
import { WalletManager } from '../wallet/WalletManager';
import { logger } from '../utils/logger';
import { Config } from '../config/config';

export interface ExecutableOrder {
    orderHash: string;
    order: any;
    executionParams?: any; // Bitcoin execution parameters (if destination is Bitcoin)
    chainSpecificParams?: string; // Chain-specific execution parameters (JSON string)
    profitability: {
        estimatedProfit: bigint;
        gasEstimate: bigint;
        safetyDeposit: bigint;
        isProfitable: boolean;
    };
    priority: number;
}

export class ExecutorEngine {
    private orderMonitor: OrderMonitor;
    private profitabilityAnalyzer: ProfitabilityAnalyzer;
    private crossChainExecutor: CrossChainExecutor;
    private walletManager: WalletManager;
    private isRunning: boolean = false;
    private executionQueue: ExecutableOrder[] = [];
    private config: Config;

    constructor(config: Config) {
        this.config = config;
        this.walletManager = new WalletManager(config);
        this.orderMonitor = new OrderMonitor(config, this.walletManager);
        this.profitabilityAnalyzer = new ProfitabilityAnalyzer(config);
        this.crossChainExecutor = new CrossChainExecutor(config, this.walletManager);
    }

    async initialize(): Promise<void> {
        logger.info('🔧 Initializing Executor Engine components...');
        
        // Initialize wallet manager (loads private keys, connects to networks)
        await this.walletManager.initialize();
        logger.info('💼 Wallet manager initialized');
        
        // Initialize order monitoring
        await this.orderMonitor.initialize();
        logger.info('🕵️ Order monitor initialized');
        
        // Initialize profitability analyzer
        await this.profitabilityAnalyzer.initialize();
        logger.info('📊 Profitability analyzer initialized');
        
        // Initialize cross-chain executor
        await this.crossChainExecutor.initialize();
        logger.info('⚡ Cross-chain executor initialized');
        
        // Setup event listeners
        this.setupEventListeners();
        
        logger.info('✅ All components initialized successfully');
    }

    private setupEventListeners(): void {
        // Listen for new orders
        this.orderMonitor.on('newOrder', async (order) => {
            await this.handleNewOrder(order);
        });

        // Listen for order updates
        this.orderMonitor.on('orderUpdate', async (orderHash, update) => {
            await this.handleOrderUpdate(orderHash, update);
        });

        // Listen for execution results
        this.crossChainExecutor.on('executionComplete', async (result) => {
            await this.handleExecutionComplete(result);
        });

        // Listen for execution failures
        this.crossChainExecutor.on('executionFailed', async (error) => {
            await this.handleExecutionFailed(error);
        });
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('⚠️ Executor engine is already running');
            return;
        }

        this.isRunning = true;
        logger.info('🎯 Starting automated execution loop');

        // Start order monitoring
        await this.orderMonitor.start();

        // Start main execution loop
        this.startExecutionLoop();
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        logger.info('🛑 Stopping executor engine...');
        this.isRunning = false;

        // Stop order monitoring
        await this.orderMonitor.stop();

        // Cancel any pending executions
        this.executionQueue = [];

        logger.info('✅ Executor engine stopped');
    }

    private async startExecutionLoop(): Promise<void> {
        logger.info('🔄 Starting continuous execution loop');

        while (this.isRunning) {
            try {
                await this.processExecutionQueue();
                
                // Wait before next iteration (configurable interval)
                await this.sleep(this.config.execution.loopInterval || 10000); // 10 seconds default
                
            } catch (error) {
                logger.error('💥 Error in execution loop:', error);
                await this.sleep(5000); // Wait 5 seconds on error before retrying
            }
        }
    }

    private async processExecutionQueue(): Promise<void> {
        if (this.executionQueue.length === 0) {
            return;
        }

        // Sort by priority (highest first)
        this.executionQueue.sort((a, b) => b.priority - a.priority);

        const order = this.executionQueue.shift();
        if (!order) return;

        logger.info(`🎯 Processing order ${order.orderHash}`);
        logger.info(`💰 Estimated profit: ${ethers.formatEther(order.profitability.estimatedProfit)} ETH`);

        try {
            // Execute the cross-chain atomic swap
            const result = await this.crossChainExecutor.executeAtomicSwap(order);
            
            if (result.success) {
                logger.info(`✅ Successfully executed atomic swap for order ${order.orderHash}`);
                logger.info(`💰 Actual profit: ${ethers.formatEther(result.actualProfit)} ETH`);
            } else {
                logger.error(`❌ Failed to execute atomic swap for order ${order.orderHash}:`, result.error);
            }
            
        } catch (error) {
            logger.error(`💥 Execution error for order ${order.orderHash}:`, error);
        }
    }

    private async handleNewOrder(order: any): Promise<void> {
        logger.info(`🆕 New order detected: ${order.orderHash}`);

        try {
            // Analyze profitability
            const profitability = await this.profitabilityAnalyzer.analyzeOrder(order);
            
            if (!profitability.isProfitable) {
                logger.info(`📉 Order ${order.orderHash} not profitable, skipping`);
                return;
            }

            // Calculate priority (higher profit = higher priority)
            const priority = Number(profitability.estimatedProfit) / 1e18; // Convert to ETH for priority

            const executableOrder: ExecutableOrder = {
                orderHash: order.orderHash,
                order,
                profitability,
                priority
            };

            // Add to execution queue
            this.executionQueue.push(executableOrder);
            
            logger.info(`✅ Added profitable order ${order.orderHash} to execution queue`);
            logger.info(`💰 Estimated profit: ${ethers.formatEther(profitability.estimatedProfit)} ETH`);
            
        } catch (error) {
            logger.error(`💥 Error analyzing order ${order.orderHash}:`, error);
        }
    }

    private async handleOrderUpdate(orderHash: string, update: any): Promise<void> {
        logger.info(`📝 Order update for ${orderHash}:`, update);
        
        // Remove from queue if order is no longer valid
        if (update.status === 'completed' || update.status === 'cancelled') {
            this.executionQueue = this.executionQueue.filter(o => o.orderHash !== orderHash);
            logger.info(`🗑️ Removed ${orderHash} from execution queue (${update.status})`);
        }
    }

    private async handleExecutionComplete(result: any): Promise<void> {
        logger.info(`🎉 Execution completed successfully:`, result);
        
        // Log metrics, update stats, etc.
        // This could feed into a dashboard or monitoring system
    }

    private async handleExecutionFailed(error: any): Promise<void> {
        logger.error(`💥 Execution failed:`, error);
        
        // Log error metrics, send alerts, etc.
        // This could trigger notifications to operators
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public getters for monitoring
    public getQueueLength(): number {
        return this.executionQueue.length;
    }

    public isExecutorRunning(): boolean {
        return this.isRunning;
    }

    public getStatus(): object {
        return {
            isRunning: this.isRunning,
            queueLength: this.executionQueue.length,
            walletStatus: this.walletManager.getStatus(),
            monitorStatus: this.orderMonitor.getStatus()
        };
    }
}