const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking Bitcoin Adapter Features...");
    console.log("======================================");

    const BITCOIN_MAINNET_ADAPTER = "0xb439CA5195EF798907EFc22D889852e8b56662de";

    const bitcoinAdapter = await ethers.getContractAt("BitcoinDestinationChain", BITCOIN_MAINNET_ADAPTER);
    
    console.log("📋 Bitcoin Adapter Address:", BITCOIN_MAINNET_ADAPTER);
    
    const features = [
        "atomic_swaps",
        "htlc",
        "resolver_fees", 
        "safety_deposits",
        "partial_fills",
        "time_locks",
        "cross_chain"
    ];

    console.log("\n🔧 Feature Support:");
    for (const feature of features) {
        try {
            const isSupported = await bitcoinAdapter.supportsFeature(feature);
            console.log(`   ${feature}: ${isSupported ? '✅ Supported' : '❌ Not Supported'}`);
        } catch (error) {
            console.log(`   ${feature}: ❌ Error - ${error.message}`);
        }
    }

    // Check chain info
    try {
        const chainInfo = await bitcoinAdapter.getChainInfo();
        console.log("\n📊 Chain Info:");
        console.log(`   Chain ID: ${chainInfo.chainId}`);
        console.log(`   Name: ${chainInfo.name}`);
        console.log(`   Symbol: ${chainInfo.symbol}`);
        console.log(`   Active: ${chainInfo.isActive}`);
    } catch (error) {
        console.log("\n❌ Error getting chain info:", error.message);
    }
}

main().catch(console.error);