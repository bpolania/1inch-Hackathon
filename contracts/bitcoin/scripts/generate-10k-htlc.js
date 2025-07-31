#!/usr/bin/env node

/**
 * Generate Bitcoin HTLC for 10k Satoshi Clean Order
 * 
 * Creates Bitcoin HTLC matching the clean Ethereum order
 */

const BitcoinHTLCManager = require('../src/BitcoinHTLCManager');
const fs = require('fs');
const crypto = require('crypto');

async function generate10kHTLC() {
    console.log('₿ Generate Bitcoin HTLC for 10k Satoshis');
    console.log('=========================================\n');
    
    try {
        // 1. Load clean order info
        const cleanOrderFile = './clean-10k-order.json';
        if (!fs.existsSync(cleanOrderFile)) {
            throw new Error('Clean order file not found. Run create-clean-10k-order.js first.');
        }
        
        const orderInfo = JSON.parse(fs.readFileSync(cleanOrderFile, 'utf8'));
        console.log('✅ Clean order info loaded');
        console.log(`   Order Hash: ${orderInfo.orderHash}`);
        console.log(`   Amount: ${orderInfo.destinationAmount} satoshis`);
        console.log(`   Secret: 0x${orderInfo.secret}`);
        console.log(`   Hashlock: ${orderInfo.hashlock}\n`);
        
        // 2. Load Bitcoin wallet
        const walletFile = './bitcoin-testnet-wallet.json';
        if (!fs.existsSync(walletFile)) {
            throw new Error('Bitcoin wallet not found. Run setup-live-testnet.js first.');
        }
        
        const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
        console.log('✅ Bitcoin wallet loaded');
        console.log(`   Address: ${walletData.address || 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc'}\n`);
        
        // 3. Initialize Bitcoin HTLC Manager
        const htlcManager = new BitcoinHTLCManager();
        console.log('📋 Bitcoin HTLC Manager initialized\n');
        
        // 4. Convert secret from hex to Buffer
        const secret = Buffer.from(orderInfo.secret, 'hex');
        const hashlock = Buffer.from(orderInfo.hashlock.slice(2), 'hex'); // Remove '0x' prefix
        
        console.log('🔐 Atomic Swap Parameters:');
        console.log(`   Secret: 0x${secret.toString('hex')}`);
        console.log(`   Hashlock: 0x${hashlock.toString('hex')}`);
        
        // Note: Ethereum used keccak256, Bitcoin will use same for compatibility
        // The hashlock from Ethereum is already the correct hash we need to use
        console.log(`   Hash Algorithm: Keccak256 (Ethereum compatible)`);
        console.log(`   Cross-chain Coordination: ✅ READY\n`);
        
        // 5. Generate key pairs for HTLC
        const recipientKeyPair = htlcManager.generateKeyPair();
        const refundKeyPair = htlcManager.generateKeyPair();
        
        console.log('🔑 Generated HTLC Key Pairs:');
        console.log(`   Recipient PubKey: ${recipientKeyPair.publicKey.toString('hex')}`);
        console.log(`   Refund PubKey: ${refundKeyPair.publicKey.toString('hex')}\n`);
        
        // 6. Create HTLC Script
        const htlcTimelock = 144; // 24 hours in blocks
        const htlcScript = htlcManager.generateHTLCScript(
            hashlock.toString('hex'),
            recipientKeyPair.publicKey,
            refundKeyPair.publicKey,
            htlcTimelock
        );
        
        console.log('📝 HTLC Script Generated:');
        console.log(`   Script: ${htlcScript.toString('hex')}`);
        console.log(`   Timelock: ${htlcTimelock} blocks (~24 hours)\n`);
        
        // 7. Create HTLC P2SH Address
        const htlcAddress = htlcManager.createHTLCAddress(htlcScript);
        console.log('🏠 HTLC Address Created:');
        console.log(`   Address: ${htlcAddress}`);
        console.log(`   Type: P2SH (Pay to Script Hash)\n`);
        
        // 8. Save HTLC information
        const htlcInfo = {
            orderType: 'clean-10k-satoshi-htlc',
            timestamp: new Date().toISOString(),
            // Ethereum order details
            ethereumOrderHash: orderInfo.orderHash,
            ethereumTxHash: orderInfo.transactionHash,
            ethereumBlockNumber: orderInfo.blockNumber,
            // Shared secret coordination
            secret: secret.toString('hex'),
            hashlock: '0x' + hashlock.toString('hex'),
            // Bitcoin HTLC details
            htlcAddress,
            htlcScript: htlcScript.toString('hex'),
            htlcTimelock,
            recipientPubKey: recipientKeyPair.publicKey.toString('hex'),
            refundPubKey: refundKeyPair.publicKey.toString('hex'),
            // Amount details
            sourceAmount: orderInfo.sourceAmount, // DT tokens on Ethereum
            destinationAmount: orderInfo.destinationAmount, // 10k satoshis
            // Wallet info
            bitcoinWallet: walletData.address || 'tb1qeh7mp4ctkys5dxawwtkmtk3cvh0xvq0pzstxqc',
            network: 'testnet',
            status: 'htlc-created',
            nextSteps: [
                `Send exactly ${orderInfo.destinationAmount} satoshis to ${htlcAddress}`,
                'Wait for Bitcoin transaction confirmation',
                'Execute atomic swap by revealing secret'
            ]
        };
        
        fs.writeFileSync('./clean-10k-htlc.json', JSON.stringify(htlcInfo, null, 2));
        console.log('💾 HTLC information saved to clean-10k-htlc.json\n');
        
        // 9. Summary
        console.log('🎉 BITCOIN HTLC GENERATED SUCCESSFULLY!');
        console.log('======================================');
        console.log(`₿ HTLC Address: ${htlcAddress}`);
        console.log(`💰 Amount to Send: ${orderInfo.destinationAmount} satoshis (${orderInfo.destinationAmount/100000000} BTC)`);
        console.log(`🔒 Hashlock: 0x${hashlock.toString('hex')}`);
        console.log(`🔓 Secret: 0x${secret.toString('hex')}`);
        console.log(`⏰ Timelock: ${htlcTimelock} blocks`);
        console.log(`🔗 Ethereum Order: https://sepolia.etherscan.io/tx/${orderInfo.transactionHash}`);
        console.log('');
        console.log('🚀 Next Step:');
        console.log(`📤 Send exactly ${orderInfo.destinationAmount} satoshis from your wallet to:`);
        console.log(`   ${htlcAddress}`);
        console.log('');
        console.log('💡 Use Bitcoin testnet wallet or block explorer to send the transaction');
        
        return htlcInfo;
        
    } catch (error) {
        console.error(`❌ HTLC generation failed: ${error.message}`);
        return null;
    }
}

if (require.main === module) {
    generate10kHTLC().then(result => {
        console.log(`\nResult: ${result ? '🎉 SUCCESS' : '❌ FAILED'}`);
        process.exit(result ? 0 : 1);
    });
}

module.exports = { generate10kHTLC };