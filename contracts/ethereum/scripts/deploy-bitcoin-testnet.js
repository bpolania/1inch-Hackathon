const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying BitcoinDestinationChain for Bitcoin Testnet...");
    console.log("===========================================================");

    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    
    console.log("📋 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
    console.log("🌐 Network:", (await ethers.provider.getNetwork()).name);

    const BITCOIN_TESTNET_ID = 40004;

    console.log("\n📦 Deploying BitcoinDestinationChain...");
    const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
    
    console.log("⏳ Estimating gas...");
    const deployTx = await BitcoinDestinationChain.getDeployTransaction(BITCOIN_TESTNET_ID);
    const gasEstimate = await ethers.provider.estimateGas(deployTx);
    console.log("⛽ Estimated gas:", gasEstimate.toString());
    
    console.log("🚀 Deploying contract...");
    const bitcoinAdapter = await BitcoinDestinationChain.deploy(BITCOIN_TESTNET_ID);
    
    console.log("⏳ Waiting for deployment...");
    await bitcoinAdapter.waitForDeployment();
    
    const adapterAddress = await bitcoinAdapter.getAddress();
    console.log("✅ BitcoinDestinationChain deployed!");
    console.log("📍 Address:", adapterAddress);
    console.log("🔗 Etherscan:", `https://sepolia.etherscan.io/address/${adapterAddress}`);
    
    console.log("\n🧪 Verifying deployment...");
    const chainInfo = await bitcoinAdapter.getChainInfo();
    console.log("⛓️  Chain ID:", chainInfo.chainId.toString());
    console.log("📛 Chain Name:", chainInfo.name);
    console.log("🔄 Is Active:", chainInfo.isActive);
    
    // Test address validation
    console.log("\n🧪 Testing Bitcoin address validation...");
    const testAddresses = [
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", // Valid testnet
        "invalid-address" // Invalid
    ];
    
    for (const addr of testAddresses) {
        try {
            const isValid = await bitcoinAdapter.validateDestinationAddress(ethers.toUtf8Bytes(addr));
            console.log(`📝 ${addr}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
        } catch (error) {
            console.log(`📝 ${addr}: ❌ Error -`, error.message);
        }
    }
    
    const finalBalance = await ethers.provider.getBalance(deployer.address);
    const gasUsed = balance - finalBalance;
    console.log("\n💰 Gas Summary:");
    console.log("Starting balance:", ethers.formatEther(balance), "ETH");
    console.log("Final balance:", ethers.formatEther(finalBalance), "ETH");
    console.log("Gas used:", ethers.formatEther(gasUsed), "ETH");
    
    console.log("\n🎉 Deployment Complete!");
    console.log("Contract Address:", adapterAddress);
    console.log("Next: Register with CrossChainRegistry or deploy new registry");
    
    return {
        address: adapterAddress,
        chainId: BITCOIN_TESTNET_ID
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