const { ethers } = require("hardhat");

async function main() {
    console.log("🔧 Registering Bitcoin Adapters with CrossChainRegistry...");
    console.log("=========================================================");

    const [deployer] = await ethers.getSigners();
    console.log("📋 Registering with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // Existing contract addresses from README
    const REGISTRY_ADDRESS = "0x09Ab998Cb3448ad281C116c9fC9e4b01e4533beD";
    
    // Bitcoin adapter addresses from README
    const BITCOIN_MAINNET_ADAPTER = "0xb439CA5195EF798907EFc22D889852e8b56662de";
    const BITCOIN_TESTNET_ADAPTER = "0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8";
    const DOGECOIN_ADAPTER = "0x84A932A6b1Cca23c0359439673b70E6eb26cc0Aa";
    const LITECOIN_ADAPTER = "0x79ff06d38f891dAd1EbB0074dea4464c3384d560";
    const BITCOIN_CASH_ADAPTER = "0x6425e85a606468266fBCe46B234f31Adf3583D56";

    // Chain IDs
    const BITCOIN_MAINNET_ID = 40003;
    const BITCOIN_TESTNET_ID = 40004;
    const DOGECOIN_MAINNET_ID = 40005;
    const LITECOIN_MAINNET_ID = 40006;
    const BITCOIN_CASH_MAINNET_ID = 40007;

    console.log("\n📋 Contract Addresses:");
    console.log("Registry:", REGISTRY_ADDRESS);

    // Connect to registry
    const registry = await ethers.getContractAt("CrossChainRegistry", REGISTRY_ADDRESS);

    const bitcoinChains = [
        { id: BITCOIN_MAINNET_ID, name: "Bitcoin Mainnet", adapter: BITCOIN_MAINNET_ADAPTER },
        { id: BITCOIN_TESTNET_ID, name: "Bitcoin Testnet", adapter: BITCOIN_TESTNET_ADAPTER },
        { id: DOGECOIN_MAINNET_ID, name: "Dogecoin", adapter: DOGECOIN_ADAPTER },
        { id: LITECOIN_MAINNET_ID, name: "Litecoin", adapter: LITECOIN_ADAPTER },
        { id: BITCOIN_CASH_MAINNET_ID, name: "Bitcoin Cash", adapter: BITCOIN_CASH_ADAPTER }
    ];

    console.log("\n🔧 Registering Bitcoin family adapters...");
    for (const chain of bitcoinChains) {
        try {
            // Check if already registered
            const existingInfo = await registry.getChainInfo(chain.id);
            if (existingInfo.adapter !== ethers.ZeroAddress) {
                console.log(`⚠️  ${chain.name} already registered at ${existingInfo.adapter}`);
                continue;
            }
        } catch (error) {
            // Chain not registered yet, which is expected
        }

        console.log(`📝 Registering ${chain.name} adapter at ${chain.adapter}...`);
        const tx = await registry.registerChainAdapter(chain.id, chain.adapter);
        await tx.wait();
        console.log(`✅ ${chain.name} adapter registered (tx: ${tx.hash})`);
    }

    console.log("\n🧪 Verifying Registration...");
    const supportedChains = await registry.getSupportedChainIds();
    console.log("📊 Total supported chains:", supportedChains.length);
    console.log("📊 Supported chain IDs:", supportedChains.map(id => id.toString()));

    // Verify each Bitcoin adapter
    for (const chain of bitcoinChains) {
        try {
            const chainInfo = await registry.getChainInfo(chain.id);
            console.log(`₿ ${chain.name}: ${chainInfo.name} - Active: ${chainInfo.isActive} - Adapter: ${chainInfo.adapter}`);
        } catch (error) {
            console.log(`❌ Failed to get info for ${chain.name}:`, error.message);
        }
    }

    console.log("\n🎉 Bitcoin Adapter Registration Complete!");
    console.log("=========================================");
    console.log("All Bitcoin family adapters are now registered and ready for use.");
}

// Handle script execution
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Registration failed:", error);
            process.exit(1);
        });
}

module.exports = { main };