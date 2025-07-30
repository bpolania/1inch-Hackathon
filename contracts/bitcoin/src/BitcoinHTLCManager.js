const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').default;
const tinysecp = require('tiny-secp256k1');
const crypto = require('crypto');
const axios = require('axios');

// Initialize bitcoin-js with tiny-secp256k1
bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

/**
 * Bitcoin HTLC Manager for 1inch Fusion+ Cross-Chain Atomic Swaps
 * 
 * This module provides Bitcoin-side functionality for atomic swaps with Ethereum,
 * supporting the 1inch Fusion+ protocol extension for Bitcoin family blockchains.
 */
class BitcoinHTLCManager {
    constructor(config = {}) {
        this.network = config.network || bitcoin.networks.testnet;
        this.apiBaseUrl = this.getApiUrl();
        this.orders = new Map(); // Store HTLC orders
        this.config = {
            minConfirmations: config.minConfirmations || 1,
            htlcTimelock: config.htlcTimelock || 144, // 24 hours in blocks
            dustThreshold: config.dustThreshold || 546, // Standard Bitcoin dust limit
            feeRate: config.feeRate || 10, // satoshis per byte
            ...config
        };
    }

    /**
     * Get the appropriate API URL for the Bitcoin network
     */
    getApiUrl() {
        if (this.network === bitcoin.networks.bitcoin) {
            return 'https://blockstream.info/api';
        } else {
            return 'https://blockstream.info/testnet/api';
        }
    }

    /**
     * Generate a new Bitcoin HTLC script
     * Compatible with 1inch Fusion+ hashlock format (SHA-256)
     * 
     * @param {string} hashlock - SHA-256 hash of the secret (hex)
     * @param {Buffer} recipientPubKey - Recipient's public key
     * @param {Buffer} refundPubKey - Refund public key (for timelock expiry)
     * @param {number} timelock - Timelock in block height
     * @returns {Buffer} HTLC script
     */
    generateHTLCScript(hashlock, recipientPubKey, refundPubKey, timelock) {
        // Convert hex hashlock to Buffer
        const hashlockBuffer = Buffer.from(hashlock.replace('0x', ''), 'hex');
        
        // Create Bitcoin HTLC script following standard pattern:
        // OP_IF
        //   OP_SHA256 <hashlock> OP_EQUALVERIFY <recipientPubKey> OP_CHECKSIG
        // OP_ELSE
        //   <timelock> OP_CHECKLOCKTIMEVERIFY OP_DROP <refundPubKey> OP_CHECKSIG
        // OP_ENDIF
        
        const script = bitcoin.script.compile([
            bitcoin.opcodes.OP_IF,
            bitcoin.opcodes.OP_SHA256,
            hashlockBuffer,
            bitcoin.opcodes.OP_EQUALVERIFY,
            recipientPubKey,
            bitcoin.opcodes.OP_CHECKSIG,
            bitcoin.opcodes.OP_ELSE,
            bitcoin.script.number.encode(timelock),
            bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
            bitcoin.opcodes.OP_DROP,
            refundPubKey,
            bitcoin.opcodes.OP_CHECKSIG,
            bitcoin.opcodes.OP_ENDIF
        ]);

        return script;
    }

    /**
     * Create a Bitcoin P2SH address from HTLC script
     * 
     * @param {Buffer} htlcScript - The HTLC script
     * @returns {string} P2SH address
     */
    createHTLCAddress(htlcScript) {
        const p2sh = bitcoin.payments.p2sh({
            redeem: { output: htlcScript },
            network: this.network
        });
        return p2sh.address;
    }

    /**
     * Create a funding transaction to the HTLC address
     * 
     * @param {Array} utxos - Available UTXOs for funding
     * @param {string} htlcAddress - HTLC P2SH address
     * @param {number} amount - Amount in satoshis
     * @param {Buffer} changeAddress - Change address public key
     * @param {ECPair} keyPair - Key pair for signing
     * @returns {Object} Transaction hex and details
     */
    async createFundingTransaction(utxos, htlcAddress, amount, changeAddress, keyPair) {
        const psbt = new bitcoin.Psbt({ network: this.network });
        
        let totalInput = 0;
        
        // Add inputs
        for (const utxo of utxos) {
            const txHex = await this.getRawTransaction(utxo.txid);
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: Buffer.from(txHex, 'hex')
            });
            totalInput += utxo.value;
        }

        // Calculate fee
        const estimatedSize = 250; // Rough estimate for P2PKH -> P2SH transaction
        const fee = estimatedSize * this.config.feeRate;
        
        if (totalInput < amount + fee) {
            throw new Error(`Insufficient funds: need ${amount + fee}, have ${totalInput}`);
        }

        // Add HTLC output
        psbt.addOutput({
            address: htlcAddress,
            value: amount
        });

        // Add change output if needed
        const change = totalInput - amount - fee;
        if (change > this.config.dustThreshold) {
            const changeAddr = bitcoin.payments.p2pkh({
                pubkey: changeAddress,
                network: this.network
            }).address;
            
            psbt.addOutput({
                address: changeAddr,
                value: change
            });
        }

        // Sign all inputs
        for (let i = 0; i < utxos.length; i++) {
            psbt.signInput(i, keyPair);
        }

        psbt.finalizeAllInputs();
        
        const tx = psbt.extractTransaction();
        
        return {
            txHex: tx.toHex(),
            txId: tx.getId(),
            htlcVout: 0, // HTLC output is always first
            fee: fee
        };
    }

    /**
     * Create a claiming transaction using the secret preimage
     * 
     * @param {string} htlcTxId - HTLC funding transaction ID
     * @param {number} htlcVout - HTLC output index
     * @param {number} htlcAmount - HTLC output amount in satoshis
     * @param {Buffer} htlcScript - The HTLC script
     * @param {string} secret - Secret preimage (hex)
     * @param {string} recipientAddress - Where to send the claimed funds
     * @param {ECPair} recipientKeyPair - Recipient's key pair
     * @returns {Object} Claiming transaction details
     */
    async createClaimingTransaction(htlcTxId, htlcVout, htlcAmount, htlcScript, secret, recipientAddress, recipientKeyPair) {
        const psbt = new bitcoin.Psbt({ network: this.network });
        
        // Get the funding transaction
        const fundingTxHex = await this.getRawTransaction(htlcTxId);
        
        // Add HTLC input
        psbt.addInput({
            hash: htlcTxId,
            index: htlcVout,
            nonWitnessUtxo: Buffer.from(fundingTxHex, 'hex'),
            redeemScript: htlcScript
        });

        // Calculate fee and output amount
        const estimatedSize = 200; // Rough estimate for claim transaction
        const fee = estimatedSize * this.config.feeRate;
        const outputAmount = htlcAmount - fee;

        if (outputAmount <= this.config.dustThreshold) {
            throw new Error(`Output amount too small after fees: ${outputAmount}`);
        }

        // Add output to recipient
        psbt.addOutput({
            address: recipientAddress,
            value: outputAmount
        });

        // Create witness stack for claiming (secret path)
        const secretBuffer = Buffer.from(secret.replace('0x', ''), 'hex');
        const signature = psbt.signInput(0, recipientKeyPair);
        
        // Finalize with custom witness stack for HTLC claim
        psbt.finalizeInput(0, (inputIndex, input, script) => {
            const payment = bitcoin.payments.p2sh({
                redeem: {
                    output: script,
                    input: bitcoin.script.compile([
                        signature,
                        secretBuffer,
                        bitcoin.opcodes.OP_TRUE // Take the IF path (secret reveal)
                    ])
                }
            });
            return {
                finalScriptSig: payment.input,
                finalScriptWitness: undefined
            };
        });

        const tx = psbt.extractTransaction();
        
        return {
            txHex: tx.toHex(),
            txId: tx.getId(),
            fee: fee,
            outputAmount: outputAmount
        };
    }

    /**
     * Create a refund transaction after timelock expiry
     * 
     * @param {string} htlcTxId - HTLC funding transaction ID
     * @param {number} htlcVout - HTLC output index
     * @param {number} htlcAmount - HTLC output amount in satoshis
     * @param {Buffer} htlcScript - The HTLC script
     * @param {string} refundAddress - Where to send the refunded funds
     * @param {ECPair} refundKeyPair - Refund key pair
     * @param {number} currentBlockHeight - Current blockchain height
     * @returns {Object} Refund transaction details
     */
    async createRefundTransaction(htlcTxId, htlcVout, htlcAmount, htlcScript, refundAddress, refundKeyPair, currentBlockHeight) {
        const psbt = new bitcoin.Psbt({ network: this.network });
        
        // Set locktime to current block height for CLTV
        psbt.setLocktime(currentBlockHeight);
        
        // Get the funding transaction
        const fundingTxHex = await this.getRawTransaction(htlcTxId);
        
        // Add HTLC input with sequence for timelock
        psbt.addInput({
            hash: htlcTxId,
            index: htlcVout,
            sequence: 0xfffffffe, // Enable locktime
            nonWitnessUtxo: Buffer.from(fundingTxHex, 'hex'),
            redeemScript: htlcScript
        });

        // Calculate fee and output amount
        const estimatedSize = 200;
        const fee = estimatedSize * this.config.feeRate;
        const outputAmount = htlcAmount - fee;

        if (outputAmount <= this.config.dustThreshold) {
            throw new Error(`Output amount too small after fees: ${outputAmount}`);
        }

        // Add output to refund address
        psbt.addOutput({
            address: refundAddress,
            value: outputAmount
        });

        // Sign and finalize with refund path
        const signature = psbt.signInput(0, refundKeyPair);
        
        psbt.finalizeInput(0, (inputIndex, input, script) => {
            const payment = bitcoin.payments.p2sh({
                redeem: {
                    output: script,
                    input: bitcoin.script.compile([
                        signature,
                        bitcoin.opcodes.OP_FALSE // Take the ELSE path (timelock refund)
                    ])
                }
            });
            return {
                finalScriptSig: payment.input,
                finalScriptWitness: undefined
            };
        });

        const tx = psbt.extractTransaction();
        
        return {
            txHex: tx.toHex(),
            txId: tx.getId(),
            fee: fee,
            outputAmount: outputAmount
        };
    }

    /**
     * Broadcast a transaction to the Bitcoin network
     * 
     * @param {string} txHex - Transaction hex
     * @returns {Promise<string>} Transaction ID
     */
    async broadcastTransaction(txHex) {
        try {
            const response = await axios.post(`${this.apiBaseUrl}/tx`, txHex, {
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to broadcast transaction: ${error.response?.data || error.message}`);
        }
    }

    /**
     * Get raw transaction hex
     * 
     * @param {string} txId - Transaction ID
     * @returns {Promise<string>} Raw transaction hex
     */
    async getRawTransaction(txId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/tx/${txId}/hex`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get transaction ${txId}: ${error.message}`);
        }
    }

    /**
     * Get UTXOs for an address
     * 
     * @param {string} address - Bitcoin address
     * @returns {Promise<Array>} Array of UTXOs
     */
    async getUTXOs(address) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/address/${address}/utxo`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get UTXOs for ${address}: ${error.message}`);
        }
    }

    /**
     * Get current block height
     * 
     * @returns {Promise<number>} Current block height
     */
    async getCurrentBlockHeight() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/blocks/tip/height`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get block height: ${error.message}`);
        }
    }

    /**
     * Generate a new key pair for Bitcoin
     * 
     * @returns {ECPair} New key pair
     */
    generateKeyPair() {
        return ECPair.makeRandom({ network: this.network });
    }

    /**
     * Generate a new secret for HTLC
     * 
     * @returns {Object} Secret and its SHA-256 hash
     */
    generateSecret() {
        const secret = crypto.randomBytes(32).toString('hex');
        const hashlock = crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
        
        return {
            secret: '0x' + secret,
            hashlock: '0x' + hashlock
        };
    }

    /**
     * Store HTLC order information
     * 
     * @param {string} orderId - Order identifier
     * @param {Object} orderData - Order data
     */
    storeOrder(orderId, orderData) {
        this.orders.set(orderId, {
            ...orderData,
            createdAt: Date.now(),
            status: 'created'
        });
    }

    /**
     * Get HTLC order information
     * 
     * @param {string} orderId - Order identifier
     * @returns {Object} Order data
     */
    getOrder(orderId) {
        return this.orders.get(orderId);
    }

    /**
     * Update order status
     * 
     * @param {string} orderId - Order identifier
     * @param {string} status - New status
     * @param {Object} updateData - Additional data to update
     */
    updateOrder(orderId, status, updateData = {}) {
        const order = this.orders.get(orderId);
        if (order) {
            this.orders.set(orderId, {
                ...order,
                ...updateData,
                status,
                updatedAt: Date.now()
            });
        }
    }
}

module.exports = BitcoinHTLCManager;