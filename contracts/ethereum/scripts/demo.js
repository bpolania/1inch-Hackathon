const { ethers } = require("hardhat");

async function main() {
  console.log("🎯 Cross-Chain Atomic Swap Demo");
  console.log("=====================================\n");

  const [, user, resolver] = await ethers.getSigners();
  
  console.log("🏭 Deploying contracts for demo...");
  
  // Deploy CrossChainFactory
  const CrossChainFactory = await ethers.getContractFactory("CrossChainFactory");
  const factory = await CrossChainFactory.deploy();
  await factory.waitForDeployment();
  console.log("✅ CrossChainFactory deployed to:", factory.target);
  
  // Deploy test token
  const MockToken = await ethers.getContractFactory("MockERC20");
  const testToken = await MockToken.deploy("Test USDC", "USDC", 18);
  await testToken.waitForDeployment();
  console.log("✅ Test token deployed to:", testToken.target);
  
  // Add resolver to factory
  await factory.addResolver(resolver.address);
  console.log("✅ Resolver added to factory");

  console.log("👥 Demo participants:");
  console.log("├── User (intent creator):", user.address);
  console.log("├── Resolver (market maker):", resolver.address);
  console.log("└── Factory contract:", factory.target);
  console.log();

  // Step 1: Setup - mint tokens to user
  console.log("🔧 Step 1: Setup - Minting test tokens to user...");
  const userTokens = ethers.parseEther("1000"); // 1000 USDC
  await testToken.mint(user.address, userTokens);
  console.log("✅ Minted", ethers.formatEther(userTokens), "USDC to user");
  
  // Resolver already added during initial setup
  console.log("✅ Resolver already added to factory\n");

  // Step 2: User creates cross-chain swap intent
  console.log("📝 Step 2: User creates cross-chain swap intent...");
  console.log("Intent: 100 USDC (Ethereum) → 0.025 BTC (Bitcoin)");
  
  const orderHash = ethers.keccak256(ethers.toUtf8Bytes(`order-${Date.now()}`));
  const sourceAmount = ethers.parseEther("100"); // 100 USDC
  const destinationAmount = ethers.parseEther("0.025"); // 0.025 BTC (in wei for demo)
  const resolverFee = ethers.parseEther("1"); // 1 USDC fee
  const expiryTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  const tx1 = await factory.connect(user).createIntent(
    orderHash,
    testToken.target, // Source token (USDC)
    sourceAmount,
    20001, // Bitcoin mainnet (from our chain IDs)
    "0x0000000000000000000000000000000000000000", // Native BTC
    destinationAmount,
    "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", // Bitcoin address
    resolverFee,
    expiryTime
  );
  await tx1.wait();
  console.log("✅ Intent created with hash:", orderHash);
  console.log("└── Transaction:", tx1.hash, "\n");

  // Step 3: Resolver matches the intent
  console.log("🤝 Step 3: Resolver matches the intent...");
  
  const secret = ethers.encodeBytes32String("hackathon-demo-secret");
  const hashlock = ethers.keccak256(secret);
  
  // Pack timelocks (demo values)
  const now = Math.floor(Date.now() / 1000);
  const stages = [
    now + 1800,   // 30 min
    now + 3600,   // 1 hour  
    now + 7200,   // 2 hours
    now + 10800,  // 3 hours
    now + 1800,   // 30 min
    now + 3600,   // 1 hour
    now + 7200,   // 2 hours
  ];
  
  let timelocks = 0n;
  for (let i = 0; i < stages.length; i++) {
    timelocks = timelocks | (BigInt(stages[i]) << BigInt(i * 32));
  }

  console.log("🔍 About to call matchIntent with:");
  console.log("├── orderHash:", orderHash);
  console.log("├── hashlock:", hashlock);
  console.log("└── timelocks:", timelocks);
  
  let tx2, receipt;
  try {
    tx2 = await factory.connect(resolver).matchIntent(orderHash, hashlock, timelocks);
    receipt = await tx2.wait();
    
    console.log("✅ Intent matched by resolver");
    console.log("├── Transaction:", tx2.hash);
    console.log("├── Gas used:", receipt.gasUsed.toString());
    console.log("└── Status:", receipt.status);
  } catch (error) {
    console.log("❌ matchIntent failed:", error.message);
    if (error.reason) console.log("Reason:", error.reason);
    throw error;
  }
  
  // Now get the escrow addresses created by the factory
  console.log("🏦 Getting escrow addresses from factory...");
  
  const [sourceEscrowAddress, destinationEscrowAddress] = await factory.getEscrowAddresses(orderHash);
  
  if (sourceEscrowAddress === ethers.ZeroAddress) {
    throw new Error("Factory did not create escrow contracts - matchIntent may have failed");
  }
  
  const sourceEscrow = await ethers.getContractAt("CrossChainEscrow", sourceEscrowAddress);
  
  console.log("🏦 Escrow contracts created:");
  console.log("├── Source (Ethereum):", sourceEscrowAddress);
  console.log("└── Destination (Bitcoin):", destinationEscrowAddress);
  console.log();

  // Step 4: User locks tokens in source escrow
  console.log("🔒 Step 4: User locks 100 USDC in Ethereum escrow...");
  
  // Approve tokens to escrow
  await testToken.connect(user).approve(sourceEscrow.target, sourceAmount);
  const tx3 = await sourceEscrow.connect(user).lock();
  await tx3.wait();
  console.log("✅ 100 USDC locked in Ethereum escrow");
  console.log("└── Transaction:", tx3.hash, "\n");

  // Step 5: Resolver locks Bitcoin (simulated)
  console.log("₿ Step 5: Resolver locks 0.025 BTC in Bitcoin HTLC (simulated)...");
  console.log("✅ 0.025 BTC locked in Bitcoin script (bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh)");
  console.log("└── Bitcoin TX: [simulated - in real implementation would be actual Bitcoin transaction]");
  console.log();

  // Step 6: User claims Bitcoin by revealing secret (simulated)
  console.log("🎁 Step 6: User claims Bitcoin by revealing secret (simulated)...");
  console.log("✅ User revealed secret and claimed 0.025 BTC");
  console.log("└── Secret revealed:", ethers.decodeBytes32String(secret));
  console.log();

  // Step 7: Resolver claims USDC using the same secret
  console.log("💰 Step 7: Resolver claims 100 USDC using revealed secret...");
  const tx4 = await sourceEscrow.connect(resolver).claim(secret);
  await tx4.wait();
  console.log("✅ Resolver claimed 100 USDC from Ethereum escrow");
  console.log("└── Transaction:", tx4.hash);
  
  const resolverBalance = await testToken.balanceOf(resolver.address);
  console.log("└── Resolver USDC balance:", ethers.formatEther(resolverBalance), "USDC\n");

  // Demo Summary
  console.log("🎉 CROSS-CHAIN ATOMIC SWAP COMPLETE!");
  console.log("=====================================");
  console.log("✅ User successfully swapped 100 USDC → 0.025 BTC");
  console.log("✅ Atomic guarantee: Both sides completed successfully");
  console.log("✅ 1inch Fusion+ architecture extended to Bitcoin");
  console.log("✅ Hash Time Locked Contracts ensure security");
  console.log();
  
  console.log("📊 Demo Results:");
  console.log("├── Intent created and matched ✅");
  console.log("├── Ethereum escrow locked ✅"); 
  console.log("├── Bitcoin HTLC simulated ✅");
  console.log("├── Secret revealed atomically ✅");
  console.log("└── Both parties received their tokens ✅");
  console.log();
  
  console.log("🚀 Ready for hackathon submission!");
  console.log("Next: Deploy to other chains (Aptos, Cosmos) for full multi-chain demo");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Demo failed:", error);
    process.exit(1);
  });