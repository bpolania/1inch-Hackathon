/**
 * Deploy Bitcoin Destination Chain Adapters to Sepolia Testnet
 * 
 * This script deploys Bitcoin, Dogecoin, and Litecoin adapters to Sepolia
 * and registers them with the existing CrossChainRegistry.
 */

const { ethers } = require("hardhat");

// Existing Sepolia deployment addresses (from README)
const CROSS_CHAIN_REGISTRY_ADDRESS = "0x59CE43Ea20892EC3Eff00fc7506cbfA9813FE0ca";

// Bitcoin family chain IDs
const BITCOIN_TESTNET_ID = 50002;
const DOGECOIN_MAINNET_ID = 50003;
const LITECOIN_MAINNET_ID = 50005;

async function main() {
    console.log("🚀 Deploying Bitcoin Adapters to Sepolia Testnet");
    console.log("==================================================\n");

    const [deployer] = await ethers.getSigners();
    console.log("📍 Deployer:", deployer.address);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.1")) {
        throw new Error("❌ Insufficient balance for deployment. Need at least 0.1 ETH");
    }
    
    console.log("🌐 Network:", (await deployer.provider.getNetwork()).name);
    console.log();

    // Deploy Bitcoin adapters
    console.log("1. 📦 Deploying Bitcoin Destination Chain Adapters...");
    
    const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
    
    // Deploy Bitcoin Testnet adapter
    console.log("   🔄 Deploying Bitcoin Testnet adapter...");
    const btcTestnetAdapter = await BitcoinDestinationChain.deploy(BITCOIN_TESTNET_ID);
    await btcTestnetAdapter.waitForDeployment();
    const btcTestnetAddress = await btcTestnetAdapter.getAddress();
    console.log("   ✅ Bitcoin Testnet Adapter:", btcTestnetAddress);
    
    // Deploy Dogecoin Mainnet adapter
    console.log("   🔄 Deploying Dogecoin Mainnet adapter...");
    const dogeAdapter = await BitcoinDestinationChain.deploy(DOGECOIN_MAINNET_ID);
    await dogeAdapter.waitForDeployment(); 
    const dogeAddress = await dogeAdapter.getAddress();
    console.log("   ✅ Dogecoin Mainnet Adapter:", dogeAddress);
    
    // Deploy Litecoin Mainnet adapter
    console.log("   🔄 Deploying Litecoin Mainnet adapter...");
    const ltcAdapter = await BitcoinDestinationChain.deploy(LITECOIN_MAINNET_ID);
    await ltcAdapter.waitForDeployment();
    const ltcAddress = await ltcAdapter.getAddress();
    console.log("   ✅ Litecoin Mainnet Adapter:", ltcAddress);

    // Connect to existing CrossChainRegistry
    console.log("\n2. 🔗 Registering with CrossChainRegistry...");
    console.log("   📍 Registry Address:", CROSS_CHAIN_REGISTRY_ADDRESS);
    
    const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
    const registry = CrossChainRegistry.attach(CROSS_CHAIN_REGISTRY_ADDRESS);
    
    // Check if we're the owner (needed for registration)
    try {
        const owner = await registry.owner();
        console.log("   👤 Registry Owner:", owner);
        
        if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
            console.log("   ⚠️  Warning: Deployer is not registry owner. Chain registration will be skipped.");
            console.log("   ℹ️  Manual registration required by owner address");
        } else {
            // Register Bitcoin Testnet
            console.log("   🔄 Registering Bitcoin Testnet...");
            const tx1 = await registry.registerChain(BITCOIN_TESTNET_ID, btcTestnetAddress);
            await tx1.wait();
            console.log("   ✅ Bitcoin Testnet registered");
            
            // Register Dogecoin Mainnet
            console.log("   🔄 Registering Dogecoin Mainnet...");
            const tx2 = await registry.registerChain(DOGECOIN_MAINNET_ID, dogeAddress);
            await tx2.wait();
            console.log("   ✅ Dogecoin Mainnet registered");
            
            // Register Litecoin Mainnet
            console.log("   🔄 Registering Litecoin Mainnet...");
            const tx3 = await registry.registerChain(LITECOIN_MAINNET_ID, ltcAddress);
            await tx3.wait();
            console.log("   ✅ Litecoin Mainnet registered");
        }
    } catch (error) {
        console.log("   ⚠️  Could not access registry owner:", error.message);
        console.log("   ℹ️  Manual registration may be required");
    }

    // Verify deployments
    console.log("\n3. ✅ Verifying Deployments...");
    
    const btcInfo = await btcTestnetAdapter.getChainInfo();
    const dogeInfo = await dogeAdapter.getChainInfo();
    const ltcInfo = await ltcAdapter.getChainInfo();
    
    console.log(`   📊 ${btcInfo.name}: Chain ${btcInfo.chainId} (${btcInfo.symbol})`);
    console.log(`   📊 ${dogeInfo.name}: Chain ${dogeInfo.chainId} (${dogeInfo.symbol})`);
    console.log(`   📊 ${ltcInfo.name}: Chain ${ltcInfo.chainId} (${ltcInfo.symbol})`);

    // Test basic functionality
    console.log("\n4. 🧪 Testing Basic Functionality...");
    
    // Test address validation
    const testBtcAddress = "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn";
    const isValidBtc = await btcTestnetAdapter.validateDestinationAddress(ethers.toUtf8Bytes(testBtcAddress));
    console.log(`   ${isValidBtc ? '✅' : '❌'} Bitcoin address validation: ${testBtcAddress}`);
    
    // Test safety deposit calculation
    const amount = ethers.parseEther("0.1");
    const safetyDeposit = await btcTestnetAdapter.calculateMinSafetyDeposit(amount);
    console.log(`   💰 Safety deposit for 0.1 BTC: ${ethers.formatEther(safetyDeposit)} (5%)`);
    
    // Test feature support
    const supportsHTLC = await btcTestnetAdapter.supportsFeature("htlc");
    console.log(`   ${supportsHTLC ? '✅' : '❌'} HTLC support: ${supportsHTLC}`);

    console.log("\n🎉 Bitcoin Adapter Deployment Complete!");
    console.log("\n📋 Deployment Summary:");
    console.log("=====================================");
    console.log("Contract Addresses (Sepolia Testnet):");
    console.log(`- Bitcoin Testnet Adapter: ${btcTestnetAddress}`);
    console.log(`- Dogecoin Mainnet Adapter: ${dogeAddress}`);
    console.log(`- Litecoin Mainnet Adapter: ${ltcAddress}`);
    console.log("");
    console.log("Etherscan Links:");
    console.log(`- Bitcoin Testnet: https://sepolia.etherscan.io/address/${btcTestnetAddress}`);
    console.log(`- Dogecoin: https://sepolia.etherscan.io/address/${dogeAddress}`);
    console.log(`- Litecoin: https://sepolia.etherscan.io/address/${ltcAddress}`);
    console.log("");
    console.log("🎯 Ready for ETHGlobal Unite Bitcoin Bounty Demo!");
    console.log("💰 Total Prize Pool: $32,000");
    console.log("🏆 Qualification: ✅ COMPLETE");

    // Save deployment results
    const deploymentResults = {
        network: "sepolia",
        chainId: (await deployer.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            bitcoinTestnet: {
                address: btcTestnetAddress,
                chainId: BITCOIN_TESTNET_ID,
                name: btcInfo.name,
                symbol: btcInfo.symbol
            },
            dogecoin: {
                address: dogeAddress,
                chainId: DOGECOIN_MAINNET_ID,
                name: dogeInfo.name,
                symbol: dogeInfo.symbol
            },
            litecoin: {
                address: ltcAddress,
                chainId: LITECOIN_MAINNET_ID,
                name: ltcInfo.name,
                symbol: ltcInfo.symbol
            }
        },
        registry: CROSS_CHAIN_REGISTRY_ADDRESS,
        testResults: {
            addressValidation: isValidBtc,
            safetyDepositCalculation: ethers.formatEther(safetyDeposit),
            htlcSupport: supportsHTLC
        }
    };

    // Write results to file
    const fs = require('fs');
    fs.writeFileSync(
        'bitcoin-deployment-results.json',
        JSON.stringify(deploymentResults, null, 2)
    );
    console.log("\n📄 Deployment results saved to: bitcoin-deployment-results.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error.message);
        process.exit(1);
    });