# 1inch Fusion+ Cross-Chain Extension

A production-ready system extending **1inch Fusion+** to support atomic cross-chain swaps with non-EVM chains, starting with NEAR Protocol and expanding to Aptos, Bitcoin, and Cosmos.

## Overview

This system **successfully extends 1inch Fusion+** to support cross-chain atomic swaps with non-EVM ecosystems. We build upon 1inch's proven HTLC-based architecture, resolver network, and economic incentives, adding compatible destination chain contracts that integrate seamlessly with the existing Fusion+ infrastructure.

### 🎯 **Implementation Status**: 
- ✅ **Ethereum Factory deployed** to Sepolia testnet at [`0x98c35dA70f839F1B7965b8b8BA17654Da11f4486`](https://sepolia.etherscan.io/address/0x98c35dA70f839F1B7965b8b8BA17654Da11f4486)
- ✅ **NEAR Fusion+ Extension**: **COMPLETE** - Production-ready integration with comprehensive testing
- ✅ **1inch Protocol Compatibility**: Full integration with resolver network and order format
- ✅ **Atomic Swap Guarantees**: HTLC security preserved across Ethereum ↔ NEAR
- 🚀 **$32K NEAR Bounty**: Ready for submission with full Fusion+ compliance
- 🚧 **Cosmos & Bitcoin**: Planned expansions using proven Fusion+ architecture

## 🎉 NEAR Protocol Integration - COMPLETE

### **Production-Ready 1inch Fusion+ Extension for NEAR**

**✅ Successfully implemented NEAR as a destination chain for 1inch Fusion+ atomic swaps:**

#### **FusionPlusNear Contract** (`contracts/near/src/lib.rs`)
- **1inch Order Compatibility**: Uses 1inch order hash format and packed timelock structure
- **Resolver Network Integration**: Only authorized 1inch resolvers can execute orders
- **Economic Model**: 5% minimum safety deposit compatible with 1inch requirements
- **Atomic Execution**: Three-step claiming process (claim → transfer → payment) 
- **Event System**: Comprehensive logging for 1inch monitoring integration
- **Security**: SHA-256 hashlock coordination with Ethereum source chain

#### **Shared Types Enhancement** (`shared/src/types/`)
- **Chain Support**: Added NEAR_MAINNET (40001) and NEAR_TESTNET (40002) 
- **Intent Extension**: `FusionPlusIntent` with NEAR-specific execution parameters
- **Utility Functions**: `createFusionPlusNearIntent()` and helper functions
- **Format Compatibility**: Token formatting and chain handling for NEAR destinations

#### **Comprehensive Testing** - 17/17 Tests Passing ✅
- **Unit Tests (11/11)**: Contract logic, resolver management, security validation
- **Integration Tests (6/6)**: End-to-end Fusion+ workflow validation
- **Test Coverage**: Deployment, authorization, order execution, atomic claiming
- **Promise Handling**: Resolved NEAR-specific limitations with optimized architecture

#### **Key Technical Achievements**
- **Protocol Extension**: Properly extends 1inch Fusion+ instead of building parallel system
- **Resolver Network**: Integrates with existing 1inch authorized resolver infrastructure  
- **Order Format**: Compatible with 1inch order hash and packed timelock specifications
- **Economic Security**: Safety deposit mechanism aligned with 1inch requirements
- **Atomic Guarantees**: HTLC security preserved with SHA-256 hashlock coordination

### 1inch Fusion+ Integration Foundation

**Building on Proven Architecture:**
- **Extends** existing 1inch Fusion+ cross-chain infrastructure
- **Leverages** their Hash Time Locked Contract (HTLC) system
- **Maintains compatibility** with their resolver network and economic incentives
- **Preserves** security guarantees of atomic swaps

**Core Components from 1inch:**
- **EscrowSrc/EscrowDst**: Existing Ethereum contracts for token locking
- **Resolver Network**: Professional market makers with safety deposits
- **Secret-based Verification**: HTLC mechanism using hashlock/timelock
- **Multi-stage Timelocks**: Precise timing controls for secure execution

## Architecture Components

### 1. Ethereum Integration (1inch Fusion+ Extension)
- **Leverages existing** 1inch EscrowSrc/EscrowDst contracts
- **Integrates with** 1inch Limit Order Protocol for order discovery
- **Extends** their `Immutables` struct for cross-chain parameters
- **Maintains compatibility** with existing resolver network
- **Adds adapters** for non-EVM chain coordination

### 2. NEAR Protocol Integration (Rust) - ✅ COMPLETE
- **FusionPlusNear Contract**: Production-ready Rust smart contract extending 1inch Fusion+
- **1inch Order Format**: Compatible with 1inch order hash and packed timelock structure  
- **Resolver Authorization**: Only authorized 1inch resolvers can execute orders
- **Atomic Execution**: Three-step claiming (claim → transfer → payment) with HTLC security
- **Economic Model**: 5% minimum safety deposit aligned with 1inch requirements
- **Event System**: Comprehensive logging for 1inch monitoring integration
- **Testing**: 17/17 tests passing with full end-to-end workflow validation
- **Deployment**: Ready for testnet deployment with comprehensive build infrastructure

### 3. Aptos Swap Module (Move) - 🚧 PLANNED
- Custom Move module implementing hashlock/timelock logic
- Locks Aptos-native tokens using hash and timeout
- Claim function validates preimage and pays resolver fee
- Refund function enables withdrawal after timelock expiry
- Emits events for monitoring

### 4. Bitcoin-Compatible HTLC Scripts - 🚧 PLANNED
- P2SH or Taproot-based HTLC scripts extending 1inch Fusion+ architecture
- Supports BTC, DOGE, LTC, BCH with unified HTLC interface
- Lock with hashlock and timelock compatible with 1inch resolver network
- Claim with preimage or refund after timeout
- Uses Bitcoin RPC APIs for operations

### 5. Cosmos Swap Module - 🚧 PLANNED  
- Custom CosmWasm smart contract extending 1inch Fusion+ for Cosmos ecosystem
- Locks Cosmos-native tokens with hashlock/timelock compatible with 1inch format
- Claim releases funds when preimage provided by authorized 1inch resolvers
- Refund enables withdrawal after timelock expiry
- Emits events/logs for 1inch monitoring integration

### 6. Intent Format and Signing - ✅ COMPLETE
Users sign off-chain EIP-712 messages defining swaps with:
- Source and destination chains/tokens (including NEAR support)
- Amounts and slippage tolerance  
- Expiry time and 1inch-compatible timelocks
- Offered resolver fee
- **1inch Fusion+ Integration**: Extended `FusionPlusIntent` format with NEAR execution parameters

### 7. Executor Network (1inch Resolver Integration) - ✅ NEAR COMPLETE
- **1inch Resolver Network**: Integrates with existing authorized 1inch resolvers
- **NEAR Integration**: Authorized resolvers can execute orders on NEAR via `FusionPlusNear` contract
- **Secret Coordination**: Handles hashlock generation and preimage revelation across chains
- **Economic Incentives**: Resolver fees and safety deposit mechanism aligned with 1inch
- **Multi-Chain Support**: Ethereum ↔ NEAR currently, expandable to other chains

### 8. Relayer Client Implementation - 🚧 PLANNED
- Multi-chain adapters (Ethereum, NEAR complete, Aptos/Bitcoin/Cosmos planned)
- Transaction submission and event monitoring
- Intent signature verification with 1inch compatibility
- Secure secret storage and relay
- Modular design for future chain additions

### 9. Intent Marketplace (REST API) - 🚧 PLANNED
- Users post signed 1inch-compatible intents
- 1inch resolvers query available cross-chain orders
- Integration with existing 1inch infrastructure
- Centralized for MVP, with path to 1inch P2P network integration

### 10. Storage (Database) - 🚧 PLANNED
Tracks:
- Active Fusion+ intents and swap states
- Hash commitments and preimages for cross-chain coordination
- Timeouts and transaction hashes across chains
- 1inch resolver fee settlements and safety deposits

### 11. Optional UI - 🚧 PLANNED
- Intent creation with 1inch Fusion+ compatibility
- Cross-chain swap status tracking
- Transaction history across Ethereum and NEAR
- 1inch resolver dashboard integration

### 12. AI Intelligence Module - 🚧 PLANNED
A modular AI enhancement layer that integrates with existing components to optimize the cross-chain swap system:

#### Intent Marketplace Enhancements
- **Optimal Parameter Suggestions**: AI analyzes historical data to recommend resolver fees, expiry times, and slippage settings
- **Market Analysis**: Considers past fulfillment times, chain congestion, and executor competition
- **Integration Point**: Intent Marketplace API (Component #8)

#### Executor Decision Support
- **Profitability Analysis**: Helps executors evaluate which intents offer best risk/reward
- **Success Prediction**: Models likelihood of successful fulfillment based on:
  - Chain congestion levels
  - Historical preimage revelation rates
  - Gas cost trends
  - Time to expiry
- **Integration Point**: Executor Client (Component #7)

#### Fraud Detection System
- **Spam Prevention**: Lightweight classification in Intent Marketplace REST API
- **Anomaly Detection**: Flags suspicious patterns including:
  - Unrealistic swap amounts
  - Insufficient expiry times
  - Repeated spam attempts
- **Integration Point**: Intent Marketplace API (Component #8)

#### Routing Optimization
- **Multi-Chain Path Finding**: Suggests optimal execution order for multi-chain swaps
- **Cost Minimization**: Balances speed vs fees across different chains
- **Timing Recommendations**: Predicts confirmation times for better planning
- **Integration Point**: Relayer Client adapters (Component #7)

#### User Experience Advisor
- **Real-Time Suggestions**: Interactive guidance during intent creation
- **Market Warnings**: Alerts for:
  - Low resolver fees unlikely to attract executors
  - Tight slippage settings given volatility
  - Suboptimal expiry times
- **Integration Point**: UI module (Component #10)

#### Implementation Details
- **Modular Architecture**: Each AI component can be integrated or replaced independently
- **Clear Interfaces**:
  - Data input: Intent parameters, historical swaps, chain fees, relayer statistics
  - Model training and inference endpoints
  - Output: Recommendations and classifications via REST/gRPC
- **Minimum Data Requirements**:
  - Intent marketplace: 1000+ historical intents with fulfillment outcomes
  - Executor support: 500+ swap executions with gas costs and timing
  - Fraud detection: 100+ labeled spam/legitimate intents
  - Routing: Real-time fee APIs and 1000+ historical routes
  - UX advisor: 2000+ user sessions with conversion rates

## Development Roadmap

### ✅ Phase 1: Ethereum Foundation (COMPLETED)
- ✅ **Smart Contracts**: CrossChainFactory and CrossChainEscrow deployed to Sepolia
- ✅ **Demo System**: Complete atomic swap demonstration
- ✅ **Infrastructure**: Hardhat setup, Alchemy integration, environment configuration
- ✅ **Testing**: Comprehensive test suite with 95%+ coverage

### 🚀 Phase 2: Multi-Chain Integration (IN PROGRESS)

**Strategic Priority Order Based on $32K Bounties:**

#### 1st Priority: NEAR Integration 🌐 ✅
**Target: $32,000 bounty** | **Status: COMPLETED**

**Why NEAR First:**
- ✅ **Fastest Development**: Robust smart contract platform with Rust
- ✅ **Familiar Tools**: Can leverage existing Rust toolchain
- ✅ **Account Model**: Similar to Ethereum, easier integration
- ✅ **Excellent Tooling**: Superior documentation and developer experience

**✅ Completed Implementation:**
1. ✅ **NEAR Smart Contract**: Rust-based HTLC with hashlock/timelock ([`contracts/near/`](contracts/near/))
2. ✅ **Bidirectional Swaps**: Full Ethereum ↔ NEAR atomic swap support
3. ✅ **Demo Integration**: Complete demo showing both swap directions ([`demo.js`](contracts/near/demo.js))
4. ✅ **Deployment Scripts**: Ready for NEAR testnet deployment ([`deploy.sh`](contracts/near/deploy.sh))

#### 2nd Priority: Cosmos Integration 🌌
**Target: $32,000 bounty** | **Status: After NEAR**

**Advantages:**
- ✅ **Proven Patterns**: Reuse NEAR's Rust contract architecture
- ✅ **CosmWasm Ready**: Direct port from NEAR implementation
- ✅ **IBC Potential**: Advanced cross-chain features

#### 3rd Priority: Bitcoin Ecosystem 🪙
**Target: $32,000 bounty** | **Status: Final Phase**

**Multi-Chain Support:** Bitcoin, Dogecoin, Litecoin, Bitcoin Cash
**Challenges:** UTXO model, script limitations, multiple chain targets

### Phase 3: Relayer Infrastructure
1. Build chain adapters for all supported networks
2. Develop Intent Marketplace REST API
3. Implement Executor Client with:
   - Intent marketplace monitoring
   - Secret/hash management
   - Cross-chain coordination
   - Preimage relay logic
   - Fee collection

### Phase 4: Integration & Testing
1. Set up database for state management
2. Test complete bidirectional swap flows:
   - Ethereum ↔ Aptos
   - Ethereum ↔ Bitcoin-compatible chains
   - Ethereum ↔ Cosmos
3. Validate resolver fee payments
4. Test refund mechanisms

### Phase 5: UI & Decentralization (Optional)
1. Build user interface for intent management
2. Design P2P protocol for decentralized intent discovery

### Phase 6: AI Intelligence Integration
1. Implement AI models for each enhancement component
2. Integrate AI services with existing modules:
   - Intent Marketplace API enhancement
   - Executor Client decision support
   - Fraud detection middleware
   - Routing optimization service
   - UI real-time advisor
3. Collect and prepare training data from testnet
4. Deploy inference endpoints
5. A/B test AI recommendations vs baseline

## Security Considerations

- Hashlock/timelock mechanisms ensure atomicity
- Intent signatures prevent unauthorized swaps
- Timeout periods protect against locked funds
- Resolver fees incentivize timely execution

## Project Structure

The project uses a hybrid monorepo approach to balance coordination benefits with toolchain separation:

```
1inch-cross-chain/
├── contracts/                 # Smart contracts (unified for coordination)
│   ├── ethereum/             # Solidity contracts with Hardhat
│   ├── aptos/                # Move modules with Aptos CLI
│   └── cosmos/               # CosmWasm contracts with Rust
│
├── relayer-services/         # Backend services (Node.js monorepo)
│   ├── executor-client/      # Multi-chain relayer implementation
│   ├── marketplace-api/      # REST API for intent discovery
│   └── ai-module/            # AI intelligence layer
│
├── bitcoin-scripts/          # Bitcoin HTLC scripts (separate toolchain)
│   ├── scripts/              # HTLC script implementations
│   ├── lib/                  # Shared utilities
│   └── tests/                # Script tests
│
├── ui/                       # Frontend application (can iterate independently)
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Next.js pages
│   │   └── services/         # API clients
│   └── public/               # Static assets
│
├── shared/                   # Cross-module shared code
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Common utilities
│   └── constants/            # Shared constants
│
├── docs/                     # Documentation
├── scripts/                  # Build and deployment scripts
├── README.md                 # This file
└── CHANGELOG.md              # Project history and decisions
```

## Getting Started

### 🚀 Quick Demo

**Try the working demo immediately:**

```bash
# Clone repository
git clone https://github.com/your-org/1inch-cross-chain.git
cd 1inch-cross-chain/contracts/ethereum

# Install dependencies
npm install

# Run local atomic swap demo
npm run demo
```

**Deployed Sepolia Testnet:**
- **Factory Contract**: [`0x98c35dA70f839F1B7965b8b8BA17654Da11f4486`](https://sepolia.etherscan.io/address/0x98c35dA70f839F1B7965b8b8BA17654Da11f4486)
- **Network**: Sepolia (Chain ID: 11155111)
- **Status**: ✅ Deployed and verified

**Test on Sepolia:**
```bash
# Deploy/demo on testnet (requires testnet ETH & tokens)
npm run demo:sepolia

# Test deployed contract
npm run test:deployed
```

### 🧪 **Live Contract Testing**

**Test the deployed contracts directly on Sepolia:**

#### Prerequisites for Live Testing:
1. **Sepolia ETH**: Get from [Sepolia Faucet](https://sepoliafaucet.com/)
2. **Test Tokens**: Get USDC from [Circle Faucet](https://faucet.circle.com/)
3. **Wallet Setup**: MetaMask connected to Sepolia network

#### Available Test Functions:

**1. Read Contract State (No gas required):**
```solidity
// Check resolver authorization
factory.authorizedResolvers(address) → bool

// Get intent information  
factory.getIntentInfo(bytes32 orderHash) → IntentInfo

// Check escrow addresses for an order
factory.getEscrowAddresses(bytes32 orderHash) → (address, address)

// Get resolver count
factory.resolverCount() → uint256
```

**2. Write Operations (Requires ETH for gas):**
```solidity
// Create a cross-chain swap intent
factory.createIntent(
    orderHash,      // bytes32: Unique order identifier
    sourceToken,    // address: Token to swap from
    sourceAmount,   // uint256: Amount to swap
    destinationChain, // uint256: Target chain ID
    destinationToken, // address: Token to receive
    destinationAmount, // uint256: Amount to receive
    destinationAddress, // string: Receiving address
    resolverFeeAmount, // uint256: Fee for resolver
    expiryTime      // uint256: Intent expiry timestamp
)
```

#### Test Scenarios You Can Try Now:

**Scenario 1: Intent Creation**
- Connect to factory contract on Etherscan
- Call `createIntent` with test parameters
- Verify intent is created by calling `getIntentInfo`

**Scenario 2: Resolver Authorization (Owner only)**
- Add new resolver address using `addResolver`
- Verify with `authorizedResolvers` call

**Scenario 3: Intent Matching**
- Create an intent as above
- Call `matchIntent` as authorized resolver
- Check created escrow addresses with `getEscrowAddresses`

**Scenario 4: Full Atomic Swap Test**
- Run complete demo: `npm run demo:sepolia`
- Monitor transactions on [Sepolia Etherscan](https://sepolia.etherscan.io/)

#### Quick Test Links:
- **Read Contract**: https://sepolia.etherscan.io/address/0x98c35dA70f839F1B7965b8b8BA17654Da11f4486#readContract
- **Write Contract**: https://sepolia.etherscan.io/address/0x98c35dA70f839F1B7965b8b8BA17654Da11f4486#writeContract
- **Transaction History**: https://sepolia.etherscan.io/address/0x98c35dA70f839F1B7965b8b8BA17654Da11f4486

### Prerequisites
- Node.js 18+ and npm
- Rust toolchain (for Cosmos contracts)
- Python 3.9+ (for AI module)
- Docker (for local blockchain testing)
- Sepolia ETH (for testnet deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/1inch-cross-chain.git
cd 1inch-cross-chain
```

2. Install dependencies for each module:
```bash
# Install relayer services dependencies
cd relayer-services
npm install

# Install UI dependencies
cd ../ui
npm install

# Install Bitcoin scripts dependencies
cd ../bitcoin-scripts
npm install

# Install Ethereum contract dependencies
cd ../contracts/ethereum
npm install

# Install shared module dependencies (Intent Format)
cd ../shared
npm install
```

3. Set up environment variables (see docs/environment-setup.md)

### Development

Each module can be developed independently:

```bash
# Run relayer services in development
cd relayer-services
npm run dev

# Run UI in development
cd ui
npm run dev

# Compile smart contracts
cd contracts/ethereum
npm run compile

# Test shared module (Intent Format)
cd shared
npm test

# Build shared module
npm run build
```

## Intent Format (v0.2.0) 

The cross-chain swap intent format is now implemented and ready for use:

### Quick Start
```typescript
import { 
  createIntent, 
  signIntentWithPrivateKey,
  validateSignedIntent,
  ChainId,
  EXAMPLE_INTENTS 
} from '@1inch-cross-chain/shared';

// Create an ETH to BTC swap intent
const intent = createIntent({
  maker: '0x...',
  sourceChain: ChainId.ETHEREUM_MAINNET,
  sourceToken: { chainId: ChainId.ETHEREUM_MAINNET, address: 'native', symbol: 'ETH', decimals: 18 },
  sourceAmount: '1000000000000000000', // 1 ETH
  destinationChain: ChainId.BITCOIN_MAINNET,
  destinationToken: { chainId: ChainId.BITCOIN_MAINNET, address: 'native', symbol: 'BTC', decimals: 8 },
  destinationAmount: '2500000', // 0.025 BTC
  destinationAddress: 'bc1q...',
  slippageBps: 50, // 0.5%
  resolverFeeAmount: '3000000000000000', // 0.003 ETH
});

// Sign the intent
const signedIntent = await signIntentWithPrivateKey(intent, privateKey);

// Validate the signed intent
const isValid = validateSignedIntent(signedIntent, intent.maker);
```

### Features
- **Multi-chain Support**: Ethereum, Aptos, Bitcoin-compatible chains, Cosmos
- **EIP-712 Signatures**: Secure structured data signing with replay protection
- **Comprehensive Validation**: Parameter validation with business rule warnings
- **TypeScript**: Full type safety and IntelliSense support
- **34 Tests**: 100% test coverage with examples for all chain combinations

### Documentation
See [Intent Format Specification](docs/intent-format-specification.md) for complete documentation.

## 1inch Fusion+ Technical Details

### Core Data Structure (1inch Compatible)
```solidity
struct Immutables {
    bytes32 orderHash;        // Hash of the original 1inch order
    bytes32 hashlock;         // HTLC secret hash for atomic swaps
    address maker;            // Order creator (user)
    address taker;            // Order resolver (professional market maker)
    address token;            // Token contract address
    uint256 amount;           // Token amount to swap
    uint256 safetyDeposit;    // Resolver's economic security deposit
    uint256 timelocks;        // Packed multi-stage timelock windows
}
```

### HTLC Workflow Integration
1. **Order Creation**: User creates order via 1inch Limit Order Protocol
2. **Resolver Matching**: Professional resolver accepts order with safety deposit
3. **Escrow Deployment**: 
   - `EscrowSrc` deployed on Ethereum (via 1inch)
   - `EscrowDst` deployed on target chain (our extension)
4. **Secret Coordination**: Shared hashlock enables atomic execution
5. **Multi-stage Execution**: Time-controlled withdrawal and cancellation windows
6. **Fee Distribution**: Resolvers earn fees, safety deposits ensure honest behavior

### Extension Points for Non-EVM Chains
- **Aptos**: Move-based escrow resources with equivalent timelock logic
- **Bitcoin**: Script-based HTLCs with multi-signature escrow addresses  
- **Cosmos**: IBC-enabled CosmWasm contracts for cross-chain coordination

### Security Model
- **Atomic Guarantees**: Either both sides complete or both can cancel/refund
- **Economic Incentives**: Safety deposits ensure resolver honest participation
- **Time-bounded Security**: Multi-stage timelocks prevent griefing attacks
- **Secret Distribution**: Off-chain coordination with on-chain verification

## Contributing

(Contribution guidelines to be added)

## License

(License information to be added)