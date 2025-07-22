# Cross-Chain Atomic Swap System

A decentralized, intent-driven system enabling atomic cross-chain swaps between Ethereum and three non-EVM chains: Aptos, Bitcoin (including Dogecoin, Litecoin, Bitcoin Cash), and Cosmos.

## Overview

This system **extends 1inch Fusion+** to support cross-chain atomic swaps with non-EVM chains (Aptos, Bitcoin, Cosmos). We build upon 1inch's existing HTLC-based architecture and resolver network, adding compatible escrow contracts and cross-chain coordination layers to enable swaps between Ethereum and non-EVM ecosystems.

### 🎯 **Demo Status**: 
- ✅ **Ethereum contracts deployed** to Sepolia testnet at [`0x98c35dA70f839F1B7965b8b8BA17654Da11f4486`](https://sepolia.etherscan.io/address/0x98c35dA70f839F1B7965b8b8BA17654Da11f4486)
- ✅ **Full atomic swap demo** working locally with complete cross-chain flow
- 🚧 **Non-EVM chains** integration in progress (Aptos, Bitcoin, Cosmos)

### 1inch Fusion+ Integration

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

### 2. Aptos Swap Module (Move)
- Custom Move module implementing hashlock/timelock logic
- Locks Aptos-native tokens using hash and timeout
- Claim function validates preimage and pays resolver fee
- Refund function enables withdrawal after timelock expiry
- Emits events for monitoring

### 3. Bitcoin-Compatible HTLC Scripts
- P2SH or Taproot-based HTLC scripts
- Supports BTC, DOGE, LTC, BCH
- Lock with hashlock and timelock
- Claim with preimage or refund after timeout
- Uses Bitcoin RPC APIs for operations

### 4. Cosmos Swap Module
- Custom module or CosmWasm smart contract
- Locks Cosmos-native tokens with hashlock/timelock
- Claim releases funds when preimage provided
- Refund enables withdrawal after timelock expiry
- Emits events/logs for monitoring

### 5. Intent Format and Signing
Users sign off-chain messages defining swaps with:
- Source and destination chains/tokens
- Amounts and slippage tolerance
- Expiry time
- Offered resolver fee

### 6. Executor Network (Decentralized Relayers)
- Permissionless - anyone can run an executor
- Monitors intent marketplace for swaps
- Handles secret generation and hash commitments
- Submits lock transactions on both chains
- Monitors for preimage reveals
- Relays preimages to complete swaps
- Earns resolver fees as incentive

### 7. Relayer Client Implementation
- Multi-chain adapters (Ethereum, Aptos, Bitcoin-compatible, Cosmos)
- Transaction submission and event monitoring
- Intent signature verification
- Secure secret storage and relay
- Modular design for future chain additions

### 8. Intent Marketplace (REST API)
- Users post signed intents
- Executors query available intents
- Centralized for MVP, with path to P2P decentralization

### 9. Storage (Database)
Tracks:
- Active intents and swap states
- Hash commitments and preimages
- Timeouts and transaction hashes
- Resolver fee settlements

### 10. Optional UI
- Intent creation and publishing
- Open intent display
- Swap status tracking
- Transaction history
- Executor dashboard

### 11. AI Intelligence Module
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

### Phase 1: Core Infrastructure
1. Define intent schema with swap details
2. Implement signature scheme for user authorization

### Phase 2: Smart Contract Development
1. **Ethereum**: Adapt Fusion+ contract with resolver fees
2. **Aptos**: Develop Move module with HTLC logic
3. **Bitcoin**: Implement P2SH/Taproot HTLC scripts
4. **Cosmos**: Build CosmWasm module or native logic

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
```

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