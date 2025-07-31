/**
 * Refund Manager
 * 
 * Handles refunds for expired Bitcoin HTLCs when atomic swaps fail or timeout.
 */

import { logger } from './logger';
import { OrderContext } from './OrderContextStore';

const BitcoinHTLCManager = require('../../../../contracts/bitcoin/src/BitcoinHTLCManager');
const bitcoin = require('bitcoinjs-lib');

export interface RefundResult {
    success: boolean;
    txId?: string;
    error?: string;
}

export class RefundManager {
    private btcManager: any;
    private network: any;

    constructor(config: { network: 'mainnet' | 'testnet', apiUrl?: string }) {
        this.network = config.network === 'mainnet' 
            ? bitcoin.networks.bitcoin 
            : bitcoin.networks.testnet;

        this.btcManager = new BitcoinHTLCManager({
            network: this.network,
            apiBaseUrl: config.apiUrl || (
                config.network === 'mainnet'
                    ? 'https://blockstream.info/api'
                    : 'https://blockstream.info/testnet/api'
            )
        });
    }

    /**
     * Check if an HTLC can be refunded (timelock expired)
     */
    async canRefund(context: OrderContext): Promise<boolean> {
        if (!context.bitcoin?.fundingTxId || !context.bitcoin?.htlcScript) {
            return false;
        }

        try {
            // Parse the HTLC script to get the timelock
            const htlcScript = Buffer.from(context.bitcoin.htlcScript, 'hex');
            const timelockHeight = this.extractTimelockFromScript(htlcScript);
            
            if (!timelockHeight) {
                logger.warn(`Could not extract timelock from HTLC script for order ${context.orderHash}`);
                return false;
            }

            // Get current block height
            const currentHeight = await this.btcManager.getCurrentBlockHeight();
            
            // Check if timelock has expired
            const canRefund = currentHeight >= timelockHeight;
            
            logger.info(`HTLC refund check for order ${context.orderHash}:`, {
                currentHeight,
                timelockHeight,
                canRefund
            });

            return canRefund;
        } catch (error) {
            logger.error(`Error checking refund eligibility: ${error}`);
            return false;
        }
    }

    /**
     * Refund an expired HTLC
     */
    async refundExpiredHTLC(
        context: OrderContext,
        refundAddress: string,
        keyPair: any
    ): Promise<RefundResult> {
        logger.info(`🔄 Attempting to refund expired HTLC for order ${context.orderHash}`);

        try {
            if (!context.bitcoin?.fundingTxId || !context.bitcoin?.htlcScript || !context.bitcoin?.htlcAddress) {
                throw new Error('Missing Bitcoin HTLC information');
            }

            // Check if refund is possible
            const canRefund = await this.canRefund(context);
            if (!canRefund) {
                throw new Error('HTLC timelock has not expired yet');
            }

            // Get HTLC output
            const fundingTxId = context.bitcoin.fundingTxId;
            const htlcScript = Buffer.from(context.bitcoin.htlcScript, 'hex');
            
            // Get the HTLC UTXO
            const htlcOutput = await this.btcManager.getUTXO(fundingTxId, 0);
            if (!htlcOutput) {
                throw new Error(`HTLC output not found: ${fundingTxId}:0 (may have been claimed already)`);
            }

            logger.info(`📊 Found HTLC output: ${htlcOutput.value} satoshis`);

            // Create refund transaction
            const refundTx = await this.btcManager.createRefundTransaction(
                fundingTxId,
                0, // HTLC output index
                htlcOutput.value,
                htlcScript,
                refundAddress,
                keyPair
            );

            logger.info(`✍️ Refund transaction created, size: ${refundTx.txHex.length / 2} bytes`);

            // Broadcast refund transaction
            const txId = await this.btcManager.broadcastTransaction(refundTx.txHex);

            logger.info(`🚀 Refund transaction broadcast: ${txId}`);
            logger.info(`🔗 View on explorer: https://blockstream.info/${this.network === bitcoin.networks.testnet ? 'testnet/' : ''}tx/${txId}`);

            return {
                success: true,
                txId
            };

        } catch (error: any) {
            logger.error(`💥 Failed to refund HTLC: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Monitor and refund expired HTLCs
     */
    async monitorAndRefundExpired(
        contexts: OrderContext[],
        refundAddress: string,
        keyPair: any
    ): Promise<Map<string, RefundResult>> {
        const results = new Map<string, RefundResult>();

        for (const context of contexts) {
            // Only check HTLCs that are funded but not claimed
            if (context.status !== 'htlc_funded' || !context.bitcoin?.fundingTxId) {
                continue;
            }

            try {
                const canRefund = await this.canRefund(context);
                if (canRefund) {
                    logger.info(`⏰ HTLC for order ${context.orderHash} has expired, initiating refund`);
                    const result = await this.refundExpiredHTLC(context, refundAddress, keyPair);
                    results.set(context.orderHash, result);
                }
            } catch (error: any) {
                logger.error(`Error processing refund for order ${context.orderHash}: ${error.message}`);
                results.set(context.orderHash, {
                    success: false,
                    error: error.message
                });
            }

            // Add delay between refunds to avoid overwhelming the network
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return results;
    }

    /**
     * Extract timelock height from HTLC script
     * 
     * HTLC Script structure:
     * OP_IF
     *   OP_SHA256 <hashlock> OP_EQUALVERIFY <recipient_pubkey> OP_CHECKSIG
     * OP_ELSE
     *   <timelock> OP_CHECKLOCKTIMEVERIFY OP_DROP <refund_pubkey> OP_CHECKSIG
     * OP_ENDIF
     */
    private extractTimelockFromScript(script: Buffer): number | null {
        try {
            const decompiled = bitcoin.script.decompile(script);
            if (!decompiled) return null;

            // Find OP_ELSE (0x67)
            const elseIndex = decompiled.findIndex(op => op === bitcoin.opcodes.OP_ELSE);
            if (elseIndex === -1) return null;

            // The timelock should be right after OP_ELSE
            if (elseIndex + 1 < decompiled.length) {
                const timelockElement = decompiled[elseIndex + 1];
                
                // Check if it's a buffer (encoded number)
                if (Buffer.isBuffer(timelockElement)) {
                    return bitcoin.script.number.decode(timelockElement);
                }
            }

            return null;
        } catch (error) {
            logger.error(`Error extracting timelock from script: ${error}`);
            return null;
        }
    }

    /**
     * Estimate refund transaction fee
     */
    async estimateRefundFee(feeRate: number = 10): Promise<number> {
        // Approximate size for a refund transaction
        // Input: ~150 bytes (P2SH spending with witness)
        // Output: ~34 bytes
        // Overhead: ~10 bytes
        const estimatedSize = 194;
        return estimatedSize * feeRate;
    }
}