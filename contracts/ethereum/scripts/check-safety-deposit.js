const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const deploymentInfo = JSON.parse(fs.readFileSync("./sepolia-deployment.json", "utf8"));
    const [signer] = await ethers.getSigners();

    const factoryAddress = deploymentInfo.productionDeployment.contracts.OneInchFusionPlusFactory;
    const factory = await ethers.getContractAt("OneInchFusionPlusFactory", factoryAddress, signer);
    
    const orderHash = "0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4";
    const order = await factory.getOrder(orderHash);
    
    console.log("Order Details:");
    console.log(`Source Amount: ${ethers.formatEther(order.sourceAmount)} DT`);
    console.log(`Destination Chain ID: ${order.destinationChainId}`);
    
    // Get the registry
    const registryAddress = await factory.registry();
    const registry = await ethers.getContractAt("CrossChainRegistry", registryAddress);
    
    try {
        const safetyDeposit = await registry.calculateMinSafetyDeposit(
            order.destinationChainId,
            order.sourceAmount
        );
        
        console.log(`Required Safety Deposit: ${ethers.formatEther(safetyDeposit)} ETH`);
        console.log(`Current ETH Balance: ${ethers.formatEther(await ethers.provider.getBalance(signer.address))} ETH`);
        
        const hasEnough = await ethers.provider.getBalance(signer.address) >= safetyDeposit;
        console.log(`Has Enough ETH: ${hasEnough ? "✅ Yes" : "❌ No"}`);
        
    } catch (error) {
        console.log("Error calculating safety deposit:", error.message);
        
        // Try to get adapter directly
        const nearAdapter = await registry.getDestinationChain(40002);
        console.log("NEAR Adapter:", nearAdapter);
        
        if (nearAdapter !== ethers.ZeroAddress) {
            const adapter = await ethers.getContractAt("NearDestinationChain", nearAdapter);
            const depositAmount = await adapter.calculateMinSafetyDeposit(order.sourceAmount);
            console.log(`Direct Adapter Safety Deposit: ${ethers.formatEther(depositAmount)} ETH`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });