#!/usr/bin/env node

/**
 * Bitcoin Testnet Live Setup
 * 
 * Sets up Bitcoin testnet wallet and requests testnet coins for live atomic swap testing
 */

const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').default;
const tinysecp = require('tiny-secp256k1');
const axios = require('axios');
const fs = require('fs');

// Initialize bitcoin-js with tiny-secp256k1
bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

const TESTNET = bitcoin.networks.testnet;
const API_BASE = 'https://blockstream.info/testnet/api';

async function setupLiveTestnet() {
    console.log(' Bitcoin Testnet Live Setup');
    console.log('=============================\n');
    
    try {
        // 1. Generate or load Bitcoin testnet keypair
        console.log(' Step 1: Generate Bitcoin Testnet Wallet');
        console.log('------------------------------------------');
        
        let keyPair;
        const walletFile = './bitcoin-testnet-wallet.json';
        
        if (fs.existsSync(walletFile)) {
            console.log(' Loading existing wallet...');
            const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
            keyPair = ECPair.fromWIF(walletData.privateKey, TESTNET);
            console.log(` Loaded existing wallet`);
        } else {
            console.log(' Creating new wallet...');
            keyPair = ECPair.makeRandom({ network: TESTNET });
            
            const walletData = {
                privateKey: keyPair.toWIF(),
                publicKey: keyPair.publicKey.toString('hex'),
                network: 'testnet',
                created: new Date().toISOString()
            };
            
            fs.writeFileSync(walletFile, JSON.stringify(walletData, null, 2));
            console.log(` New wallet created and saved to ${walletFile}`);
        }
        
        // 2. Generate addresses
        console.log('\n Step 2: Generate Bitcoin Addresses');
        console.log('------------------------------------');
        
        // P2PKH address (legacy)
        const p2pkh = bitcoin.payments.p2pkh({ 
            pubkey: keyPair.publicKey, 
            network: TESTNET 
        });
        
        // P2WPKH address (native segwit)
        const p2wpkh = bitcoin.payments.p2wpkh({ 
            pubkey: keyPair.publicKey, 
            network: TESTNET 
        });
        
        console.log(` P2PKH Address (Legacy): ${p2pkh.address}`);
        console.log(` P2WPKH Address (Segwit): ${p2wpkh.address}`);
        
        // 3. Check current balance
        console.log('\n Step 3: Check Current Balance');
        console.log('--------------------------------');
        
        const addresses = [p2pkh.address, p2wpkh.address];
        let totalBalance = 0;
        const utxos = [];
        
        for (const address of addresses) {
            try {
                const response = await axios.get(`${API_BASE}/address/${address}`);
                const addressInfo = response.data;
                
                console.log(` ${address}:`);
                console.log(`   Balance: ${addressInfo.chain_stats.funded_txo_sum / 100000000} BTC`);
                console.log(`   Transactions: ${addressInfo.chain_stats.tx_count}`);
                
                totalBalance += addressInfo.chain_stats.funded_txo_sum;
                
                // Get UTXOs for this address
                if (addressInfo.chain_stats.funded_txo_sum > 0) {
                    const utxoResponse = await axios.get(`${API_BASE}/address/${address}/utxo`);
                    utxos.push(...utxoResponse.data.map(utxo => ({
                        ...utxo,
                        address: address
                    })));
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            } catch (error) {
                console.log(`   Error checking ${address}: ${error.message}`);
            }
        }
        
        console.log(`\n Total Balance: ${totalBalance / 100000000} BTC`);
        console.log(` Available UTXOs: ${utxos.length}`);
        
        // 4. Request testnet coins if needed
        if (totalBalance < 10000) { // Less than 0.0001 BTC
            console.log('\n Step 4: Request Testnet Coins');
            console.log('--------------------------------');
            console.log(' You need testnet Bitcoin to proceed. Here are testnet faucets:');
            console.log('');
            console.log(' Testnet Faucets:');
            console.log('    https://coinfaucet.eu/en/btc-testnet/');
            console.log('    https://testnet-faucet.mempool.co/');
            console.log('    https://bitcoinfaucet.uo1.net/');
            console.log('');
            console.log(' Use these addresses to request testnet coins:');
            console.log(`   P2PKH: ${p2pkh.address}`);
            console.log(`   P2WPKH: ${p2wpkh.address}`);
            console.log('');
            console.log(' Wait 5-10 minutes after requesting, then run this script again.');
        } else {
            console.log('\n Step 4: Sufficient Balance Available');
            console.log('--------------------------------------');
            console.log(' Ready for atomic swap testing!');
        }
        
        // 5. Save wallet info for relayer service
        console.log('\n Step 5: Update Relayer Configuration');
        console.log('---------------------------------------');
        
        const relayerEnvPath = '../../relayer-services/executor-client/.env';
        if (fs.existsSync(relayerEnvPath)) {
            let envContent = fs.readFileSync(relayerEnvPath, 'utf8');
            
            // Update Bitcoin private key
            const privateKeyLine = `BITCOIN_PRIVATE_KEY=${keyPair.toWIF()}`;
            if (envContent.includes('BITCOIN_PRIVATE_KEY=')) {
                envContent = envContent.replace(/BITCOIN_PRIVATE_KEY=.*/, privateKeyLine);
            } else {
                envContent += `\\n${privateKeyLine}`;
            }
            
            fs.writeFileSync(relayerEnvPath, envContent);
            console.log(' Updated relayer service configuration');
        }
        
        // 6. Summary
        console.log('\n Setup Summary');
        console.log('================');
        console.log(` Wallet file: ${walletFile}`);
        console.log(` Private key: ${keyPair.toWIF()}`);
        console.log(` Primary address: ${p2wpkh.address}`);
        console.log(` Current balance: ${totalBalance / 100000000} BTC`);
        console.log(` UTXOs available: ${utxos.length}`);
        
        if (totalBalance >= 10000) {
            console.log('\n Ready to proceed with live Bitcoin atomic swap testing!');
            return {
                keyPair,
                addresses: { p2pkh: p2pkh.address, p2wpkh: p2wpkh.address },
                balance: totalBalance,
                utxos,
                ready: true
            };
        } else {
            console.log('\n Waiting for testnet funding before proceeding...');
            return {
                keyPair,
                addresses: { p2pkh: p2pkh.address, p2wpkh: p2wpkh.address },
                balance: totalBalance,
                utxos,
                ready: false
            };
        }
        
    } catch (error) {
        console.error(' Setup failed:', error.message);
        return null;
    }
}

if (require.main === module) {
    setupLiveTestnet().then(result => {
        process.exit(result && result.ready ? 0 : 1);
    });
}

module.exports = { setupLiveTestnet };