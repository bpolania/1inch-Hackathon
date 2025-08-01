/**
 * Type definitions for NEAR Intents
 */

export type ChainId = 'bitcoin' | 'near' | 'ethereum';

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  chainId: ChainId;
  logoURI?: string;
  priceUSD?: number;
}

export interface IntentRequest {
  id: string;
  user: string;
  
  // What the user wants
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  minToAmount: string;
  
  // Preferences
  maxSlippage: number; // basis points
  deadline: number; // unix timestamp
  prioritize: 'speed' | 'cost' | 'security';
  
  // Optional metadata
  metadata?: {
    userAddress?: string;
    preferredRoute?: string;
    gasPrice?: string;
    tags?: string[];
  };
  
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  createdAt: number;
  updatedAt: number;
}

export interface ExecutionStep {
  stepId: number;
  chainId: ChainId;
  action: 'swap' | 'bridge' | 'transfer' | 'approve';
  protocol: string;
  description: string;
  
  tokenIn?: TokenInfo;
  tokenOut?: TokenInfo;
  amountIn?: string;
  amountOut?: string;
  
  gasEstimate?: string;
  estimatedTime?: number; // seconds
  
  status: 'pending' | 'executing' | 'completed' | 'failed';
  txHash?: string;
  completedAt?: number;
}

export interface SolverInfo {
  id: string;
  name: string;
  reputation: number; // 0-1 score
  totalVolume: number; // USD volume handled
  successRate: number; // 0-1 success rate
  avgExecutionTime: number; // seconds
  teeVerified: boolean;
  specialties: ChainId[]; // chains this solver specializes in
}

export interface SolverBid {
  id: string;
  solverId: string;
  intentId: string;
  outputAmount: string; // amount of output token offered
  executionTime: number; // estimated execution time in seconds
  gasCost: string; // estimated gas cost in USD
  confidence: number; // 0-1 confidence score
  route: string; // human readable route description
  timestamp: number;
  status: 'pending' | 'selected' | 'executing' | 'completed' | 'failed';
}

export interface SolverResponse {
  solverId: string;
  solverName: string;
  
  // Execution plan
  executionPlan: ExecutionStep[];
  
  // Estimates
  estimatedOutput: string;
  totalGasCost: string;
  estimatedTime: number; // seconds
  
  // Confidence and competitive factors
  confidence: number; // 0-100
  successRate: number; // historical success rate
  competitiveRank: number; // 1-N ranking
  
  // Security features
  teeVerified: boolean;
  chainSignatures: boolean;
  
  // Pricing
  solverFee: string;
  slippage: number;
  
  status: 'bidding' | 'selected' | 'executing' | 'completed' | 'failed';
  submittedAt: number;
}

export interface IntentSettlement {
  intentId: string;
  selectedSolver: SolverResponse;
  
  // Execution tracking
  currentStep: number;
  totalSteps: number;
  
  // Chain Signatures transactions
  chainSignatureTxs: {
    chain: ChainId;
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed';
    confirmations: number;
  }[];
  
  // Final results
  actualOutput?: string;
  actualGasCost?: string;
  actualExecutionTime?: number;
  
  status: 'initializing' | 'executing' | 'settling' | 'completed' | 'failed';
  completedAt?: number;
  error?: string;
}

export interface SolverStats {
  solverId: string;
  solverName: string;
  
  // Performance metrics
  totalIntents: number;
  successfulIntents: number;
  successRate: number;
  averageExecutionTime: number;
  averageGasCost: string;
  
  // Competitive metrics
  winRate: number; // percentage of competitions won
  averageRank: number;
  competitivenessScore: number;
  
  // Recent performance
  last24hIntents: number;
  last24hSuccessRate: number;
  currentUptime: number;
  
  // Special features
  teeVerified: boolean;
  chainSignatures: boolean;
  supportedChains: ChainId[];
  
  updatedAt: number;
}

export interface ChainStatus {
  chainId: ChainId;
  name: string;
  
  // Network status
  blockHeight: number;
  gasPrice: string;
  avgBlockTime: number;
  
  // Connection status
  rpcStatus: 'connected' | 'disconnected' | 'error';
  lastUpdate: number;
  
  // Chain specific data
  nativeToken: TokenInfo;
  supportedTokens: TokenInfo[];
  
  // Health metrics
  successRate: number;
  avgSettlementTime: number;
}

export interface UIState {
  // Current intent being created
  currentIntent: Partial<IntentRequest> | null;
  
  // Active competitions
  activeCompetitions: {
    intentId: string;
    solverResponses: SolverResponse[];
    timeRemaining: number;
  }[];
  
  // Settlement tracking
  activeSettlements: IntentSettlement[];
  
  // Solver performance data
  solverStats: SolverStats[];
  
  // Chain status
  chainStatuses: ChainStatus[];
  
  // User preferences
  userPreferences: {
    defaultPriority: 'speed' | 'cost' | 'security';
    defaultSlippage: number;
    showAdvanced: boolean;
    notifications: boolean;
  };
  
  // UI state
  isConnected: boolean;
  selectedSolver?: string;
  theme: 'light' | 'dark';
}