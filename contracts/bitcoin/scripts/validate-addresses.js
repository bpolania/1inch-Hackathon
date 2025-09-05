#!/usr/bin/env node

/**
 * Bitcoin Address Validation Tool
 * 
 * Validates and regenerates Bitcoin testnet addresses to ensure they're correct
 */

const bitcoin = require('bitcoinjs-lib');
const ECPairFactory = require('ecpair').default;
const tinysecp = require('tiny-secp256k1');
const fs = require('fs');

// Initialize bitcoin-js with tiny-secp256k1
bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

const TESTNET = bitcoin.networks.testnet;

function validateBitcoinAddress(address, network = TESTNET) {
    try {
        bitcoin.address.toOutputScript(address, network);
        return true;
    } catch (error) {
        return false;
    }
}

function getAddressInfo(address, network = TESTNET) {
    try {
        const script = bitcoin.address.toOutputScript(address, network);
        const type = bitcoin.address.getType(address, network);
        return { valid: true, type, script: script.toString('hex') };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

async function validateAndFixAddresses() {
    console.log(' Bitcoin Address Validation and Fix');
    console.log('====================================\\n');
    
    // Load existing wallet
    const walletFile = './bitcoin-testnet-wallet.json';
    if (!fs.existsSync(walletFile)) {
        console.log(' Wallet file not found. Run setup-live-testnet.js first.');
        return;
    }
    
    const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    const keyPair = ECPair.fromWIF(walletData.privateKey, TESTNET);
    
    console.log(' Loaded wallet:');
    console.log(`   Private Key: ${walletData.privateKey}`);
    console.log(`   Public Key: ${keyPair.publicKey.toString('hex')}\\n`);
    
    // Generate all possible address types
    console.log(' Generating Address Types:');
    console.log('----------------------------');
    
    // 1. P2PKH (Pay to Public Key Hash) - Legacy
    const p2pkh = bitcoin.payments.p2pkh({ 
        pubkey: keyPair.publicKey, 
        network: TESTNET 
    });
    
    console.log(' P2PKH (Legacy):');
    console.log(`   Address: ${p2pkh.address}`);
    console.log(`   Valid: ${validateBitcoinAddress(p2pkh.address)}`);
    console.log(`   Info: ${JSON.stringify(getAddressInfo(p2pkh.address))}`);
    
    // 2. P2SH-P2WPKH (Pay to Script Hash - Pay to Witness Public Key Hash) - Nested Segwit
    const p2sh = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ 
            pubkey: keyPair.publicKey, 
            network: TESTNET 
        }),
        network: TESTNET
    });
    
    console.log('\\n P2SH-P2WPKH (Nested Segwit):');
    console.log(`   Address: ${p2sh.address}`);
    console.log(`   Valid: ${validateBitcoinAddress(p2sh.address)}`);
    console.log(`   Info: ${JSON.stringify(getAddressInfo(p2sh.address))}`);
    
    // 3. P2WPKH (Pay to Witness Public Key Hash) - Native Segwit
    const p2wpkh = bitcoin.payments.p2wpkh({ 
        pubkey: keyPair.publicKey, 
        network: TESTNET 
    });
    
    console.log('\\n P2WPKH (Native Segwit):');
    console.log(`   Address: ${p2wpkh.address}`);
    console.log(`   Valid: ${validateBitcoinAddress(p2wpkh.address)}`);
    console.log(`   Info: ${JSON.stringify(getAddressInfo(p2wpkh.address))}`);
    
    // 4. P2TR (Pay to Taproot) - if supported
    try {
        const p2tr = bitcoin.payments.p2tr({ 
            pubkey: keyPair.publicKey.slice(1, 33), // Remove first byte for taproot
            network: TESTNET 
        });
        
        console.log('\\n P2TR (Taproot):');
        console.log(`   Address: ${p2tr.address}`);
        console.log(`   Valid: ${validateBitcoinAddress(p2tr.address)}`);
        console.log(`   Info: ${JSON.stringify(getAddressInfo(p2tr.address))}`);
    } catch (error) {
        console.log('\\n P2TR (Taproot): Not supported or error:', error.message);
    }
    
    // Test with known good testnet addresses
    console.log('\\n Testing Known Good Testnet Addresses:');
    console.log('------------------------------------------');
    
    const knownGoodAddresses = [
        'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', // Bech32 testnet
        '2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc',        // P2SH testnet  
        'mqBBLuXmkzfbejCbBvVzWVRLdEQYQ9Lk8W',        // P2PKH testnet
    ];
    
    for (const addr of knownGoodAddresses) {
        console.log(`   ${addr}: ${validateBitcoinAddress(addr) ? ' Valid' : ' Invalid'}`);
    }
    
    // Recommendation
    console.log('\\n Recommendations:');
    console.log('-------------------');
    console.log('For maximum faucet compatibility, try these addresses:');
    console.log(`1.  Native Segwit (Most Modern): ${p2wpkh.address}`);
    console.log(`2.  Nested Segwit (Good Compat): ${p2sh.address}`);
    console.log(`3.  Legacy (Max Compat): ${p2pkh.address}`);
    
    // Save updated addresses
    const addressInfo = {
        timestamp: new Date().toISOString(),
        network: 'testnet',
        addresses: {
            p2pkh: {
                address: p2pkh.address,
                type: 'legacy',
                valid: validateBitcoinAddress(p2pkh.address)
            },
            p2sh: {
                address: p2sh.address,
                type: 'nested_segwit',
                valid: validateBitcoinAddress(p2sh.address)
            },
            p2wpkh: {
                address: p2wpkh.address,
                type: 'native_segwit', 
                valid: validateBitcoinAddress(p2wpkh.address)
            }
        }
    };
    
    fs.writeFileSync('./bitcoin-addresses.json', JSON.stringify(addressInfo, null, 2));
    console.log('\\n Address information saved to bitcoin-addresses.json');
    
    return addressInfo;
}

if (require.main === module) {
    validateAndFixAddresses().then(result => {
        process.exit(result ? 0 : 1);
    });
}

module.exports = { validateAndFixAddresses, validateBitcoinAddress };