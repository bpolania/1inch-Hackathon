/**
 * 1inch Integration Types
 * Types and interfaces specific to 1inch protocol integration
 */

import { ChainId, TokenInfo as OneInchTokenInfo } from '@/services/oneinch';
import { TokenInfo, IntentRequest } from './intent';

// Extended types for 1inch integration
export interface OneInchQuoteRequest {
  chainId: ChainId;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  amount: string;
  slippage?: number;
  gasPrice?: string;
  userAddress?: string;
}

export interface OneInchQuoteResult {
  outputAmount: string;
  outputAmountUSD?: number;
  priceImpact: number;
  gas: string;
  gasPrice: string;
  estimatedGas: string;
  protocols: OneInchProtocolRoute[];
  route: string;
  confidence: number;
  executionTimeEstimate: number;
}

export interface OneInchProtocolRoute {
  name: string;
  part: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  subRoutes?: OneInchProtocolRoute[];
}

export interface OneInchSwapRequest extends OneInchQuoteRequest {
  userAddress: string;
  deadline?: number;
  referrer?: string;
  allowPartialFill?: boolean;
}

export interface OneInchSwapResult {
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: string;
  };
  outputAmount: string;
  protocols: OneInchProtocolRoute[];
  route: string;
}

// Relayer-specific types
export interface RelayerBid {
  id: string;
  intentId: string;
  solverId: string;
  sourceChain: ChainId;
  targetChain: ChainId;
  quote: OneInchQuoteResult;
  totalExecutionTime: number;
  totalGasCost: string;
  confidence: number;
  route: string;
  timestamp: number;
  status: 'pending' | 'selected' | 'executing' | 'completed' | 'failed';
  metadata?: {
    bridges?: string[];
    dexes?: string[];
    priceImpactWarning?: boolean;
    highGasWarning?: boolean;
  };
}

export interface RelayerExecution {
  bidId: string;
  intentId: string;
  status: 'initiated' | 'approving' | 'swapping' | 'bridging' | 'finalizing' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  transactions: RelayerTransaction[];
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface RelayerTransaction {
  id: string;
  type: 'approval' | 'swap' | 'bridge';
  chainId: ChainId;
  hash?: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  gasUsed?: string;
  gasPrice: string;
  blockNumber?: number;
  timestamp: number;
  error?: string;
}

// Chain mapping utilities
export interface ChainInfo {
  chainId: ChainId;
  name: string;
  symbol: string;
  decimals: number;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  oneInchSupported: boolean;
}

// Cross-chain routing types
export interface CrossChainRoute {
  sourceChain: ChainId;
  targetChain: ChainId;
  bridges: BridgeInfo[];
  estimatedTime: number;
  estimatedCost: string;
  steps: CrossChainStep[];
}

export interface BridgeInfo {
  name: string;
  protocol: string;
  fee: string;
  estimatedTime: number;
  security: 'high' | 'medium' | 'low';
  supportedTokens: string[];
}

export interface CrossChainStep {
  stepNumber: number;
  type: 'swap' | 'bridge' | 'wrap' | 'unwrap';
  chainId: ChainId;
  protocol: string;
  description: string;
  estimatedTime: number;
  estimatedGas: string;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  outputAmount: string;
}

// Solver integration types
export interface OneInchSolverConfig {
  enabled: boolean;
  priority: number;
  supportedChains: ChainId[];
  maxSlippage: number;
  maxGasPrice: string;
  minTradeSize: string;
  maxTradeSize: string;
  timeoutMs: number;
  retries: number;
  feeBps: number; // Fee in basis points
}

export interface OneInchSolverBid {
  solverId: string;
  intentId: string;
  quote: OneInchQuoteResult;
  crossChainRoute?: CrossChainRoute;
  totalTime: number;
  totalCost: string;
  confidence: number;
  metadata: {
    priceImprovement: number;
    gasOptimized: boolean;
    routeOptimality: number;
    liquidityScore: number;
  };
}

// Event types for real-time updates
export interface OneInchQuoteUpdate {
  intentId: string;
  bidId: string;
  newQuote: OneInchQuoteResult;
  priceChange: number;
  timestamp: number;
}

export interface OneInchExecutionUpdate {
  intentId: string;
  executionId: string;
  status: RelayerExecution['status'];
  currentStep: number;
  totalSteps: number;
  transactionHash?: string;
  error?: string;
  timestamp: number;
}

// API response wrapper types
export interface OneInchAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: number;
    executionTime: number;
  };
}

// Token list and price feed types
export interface OneInchTokenList {
  chainId: ChainId;
  tokens: Record<string, OneInchTokenInfo>;
  lastUpdated: number;
}

export interface OneInchPriceData {
  address: string;
  symbol: string;
  price: number;
  priceUSD: number;
  change24h: number;
  volume24h: number;
  marketCap?: number;
  lastUpdated: number;
}

// Configuration and settings
export interface OneInchConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout: number;
  retries: number;
  defaultSlippage: number;
  defaultGasBuffer: number;
  enableLogging: boolean;
  testMode: boolean;
  supportedChains: ChainId[];
}

// Utility types for better type safety
export type OneInchAddress = string;
export type OneInchAmount = string;
export type OneInchGasPrice = string;
export type OneInchTimestamp = number;

// Error types specific to 1inch integration
export interface OneInchError {
  code: 'INSUFFICIENT_LIQUIDITY' | 'HIGH_SLIPPAGE' | 'GAS_ESTIMATION_FAILED' | 'INVALID_TOKEN' | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN';
  message: string;
  details?: {
    chainId?: ChainId;
    tokenAddress?: string;
    amount?: string;
    slippage?: number;
    gasPrice?: string;
  };
  timestamp: number;
}

// Metrics and analytics types
export interface OneInchMetrics {
  totalQuotes: number;
  totalSwaps: number;
  totalVolume: string;
  totalVolumeUSD: number;
  averageSlippage: number;
  averageGasUsed: string;
  successRate: number;
  averageExecutionTime: number;
  topProtocols: Array<{
    name: string;
    usage: number;
    volume: string;
  }>;
  chainDistribution: Record<ChainId, {
    quotes: number;
    volume: string;
    successRate: number;
  }>;
}