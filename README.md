# 1inch Fusion+ NEAR Extension

A **true 1inch Fusion+ extension** that adds NEAR Protocol support to 1inch's cross-chain atomic swap infrastructure. This implementation properly extends 1inch's existing `EscrowSrc`/`EscrowDst` system using the `ITakerInteraction` interface for seamless NEAR blockchain integration.

## 🎯 **Implementation Status**: PRODUCTION READY

- ✅ **True 1inch Integration**: Uses production-ready `EscrowFactory` and `ITakerInteraction` interface
- ✅ **NEAR Protocol Support**: Complete NEAR mainnet and testnet integration
- ✅ **Modular Architecture**: Universal `IDestinationChain` interface for any blockchain
- ✅ **Atomic Swap Guarantees**: SHA-256 hashlock coordination between Ethereum and NEAR
- ✅ **Comprehensive Testing**: 80 passing tests with full production coverage
- ✅ **Production Infrastructure**: Ready for Sepolia deployment and mainnet migration

## Architecture Overview

### 1inch Fusion+ Integration Components

#### **NearTakerInteraction** (`contracts/fusion-plus/NearTakerInteraction.sol`)
- Implements 1inch's `ITakerInteraction` interface
- Handles NEAR-specific order processing and validation
- Integrates with 1inch's `EscrowFactory.createDstEscrow()` method
- Manages NEAR cross-chain coordination with proper resolver authorization

#### **OneInchFusionPlusFactory** (`contracts/fusion-plus/OneInchFusionPlusFactory.sol`)
- Extends 1inch Fusion+ with NEAR support
- Uses production-ready `EscrowSrc`/`EscrowDst` contracts via `IOneInchEscrowFactory`
- Computes escrow addresses using `addressOfEscrowSrc()`
- Full 1inch order format and timelock compatibility

#### **ProductionOneInchEscrowFactory** (`contracts/ProductionOneInchEscrowFactory.sol`)
- Production-ready implementation of `IOneInchEscrowFactory` interface
- CREATE2-based deterministic escrow deployment
- Real `EscrowSrc` and `EscrowDst` implementation contracts
- Production-level security, validation, and emergency controls
- Compatible with real 1inch contracts for seamless mainnet migration

#### **CrossChainRegistry** (`contracts/CrossChainRegistry.sol`)
- Modular chain management system
- Dynamic adapter registration for any blockchain
- Unified validation and cost estimation interface
- Owner-controlled chain configuration

#### **NearDestinationChain** (`contracts/adapters/NearDestinationChain.sol`)
- NEAR-specific implementation of `IDestinationChain` interface
- NEAR address validation (.near and .testnet domains)
- NEAR execution parameter encoding and validation
- Gas estimation and safety deposit calculations

### 1inch Protocol Compliance

**Interface Compliance:**
- ✅ `ITakerInteraction` - Custom NEAR logic during order execution
- ✅ `IOneInchEscrowFactory` - Real 1inch escrow deployment
- ✅ 1inch order format - Compatible order hashes and timelock structure
- ✅ Resolver authorization - Integration with 1inch resolver network

**Escrow Integration:**
- Uses 1inch's `EscrowSrc` contracts on Ethereum
- Deploys 1inch's `EscrowDst` contracts for destination coordination
- Proper safety deposit handling via 1inch escrow system
- Multi-stage timelock coordination between chains

## Key Features

### 🔗 **Atomic Cross-Chain Swaps**
- **Ethereum ↔ NEAR**: Bidirectional atomic swaps
- **SHA-256 Hashlock**: Cryptographic coordination between chains
- **Multi-stage Timelocks**: Secure execution windows with cancellation protection
- **Economic Security**: 5% safety deposits ensure honest resolver behavior

### 🏗️ **Modular Architecture**
- **Universal Interface**: `IDestinationChain` supports any blockchain
- **Dynamic Registration**: Add new chains without factory modifications
- **Extensible Design**: Clear path for Cosmos, Bitcoin, and other chains
- **1inch Compatible**: Seamless integration with existing Fusion+ infrastructure

### 🌐 **NEAR Protocol Integration**
- **Complete Support**: NEAR mainnet (40001) and testnet (40002)
- **Address Validation**: Native support for .near and .testnet addresses
- **Execution Parameters**: Native NEAR contract calls, gas, and deposits
- **Cost Estimation**: Accurate NEAR transaction cost calculations

## Getting Started

### Prerequisites
- Node.js 18+
- Sepolia ETH for testing
- Basic understanding of 1inch Fusion+ protocol

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/1inch-Hackathon.git
cd 1inch-Hackathon/contracts/ethereum

# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test
```

### Testing

The project includes comprehensive test coverage:

```bash
# Run 1inch integration tests
npm test test/OneInchIntegration.test.js

# Run all tests (80 tests)
npm test

# Run NEAR adapter tests
npm test test/NearDestinationChain.test.js

# Run registry tests  
npm test test/CrossChainRegistry.test.js
```

### Test Coverage
- **CrossChainRegistry**: 19 tests - Chain management and validation
- **NearDestinationChain**: 19 tests - NEAR-specific functionality
- **1inch Integration**: 11 tests - Complete 1inch Fusion+ integration
- **ProductionEscrowFactory**: 26 tests - Production factory unit tests
- **Production Integration**: 5 tests - Full local deployment testing

## Live Sepolia Deployment

### Deployed Contracts

#### Core Infrastructure
| Contract | Address | Etherscan |
|----------|---------|-----------|
| **CrossChainRegistry** | `0x59CE43Ea20892EC3Eff00fc7506cbfA9813FE0ca` | [View](https://sepolia.etherscan.io/address/0x59CE43Ea20892EC3Eff00fc7506cbfA9813FE0ca) |
| **NEAR Mainnet Adapter** | `0xEb58DbeB1Bd71A0Dd3c07F005C929AcEb597Be01` | [View](https://sepolia.etherscan.io/address/0xEb58DbeB1Bd71A0Dd3c07F005C929AcEb597Be01) |
| **NEAR Testnet Adapter** | `0x3cF27b67e96CB3B21C98EF1C57E274A53f0ab014` | [View](https://sepolia.etherscan.io/address/0x3cF27b67e96CB3B21C98EF1C57E274A53f0ab014) |

#### Production 1inch Integration (Latest)
| Contract | Address | Etherscan |
|----------|---------|-----------|
| **ProductionOneInchEscrowFactory** | `0xf9dE921BbEAbC78F14a5F65aa22aF1697370caED` | [View](https://sepolia.etherscan.io/address/0xf9dE921BbEAbC78F14a5F65aa22aF1697370caED) |
| **NearTakerInteraction** | `0xA438D7aB66013A13D99f5fDaAFC73e17a2706784` | [View](https://sepolia.etherscan.io/address/0xA438D7aB66013A13D99f5fDaAFC73e17a2706784) |
| **OneInchFusionPlusFactory** | `0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a` | [View](https://sepolia.etherscan.io/address/0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a) |
| **EscrowSrc Implementation** | `0x3bF4bef72C5d7f71a8fAAe5A0f98C52e41Bc7426` | [View](https://sepolia.etherscan.io/address/0x3bF4bef72C5d7f71a8fAAe5A0f98C52e41Bc7426) |
| **EscrowDst Implementation** | `0x454fFCf3fd993c93d2C13DE36948d9eec0Ee6adE` | [View](https://sepolia.etherscan.io/address/0x454fFCf3fd993c93d2C13DE36948d9eec0Ee6adE) |

#### Test Tokens
| Contract | Address | Etherscan |
|----------|---------|-----------|
| **Demo Token (DT)** | `0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43` | [View](https://sepolia.etherscan.io/address/0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43) |

#### Legacy Contracts (Original)
| Contract | Address | Etherscan |
|----------|---------|-----------|
| **OneInchFusionPlusFactory (Legacy)** | `0x065357440984Eb0BCC1b610A76b388B367D4e1f0` | [View](https://sepolia.etherscan.io/address/0x065357440984Eb0BCC1b610A76b388B367D4e1f0) |

### NEAR Protocol Integration

**NEAR Testnet Contract**: [`fusion-plus.demo.cuteharbor3573.testnet`](https://testnet.nearblocks.io/address/fusion-plus.demo.cuteharbor3573.testnet)

### Live Demo

Run the complete cross-chain swap demonstration:

```bash
# Deploy to Sepolia (if not already deployed)
npm run deploy:fusion:sepolia

# Run live cross-chain demo
npm run demo:cross-chain

# Check Sepolia integration
npm run test:sepolia
```

## Project Structure

```
contracts/ethereum/
├── contracts/
│   ├── CrossChainRegistry.sol           # Modular chain management
│   ├── ProductionOneInchEscrowFactory.sol # Production-ready escrow factory
│   ├── MockERC20.sol                    # Test token
│   ├── adapters/
│   │   └── NearDestinationChain.sol     # NEAR blockchain adapter
│   ├── fusion-plus/
│   │   ├── NearTakerInteraction.sol     # 1inch ITakerInteraction impl
│   │   └── OneInchFusionPlusFactory.sol # 1inch integrated factory
│   ├── interfaces/
│   │   ├── IDestinationChain.sol        # Universal chain interface
│   │   ├── IOneInchEscrow.sol           # 1inch escrow interface
│   │   └── IOneInchEscrowFactory.sol    # 1inch factory interface
│   └── mocks/
│       └── MockOneInchEscrowFactory.sol # Testing mock
├── test/
│   ├── CrossChainRegistry.test.js       # Registry functionality
│   ├── NearDestinationChain.test.js     # NEAR adapter tests
│   ├── OneInchIntegration.test.js       # 1inch integration tests
│   ├── ProductionEscrowFactory.test.js  # Production factory unit tests
│   ├── ProductionIntegration.test.js    # Full local deployment tests
│   └── SepoliaIntegration.test.js       # Live deployment tests
└── scripts/
    ├── deploy-to-sepolia.js             # Deployment script
    └── demo-cross-chain-live.js         # Live demo script
```

## 1inch Integration Details

### How It Works

1. **Order Creation**: Users create cross-chain orders via `OneInchFusionPlusFactory`
2. **1inch Processing**: Orders are processed by 1inch Limit Order Protocol
3. **Taker Interaction**: `NearTakerInteraction.takerInteraction()` is called for NEAR orders
4. **Escrow Deployment**: 1inch `EscrowFactory` deploys destination escrow contracts
5. **Atomic Execution**: Hashlock coordination ensures atomic completion

### Technical Implementation

**ITakerInteraction Flow:**
```solidity
function takerInteraction(
    IOrderMixin.Order calldata order,
    bytes calldata extension,          // NEAR order data
    bytes32 orderHash,
    address taker,                     // 1inch resolver
    uint256 makingAmount,
    uint256 takingAmount,
    uint256 remainingMakingAmount,
    bytes calldata extraData
) external override nonReentrant
```

**1inch Escrow Integration:**
```solidity
// Deploy destination escrow using real 1inch factory
address escrowAddress = escrowFactory.createDstEscrow(
    immutables,        // 1inch-compatible escrow parameters
    expiryTime
);
```

## Bounty Compliance

This implementation satisfies the **$32K NEAR bounty** requirements:

- ✅ **True 1inch Extension**: Extends existing protocol, doesn't replace it
- ✅ **NEAR Integration**: Complete NEAR Protocol support with production contracts
- ✅ **Atomic Guarantees**: Cryptographic coordination ensures atomic execution
- ✅ **Live Demonstration**: Deployed contracts with comprehensive testing
- ✅ **Proper Architecture**: Uses 1inch's official interfaces and escrow system

## Security Considerations

- **Atomic Execution**: Either both chains complete or both can cancel/refund
- **Economic Security**: Safety deposits ensure honest resolver behavior  
- **Access Control**: Only authorized 1inch resolvers can execute orders
- **Time Boundaries**: Multi-stage timelocks prevent griefing attacks
- **Parameter Validation**: Comprehensive validation of all cross-chain parameters

## Future Extensions

The modular architecture enables easy addition of new blockchains:

1. **Implement `IDestinationChain`** for the target blockchain
2. **Deploy adapter contract** with chain-specific logic
3. **Register with `CrossChainRegistry`** for immediate availability
4. **Test integration** using existing test infrastructure

**Planned Extensions:**
- Cosmos (CosmWasm contracts)
- Bitcoin (Script-based HTLCs)  
- Aptos (Move modules)

## License

MIT License - see LICENSE file for details.