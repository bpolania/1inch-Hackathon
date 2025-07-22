# Sepolia Testnet Deployment Guide

This guide explains how to deploy and test the cross-chain atomic swap contracts on Sepolia testnet.

## Prerequisites

1. **Sepolia ETH** - Get from [Sepolia Faucet](https://sepoliafaucet.com/)
   - Need ~0.05 ETH for contract deployment
   - Need additional ETH for transaction fees

2. **Testnet Tokens** - Required for testing swaps:
   - **Sepolia USDC**: Get from [Circle Faucet](https://faucet.circle.com/)
   - **Sepolia DAI**: Available from various faucets
   - Need at least 10 tokens for demo

3. **Environment Setup**:
   ```bash
   # .env file should contain:
   PRIVATE_KEY=your_private_key_here
   SEPOLIA_RPC_URL=your_alchemy_or_infura_url
   ETHERSCAN_API_KEY=your_etherscan_key_for_verification
   ```

## Deployment Steps

### 1. Deploy Contracts to Sepolia

```bash
npm run demo:sepolia
```

This will:
- Deploy CrossChainFactory to Sepolia
- Connect to existing testnet tokens (USDC/DAI)
- Check token balances
- Create a sample intent
- Save deployment info to `deployments-sepolia.json`

### 2. Verify Contracts

```bash
# After successful deployment
npx hardhat verify --network sepolia <FACTORY_ADDRESS>
```

### 3. Check Deployment

View your contracts on [Sepolia Etherscan](https://sepolia.etherscan.io/)

## Key Differences from Local Demo

| Aspect | Local Demo | Sepolia Demo |
|--------|------------|--------------|
| **Token Supply** | Mints unlimited test tokens | Uses existing testnet token balance |
| **Amount** | 100 USDC | 10 USDC (reduced for testnet) |
| **Gas Costs** | Free | Real ETH required |
| **Speed** | Instant blocks | ~12 second blocks |
| **Persistence** | Ephemeral | Permanent on testnet |

## Testnet Token Addresses

- **USDC**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **DAI**: `0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357`

## Troubleshooting

### "Insufficient ETH balance"
- Get more Sepolia ETH from faucets
- Reduce gas limit if needed

### "Insufficient token balance"
- Get testnet tokens from faucets
- Check token contract addresses are correct
- Verify tokens are in the correct wallet

### "Transaction failed"
- Check gas price (may need to increase during high network usage)
- Verify all addresses are correct
- Ensure sufficient ETH for gas

## Gas Estimates

| Operation | Est. Gas | Est. Cost (20 gwei) |
|-----------|----------|---------------------|
| Deploy Factory | ~2.5M | ~0.05 ETH |
| Create Intent | ~150K | ~0.003 ETH |
| Match Intent | ~3M | ~0.06 ETH |
| Lock Tokens | ~100K | ~0.002 ETH |

## Next Steps After Deployment

1. **Fund Resolver**: Send testnet tokens to resolver address
2. **Test Matching**: Have resolver match the created intent
3. **Complete Swap**: Test the full atomic swap flow
4. **Monitor**: Watch transactions on Sepolia Etherscan

## Production Considerations

- Use multisig for factory owner on mainnet
- Implement proper access controls
- Set up monitoring and alerting
- Consider gas optimization for high-volume usage