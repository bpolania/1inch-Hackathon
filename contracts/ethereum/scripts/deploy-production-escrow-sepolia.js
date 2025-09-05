const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy Production 1inch EscrowFactory to Sepolia
 * 
 * This script deploys a production-ready EscrowFactory that's compatible
 * with 1inch's interface, enabling us to complete live testing on Sepolia
 * while maintaining the ability to switch to real 1inch contracts on mainnet.
 */

async function main() {
    console.log(" Deploying Production 1inch EscrowFactory to Sepolia");
    console.log("====================================================");

    // Get signer
    const [deployer] = await ethers.getSigners();
    console.log(" Deploying with account:", deployer.address);
    console.log(" Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // Check we're on Sepolia
    const network = await ethers.provider.getNetwork();
    console.log(" Network:", network.name, "| Chain ID:", network.chainId.toString());
    
    if (network.chainId !== 11155111n) {
        throw new Error("This script is only for Sepolia testnet (Chain ID: 11155111)");
    }

    console.log("");
    console.log(" Step 1: Deploy Production EscrowFactory");
    console.log("==========================================");

    // Deploy the production escrow factory
    console.log("Deploying ProductionOneInchEscrowFactory...");
    const ProductionEscrowFactory = await ethers.getContractFactory("ProductionOneInchEscrowFactory", deployer);
    const productionEscrowFactory = await ProductionEscrowFactory.deploy();
    await productionEscrowFactory.waitForDeployment();
    const escrowFactoryAddress = await productionEscrowFactory.getAddress();

    console.log(" ProductionOneInchEscrowFactory deployed to:", escrowFactoryAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + escrowFactoryAddress);

    // Verify implementation addresses
    const srcImpl = await productionEscrowFactory.escrowSrcImplementation();
    const dstImpl = await productionEscrowFactory.escrowDstImplementation();
    
    console.log(" Implementation Contracts:");
    console.log("   EscrowSrc Implementation:", srcImpl);
    console.log("   EscrowDst Implementation:", dstImpl);

    console.log("");
    console.log(" Step 2: Load Existing Deployment Info");
    console.log("========================================");

    // Load existing deployment info
    const deploymentPath = path.join(__dirname, "..", "sepolia-deployment.json");
    let deploymentInfo;
    
    try {
        deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        console.log(" Loaded existing deployment info");
    } catch (error) {
        console.log("  No existing deployment found, creating new deployment info");
        deploymentInfo = {
            network: {
                name: "sepolia",
                chainId: 11155111
            },
            deployer: deployer.address,
            deploymentDate: new Date().toISOString(),
            contracts: {}
        };
    }

    console.log("");
    console.log(" Step 3: Update NearTakerInteraction with New Factory");
    console.log("======================================================");

    // Deploy new NearTakerInteraction with production escrow factory
    console.log("Deploying NearTakerInteraction with production factory...");
    const NearTakerInteraction = await ethers.getContractFactory("NearTakerInteraction", deployer);
    const nearTakerInteraction = await NearTakerInteraction.deploy(
        deploymentInfo.contracts.CrossChainRegistry,
        escrowFactoryAddress
    );
    await nearTakerInteraction.waitForDeployment();
    const nearTakerAddress = await nearTakerInteraction.getAddress();

    console.log(" NearTakerInteraction deployed to:", nearTakerAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + nearTakerAddress);

    console.log("");
    console.log(" Step 4: Deploy New OneInchFusionPlusFactory");
    console.log("==============================================");

    // Deploy new factory with production escrow
    console.log("Deploying OneInchFusionPlusFactory with production components...");
    const OneInchFusionPlusFactory = await ethers.getContractFactory("OneInchFusionPlusFactory", deployer);
    const oneInchFactory = await OneInchFusionPlusFactory.deploy(
        deploymentInfo.contracts.CrossChainRegistry,
        escrowFactoryAddress,
        nearTakerAddress
    );
    await oneInchFactory.waitForDeployment();
    const factoryAddress = await oneInchFactory.getAddress();

    console.log(" OneInchFusionPlusFactory deployed to:", factoryAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + factoryAddress);

    console.log("");
    console.log(" Step 5: Configure Authorization");
    console.log("==================================");

    // Authorize deployer as resolver for testing
    console.log("Authorizing deployer as resolver...");
    const authTx1 = await oneInchFactory.authorizeResolver(deployer.address);
    await authTx1.wait();
    
    const authTx2 = await nearTakerInteraction.authorizeResolver(deployer.address);
    await authTx2.wait();
    
    console.log(" Deployer authorized as resolver in both contracts");

    console.log("");
    console.log(" Step 6: Update Deployment Info");
    console.log("=================================");

    // Update deployment info
    deploymentInfo.productionDeployment = {
        deploymentDate: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            ProductionOneInchEscrowFactory: escrowFactoryAddress,
            EscrowSrcImplementation: srcImpl,
            EscrowDstImplementation: dstImpl,
            NearTakerInteraction: nearTakerAddress,
            OneInchFusionPlusFactory: factoryAddress
        },
        etherscanLinks: {
            escrowFactory: `https://sepolia.etherscan.io/address/${escrowFactoryAddress}`,
            nearTakerInteraction: `https://sepolia.etherscan.io/address/${nearTakerAddress}`,
            oneInchFactory: `https://sepolia.etherscan.io/address/${factoryAddress}`
        }
    };

    // Save updated deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(" Updated deployment info saved to:", deploymentPath);

    console.log("");
    console.log(" Production Deployment Complete!");
    console.log("==================================");
    console.log("");
    console.log(" **Production-Ready Infrastructure**:");
    console.log(`    EscrowFactory: ${escrowFactoryAddress}`);
    console.log(`    NearTakerInteraction: ${nearTakerAddress}`);
    console.log(`    OneInchFusionPlusFactory: ${factoryAddress}`);
    console.log("");
    console.log(" **1inch Compatible**:");
    console.log("    Same IOneInchEscrowFactory interface");
    console.log("    Real escrow contract deployment");
    console.log("    Production-level security and validation");
    console.log("");
    console.log(" **Ready for Live Testing**:");
    console.log("    Run: npm run demo:cross-chain");
    console.log("    Complete atomic swap demonstration");
    console.log("    Full escrow deployment functionality");
    console.log("");
    console.log(" **Mainnet Migration Path**:");
    console.log("    Same contract code");
    console.log("    Switch EscrowFactory address to real 1inch");
    console.log("    Zero code changes required");

    // Return deployment info for potential use by other scripts
    return {
        escrowFactory: escrowFactoryAddress,
        nearTakerInteraction: nearTakerAddress,
        oneInchFactory: factoryAddress,
        implementations: {
            src: srcImpl,
            dst: dstImpl
        }
    };
}

// Execute if run directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(" Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = { main };