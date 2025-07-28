const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔍 Verifying Complete Atomic Swap Status");
    console.log("=====================================");
    
    const deploymentInfo = JSON.parse(fs.readFileSync("./sepolia-deployment.json", "utf8"));
    const [signer] = await ethers.getSigners();
    
    console.log("📍 Account:", signer.address);
    console.log("");
    
    // Check ETH balance
    const ethBalance = await ethers.provider.getBalance(signer.address);
    console.log("💰 ETH Balance:", ethers.formatEther(ethBalance), "ETH");
    
    // Check DT token balance
    const tokenAddress = deploymentInfo.productionDeployment.contracts.DemoToken;
    const demoToken = await ethers.getContractAt("MockERC20", tokenAddress, signer);
    const dtBalance = await demoToken.balanceOf(signer.address);
    console.log("🪙 DT Token Balance:", ethers.formatEther(dtBalance), "DT");
    
    // Check the order status
    const factoryAddress = deploymentInfo.productionDeployment.contracts.OneInchFusionPlusFactory;
    const factory = await ethers.getContractAt("OneInchFusionPlusFactory", factoryAddress, signer);
    const orderHash = "0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4";
    
    try {
        const order = await factory.getOrder(orderHash);
        console.log("📋 Order Status:");
        console.log("   Order Hash:", orderHash);
        console.log("   Is Active:", order.isActive);
        console.log("   Is Completed:", !order.isActive);
        console.log("   Source Token:", order.sourceToken);
        console.log("   Source Amount:", ethers.formatEther(order.sourceAmount), "DT");
        console.log("   Resolver Fee:", ethers.formatEther(order.resolverFeeAmount), "DT");
    } catch (error) {
        console.log("⚠️  Could not fetch order details:", error.message);
    }
    
    console.log("");
    console.log("🔗 Transaction Verification:");
    console.log("   Order Creation: https://sepolia.etherscan.io/tx/0xf45e3f29a382dbb79df313a9382923898105915f48b610ab605cb13861c9b029");
    
    console.log("");
    console.log("💡 Analysis:");
    console.log("   - DT balance should show tokens were committed to order");
    console.log("   - Order should exist and be either active or completed");
    console.log("   - ETH balance shows gas costs from creating order");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });