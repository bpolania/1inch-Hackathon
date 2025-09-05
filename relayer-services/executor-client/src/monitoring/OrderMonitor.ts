/**
 * Order Monitor - Automated Order Detection
 * 
 * This component monitors the Ethereum blockchain for new Fusion+ orders
 * and tracks their lifecycle. It essentially automates what we were doing
 * manually by checking for new orders.
 */

import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { WalletManager } from '../wallet/WalletManager';
import { Config } from '../config/config';
import { logger } from '../utils/logger';

export interface Order {
    orderHash: string;
    maker: string;
    sourceToken: string;
    sourceAmount: bigint;
    destinationChainId: number;
    destinationToken: string;
    destinationAmount: bigint;
    resolverFeeAmount: bigint;
    expiryTime: number;
    hashlock: string;
    isActive: boolean;
    blockNumber: number;
    transactionHash: string;
}

export class OrderMonitor extends EventEmitter {
    private config: Config;
    private walletManager: WalletManager;
    private ethereumProvider!: ethers.Provider;
    private factoryContract!: ethers.Contract;
    private isMonitoring: boolean = false;
    private lastProcessedBlock: number = 0;
    private knownOrders: Set<string> = new Set();

    // Events this monitor emits:
    // 'newOrder' - when a new order is created
    // 'orderUpdate' - when an order status changes
    // 'orderMatched' - when an order is matched by a resolver
    // 'orderCompleted' - when an order is completed
    // 'orderCancelled' - when an order is cancelled

    constructor(config: Config, walletManager: WalletManager) {
        super();
        this.config = config;
        this.walletManager = walletManager;
    }

    async initialize(): Promise<void> {
        logger.info(' Initializing Order Monitor...');

        // Get Ethereum provider from wallet manager
        this.ethereumProvider = this.walletManager.getEthereumProvider();

        // Connect to factory contract
        const factoryAddress = this.config.ethereum.contracts.factory!;
        
        // Factory ABI (corrected to match actual contract)
        const factoryABI = [
            'event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, address sourceToken, uint256 sourceAmount, uint256 destinationChainId, bytes destinationToken, uint256 destinationAmount, bytes destinationAddress, uint256 resolverFeeAmount, uint256 expiryTime, bytes32 hashlock)',
            'event FusionOrderMatched(bytes32 indexed orderHash, address indexed resolver, address sourceEscrow, address destinationEscrow, bytes32 hashlock, uint256 safetyDeposit)',
            'event FusionOrderCompleted(bytes32 indexed orderHash, address indexed resolver, bytes32 secret)',
            'event FusionOrderCancelled(bytes32 indexed orderHash, address indexed maker)',
            'function getOrder(bytes32 orderHash) view returns (tuple(bytes32 orderHash, address maker, address sourceToken, uint256 sourceAmount, uint256 destinationChainId, bytes destinationToken, uint256 destinationAmount, bytes destinationAddress, uint256 resolverFeeAmount, uint256 expiryTime, bytes chainSpecificParams, bool isActive))',
            'function totalOrdersCreated() view returns (uint256)'
        ];

        this.factoryContract = new ethers.Contract(factoryAddress, factoryABI, this.ethereumProvider);

        // Get the current block number to start monitoring from
        this.lastProcessedBlock = await this.ethereumProvider!.getBlockNumber();
        logger.info(` Starting monitoring from block ${this.lastProcessedBlock}`);

        logger.info(' Order Monitor initialized');
    }

    async start(): Promise<void> {
        if (this.isMonitoring) {
            logger.warn(' Order monitor is already running');
            return;
        }

        this.isMonitoring = true;
        logger.info(' Starting order monitoring...');

        // Set up event listeners for real-time monitoring
        this.setupEventListeners();

        // Start periodic scanning for missed events
        this.startPeriodicScan();

        // Load any existing orders we might have missed
        await this.loadExistingOrders();
    }

    async stop(): Promise<void> {
        if (!this.isMonitoring) {
            return;
        }

        logger.info(' Stopping order monitor...');
        this.isMonitoring = false;

        // Remove all event listeners
        this.factoryContract!.removeAllListeners();

        logger.info(' Order monitor stopped');
    }

    private setupEventListeners(): void {
        // Listen for new order creation (corrected parameters)
        this.factoryContract!.on('FusionOrderCreated', async (orderHash: string, maker: string, sourceToken: string, sourceAmount: bigint, destinationChainId: number, destinationToken: string, destinationAmount: bigint, destinationAddress: string, resolverFeeAmount: bigint, expiryTime: number, hashlock: string, event: any) => {
            try {
                logger.info(` New order detected: ${orderHash}`);
                logger.info(`   Source: ${ethers.formatEther(sourceAmount)} tokens  Chain ${destinationChainId}`);
                logger.info(`   Resolver Fee: ${ethers.formatEther(resolverFeeAmount)} tokens`);
                
                const order = await this.fetchOrderDetails(orderHash, event, hashlock);
                
                if (order && !this.knownOrders.has(orderHash)) {
                    this.knownOrders.add(orderHash);
                    this.emit('newOrder', order);
                }
            } catch (error) {
                logger.error(` Error processing new order ${orderHash}:`, error);
            }
        });

        // Listen for order matching
        this.factoryContract!.on('FusionOrderMatched', async (orderHash: string, resolver: string, safetyDeposit: bigint, event: any) => {
            try {
                logger.info(` Order matched: ${orderHash} by resolver ${resolver}`);
                this.emit('orderUpdate', orderHash, {
                    status: 'matched',
                    resolver,
                    safetyDeposit: safetyDeposit.toString(),
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash
                });
            } catch (error) {
                logger.error(` Error processing order match ${orderHash}:`, error);
            }
        });

        // Listen for order completion
        this.factoryContract!.on('FusionOrderCompleted', async (orderHash: string, secret: string, event: any) => {
            try {
                logger.info(` Order completed: ${orderHash}`);
                this.emit('orderUpdate', orderHash, {
                    status: 'completed',
                    secret,
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash
                });

                // Remove from active monitoring
                this.knownOrders.delete(orderHash);
            } catch (error) {
                logger.error(` Error processing order completion ${orderHash}:`, error);
            }
        });

        // Listen for order cancellation
        this.factoryContract!.on('FusionOrderCancelled', async (orderHash: string, reason: string, event: any) => {
            try {
                logger.info(` Order cancelled: ${orderHash} - ${reason}`);
                this.emit('orderUpdate', orderHash, {
                    status: 'cancelled',
                    reason,
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash
                });

                // Remove from active monitoring
                this.knownOrders.delete(orderHash);
            } catch (error) {
                logger.error(` Error processing order cancellation ${orderHash}:`, error);
            }
        });
    }

    private async startPeriodicScan(): Promise<void> {
        // Scan for events every 30 seconds as backup to real-time listening
        const scanInterval = 30000; // 30 seconds

        const scan = async () => {
            if (!this.isMonitoring) return;

            try {
                await this.scanForMissedEvents();
            } catch (error) {
                logger.error(' Error in periodic scan:', error);
            }

            if (this.isMonitoring) {
                setTimeout(scan, scanInterval);
            }
        };

        // Start scanning after a short delay
        setTimeout(scan, scanInterval);
    }

    private async scanForMissedEvents(): Promise<void> {
        const currentBlock = await this.ethereumProvider!.getBlockNumber();
        
        if (currentBlock <= this.lastProcessedBlock) {
            return; // No new blocks
        }

        logger.debug(` Scanning blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`);

        try {
            // Query for FusionOrderCreated events
            const filter = this.factoryContract!.filters.FusionOrderCreated();
            const events = await this.factoryContract!.queryFilter(filter, this.lastProcessedBlock + 1, currentBlock);

            for (const event of events) {
                const [orderHash, maker, sourceToken, sourceAmount, destinationChainId, destinationToken, destinationAmount, destinationAddress, resolverFeeAmount, expiryTime, hashlock] = (event as ethers.EventLog).args;
                
                if (!this.knownOrders.has(orderHash)) {
                    logger.info(` Found missed order: ${orderHash}`);
                    const order = await this.fetchOrderDetails(orderHash, event, hashlock);
                    
                    if (order) {
                        this.knownOrders.add(orderHash);
                        this.emit('newOrder', order);
                    }
                }
            }

            this.lastProcessedBlock = currentBlock;
            
        } catch (error) {
            logger.error(' Error scanning for missed events:', error);
        }
    }

    private async fetchOrderDetails(orderHash: string, event: any, hashlock?: string): Promise<Order | null> {
        try {
            // Get order details from contract
            const orderData = await this.factoryContract!.getOrder(orderHash);
            
            const order: Order = {
                orderHash,
                maker: orderData.maker,
                sourceToken: orderData.sourceToken,
                sourceAmount: orderData.sourceAmount,
                destinationChainId: Number(orderData.destinationChainId),
                destinationToken: orderData.destinationToken,
                destinationAmount: orderData.destinationAmount,
                resolverFeeAmount: orderData.resolverFeeAmount,
                expiryTime: Number(orderData.expiryTime),
                hashlock: hashlock || '', // Use hashlock from event parameter
                isActive: orderData.isActive,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            };

            return order;
            
        } catch (error) {
            logger.error(` Error fetching order details for ${orderHash}:`, error);
            return null;
        }
    }

    private async loadExistingOrders(): Promise<void> {
        try {
            logger.info(' Loading existing orders...');
            
            // Get total orders created
            const totalOrders = await this.factoryContract!.totalOrdersCreated();
            logger.info(` Total orders in system: ${totalOrders}`);

            // For now, we'll just start fresh
            // In a production system, we might want to load recent active orders
            logger.info(' Starting with fresh monitoring (existing orders will be picked up as they get updated)');
            
        } catch (error) {
            logger.error(' Error loading existing orders:', error);
        }
    }

    // Public methods for status and control
    public getStatus(): object {
        return {
            isMonitoring: this.isMonitoring,
            lastProcessedBlock: this.lastProcessedBlock,
            knownOrdersCount: this.knownOrders.size,
            contractAddress: this.config.ethereum.contracts.factory
        };
    }

    public getKnownOrders(): string[] {
        return Array.from(this.knownOrders);
    }
}