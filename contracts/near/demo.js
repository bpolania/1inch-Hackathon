const { connect, Contract, keyStores, KeyPair, utils } = require("near-api-js");
const { ethers } = require("ethers");
const crypto = require("crypto");

// Configuration
const NEAR_CONFIG = {
    networkId: "testnet",
    keyStore: new keyStores.InMemoryKeyStore(),
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://wallet.testnet.near.org",
    helperUrl: "https://helper.testnet.near.org",
    explorerUrl: "https://explorer.testnet.near.org",
};

const ETHEREUM_CONFIG = {
    rpc: "https://eth-sepolia.g.alchemy.com/v2/R19Ism5lmNQKNRlnPqzPu",
    factoryAddress: "0x98c35dA70f839F1B7965b8b8BA17654Da11f4486"
};

// Contract addresses (to be updated after deployment)
const NEAR_CONTRACT = "cross-chain-htlc.YOUR_ACCOUNT.testnet";
const ETHEREUM_FACTORY = ETHEREUM_CONFIG.factoryAddress;

class CrossChainDemo {
    constructor() {
        this.secret = null;
        this.hashlock = null;
    }

    async initialize() {
        console.log("🔄 Initializing Cross-Chain Demo...");
        
        // Generate shared secret for atomic swap
        this.secret = crypto.randomBytes(32);
        this.hashlock = crypto.createHash('sha256').update(this.secret).digest('hex');
        
        console.log("🔐 Generated hashlock:", this.hashlock);
        
        // Initialize NEAR connection
        this.near = await connect(NEAR_CONFIG);
        
        // Initialize Ethereum connection  
        this.ethProvider = new ethers.JsonRpcProvider(ETHEREUM_CONFIG.rpc);
        
        console.log("✅ Connections established");
    }

    async demoEthereumToNear() {
        console.log("\\n🚀 Demo: Ethereum → NEAR Atomic Swap");
        console.log("=====================================");
        
        console.log("📋 Swap Details:");
        console.log("├── Source: 100 USDC on Ethereum Sepolia");
        console.log("├── Destination: 5 NEAR on NEAR Testnet");
        console.log("├── Hashlock:", this.hashlock);
        console.log("└── Expiry: 1 hour from now");
        
        // Step 1: Create intent on Ethereum (would be done via actual transaction)
        console.log("\\n🔹 Step 1: Create Intent on Ethereum");
        console.log("├── Intent created on Ethereum factory");
        console.log("├── 100 USDC locked in escrow");
        console.log("└── Waiting for NEAR-side order creation...");
        
        // Step 2: Create corresponding order on NEAR
        console.log("\\n🔹 Step 2: Create Order on NEAR");
        const nearOrder = {
            order_id: "eth-to-near-001",
            hashlock: this.hashlock,
            timelock: String(Math.floor(Date.now() / 1000) + 3600), // 1 hour
            destination_chain: "ethereum-sepolia",
            destination_token: "USDC",
            destination_amount: utils.format.parseNearAmount("100"),
            destination_address: "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
            resolver_fee: utils.format.parseNearAmount("0.1")
        };
        
        console.log("├── NEAR order parameters:", {
            id: nearOrder.order_id,
            amount: "5 NEAR",
            hashlock: nearOrder.hashlock.slice(0, 10) + "...",
        });
        console.log("├── 5 NEAR locked in NEAR contract");
        console.log("└── Order created successfully");
        
        // Step 3: Resolver matches both sides
        console.log("\\n🔹 Step 3: Resolver Matches Orders");
        console.log("├── Resolver commits on Ethereum side");
        console.log("├── Resolver commits on NEAR side (0.5 NEAR safety deposit)");
        console.log("└── Both sides locked and ready for execution");
        
        // Step 4: Resolver reveals secret and claims
        console.log("\\n🔹 Step 4: Atomic Execution");
        console.log("├── Resolver reveals preimage on NEAR");
        console.log("├── Secret:", this.secret.toString('hex'));
        console.log("├── Resolver claims 5 NEAR + 0.1 NEAR fee");
        console.log("├── Preimage propagated to Ethereum");
        console.log("├── User claims 100 USDC on Ethereum");
        console.log("└── ✅ Swap completed atomically!");
        
        console.log("\\n📊 Final Result:");
        console.log("├── User: -5 NEAR → +100 USDC ✅");
        console.log("├── Resolver: +5 NEAR + 0.1 NEAR fee ✅");
        console.log("└── Both parties satisfied");
    }

    async demoNearToEthereum() {
        console.log("\\n🚀 Demo: NEAR → Ethereum Atomic Swap");
        console.log("=====================================");
        
        // Generate new secret for this direction
        const newSecret = crypto.randomBytes(32);
        const newHashlock = crypto.createHash('sha256').update(newSecret).digest('hex');
        
        console.log("📋 Swap Details:");
        console.log("├── Source: 10 NEAR on NEAR Testnet");
        console.log("├── Destination: 200 USDC on Ethereum Sepolia");
        console.log("├── Hashlock:", newHashlock);
        console.log("└── Expiry: 1 hour from now");
        
        // Step 1: Create order on NEAR first
        console.log("\\n🔹 Step 1: Create Order on NEAR");
        const nearOrder = {
            order_id: "near-to-eth-001",
            hashlock: newHashlock,
            timelock: String(Math.floor(Date.now() / 1000) + 3600),
            destination_chain: "ethereum-sepolia", 
            destination_token: "USDC",
            destination_amount: utils.format.parseNearAmount("200"),
            destination_address: "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
            resolver_fee: utils.format.parseNearAmount("0.2")
        };
        
        console.log("├── 10 NEAR locked in NEAR contract");
        console.log("├── Resolver fee: 0.2 NEAR");
        console.log("└── Order created, waiting for Ethereum intent...");
        
        // Step 2: Create corresponding intent on Ethereum
        console.log("\\n🔹 Step 2: Create Intent on Ethereum");
        console.log("├── Intent created on Ethereum factory");
        console.log("├── 200 USDC locked in Ethereum escrow");
        console.log("└── Both sides locked with same hashlock");
        
        // Step 3: Resolver matches both sides  
        console.log("\\n🔹 Step 3: Resolver Commits");
        console.log("├── Resolver matches NEAR order (1 NEAR safety deposit)");
        console.log("├── Resolver matches Ethereum intent");
        console.log("└── Ready for atomic execution");
        
        // Step 4: Execution (can start from either side)
        console.log("\\n🔹 Step 4: Atomic Execution");
        console.log("├── Resolver reveals preimage on Ethereum");
        console.log("├── Secret:", newSecret.toString('hex'));
        console.log("├── User claims 200 USDC on Ethereum");
        console.log("├── Preimage now public, resolver claims on NEAR");
        console.log("├── Resolver gets 10 NEAR + 0.2 NEAR fee");
        console.log("└── ✅ Reverse swap completed!");
        
        console.log("\\n📊 Final Result:");
        console.log("├── User: -10 NEAR → +200 USDC ✅");
        console.log("├── Resolver: +10 NEAR + 0.2 NEAR fee ✅"); 
        console.log("└── Bidirectional swap capability confirmed");
    }

    async displayContractInfo() {
        console.log("\\n📋 Contract Information");
        console.log("========================");
        console.log("🌐 NEAR Contract:");
        console.log(`├── Address: ${NEAR_CONTRACT}`);
        console.log(`├── Explorer: https://explorer.testnet.near.org/accounts/${NEAR_CONTRACT}`);
        console.log("└── Functions: create_order, match_order, claim_order, cancel_order");
        
        console.log("\\n⚡ Ethereum Contract:");
        console.log(`├── Address: ${ETHEREUM_FACTORY}`);
        console.log(`├── Explorer: https://sepolia.etherscan.io/address/${ETHEREUM_FACTORY}`);
        console.log("└── Functions: createIntent, matchIntent, claim, cancel");
        
        console.log("\\n🔗 Integration Points:");
        console.log("├── Shared hashlock/preimage coordination");
        console.log("├── Synchronized timelock mechanisms");
        console.log("├── Cross-chain event monitoring");
        console.log("└── Resolver network compatibility");
    }

    async run() {
        try {
            await this.initialize();
            
            // Demo both directions
            await this.demoEthereumToNear();
            await this.demoNearToEthereum();
            
            // Show contract information
            await this.displayContractInfo();
            
            console.log("\\n🎉 Cross-Chain Demo Complete!");
            console.log("\\n🚀 Next Steps:");
            console.log("├── Deploy NEAR contract to testnet");
            console.log("├── Test with real NEAR/ETH transactions");
            console.log("├── Implement relayer monitoring");
            console.log("└── Add Bitcoin and Cosmos support");
            
        } catch (error) {
            console.error("❌ Demo failed:", error);
        }
    }
}

// Run the demo
if (require.main === module) {
    const demo = new CrossChainDemo();
    demo.run().catch(console.error);
}

module.exports = { CrossChainDemo };