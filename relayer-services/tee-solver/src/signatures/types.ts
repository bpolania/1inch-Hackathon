/**
 * Chain Signatures Types and Configuration
 * 
 * Type definitions for NEAR Chain Signatures MPC integration
 * supporting multi-chain transaction signing for TEE environments.
 */

import { ChainId as SolverChainId } from '../types/solver.types';

// Re-export and extend chain IDs for Chain Signatures
export { ChainId } from './ChainSignatureManager';

// Configuration presets for different environments
export const CHAIN_SIGNATURE_CONFIG_PRESETS = {
  development: {
    nearNetwork: 'testnet' as const,
    mpcContractId: 'v1.signer-dev',
    derivationPath: 'test-solver',
    supportedChains: ['ethereum', 'polygon'] as const
  },
  
  production: {
    nearNetwork: 'mainnet' as const,
    mpcContractId: 'v1.signer',
    derivationPath: 'fusion-solver',
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc'] as const
  }
} as const;

// Map solver chain IDs to Chain Signature chain IDs
export const SOLVER_TO_CHAIN_SIG_MAPPING: Record<SolverChainId, string> = {
  [SolverChainId.ETHEREUM]: 'ethereum',
  [SolverChainId.POLYGON]: 'polygon',
  [SolverChainId.BSC]: 'bsc',
  [SolverChainId.ARBITRUM]: 'arbitrum',
  [SolverChainId.OPTIMISM]: 'optimism',
  [SolverChainId.NEAR]: 'near',
  [SolverChainId.COSMOS]: 'cosmos',
  [SolverChainId.BITCOIN]: 'bitcoin',
  [SolverChainId.SOLANA]: 'solana'
};

// Chain-specific transaction interfaces
export interface EVMTransaction {
  to: string;
  value: string;
  data: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce: number;
  chainId: number;
}

export interface BitcoinTransaction {
  inputs: Array<{
    txid: string;
    vout: number;
    scriptSig: string;
  }>;
  outputs: Array<{
    address: string;
    amount: number;
  }>;
  lockTime?: number;
}

export interface SolanaTransaction {
  recentBlockhash: string;
  instructions: Array<{
    programId: string;
    accounts: Array<{
      pubkey: string;
      isSigner: boolean;
      isWritable: boolean;
    }>;
    data: string;
  }>;
  feePayer: string;
}

// Union type for all supported transaction types
export type ChainTransaction = EVMTransaction | BitcoinTransaction | SolanaTransaction;

// Signature verification interface
export interface SignatureVerification {
  isValid: boolean;
  recoveredAddress?: string;
  error?: string;
}

// Chain Signature error types
export enum ChainSignatureErrorType {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  UNSUPPORTED_CHAIN = 'UNSUPPORTED_CHAIN',
  SIGNATURE_REQUEST_FAILED = 'SIGNATURE_REQUEST_FAILED',
  MPC_CONTRACT_ERROR = 'MPC_CONTRACT_ERROR',
  TRANSACTION_SERIALIZATION_ERROR = 'TRANSACTION_SERIALIZATION_ERROR',
  ADDRESS_DERIVATION_ERROR = 'ADDRESS_DERIVATION_ERROR',
  NEAR_CONNECTION_ERROR = 'NEAR_CONNECTION_ERROR'
}

export interface ChainSignatureError {
  type: ChainSignatureErrorType;
  message: string;
  details?: any;
  timestamp: number;
  requestId?: string;
}

// Integration interfaces for Fusion+ orders
export interface FusionOrderSigningRequest {
  orderId: string;
  targetChain: string;
  orderData: any;
  solverAddress: string;
  requiresSignature: boolean;
}

export interface FusionOrderSigningResponse {
  orderId: string;
  signedOrder: any;
  signature: string;
  solverAddress: string;
  timestamp: number;
}

// TEE-specific configuration
export interface TEEChainSignatureConfig {
  // TEE attestation configuration
  attestationRequired: boolean;
  attestationProvider?: 'intel-sgx' | 'amd-sev' | 'azure-confidential';
  
  // Enhanced security settings
  keyRotationInterval?: number; // hours
  signatureValidationLevel: 'basic' | 'enhanced' | 'maximum';
  
  // Monitoring and logging
  auditLogging: boolean;
  performanceMetrics: boolean;
  
  // Failover configuration
  fallbackToLocalSigning?: boolean;
  maxRetryAttempts: number;
}

// Statistics and monitoring interfaces
export interface ChainSignatureStats {
  signaturesRequested: number;
  signaturesCompleted: number;
  signaturesFailed: number;
  averageSigningTime: number;
  successRate: number;
  supportedChains: string[];
  isInitialized: boolean;
  
  // Chain-specific stats
  chainStats: Record<string, {
    signatures: number;
    failures: number;
    averageTime: number;
  }>;
}

// Event interfaces
export interface ChainSignatureEvents {
  initialized: () => void;
  signature_requested: (request: { requestId: string; targetChain: string }) => void;
  signature_completed: (response: { requestId: string; targetChain: string; signingTime: number }) => void;
  signature_failed: (error: { requestId: string; error: ChainSignatureError }) => void;
  address_derived: (data: { targetChain: string; address: string; derivationPath: string }) => void;
  error: (error: ChainSignatureError) => void;
}

// Utility type for chain signature manager options
export interface ChainSignatureManagerOptions {
  maxConcurrentSignatures?: number;
  signatureTimeout?: number; // milliseconds
  retryAttempts?: number;
  retryDelay?: number; // milliseconds
  enableCaching?: boolean;
  cacheExpirationTime?: number; // milliseconds
}

// Default configuration values
export const DEFAULT_CHAIN_SIGNATURE_OPTIONS: ChainSignatureManagerOptions = {
  maxConcurrentSignatures: 10,
  signatureTimeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  enableCaching: true,
  cacheExpirationTime: 300000 // 5 minutes
};

// Supported signature schemes
export const SIGNATURE_SCHEMES = {
  secp256k1: {
    domainId: 0,
    supportedChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'bitcoin'],
    keyLength: 32,
    signatureLength: 64
  },
  ed25519: {
    domainId: 1,
    supportedChains: ['solana', 'near'],
    keyLength: 32,
    signatureLength: 64
  }
} as const;

// Chain-specific network configurations
export const CHAIN_NETWORK_CONFIG = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  bsc: {
    name: 'BNB Smart Chain',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }
  }
} as const;