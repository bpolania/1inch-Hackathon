const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    const network = await ethers.provider.getNetwork();
    
    console.log("🔍 Account Balance Check");
    console.log("========================");
    console.log("Deployer address:", deployer.address);
    console.log("Network:", network.name);
    console.log("Chain ID:", network.chainId.toString());
    console.log("Balance:", ethers.formatEther(balance), "ETH");
    
    // Estimate gas for BitcoinDestinationChain deployment
    const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
    const deployTx = await BitcoinDestinationChain.getDeployTransaction(40004);
    const gasEstimate = await ethers.provider.estimateGas(deployTx);
    const gasPrice = await ethers.provider.getGasPrice();
    const estimatedCost = gasEstimate * gasPrice;
    
    console.log("\n⛽ Gas Estimates:");
    console.log("BitcoinDestinationChain deploy gas:", gasEstimate.toString());
    console.log("Current gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
    console.log("Estimated deploy cost:", ethers.formatEther(estimatedCost), "ETH");
    console.log("Can deploy:", balance > estimatedCost ? "✅ YES" : "❌ NO");
}

main().catch(console.error);