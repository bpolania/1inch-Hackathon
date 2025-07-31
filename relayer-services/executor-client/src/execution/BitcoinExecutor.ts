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

// Import our Bitcoin HTLC implementation
const BitcoinHTLCManager = require('../../../../contracts/bitcoin/src/BitcoinHTLCManager');
const bitcoin = require('bitcoinjs-lib');

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
    private keyPair: any; // Bitcoin key pair for resolver
    private changeAddress: string;
    private eventMonitor: EthereumEventMonitor;
    private orderContexts: Map<string, any> = new Map(); // Store order execution contexts

    constructor(config: Config) {
        super();
        this.config = config;
        this.eventMonitor = new EthereumEventMonitor(config);
    }

    async initialize(): Promise<void> {
        logger.info('🔧 Initializing Bitcoin Executor...');

        try {
            // Initialize Bitcoin HTLC Manager
            this.btcManager = new BitcoinHTLCManager({
                network: this.config.bitcoin.network === 'mainnet' 
                    ? bitcoin.networks.bitcoin 
                    : bitcoin.networks.testnet,
                feeRate: this.config.bitcoin.feeRate || 10,
                htlcTimelock: this.config.bitcoin.htlcTimelock || 144,
                apiBaseUrl: this.config.bitcoin.network === 'mainnet'
                    ? 'https://blockstream.info/api'
                    : 'https://blockstream.info/testnet/api'
            });

            // Generate resolver key pair (in production, this would be loaded from secure storage)
            this.keyPair = this.btcManager.generateKeyPair();
            
            // Create change address for resolver
            const changePayment = bitcoin.payments.p2pkh({
                pubkey: this.keyPair.publicKey,
                network: this.btcManager.network
            });
            this.changeAddress = changePayment.address;

            // Initialize Ethereum event monitoring
            await this.eventMonitor.startMonitoring();
            
            // Listen for secret revelation events
            this.eventMonitor.on('secretRevealed', this.handleSecretRevealed.bind(this));
            
            logger.info('✅ Bitcoin Executor initialized successfully');
            logger.info(`📍 Network: ${this.config.bitcoin.network}`);
            logger.info(`⚡ Fee Rate: ${this.config.bitcoin.feeRate} sat/byte`);
            logger.info(`🏠 Resolver Address: ${this.changeAddress}`);

        } catch (error) {
            logger.error('💥 Failed to initialize Bitcoin Executor:', error);
            throw error;
        }
    }

    /**
     * Execute Bitcoin side of cross-chain atomic swap
     */
    async executeOrder(order: ExecutableOrder): Promise<BitcoinExecutionResult> {
        const startTime = Date.now();
        logger.info(`🚀 Executing Bitcoin side for order ${order.orderHash}`);

        try {
            // Decode Bitcoin execution parameters
            const params = this.decodeExecutionParams(order.executionParams);
            logger.info(`📋 Bitcoin Parameters:`, {
                address: params.btcAddress,
                timelock: params.htlcTimelock,
                feeRate: params.feeRate
            });

            // Step 1: Generate HTLC script
            const currentHeight = await this.btcManager.getCurrentBlockHeight();
            const timelockHeight = currentHeight + params.htlcTimelock;

            const htlcScript = this.btcManager.generateHTLCScript(
                order.order.hashlock,    // Shared hashlock from Ethereum
                this.keyPair.publicKey,   // Resolver can claim after secret revelation
                this.keyPair.publicKey,   // Resolver can refund after timelock
                timelockHeight
            );

            const htlcAddress = this.btcManager.createHTLCAddress(htlcScript);
            
            logger.info(`📜 HTLC Created:`, {
                address: htlcAddress,
                scriptLength: htlcScript.length,
                timelockHeight
            });

            // Step 2: Fund HTLC (in production, resolver would use their Bitcoin UTXOs)
            const fundingTxId = await this.fundHTLC(
                htlcAddress,
                order.order.destinationAmount,
                params.feeRate
            );

            logger.info(`💰 HTLC Funded: ${fundingTxId}`);

            // Step 3: Monitor for secret revelation on Ethereum
            this.eventMonitor.monitorOrder(order.orderHash);
            
            // Store order context for later claiming
            this.storeOrderContext(order.orderHash, {
                htlcScript,
                htlcAddress,
                fundingTxId,
                order: order.order
            });

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
            logger.error(`💥 Bitcoin execution failed for order ${order.orderHash}:`, error);
            
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
     * Fund Bitcoin HTLC address with real transaction
     */
    private async fundHTLC(
        htlcAddress: string,
        amount: bigint,
        feeRate: number
    ): Promise<string> {
        logger.info(`💸 Funding HTLC ${htlcAddress} with ${amount} satoshis`);

        try {
            // Check if we're in simulation mode or have real Bitcoin wallet
            const simulationMode = !this.config.bitcoin.privateKey;
            
            if (simulationMode) {
                // Simulation mode for testing
                const mockTxId = `sim_funding_${htlcAddress.slice(-8)}_${Date.now()}`;
                logger.info(`📝 Simulated Bitcoin funding transaction: ${mockTxId}`);
                return mockTxId;
            }
            
            // Real Bitcoin transaction execution
            logger.info(`🔗 Creating real Bitcoin funding transaction...`);
            
            // 1. Get UTXOs from resolver's Bitcoin wallet
            const utxos = await this.btcManager.getUTXOs(this.changeAddress);
            if (!utxos || utxos.length === 0) {
                throw new Error(`No UTXOs available for address ${this.changeAddress}`);
            }
            
            // 2. Calculate total available and required amounts
            const totalAvailable = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
            const requiredAmount = Number(amount);
            const estimatedFee = 250 * feeRate; // Rough estimate for P2SH transaction
            
            if (totalAvailable < requiredAmount + estimatedFee) {
                throw new Error(`Insufficient funds: need ${requiredAmount + estimatedFee}, have ${totalAvailable}`);
            }
            
            // 3. Create and sign funding transaction
            const fundingTx = await this.btcManager.createFundingTransaction(
                utxos,
                htlcAddress,
                requiredAmount,
                this.keyPair.publicKey,
                this.keyPair
            );
            
            logger.info(`✍️ Funding transaction created, size: ${fundingTx.txHex.length / 2} bytes`);
            
            // 4. Broadcast transaction to Bitcoin network
            const txId = await this.btcManager.broadcastTransaction(fundingTx.txHex);
            
            logger.info(`🚀 Bitcoin funding transaction broadcast: ${txId}`);
            logger.info(`🔗 View on explorer: https://blockstream.info/${this.config.bitcoin.network === 'testnet' ? 'testnet/' : ''}tx/${txId}`);
            
            return txId;
            
        } catch (error) {
            logger.error('💥 Failed to fund Bitcoin HTLC:', error);
            throw new Error(`Bitcoin funding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Store order context for later secret revelation processing
     */
    private storeOrderContext(orderHash: string, context: any): void {
        this.orderContexts.set(orderHash, context);
        logger.info(`💾 Stored context for order ${orderHash}`);
    }

    /**
     * Handle secret revelation from Ethereum monitoring
     */
    private async handleSecretRevealed(event: any): Promise<void> {
        const { orderHash, secret, transactionHash } = event;
        
        logger.info(`🔐 Secret revealed for order ${orderHash}:`, {
            secret: secret.slice(0, 10) + '...',
            ethTxHash: transactionHash
        });

        try {
            // Get stored context for this order
            const context = this.orderContexts.get(orderHash);
            if (!context) {
                logger.error(`💥 No context found for order ${orderHash}`);
                return;
            }

            // Claim Bitcoin using revealed secret
            const claimingTxId = await this.claimBitcoin(
                orderHash,
                context.htlcScript,
                context.htlcAddress,
                secret,
                context.fundingTxId
            );

            logger.info(`🎯 Bitcoin claimed successfully: ${claimingTxId}`);
            
            this.emit('bitcoinClaimed', {
                orderHash,
                claimingTxId,
                htlcAddress: context.htlcAddress,
                secret
            });

            // Clean up context
            this.orderContexts.delete(orderHash);

        } catch (error) {
            logger.error(`💥 Failed to claim Bitcoin for order ${orderHash}:`, error);
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
        fundingTxId?: string
    ): Promise<string> {
        logger.info(`💎 Claiming Bitcoin from HTLC ${htlcAddress}`);

        try {
            // Check if we're in simulation mode
            const simulationMode = !this.config.bitcoin.privateKey;
            
            if (simulationMode || !fundingTxId) {
                // Simulation mode for testing
                const mockTxId = `sim_claim_${orderHash.slice(2, 18)}_${Date.now()}`;
                logger.info(`📝 Simulated Bitcoin claiming transaction: ${mockTxId}`);
                return mockTxId;
            }

            // Real Bitcoin claiming transaction
            logger.info(`🔗 Creating real Bitcoin claiming transaction...`);
            
            // Get HTLC output info
            const htlcOutput = await this.btcManager.getUTXO(fundingTxId, 0);
            if (!htlcOutput) {
                throw new Error(`HTLC output not found: ${fundingTxId}:0`);
            }
            
            const claimingTx = await this.btcManager.createClaimingTransaction(
                fundingTxId,
                0, // HTLC output index
                htlcOutput.value,
                htlcScript,
                secret,
                this.changeAddress,
                this.keyPair
            );
            
            logger.info(`✍️ Claiming transaction created, size: ${claimingTx.txHex.length / 2} bytes`);
            
            const txId = await this.btcManager.broadcastTransaction(claimingTx.txHex);
            
            logger.info(`🚀 Bitcoin claiming transaction broadcast: ${txId}`);
            logger.info(`🔗 View on explorer: https://blockstream.info/${this.config.bitcoin.network === 'testnet' ? 'testnet/' : ''}tx/${txId}`);
            
            return txId;

        } catch (error) {
            logger.error('💥 Failed to claim Bitcoin:', error);
            throw new Error(`Bitcoin claiming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
                logger.warn('⚠️ Invalid Bitcoin parameters:', validation.errors);
                // Continue with decoded params, but log warnings
            }
            
            logger.info('✅ Decoded Bitcoin execution parameters:', params);
            return params;
            
        } catch (error) {
            logger.warn('⚠️ Failed to decode execution parameters, using defaults:', error);
            return {
                btcAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                htlcTimelock: 144,
                feeRate: 10
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
        connected: boolean;
    }> {
        try {
            const blockHeight = await this.btcManager.getCurrentBlockHeight();
            
            return {
                network: this.config.bitcoin.network,
                blockHeight,
                feeRate: this.config.bitcoin.feeRate || 10,
                connected: true
            };
        } catch (error) {
            logger.error('💥 Failed to get Bitcoin network status:', error);
            return {
                network: this.config.bitcoin.network,
                blockHeight: 0,
                feeRate: this.config.bitcoin.feeRate || 10,
                connected: false
            };
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        logger.info('🧹 Cleaning up Bitcoin Executor...');
        this.removeAllListeners();
    }
}