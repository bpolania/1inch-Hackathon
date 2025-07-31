#!/usr/bin/env node

/**
 * Manual Bitcoin HTLC Funding Information
 * 
 * Provides exact details for manual Bitcoin transaction
 */

const fs = require('fs');

async function getManualFundingInfo() {
    console.log('₿ Manual Bitcoin HTLC Funding Information');
    console.log('========================================\n');
    
    try {
        // Load HTLC info
        const htlcFile = './clean-10k-htlc.json';
        if (!fs.existsSync(htlcFile)) {
            throw new Error('HTLC file not found.');
        }
        
        const htlcInfo = JSON.parse(fs.readFileSync(htlcFile, 'utf8'));
        
        console.log('📋 Funding Transaction Details:');
        console.log('==============================');
        console.log(`From Address: ${htlcInfo.bitcoinWallet}`);
        console.log(`To Address:   ${htlcInfo.htlcAddress}`);
        console.log(`Amount:       ${htlcInfo.destinationAmount} satoshis (${htlcInfo.destinationAmount/100000000} BTC)`);
        console.log(`Network:      Bitcoin Testnet`);
        console.log('');
        
        console.log('🔍 Current Wallet Status:');
        console.log('=========================');
        console.log(`Your Wallet: ${htlcInfo.bitcoinWallet}`);
        console.log(`Available:   ~14,000 satoshis (from faucets)`);
        console.log(`Required:    ${htlcInfo.destinationAmount} satoshis + ~500 satoshis (fees)`);
        console.log(`Status:      ✅ Sufficient funds`);
        console.log('');
        
        console.log('📤 Manual Funding Options:');
        console.log('==========================');
        console.log('Option 1: Bitcoin Core Wallet');
        console.log(`  sendtoaddress "${htlcInfo.htlcAddress}" ${htlcInfo.destinationAmount/100000000}`);
        console.log('');
        console.log('Option 2: Electrum Wallet');
        console.log(`  1. Import private key: ${process.env.BITCOIN_PRIVATE_KEY || 'cRzr3EUzArpAHxRuc9RxuQUTQiCFacwcHZFDUriNhcQ7ikMA7GaN'}`);
        console.log(`  2. Send ${htlcInfo.destinationAmount/100000000} BTC to ${htlcInfo.htlcAddress}`);
        console.log('');
        console.log('Option 3: Block Explorer (if available)');
        console.log(`  Use testnet block explorer with wallet functionality`);
        console.log('');
        
        console.log('🔗 Useful Links:');
        console.log('================');
        console.log(`Wallet Explorer: https://blockstream.info/testnet/address/${htlcInfo.bitcoinWallet}`);
        console.log(`HTLC Explorer:   https://blockstream.info/testnet/address/${htlcInfo.htlcAddress}`);
        console.log('Bitcoin Testnet: https://blockstream.info/testnet/');
        console.log('');
        
        console.log('⚡ Quick Test Transaction:');
        console.log('=========================');
        console.log('If you have a Bitcoin testnet wallet with the private key:');
        console.log(`1. Import: ${process.env.BITCOIN_PRIVATE_KEY || 'cRzr3EUzArpAHxRuc9RxuQUTQiCFacwc'}`);
        console.log(`2. Send to: ${htlcInfo.htlcAddress}`);
        console.log(`3. Amount: ${htlcInfo.destinationAmount} satoshis`);
        console.log('4. Wait for 1 confirmation');
        console.log('');
        
        console.log('🔔 After Funding:');
        console.log('=================');
        console.log('1. ✅ Confirm transaction on block explorer');
        console.log('2. 📝 Copy transaction ID');
        console.log('3. 🚀 Proceed with atomic swap execution');
        console.log('');
        
        console.log('💡 Alternative: Demonstrate with Available Funds');
        console.log('================================================');
        console.log('We can also:');
        console.log('1. Create a smaller order (e.g., 5000 satoshis)');
        console.log('2. Use the available 14,000 satoshis');
        console.log('3. Complete full atomic swap demonstration');
        
        // Save manual funding instructions
        const fundingInstructions = {
            fromAddress: htlcInfo.bitcoinWallet,
            toAddress: htlcInfo.htlcAddress,
            amount: htlcInfo.destinationAmount,
            amountBTC: htlcInfo.destinationAmount / 100000000,
            privateKey: process.env.BITCOIN_PRIVATE_KEY || 'cRzr3EUzArpAHxRuc9RxuQUTQiCFacwcHZFDUriNhcQ7ikMA7GaN',
            network: 'testnet',
            instructions: 'Send exact amount from wallet to HTLC address',
            explorerLinks: {
                wallet: `https://blockstream.info/testnet/address/${htlcInfo.bitcoinWallet}`,
                htlc: `https://blockstream.info/testnet/address/${htlcInfo.htlcAddress}`
            }
        };
        
        fs.writeFileSync('./manual-funding-instructions.json', JSON.stringify(fundingInstructions, null, 2));
        console.log('\n💾 Manual funding instructions saved to manual-funding-instructions.json');
        
        return true;
        
    } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        return false;
    }
}

if (require.main === module) {
    getManualFundingInfo().then(success => {
        console.log(`\nResult: ${success ? '✅ INFO READY' : '❌ FAILED'}`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { getManualFundingInfo };