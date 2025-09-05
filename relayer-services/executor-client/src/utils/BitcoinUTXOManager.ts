/**
 * Bitcoin UTXO Manager
 * 
 * Manages Bitcoin UTXOs (Unspent Transaction Outputs) for the relayer service.
 * Handles UTXO collection, selection, and tracking for Bitcoin transactions.
 */

import axios from 'axios';
import { logger } from './logger';

export interface UTXO {
    txid: string;
    vout: number;
    value: number; // in satoshis
    status: {
        confirmed: boolean;
        block_height?: number;
        block_hash?: string;
    };
    scriptPubKey?: string;
}

export interface TransactionOutput {
    value: number;
    scriptPubKey: {
        hex: string;
        address?: string;
        type?: string;
    };
}

export class BitcoinUTXOManager {
    private apiUrl: string;
    private spentUTXOs: Set<string>;

    constructor(network: 'mainnet' | 'testnet' = 'testnet') {
        this.apiUrl = network === 'mainnet' 
            ? 'https://blockstream.info/api'
            : 'https://blockstream.info/testnet/api';
        this.spentUTXOs = new Set();
    }

    /**
     * Get all UTXOs for a Bitcoin address
     */
    async getUTXOs(address: string): Promise<UTXO[]> {
        try {
            logger.info(`Fetching UTXOs for address: ${address}`);
            const response = await axios.get(`${this.apiUrl}/address/${address}/utxo`);
            const utxos = response.data as UTXO[];
            
            // Filter out spent UTXOs that we're tracking
            const availableUTXOs = utxos.filter(utxo => 
                !this.spentUTXOs.has(`${utxo.txid}:${utxo.vout}`)
            );
            
            logger.info(`Found ${availableUTXOs.length} available UTXOs (${utxos.length} total)`);
            return availableUTXOs;
        } catch (error: any) {
            logger.error(`Failed to fetch UTXOs: ${error.message}`);
            throw new Error(`Failed to fetch UTXOs: ${error.message}`);
        }
    }

    /**
     * Get a specific transaction output
     */
    async getTransactionOutput(txid: string, vout: number): Promise<TransactionOutput> {
        try {
            logger.info(`Fetching transaction output: ${txid}:${vout}`);
            const response = await axios.get(`${this.apiUrl}/tx/${txid}`);
            const tx = response.data;
            
            if (!tx.vout || vout >= tx.vout.length) {
                throw new Error(`Output ${vout} not found in transaction ${txid}`);
            }
            
            const output = tx.vout[vout];
            return {
                value: Math.round(output.value * 100000000), // Convert BTC to satoshis
                scriptPubKey: output.scriptpubkey_type ? {
                    hex: output.scriptpubkey,
                    address: output.scriptpubkey_address,
                    type: output.scriptpubkey_type
                } : { hex: output.scriptpubkey }
            };
        } catch (error: any) {
            logger.error(`Failed to fetch transaction output: ${error.message}`);
            throw new Error(`Failed to fetch transaction output: ${error.message}`);
        }
    }

    /**
     * Get a specific UTXO (unspent output)
     */
    async getUTXO(txid: string, vout: number): Promise<UTXO | null> {
        try {
            // First, check if it's in our spent set
            if (this.spentUTXOs.has(`${txid}:${vout}`)) {
                logger.warn(`UTXO ${txid}:${vout} is marked as spent`);
                return null;
            }

            // Get the transaction details
            const output = await this.getTransactionOutput(txid, vout);
            
            // Check if it's actually unspent by querying the address UTXOs
            if (output.scriptPubKey.address) {
                const utxos = await this.getUTXOs(output.scriptPubKey.address);
                const utxo = utxos.find(u => u.txid === txid && u.vout === vout);
                
                if (utxo) {
                    return {
                        ...utxo,
                        scriptPubKey: output.scriptPubKey.hex
                    };
                }
            }
            
            // If we can't verify it's unspent, check transaction status
            const txResponse = await axios.get(`${this.apiUrl}/tx/${txid}/status`);
            const status = txResponse.data;
            
            return {
                txid,
                vout,
                value: output.value,
                status: {
                    confirmed: status.confirmed,
                    block_height: status.block_height,
                    block_hash: status.block_hash
                },
                scriptPubKey: output.scriptPubKey.hex
            };
        } catch (error: any) {
            logger.error(`Failed to fetch UTXO ${txid}:${vout}: ${error.message}`);
            return null;
        }
    }

    /**
     * Select UTXOs for a target amount using coin selection algorithm
     */
    async selectUTXOs(
        address: string, 
        targetAmount: number, 
        feeRate: number = 10
    ): Promise<{ utxos: UTXO[], total: number, change: number }> {
        const availableUTXOs = await this.getUTXOs(address);
        
        // Sort UTXOs by value (largest first for now - simple algorithm)
        availableUTXOs.sort((a, b) => b.value - a.value);
        
        const selectedUTXOs: UTXO[] = [];
        let totalSelected = 0;
        
        // Estimate transaction size and fee
        // Rough estimate: 10 + (148 * numInputs) + (34 * 2) bytes
        const estimateFee = (numInputs: number) => {
            const estimatedSize = 10 + (148 * numInputs) + (34 * 2);
            return estimatedSize * feeRate;
        };
        
        // Select UTXOs until we have enough for amount + fee
        for (const utxo of availableUTXOs) {
            selectedUTXOs.push(utxo);
            totalSelected += utxo.value;
            
            const estimatedFee = estimateFee(selectedUTXOs.length);
            const totalNeeded = targetAmount + estimatedFee;
            
            if (totalSelected >= totalNeeded) {
                const change = totalSelected - totalNeeded;
                logger.info(`Selected ${selectedUTXOs.length} UTXOs: total=${totalSelected}, change=${change}`);
                return { utxos: selectedUTXOs, total: totalSelected, change };
            }
        }
        
        // Not enough funds
        const estimatedFee = estimateFee(selectedUTXOs.length || 1);
        const needed = targetAmount + estimatedFee;
        throw new Error(`Insufficient funds: have ${totalSelected}, need ${needed}`);
    }

    /**
     * Get available balance for an address
     */
    async getAvailableBalance(address: string): Promise<number> {
        const utxos = await this.getUTXOs(address);
        return utxos.reduce((total, utxo) => total + utxo.value, 0);
    }

    /**
     * Mark a UTXO as spent (to prevent double spending)
     */
    markAsSpent(txid: string, vout: number): void {
        const key = `${txid}:${vout}`;
        this.spentUTXOs.add(key);
        logger.info(`Marked UTXO as spent: ${key}`);
    }

    /**
     * Mark multiple UTXOs as spent
     */
    markUTXOsAsSpent(utxos: UTXO[]): void {
        utxos.forEach(utxo => this.markAsSpent(utxo.txid, utxo.vout));
    }

    /**
     * Clear a UTXO from spent set (if transaction failed)
     */
    clearSpent(txid: string, vout: number): void {
        const key = `${txid}:${vout}`;
        this.spentUTXOs.delete(key);
        logger.info(`Cleared spent status for UTXO: ${key}`);
    }

    /**
     * Wait for transaction confirmation
     */
    async waitForConfirmation(
        txid: string, 
        requiredConfirmations: number = 1,
        timeoutMs: number = 600000 // 10 minutes
    ): Promise<boolean> {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeoutMs) {
            try {
                const response = await axios.get(`${this.apiUrl}/tx/${txid}/status`);
                const status = response.data;
                
                if (status.confirmed) {
                    // Get current block height
                    const blockResponse = await axios.get(`${this.apiUrl}/blocks/tip/height`);
                    const currentHeight = parseInt(blockResponse.data);
                    const confirmations = currentHeight - status.block_height + 1;
                    
                    logger.info(`Transaction ${txid} has ${confirmations} confirmations`);
                    
                    if (confirmations >= requiredConfirmations) {
                        return true;
                    }
                }
                
                // Wait 10 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 10000));
                
            } catch (error: any) {
                logger.error(`Error checking confirmation status: ${error.message}`);
            }
        }
        
        logger.warn(`Transaction ${txid} confirmation timeout after ${timeoutMs}ms`);
        return false;
    }

    /**
     * Estimate optimal fee rate based on network conditions with multiple fallbacks
     */
    async estimateOptimalFeeRate(): Promise<number> {
        const feeApis = [
            {
                name: 'mempool.space',
                url: this.apiUrl.includes('testnet') 
                    ? 'https://mempool.space/testnet/api/v1/fees/recommended'
                    : 'https://mempool.space/api/v1/fees/recommended',
                parseResponse: (data: any) => data.economyFee || data.halfHourFee || 10
            },
            {
                name: 'blockstream.info',
                url: `${this.apiUrl}/fee-estimates`,
                parseResponse: (data: any) => {
                    // Blockstream returns fee estimates for different confirmation targets
                    // Use 6 block target (economy fee) or fallback to available targets
                    return data['6'] || data['10'] || data['25'] || Object.values(data)[0] || 10;
                }
            },
            {
                name: 'blockchair.com',
                url: this.apiUrl.includes('testnet')
                    ? 'https://api.blockchair.com/bitcoin/testnet/stats'
                    : 'https://api.blockchair.com/bitcoin/stats',
                parseResponse: (data: any) => {
                    // Blockchair provides suggested fee rates
                    return data.data?.suggested_transaction_fee_per_byte_sat || 10;
                }
            }
        ];

        const failedApis: string[] = [];
        
        for (const api of feeApis) {
            try {
                logger.debug(`Trying fee estimation from ${api.name}...`);
                
                const response = await axios.get(api.url, {
                    timeout: 5000, // 5 second timeout per API
                    headers: {
                        'User-Agent': '1inch-Fusion-Bitcoin-Relayer/1.0'
                    }
                });
                
                const feeRate = api.parseResponse(response.data);
                
                if (feeRate && feeRate > 0 && feeRate < 1000) { // Sanity check
                    // Success! Log any previous failures only at debug level if we got a result
                    if (failedApis.length > 0) {
                        logger.debug(`Previous API failures: ${failedApis.join(', ')} - but got fee rate from ${api.name}`);
                    }
                    logger.info(` Fee rate from ${api.name}: ${feeRate} sat/vB`);
                    return Math.max(feeRate, 1); // Minimum 1 sat/vB
                }
                
                logger.debug(`Invalid fee rate from ${api.name}: ${feeRate}`);
                failedApis.push(`${api.name} (invalid rate)`);
                
            } catch (error: any) {
                logger.debug(`${api.name} unavailable: ${error.message}`);
                failedApis.push(`${api.name} (${error.response?.status || 'error'})`);
                continue;
            }
        }
        
        // All APIs failed, use intelligent default based on network
        const defaultFee = this.apiUrl.includes('testnet') ? 5 : 15;
        logger.warn(`All fee APIs failed (${failedApis.join(', ')}), using network default: ${defaultFee} sat/vB`);
        return defaultFee;
    }

    /**
     * Get cached fee rate with periodic refresh
     */
    private cachedFeeRate: number | null = null;
    private lastFeeUpdate: number = 0;
    private readonly FEE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    async getCachedFeeRate(): Promise<number> {
        const now = Date.now();
        
        // Return cached rate if still valid
        if (this.cachedFeeRate && (now - this.lastFeeUpdate) < this.FEE_CACHE_DURATION) {
            logger.debug(`Using cached fee rate: ${this.cachedFeeRate} sat/vB`);
            return this.cachedFeeRate;
        }
        
        // Refresh fee rate
        try {
            const newFeeRate = await this.estimateOptimalFeeRate();
            this.cachedFeeRate = newFeeRate;
            this.lastFeeUpdate = now;
            return newFeeRate;
        } catch (error: any) {
            logger.error(`Failed to refresh fee rate: ${error.message}`);
            
            // Return last known rate or fallback
            if (this.cachedFeeRate) {
                logger.warn(`Using stale cached fee rate: ${this.cachedFeeRate} sat/vB`);
                return this.cachedFeeRate;
            }
            
            const fallback = this.apiUrl.includes('testnet') ? 5 : 15;
            logger.warn(`Using emergency fallback fee rate: ${fallback} sat/vB`);
            return fallback;
        }
    }

    /**
     * Get transaction details
     */
    async getTransaction(txid: string): Promise<any> {
        try {
            const response = await axios.get(`${this.apiUrl}/tx/${txid}`);
            return response.data;
        } catch (error: any) {
            logger.error(`Failed to fetch transaction ${txid}: ${error.message}`);
            throw new Error(`Failed to fetch transaction: ${error.message}`);
        }
    }

    /**
     * Get raw transaction hex
     */
    async getRawTransaction(txid: string): Promise<string> {
        try {
            const response = await axios.get(`${this.apiUrl}/tx/${txid}/hex`);
            return response.data;
        } catch (error: any) {
            logger.error(`Failed to fetch raw transaction ${txid}: ${error.message}`);
            throw new Error(`Failed to fetch raw transaction: ${error.message}`);
        }
    }
}