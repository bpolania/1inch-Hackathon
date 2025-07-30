const { ethers } = require("hardhat");

async function main() {
    console.log("🔧 Registering NEAR Adapters with CrossChainRegistry...");
    console.log("=====================================================");

    const [deployer] = await ethers.getSigners();
    console.log("📋 Registering with account:", deployer.address);

    // Existing contract addresses from README
    const REGISTRY_ADDRESS = "0x09Ab998Cb3448ad281C116c9fC9e4b01e4533beD";
    
    // NEAR adapter addresses from README
    const NEAR_MAINNET_ADAPTER = "0xb885Ff0090ABdF345a9679DE5D5eabcFCD41463D";
    const NEAR_TESTNET_ADAPTER = "0x7019aC48479e5527Cb3a5a99FbEFe5B42125C9A5";

    // Chain IDs
    const NEAR_MAINNET_ID = 40001;
    const NEAR_TESTNET_ID = 40002;

    console.log("\n📋 Contract Addresses:");
    console.log("Registry:", REGISTRY_ADDRESS);

    // Connect to registry
    const registry = await ethers.getContractAt("CrossChainRegistry", REGISTRY_ADDRESS);

    const nearChains = [
        { id: NEAR_MAINNET_ID, name: "NEAR Mainnet", adapter: NEAR_MAINNET_ADAPTER },
        { id: NEAR_TESTNET_ID, name: "NEAR Testnet", adapter: NEAR_TESTNET_ADAPTER }
    ];

    console.log("\n🔧 Registering NEAR adapters...");
    for (const chain of nearChains) {
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

    // Verify each NEAR adapter
    for (const chain of nearChains) {
        try {
            const chainInfo = await registry.getChainInfo(chain.id);
            console.log(`🌐 ${chain.name}: ${chainInfo.name} - Active: ${chainInfo.isActive} - Adapter: ${chainInfo.adapter}`);
        } catch (error) {
            console.log(`❌ Failed to get info for ${chain.name}:`, error.message);
        }
    }

    console.log("\n🎉 NEAR Adapter Registration Complete!");
    console.log("=====================================");
    console.log("All NEAR adapters are now registered and ready for use.");
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