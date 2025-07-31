#!/usr/bin/env node

/**
 * Generate Bitcoin HTLC - Production Script
 * 
 * Generates Bitcoin HTLC script and address for atomic swaps
 * Consolidated from multiple HTLC generation scripts
 */

const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').default;
const tinysecp = require('tiny-secp256k1');
const crypto = require('crypto');
const fs = require('fs');

// Initialize bitcoin-js
bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

async function generateBitcoinHTLC(options = {}) {
    const {
        network = 'testnet',
        amount = 10000,              // satoshis
        timelock = 144,              // blocks (~24 hours)
        secret = null,               // Use existing secret or generate new
        hashlock = null              // Use existing hashlock or generate from secret
    } = options;

    console.log('₿ Generate Bitcoin HTLC');
    console.log('=======================\n');
    
    try {
        // Setup network
        const btcNetwork = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
        console.log(`🌐 Network: Bitcoin ${network}`);
        console.log(`💰 Amount: ${amount} satoshis`);
        console.log(`⏰ Timelock: ${timelock} blocks\n`);
        
        // Generate or use existing secret/hashlock
        let secretBuffer, hashlockHex;
        
        if (secret && hashlock) {
            secretBuffer = Buffer.from(secret, 'hex');
            hashlockHex = hashlock;
            console.log('🔐 Using provided secret/hashlock');
        } else if (secret) {
            secretBuffer = Buffer.from(secret, 'hex');
            hashlockHex = require('ethers').keccak256(secretBuffer);
            console.log('🔐 Using provided secret, computed hashlock');
        } else {
            secretBuffer = crypto.randomBytes(32);
            hashlockHex = require('ethers').keccak256(secretBuffer);
            console.log('🔐 Generated new secret/hashlock');
        }
        
        console.log(`   Secret: 0x${secretBuffer.toString('hex')}`);
        console.log(`   Hashlock: ${hashlockHex}\n`);
        
        // Load or generate Bitcoin wallet
        let walletData;
        const walletFile = './bitcoin-testnet-wallet.json';
        
        if (fs.existsSync(walletFile)) {
            walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
            console.log('✅ Loaded existing Bitcoin wallet');
        } else {
            // Generate new wallet
            const keyPair = ECPair.makeRandom({ network: btcNetwork });
            const p2pkh = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: btcNetwork });
            const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: btcNetwork });
            
            walletData = {
                network: network,
                privateKey: keyPair.toWIF(),
                publicKey: keyPair.publicKey.toString('hex'),
                addresses: {
                    p2pkh: p2pkh.address,
                    p2wpkh: p2wpkh.address
                }
            };
            
            fs.writeFileSync(walletFile, JSON.stringify(walletData, null, 2));
            console.log('✅ Generated new Bitcoin wallet');
        }
        
        console.log(`   Address: ${walletData.addresses.p2wpkh}\n`);
        
        // Generate key pairs for HTLC
        const keyPair = ECPair.fromWIF(walletData.privateKey, btcNetwork);
        const recipientKeyPair = keyPair; // Recipient (can claim with secret)
        const refundKeyPair = keyPair;    // Refund (can claim after timelock)
        
        // Create HTLC script
        console.log('🔨 Creating HTLC script...');
        
        // HTLC Script: 
        // OP_IF
        //   OP_SHA256 <hashlock> OP_EQUALVERIFY <recipient_pubkey> OP_CHECKSIG
        // OP_ELSE
        //   <timelock> OP_CHECKLOCKTIMEVERIFY OP_DROP <refund_pubkey> OP_CHECKSIG
        // OP_ENDIF
        
        const hashlockBuffer = Buffer.from(hashlockHex.slice(2), 'hex'); // Remove 0x prefix
        const timelockBuffer = bitcoin.script.number.encode(timelock);
        
        const htlcScript = bitcoin.script.compile([
            bitcoin.opcodes.OP_IF,
                bitcoin.opcodes.OP_SHA256,
                hashlockBuffer,
                bitcoin.opcodes.OP_EQUALVERIFY,
                recipientKeyPair.publicKey,
                bitcoin.opcodes.OP_CHECKSIG,
            bitcoin.opcodes.OP_ELSE,
                timelockBuffer,
                bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
                bitcoin.opcodes.OP_DROP,
                refundKeyPair.publicKey,
                bitcoin.opcodes.OP_CHECKSIG,
            bitcoin.opcodes.OP_ENDIF
        ]);
        
        // Create P2SH address for the HTLC
        const p2sh = bitcoin.payments.p2sh({
            redeem: { output: htlcScript, network: btcNetwork },
            network: btcNetwork
        });
        
        const htlcAddress = p2sh.address;
        console.log(`✅ HTLC script created (${htlcScript.length} bytes)`);
        console.log(`✅ HTLC address: ${htlcAddress}\n`);
        
        // Save HTLC information
        const htlcInfo = {
            timestamp: new Date().toISOString(),
            network: network,
            amount: amount,
            timelock: timelock,
            secret: secretBuffer.toString('hex'),
            hashlock: hashlockHex,
            htlcAddress: htlcAddress,
            htlcScript: htlcScript.toString('hex'),
            recipientPubKey: recipientKeyPair.publicKey.toString('hex'),
            refundPubKey: refundKeyPair.publicKey.toString('hex'),
            bitcoinWallet: walletData.addresses.p2wpkh,
            status: 'htlc-generated',
            nextSteps: [
                'Fund the HTLC address with the specified amount',
                'Wait for funding confirmation',
                'Execute atomic swap by revealing secret'
            ]
        };
        
        const filename = `bitcoin-htlc-${amount}-${Date.now()}.json`;
        fs.writeFileSync(`./${filename}`, JSON.stringify(htlcInfo, null, 2));
        
        console.log('🎉 BITCOIN HTLC GENERATED SUCCESSFULLY!');
        console.log('======================================');
        console.log(`₿ HTLC Address: ${htlcAddress}`);
        console.log(`💰 Amount: ${amount} satoshis`);
        console.log(`⏰ Timelock: ${timelock} blocks`);
        console.log(`🔐 Secret: 0x${secretBuffer.toString('hex')}`);
        console.log(`🔒 Hashlock: ${hashlockHex}`);
        console.log(`💾 Details saved: ${filename}`);
        console.log('');
        console.log('Next steps:');
        console.log(`1. Send ${amount} satoshis to: ${htlcAddress}`);
        console.log('2. Wait for transaction confirmation');
        console.log('3. Execute atomic swap using the secret');
        console.log('');
        console.log(`🔗 Monitor address: https://blockstream.info/${network === 'testnet' ? 'testnet/' : ''}address/${htlcAddress}`);
        
        return htlcInfo;
        
    } catch (error) {
        console.error(`❌ Failed to generate Bitcoin HTLC: ${error.message}`);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse CLI arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        
        if (key === 'network') options.network = value;
        if (key === 'amount') options.amount = parseInt(value);
        if (key === 'timelock') options.timelock = parseInt(value);
        if (key === 'secret') options.secret = value;
        if (key === 'hashlock') options.hashlock = value;
    }
    
    generateBitcoinHTLC(options).then(htlcInfo => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ Script failed:', error.message);
        process.exit(1);
    });
}

module.exports = { generateBitcoinHTLC };