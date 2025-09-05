const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy New DT Token with Secure Account
 * 
 * This script deploys a new DemoToken (DT) with the new secure account
 * to replace the compromised token contract.
 */

async function main() {
    console.log(" Deploying New DT Token with Secure Account");
    console.log("==============================================");

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
    console.log(" Step 1: Deploy New DT Token");
    console.log("==============================");

    // Deploy the DT token (MockERC20)
    console.log("Deploying DemoToken (MockERC20)...");
    const MockERC20 = await ethers.getContractFactory("MockERC20", deployer);
    const demoToken = await MockERC20.deploy(
        "Demo Token",    // name
        "DT",           // symbol
        18              // decimals
    );
    await demoToken.waitForDeployment();
    const tokenAddress = await demoToken.getAddress();

    console.log(" DemoToken deployed to:", tokenAddress);
    console.log("   View on Etherscan: https://sepolia.etherscan.io/address/" + tokenAddress);

    console.log("");
    console.log(" Step 2: Mint Initial Supply");
    console.log("===============================");

    // Mint initial supply for the deployer
    const initialSupply = ethers.parseEther("1000000"); // 1M DT tokens
    console.log("Minting initial supply of 1,000,000 DT tokens...");
    const mintTx = await demoToken.mint(deployer.address, initialSupply);
    await mintTx.wait();

    console.log(" Minted", ethers.formatEther(initialSupply), "DT tokens to deployer");

    // Check token info
    const name = await demoToken.name();
    const symbol = await demoToken.symbol();
    const decimals = await demoToken.decimals();
    const totalSupply = await demoToken.totalSupply();
    const deployerBalance = await demoToken.balanceOf(deployer.address);

    console.log("");
    console.log(" Token Information:");
    console.log("   Name:", name);
    console.log("   Symbol:", symbol);
    console.log("   Decimals:", decimals.toString());
    console.log("   Total Supply:", ethers.formatEther(totalSupply), "DT");
    console.log("   Deployer Balance:", ethers.formatEther(deployerBalance), "DT");

    console.log("");
    console.log(" Step 3: Update Deployment Info");
    console.log("=================================");

    // Load existing deployment info
    const deploymentPath = path.join(__dirname, "..", "sepolia-deployment.json");
    let deploymentInfo;
    
    try {
        deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        console.log(" Loaded existing deployment info");
    } catch (error) {
        console.log(" Could not load existing deployment info");
        throw new Error("Deployment info file is required for token replacement");
    }

    // Update the DemoToken address in production deployment
    if (!deploymentInfo.productionDeployment) {
        deploymentInfo.productionDeployment = {
            contracts: {}
        };
    }

    // Store the old token address for reference
    const oldTokenAddress = deploymentInfo.productionDeployment.contracts.DemoToken;
    if (oldTokenAddress) {
        console.log(" Replacing old DT token:", oldTokenAddress);
    }

    // Update with new token address
    deploymentInfo.productionDeployment.contracts.DemoToken = tokenAddress;
    deploymentInfo.productionDeployment.etherscanLinks.demoToken = `https://sepolia.etherscan.io/address/${tokenAddress}`;
    
    // Add token deployment info
    deploymentInfo.tokenDeployment = {
        deploymentDate: new Date().toISOString(),
        deployer: deployer.address,
        oldTokenAddress: oldTokenAddress || "none",
        newTokenAddress: tokenAddress,
        tokenInfo: {
            name: name,
            symbol: symbol,
            decimals: decimals.toString(),
            initialSupply: ethers.formatEther(initialSupply)
        }
    };

    // Save updated deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(" Updated deployment info saved to:", deploymentPath);

    console.log("");
    console.log(" New DT Token Deployment Complete!");
    console.log("====================================");
    console.log("");
    console.log(" **New Secure DT Token**:");
    console.log(`    Token Address: ${tokenAddress}`);
    console.log(`    Token Name: ${name}`);
    console.log(`    Token Symbol: ${symbol}`);
    console.log(`    Initial Supply: ${ethers.formatEther(initialSupply)} DT`);
    console.log("");
    console.log(" **Security Improvement**:");
    console.log("    Deployed with new secure account");
    console.log("    Old compromised token replaced");
    console.log("    Same MockERC20 contract code");
    console.log("");
    console.log(" **Next Steps**:");
    console.log("    Update .env files with new token address");
    console.log("    Restart API services with new token");
    console.log("    Test intent submission with new token");
    console.log("");
    console.log(" **Etherscan Link**:");
    console.log(`   https://sepolia.etherscan.io/address/${tokenAddress}`);

    if (oldTokenAddress) {
        console.log("");
        console.log("  **Migration Notes**:");
        console.log(`    Old Token: ${oldTokenAddress}`);
        console.log(`    New Token: ${tokenAddress}`);
        console.log("    Update all services to use new token address");
    }

    // Return deployment info for potential use by other scripts
    return {
        tokenAddress: tokenAddress,
        deployer: deployer.address,
        tokenInfo: {
            name: name,
            symbol: symbol,
            decimals: decimals,
            totalSupply: totalSupply,
            deployerBalance: deployerBalance
        }
    };
}

// Execute if run directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(" Token deployment failed:", error);
            process.exit(1);
        });
}

module.exports = { main };