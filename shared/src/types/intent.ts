import { ChainId } from './chains';

export interface TokenInfo {
  chainId: ChainId;
  address: string; // Use 'native' for native tokens
  symbol: string;
  decimals: number;
}

export enum IntentStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  LOCKED = 'LOCKED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface SwapIntent {
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

export interface SignedIntent {
  intent: SwapIntent;
  signature: string; // EIP-712 signature
}

export interface IntentQuote {
  sourceChain: ChainId;
  sourceToken: string;
  sourceAmount: string;
  destinationChain: ChainId;
  destinationToken: string;
  estimatedDestinationAmount: string;
  suggestedResolverFee: string;
  suggestedSlippageBps: number;
  estimatedExecutionTime: number; // seconds
  priceImpact: number; // percentage
}

export interface IntentFilter {
  sourceChain?: ChainId;
  destinationChain?: ChainId;
  sourceToken?: string;
  destinationToken?: string;
  minSourceAmount?: string;
  maxSourceAmount?: string;
  minResolverFee?: string;
  status?: IntentStatus[];
  maker?: string;
  executor?: string;
}

export interface IntentMatchingCriteria {
  minProfitability: number; // Minimum profit in USD
  maxGasPrice: string; // Maximum gas price willing to pay
  supportedChains: ChainId[];
  maxExecutionTime: number; // Maximum seconds to complete swap
}

export const EIP712_DOMAIN = {
  name: '1inch Cross-Chain Swap',
  version: '1',
  verifyingContract: '0x0000000000000000000000000000000000000000', // To be updated
} as const;

export const INTENT_TYPE = {
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
} as const;