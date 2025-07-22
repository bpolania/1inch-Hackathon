# NEAR Cross-Chain HTLC Contract

A Rust smart contract for NEAR Protocol that implements Hash Time Locked Contracts (HTLC) for atomic cross-chain swaps.

## Features

- ✅ **Hash Time Locked Contracts**: Secure atomic swap mechanism using hashlock/timelock
- ✅ **Resolver Network**: Authorized resolvers with safety deposit requirements
- ✅ **Native NEAR Support**: Direct integration with NEAR native token
- ✅ **Event Emission**: Comprehensive logging for off-chain monitoring
- ✅ **Safety Mechanisms**: Multi-stage timelock and economic security deposits

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

# Build WASM contract
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
# Create order: 5 NEAR → 0.001 ETH
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

```bash
# Run unit tests
cargo test

# Run integration tests with NEAR CLI
near call contract_account test_create_order --accountId test_account
```

## Events

The contract emits structured events for monitoring:

- `ORDER_CREATED` - New swap intent created
- `ORDER_CLAIMED` - Swap completed with preimage
- Contract logs viewable via NEAR Explorer

## License

This project inherits the license from the main 1inch Cross-Chain repository.