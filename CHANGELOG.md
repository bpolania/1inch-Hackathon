# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-01-22

### Added

#### NEAR Protocol Integration
- ✅ **NEAR Smart Contract**: Complete Rust-based HTLC implementation (`contracts/near/src/lib.rs`)
  - Hash Time Locked Contract with SHA-256 hashlock verification
  - Multi-stage timelock system with block height expiry
  - Native NEAR token support with resolver fee mechanism
  - Safety deposit requirements for authorized resolvers (10% of swap amount)
  - Comprehensive event emission for cross-chain monitoring
- ✅ **Bidirectional Swap Support**: Full Ethereum ↔ NEAR atomic swap capabilities
  - Ethereum → NEAR: Lock USDC/ETH, claim NEAR with preimage revelation
  - NEAR → Ethereum: Lock NEAR tokens, claim Ethereum tokens atomically
  - Shared hashlock coordination between both chains
- ✅ **Demo System**: Complete demonstration of both swap directions (`contracts/near/demo.js`)
  - Interactive examples showing full cross-chain flow
  - Real hashlock generation and verification simulation
  - Integration with deployed Sepolia Ethereum contracts
- ✅ **Deployment Infrastructure**: Production-ready deployment scripts
  - Automated NEAR testnet deployment (`contracts/near/deploy.sh`)
  - Contract initialization and resolver authorization
  - Build system with optimized WASM compilation
- ✅ **Documentation**: Comprehensive integration guides (`contracts/near/README.md`)
  - API reference for all contract functions
  - Usage examples and testing instructions
  - Integration patterns with Ethereum contracts

#### Cross-Chain Architecture Enhancements
- 🔗 **Contract Compatibility**: NEAR contract designed for seamless integration with Ethereum factory
- 🔐 **Shared Security Model**: Consistent hashlock/timelock mechanisms across chains
- 📊 **Event Coordination**: Structured logging for cross-chain relayer monitoring
- ⚡ **Gas Optimization**: Efficient NEAR contract with minimal storage costs

### Technical Specifications
- **NEAR Contract**: `cross_chain_htlc.wasm` targeting NEAR Protocol testnet
- **Rust Dependencies**: near-sdk 4.1.1 with optimized release profile
- **Integration Points**: 
  - Ethereum Factory: `0x98c35dA70f839F1B7965b8b8BA17654Da11f4486`
  - NEAR Testnet: Ready for deployment to `cross-chain-htlc.ACCOUNT.testnet`
- **Security Features**: 10% safety deposits, atomic execution, timeout-based cancellation

### Target Achievement
- 🎯 **$32,000 NEAR Bounty**: Full implementation ready for submission
- 🚀 **Next Target**: Cosmos integration for additional $32K bounty
- 💰 **Total Progress**: $32K of $96K possible bounty rewards

## [0.2.0] - 2025-01-22

### Added

#### Ethereum Contracts Implementation
- ✅ **CrossChainFactory**: Complete factory contract for managing cross-chain atomic swaps
  - Intent creation and matching functionality
  - Resolver authorization system
  - Dynamic escrow contract deployment
  - Event emission for off-chain monitoring
- ✅ **CrossChainEscrow**: Full HTLC implementation with multi-stage timelocks
  - Token locking and claiming with hashlock verification
  - Safety deposit mechanism for resolvers
  - Cancellation and refund functionality
- ✅ **MockERC20**: Test token for local development and testing

#### Demo System
- ✅ **Complete atomic swap demo** showing full cross-chain flow:
  1. Intent creation (100 USDC → 0.025 BTC)
  2. Resolver matching with safety deposits
  3. Token locking in Ethereum escrow
  4. Bitcoin HTLC simulation
  5. Secret revelation and atomic completion
- ✅ **Sepolia testnet deployment** at `0x98c35dA70f839F1B7965b8b8BA17654Da11f4486`

#### Development Infrastructure
- ✅ **Environment configuration** with dotenv support
- ✅ **Hardhat setup** with Sepolia network configuration
- ✅ **Alchemy integration** for reliable RPC connectivity
- ✅ **Deployment scripts** for both local and testnet environments

### Fixed
- 🔧 **Contract deployment issues** resolved with proper environment loading
- 🔧 **Event parsing** for dynamic escrow address extraction
- 🔧 **Balance verification** and token transfer validation
- 🔧 **RPC timeout issues** with increased timeout configurations

### Technical Details
- **Gas Usage**: ~3M gas for complete matchIntent operation (escrow creation)
- **Network**: Ethereum Sepolia testnet (Chain ID: 11155111)
- **Token Support**: ERC20 tokens with USDC testnet integration
- **Security**: Multi-stage timelock system with atomic guarantees

## [0.1.0] - 2025-01-15

### Added

#### Initial Architecture Design
- Designed cross-chain atomic swap system supporting Ethereum, Aptos, Bitcoin-compatible chains, and Cosmos
- Implemented intent-based architecture with decentralized executor network
- Added resolver fee mechanism to incentivize permissionless relayers

#### Project Structure - Hybrid Monorepo Approach
- Created hybrid monorepo structure to balance coordination and toolchain separation
- **Reasoning**: Different blockchain ecosystems require distinct toolchains that would conflict in a pure monorepo

##### Structure Decisions:
1. **contracts/** - Unified directory for all smart contracts
   - `ethereum/` - Solidity contracts with Hardhat toolchain
   - `aptos/` - Move modules with Aptos CLI
   - `cosmos/` - CosmWasm contracts with Rust toolchain
   - **Rationale**: Smart contracts share similar deployment patterns and benefit from unified testing

2. **relayer-services/** - Node.js monorepo for backend services
   - `executor-client/` - Multi-chain relayer implementation
   - `marketplace-api/` - REST API for intent discovery
   - `ai-module/` - AI intelligence layer for optimization
   - **Rationale**: Services share TypeScript/Node.js stack and common dependencies

3. **bitcoin-scripts/** - Separate module for Bitcoin HTLC scripts
   - **Rationale**: Bitcoin toolchain is unique and doesn't integrate well with other stacks

4. **ui/** - Separate Next.js application
   - **Rationale**: Frontend can iterate independently with its own deployment cycle

5. **shared/** - Common types, utilities, and constants
   - **Rationale**: Prevents code duplication across modules

#### AI Intelligence Module
- Added AI enhancement layer as Component #11 with five sub-modules:
  - Intent Marketplace Enhancements - Parameter optimization
  - Executor Decision Support - Profitability analysis
  - Fraud Detection System - Spam prevention
  - Routing Optimization - Multi-chain path finding
  - User Experience Advisor - Real-time guidance
- **Integration Strategy**: AI module enhances existing components without modifying core security

### Infrastructure
- Set up package.json files for each module with appropriate dependencies
- Configured workspace structure for relayer-services monorepo
- Added framework-specific configuration files (Move.toml, Cargo.toml)

### Documentation
- Created comprehensive README.md with architecture overview
- Documented all 11 system components
- Added development roadmap with 6 phases
- Included security considerations

## [0.2.0] - 2025-01-15

### Added

#### 1inch Fusion+ Integration
- **Extended Intent Format**: Added `FusionPlusIntent` interface extending `SwapIntent` with 1inch-specific fields
- **1inch Compatibility Types**: Added `OneInchImmutables` interface matching 1inch's EscrowSrc/EscrowDst contract structure
- **Fusion+ Utilities**: New `fusion-plus.ts` module with comprehensive 1inch integration utilities:
  - Order hash generation compatible with 1inch contracts
  - Safety deposit calculations (configurable percentage of source amount)
  - Multi-stage timelock packing/unpacking (7 stages packed into uint256)
  - Source and destination immutables creation for HTLC contracts
  - Timelock validation and default stage generation
- **Cross-chain Examples**: Added `fusionPlusEthToApt()` example demonstrating Ethereum to Aptos swap
- **HTLC Integration**: Hash Time Locked Contracts with shared secret coordination

#### Intent Format Foundation
- **Core Intent Types**: `SwapIntent`, `TokenInfo`, and related interfaces for cross-chain atomic swaps
- **Complete Intent Schema**: TypeScript interfaces for cross-chain swap intents
  - Support for all target chains (Ethereum, Aptos, Bitcoin-compatible, Cosmos)
  - Comprehensive token definitions and chain mappings
  - Status tracking throughout swap lifecycle
- **Utilities**: Intent creation, validation, hashlock generation, and execution time estimation
- **Example Intents**: 5 working examples covering major cross-chain swap scenarios

#### EIP-712 Signature Implementation
- **Structured Data Signing**: Secure intent authorization using EIP-712 standard
- **EIP-712 Compatible**: Structured data hashing following Ethereum standards
- **Replay Protection**: Domain separation and expiry mechanisms
- **Multi-chain Support**: Chain-specific signature validation

#### Validation and Security
- **Comprehensive Validation Library**: Parameter validation with business rule checking
- **Signature Verification**: Intent maker authentication and tamper detection
- **Business Rules**: Warnings for low fees, high slippage, and timing issues
- **Address Validation**: Chain-specific address format verification
- **Safety Mechanisms**: Built-in timelock validation and safety deposit calculations

#### Developer Experience
- **TypeScript Integration**: Full type safety and IntelliSense support
- **Utility Functions**: Intent creation, validation, and manipulation helpers
- **Multi-chain Architecture**: Extensible design supporting both EVM and non-EVM chains

#### Testing
- **Comprehensive Test Suite**: 48 passing tests covering all functionality
- **Test Coverage**: 95%+ coverage across all functionality including:
  - Unit tests for intent creation, validation, and Fusion+ integration
  - Edge case testing for invalid inputs and boundary conditions
  - Comprehensive coverage of timelock packing/unpacking operations
  - 14 comprehensive tests for Fusion+ functionality ensuring compatibility with 1inch architecture

#### Documentation
- **Intent Format Specification**: Complete technical specification document
- **Integration Guidelines**: Examples and best practices for implementation
- **API Reference**: Detailed documentation of all interfaces and functions

### Infrastructure
- Set up shared module with proper TypeScript configuration
- Added Jest testing framework with comprehensive test coverage
- Created example intents for all supported cross-chain combinations
- Established foundation for all other system components

### Fixed
- **TypeScript Configuration**: Resolved test file type checking issues
- **Test Quality**: Removed console error spam and improved negative test coverage
- **EIP-712 Compatibility**: Fixed type constraints for signature validation
- **Validation Edge Cases**: Enhanced error handling for malformed signatures

## [Unreleased]

### Planned
- Implementation of Ethereum smart contracts
- Executor client development
- Marketplace API implementation
- AI model training and deployment
- Integration testing across all chains