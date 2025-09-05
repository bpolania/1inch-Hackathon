/**
 * Ethereum Event Monitor
 * 
 * Monitors Ethereum events for secret revelation in 1inch Fusion+ orders
 * Used by Bitcoin executor to detect when secrets are revealed for claiming
 */

import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { Config } from '../config/config';
import { logger } from '../utils/logger';

export interface SecretRevealedEvent {
    orderHash: string;
    secret: string;
    transactionHash: string;
    blockNumber: number;
}

export class EthereumEventMonitor extends EventEmitter {
    private provider: ethers.JsonRpcProvider;
    private factoryContract: ethers.Contract;
    private config: Config;
    private isMonitoring: boolean = false;
    private monitoredOrders: Set<string> = new Set();

    // 1inch Fusion+ Factory ABI for order completion events
    private readonly FACTORY_ABI = [
        "event OrderCompleted(bytes32 indexed orderHash, bytes32 secret, address indexed resolver)",
        "event OrderFilled(bytes32 indexed orderHash, uint256 makingAmount, uint256 takingAmount)",
        "function getOrder(bytes32 orderHash) view returns (tuple(bool isActive, uint256 expiryTime, bytes32 hashlock, address maker, address resolver))"
    ];

    constructor(config: Config) {
        super();
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
        this.factoryContract = new ethers.Contract(
            config.ethereum.contracts.factory,
            this.FACTORY_ABI,
            this.provider
        );
    }

    /**
     * Start monitoring Ethereum events
     */
    async startMonitoring(): Promise<void> {
        if (this.isMonitoring) {
            logger.warn(' Event monitoring already running');
            return;
        }

        try {
            logger.info(' Starting Ethereum event monitoring...');
            
            // Listen for order completion events
            this.factoryContract.on('OrderCompleted', this.handleOrderCompleted.bind(this));
            this.factoryContract.on('OrderFilled', this.handleOrderFilled.bind(this));
            
            this.isMonitoring = true;
            logger.info(' Ethereum event monitoring started');
            
        } catch (error) {
            logger.error(' Failed to start event monitoring:', error);
            throw error;
        }
    }

    /**
     * Stop monitoring Ethereum events
     */
    async stopMonitoring(): Promise<void> {
        if (!this.isMonitoring) {
            return;
        }

        try {
            logger.info(' Stopping Ethereum event monitoring...');
            
            this.factoryContract.removeAllListeners();
            this.isMonitoring = false;
            
            logger.info(' Ethereum event monitoring stopped');
            
        } catch (error) {
            logger.error(' Failed to stop event monitoring:', error);
        }
    }

    /**
     * Add order to monitoring list
     */
    monitorOrder(orderHash: string): void {
        this.monitoredOrders.add(orderHash);
        logger.info(` Added order to monitoring: ${orderHash}`);
    }

    /**
     * Remove order from monitoring list
     */
    stopMonitoringOrder(orderHash: string): void {
        this.monitoredOrders.delete(orderHash);
        logger.info(` Removed order from monitoring: ${orderHash}`);
    }

    /**
     * Handle OrderCompleted event - secret is revealed here
     */
    private async handleOrderCompleted(orderHash: string, secret: string, resolver: string, event: any): Promise<void> {
        try {
            // Only process orders we're monitoring
            if (!this.monitoredOrders.has(orderHash)) {
                return;
            }

            logger.info(` Secret revealed for order ${orderHash}:`, {
                secret: secret,
                resolver: resolver,
                txHash: event.transactionHash,
                blockNumber: event.blockNumber
            });

            const secretEvent: SecretRevealedEvent = {
                orderHash,
                secret,
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber
            };

            // Emit event for Bitcoin executor to claim
            this.emit('secretRevealed', secretEvent);
            
            // Remove from monitoring once processed
            this.stopMonitoringOrder(orderHash);
            
        } catch (error) {
            logger.error(` Failed to handle OrderCompleted event:`, error);
        }
    }

    /**
     * Handle OrderFilled event - useful for monitoring
     */
    private async handleOrderFilled(orderHash: string, makingAmount: bigint, takingAmount: bigint, event: any): Promise<void> {
        try {
            // Only process orders we're monitoring
            if (!this.monitoredOrders.has(orderHash)) {
                return;
            }

            logger.info(` Order filled: ${orderHash}`, {
                makingAmount: ethers.formatEther(makingAmount),
                takingAmount: ethers.formatEther(takingAmount),
                txHash: event.transactionHash
            });

            this.emit('orderFilled', {
                orderHash,
                makingAmount,
                takingAmount,
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber
            });
            
        } catch (error) {
            logger.error(` Failed to handle OrderFilled event:`, error);
        }
    }

    /**
     * Get order status from contract
     */
    async getOrderStatus(orderHash: string): Promise<{
        isActive: boolean;
        expiryTime: number;
        hashlock: string;
        maker: string;
        resolver: string;
    } | null> {
        try {
            const order = await this.factoryContract.getOrder(orderHash);
            return {
                isActive: order.isActive,
                expiryTime: Number(order.expiryTime),
                hashlock: order.hashlock,
                maker: order.maker,
                resolver: order.resolver
            };
        } catch (error) {
            logger.error(` Failed to get order status for ${orderHash}:`, error);
            return null;
        }
    }

    /**
     * Check if monitoring is active
     */
    isActive(): boolean {
        return this.isMonitoring;
    }

    /**
     * Get list of monitored orders
     */
    getMonitoredOrders(): string[] {
        return Array.from(this.monitoredOrders);
    }
}