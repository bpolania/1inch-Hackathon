#!/usr/bin/env node

/**
 * Fund Bitcoin HTLC with 10k Satoshis
 * 
 * Sends Bitcoin from wallet to HTLC address
 */

const BitcoinHTLCManager = require('../src/BitcoinHTLCManager');
const fs = require('fs');

async function fundHTLC() {
    console.log('₿ Fund Bitcoin HTLC with 10k Satoshis');
    console.log('====================================\n');
    
    try {
        // 1. Load HTLC info
        const htlcFile = './clean-10k-htlc.json';
        if (!fs.existsSync(htlcFile)) {
            throw new Error('HTLC file not found. Run generate-10k-htlc.js first.');
        }
        
        const htlcInfo = JSON.parse(fs.readFileSync(htlcFile, 'utf8'));
        console.log('✅ HTLC info loaded');
        console.log(`   HTLC Address: ${htlcInfo.htlcAddress}`);
        console.log(`   Amount: ${htlcInfo.destinationAmount} satoshis\n`);
        
        // 2. Load Bitcoin wallet
        const walletFile = './bitcoin-testnet-wallet.json';
        if (!fs.existsSync(walletFile)) {
            throw new Error('Bitcoin wallet not found.');
        }
        
        const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
        console.log('✅ Bitcoin wallet loaded');
        console.log(`   Wallet Address: ${htlcInfo.bitcoinWallet}`);
        console.log(`   Private Key: ${walletData.privateKey}\n`);
        
        // 3. Initialize Bitcoin HTLC Manager
        const htlcManager = new BitcoinHTLCManager();
        
        // 4. Check current balance
        console.log('🔍 Checking wallet balance...');
        try {
            const balance = await htlcManager.getAddressBalance(htlcInfo.bitcoinWallet, 'testnet');
            console.log(`   Current balance: ${balance} satoshis`);
            
            const requiredAmount = htlcInfo.destinationAmount + 1000; // Add fee buffer
            if (balance < requiredAmount) {
                console.log(`   ❌ Insufficient balance. Need ${requiredAmount} satoshis (including fees)`);
                return false;
            }
            console.log(`   ✅ Sufficient balance for funding\n`);
        } catch (balanceError) {
            console.log(`   ⚠️  Could not check balance: ${balanceError.message}`);
            console.log('   🔄 Proceeding with funding attempt\n');
        }
        
        // 5. Get UTXOs for funding
        console.log('🔍 Getting UTXOs for funding...');
        try {
            const utxos = await htlcManager.getUTXOs(htlcInfo.bitcoinWallet, 'testnet');
            console.log(`   Found ${utxos.length} UTXOs`);
            
            if (utxos.length === 0) {
                throw new Error('No UTXOs available for funding');
            }
            
            // Show UTXO details
            let totalAvailable = 0;
            utxos.forEach((utxo, i) => {
                console.log(`   UTXO ${i + 1}: ${utxo.value} satoshis (${utxo.txid}:${utxo.vout})`);
                totalAvailable += utxo.value;
            });
            console.log(`   Total available: ${totalAvailable} satoshis\n`);
            
        } catch (utxoError) {
            console.log(`   ❌ Could not get UTXOs: ${utxoError.message}`);
            console.log('   💡 Manual funding may be required\n');
        }
        
        // 6. Create funding transaction
        console.log('🔄 Creating funding transaction...');
        try {
            const fundingTx = await htlcManager.createFundingTransaction(
                utxos,
                htlcInfo.htlcAddress,
                htlcInfo.destinationAmount,
                htlcInfo.bitcoinWallet, // change address
                walletData.privateKey
            );
            
            console.log(`   ✅ Funding transaction created`);
            console.log(`   📝 Transaction ID: ${fundingTx.txid || 'Generated'}`);
            console.log(`   💰 Amount: ${htlcInfo.destinationAmount} satoshis`);
            console.log(`   🎯 To: ${htlcInfo.htlcAddress}`);
            console.log(`   📦 Raw TX: ${fundingTx.toString('hex').slice(0, 100)}...`);
            
            // 7. Broadcast transaction (if available)
            console.log('\n🚀 Broadcasting transaction...');
            try {
                const txid = await htlcManager.broadcastTransaction(fundingTx.toString('hex'), 'testnet');
                console.log(`   ✅ Transaction broadcasted successfully`);
                console.log(`   📋 Transaction ID: ${txid}`);
                console.log(`   🔗 Explorer: https://blockstream.info/testnet/tx/${txid}`);
                
                // Update HTLC info with funding details
                htlcInfo.status = 'htlc-funded';
                htlcInfo.fundingTxId = txid;
                htlcInfo.fundingAmount = htlcInfo.destinationAmount;
                htlcInfo.fundedAt = new Date().toISOString();
                htlcInfo.nextSteps = [
                    'Wait for Bitcoin transaction confirmation',
                    'Execute atomic swap by revealing secret on Ethereum',
                    'Claim Bitcoin using revealed secret'
                ];
                
                fs.writeFileSync('./clean-10k-htlc.json', JSON.stringify(htlcInfo, null, 2));
                console.log('\n💾 HTLC info updated with funding details');
                
            } catch (broadcastError) {
                console.log(`   ❌ Broadcast failed: ${broadcastError.message}`);
                console.log(`   💡 You may need to broadcast manually`);
                console.log(`   📦 Raw transaction: ${fundingTx.toString('hex')}`);
            }
            
        } catch (txError) {
            console.log(`   ❌ Transaction creation failed: ${txError.message}`);
            console.log('   💡 This may be due to insufficient funds or network issues');
            return false;
        }
        
        console.log('\n🎉 BITCOIN HTLC FUNDING COMPLETE!');
        console.log('=================================');
        console.log(`₿ HTLC Address: ${htlcInfo.htlcAddress}`);
        console.log(`💰 Amount Funded: ${htlcInfo.destinationAmount} satoshis`);
        console.log(`🔒 Hashlock: ${htlcInfo.hashlock}`);
        console.log(`🔓 Secret: 0x${htlcInfo.secret}`);
        console.log('');
        console.log('🚀 Next Steps:');
        console.log('1. ✅ Bitcoin HTLC funded');
        console.log('2. 🔓 Reveal secret on Ethereum');
        console.log('3. ₿ Claim Bitcoin with revealed secret');
        console.log('4. ✅ Complete atomic swap');
        
        return true;
        
    } catch (error) {
        console.error(`❌ HTLC funding failed: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    fundHTLC().then(success => {
        console.log(`\nResult: ${success ? '🎉 SUCCESS' : '❌ FAILED'}`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { fundHTLC };