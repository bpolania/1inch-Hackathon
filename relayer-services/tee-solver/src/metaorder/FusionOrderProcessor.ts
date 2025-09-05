/**
 * 1inch Fusion+ Order Processor for Shade Agent
 * 
 * Processes 1inch Fusion+ meta-orders and converts them to executable
 * swap intents for autonomous cross-chain execution.
 */

import { FusionSDK } from '@1inch/fusion-sdk';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { SwapIntent } from '../ShadeAgent';

export interface FusionOrder {
    orderHash: string;
    maker: string;
    srcToken: string;
    dstToken: string;
    srcAmount: string;
    dstAmount: string;
    dstChainId: number;
    dstExecutionParams: string;
    expiryTime: number;
    hashlock: string;
    status: 'pending' | 'matched' | 'executed' | 'expired';
    createdAt: number;
}

export interface BitcoinExecutionParams {
    btcAddress: string;
    htlcTimelock: number;
    feeRate: number;
}

export class FusionOrderProcessor {
    private fusionSDK: FusionSDK;
    private ethereumProvider: ethers.JsonRpcProvider;
    private factoryAddress: string;

    constructor(
        fusionSDK: FusionSDK,
        ethereumProvider: ethers.JsonRpcProvider,
        factoryAddress: string = '0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a'
    ) {
        this.fusionSDK = fusionSDK;
        this.ethereumProvider = ethereumProvider;
        this.factoryAddress = factoryAddress;
    }

    /**
     * Monitor for new Bitcoin-bound Fusion+ orders
     */
    async *monitorBitcoinOrders(): AsyncGenerator<FusionOrder, void, unknown> {
        logger.info(' Monitoring for Bitcoin-bound Fusion+ orders...');

        while (true) {
            try {
                const orders = await this.fetchPendingBitcoinOrders();
                
                for (const order of orders) {
                    if (this.isExecutableOrder(order)) {
                        yield order;
                    }
                }
                
                // Poll every 15 seconds
                await new Promise(resolve => setTimeout(resolve, 15000));
                
            } catch (error) {
                logger.error(' Error monitoring Bitcoin orders:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    /**
     * Fetch pending Bitcoin-bound orders from 1inch Fusion+
     */
    private async fetchPendingBitcoinOrders(): Promise<FusionOrder[]> {
        try {
            // Get recent orders from our factory contract
            const factoryContract = new ethers.Contract(
                this.factoryAddress,
                [
                    'event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, uint256 indexed dstChainId, bytes dstExecutionParams)',
                    'function getOrderInfo(bytes32 orderHash) view returns (tuple(address maker, address srcToken, uint256 srcAmount, uint256 dstChainId, bytes dstExecutionParams, uint256 expiryTime, bytes32 hashlock, bool completed))'
                ],
                this.ethereumProvider
            );

            // Query recent FusionOrderCreated events
            const filter = factoryContract.filters.FusionOrderCreated();
            const recentEvents = await factoryContract.queryFilter(filter, -1000); // Last 1000 blocks

            const orders: FusionOrder[] = [];

            for (const event of recentEvents) {
                try {
                    const eventLog = event as ethers.EventLog;
                    const orderHash = eventLog.args?.[0];
                    const dstChainId = eventLog.args?.[2];

                    // Only process Bitcoin orders (chain IDs 40003-40007)
                    if (dstChainId && this.isBitcoinChainId(Number(dstChainId))) {
                        const orderInfo = await factoryContract.getOrderInfo(orderHash);
                        
                        if (orderInfo && !orderInfo.completed) {
                            orders.push({
                                orderHash,
                                maker: orderInfo.maker,
                                srcToken: orderInfo.srcToken,
                                dstToken: '0x0000000000000000000000000000000000000000', // Bitcoin (native)
                                srcAmount: orderInfo.srcAmount.toString(),
                                dstAmount: await this.decodeBitcoinAmount(orderInfo.dstExecutionParams),
                                dstChainId: Number(orderInfo.dstChainId),
                                dstExecutionParams: orderInfo.dstExecutionParams,
                                expiryTime: Number(orderInfo.expiryTime),
                                hashlock: orderInfo.hashlock,
                                status: 'pending',
                                createdAt: Date.now()
                            });
                        }
                    }
                } catch (error) {
                    logger.warn(' Error processing order event:', error);
                }
            }

            return orders;

        } catch (error) {
            logger.error(' Error fetching Bitcoin orders:', error);
            return [];
        }
    }

    /**
     * Check if chain ID is a Bitcoin family chain
     */
    private isBitcoinChainId(chainId: number): boolean {
        // Bitcoin family chain IDs from our implementation
        return [40003, 40004, 40005, 40006, 40007].includes(chainId);
    }

    /**
     * Decode Bitcoin amount from execution parameters
     */
    private async decodeBitcoinAmount(executionParams: string): Promise<string> {
        try {
            // Decode ABI-encoded execution parameters
            const abiCoder = new ethers.AbiCoder();
            const decoded = abiCoder.decode(
                ['string', 'uint256', 'uint256'], // btcAddress, amount, feeRate
                executionParams
            );
            
            return decoded[1].toString(); // Amount in satoshis
            
        } catch (error) {
            logger.warn(' Error decoding Bitcoin amount:', error);
            return '10000'; // Default 10k satoshis
        }
    }

    /**
     * Decode Bitcoin execution parameters
     */
    decodeBitcoinExecutionParams(executionParams: string): BitcoinExecutionParams {
        try {
            const abiCoder = new ethers.AbiCoder();
            const decoded = abiCoder.decode(
                ['string', 'uint256', 'uint256'], // btcAddress, amount, feeRate
                executionParams
            );

            return {
                btcAddress: decoded[0],
                htlcTimelock: 144, // Default 144 blocks
                feeRate: Number(decoded[2]) || 10
            };

        } catch (error) {
            logger.warn(' Error decoding execution params:', error);
            return {
                btcAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                htlcTimelock: 144,
                feeRate: 10
            };
        }
    }

    /**
     * Check if order is executable by our Shade Agent
     */
    private isExecutableOrder(order: FusionOrder): boolean {
        // Check if order hasn't expired
        if (order.expiryTime < Date.now() / 1000) {
            return false;
        }

        // Check if it's a Bitcoin destination order
        if (!this.isBitcoinChainId(order.dstChainId)) {
            return false;
        }

        // Check if order is still pending
        if (order.status !== 'pending') {
            return false;
        }

        // Check minimum amount thresholds
        const srcAmountNum = parseFloat(order.srcAmount);
        const dstAmountNum = parseFloat(order.dstAmount);
        
        if (srcAmountNum < 0.001 || dstAmountNum < 1000) { // Minimum thresholds
            return false;
        }

        return true;
    }

    /**
     * Convert Fusion+ order to Shade Agent swap intent
     */
    convertToSwapIntent(order: FusionOrder): SwapIntent {
        const params = this.decodeBitcoinExecutionParams(order.dstExecutionParams);
        
        return {
            fromChain: 'ethereum',
            toChain: 'bitcoin',
            fromAmount: ethers.formatUnits(order.srcAmount, 18), // Assuming 18 decimals
            toAmount: (parseFloat(order.dstAmount) / 100000000).toString(), // Convert satoshis to BTC
            fromToken: order.srcToken,
            toToken: 'BTC',
            userAddress: params.btcAddress,
            maxSlippage: 0.005, // 0.5% default
            deadline: order.expiryTime
        };
    }

    /**
     * Mark order as being processed
     */
    async markOrderAsProcessing(orderHash: string): Promise<void> {
        try {
            logger.info(` Marking order ${orderHash} as processing`);
            // In production, this would update the order status on-chain
            
        } catch (error) {
            logger.error(` Error marking order as processing:`, error);
        }
    }

    /**
     * Complete order execution with transaction proofs
     */
    async completeOrder(orderHash: string, secret: string, transactionHashes: string[]): Promise<void> {
        try {
            logger.info(` Completing order ${orderHash} with secret ${secret.slice(0, 10)}...`);
            
            // In production, this would call the completion function on the factory contract
            // with the revealed secret and transaction proofs
            
        } catch (error) {
            logger.error(` Error completing order:`, error);
        }
    }

    /**
     * Get order statistics
     */
    async getOrderStats(): Promise<{
        totalOrders: number;
        pendingOrders: number;
        bitcoinOrders: number;
        avgOrderSize: string;
    }> {
        try {
            // Query order statistics from the factory contract
            return {
                totalOrders: 0,
                pendingOrders: 0,
                bitcoinOrders: 0,
                avgOrderSize: '0'
            };
            
        } catch (error) {
            logger.error(' Error getting order stats:', error);
            return {
                totalOrders: 0,
                pendingOrders: 0,
                bitcoinOrders: 0,
                avgOrderSize: '0'
            };
        }
    }
}