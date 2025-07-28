const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(signer.address);
    console.log("Address:", signer.address);
    console.log("ETH Balance:", ethers.formatEther(balance), "ETH");
    console.log("Wei Balance:", balance.toString());
    console.log("\nYou need more Sepolia ETH to continue. Get some from:");
    console.log("- https://sepoliafaucet.io");
    console.log("- https://faucet.sepolia.dev");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });