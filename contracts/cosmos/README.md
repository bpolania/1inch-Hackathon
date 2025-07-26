# Cosmos CosmWasm Contracts for 1inch Fusion+ Extension

This directory contains CosmWasm smart contracts for extending 1inch Fusion+ to support Cosmos ecosystem chains including Neutron, Juno, and other Cosmos-based networks.

## Overview

The Cosmos integration enables atomic cross-chain swaps between Ethereum and Cosmos chains using Hash Time Locked Contracts (HTLC) while maintaining full compatibility with the 1inch Fusion+ protocol architecture.

### Architecture

```
Ethereum (Source)           Cosmos (Destination)
┌─────────────────┐         ┌─────────────────────┐
│ FusionPlusFactory│         │ FusionPlusCosmos    │
│                 │         │ CosmWasm Contract   │
│ CosmosDestination│◀────────▶│                     │
│ Chain Adapter   │         │ - HTLC Logic        │
│                 │         │ - SHA-256 Hashlock  │
│ - Address Validation      │ - Block Time Locks  │
│ - Parameter Encoding      │ - Resolver Auth     │
│ - Cost Estimation│         │ - Safety Deposits   │
└─────────────────┘         └─────────────────────┘
```

## Supported Chains

| Chain | Chain ID | Native Token | Address Prefix | Status |
|-------|----------|--------------|----------------|--------|
| Neutron Testnet | 7001 | NTRN (untrn) | neutron | 🎯 **Primary Target** |
| Juno Testnet | 7002 | JUNO (ujuno) | juno | 🎯 **Primary Target** |
| Cosmos Hub | 30001 | ATOM (uatom) | cosmos | 🔄 Future |
| Osmosis | 30003 | OSMO (uosmo) | osmo | 🔄 Future |
| Stargaze | 30005 | STARS (ustars) | stars | 🔄 Future |
| Akash | 30007 | AKT (uakt) | akash | 🔄 Future |

## Contract Structure

### FusionPlusCosmos Contract

The main CosmWasm contract implementing HTLC functionality for 1inch Fusion+ orders.

**Key Features:**
- **1inch Compatibility**: Uses same order hash format and packed timelock structure
- **Resolver Network**: Integrates with existing 1inch authorized resolver infrastructure  
- **HTLC Security**: SHA-256 hashlock with block time-based timelock validation
- **Safety Deposits**: 5% minimum deposit requirement (500 basis points)
- **Event Logging**: Comprehensive events for 1inch monitoring integration

**Core Functions:**
```rust
// Initialize contract with admin and minimum safety deposit
pub fn instantiate(deps: DepsMut, env: Env, info: MessageInfo, msg: InstantiateMsg)

// Execute 1inch Fusion+ order (resolver only)  
pub fn execute_fusion_order(deps: DepsMut, env: Env, order: FusionPlusOrder)

// Claim order with preimage revelation
pub fn claim_fusion_order(deps: DepsMut, env: Env, order_hash: String, preimage: String)

// Refund after timelock expiry
pub fn refund_order(deps: DepsMut, env: Env, order_hash: String)

// Admin functions for resolver management
pub fn add_resolver(deps: DepsMut, info: MessageInfo, resolver: Addr)
pub fn remove_resolver(deps: DepsMut, info: MessageInfo, resolver: Addr)
```

### State Management

```rust
use cw_storage_plus::Map;

// Orders indexed by 1inch order hash
pub const ORDERS: Map<String, FusionPlusOrder> = Map::new("orders");

// Authorized 1inch resolvers  
pub const AUTHORIZED_RESOLVERS: Map<Addr, bool> = Map::new("resolvers");

// Contract configuration
pub const CONFIG: Item<Config> = Item::new("config");
```

### Data Structures

```rust
#[cw_serde]
pub struct FusionPlusOrder {
    pub order_hash: String,        // 1inch Fusion+ order hash from Ethereum
    pub hashlock: String,          // SHA-256 hash for HTLC coordination
    pub timelocks: Uint128,        // Packed timelock stages (1inch format)
    pub maker: Addr,               // User receiving tokens on Cosmos
    pub resolver: Addr,            // 1inch resolver executing the order
    pub amount: Uint128,           // Amount of native tokens to transfer
    pub resolver_fee: Uint128,     // Resolver fee from 1inch order
    pub safety_deposit: Uint128,   // Safety deposit from 1inch system
    pub status: OrderStatus,       // Execution status
    pub preimage: Option<String>,  // Preimage when revealed
    pub source_chain_id: u64,      // Source chain (e.g., Ethereum = 11155111)
    pub created_at: u64,           // Block timestamp when created
    pub timeout: u64,              // Timelock expiry timestamp
}

#[cw_serde]
pub enum OrderStatus {
    Pending,   // Order created, waiting for resolution
    Matched,   // Resolver has accepted order
    Claimed,   // Successfully claimed with preimage
    Refunded,  // Refunded after timeout
}
```

## Development Setup

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Add wasm32 target
rustup target add wasm32-unknown-unknown

# Install cargo-generate for project templates
cargo install cargo-generate --features vendored-openssl

# Install CosmWasm tools
cargo install cosmwasm-check
```

### Building Contracts

```bash
# Navigate to cosmos contracts directory
cd contracts/cosmos

# Build optimized WASM
cargo wasm

# Or build with optimization
docker run --rm -v "$(pwd)":/code \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/rust-optimizer:0.12.13
```

### Testing

```bash
# Run unit tests
cargo test

# Run integration tests with proper schema
cargo test --features integration

# Generate JSON schema
cargo schema
```

## Deployment Guide

### 1. Prepare Deployment Environment

```bash
# Install neutrond CLI for Neutron
curl -L https://github.com/neutron-org/neutron/releases/download/v1.0.4/neutrond-linux-amd64 -o neutrond
chmod +x neutrond
sudo mv neutrond /usr/local/bin/

# Configure testnet
neutrond config chain-id pion-1
neutrond config node https://rpc-falcron.pion-1.ntrn.tech:443

# Or install Juno CLI for Juno
curl -L https://github.com/CosmosContracts/juno/releases/download/v14.0.0/junod-linux-amd64 -o junod
chmod +x junod
sudo mv junod /usr/local/bin/

# Configure Juno testnet
junod config chain-id uni-6
junod config node https://rpc.uni.junonetwork.io:443
```

### 2. Deploy to Neutron Testnet

```bash
# Store contract code
STORE_TX=$(neutrond tx wasm store artifacts/fusion_plus_cosmos.wasm \
  --from your-key \
  --gas-prices 0.025untrn \
  --gas auto \
  --gas-adjustment 1.3 \
  --output json \
  --yes)

# Get code ID
CODE_ID=$(echo $STORE_TX | jq -r '.logs[0].events[] | select(.type=="store_code") | .attributes[] | select(.key=="code_id") | .value')

# Instantiate contract
INIT_MSG='{
  "admin": "neutron1...",
  "min_safety_deposit_bps": 500
}'

neutrond tx wasm instantiate $CODE_ID "$INIT_MSG" \
  --from your-key \
  --label "fusion-plus-cosmos-v1" \
  --gas-prices 0.025untrn \
  --gas auto \
  --gas-adjustment 1.3 \
  --admin your-neutron-address \
  --yes
```

### 3. Deploy to Juno Testnet

```bash
# Store contract code
STORE_TX=$(junod tx wasm store artifacts/fusion_plus_cosmos.wasm \
  --from your-key \
  --gas-prices 0.025ujuno \
  --gas auto \
  --gas-adjustment 1.3 \
  --output json \
  --yes)

# Get code ID and instantiate (similar to Neutron)
CODE_ID=$(echo $STORE_TX | jq -r '.logs[0].events[] | select(.type=="store_code") | .attributes[] | select(.key=="code_id") | .value')

INIT_MSG='{
  "admin": "juno1...",
  "min_safety_deposit_bps": 500
}'

junod tx wasm instantiate $CODE_ID "$INIT_MSG" \
  --from your-key \
  --label "fusion-plus-cosmos-v1" \
  --gas-prices 0.025ujuno \
  --gas auto \
  --gas-adjustment 1.3 \
  --admin your-juno-address \
  --yes
```

## Integration with Ethereum

### 1. Update Ethereum Deployment

After deploying CosmWasm contracts, update the Ethereum side:

```bash
# Navigate to Ethereum contracts
cd ../ethereum

# Deploy with Cosmos contract addresses
npx hardhat run scripts/deploy-fusion-plus.js --network sepolia
```

### 2. Register Contract Addresses

Update the CosmosDestinationChain adapters with deployed contract addresses:

```solidity
// In deployment script or registry update
await cosmosAdapter.updateContractAddress(
  "neutron1abcdef...", // Deployed Neutron contract address
  "juno1xyz123..."     // Deployed Juno contract address  
);
```

## Testing Cross-Chain Swaps

### End-to-End Test Scenario

1. **Create ETH → Neutron Order**:
```typescript
import { createFusionPlusCosmosIntent } from '@1inch-cross-chain/shared';

const intent = createFusionPlusCosmosIntent(
  baseIntent,
  'neutron1abcdef...', // Deployed contract address
  orderHash,
  safetyDeposit,
  timelockStages
);
```

2. **Execute on Ethereum**:
```javascript
// Submit order to Ethereum FusionPlusFactory
const tx = await factory.createCrossChainOrder(
  intent.destinationChain,    // 7001 for Neutron
  intent.destinationAddress,  // neutron1...
  encodedParams,              // CosmWasm execution parameters
  intent.amount,
  intent.resolverFeeAmount
);
```

3. **Resolve on Cosmos**:
```bash
# Resolver executes order on Neutron
neutrond tx wasm execute $CONTRACT_ADDRESS \
  '{"execute_fusion_order": {
    "order_hash": "0x...",
    "hashlock": "abc123...", 
    "amount": "1000000",
    "maker": "neutron1...",
    "resolver_fee": "50000",
    "timelocks": "123456789"
  }}' \
  --amount 1000000untrn \
  --from resolver-key
```

4. **Claim with Preimage**:
```bash
# Claim order by revealing preimage
neutrond tx wasm execute $CONTRACT_ADDRESS \
  '{"claim_fusion_order": {
    "order_hash": "0x...",
    "preimage": "secret123"
  }}' \
  --from resolver-key
```

## Security Considerations

### HTLC Security Model
- **Hashlock**: SHA-256 ensures atomic coordination between chains
- **Timelock**: Block time-based expiry prevents indefinite locking
- **Safety Deposits**: 5% minimum deposit ensures resolver honest behavior
- **Resolver Authorization**: Only whitelisted 1inch resolvers can execute orders

### Best Practices
- **Gas Limits**: Set reasonable gas limits (300k default) for contract execution
- **Amount Validation**: Verify amounts match between chains and include sufficient fees
- **Address Validation**: Always validate Cosmos addresses match expected bech32 format
- **Timelock Management**: Ensure sufficient time windows for cross-chain execution

## Monitoring and Events

### Contract Events

```rust
// Order lifecycle events
#[cw_serde]
pub struct FusionOrderCreatedEvent {
    pub order_hash: String,
    pub maker: Addr,
    pub amount: Uint128,
    pub source_chain_id: u64,
}

#[cw_serde] 
pub struct FusionOrderClaimedEvent {
    pub order_hash: String,
    pub resolver: Addr,
    pub preimage: String,
    pub amount: Uint128,
}

#[cw_serde]
pub struct FusionOrderRefundedEvent {
    pub order_hash: String,
    pub maker: Addr,
    pub amount: Uint128,
    pub reason: String,
}
```

### Monitoring Integration

Events are structured for easy integration with 1inch monitoring systems:

```bash
# Query contract events
neutrond query wasm contract-state smart $CONTRACT_ADDRESS \
  '{"get_order": {"order_hash": "0x..."}}'

# Monitor order status
neutrond query wasm contract-state smart $CONTRACT_ADDRESS \
  '{"list_orders": {"status": "pending", "limit": 10}}'
```

## Troubleshooting

### Common Issues

1. **Gas Estimation Errors**:
   - Increase gas limit in CosmosExecutionParams
   - Check contract address is correct
   - Verify funds are sufficient for execution

2. **Address Validation Failures**:
   - Ensure addresses use correct bech32 format
   - Verify address prefix matches chain (neutron1, juno1, etc.)
   - Check address length is between 39-59 characters

3. **Timelock Expiry**:
   - Ensure sufficient time between order creation and execution
   - Account for block time variations between chains
   - Set conservative timelock windows for testnet

4. **Resolver Authorization**:
   - Verify resolver is authorized on both Ethereum and Cosmos sides
   - Check resolver has sufficient balance for safety deposits
   - Confirm resolver key matches authorized address

### Debug Commands

```bash
# Check contract info
neutrond query wasm contract $CONTRACT_ADDRESS

# Query contract state
neutrond query wasm contract-state smart $CONTRACT_ADDRESS \
  '{"config": {}}'

# Check authorized resolvers
neutrond query wasm contract-state smart $CONTRACT_ADDRESS \
  '{"is_authorized_resolver": {"address": "neutron1..."}}'
```

## Contributing

### Development Workflow

1. **Make Changes**: Modify contract code following Rust/CosmWasm best practices
2. **Test Locally**: Run `cargo test` to ensure all tests pass
3. **Build Optimized**: Generate optimized WASM with `cargo wasm`
4. **Integration Test**: Deploy to testnet and test end-to-end flows
5. **Update Documentation**: Keep README and inline documentation current

### Code Standards

- **Rust Style**: Follow standard Rust formatting with `cargo fmt`
- **Error Handling**: Use proper `Result<T, ContractError>` patterns
- **Testing**: Maintain >95% test coverage for all critical functions
- **Documentation**: Document all public functions and complex logic
- **Security**: Follow CosmWasm security best practices

---

## Resources

### Documentation
- [CosmWasm Book](https://book.cosmwasm.com/)
- [Neutron Documentation](https://docs.neutron.org/)
- [Juno Documentation](https://docs.junonetwork.io/)
- [1inch Fusion+ Protocol](https://docs.1inch.io/docs/fusion-swap/introduction)

### Tools
- [CosmWasm IDE](https://ide.cosmwasm.com/)
- [Neutron Testnet Faucet](https://neutron.celat.one/neutron-testnet)
- [Juno Testnet Faucet](https://faucet.uni.junonetwork.io/)

### Support
- [CosmWasm Discord](https://discord.gg/cosmwasm)
- [Neutron Discord](https://discord.gg/neutron)
- [Juno Discord](https://discord.gg/juno)