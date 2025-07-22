const { ethers } = require("hardhat");

async function main() {
  console.log("🎯 Cross-Chain Atomic Swap Demo - Sepolia Testnet");
  console.log("=================================================\n");

  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    throw new Error("No signers available. Check your private key configuration.");
  }
  
  // For Sepolia, we'll use the same account for all roles (deployer, user, resolver)
  const deployer = signers[0];
  const user = deployer;     // Same account
  const resolver = deployer; // Same account
  
  console.log("🌐 Network: Sepolia Testnet");
  console.log("👥 Demo participants:");
  console.log("├── Deployer:", deployer.address);
  console.log("├── User (intent creator):", user.address);
  console.log("└── Resolver (market maker):", resolver.address);
  console.log("ℹ️  Note: Using same account for all roles on testnet");
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("\n💰 Deployer ETH balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.05")) {
    console.log("⚠️  Warning: Low ETH balance. Deployment may fail.");
    console.log("   Get Sepolia ETH from: https://sepoliafaucet.com/");
  }

  console.log("\n🏭 Deploying contracts to Sepolia...");
  
  // Deploy CrossChainFactory
  console.log("📦 Deploying CrossChainFactory...");
  const CrossChainFactory = await ethers.getContractFactory("CrossChainFactory");
  const factory = await CrossChainFactory.deploy();
  await factory.waitForDeployment();
  console.log("✅ CrossChainFactory deployed to:", factory.target);
  
  // Add resolver to factory
  console.log("🔧 Adding resolver to factory...");
  const addResolverTx = await factory.addResolver(resolver.address);
  await addResolverTx.wait();
  console.log("✅ Resolver added to factory");
  
  // For Sepolia, we'll use existing testnet tokens instead of deploying new ones
  // Common Sepolia testnet token addresses:
  const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
  const SEPOLIA_DAI = "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357";  // Sepolia DAI
  
  let testToken;
  let tokenSymbol;
  
  try {
    // Try to use Sepolia USDC first
    testToken = await ethers.getContractAt("IERC20", SEPOLIA_USDC);
    tokenSymbol = "USDC";
    console.log("✅ Using Sepolia USDC at:", SEPOLIA_USDC);
  } catch (error) {
    try {
      // Fallback to Sepolia DAI
      testToken = await ethers.getContractAt("IERC20", SEPOLIA_DAI);
      tokenSymbol = "DAI";
      console.log("✅ Using Sepolia DAI at:", SEPOLIA_DAI);
    } catch (error2) {
      console.log("❌ Cannot connect to testnet tokens. You may need to:");
      console.log("   1. Get testnet tokens from faucets");
      console.log("   2. Update token addresses in script");
      process.exit(1);
    }
  }

  // Check user token balance (don't mint, use existing balance)
  console.log("\n🔧 Checking token balances...");
  const userBalance = await testToken.balanceOf(user.address);
  console.log(`👤 User ${tokenSymbol} balance:`, ethers.formatEther(userBalance), tokenSymbol);
  
  const sourceAmount = ethers.parseEther("10"); // Reduced amount for testnet
  
  if (userBalance < sourceAmount) {
    console.log(`❌ Insufficient ${tokenSymbol} balance!`);
    console.log(`   Required: ${ethers.formatEther(sourceAmount)} ${tokenSymbol}`);
    console.log(`   Available: ${ethers.formatEther(userBalance)} ${tokenSymbol}`);
    console.log("\n💡 Get testnet tokens from:");
    console.log("   - https://faucet.circle.com/ (USDC)");
    console.log("   - https://sepolia-faucet.pk910.de/ (Multi-token)");
    
    // Continue demo with available balance if any
    if (userBalance > 0) {
      const availableAmount = userBalance;
      console.log(`\n🔄 Continuing demo with available balance: ${ethers.formatEther(availableAmount)} ${tokenSymbol}`);
      // You could adjust the demo to use available balance
    } else {
      console.log("\n⏹️  Demo stopped - no tokens available");
      process.exit(1);
    }
  }

  console.log(`✅ Sufficient ${tokenSymbol} balance for demo`);
  
  // Demo continues with intent creation (similar to main demo but with real testnet constraints)
  console.log("\n📝 Creating cross-chain swap intent...");
  console.log(`Intent: ${ethers.formatEther(sourceAmount)} ${tokenSymbol} (Ethereum) → 0.001 BTC (Bitcoin)`);
  
  const destinationAmount = ethers.parseUnits("100000", 15); // 0.001 BTC in satoshis
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const resolverFee = ethers.parseEther("0.1"); // 0.1 token fee
  
  const orderHash = ethers.keccak256(
    ethers.solidityPacked(
      ["address", "address", "uint256", "uint256"],
      [user.address, testToken.target, sourceAmount, expiry]
    )
  );

  try {
    const createIntentTx = await factory.connect(user).createIntent(
      orderHash,
      testToken.target,
      sourceAmount,
      1, // Bitcoin chain ID
      "0x0000000000000000000000000000000000000000", // Bitcoin doesn't have ERC20 addresses
      destinationAmount,
      "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", // Bitcoin address
      resolverFee,
      expiry
    );
    await createIntentTx.wait();
    console.log("✅ Intent created successfully");
    console.log("└── Order Hash:", orderHash);
    console.log("└── Transaction:", createIntentTx.hash);
  } catch (error) {
    console.log("❌ Failed to create intent:", error.message);
    process.exit(1);
  }

  // Save deployment info for future use
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: "sepolia",
    chainId: Number(network.chainId),
    deployer: deployer.address,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    contracts: {
      CrossChainFactory: factory.target,
      TestToken: testToken.target
    },
    demo: {
      orderHash: orderHash,
      tokenSymbol: tokenSymbol,
      sourceAmount: sourceAmount.toString(),
      destinationAmount: destinationAmount.toString()
    }
  };

  console.log("\n📦 Saving deployment info to deployments-sepolia.json");
  const fs = require('fs');
  fs.writeFileSync('deployments-sepolia.json', JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎉 SEPOLIA DEPLOYMENT COMPLETE!");
  console.log("================================");
  console.log("📋 Contract Addresses:");
  console.log("├── CrossChainFactory:", factory.target);
  console.log(`└── ${tokenSymbol} Token:`, testToken.target);
  console.log("\n📝 Next Steps:");
  console.log("1. Verify contracts on Etherscan:");
  console.log(`   npx hardhat verify --network sepolia ${factory.target}`);
  console.log("2. Fund resolver address with testnet tokens");
  console.log("3. Run resolver matching logic");
  console.log("4. Test full cross-chain swap flow");
  
  console.log("\n🔗 Useful Links:");
  console.log("├── Sepolia Etherscan: https://sepolia.etherscan.io/");
  console.log("├── Sepolia Faucet: https://sepoliafaucet.com/");
  console.log("└── USDC Faucet: https://faucet.circle.com/");
}

main()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });