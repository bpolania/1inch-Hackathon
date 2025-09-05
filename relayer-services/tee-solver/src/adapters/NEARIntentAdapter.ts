/**
 * NEAR Intent Adapter for Shade Agent
 * 
 * Handles NEAR Intent processing and converts them to executable swap intents
 * for the Shade Agent to process autonomously.
 */

import { logger } from '../utils/logger';
import { SwapIntent } from '../ShadeAgent';
import axios from 'axios';

export interface NEARIntent {
    id: string;
    sender: string;
    intent_type: 'swap' | 'bridge' | 'trade';
    from_chain: string;
    to_chain: string;  
    from_asset: string;
    to_asset: string;
    from_amount: string;
    min_to_amount: string;
    max_slippage: number;
    deadline: number;
    metadata?: {
        user_address?: string;
        preferred_route?: string;
        priority?: 'low' | 'medium' | 'high';
    };
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: number;
    updated_at: number;
}

export class NEARIntentAdapter {
    private nearRpcUrl: string;
    private contractId: string;

    constructor(nearRpcUrl: string, contractId: string = 'intents.near') {
        this.nearRpcUrl = nearRpcUrl;
        this.contractId = contractId;
    }

    /**
     * Listen for new NEAR intents
     */
    async *listenForIntents(): AsyncGenerator<NEARIntent, void, unknown> {
        logger.info(' Starting to listen for NEAR intents...');
        
        while (true) {
            try {
                const intents = await this.fetchPendingIntents();
                
                for (const intent of intents) {
                    if (this.isRelevantIntent(intent)) {
                        yield intent;
                    }
                }
                
                // Poll every 10 seconds
                await new Promise(resolve => setTimeout(resolve, 10000));
                
            } catch (error) {
                logger.error(' Error listening for intents:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    /**
     * Fetch pending intents from NEAR contract
     */
    private async fetchPendingIntents(): Promise<NEARIntent[]> {
        try {
            const response = await axios.post(this.nearRpcUrl, {
                jsonrpc: '2.0',
                id: 'dontcare',
                method: 'query',
                params: {
                    request_type: 'call_function',
                    finality: 'final',
                    account_id: this.contractId,
                    method_name: 'get_pending_intents',
                    args_base64: Buffer.from(JSON.stringify({})).toString('base64')
                }
            });

            if (response.data.result && response.data.result.result) {
                const resultBytes = Buffer.from(response.data.result.result);
                const intents = JSON.parse(resultBytes.toString());
                return intents || [];
            }

            return [];

        } catch (error) {
            logger.error(' Error fetching pending intents:', error);
            return [];
        }
    }

    /**
     * Check if intent is relevant for our Shade Agent
     */
    private isRelevantIntent(intent: NEARIntent): boolean {
        // Check if it's a swap intent we can handle
        if (intent.intent_type !== 'swap') {
            return false;
        }

        // Check if it involves Bitcoin or NEAR (our supported chains)
        const supportedChains = ['bitcoin', 'near', 'ethereum'];
        const fromChainSupported = supportedChains.includes(intent.from_chain.toLowerCase());
        const toChainSupported = supportedChains.includes(intent.to_chain.toLowerCase());

        if (!fromChainSupported || !toChainSupported) {
            return false;
        }

        // Check if it's still pending
        if (intent.status !== 'pending') {
            return false;
        }

        // Check if deadline hasn't passed
        if (intent.deadline < Date.now() / 1000) {
            return false;
        }

        return true;
    }

    /**
     * Convert NEAR intent to Shade Agent swap intent
     */
    convertToSwapIntent(nearIntent: NEARIntent): SwapIntent {
        return {
            fromChain: this.normalizeChainName(nearIntent.from_chain),
            toChain: this.normalizeChainName(nearIntent.to_chain),
            fromAmount: nearIntent.from_amount,
            toAmount: nearIntent.min_to_amount,
            fromToken: nearIntent.from_asset,
            toToken: nearIntent.to_asset,
            userAddress: nearIntent.metadata?.user_address || nearIntent.sender,
            maxSlippage: nearIntent.max_slippage,
            deadline: nearIntent.deadline
        };
    }

    /**
     * Normalize chain names to our standard format
     */
    private normalizeChainName(chainName: string): 'bitcoin' | 'near' | 'ethereum' {
        const normalized = chainName.toLowerCase();
        
        if (normalized.includes('bitcoin') || normalized === 'btc') {
            return 'bitcoin';
        }
        
        if (normalized.includes('near')) {
            return 'near';
        }
        
        if (normalized.includes('ethereum') || normalized === 'eth') {
            return 'ethereum';
        }
        
        // Default fallback
        return 'ethereum';
    }

    /**
     * Mark intent as being processed
     */
    async markIntentAsProcessing(intentId: string): Promise<void> {
        try {
            // Call NEAR contract to update intent status
            const response = await axios.post(this.nearRpcUrl, {
                jsonrpc: '2.0',
                id: 'dontcare',
                method: 'broadcast_tx_commit',
                params: {
                    signed_tx_base64: await this.createUpdateIntentTransaction(intentId, 'processing')
                }
            });

            logger.info(` Marked intent ${intentId} as processing`);

        } catch (error) {
            logger.error(` Error marking intent ${intentId} as processing:`, error);
        }
    }

    /**
     * Mark intent as completed with transaction hashes
     */
    async markIntentAsCompleted(intentId: string, transactionHashes: string[]): Promise<void> {
        try {
            // Call NEAR contract to update intent status
            const response = await axios.post(this.nearRpcUrl, {
                jsonrpc: '2.0',
                id: 'dontcare', 
                method: 'broadcast_tx_commit',
                params: {
                    signed_tx_base64: await this.createCompleteIntentTransaction(intentId, transactionHashes)
                }
            });

            logger.info(` Marked intent ${intentId} as completed`);

        } catch (error) {
            logger.error(` Error marking intent ${intentId} as completed:`, error);
        }
    }

    /**
     * Create transaction to update intent status (simplified)
     */
    private async createUpdateIntentTransaction(intentId: string, status: string): Promise<string> {
        // In a real implementation, this would create a properly signed NEAR transaction
        // For demo purposes, return a placeholder
        return Buffer.from(JSON.stringify({
            intent_id: intentId,
            new_status: status,
            updated_at: Date.now()
        })).toString('base64');
    }

    /**
     * Create transaction to complete intent (simplified)
     */
    private async createCompleteIntentTransaction(intentId: string, txHashes: string[]): Promise<string> {
        // In a real implementation, this would create a properly signed NEAR transaction
        return Buffer.from(JSON.stringify({
            intent_id: intentId,
            new_status: 'completed',
            transaction_hashes: txHashes,
            completed_at: Date.now()
        })).toString('base64');
    }
}