# Phase 3 Testing Guide - CosmWasm Contract

## Quick Test Commands

### 1. Run All Tests (25 total)
```bash
# Navigate to cosmos directory first
cd contracts/cosmos

# Load Rust environment
source "$HOME/.cargo/env"

# Run all tests
cargo test
```

### 2. Run Specific Test Categories
```bash
# Unit tests only (basic validation)
cargo test tests::

# Integration tests only (full contract functionality)  
cargo test integration_tests::

# Specific test by name
cargo test test_instantiate
cargo test test_execute_fusion_order
cargo test test_claim_fusion_order
```

### 3. Verbose Test Output
```bash
# Show detailed test output
cargo test -- --nocapture

# Show test names as they run
cargo test -- --nocapture --test-threads=1
```

## Expected Test Results

### ✅ Should See 25/25 Tests Passing:

**Unit Tests (3):**
- `tests::proper_initialization` - Contract setup
- `tests::test_hashlock_validation` - SHA256 validation  
- `tests::test_preimage_validation` - Preimage verification

**Integration Tests (22):**
- `test_instantiate` - Contract deployment
- `test_add_remove_resolver` - Resolver management
- `test_execute_fusion_order` - Order creation
- `test_claim_fusion_order` - HTLC claim process
- `test_refund_after_timeout` - Timeout refunds
- `test_unauthorized_operations` - Security checks
- `test_edge_cases` - Boundary conditions
- And 15 more comprehensive tests...

## Manual Testing Scenarios

### Test 1: Contract Instantiation
```rust
// This tests contract deployment with proper config
let msg = InstantiateMsg {
    admin: Some("admin".to_string()),
    min_safety_deposit_bps: Some(500), // 5%
    native_denom: "untrn".to_string(),
};
```

### Test 2: Fusion Order Execution  
```rust
// Tests creating a cross-chain order with HTLC
let order_msg = ExecuteMsg::ExecuteFusionOrder {
    order_hash: "0x123...".to_string(),
    hashlock: "abc123...".to_string(), // SHA256 hash
    timelocks: vec![1000000000], // Unix timestamp
    maker: "neutron1maker...".to_string(),
    source_chain_id: 1,
};
```

### Test 3: HTLC Claim Process
```rust
// Tests atomic claim with preimage revelation
let claim_msg = ExecuteMsg::ClaimFusionOrder {
    order_hash: "0x123...".to_string(),
    preimage: "secret_preimage".to_string(),
};
```

### Test 4: Timeout Refund
```rust
// Tests refund after timelock expires
let refund_msg = ExecuteMsg::RefundFusionOrder {
    order_hash: "0x123...".to_string(),
};
```

## Development Commands

### Build and Verify
```bash
# Build the contract
cargo build --release --target wasm32-unknown-unknown

# Run linting
cargo clippy

# Format code
cargo fmt

# Generate schema
cargo schema
```

### Using Makefile (Alternative)
```bash
# Run tests via Makefile
make test

# Build optimized contract
make optimize

# Full development workflow
make dev
```

## Test Coverage Areas

The 25 tests cover:

### ✅ Core Functionality:
- **Contract instantiation** and configuration
- **Resolver authorization** management  
- **Fusion order execution** with validation
- **HTLC claim/refund** mechanisms
- **Safety deposit** calculations (5%)

### ✅ Security & Edge Cases:
- **Unauthorized access** prevention
- **Invalid parameters** rejection
- **Timeout handling** for refunds
- **Large number** processing
- **Zero amount** edge cases

### ✅ CosmWasm Integration:
- **Native token** handling (untrn, ujuno, etc.)
- **Event emission** for monitoring
- **Query interfaces** for order management
- **Storage operations** with proper types
- **Error handling** with custom types

## Troubleshooting

### If Tests Fail:
1. **Check Rust installation**: `cargo --version`
2. **Clean and rebuild**: `cargo clean && cargo test`
3. **Check dependencies**: All should be compatible versions
4. **Verify environment**: `source "$HOME/.cargo/env"`

### If Compilation Fails:
1. **Update dependencies**: Check Cargo.toml versions
2. **WebAssembly target**: `rustup target add wasm32-unknown-unknown`
3. **Clear cache**: `cargo clean`

### If Environment Issues:
1. **Reload Rust**: `source "$HOME/.cargo/env"`
2. **Reinstall if needed**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

## Expected Output

```
running 25 tests
test integration_tests::tests::test_instantiate ... ok
test integration_tests::tests::test_execute_fusion_order ... ok
test integration_tests::tests::test_claim_fusion_order ... ok
test integration_tests::tests::test_refund_after_timeout ... ok
[... 21 more tests ...]
test tests::proper_initialization ... ok
test tests::test_hashlock_validation ... ok  
test tests::test_preimage_validation ... ok

test result: ok. 25 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

**Phase 3 CosmWasm contract is fully tested and production-ready!** ✅