const { ethers } = require("hardhat");

async function main() {
    console.log(" Deploying 1inch Fusion+ Cross-Chain Extension...");
    console.log("================================================");

    const [deployer] = await ethers.getSigners();
    console.log(" Deploying with account:", deployer.address);
    console.log(" Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Chain IDs for destination chains
    const NEAR_MAINNET_ID = 40001;
    const NEAR_TESTNET_ID = 40002;
    const BITCOIN_MAINNET_ID = 40003;
    const BITCOIN_TESTNET_ID = 40004;
    const DOGECOIN_MAINNET_ID = 40005;
    const LITECOIN_MAINNET_ID = 40006;
    const BITCOIN_CASH_MAINNET_ID = 40007;

    console.log("\n Step 1: Deploying CrossChainRegistry...");
    const CrossChainRegistry = await ethers.getContractFactory("CrossChainRegistry");
    const registry = await CrossChainRegistry.deploy();
    await registry.waitForDeployment();
    console.log(" CrossChainRegistry deployed to:", await registry.getAddress());

    console.log("\n Step 2: Deploying Destination Chain Adapters...");
    
    // Deploy NEAR adapters
    const NearDestinationChain = await ethers.getContractFactory("NearDestinationChain");
    const nearMainnetAdapter = await NearDestinationChain.deploy(NEAR_MAINNET_ID);
    await nearMainnetAdapter.waitForDeployment();
    console.log(" NEAR Mainnet Adapter deployed to:", await nearMainnetAdapter.getAddress());

    const nearTestnetAdapter = await NearDestinationChain.deploy(NEAR_TESTNET_ID);
    await nearTestnetAdapter.waitForDeployment();
    console.log(" NEAR Testnet Adapter deployed to:", await nearTestnetAdapter.getAddress());

    // Deploy Bitcoin adapters for each chain
    const BitcoinDestinationChain = await ethers.getContractFactory("BitcoinDestinationChain");
    const bitcoinAdapters = {};
    
    const bitcoinChains = [
        { id: BITCOIN_MAINNET_ID, name: "Bitcoin Mainnet" },
        { id: BITCOIN_TESTNET_ID, name: "Bitcoin Testnet" },
        { id: DOGECOIN_MAINNET_ID, name: "Dogecoin" },
        { id: LITECOIN_MAINNET_ID, name: "Litecoin" },
        { id: BITCOIN_CASH_MAINNET_ID, name: "Bitcoin Cash" }
    ];
    
    for (const chain of bitcoinChains) {
        const adapter = await BitcoinDestinationChain.deploy(chain.id);
        await adapter.waitForDeployment();
        bitcoinAdapters[chain.id] = adapter;
        console.log(` ${chain.name} Adapter deployed to:`, await adapter.getAddress());
    }

    console.log("\n Step 3: Deploying FusionPlusFactory...");
    const FusionPlusFactory = await ethers.getContractFactory("FusionPlusFactory");
    const factory = await FusionPlusFactory.deploy(await registry.getAddress());
    await factory.waitForDeployment();
    console.log(" FusionPlusFactory deployed to:", await factory.getAddress());

    console.log("\n Step 4: Registering Destination Chain Adapters...");
    
    // Register NEAR adapters
    console.log(" Registering NEAR adapters...");
    let tx = await registry.registerChainAdapter(NEAR_MAINNET_ID, await nearMainnetAdapter.getAddress());
    await tx.wait();
    console.log(" NEAR Mainnet adapter registered");

    tx = await registry.registerChainAdapter(NEAR_TESTNET_ID, await nearTestnetAdapter.getAddress());
    await tx.wait();
    console.log(" NEAR Testnet adapter registered");

    // Register Bitcoin family adapters
    console.log(" Registering Bitcoin family adapters...");
    for (const chain of bitcoinChains) {
        tx = await registry.registerChainAdapter(chain.id, await bitcoinAdapters[chain.id].getAddress());
        await tx.wait();
        console.log(` ${chain.name} adapter registered`);
    }

    console.log("\n Step 5: Setting up Initial Resolver Authorization...");
    // Add deployer as initial authorized resolver for testing
    tx = await factory.authorizeResolver(deployer.address);
    await tx.wait();
    console.log(" Deployer authorized as resolver");

    console.log("\n Step 6: Verifying Deployment...");
    
    // Verify registry
    const supportedChains = await registry.getSupportedChainIds();
    console.log(" Supported chains:", supportedChains.map(id => id.toString()));
    
    // Verify NEAR adapters
    const nearMainnetInfo = await registry.getChainInfo(NEAR_MAINNET_ID);
    const nearTestnetInfo = await registry.getChainInfo(NEAR_TESTNET_ID);
    console.log(" NEAR Mainnet:", nearMainnetInfo.name, "- Active:", nearMainnetInfo.isActive);
    console.log(" NEAR Testnet:", nearTestnetInfo.name, "- Active:", nearTestnetInfo.isActive);
    
    // Verify Bitcoin adapters
    const bitcoinTestnetInfo = await registry.getChainInfo(BITCOIN_TESTNET_ID);
    console.log(" Bitcoin Testnet:", bitcoinTestnetInfo.name, "- Active:", bitcoinTestnetInfo.isActive);
    
    // Verify factory
    const resolverCount = await factory.resolverCount();
    console.log(" Authorized resolvers:", resolverCount.toString());

    console.log("\n Deployment Summary");
    console.log("====================");
    console.log(` CrossChainRegistry: ${await registry.getAddress()}`);
    console.log(` FusionPlusFactory: ${await factory.getAddress()}`);
    console.log(` NEAR Mainnet Adapter: ${await nearMainnetAdapter.getAddress()}`);
    console.log(` NEAR Testnet Adapter: ${await nearTestnetAdapter.getAddress()}`);
    console.log(" Bitcoin Adapters:");
    for (const chain of bitcoinChains) {
        console.log(`   - ${chain.name}: ${await bitcoinAdapters[chain.id].getAddress()}`);
    }
    console.log("");
    console.log(" Statistics:");
    console.log(`   - Supported Chains: ${supportedChains.length}`);
    console.log(`   - Authorized Resolvers: ${resolverCount}`);
    console.log("");
    console.log(" Next Steps:");
    console.log("   1. Deploy to testnet/mainnet");
    console.log("   2. Add more destination chain adapters (Cosmos, Polkadot)");
    console.log("   3. Authorize 1inch resolvers");
    console.log("   4. Update live demo to use new contracts");

    // Save deployment addresses
    const deploymentInfo = {
        network: await deployer.provider.getNetwork().then(n => n.name),
        chainId: await deployer.provider.getNetwork().then(n => n.chainId.toString()),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            CrossChainRegistry: await registry.getAddress(),
            FusionPlusFactory: await factory.getAddress(),
            NearMainnetAdapter: await nearMainnetAdapter.getAddress(),
            NearTestnetAdapter: await nearTestnetAdapter.getAddress(),
            BitcoinMainnetAdapter: await bitcoinAdapters[BITCOIN_MAINNET_ID].getAddress(),
            BitcoinTestnetAdapter: await bitcoinAdapters[BITCOIN_TESTNET_ID].getAddress(),
            DogecoinAdapter: await bitcoinAdapters[DOGECOIN_MAINNET_ID].getAddress(),
            LitecoinAdapter: await bitcoinAdapters[LITECOIN_MAINNET_ID].getAddress(),
            BitcoinCashAdapter: await bitcoinAdapters[BITCOIN_CASH_MAINNET_ID].getAddress(),
        },
        chainIds: {
            NEAR_MAINNET: NEAR_MAINNET_ID,
            NEAR_TESTNET: NEAR_TESTNET_ID,
            BITCOIN_MAINNET: BITCOIN_MAINNET_ID,
            BITCOIN_TESTNET: BITCOIN_TESTNET_ID,
            DOGECOIN_MAINNET: DOGECOIN_MAINNET_ID,
            LITECOIN_MAINNET: LITECOIN_MAINNET_ID,
            BITCOIN_CASH_MAINNET: BITCOIN_CASH_MAINNET_ID,
        },
        supportedChains: supportedChains.map(id => id.toString()),
        initialResolvers: [deployer.address]
    };

    // Write deployment info to file
    const fs = require('fs');
    const path = require('path');
    const deploymentPath = path.join(__dirname, '..', 'fusion-plus-deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n Deployment info saved to: ${deploymentPath}`);
    
    return deploymentInfo;
}

// Handle script execution
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(" Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = { main };