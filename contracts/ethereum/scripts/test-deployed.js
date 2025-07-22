const { ethers } = require("hardhat");

// Deployed Sepolia contract address
const FACTORY_ADDRESS = "0x98c35dA70f839F1B7965b8b8BA17654Da11f4486";
const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function main() {
  console.log("🧪 Testing Deployed Sepolia Contracts");
  console.log("=====================================\n");
  
  // Connect to deployed factory
  const factory = await ethers.getContractAt("CrossChainFactory", FACTORY_ADDRESS);
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Contract Information:");
  console.log("├── Network:", network.name, `(${network.chainId})`);
  console.log("├── Factory Address:", FACTORY_ADDRESS);
  console.log("└── Etherscan:", `https://sepolia.etherscan.io/address/${FACTORY_ADDRESS}\n`);
  
  // Test 1: Read basic contract state
  console.log("🔍 Test 1: Reading Contract State");
  console.log("----------------------------------");
  
  try {
    const resolverCount = await factory.resolverCount();
    console.log("✅ Resolver count:", resolverCount.toString());
    
    const minSafetyDeposit = await factory.minimumSafetyDepositBps();
    console.log("✅ Min safety deposit:", minSafetyDeposit.toString(), "bps");
    
    const owner = await factory.owner();
    console.log("✅ Contract owner:", owner);
    
    // Check if deployer is authorized resolver
    const [deployer] = await ethers.getSigners();
    if (deployer) {
      const isAuthorized = await factory.authorizedResolvers(deployer.address);
      console.log("✅ Current signer authorized as resolver:", isAuthorized);
    }
    
  } catch (error) {
    console.log("❌ Error reading contract state:", error.message);
  }
  
  console.log("\n");
  
  // Test 2: Check for existing intents
  console.log("🔍 Test 2: Checking Existing Intents");
  console.log("------------------------------------");
  
  // Generate some test order hashes to check
  const testOrderHashes = [
    ethers.keccak256(ethers.toUtf8Bytes("test-order-1")),
    ethers.keccak256(ethers.toUtf8Bytes("test-order-2")),
    ethers.keccak256(ethers.toUtf8Bytes("demo-order")),
  ];
  
  for (let i = 0; i < testOrderHashes.length; i++) {
    try {
      const intent = await factory.getIntentInfo(testOrderHashes[i]);
      if (intent.isActive) {
        console.log(`✅ Found active intent: ${testOrderHashes[i].slice(0, 10)}...`);
        console.log(`   ├── Maker: ${intent.maker}`);
        console.log(`   ├── Source Amount: ${ethers.formatEther(intent.sourceAmount)}`);
        console.log(`   └── Expiry: ${new Date(Number(intent.expiryTime) * 1000).toISOString()}`);
      }
    } catch (error) {
      // Intent doesn't exist, which is fine
    }
  }
  
  console.log("\n");
  
  // Test 3: Check token balances (if signer available)
  console.log("🔍 Test 3: Token Balance Check");
  console.log("------------------------------");
  
  const [signer] = await ethers.getSigners();
  if (signer) {
    try {
      const ethBalance = await ethers.provider.getBalance(signer.address);
      console.log("✅ Your ETH balance:", ethers.formatEther(ethBalance), "ETH");
      
      // Try to check USDC balance
      try {
        const usdcToken = await ethers.getContractAt("IERC20", SEPOLIA_USDC);
        const usdcBalance = await usdcToken.balanceOf(signer.address);
        console.log("✅ Your USDC balance:", ethers.formatEther(usdcBalance), "USDC");
        
        if (ethBalance < ethers.parseEther("0.01")) {
          console.log("⚠️  Low ETH balance - get more from https://sepoliafaucet.com/");
        }
        
        if (usdcBalance === 0n) {
          console.log("💡 Get USDC tokens from: https://faucet.circle.com/");
        }
        
      } catch (error) {
        console.log("ℹ️  Could not check USDC balance");
      }
      
    } catch (error) {
      console.log("❌ Error checking balances:", error.message);
    }
  } else {
    console.log("ℹ️  No signer available - add private key to test with your wallet");
  }
  
  console.log("\n");
  
  // Test 4: Suggest next steps
  console.log("🚀 What You Can Test Next:");
  console.log("==========================");
  console.log("1. 🌐 Visit contract on Etherscan:");
  console.log(`   https://sepolia.etherscan.io/address/${FACTORY_ADDRESS}#readContract`);
  console.log("\n2. 📝 Create an intent via Etherscan:");
  console.log(`   https://sepolia.etherscan.io/address/${FACTORY_ADDRESS}#writeContract`);
  console.log("\n3. 🎮 Run full demo with tokens:");
  console.log("   npm run demo:sepolia");
  console.log("\n4. 👀 Monitor live transactions:");
  console.log(`   https://sepolia.etherscan.io/address/${FACTORY_ADDRESS}`);
  
  console.log("\n✅ Contract testing complete!");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});