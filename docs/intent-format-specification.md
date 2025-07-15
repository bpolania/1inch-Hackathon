# Intent Format Specification

## Overview

This document defines the format for cross-chain swap intents in the 1inch Cross-Chain system. Intents are signed off-chain messages that express a user's desire to perform an atomic swap between different blockchain networks.

## Intent Schema

### SwapIntent Interface

```typescript
interface SwapIntent {
  // Unique identifier
  intentId: string;
  
  // User creating the intent
  maker: string;
  
  // Source (what user is offering)
  sourceChain: ChainId;
  sourceToken: TokenInfo;
  sourceAmount: string; // BigNumber as string
  
  // Destination (what user wants)
  destinationChain: ChainId;
  destinationToken: TokenInfo;
  destinationAmount: string; // BigNumber as string
  
  // Destination address (can be different from maker)
  destinationAddress: string;
  
  // Slippage tolerance (basis points, e.g., 50 = 0.5%)
  slippageBps: number;
  
  // Resolver fee offered to executor (in source token)
  resolverFeeAmount: string;
  
  // Timing
  createdAt: number; // Unix timestamp
  expiryTime: number; // Unix timestamp
  
  // HTLC parameters (set when matched)
  hashlock?: string; // Hash for HTLC
  timelock?: number; // Timelock duration in seconds
  
  // Status tracking
  status: IntentStatus;
  
  // Executor info (set when matched)
  executor?: string;
  
  // Transaction hashes for tracking
  sourceLockTxHash?: string;
  destinationLockTxHash?: string;
  sourceClaimTxHash?: string;
  destinationClaimTxHash?: string;
}
```

### Supporting Types

#### ChainId
Enum defining supported blockchain networks:
- **EVM Chains**: `ETHEREUM_MAINNET = 1`, `ETHEREUM_SEPOLIA = 11155111`
- **Aptos**: `APTOS_MAINNET = 10001`, `APTOS_TESTNET = 10002`
- **Bitcoin-compatible**: `BITCOIN_MAINNET = 20001`, `DOGECOIN_MAINNET = 20003`, etc.
- **Cosmos**: `COSMOS_HUB_MAINNET = 30001`, `COSMOS_HUB_TESTNET = 30002`

#### TokenInfo
```typescript
interface TokenInfo {
  chainId: ChainId;
  address: string; // Use 'native' for native tokens
  symbol: string;
  decimals: number;
}
```

#### IntentStatus
```typescript
enum IntentStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  LOCKED = 'LOCKED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}
```

## EIP-712 Signature Format

Intents are signed using EIP-712 structured data signing for security and standardization.

### Domain Definition
```typescript
const EIP712_DOMAIN = {
  name: '1inch Cross-Chain Swap',
  version: '1',
  chainId: 1, // Can be overridden per signature
  verifyingContract: '0x0000000000000000000000000000000000000000', // Updated per deployment
}
```

### Message Type
```typescript
const INTENT_TYPE = {
  SwapIntent: [
    { name: 'intentId', type: 'string' },
    { name: 'maker', type: 'address' },
    { name: 'sourceChain', type: 'uint256' },
    { name: 'sourceToken', type: 'address' },
    { name: 'sourceAmount', type: 'uint256' },
    { name: 'destinationChain', type: 'uint256' },
    { name: 'destinationToken', type: 'address' },
    { name: 'destinationAmount', type: 'uint256' },
    { name: 'destinationAddress', type: 'string' },
    { name: 'slippageBps', type: 'uint16' },
    { name: 'resolverFeeAmount', type: 'uint256' },
    { name: 'expiryTime', type: 'uint256' },
  ],
}
```

## Validation Rules

### Required Fields
All fields in the `SwapIntent` interface marked as required must be present and valid.

### Amount Validation
- All amounts must be positive integers represented as strings
- Amounts must be within reasonable bounds (e.g., > $10, < $1M USD equivalent)
- Resolver fee must be between 0.1% and 5% of source amount

### Address Validation
- **EVM**: Must match `^0x[a-fA-F0-9]{40}$`
- **Aptos**: Must match `^0x[a-fA-F0-9]{1,64}$`
- **Bitcoin**: Standard Bitcoin address format (26-62 characters)
- **Cosmos**: Bech32 format `^[a-z]+1[a-z0-9]{38,}$`

### Timing Validation
- `expiryTime` must be between 5 minutes and 24 hours from creation
- Must allow sufficient time for cross-chain execution

### Slippage Validation
- Must be between 0.1% (10 basis points) and 10% (1000 basis points)

## Examples

### ETH to BTC Swap
```typescript
{
  intentId: "0x1234...abcd",
  maker: "0x1234567890123456789012345678901234567890",
  sourceChain: ChainId.ETHEREUM_MAINNET,
  sourceToken: {
    chainId: ChainId.ETHEREUM_MAINNET,
    address: "native",
    symbol: "ETH",
    decimals: 18
  },
  sourceAmount: "1000000000000000000", // 1 ETH
  destinationChain: ChainId.BITCOIN_MAINNET,
  destinationToken: {
    chainId: ChainId.BITCOIN_MAINNET,
    address: "native",
    symbol: "BTC",
    decimals: 8
  },
  destinationAmount: "2500000", // 0.025 BTC
  destinationAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  slippageBps: 50, // 0.5%
  resolverFeeAmount: "3000000000000000", // 0.003 ETH
  createdAt: 1641234567,
  expiryTime: 1641238167, // 1 hour later
  status: IntentStatus.PENDING
}
```

### USDC to APT Swap
```typescript
{
  intentId: "0x5678...efgh",
  maker: "0x2345678901234567890123456789012345678901",
  sourceChain: ChainId.ETHEREUM_MAINNET,
  sourceToken: {
    chainId: ChainId.ETHEREUM_MAINNET,
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6
  },
  sourceAmount: "1000000000", // 1000 USDC
  destinationChain: ChainId.APTOS_MAINNET,
  destinationToken: {
    chainId: ChainId.APTOS_MAINNET,
    address: "native",
    symbol: "APT",
    decimals: 8
  },
  destinationAmount: "12500000000", // 125 APT
  destinationAddress: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  slippageBps: 100, // 1%
  resolverFeeAmount: "5000000", // 5 USDC
  createdAt: 1641234567,
  expiryTime: 1641238167,
  status: IntentStatus.PENDING
}
```

## Implementation Guidelines

### Intent ID Generation
- Use cryptographically secure random 32-byte values
- Format as hex string with '0x' prefix
- Must be unique across all intents

### Signature Generation
1. Format intent for EIP-712 signing (exclude runtime fields)
2. Use appropriate domain separator with chain ID
3. Sign with user's private key
4. Store signature alongside intent

### Signature Verification
1. Extract structured data from intent
2. Verify signature matches maker address
3. Validate intent parameters
4. Check expiry and status

## Security Considerations

### Replay Protection
- Each intent must have unique `intentId`
- Include `expiryTime` to prevent indefinite validity
- Validate chain ID in domain separator

### Front-running Protection
- Use commit-reveal schemes where applicable
- Consider MEV protection mechanisms
- Implement proper ordering in marketplace

### Validation Requirements
- Always validate signature before processing
- Check all amounts and addresses
- Verify chain compatibility
- Ensure reasonable fee structures

## Versioning

This specification is version 1.0. Future versions will:
- Maintain backward compatibility where possible
- Update version in EIP-712 domain
- Document migration procedures

## Integration

### Client Libraries
Use the provided TypeScript library from `@1inch-cross-chain/shared`:

```typescript
import { 
  createIntent, 
  signIntentWithPrivateKey,
  validateSignedIntent
} from '@1inch-cross-chain/shared';
```

### API Integration
Submit signed intents to the marketplace API:

```typescript
POST /api/intents
{
  "intent": { /* SwapIntent object */ },
  "signature": "0x..."
}
```

Query intents:
```typescript
GET /api/intents?sourceChain=1&destinationChain=20001
```