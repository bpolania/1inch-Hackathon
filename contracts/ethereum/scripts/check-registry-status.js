const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking CrossChainRegistry Status on Sepolia...");
    console.log("=================================================");

    const REGISTRY_ADDRESS = "0x09Ab998Cb3448ad281C116c9fC9e4b01e4533beD";

    const registry = await ethers.getContractAt("CrossChainRegistry", REGISTRY_ADDRESS);
    
    console.log("📋 Registry Address:", REGISTRY_ADDRESS);
    
    // Get all supported chains
    const supportedChains = await registry.getSupportedChainIds();
    console.log("\n📊 Supported Chains:", supportedChains.length);
    console.log("Chain IDs:", supportedChains.map(id => id.toString()));

    // Check each chain
    for (const chainId of supportedChains) {
        try {
            const chainInfo = await registry.getChainInfo(chainId);
            const adapter = await registry.getChainAdapter(chainId);
            console.log(`\n🔗 Chain ID ${chainId}:`);
            console.log(`   Name: ${chainInfo.name}`);
            console.log(`   Symbol: ${chainInfo.symbol}`);
            console.log(`   Active: ${chainInfo.isActive}`);
            console.log(`   Adapter: ${adapter}`);
        } catch (error) {
            console.log(`❌ Error getting info for chain ${chainId}:`, error.message);
        }
    }

    // Check specific Bitcoin chain IDs
    const bitcoinChains = [40003, 40004, 40005, 40006, 40007];
    console.log("\n₿ Bitcoin Chain Registration Status:");
    
    for (const chainId of bitcoinChains) {
        const isSupported = await registry.isChainSupported(chainId);
        console.log(`   Chain ${chainId}: ${isSupported ? '✅ Registered' : '❌ Not Registered'}`);
    }
}

main().catch(console.error);