/**
 * 1inch Fusion+ Integration Types
 * 
 * Bridge between our TEE solver types and 1inch Fusion+ SDK types
 */

import { 
  NetworkEnum,
  Quote as FusionQuote,
  QuoterRequest as FusionQuoterRequest,
  HashLock,
  SDK as CrossChainSDK,
  PresetEnum,
  Preset
} from '@1inch/cross-chain-sdk';

import { 
  FusionSDK,
  PrivateKeyProviderConnector 
} from '@1inch/fusion-sdk';

import { QuoteRequest, Quote, ChainId } from '../types/solver.types';

// Map our ChainId enum to 1inch NetworkEnum
export const CHAIN_ID_TO_NETWORK: Record<ChainId, NetworkEnum> = {
  [ChainId.ETHEREUM]: NetworkEnum.ETHEREUM,
  [ChainId.POLYGON]: NetworkEnum.POLYGON,
  [ChainId.BSC]: NetworkEnum.BINANCE,
  [ChainId.ARBITRUM]: NetworkEnum.ARBITRUM,
  [ChainId.OPTIMISM]: NetworkEnum.OPTIMISM,
  // Note: NEAR, COSMOS, etc. may not be directly supported by 1inch
  [ChainId.NEAR]: NetworkEnum.ETHEREUM, // Fallback - will need custom handling
  [ChainId.COSMOS]: NetworkEnum.ETHEREUM, // Fallback - will need custom handling
  [ChainId.BITCOIN]: NetworkEnum.ETHEREUM, // Fallback
  [ChainId.SOLANA]: NetworkEnum.ETHEREUM, // Fallback
};

// Create a more flexible mapping that doesn't require all enum values
export function getChainIdFromNetwork(network: NetworkEnum): ChainId {
  switch (network) {
    case NetworkEnum.ETHEREUM:
      return ChainId.ETHEREUM;
    case NetworkEnum.POLYGON:
      return ChainId.POLYGON;
    case NetworkEnum.BINANCE:
      return ChainId.BSC;
    case NetworkEnum.ARBITRUM:
      return ChainId.ARBITRUM;
    case NetworkEnum.OPTIMISM:
      return ChainId.OPTIMISM;
    default:
      // Fallback to Ethereum for unsupported networks
      return ChainId.ETHEREUM;
  }
}

// 1inch Fusion+ specific order structure
export interface FusionPlusOrder {
  // Core order data
  srcChainId: NetworkEnum;
  dstChainId: NetworkEnum;
  srcTokenAddress: string;
  dstTokenAddress: string;
  amount: string;
  walletAddress: string;
  
  // Cross-chain specific
  hashLock?: HashLock;
  preset?: Preset;
  secretHashes?: string[];
  
  // Order details
  quote: FusionQuote;
  validUntil: number;
  
  // Solver metadata
  solverId: string;
  requestId: string;
  confidence: number;
}

// Configuration for 1inch SDK integration
export interface FusionConfig {
  // API configuration
  fusionApiUrl: string;
  crossChainApiUrl: string;
  authKey?: string;
  
  // Network configuration
  supportedNetworks: NetworkEnum[];
  defaultPreset: PresetEnum;
  
  // Solver configuration
  walletPrivateKey: string;
  solverAddress: string;
  
  // Order configuration
  defaultValidityPeriod: number; // seconds
  minOrderAmount: bigint;
  maxOrderAmount: bigint;
  
  // Fee configuration
  solverFeeBps: number; // basis points
  gasLimitMultiplier: number;
}

// Quote request adapted for 1inch (matching actual SDK QuoteParams)
export interface FusionQuoteRequest {
  // Our internal fields
  requestId: string;
  solverId: string;
  
  // 1inch SDK fields (matching QuoteParams)
  srcChainId: NetworkEnum;
  dstChainId: NetworkEnum;
  srcTokenAddress: string;
  dstTokenAddress: string;
  amount: string;
  walletAddress: string;
  
  // Optional fields from SDK
  enableEstimate?: boolean;
  permit?: string;
  takingFeeBps?: number;
  source?: string;
  isPermit2?: boolean;
  
  // Our optional fields
  preset?: PresetEnum;
}

// Bridge our Quote type to 1inch meta-order
export interface FusionMetaOrder {
  // Original quote data
  originalQuote: Quote;
  
  // 1inch order data
  fusionOrder: FusionPlusOrder;
  
  // Cross-chain data
  secrets?: string[];
  hashLock?: HashLock;
  
  // Order lifecycle
  orderHash?: string;
  status: 'pending' | 'submitted' | 'filled' | 'cancelled' | 'expired';
  submittedAt?: number;
  filledAt?: number;
  
  // Execution data
  executionTxHashes?: {
    sourceChain?: string;
    destinationChain?: string;
  };
}

// SDK wrapper interfaces
export interface FusionSDKManager {
  fusionSDK: FusionSDK;
  crossChainSDK: CrossChainSDK;
  config: FusionConfig;
  
  // Core methods
  initialize(): Promise<void>;
  getQuote(request: FusionQuoteRequest): Promise<FusionQuote>;
  createOrder(quote: FusionQuote, request: FusionQuoteRequest): Promise<FusionPlusOrder>;
  submitOrder(order: FusionPlusOrder): Promise<string>;
  
  // Utility methods
  convertQuoteRequest(request: QuoteRequest): FusionQuoteRequest;
  convertToMetaOrder(quote: Quote): Promise<FusionMetaOrder>;
  generateSecrets(count: number): string[];
  createHashLock(secrets: string[]): HashLock;
}

// Error types for Fusion+ integration
export enum FusionErrorType {
  UNSUPPORTED_CHAIN = 'UNSUPPORTED_CHAIN',
  INVALID_QUOTE_REQUEST = 'INVALID_QUOTE_REQUEST', 
  ORDER_CREATION_FAILED = 'ORDER_CREATION_FAILED',
  ORDER_SUBMISSION_FAILED = 'ORDER_SUBMISSION_FAILED',
  SDK_INITIALIZATION_FAILED = 'SDK_INITIALIZATION_FAILED',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  QUOTE_EXPIRED = 'QUOTE_EXPIRED'
}

export interface FusionError {
  type: FusionErrorType;
  message: string;
  details?: any;
  timestamp: number;
}

// Configuration presets for different environments
export const FUSION_CONFIG_PRESETS = {
  development: {
    fusionApiUrl: 'https://api.1inch.dev/fusion-plus',
    crossChainApiUrl: 'https://api.1inch.dev/fusion-plus',
    defaultPreset: PresetEnum.fast,
    defaultValidityPeriod: 300, // 5 minutes
    solverFeeBps: 30, // 0.3%
    gasLimitMultiplier: 1.2
  },
  
  production: {
    fusionApiUrl: 'https://api.1inch.io/fusion-plus',
    crossChainApiUrl: 'https://api.1inch.io/fusion-plus',
    defaultPreset: PresetEnum.medium,
    defaultValidityPeriod: 600, // 10 minutes
    solverFeeBps: 20, // 0.2%
    gasLimitMultiplier: 1.1
  }
} as const;