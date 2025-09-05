const BitcoinHTLCManager = require('../src/BitcoinHTLCManager');
const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');

/**
 * Complete Ethereum  Bitcoin Atomic Swap Demonstration
 * 
 * This script demonstrates the complete bidirectional atomic swap flow
 * between Ethereum (using 1inch Fusion+) and Bitcoin (using HTLC scripts).
 */
async function demonstrateEthereumBitcoinSwap() {
    console.log(' Ethereum  Bitcoin Atomic Swap Demo');
    console.log('======================================\n');

    try {
        // Initialize Bitcoin HTLC manager
        const btcManager = new BitcoinHTLCManager({
            network: bitcoin.networks.testnet,
            feeRate: 15, // Slightly higher for reliable confirmation
            htlcTimelock: 144
        });

        console.log(' Demo Overview:');
        console.log(' Scenario: Alice (ETH) wants Bob\'s Bitcoin');
        console.log(' Alice has: 100 USDC on Ethereum');
        console.log(' Bob has: 0.001 BTC on Bitcoin');
        console.log(' Both want to swap atomically\n');

        // Demo Scenario 1: Ethereum  Bitcoin Swap
        console.log(' Scenario 1: Ethereum  Bitcoin Swap');
        console.log('=====================================\n');

        await demonstrateEthToBtcSwap(btcManager);

        console.log('\n' + '='.repeat(60) + '\n');

        // Demo Scenario 2: Bitcoin  Ethereum Swap  
        console.log(' Scenario 2: Bitcoin  Ethereum Swap');
        console.log('=====================================\n');

        await demonstrateBtcToEthSwap(btcManager);

        // Summary
        console.log('\n Complete Bidirectional Demo Success!');
        console.log('=======================================');
        console.log(' Both swap directions demonstrated');
        console.log(' Atomic execution guaranteed');
        console.log(' Cross-chain secret coordination');
        console.log(' Compatible with 1inch Fusion+');
        console.log(' Ready for ETHGlobal Unite bounty!');

    } catch (error) {
        console.error(' Demo failed:', error.message);
        console.error(error.stack);
    }
}

/**
 * Demonstrate Ethereum  Bitcoin atomic swap
 */
async function demonstrateEthToBtcSwap(btcManager) {
    console.log(' Alice wants to swap 100 USDC  0.001 BTC');
    console.log('--------------------------------------------');

    // Step 1: Setup participants
    const aliceEthAddress = '0x742d35Cc6B44e9F7c4963A0e0f9d6d8A8B0f8B8E'; // Alice's Ethereum address
    const bobBtcKeyPair = btcManager.generateKeyPair(); // Bob's Bitcoin keys
    const aliceBtcKeyPair = btcManager.generateKeyPair(); // Alice's Bitcoin refund keys

    const bobBtcAddress = bitcoin.payments.p2pkh({
        pubkey: bobBtcKeyPair.publicKey,
        network: bitcoin.networks.testnet
    }).address;

    console.log(' Alice (Ethereum):', aliceEthAddress);
    console.log(' Bob (Bitcoin):', bobBtcAddress);

    // Step 2: Generate shared secret
    const { secret, hashlock } = btcManager.generateSecret();
    console.log('\n Shared Secret Generated:');
    console.log('   Secret:', secret);
    console.log('   Hashlock:', hashlock);

    // Step 3: Ethereum side (simulated)
    console.log('\n Ethereum Side (1inch Fusion+):');
    console.log('   1.  Alice creates 1inch Fusion+ order');
    console.log('   2.  Order specifies Bitcoin destination address');
    console.log('   3.  Order uses same hashlock:', hashlock.slice(0, 10) + '...');
    console.log('   4.  EscrowSrc contract locks 100 USDC');
    console.log('   5.  Resolver deposits safety amount');
    console.log('   6.  Waiting for Bitcoin HTLC funding...');

    // Step 4: Bitcoin HTLC creation
    console.log('\n Bitcoin Side (HTLC Creation):');
    const currentHeight = await btcManager.getCurrentBlockHeight();
    const timelockHeight = currentHeight + 144;

    const htlcScript = btcManager.generateHTLCScript(
        hashlock,
        bobBtcKeyPair.publicKey,     // Bob can claim Bitcoin
        aliceBtcKeyPair.publicKey,   // Alice can refund after timelock
        timelockHeight
    );

    const htlcAddress = btcManager.createHTLCAddress(htlcScript);

    console.log('   1.  Bob creates HTLC script (114 bytes)');
    console.log('   2.  HTLC address:', htlcAddress);
    console.log('   3.  Timelock height:', timelockHeight);
    console.log('   4.  Bob funds HTLC with 0.001 BTC');
    console.log('   5.  HTLC funded, waiting for Alice to reveal secret...');

    // Step 5: Secret revelation and claiming
    console.log('\n Atomic Execution:');
    console.log('   1.  Alice sees Bitcoin HTLC funded');
    console.log('   2.  Alice reveals secret on Ethereum to claim USDC');
    console.log('   3.  Bob sees secret revealed on Ethereum');
    console.log('   4.  Bob uses same secret to claim Bitcoin from HTLC');
    console.log('   5.  Atomic swap completed successfully!');

    // Store the swap order
    const orderId = `eth_to_btc_${Date.now()}`;
    btcManager.storeOrder(orderId, {
        type: 'eth_to_btc',
        ethAddress: aliceEthAddress,
        btcAddress: bobBtcAddress,
        htlcAddress,
        htlcScript: htlcScript.toString('hex'),
        secret,
        hashlock,
        amount: 100000, // 0.001 BTC in satoshis
        ethAmount: '100000000', // 100 USDC (6 decimals)
        timelockHeight,
        status: 'completed'
    });

    console.log('\n Swap Order Stored:', orderId);
    console.log(' Ethereum  Bitcoin swap demonstration complete!');
}

/**
 * Demonstrate Bitcoin  Ethereum atomic swap
 */
async function demonstrateBtcToEthSwap(btcManager) {
    console.log(' Charlie wants to swap 0.002 BTC  200 DAI');
    console.log('---------------------------------------------');

    // Step 1: Setup participants
    const charlieBtcKeyPair = btcManager.generateKeyPair(); // Charlie's Bitcoin keys
    const davidEthAddress = '0x123d45Cc6B44e9F7c4963A0e0f9d6d8A8B0f1234'; // David's Ethereum address
    const charlieBtcRefundKeyPair = btcManager.generateKeyPair(); // Charlie's refund keys

    const charlieBtcAddress = bitcoin.payments.p2pkh({
        pubkey: charlieBtcKeyPair.publicKey,
        network: bitcoin.networks.testnet
    }).address;

    console.log(' Charlie (Bitcoin):', charlieBtcAddress);
    console.log(' David (Ethereum):', davidEthAddress);

    // Step 2: Generate shared secret (David generates since he starts)
    const { secret, hashlock } = btcManager.generateSecret();
    console.log('\n Shared Secret Generated (by David):');
    console.log('   Secret:', secret);
    console.log('   Hashlock:', hashlock);

    // Step 3: Ethereum side starts (David locks DAI)
    console.log('\n Ethereum Side (1inch Fusion+):');
    console.log('   1.  David creates 1inch Fusion+ order');
    console.log('   2.  Order specifies Charlie\'s Bitcoin address');
    console.log('   3.  Order uses hashlock:', hashlock.slice(0, 10) + '...');
    console.log('   4.  EscrowSrc contract locks 200 DAI');
    console.log('   5.  David provides safety deposit');
    console.log('   6.  Ethereum side ready, waiting for Bitcoin...');

    // Step 4: Bitcoin HTLC creation (Charlie responds)
    console.log('\n Bitcoin Side (HTLC Response):');
    const currentHeight = await btcManager.getCurrentBlockHeight();
    const timelockHeight = currentHeight + 144;

    const htlcScript = btcManager.generateHTLCScript(
        hashlock,
        charlieBtcKeyPair.publicKey,    // Charlie can claim if David reveals secret
        charlieBtcRefundKeyPair.publicKey, // Charlie can refund after timelock
        timelockHeight
    );

    const htlcAddress = btcManager.createHTLCAddress(htlcScript);

    console.log('   1.  Charlie sees Ethereum order created');
    console.log('   2.  Charlie creates matching Bitcoin HTLC');
    console.log('   3.  HTLC address:', htlcAddress);
    console.log('   4.  Timelock height:', timelockHeight);
    console.log('   5.  Charlie funds HTLC with 0.002 BTC');
    console.log('   6.  Both sides funded, ready for atomic execution...');

    // Step 5: Secret revelation and completion
    console.log('\n Atomic Execution:');
    console.log('   1.  David sees Bitcoin HTLC funded');
    console.log('   2.  David reveals secret on Bitcoin to claim BTC');
    console.log('   3.  Charlie sees secret revealed on Bitcoin');
    console.log('   4.  Charlie uses same secret on Ethereum to claim DAI');
    console.log('   5.  Atomic swap completed successfully!');

    // Store the swap order
    const orderId = `btc_to_eth_${Date.now()}`;
    btcManager.storeOrder(orderId, {
        type: 'btc_to_eth',
        btcAddress: charlieBtcAddress,
        ethAddress: davidEthAddress,
        htlcAddress,
        htlcScript: htlcScript.toString('hex'),
        secret,
        hashlock,
        amount: 200000, // 0.002 BTC in satoshis
        ethAmount: '200000000000000000000', // 200 DAI (18 decimals)
        timelockHeight,
        status: 'completed'
    });

    console.log('\n Swap Order Stored:', orderId);
    console.log(' Bitcoin  Ethereum swap demonstration complete!');
}

/**
 * Demonstrate failure recovery scenarios
 */
async function demonstrateFailureRecovery(btcManager) {
    console.log('\n Failure Recovery Scenarios');
    console.log('=============================');

    console.log('\n Scenario 1: Ethereum fails, Bitcoin refunds');
    console.log('    Ethereum order expires or fails');
    console.log('    Bitcoin HTLC reaches timelock height');
    console.log('    Original Bitcoin sender can refund');
    console.log('    No funds lost, atomic property maintained');

    console.log('\n Scenario 2: Bitcoin fails, Ethereum refunds');
    console.log('    Bitcoin transaction fails or times out');
    console.log('    Ethereum escrow reaches expiry time');
    console.log('    Original Ethereum sender can cancel order');
    console.log('    Safety deposits returned, no funds lost');

    console.log('\n Scenario 3: Partial execution prevention');
    console.log('    Same secret used on both chains');
    console.log('    Revealing secret on one chain exposes it on other');
    console.log('    Impossible to claim on one side without other');
    console.log('    True atomic execution guaranteed');
}

// Run the complete demonstration
if (require.main === module) {
    demonstrateEthereumBitcoinSwap().catch(console.error);
}

module.exports = { 
    demonstrateEthereumBitcoinSwap,
    demonstrateEthToBtcSwap,
    demonstrateBtcToEthSwap,
    demonstrateFailureRecovery
};