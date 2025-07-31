#!/usr/bin/env node

/**
 * Automated Bitcoin HTLC Funding
 * 
 * Automatically creates and broadcasts the Bitcoin funding transaction
 */

const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').default;
const tinysecp = require('tiny-secp256k1');
const axios = require('axios');
const fs = require('fs');

// Initialize bitcoin-js
bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

async function automatedFunding() {
    console.log('₿ Automated Bitcoin HTLC Funding');
    console.log('================================\n');
    
    try {
        // 1. Load HTLC and wallet info
        const htlcInfo = JSON.parse(fs.readFileSync('./clean-10k-htlc.json', 'utf8'));
        const walletData = JSON.parse(fs.readFileSync('./bitcoin-testnet-wallet.json', 'utf8'));
        
        console.log('✅ Configuration loaded');
        console.log(`   From: ${htlcInfo.bitcoinWallet}`);
        console.log(`   To: ${htlcInfo.htlcAddress}`);
        console.log(`   Amount: ${htlcInfo.destinationAmount} satoshis\n`);
        
        // 2. Setup Bitcoin network and key
        const network = bitcoin.networks.testnet;
        const keyPair = ECPair.fromWIF(walletData.privateKey, network);
        
        console.log('🔑 Wallet setup complete');
        console.log(`   Private Key: ${walletData.privateKey}`);
        console.log(`   Public Key: ${keyPair.publicKey.toString('hex')}\n`);
        
        // 3. Get UTXOs from wallet
        console.log('🔍 Fetching UTXOs...');
        const response = await axios.get(`https://blockstream.info/testnet/api/address/${htlcInfo.bitcoinWallet}/utxo`);
        const utxos = response.data;
        
        console.log(`   Found ${utxos.length} UTXOs:`);
        let totalAvailable = 0;
        utxos.forEach((utxo, i) => {
            console.log(`   UTXO ${i + 1}: ${utxo.value} sats (${utxo.txid}:${utxo.vout})`);
            totalAvailable += utxo.value;
        });
        console.log(`   Total: ${totalAvailable} satoshis\n`);
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs found. Wallet may be empty.');
        }
        
        // 4. Calculate amounts
        const targetAmount = htlcInfo.destinationAmount; // 10,000 satoshis
        const feeRate = 10; // sat/byte
        const estimatedTxSize = 250; // bytes (rough estimate)
        const fee = feeRate * estimatedTxSize;
        const totalNeeded = targetAmount + fee;
        
        console.log('💰 Transaction Planning:');
        console.log(`   Target amount: ${targetAmount} satoshis`);
        console.log(`   Estimated fee: ${fee} satoshis`);
        console.log(`   Total needed: ${totalNeeded} satoshis`);
        console.log(`   Available: ${totalAvailable} satoshis`);
        
        if (totalAvailable < totalNeeded) {
            throw new Error(`Insufficient funds. Need ${totalNeeded}, have ${totalAvailable}`);
        }
        console.log(`   Status: ✅ Sufficient funds\n`);
        
        // 5. Create transaction
        console.log('🔄 Building transaction...');
        const psbt = new bitcoin.Psbt({ network });
        
        // Add inputs
        let inputTotal = 0;
        for (const utxo of utxos) {
            if (inputTotal >= totalNeeded) break;
            
            // Get full transaction for this UTXO
            const txResponse = await axios.get(`https://blockstream.info/testnet/api/tx/${utxo.txid}/hex`);
            const fullTx = Buffer.from(txResponse.data, 'hex');
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: fullTx,
            });
            
            inputTotal += utxo.value;
            console.log(`   Added input: ${utxo.value} sats`);
        }
        
        // Add output to HTLC address
        psbt.addOutput({
            address: htlcInfo.htlcAddress,
            value: targetAmount,
        });
        console.log(`   Added HTLC output: ${targetAmount} sats`);
        
        // Add change output if needed
        const change = inputTotal - targetAmount - fee;
        if (change > 546) { // Dust threshold
            psbt.addOutput({
                address: htlcInfo.bitcoinWallet,
                value: change,
            });
            console.log(`   Added change output: ${change} sats`);
        }
        
        // 6. Sign transaction
        console.log('\n🔐 Signing transaction...');
        for (let i = 0; i < psbt.inputCount; i++) {
            psbt.signInput(i, keyPair);
        }
        
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        const txid = tx.getId();
        
        console.log(`   ✅ Transaction signed`);
        console.log(`   📝 Transaction ID: ${txid}`);
        console.log(`   📦 Size: ${tx.toBuffer().length} bytes`);
        console.log(`   ⛽ Actual fee: ${inputTotal - targetAmount - change} sats\n`);
        
        // 7. Broadcast transaction
        console.log('🚀 Broadcasting transaction...');
        try {
            const broadcastResponse = await axios.post('https://blockstream.info/testnet/api/tx', txHex);
            console.log(`   ✅ Transaction broadcasted successfully!`);
            console.log(`   📋 Transaction ID: ${txid}`);
            console.log(`   🔗 Explorer: https://blockstream.info/testnet/tx/${txid}`);
            
            // 8. Update HTLC info
            htlcInfo.status = 'htlc-funded';
            htlcInfo.fundingTxId = txid;
            htlcInfo.fundingAmount = targetAmount;
            htlcInfo.fundedAt = new Date().toISOString();
            htlcInfo.fundingTxHex = txHex;
            htlcInfo.nextSteps = [
                'Wait for Bitcoin transaction confirmation (1-6 blocks)',
                'Execute atomic swap by revealing secret on Ethereum',
                'Claim Bitcoin using revealed secret'
            ];
            
            fs.writeFileSync('./clean-10k-htlc.json', JSON.stringify(htlcInfo, null, 2));
            console.log('\n💾 HTLC info updated with funding transaction');
            
            console.log('\n🎉 BITCOIN HTLC FUNDED SUCCESSFULLY!');
            console.log('===================================');
            console.log(`₿ HTLC Address: ${htlcInfo.htlcAddress}`);
            console.log(`💰 Amount: ${targetAmount} satoshis`);
            console.log(`📋 TX ID: ${txid}`);
            console.log(`🔗 Explorer: https://blockstream.info/testnet/tx/${txid}`);
            console.log(`🔒 Hashlock: ${htlcInfo.hashlock}`);
            console.log(`🔓 Secret: 0x${htlcInfo.secret}`);
            console.log('');
            console.log('⏳ Next: Wait for 1 confirmation, then execute atomic swap!');
            
            return { success: true, txid, htlcInfo };
            
        } catch (broadcastError) {
            console.log(`   ❌ Broadcast failed: ${broadcastError.message}`);
            console.log(`   💡 You can broadcast manually with this hex:`);
            console.log(`   📦 ${txHex}`);
            
            return { success: false, txHex, txid };
        }
        
    } catch (error) {
        console.error(`❌ Automated funding failed: ${error.message}`);
        
        if (error.response) {
            console.error(`   API Error: ${error.response.status} - ${error.response.statusText}`);
        }
        
        return { success: false, error: error.message };
    }
}

if (require.main === module) {
    automatedFunding().then(result => {
        console.log(`\nResult: ${result.success ? '🎉 SUCCESS' : '❌ FAILED'}`);
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = { automatedFunding };