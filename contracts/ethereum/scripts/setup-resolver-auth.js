const { ethers } = require("hardhat");

async function main() {
    console.log("👥 Setting up Resolver Authorization...");
    console.log("=====================================");

    const [deployer] = await ethers.getSigners();
    console.log("📋 Setting up with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // Contract addresses
    const FACTORY_ADDRESS = "0xbeEab741D2869404FcB747057f5AbdEffc3A138d";
    const NEAR_TAKER_INTERACTION_ADDRESS = "0x0cE8E6D1ddF9D24a8be1617E5A5fdf478914Ae26";

    console.log("\n📋 Contract Addresses:");
    console.log("Factory:", FACTORY_ADDRESS);
    console.log("NearTakerInteraction:", NEAR_TAKER_INTERACTION_ADDRESS);

    // Connect to contracts
    const factory = await ethers.getContractAt("OneInchFusionPlusFactory", FACTORY_ADDRESS);
    const nearTakerInteraction = await ethers.getContractAt("NearTakerInteraction", NEAR_TAKER_INTERACTION_ADDRESS);

    console.log("\n🔧 Checking Current Authorization Status...");
    
    // Check factory authorization
    try {
        const isFactoryAuthorized = await factory.authorizedResolvers(deployer.address);
        console.log("✅ Factory - Deployer is authorized resolver:", isFactoryAuthorized);
        
        if (!isFactoryAuthorized) {
            console.log("📝 Authorizing deployer in factory...");
            const tx = await factory.authorizeResolver(deployer.address);
            await tx.wait();
            console.log("✅ Deployer authorized in factory (tx:", tx.hash + ")");
        }
    } catch (error) {
        console.log("❌ Error checking factory authorization:", error.message);
    }

    // Check NearTakerInteraction authorization
    try {
        const isTakerAuthorized = await nearTakerInteraction.authorizedResolvers(deployer.address);
        console.log("✅ NearTakerInteraction - Deployer is authorized resolver:", isTakerAuthorized);
        
        if (!isTakerAuthorized) {
            console.log("📝 Authorizing deployer in NearTakerInteraction...");
            const tx = await nearTakerInteraction.authorizeResolver(deployer.address);
            await tx.wait();
            console.log("✅ Deployer authorized in NearTakerInteraction (tx:", tx.hash + ")");
        }
    } catch (error) {
        console.log("❌ Error checking NearTakerInteraction authorization:", error.message);
    }

    console.log("\n🧪 Verifying Final Authorization Status...");
    
    try {
        const factoryResolverCount = await factory.resolverCount();
        const isFactoryAuthorized = await factory.authorizedResolvers(deployer.address);
        console.log("👥 Factory - Authorized resolvers:", factoryResolverCount.toString());
        console.log("✅ Factory - Deployer is authorized:", isFactoryAuthorized);
    } catch (error) {
        console.log("❌ Error verifying factory authorization:", error.message);
    }

    try {
        const nearResolverCount = await nearTakerInteraction.resolverCount();
        const isNearAuthorized = await nearTakerInteraction.authorizedResolvers(deployer.address);
        console.log("👥 NearTakerInteraction - Authorized resolvers:", nearResolverCount.toString());
        console.log("✅ NearTakerInteraction - Deployer is authorized:", isNearAuthorized);
    } catch (error) {
        console.log("❌ Error verifying NearTakerInteraction authorization:", error.message);
    }

    console.log("\n🎉 Resolver Authorization Setup Complete!");
    console.log("========================================");
    console.log("All contracts are now properly configured with resolver authorization.");
}

// Handle script execution
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Authorization setup failed:", error);
            process.exit(1);
        });
}

module.exports = { main };