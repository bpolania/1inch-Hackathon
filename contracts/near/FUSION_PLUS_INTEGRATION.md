# 1inch Fusion+ NEAR Integration

This contract extends 1inch Fusion+ to support NEAR Protocol as a destination chain for cross-chain atomic swaps.

## Architecture Overview

### What This Extension Provides

```
1inch Fusion+ Order (Ethereum)     →     NEAR Execution
================================        ==================
- User creates Fusion+ order            - Resolver executes on NEAR
- 1inch resolvers compete               - Atomic swap via HTLC
- Order includes NEAR destination       - User receives NEAR tokens
- Same auction mechanism                - Resolver gets fee + deposit back
```

## Key Integration Points

### 1. Order Format Compatibility
- Accepts 1inch Fusion+ order hash
- Uses 1inch packed timelock format
- Compatible with 1inch safety deposit model
- Integrates with 1inch resolver network

### 2. Resolver Network
- Only 1inch authorized resolvers can execute
- Same resolvers that handle Ethereum swaps
- Resolvers stake safety deposits (5% minimum)
- Economic incentives align with 1inch model

### 3. Atomic Execution
- HTLC mechanism ensures atomicity
- Same hashlock on both chains
- Preimage revelation completes swap
- Timelock protection for both parties

## Contract Functions

### Core Fusion+ Operations

#### `execute_fusion_order`
Executes a 1inch Fusion+ order on NEAR side.

```rust
execute_fusion_order(
    order_hash: String,      // 1inch order hash
    hashlock: String,        // HTLC secret hash
    maker: AccountId,        // User receiving NEAR
    resolver: AccountId,     // 1inch resolver
    amount: U128,           // NEAR amount
    resolver_fee: U128,     // Fee from order
    timelocks: U128,        // Packed timelocks
    source_chain_id: u32,   // Source chain (e.g., Ethereum)
) -> FusionPlusOrder
```

#### `claim_fusion_order`
Completes atomic swap by revealing preimage.

```rust
claim_fusion_order(
    order_hash: String,
    preimage: String
) -> Promise
```

## Usage Example

### 1. User Creates Fusion+ Order (TypeScript)
```typescript
import { createFusionPlusNearIntent } from '@1inch/fusion-plus-near';

const order = createFusionPlusNearIntent({
    sourceChain: ChainId.ETHEREUM_SEPOLIA,
    sourceToken: USDC,
    sourceAmount: '10000000', // 10 USDC
    destinationChain: ChainId.NEAR_TESTNET,
    destinationToken: 'native',
    destinationAmount: '2000000000000000000000000', // 2 NEAR
    destinationAddress: 'user.testnet'
});
```

### 2. 1inch Resolver Executes (NEAR)
```bash
near call fusion-plus-near.testnet execute_fusion_order '{
    "order_hash": "0x1234...",
    "hashlock": "abcd...",
    "maker": "user.testnet",
    "resolver": "resolver.testnet",
    "amount": "2000000000000000000000000",
    "resolver_fee": "100000000000000000000000",
    "timelocks": "0",
    "source_chain_id": 11155111
}' --deposit 2.15
```

### 3. Resolver Claims with Preimage
```bash
near call fusion-plus-near.testnet claim_fusion_order '{
    "order_hash": "0x1234...",
    "preimage": "secret123..."
}'
```

## Deployment

### Deploy to NEAR Testnet
```bash
./deploy-fusion.sh
```

### Current Deployment
- **Contract**: `fusion-plus-near.demo.cuteharbor3573.testnet`
- **Network**: NEAR Testnet
- **Min Safety Deposit**: 500 bps (5%)
- **Status**: Ready for 1inch integration

## Security Model

### Economic Security
- Resolvers stake 5% safety deposit
- Deposit returned on successful completion
- Forfeited if resolver misbehaves

### Cryptographic Security
- SHA-256 hashlock verification
- Atomic execution via shared secret
- Timelock protection against griefing

### Authorization
- Only 1inch authorized resolvers
- Owner can add/remove resolvers
- Compatible with 1inch governance

## Benefits of This Extension

### For Users
- Access NEAR liquidity through 1inch
- Same familiar 1inch interface
- Atomic security guarantees
- Competitive pricing via auctions

### For Resolvers
- New market opportunity (NEAR)
- Same operational model
- Existing infrastructure works
- Additional fee revenue

### For 1inch Protocol
- Expanded to non-EVM chains
- First-mover advantage on NEAR
- Increased order flow
- Enhanced network effects

## Testing

### Unit Tests
```bash
cargo test --lib
```

### Integration Tests (Fusion+ specific)
```bash
cargo test --test fusion_integration_tests
```

### Live Testing
See `live-demo-fusion-plus.js` for end-to-end demonstration.

## Future Enhancements

1. **Multi-token Support**: Beyond native NEAR
2. **Batch Orders**: Multiple swaps in one transaction
3. **Dynamic Fees**: Market-based resolver fees
4. **Cross-chain Messaging**: Direct integration with 1inch contracts

## Compliance with Hackathon Requirements

✅ **Extends 1inch Fusion+** - Not a standalone system
✅ **Uses 1inch Order Format** - Full compatibility
✅ **Integrates Resolver Network** - Same 1inch resolvers
✅ **Preserves HTLC Security** - Atomic guarantees
✅ **Bidirectional Support** - ETH↔NEAR swaps
✅ **Live Deployment** - Testnet operational

This implementation demonstrates how 1inch Fusion+ can be extended to support non-EVM chains while maintaining compatibility with the existing ecosystem.