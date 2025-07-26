# Cosmos Implementation Plan for 1inch Fusion+ Extension

## Project Overview

This document outlines the implementation plan for extending the existing 1inch Fusion+ cross-chain system to support Cosmos chains, building on the proven modular architecture already established with NEAR Protocol integration.

## Current Architecture Analysis

### ✅ What's Already Built

**Modular Foundation:**
- **`IDestinationChain` Interface**: Universal adapter pattern for any blockchain
- **NEAR Integration Complete**: Production-ready implementation with HTLC contract deployed on testnet
- **1inch Fusion+ Compatible**: Proper protocol extension using order `salt` field for chain-specific data
- **CrossChainRegistry System**: Dynamic chain management allowing easy addition of new chains
- **Comprehensive Testing**: 106/106 tests passing with full integration coverage

**Key Components in Place:**
1. **Ethereum Side**: `FusionPlusFactory`, `CrossChainRegistry`, `IDestinationChain` interface
2. **NEAR Implementation**: `FusionPlusNear` contract, `NearDestinationChain` adapter
3. **Shared Types**: Chain definitions, intent formats, utility functions
4. **Testing Infrastructure**: Complete test suites for contracts and integration

## Cosmos Extension Implementation Plan

### Phase 1: Cosmos Chain Support in Shared Types

**Objective**: Extend existing type system to support Cosmos chains

**Tasks:**
- Add Cosmos-specific chain IDs following bounty specification:
  - Neutron testnet: 7001
  - Juno testnet: 7002
  - Additional Cosmos chains: 30001-30010 for future expansion
- Extend `ChainType.COSMOS` support in existing type system
- Add chain information for native currencies (uatom, ujuno, untrn)

**Files to Modify:**
- `shared/src/types/chains.ts`
- `shared/src/constants/index.ts`

### Phase 2: CosmosDestinationChain Adapter

**Objective**: Create Ethereum-side adapter for Cosmos chains following NEAR pattern

**Implementation**: `contracts/ethereum/contracts/adapters/CosmosDestinationChain.sol`

**Key Features:**
```solidity
contract CosmosDestinationChain is IDestinationChain {
    // Chain constants
    uint256 public constant NEUTRON_TESTNET_ID = 7001;
    uint256 public constant JUNO_TESTNET_ID = 7002;
    uint256 public constant MIN_SAFETY_DEPOSIT_BPS = 500; // 5%
    
    // Cosmos-specific parameters
    struct CosmosExecutionParams {
        string contractAddress;  // CosmWasm contract address
        bytes msg;              // Execute message (JSON)
        string funds;           // Native tokens to send
        uint64 gasLimit;        // Gas limit for execution
    }
}
```

**Core Functions:**
- `validateDestinationAddress()`: Bech32 address validation (neutron1..., juno1...)
- `validateOrderParams()`: CosmWasm execution parameter validation
- `estimateExecutionCost()`: Native token cost estimation
- `formatTokenIdentifier()`: Cosmos token denomination handling

### Phase 3: CosmWasm HTLC Smart Contract

**Objective**: Implement Cosmos-side HTLC contract mirroring NEAR architecture

**Implementation**: `contracts/cosmos/src/lib.rs`

**Contract Structure:**
```rust
use cosmwasm_std::{
    entry_point, Binary, Deps, DepsMut, Env, MessageInfo, 
    Response, StdResult, Uint128, Addr
};
use cw_storage_plus::Map;
use sha2::{Sha256, Digest};

#[cw_serde]
pub struct FusionPlusOrder {
    pub order_hash: String,
    pub hashlock: String,
    pub timelocks: Uint128,        // Packed timelock stages (1inch format)
    pub maker: Addr,               // User receiving tokens on Cosmos
    pub resolver: Addr,            // 1inch resolver executing the order
    pub amount: Uint128,           // Amount of native tokens to transfer
    pub resolver_fee: Uint128,     // Resolver fee from the 1inch order
    pub safety_deposit: Uint128,   // Safety deposit from 1inch system
    pub status: OrderStatus,       // Order execution status
    pub preimage: Option<String>,  // Preimage when revealed
    pub source_chain_id: u32,      // Source chain ID (e.g., Ethereum = 11155111)
}

#[cw_serde]
pub enum OrderStatus {
    Pending,
    Matched,
    Claimed,
    Refunded,
}

pub struct FusionPlusCosmos {
    /// Fusion+ orders indexed by 1inch order hash
    pub orders: Map<String, FusionPlusOrder>,
    /// 1inch authorized resolvers (compatibility with 1inch network)
    pub authorized_resolvers: Map<Addr, bool>,
    /// Contract admin for management
    pub admin: Addr,
    /// Minimum safety deposit ratio (basis points)
    pub min_safety_deposit_bps: u16,
}
```

**Key Functions:**
- `execute_fusion_order()`: Create and match 1inch Fusion+ orders
- `claim_fusion_order()`: Atomic claiming with preimage verification
- `refund_order()`: Timelock-based refund mechanism
- `add_resolver()`: Resolver management for 1inch integration

**HTLC Implementation:**
```rust
// SHA-256 hashlock validation
fn validate_preimage(preimage: &str, hashlock: &str) -> bool {
    let mut hasher = Sha256::new();
    hasher.update(preimage.as_bytes());
    let result = hasher.finalize();
    let computed_hash = hex::encode(result);
    computed_hash == hashlock
}

// Timelock validation using Cosmos block time
fn check_timelock_expired(env: &Env, timelock: u64) -> bool {
    env.block.time.seconds() > timelock
}
```

### Phase 4: Integration & Testing

**Objective**: Complete end-to-end integration following NEAR testing patterns

**Tasks:**
1. **Contract Deployment**:
   - Deploy CosmWasm contract to Neutron testnet
   - Initialize with 5% minimum safety deposit
   - Authorize test resolver accounts

2. **Registry Integration**:
   - Register Cosmos adapters in `CrossChainRegistry`
   - Deploy updated `FusionPlusFactory` with Cosmos support
   - Test adapter validation and cost estimation

3. **Integration Testing**:
   - Create test suite: `CosmosDestinationChain.test.js`
   - Add integration tests: `FusionPlusCosmosIntegration.test.js`
   - Test both ETH → Cosmos and Cosmos → ETH swap flows

4. **Live Demo Implementation**:
   - Create demo script showing full atomic swap
   - Include testnet transaction links for verification
   - Demonstrate bidirectional swap capabilities

## Technical Architecture Decisions

### Cosmos Chain Selection

**Primary Target**: Neutron Testnet
- **Chain ID**: 7001 (as specified in bounty)
- **Advantages**: Advanced CosmWasm support, IBC connectivity
- **Native Token**: untrn (6 decimals)
- **Explorer**: https://neutron.celat.one/neutron-testnet

**Secondary Target**: Juno Testnet
- **Chain ID**: 7002 (as specified in bounty)  
- **Advantages**: Mature ecosystem, established tooling
- **Native Token**: ujuno (6 decimals)
- **Explorer**: https://testnet.juno.explorers.guru

### CosmWasm Contract Design Principles

**1inch Fusion+ Compatibility:**
- Use same order hash format as Ethereum contracts
- Implement packed timelock stages matching 1inch specification
- Maintain safety deposit mechanism (5% minimum)
- Support authorized resolver network integration

**HTLC Security Model:**
- SHA-256 hashlock coordination with Ethereum
- Block time-based timelock validation
- Atomic execution guarantees (claim with preimage OR refund after timeout)
- Safety deposits ensure resolver honest participation

**State Management:**
- Use `cw-storage-plus::Map` for efficient storage
- Index orders by 1inch order hash for cross-chain coordination
- Comprehensive event emission for monitoring integration

### Address Format Handling

**Cosmos Bech32 Addresses:**
```solidity
// Example validation logic for CosmosDestinationChain.sol
function validateDestinationAddress(bytes calldata destinationAddress) external pure returns (bool) {
    string memory addr = string(destinationAddress);
    bytes memory addrBytes = bytes(addr);
    
    // Check length (39-59 chars for bech32)
    if (addrBytes.length < 39 || addrBytes.length > 59) return false;
    
    // Check prefix (neutron1, juno1, cosmos1, etc.)
    // Validate bech32 encoding
    return _validateBech32Format(addrBytes);
}
```

## Bounty Requirements Compliance

### ✅ Core Requirements Met

**Preserve hashlock and timelock functionality:**
- SHA-256 hashlock coordination between Ethereum and Cosmos
- Block time-based timelock validation in CosmWasm
- Multi-stage timelock support matching 1inch specification

**Bidirectional swap support:**
- ETH → Cosmos: Lock USDC on Ethereum, claim native tokens on Cosmos
- Cosmos → ETH: Lock native tokens on Cosmos, claim USDC on Ethereum
- Shared preimage revelation enables atomic completion

**Onchain execution on testnet:**
- Deploy CosmWasm contract to Neutron testnet
- Demonstrate real token transfers with transaction proofs
- Provide explorer links for verification

### 🎯 Stretch Goals Implementation

**UI Integration:**
- Extend existing modular UI architecture
- Add Cosmos chain selection and address input
- Show real-time swap status across chains

**Partial Fills:**
- CosmWasm native support for partial order execution
- Update order state management for remaining amounts
- Implement pro-rata fee distribution

**Relayer and Resolver:**
- Integrate with existing 1inch resolver network
- Use established safety deposit and fee mechanisms
- Maintain compatibility with current resolver authorization system

## Implementation Timeline

### Week 1: Foundation
- **Day 1-2**: Extend shared types for Cosmos support
- **Day 3-4**: Implement CosmosDestinationChain adapter
- **Day 5**: Deploy and test adapter integration

### Week 2: Core Contract
- **Day 1-3**: Implement CosmWasm HTLC contract
- **Day 4-5**: Local testing and optimization

### Week 3: Integration
- **Day 1-2**: Deploy to Neutron testnet
- **Day 3-4**: End-to-end integration testing
- **Day 5**: Live demo preparation and documentation

## Risk Assessment & Mitigation

### Technical Risks

**CosmWasm Learning Curve:**
- **Mitigation**: Follow proven NEAR patterns closely
- **Fallback**: Use existing CosmWasm templates and documentation

**Testnet Reliability:**
- **Mitigation**: Test on multiple Cosmos testnets (Neutron + Juno)
- **Fallback**: Local development with CosmWasm simulator

**Gas Estimation Accuracy:**
- **Mitigation**: Implement conservative gas estimates with testing
- **Fallback**: Add configurable gas multipliers

### Integration Risks

**1inch Compatibility:**
- **Mitigation**: Mirror NEAR implementation exactly
- **Validation**: Use same order hash and timelock formats

**Cross-Chain Timing:**
- **Mitigation**: Implement generous timelock windows
- **Monitoring**: Add comprehensive event logging

## Success Metrics

### Functional Requirements
- [ ] CosmosDestinationChain adapter passes all interface tests
- [ ] CosmWasm contract deploys successfully to testnet
- [ ] End-to-end ETH ↔ Cosmos swap completes atomically
- [ ] All existing tests continue to pass (106/106)

### Performance Requirements
- [ ] Address validation < 50ms response time
- [ ] Order parameter validation < 100ms
- [ ] Contract execution < 30 seconds on testnet
- [ ] Gas costs reasonable for production use

### Integration Requirements
- [ ] Registry accepts Cosmos adapters without modification
- [ ] Factory creates orders with Cosmos destinations
- [ ] Resolver network can execute Cosmos orders
- [ ] Events integrate with existing monitoring

## Conclusion

This implementation plan leverages the existing proven modular architecture to add Cosmos support with minimal risk and maximum reuse. The NEAR integration provides a battle-tested template that can be adapted for Cosmos with confidence.

The modular `IDestinationChain` pattern was specifically designed for this expansion, making Cosmos integration a natural extension rather than a fundamental rewrite. Success probability is very high given the established patterns and comprehensive testing infrastructure already in place.

**Next Steps**: Proceed with Phase 1 implementation, extending shared types to support Cosmos chains as specified in the bounty requirements.