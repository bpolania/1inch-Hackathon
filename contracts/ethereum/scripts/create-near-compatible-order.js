const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Create a new order with SHA-256 hashlock for NEAR compatibility
 */
async function main() {
    console.log(" Creating NEAR-Compatible Order with SHA-256 Hashlock");
    console.log("======================================================");
    console.log("");

    const deploymentInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "sepolia-deployment.json"), "utf8"));
    const [signer] = await ethers.getSigners();

    // Connect to contracts
    const factoryAddress = deploymentInfo.productionDeployment.contracts.OneInchFusionPlusFactory;
    const factory = await ethers.getContractAt("OneInchFusionPlusFactory", factoryAddress, signer);
    const tokenAddress = deploymentInfo.productionDeployment.contracts.DemoToken;
    const demoToken = await ethers.getContractAt("MockERC20", tokenAddress, signer);

    // Generate atomic swap credentials with SHA-256
    const secretBytes = crypto.randomBytes(32);
    const secret = secretBytes.toString("hex");
    const hashlockBuffer = crypto.createHash('sha256').update(secretBytes).digest();
    const hashlock = "0x" + hashlockBuffer.toString('hex');
    
    console.log(" Generated atomic swap credentials (SHA-256):");
    console.log("   Secret:", "0x" + secret);
    console.log("   Hashlock:", hashlock);
    console.log("");

    // Check balance
    const currentBalance = await demoToken.balanceOf(signer.address);
    console.log(" Current DT balance:", ethers.formatEther(currentBalance), "DT");
    
    const requiredAmount = ethers.parseEther("1");
    if (currentBalance < requiredAmount) {
        console.log(" Minting tokens...");
        await demoToken.mint(signer.address, requiredAmount - currentBalance);
        console.log(" Minted tokens");
    }

    // Create order
    const swapAmount = ethers.parseEther("0.2");
    const resolverFee = ethers.parseEther("0.02");
    
    console.log("Approving tokens...");
    const approveTx = await demoToken.approve(await factory.getAddress(), swapAmount + resolverFee);
    await approveTx.wait();
    
    const orderParams = {
        sourceToken: tokenAddress,
        sourceAmount: swapAmount,
        destinationChainId: 40002, // NEAR Testnet
        destinationToken: ethers.toUtf8Bytes("native.near"),
        destinationAmount: ethers.parseEther("0.004"),
        destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
        resolverFeeAmount: resolverFee,
        expiryTime: Math.floor(Date.now() / 1000) + 3600,
        hashlock: hashlock,
        chainParams: {
            destinationAddress: ethers.toUtf8Bytes("fusion-plus.demo.cuteharbor3573.testnet"),
            executionParams: ethers.toUtf8Bytes(""),
            estimatedGas: 300_000_000_000_000n,
            additionalData: hashlock
        }
    };

    console.log("Creating order...");
    const createTx = await factory.createFusionOrder(orderParams);
    const createReceipt = await createTx.wait();
    
    // Extract order hash
    let orderHash;
    for (const log of createReceipt.logs) {
        try {
            const parsed = factory.interface.parseLog(log);
            if (parsed.name === "FusionOrderCreated") {
                orderHash = parsed.args.orderHash;
                break;
            }
        } catch (e) {}
    }

    console.log(" Order created!");
    console.log("   Order Hash:", orderHash);
    console.log("   Transaction:", createReceipt.hash);
    console.log("");

    // Save results
    const nearCompatibleResults = {
        timestamp: new Date().toISOString(),
        orderHash: orderHash,
        hashlock: hashlock,
        secret: "0x" + secret,
        secretRaw: secret,
        hashAlgorithm: "SHA-256",
        transactionHash: createReceipt.hash,
        orderDetails: {
            sourceAmount: ethers.formatEther(swapAmount),
            destinationAmount: ethers.formatEther(orderParams.destinationAmount),
            resolverFee: ethers.formatEther(resolverFee),
            expiryTime: orderParams.expiryTime
        },
        contracts: deploymentInfo.productionDeployment.contracts
    };
    
    const resultsPath = path.join(__dirname, "..", "near-compatible-order.json");
    fs.writeFileSync(resultsPath, JSON.stringify(nearCompatibleResults, null, 2));
    
    console.log(" Order details saved to:", resultsPath);
    console.log("\n Next Steps:");
    console.log("1. Use the order hash and secret in NEAR execution");
    console.log("2. The secret for NEAR should be:", secret, "(without 0x prefix)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });