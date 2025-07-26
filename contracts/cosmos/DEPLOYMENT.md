# FusionPlusCosmos CosmWasm Contract Deployment Guide

This document provides comprehensive instructions for deploying and testing the FusionPlusCosmos CosmWasm contract on Neutron and Juno testnets.

## Prerequisites

### 1. Development Environment

```bash
# Install Rust and WebAssembly target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install CosmWasm toolchain
cargo install cosmwasm-check

# Install network-specific CLIs
# For Neutron
wget https://github.com/neutron-org/neutron/releases/download/v2.0.0/neutrond-linux-amd64
chmod +x neutrond-linux-amd64
sudo mv neutrond-linux-amd64 /usr/local/bin/neutrond

# For Juno
wget https://github.com/CosmosContracts/juno/releases/download/v19.0.0/junod-linux-amd64
chmod +x junod-linux-amd64
sudo mv junod-linux-amd64 /usr/local/bin/junod
```

### 2. Docker (Recommended for Production)

```bash
# Install Docker for optimized builds
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 3. Development Setup

```bash
# Clone and setup
cd contracts/cosmos
make dev-setup
```

## Building the Contract

### Development Build

```bash
# Quick build for testing
make build

# Or manually
cargo build --release --target wasm32-unknown-unknown
```

### Production Build (Optimized)

```bash
# Using build script (recommended)
make optimize
# Or
./build.sh

# Manual Docker build
make docker-build
```

The optimized contract will be available at `./artifacts/fusion_plus_cosmos.wasm`.

## Testing

### Unit Tests

```bash
# Run all unit tests
make test

# Run specific test modules
cargo test test_instantiate
cargo test test_execute_fusion_order
cargo test test_claim_fusion_order
```

### Integration Tests

The contract includes comprehensive integration tests covering:

- Contract instantiation and configuration
- Resolver management (add/remove)
- Order execution with proper fund validation
- Order claiming with preimage verification  
- Order refunding after timeout
- Edge cases (zero amounts, large numbers, etc.)

```bash
# Run integration tests
make test-integration
```

## Deployment

### Wallet Setup

```bash
# Create deployment wallet
neutrond keys add fusion-deployer  # For Neutron
junod keys add fusion-deployer     # For Juno

# Get testnet tokens
# Neutron: https://faucet.pion-1.ntrn.tech/
# Juno: https://faucet.uni.junonetwork.io/
```

### Deploy to Neutron Testnet

```bash
# Deploy using script
make deploy-neutron
# Or
./deploy.sh neutron-testnet

# Custom wallet
./deploy.sh neutron-testnet --wallet my-wallet
```

### Deploy to Juno Testnet

```bash
# Deploy using script
make deploy-juno  
# Or
./deploy.sh juno-testnet
```

### Deployment Output

After successful deployment, you'll get:

```json
{
  "network": "neutron-testnet",
  "chain_id": "pion-1", 
  "code_id": 123,
  "contract_address": "neutron1...",
  "admin": "neutron1...",
  "deployed_at": "2024-01-01T00:00:00Z"
}
```

## Testing Deployed Contract

### Automated Integration Tests

```bash
# Test on Neutron
make test-neutron
# Or  
./test-integration.sh neutron-testnet

# Test on Juno
make test-juno
# Or
./test-integration.sh juno-testnet
```

### Manual Contract Interaction

#### Query Contract Configuration

```bash
neutrond query wasm contract-state smart $CONTRACT_ADDRESS \
  '{"config":{}}' \
  --node https://rpc-palvus.pion-1.ntrn.tech:443 \
  --chain-id pion-1
```

#### Add Authorized Resolver

```bash
neutrond tx wasm execute $CONTRACT_ADDRESS \
  '{"add_resolver":{"resolver":"neutron1..."}}' \
  --from fusion-deployer \
  --node https://rpc-palvus.pion-1.ntrn.tech:443 \
  --chain-id pion-1 \
  --gas-prices 0.01untrn \
  --gas auto \
  --gas-adjustment 1.3
```

#### Execute Fusion Order

```bash
neutrond tx wasm execute $CONTRACT_ADDRESS \
  '{
    "execute_fusion_order": {
      "order_hash": "0x123...",
      "hashlock": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
      "timelocks": "123456789",
      "maker": "neutron1...",
      "amount": "1000000",
      "resolver_fee": "50000", 
      "source_chain_id": 11155111,
      "timeout_seconds": 3600
    }
  }' \
  --amount 1100000untrn \
  --from fusion-resolver \
  --node https://rpc-palvus.pion-1.ntrn.tech:443 \
  --chain-id pion-1 \
  --gas-prices 0.01untrn \
  --gas auto \
  --gas-adjustment 1.3
```

#### Claim Order with Preimage

```bash
neutrond tx wasm execute $CONTRACT_ADDRESS \
  '{
    "claim_fusion_order": {
      "order_hash": "0x123...",
      "preimage": "hello"
    }
  }' \
  --from fusion-resolver \
  --node https://rpc-palvus.pion-1.ntrn.tech:443 \
  --chain-id pion-1 \
  --gas-prices 0.01untrn \
  --gas auto \
  --gas-adjustment 1.3
```

## Contract Features

### 1inch Fusion+ Compatibility

- **Order Hash Integration**: Uses 1inch order hashes for cross-chain coordination
- **Resolver Authorization**: Only authorized 1inch resolvers can execute orders
- **Safety Deposits**: Configurable safety deposit mechanism (default 5%)
- **Timelock Stages**: Compatible with 1inch timelock format

### HTLC Implementation

- **SHA-256 Hashlock**: Secure atomic swap coordination
- **Timeout Handling**: Automatic refunds after timelock expiry
- **Preimage Verification**: Cryptographic proof of order fulfillment

### CosmWasm Integration

- **Native Token Support**: Works with all Cosmos native tokens (untrn, ujuno, etc.)
- **Event Logging**: Comprehensive event emission for monitoring
- **Query Interface**: Rich query API for order management
- **State Management**: Efficient storage using cw-storage-plus

## Network Configuration

### Neutron Testnet (pion-1)

- **RPC**: https://rpc-palvus.pion-1.ntrn.tech:443
- **Chain ID**: pion-1
- **Native Denom**: untrn
- **Faucet**: https://faucet.pion-1.ntrn.tech/
- **Explorer**: https://neutron.celat.one/pion-1

### Juno Testnet (uni-6)

- **RPC**: https://rpc.uni.junonetwork.io:443  
- **Chain ID**: uni-6
- **Native Denom**: ujunox
- **Faucet**: https://faucet.uni.junonetwork.io/
- **Explorer**: https://testnet.mintscan.io/juno-testnet

## Security Considerations

### Contract Security

- **Admin-only Operations**: Critical functions require admin authorization
- **Resolver Authorization**: Whitelist-based resolver management  
- **Fund Validation**: Comprehensive safety deposit validation
- **Hashlock Security**: SHA-256 provides cryptographic security
- **Timelock Protection**: Prevents premature refunds

### Operational Security

- **Key Management**: Use hardware wallets for mainnet deployments
- **Multi-sig Admin**: Consider multi-signature admin for production
- **Monitoring**: Implement event monitoring for anomaly detection
- **Upgrades**: Contract is upgradeable by admin

## Troubleshooting

### Common Issues

1. **Insufficient Funds**: Ensure wallet has enough tokens for gas + safety deposits
2. **Invalid Hashlock**: Must be 64-character hex string (SHA-256 output)
3. **Unauthorized Resolver**: Only authorized resolvers can execute orders
4. **Timeout Expired**: Cannot claim after timeout, only refund

### Debug Commands

```bash
# Check wallet balance
neutrond query bank balances $(neutrond keys show wallet-name --address)

# Check contract admin
neutrond query wasm contract $CONTRACT_ADDRESS

# Check transaction details
neutrond query tx $TX_HASH
```

### Getting Help

- **Documentation**: /contracts/cosmos/README.md
- **Test Examples**: /contracts/cosmos/src/integration_tests.rs
- **Contract Source**: /contracts/cosmos/src/lib.rs

## Production Deployment

For mainnet deployment:

1. **Security Audit**: Complete security audit before mainnet
2. **Multi-sig Admin**: Use multi-signature admin account
3. **Monitoring**: Set up comprehensive monitoring
4. **Emergency Procedures**: Define incident response procedures
5. **Backup Plans**: Ensure contract upgrade/migration capabilities

## Support

This contract is part of the 1inch Fusion+ Cosmos extension. For technical support or questions, refer to the main project documentation or create an issue in the project repository.