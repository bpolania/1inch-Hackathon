/**
 * Bitcoin Executor - Bitcoin-side atomic swap execution
 * 
 * This component handles Bitcoin HTLC creation and execution for cross-chain
 * atomic swaps with Ethereum using 1inch Fusion+ compatible hashlock/timelock mechanism.
 * 
 * Integrates with our BitcoinHTLCManager implementation from contracts/bitcoin/
 */

import { EventEmitter } from 'events';
import { Config } from '../config/config';
import { logger } from '../utils/logger';
import { ExecutableOrder } from '../core/ExecutorEngine';
import { EthereumEventMonitor } from '../monitoring/EthereumEventMonitor';
import { BitcoinUTXOManager } from '../utils/BitcoinUTXOManager';
import { OrderContextStore, OrderContext } from '../utils/OrderContextStore';
import { RefundManager } from '../utils/RefundManager';

// Import our Bitcoin HTLC implementation
const BitcoinHTLCManager = require('../../../../contracts/bitcoin/src/BitcoinHTLCManager');
const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').default;
const tinysecp = require('tiny-secp256k1');

// Initialize ECPair
bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

export interface BitcoinExecutionResult {
    success: boolean;
    orderHash: string;
    htlcAddress?: string;
    htlcScript?: string;
    fundingTxId?: string;
    claimingTxId?: string;
    transactions: string[];
    error?: string;
    gasUsed?: number;
    executionTime: number;
}

export interface BitcoinExecutionParams {
    btcAddress: string;
    htlcTimelock: number;
    feeRate: number;
}

export class BitcoinExecutor extends EventEmitter {
    private config: Config;
    private btcManager: any; // BitcoinHTLCManager instance
    private utxoManager: BitcoinUTXOManager;
    private orderStore: OrderContextStore;
    private refundManager: RefundManager;
    private keyPair: any; // Bitcoin key pair for resolver
    private changeAddress: string;
    private eventMonitor: EthereumEventMonitor;
    private initialized: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;

    constructor(config: Config) {
        super();
        this.config = config;
        this.eventMonitor = new EthereumEventMonitor(config);
        this.utxoManager = new BitcoinUTXOManager(config.bitcoin.network as 'mainnet' | 'testnet');
        this.orderStore = new OrderContextStore(config.dataDir || './data');
        this.refundManager = new RefundManager({
            network: config.bitcoin.network as 'mainnet' | 'testnet',
            apiUrl: config.bitcoin.apiUrl
        });
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            logger.warn('Bitcoin Executor already initialized');
            return;
        }

        logger.info(' Initializing Bitcoin Executor...');

        try {
            // Require Bitcoin private key for production mode
            if (!this.config.bitcoin.privateKey) {
                throw new Error('Bitcoin private key is required for automated execution');
            }

            // Initialize Bitcoin HTLC Manager
            const network = this.config.bitcoin.network === 'mainnet' 
                ? bitcoin.networks.bitcoin 
                : bitcoin.networks.testnet;

            this.btcManager = new BitcoinHTLCManager({
                network,
                feeRate: this.config.bitcoin.feeRate || 10,
                htlcTimelock: this.config.bitcoin.htlcTimelock || 144,
                apiBaseUrl: this.config.bitcoin.apiUrl || (
                    this.config.bitcoin.network === 'mainnet'
                        ? 'https://blockstream.info/api'
                        : 'https://blockstream.info/testnet/api'
                )
            });

            // Load resolver key pair from configuration
            this.keyPair = ECPair.fromWIF(this.config.bitcoin.privateKey, network);
            
            // Create change address for resolver
            const changePayment = bitcoin.payments.p2pkh({
                pubkey: Buffer.from(this.keyPair.publicKey),
                network
            });
            this.changeAddress = changePayment.address!;

            // Check Bitcoin wallet balance
            const balance = await this.utxoManager.getAvailableBalance(this.changeAddress);
            logger.info(` Bitcoin wallet balance: ${balance} satoshis`);
            
            if (balance < this.config.bitcoin.dustThreshold) {
                logger.warn(` Low Bitcoin balance: ${balance} satoshis. May not be able to execute swaps.`);
            }

            // Initialize Ethereum event monitoring
            await this.eventMonitor.startMonitoring();
            
            // Listen for secret revelation events
            this.eventMonitor.on('secretRevealed', this.handleSecretRevealed.bind(this));
            
            // Recover any pending orders from previous runs
            await this.recoverPendingOrders();

            // Start periodic monitoring for expired orders
            this.startPeriodicMonitoring();

            this.initialized = true;
            logger.info(' Bitcoin Executor initialized successfully');
            logger.info(` Network: ${this.config.bitcoin.network}`);
            logger.info(` Fee Rate: ${this.config.bitcoin.feeRate} sat/byte`);
            logger.info(` Resolver Address: ${this.changeAddress}`);
            logger.info(` Pending Orders: ${this.orderStore.getPending().length}`);

        } catch (error) {
            logger.error(' Failed to initialize Bitcoin Executor:', error);
            throw error;
        }
    }

    /**
     * Recover pending orders from previous runs
     */
    private async recoverPendingOrders(): Promise<void> {
        const pendingOrders = this.orderStore.getPending();
        
        for (const context of pendingOrders) {
            logger.info(` Recovering pending order ${context.orderHash} (status: ${context.status})`);
            
            // Re-register for monitoring if we're waiting for secret
            if (context.status === 'htlc_funded' && context.bitcoin?.fundingTxId) {
                this.eventMonitor.monitorOrder(context.orderHash);
            }
            
            // Check if order has expired
            const now = Math.floor(Date.now() / 1000);
            if (context.expiryTime && context.expiryTime < now) {
                logger.warn(` Order ${context.orderHash} has expired`);
                this.orderStore.updateStatus(context.orderHash, 'expired');
                
                // Handle expired orders with refund logic
                if (context.status === 'htlc_funded' && context.bitcoin?.fundingTxId) {
                    await this.handleExpiredOrder(context);
                }
            }
        }
    }

    /**
     * Execute Bitcoin side of cross-chain atomic swap
     */
    async executeOrder(order: ExecutableOrder): Promise<BitcoinExecutionResult> {
        const startTime = Date.now();
        logger.info(` Executing Bitcoin side for order ${order.orderHash}`);

        try {
            // Check if order already exists
            if (this.orderStore.has(order.orderHash)) {
                const existing = this.orderStore.get(order.orderHash);
                if (existing?.status === 'claimed' || existing?.status === 'failed') {
                    logger.warn(` Order ${order.orderHash} already processed (status: ${existing.status})`);
                    return {
                        success: false,
                        orderHash: order.orderHash,
                        transactions: [],
                        error: `Order already processed with status: ${existing.status}`,
                        executionTime: Date.now() - startTime
                    };
                }
            }

            // Store initial order context
            this.orderStore.set(order.orderHash, {
                orderHash: order.orderHash,
                chainId: order.order.chainId,
                maker: order.order.maker,
                srcToken: order.order.srcToken,
                srcAmount: order.order.srcAmount.toString(),
                dstChainId: order.order.dstChainId,
                dstExecutionParams: order.order.dstExecutionParams,
                expiryTime: order.order.expiryTime,
                hashlock: order.order.hashlock,
                status: 'pending'
            });

            // Decode Bitcoin execution parameters
            const params = this.decodeExecutionParams(order.order.dstExecutionParams);
            logger.info(` Bitcoin Parameters:`, {
                address: params.btcAddress,
                timelock: params.htlcTimelock,
                feeRate: params.feeRate
            });

            // Step 1: Generate HTLC script
            const currentHeight = await this.btcManager.getCurrentBlockHeight();
            const timelockHeight = currentHeight + params.htlcTimelock;

            // Use the recipient's address to derive their public key
            // In production, this would be provided in the execution params
            const recipientKeyPair = this.keyPair; // For now, use resolver's key

            const htlcScript = this.btcManager.generateHTLCScript(
                order.order.hashlock,     // Shared hashlock from Ethereum
                Buffer.from(recipientKeyPair.publicKey), // Recipient can claim with secret
                Buffer.from(this.keyPair.publicKey),     // Resolver can refund after timelock
                timelockHeight
            );

            const htlcAddress = this.btcManager.createHTLCAddress(htlcScript);
            
            logger.info(` HTLC Created:`, {
                address: htlcAddress,
                scriptLength: htlcScript.length,
                timelockHeight
            });

            // Update order context with HTLC info
            this.orderStore.updateBitcoinInfo(order.orderHash, {
                htlcAddress,
                htlcScript: htlcScript.toString('hex')
            });
            this.orderStore.updateStatus(order.orderHash, 'htlc_created');

            // Step 2: Fund HTLC with real Bitcoin
            const destinationAmount = Number(order.order.destinationAmount);
            const fundingTxId = await this.fundHTLC(
                htlcAddress,
                destinationAmount,
                params.feeRate
            );

            logger.info(` HTLC Funded: ${fundingTxId}`);

            // Update order context with funding info
            this.orderStore.updateBitcoinInfo(order.orderHash, {
                fundingTxId,
                fundingAmount: destinationAmount
            });
            this.orderStore.updateStatus(order.orderHash, 'htlc_funded');

            // Step 3: Monitor for secret revelation on Ethereum
            this.eventMonitor.monitorOrder(order.orderHash);

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                orderHash: order.orderHash,
                htlcAddress,
                htlcScript: htlcScript.toString('hex'),
                fundingTxId,
                transactions: [fundingTxId],
                executionTime
            };

        } catch (error) {
            logger.error(` Bitcoin execution failed for order ${order.orderHash}:`, error);
            
            // Update order status to failed
            this.orderStore.updateStatus(
                order.orderHash, 
                'failed', 
                error instanceof Error ? error.message : 'Unknown error'
            );

            return {
                success: false,
                orderHash: order.orderHash,
                transactions: [],
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime: Date.now() - startTime
            };
        }
    }

    /**
     * Retry wrapper for critical operations
     */
    private async retryOperation<T>(
        operation: () => Promise<T>,
        operationName: string,
        maxRetries: number = 3,
        delayMs: number = 5000
    ): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                logger.warn(`${operationName} attempt ${attempt}/${maxRetries} failed: ${error.message}`);
                
                if (attempt === maxRetries) {
                    logger.error(`${operationName} failed after ${maxRetries} attempts`);
                    throw error;
                }
                
                // Wait before retry with exponential backoff
                const delay = delayMs * Math.pow(2, attempt - 1);
                logger.info(`Retrying ${operationName} in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error(`Retry operation failed unexpectedly`);
    }

    /**
     * Fund Bitcoin HTLC address with real transaction
     */
    private async fundHTLC(
        htlcAddress: string,
        amount: number,
        feeRate: number
    ): Promise<string> {
        logger.info(` Funding HTLC ${htlcAddress} with ${amount} satoshis`);

        let utxos: any[] = [];
        try {
            // Get optimal fee rate if not specified
            if (!feeRate || feeRate < 1) {
                feeRate = await this.utxoManager.getCachedFeeRate();
            }

            // Select UTXOs for funding
            const result = await this.utxoManager.selectUTXOs(
                this.changeAddress,
                amount,
                feeRate
            );
            
            utxos = result.utxos;
            const { total, change } = result;

            logger.info(` Selected ${utxos.length} UTXOs: total=${total}, change=${change}`);

            // Create funding transaction
            const fundingTx = await this.btcManager.createFundingTransaction(
                utxos,
                htlcAddress,
                amount,
                this.changeAddress,
                this.keyPair
            );
            
            logger.info(` Funding transaction created, size: ${fundingTx.txHex.length / 2} bytes`);
            
            // Mark UTXOs as spent (optimistically)
            this.utxoManager.markUTXOsAsSpent(utxos);

            // Broadcast transaction to Bitcoin network with retry
            const txId = await this.retryOperation<string>(
                () => this.btcManager.broadcastTransaction(fundingTx.txHex),
                'Bitcoin transaction broadcast',
                this.config.execution.retryAttempts,
                this.config.execution.retryDelay
            );
            
            logger.info(` Bitcoin funding transaction broadcast: ${txId}`);
            logger.info(` View on explorer: https://blockstream.info/${this.config.bitcoin.network === 'testnet' ? 'testnet/' : ''}tx/${txId}`);
            
            // Wait for at least 1 confirmation (optional, can be done async)
            if (this.config.bitcoin.minConfirmations > 0) {
                this.waitForConfirmationAsync(txId, this.config.bitcoin.minConfirmations);
            }

            return txId;
            
        } catch (error) {
            logger.error(' Failed to fund Bitcoin HTLC:', error);
            
            // Clear spent UTXOs if transaction failed
            if (utxos && utxos.length > 0) {
                utxos.forEach((utxo: any) => this.utxoManager.clearSpent(utxo.txid, utxo.vout));
                logger.info(' Cleared spent status for UTXOs due to transaction failure');
            }
            
            throw new Error(`Bitcoin funding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Wait for transaction confirmation (async, non-blocking)
     */
    private async waitForConfirmationAsync(txId: string, confirmations: number): Promise<void> {
        this.utxoManager.waitForConfirmation(txId, confirmations)
            .then(confirmed => {
                if (confirmed) {
                    logger.info(` Transaction ${txId} confirmed with ${confirmations} confirmations`);
                } else {
                    logger.warn(` Transaction ${txId} confirmation timeout`);
                }
            })
            .catch(error => {
                logger.error(` Error waiting for confirmation: ${error.message}`);
            });
    }

    /**
     * Handle secret revelation from Ethereum monitoring
     */
    private async handleSecretRevealed(event: any): Promise<void> {
        const { orderHash, secret, transactionHash } = event;
        
        logger.info(` Secret revealed for order ${orderHash}:`, {
            secret: secret.slice(0, 10) + '...',
            ethTxHash: transactionHash
        });

        try {
            // Get stored context for this order
            const context = this.orderStore.get(orderHash);
            if (!context) {
                logger.error(` No context found for order ${orderHash}`);
                return;
            }

            // Update context with revealed secret
            this.orderStore.set(orderHash, { ...context, secret });
            this.orderStore.updateStatus(orderHash, 'secret_revealed');

            // Check if we have all required information
            if (!context.bitcoin?.htlcScript || !context.bitcoin?.htlcAddress || !context.bitcoin?.fundingTxId) {
                logger.error(` Missing Bitcoin information for order ${orderHash}`);
                return;
            }

            // Claim Bitcoin using revealed secret
            const claimingTxId = await this.claimBitcoin(
                orderHash,
                Buffer.from(context.bitcoin.htlcScript, 'hex'),
                context.bitcoin.htlcAddress,
                secret,
                context.bitcoin.fundingTxId
            );

            logger.info(` Bitcoin claimed successfully: ${claimingTxId}`);
            
            // Update order context
            this.orderStore.updateBitcoinInfo(orderHash, { claimingTxId });
            this.orderStore.updateStatus(orderHash, 'claimed');

            this.emit('bitcoinClaimed', {
                orderHash,
                claimingTxId,
                htlcAddress: context.bitcoin.htlcAddress,
                secret
            });

        } catch (error) {
            logger.error(` Failed to claim Bitcoin for order ${orderHash}:`, error);
            
            this.orderStore.updateStatus(
                orderHash, 
                'failed', 
                `Bitcoin claim failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );

            this.emit('bitcoinClaimFailed', {
                orderHash,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Claim Bitcoin from HTLC using revealed secret
     */
    private async claimBitcoin(
        orderHash: string,
        htlcScript: Buffer,
        htlcAddress: string,
        secret: string,
        fundingTxId: string
    ): Promise<string> {
        logger.info(` Claiming Bitcoin from HTLC ${htlcAddress}`);

        try {
            // Get HTLC output info
            const htlcOutput = await this.utxoManager.getUTXO(fundingTxId, 0);
            if (!htlcOutput) {
                throw new Error(`HTLC output not found: ${fundingTxId}:0`);
            }

            logger.info(` HTLC output found: ${htlcOutput.value} satoshis`);

            // Create claiming transaction
            const claimingTx = await this.btcManager.createClaimingTransaction(
                fundingTxId,
                0, // HTLC output index
                htlcOutput.value,
                htlcScript,
                secret,
                this.changeAddress,
                this.keyPair
            );
            
            logger.info(` Claiming transaction created, size: ${claimingTx.txHex.length / 2} bytes`);
            
            // Broadcast claiming transaction with retry
            const txId = await this.retryOperation<string>(
                () => this.btcManager.broadcastTransaction(claimingTx.txHex),
                'Bitcoin claiming transaction broadcast',
                this.config.execution.retryAttempts,
                this.config.execution.retryDelay
            );
            
            logger.info(` Bitcoin claiming transaction broadcast: ${txId}`);
            logger.info(` View on explorer: https://blockstream.info/${this.config.bitcoin.network === 'testnet' ? 'testnet/' : ''}tx/${txId}`);
            
            return txId;

        } catch (error) {
            logger.error(' Failed to claim Bitcoin:', error);
            throw new Error(`Bitcoin claiming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle expired order by attempting refund
     */
    private async handleExpiredOrder(context: OrderContext): Promise<void> {
        logger.info(` Handling expired order ${context.orderHash}`);
        
        try {
            const canRefund = await this.refundManager.canRefund(context);
            if (canRefund) {
                logger.info(` Attempting refund for expired order ${context.orderHash}`);
                
                const result = await this.refundManager.refundExpiredHTLC(
                    context,
                    this.changeAddress,
                    this.keyPair
                );
                
                if (result.success) {
                    logger.info(` Successfully refunded order ${context.orderHash}: ${result.txId}`);
                    this.orderStore.updateBitcoinInfo(context.orderHash, {
                        refundTxId: result.txId
                    });
                    this.orderStore.updateStatus(context.orderHash, 'expired');
                    
                    this.emit('bitcoinRefunded', {
                        orderHash: context.orderHash,
                        refundTxId: result.txId,
                        htlcAddress: context.bitcoin?.htlcAddress
                    });
                } else {
                    logger.error(` Failed to refund order ${context.orderHash}: ${result.error}`);
                    this.orderStore.updateStatus(context.orderHash, 'failed', `Refund failed: ${result.error}`);
                }
            } else {
                logger.info(` Order ${context.orderHash} cannot be refunded yet (timelock not expired)`);
            }
        } catch (error: any) {
            logger.error(` Error handling expired order ${context.orderHash}: ${error.message}`);
            this.orderStore.updateStatus(context.orderHash, 'failed', `Refund error: ${error.message}`);
        }
    }

    /**
     * Start periodic monitoring for expired orders
     */
    private startPeriodicMonitoring(): void {
        // Check for expired orders every 5 minutes
        this.monitoringInterval = setInterval(async () => {
            try {
                const pendingOrders = this.orderStore.getPending();
                const now = Math.floor(Date.now() / 1000);
                
                for (const context of pendingOrders) {
                    // Check if order has expired
                    if (context.expiryTime && context.expiryTime < now) {
                        if (context.status === 'htlc_funded') {
                            logger.info(` Found expired funded HTLC: ${context.orderHash}`);
                            await this.handleExpiredOrder(context);
                        }
                    }
                }
            } catch (error: any) {
                logger.error(` Error in periodic monitoring: ${error.message}`);
            }
        }, 5 * 60 * 1000); // 5 minutes
        
        logger.info(' Started periodic monitoring for expired orders');
    }

    /**
     * Decode Bitcoin execution parameters from ABI-encoded data
     */
    private decodeExecutionParams(encodedParams: string): BitcoinExecutionParams {
        const { decodeBitcoinParams, validateBitcoinParams } = require('../utils/bitcoin-params');
        
        try {
            // Decode ABI-encoded parameters from smart contract
            const params = decodeBitcoinParams(encodedParams);
            
            // Validate parameters
            const validation = validateBitcoinParams(params);
            if (!validation.valid) {
                logger.warn(' Invalid Bitcoin parameters:', validation.errors);
                // Continue with decoded params, but log warnings
            }
            
            logger.info(' Decoded Bitcoin execution parameters:', params);
            return params;
            
        } catch (error) {
            logger.warn(' Failed to decode execution parameters, using defaults:', error);
            return {
                btcAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                htlcTimelock: this.config.bitcoin.htlcTimelock || 144,
                feeRate: this.config.bitcoin.feeRate || 10
            };
        }
    }

    /**
     * Get Bitcoin network status
     */
    async getNetworkStatus(): Promise<{
        network: string;
        blockHeight: number;
        feeRate: number;
        balance: number;
        connected: boolean;
    }> {
        try {
            const blockHeight = await this.btcManager.getCurrentBlockHeight();
            const balance = await this.utxoManager.getAvailableBalance(this.changeAddress);
            const feeRate = await this.utxoManager.getCachedFeeRate();
            
            return {
                network: this.config.bitcoin.network,
                blockHeight,
                feeRate,
                balance,
                connected: true
            };
        } catch (error) {
            logger.error(' Failed to get Bitcoin network status:', error);
            return {
                network: this.config.bitcoin.network,
                blockHeight: 0,
                feeRate: this.config.bitcoin.feeRate || 10,
                balance: 0,
                connected: false
            };
        }
    }

    /**
     * Get executor status
     */
    getStatus(): {
        initialized: boolean;
        address: string;
        pendingOrders: number;
        network: string;
    } {
        return {
            initialized: this.initialized,
            address: this.changeAddress || 'Not initialized',
            pendingOrders: this.orderStore.getPending().length,
            network: this.config.bitcoin.network
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        logger.info(' Cleaning up Bitcoin Executor...');
        
        // Save any pending order contexts
        await this.orderStore.flush();
        
        // Stop periodic monitoring
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        // Stop event monitoring
        if (this.eventMonitor) {
            await this.eventMonitor.stopMonitoring();
        }
        
        this.removeAllListeners();
        this.initialized = false;
    }
}