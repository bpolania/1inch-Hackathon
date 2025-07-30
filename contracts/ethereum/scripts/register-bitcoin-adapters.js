const { ethers } = require("hardhat");

async function main() {
    console.log("🔗 Registering Bitcoin Adapters with CrossChainRegistry...");
    console.log("======================================================");

    // Contract addresses
    const REGISTRY_ADDRESS = "0x59CE43Ea20892EC3Eff00fc7506cbfA9813FE0ca";
    const BTC_ADAPTER = "0xEe4EBcDF410D4b95631f395A3Be6b0d1bb93d912";
    const DOGE_ADAPTER = "0xFD5034B7181F7d22FF7152e59437f6d28aCE4882";
    const LTC_ADAPTER = "0x7654E486068D112F51c09D83B9ce17E780AEee05";

    // Chain IDs
    const BITCOIN_TESTNET_ID = 50002;
    const DOGECOIN_MAINNET_ID = 50003;
    const LITECOIN_MAINNET_ID = 50005;

    const [signer] = await ethers.getSigners();
    console.log("📍 Signer:", signer.address);

    // Get registry contract
    const registry = await ethers.getContractAt("CrossChainRegistry", REGISTRY_ADDRESS);
    
    try {
        // Register Bitcoin Testnet
        console.log("\n🔄 Registering Bitcoin Testnet...");
        const tx1 = await registry.registerChainAdapter(BITCOIN_TESTNET_ID, BTC_ADAPTER);
        await tx1.wait();
        console.log("✅ Bitcoin Testnet registered");

        // Register Dogecoin
        console.log("🔄 Registering Dogecoin...");
        const tx2 = await registry.registerChainAdapter(DOGECOIN_MAINNET_ID, DOGE_ADAPTER);
        await tx2.wait();
        console.log("✅ Dogecoin registered");

        // Register Litecoin
        console.log("🔄 Registering Litecoin...");
        const tx3 = await registry.registerChainAdapter(LITECOIN_MAINNET_ID, LTC_ADAPTER);
        await tx3.wait();
        console.log("✅ Litecoin registered");

        // Verify registration
        console.log("\n📊 Verifying registration...");
        const supportedChains = await registry.getSupportedChainIds();
        console.log("Supported chains:", supportedChains.map(id => id.toString()));

        for (const chainId of [BITCOIN_TESTNET_ID, DOGECOIN_MAINNET_ID, LITECOIN_MAINNET_ID]) {
            const isSupported = await registry.isChainSupported(chainId);
            const chainInfo = isSupported ? await registry.getChainInfo(chainId) : null;
            console.log(`Chain ${chainId}: ${isSupported ? '✅' : '❌'} ${chainInfo?.name || 'Not found'}`);
        }

        console.log("\n🎉 All Bitcoin adapters successfully registered!");

    } catch (error) {
        console.error("❌ Registration failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });