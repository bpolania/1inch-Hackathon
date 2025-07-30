const { ethers } = require("hardhat");

async function main() {
    console.log("🔄 Continuing Sepolia Deployment...");
    console.log("===================================");

    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("📋 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "ETH");

    // Deployed contract addresses from previous deployment
    const registryAddress = "0x09Ab998Cb3448ad281C116c9fC9e4b01e4533beD";
    const escrowFactoryAddress = "0x91826Eb80e0251a15574b71a88D805d767b0e824";

    console.log("📦 Using existing contracts:");
    console.log("Registry:", registryAddress);
    console.log("EscrowFactory:", escrowFactoryAddress);

    console.log("\n📦 Step 5: Deploying NearTakerInteraction...");
    const NearTakerInteraction = await ethers.getContractFactory("NearTakerInteraction");
    const nearTakerInteraction = await NearTakerInteraction.deploy(
        registryAddress,
        escrowFactoryAddress
    );
    await nearTakerInteraction.waitForDeployment();
    const nearTakerInteractionAddress = await nearTakerInteraction.getAddress();
    console.log("✅ NearTakerInteraction deployed to:", nearTakerInteractionAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + nearTakerInteractionAddress);

    console.log("\n📦 Step 6: Deploying OneInchFusionPlusFactory...");
    const OneInchFusionPlusFactory = await ethers.getContractFactory("OneInchFusionPlusFactory");
    const factory = await OneInchFusionPlusFactory.deploy(
        registryAddress,
        escrowFactoryAddress,
        nearTakerInteractionAddress
    );
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("✅ OneInchFusionPlusFactory deployed to:", factoryAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + factoryAddress);

    console.log("\n🎉 Deployment Complete!");
    console.log("======================");
    console.log("Registry:", registryAddress);
    console.log("EscrowFactory:", escrowFactoryAddress);
    console.log("NearTakerInteraction:", nearTakerInteractionAddress);
    console.log("Factory:", factoryAddress);

    const finalBalance = await ethers.provider.getBalance(deployer.address);
    console.log("\n💰 Final balance:", ethers.formatEther(finalBalance), "ETH");
    console.log("💸 Gas used:", ethers.formatEther(balance - finalBalance), "ETH");

    return {
        registry: registryAddress,
        escrowFactory: escrowFactoryAddress,
        nearTakerInteraction: nearTakerInteractionAddress,
        factory: factoryAddress
    };
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = { main };