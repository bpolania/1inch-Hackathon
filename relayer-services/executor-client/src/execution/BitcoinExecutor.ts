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

// Import our Bitcoin HTLC implementation
const BitcoinHTLCManager = require('../../../../../contracts/bitcoin/src/BitcoinHTLCManager');
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

    constructor(config: Config) {
        super();
        this.config = config;
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
            this.monitorSecretRevelation(order, htlcScript, htlcAddress);

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
     * Fund Bitcoin HTLC address
     */
    private async fundHTLC(
        htlcAddress: string,
        amount: bigint,
        feeRate: number
    ): Promise<string> {
        logger.info(`💸 Funding HTLC ${htlcAddress} with ${amount} satoshis`);

        try {
            // In production, resolver would:
            // 1. Get UTXOs from their Bitcoin wallet
            // 2. Create funding transaction
            // 3. Sign and broadcast

            // For demo purposes, we simulate the funding
            // The actual implementation would use:
            /*
            const utxos = await this.btcManager.getUTXOs(this.changeAddress);
            const fundingTx = await this.btcManager.createFundingTransaction(
                utxos,
                htlcAddress,
                Number(amount),
                this.keyPair.publicKey,
                this.keyPair
            );
            const txId = await this.btcManager.broadcastTransaction(fundingTx.txHex);
            return txId;
            */

            // Simulate funding transaction ID
            const mockTxId = `funding_${htlcAddress.slice(-8)}_${Date.now()}`;
            logger.info(`📝 Simulated Bitcoin funding transaction: ${mockTxId}`);
            
            return mockTxId;

        } catch (error) {
            logger.error('💥 Failed to fund Bitcoin HTLC:', error);
            throw new Error(`Bitcoin funding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Monitor Ethereum for secret revelation and claim Bitcoin
     */
    private monitorSecretRevelation(
        order: ExecutableOrder,
        htlcScript: Buffer,
        htlcAddress: string
    ): void {
        logger.info(`👀 Monitoring secret revelation for order ${order.orderHash}`);

        // In production, this would:
        // 1. Monitor Ethereum events for secret revelation
        // 2. Extract the secret preimage
        // 3. Use secret to claim Bitcoin from HTLC
        // 4. Complete the atomic swap

        // Simulate monitoring
        setTimeout(async () => {
            try {
                logger.info(`🔐 Secret revealed for order ${order.orderHash}`);
                
                // Simulate claiming Bitcoin with revealed secret
                const claimingTxId = await this.claimBitcoin(
                    order.orderHash,
                    htlcScript,
                    htlcAddress,
                    order.hashlock // In real scenario, this would be the revealed secret
                );

                logger.info(`🎯 Bitcoin claimed successfully: ${claimingTxId}`);
                
                this.emit('bitcoinClaimed', {
                    orderHash: order.orderHash,
                    claimingTxId,
                    htlcAddress
                });

            } catch (error) {
                logger.error(`💥 Failed to claim Bitcoin for order ${order.orderHash}:`, error);
                this.emit('bitcoinClaimFailed', {
                    orderHash: order.orderHash,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }, 30000); // 30 second delay for demo
    }

    /**
     * Claim Bitcoin from HTLC using revealed secret
     */
    private async claimBitcoin(
        orderHash: string,
        htlcScript: Buffer,
        htlcAddress: string,
        secret: string
    ): Promise<string> {
        logger.info(`💎 Claiming Bitcoin from HTLC ${htlcAddress}`);

        try {
            // In production, this would:
            /*
            const claimingTx = await this.btcManager.createClaimingTransaction(
                fundingTxId,
                0, // HTLC output index
                amount,
                htlcScript,
                secret,
                this.changeAddress,
                this.keyPair
            );
            const txId = await this.btcManager.broadcastTransaction(claimingTx.txHex);
            return txId;
            */

            // Simulate claiming transaction
            const mockTxId = `claim_${orderHash.slice(2, 18)}_${Date.now()}`;
            logger.info(`📝 Simulated Bitcoin claiming transaction: ${mockTxId}`);
            
            return mockTxId;

        } catch (error) {
            logger.error('💥 Failed to claim Bitcoin:', error);
            throw new Error(`Bitcoin claiming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Decode Bitcoin execution parameters
     */
    private decodeExecutionParams(encodedParams: string): BitcoinExecutionParams {
        try {
            // In production, this would decode the ABI-encoded parameters from the smart contract
            // For now, we'll use default values that match our Bitcoin adapter
            return {
                btcAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Default testnet address
                htlcTimelock: 144, // 24 hours in blocks
                feeRate: 10 // 10 sat/byte
            };
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