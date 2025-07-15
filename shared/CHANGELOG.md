# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-07-15

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
- **Test Coverage**: 14 comprehensive tests for Fusion+ functionality ensuring compatibility with 1inch architecture

#### Intent System Foundation
- **Core Intent Types**: `SwapIntent`, `TokenInfo`, and related interfaces for cross-chain atomic swaps
- **Chain Support**: Full support for Ethereum, Bitcoin, Aptos, and Cosmos networks (mainnet and testnet)
- **Utilities**: Intent creation, validation, hashlock generation, and execution time estimation
- **Examples**: 5 example intents covering major cross-chain swap scenarios
- **Validation**: Comprehensive input validation with detailed error reporting

### Technical Details
- **HTLC Integration**: Hash Time Locked Contracts with shared secret coordination
- **EIP-712 Compatible**: Structured data hashing following Ethereum standards
- **Multi-chain Architecture**: Extensible design supporting both EVM and non-EVM chains
- **Safety Mechanisms**: Built-in timelock validation and safety deposit calculations

### Testing
- **48 passing tests** covering all functionality
- Unit tests for intent creation, validation, and Fusion+ integration
- Edge case testing for invalid inputs and boundary conditions
- Comprehensive coverage of timelock packing/unpacking operations

## [0.1.0] - 2025-07-15

### Added
- Initial project structure
- Basic TypeScript configuration
- Cross-chain atomic swap architecture documentation