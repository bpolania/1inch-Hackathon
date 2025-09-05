# NEAR Cross-Chain HTLC Contract

A Rust smart contract for NEAR Protocol that implements Hash Time Locked Contracts (HTLC) for atomic cross-chain swaps.

## Features

-  **Hash Time Locked Contracts**: Secure atomic swap mechanism using hashlock/timelock
-  **Resolver Network**: Authorized resolvers with safety deposit requirements
-  **Native NEAR Support**: Direct integration with NEAR native token
-  **Event Emission**: Comprehensive logging for off-chain monitoring
-  **Safety Mechanisms**: Multi-stage timelock and economic security deposits

## Smart Contract Functions

### Core HTLC Operations

#### `create_order`
Creates a new cross-chain swap intent with NEAR tokens locked.

```rust
create_order(
    order_id: String,
    hashlock: String,        // 32-byte hex string
    timelock: U64,          // Block height expiry
    destination_chain: String,
    destination_token: String,
    destination_amount: U128,
    destination_address: String,
    resolver_fee: U128,
) -> HTLCOrder
```

#### `match_order` 
Resolver commits to fulfilling the swap by depositing safety deposit.

```rust
match_order(order_id: String) -> HTLCOrder
```

#### `claim_order`
Resolver provides preimage to claim locked funds and fees.

```rust
claim_order(order_id: String, preimage: String) -> Promise
```

#### `cancel_order`
Maker can cancel and refund after timelock expires.

```rust
cancel_order(order_id: String) -> Promise
```

### Management Functions

- `add_resolver(resolver: AccountId)` - Owner adds authorized resolver
- `remove_resolver(resolver: AccountId)` - Owner removes resolver
- `get_order(order_id: String)` - View order details
- `is_authorized_resolver(resolver: AccountId)` - Check resolver status

## Quick Start

### Prerequisites
- [Rust](https://rustup.rs/) installed
- [NEAR CLI](https://docs.near.org/tools/near-cli) installed
- NEAR testnet account

### Build Contract

```bash
# Install dependencies
cargo build

# Build WASM contract with cargo-near (recommended)
cargo near build

# Alternative: Use build script
./build.sh
```

### Deploy to Testnet

```bash
# Create contract account
near create-account cross-chain-htlc.YOUR_ACCOUNT.testnet \\
  --masterAccount YOUR_ACCOUNT.testnet \\
  --initialBalance 10

# Deploy contract
near deploy --wasmFile out/cross_chain_htlc.wasm \\
  --accountId cross-chain-htlc.YOUR_ACCOUNT.testnet
```

### Initialize Contract

```bash
near call cross-chain-htlc.YOUR_ACCOUNT.testnet new '{}' \\
  --accountId YOUR_ACCOUNT.testnet
```

## Example Usage

### Create Cross-Chain Swap Order

```bash
# Create order: 5 NEAR  0.001 ETH
near call cross-chain-htlc.YOUR_ACCOUNT.testnet create_order '{
  "order_id": "swap-001", 
  "hashlock": "abcd1234...", 
  "timelock": "150000000",
  "destination_chain": "ethereum",
  "destination_token": "ETH", 
  "destination_amount": "1000000000000000",
  "destination_address": "0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f",
  "resolver_fee": "100000000000000000000000"
}' --accountId YOUR_ACCOUNT.testnet --deposit 5
```

### Resolver Matches Order

```bash
near call cross-chain-htlc.YOUR_ACCOUNT.testnet match_order '{
  "order_id": "swap-001"
}' --accountId resolver.testnet --deposit 0.5
```

### Complete Swap with Preimage

```bash
near call cross-chain-htlc.YOUR_ACCOUNT.testnet claim_order '{
  "order_id": "swap-001",
  "preimage": "secret123..."
}' --accountId resolver.testnet
```

## Integration with Ethereum

This NEAR contract is designed to work with the Ethereum CrossChainFactory contract at:
- **Sepolia**: [`0x98c35dA70f839F1B7965b8b8BA17654Da11f4486`](https://sepolia.etherscan.io/address/0x98c35dA70f839F1B7965b8b8BA17654Da11f4486)

### Cross-Chain Flow
1. **Intent Creation**: User creates intent on Ethereum side
2. **NEAR Order**: Corresponding HTLC order created on NEAR
3. **Resolver Matching**: Authorized resolver commits on both chains
4. **Secret Coordination**: Shared hashlock enables atomic execution
5. **Completion**: Preimage revealed, both sides claimed atomically

## Security Model

- **Atomic Guarantees**: Either both chains complete or both can be cancelled
- **Safety Deposits**: Resolvers stake 10% to ensure honest behavior  
- **Time Bounds**: Orders expire after specified block height
- **Authorization**: Only approved resolvers can match orders
- **Hash Verification**: SHA-256 preimage verification prevents fraud

## Testing

### Sandbox Tests (Local) - Recommended
Run the complete test suite using NEAR sandbox environment:

```bash
# Run all sandbox tests (fast and reliable)
cargo test

# Run specific test categories
cargo test --lib                    # Unit tests only
cargo test --test fusion_integration_tests  # Fusion+ integration tests

# Run with output
cargo test -- --nocapture
```

### Testnet Deployment Tests (Live)
Test the live deployed contract on NEAR testnet:

```bash
# Run testnet deployment verification
cargo test --test testnet_deployment_tests -- --nocapture
```

**Note**: Testnet tests use direct RPC calls to `rpc.testnet.near.org` with built-in rate limiting (15-second delays) to respect NEAR's 60 calls/minute limit.

### Test Coverage

**Unit Tests (8 tests):**
-  Contract initialization
-  Resolver management (add/remove)
-  Order creation validation
-  Order matching authorization
-  View functions

**Integration Tests (9 tests):**
-  Contract deployment & initialization
-  Resolver management workflow
-  HTLC order creation
-  Order matching with safety deposits
-  Claim order with preimage verification
-  Cancel expired orders with refunds
-  Unauthorized resolver protection
-  **Full cross-chain swap simulation**
-  Event logging verification
-  Balance transfer verification

### Advanced Testing Features

**near-workspaces provides:**
-  **Real contract deployment** in sandbox environment
-  **Real token transfers** and balance verification
-  **Block advancement** for timelock testing
-  **Multi-account interactions** (users, resolvers, contracts)
-  **Event log inspection** for monitoring integration
-  **Cryptographic hash verification** with real preimages

## Live Deployment Summary

### NEAR - 1inch Fusion+ Extension

 **1inch Fusion+ NEAR Extension - Production Deployment**

#### Latest Deployment (July 23, 2025)
- **Contract Address**: [`fusion-plus.demo.cuteharbor3573.testnet`](https://testnet.nearblocks.io/address/fusion-plus.demo.cuteharbor3573.testnet)
- **Deployed By**: `demo.cuteharbor3573.testnet`
- **Deployment Date**: July 23, 2025 
- **Integration Type**: **1inch Fusion+ Extension** (not standalone)
- **Owner**: `demo.cuteharbor3573.testnet` 
- **Min Safety Deposit**: 500 bps (5%) 
- **Authorized 1inch Resolvers**: 1   
- **Resolver Status**: `demo.cuteharbor3573.testnet` is authorized 

#### Deployment Transaction History
- **Account Creation**: [98a3GNajLnZ8wzz3UNk9nrdfofLw2YbVZx2Xbo5CrNoR](https://testnet.nearblocks.io/txns/98a3GNajLnZ8wzz3UNk9nrdfofLw2YbVZx2Xbo5CrNoR)
- **WASM Deployment**: [5zN5UpwE3KJMK4mVi1AKffdZL2kb6at9EPSdYSSbqUHq](https://testnet.nearblocks.io/txns/5zN5UpwE3KJMK4mVi1AKffdZL2kb6at9EPSdYSSbqUHq)
- **Contract Initialization**: [yXTqDWx5xSW3mAqsejpPi2hni8zpkpo7QV3nqkYkhzM](https://testnet.nearblocks.io/txns/yXTqDWx5xSW3mAqsejpPi2hni8zpkpo7QV3nqkYkhzM)
- **Resolver Authorization**: [666Z4krACmYb48mVszYseAATzGCL5vJsfoz3NYTFCEZZ](https://testnet.nearblocks.io/txns/666Z4krACmYb48mVszYseAATzGCL5vJsfoz3NYTFCEZZ)

#### Legacy Deployment (Previous Standalone Version)
- **Contract Address**: [`cross-chain-htlc.demo.cuteharbor3573.testnet`](https://testnet.nearblocks.io/address/cross-chain-htlc.demo.cuteharbor3573.testnet)
- **Status**: **DEPRECATED** - Old standalone version, not Fusion+ compatible
- **Note**: Contains old contract state incompatible with 1inch Fusion+ format

#### 1inch Fusion+ Integration
- **NEAR Fusion+ Extension**: `fusion-plus.demo.cuteharbor3573.testnet`
- **Ethereum Modular Factory**: [`0x98c35dA70f839F1B7965b8b8BA17654Da11f4486`](https://sepolia.etherscan.io/address/0x98c35dA70f839F1B7965b8b8BA17654Da11f4486)
- **Cross-Chain Network**: Sepolia  NEAR Testnet
- **Status**: **Ready for 1inch Fusion+ cross-chain swaps!** 

#### Live Demo Commands (Fusion+ Version)
```bash
# View contract state
near state fusion-plus.demo.cuteharbor3573.testnet

# Check safety deposit requirement
near view fusion-plus.demo.cuteharbor3573.testnet get_min_safety_deposit_bps

# Test Fusion+ order execution (1inch resolver required)
near call fusion-plus.demo.cuteharbor3573.testnet execute_fusion_order '{
  "order_hash": "0x1234...",
  "hashlock": "abcd...",
  "maker": "user.testnet",
  "resolver": "demo.cuteharbor3573.testnet",
  "amount": "2000000000000000000000000",
  "resolver_fee": "100000000000000000000000",
  "timelocks": "0",
  "source_chain_id": 11155111
}' --accountId demo.cuteharbor3573.testnet --deposit 2.15
```

## Events

The contract emits structured events for monitoring:

- `ORDER_CREATED` - New swap intent created
- `ORDER_CLAIMED` - Swap completed with preimage
- Contract logs viewable via NEAR Explorer

## License

This project inherits the license from the main 1inch Cross-Chain repository.