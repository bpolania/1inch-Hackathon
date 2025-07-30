const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying OneInchFusionPlusFactory to Sepolia...");
    console.log("===============================================");

    const [deployer] = await ethers.getSigners();
    console.log("📋 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    console.log("🌐 Network:", (await ethers.provider.getNetwork()).name);
    console.log("⛓️  Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());

    // Use existing deployed contract addresses from README
    const REGISTRY_ADDRESS = "0x09Ab998Cb3448ad281C116c9fC9e4b01e4533beD";
    const ESCROW_FACTORY_ADDRESS = "0x91826Eb80e0251a15574b71a88D805d767b0e824";
    const NEAR_TAKER_INTERACTION_ADDRESS = "0x0cE8E6D1ddF9D24a8be1617E5A5fdf478914Ae26";

    console.log("\n📦 Deploying OneInchFusionPlusFactory...");
    console.log("Using existing contracts:");
    console.log("  - Registry:", REGISTRY_ADDRESS);
    console.log("  - EscrowFactory:", ESCROW_FACTORY_ADDRESS);
    console.log("  - NearTakerInteraction:", NEAR_TAKER_INTERACTION_ADDRESS);

    const OneInchFusionPlusFactory = await ethers.getContractFactory("OneInchFusionPlusFactory");
    const factory = await OneInchFusionPlusFactory.deploy(
        REGISTRY_ADDRESS,
        ESCROW_FACTORY_ADDRESS,
        NEAR_TAKER_INTERACTION_ADDRESS
    );
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("✅ OneInchFusionPlusFactory deployed to:", factoryAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + factoryAddress);

    console.log("\n👥 Setting up Initial Resolver Authorization...");
    // Add deployer as initial authorized resolver for testing
    let tx = await factory.authorizeResolver(deployer.address);
    await tx.wait();
    console.log("✅ Deployer authorized as resolver");

    console.log("\n🧪 Verifying Deployment...");
    const resolverCount = await factory.resolverCount();
    const isResolverAuthorized = await factory.authorizedResolvers(deployer.address);
    console.log("👥 Authorized resolvers:", resolverCount.toString());
    console.log("✅ Deployer is authorized resolver:", isResolverAuthorized);

    console.log("\n🎉 Deployment Complete!");
    console.log("======================");
    console.log(`🏭 OneInchFusionPlusFactory: ${factoryAddress}`);
    console.log(`🔗 Etherscan: https://sepolia.etherscan.io/address/${factoryAddress}`);
    console.log("");
    console.log("🔗 Next Steps:");
    console.log("   1. Register Bitcoin adapters with the factory");
    console.log("   2. Update README with the new factory address");
    console.log("   3. Run end-to-end tests");

    return {
        factoryAddress,
        tx: tx.hash
    };
}

// Handle script execution
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = { main };