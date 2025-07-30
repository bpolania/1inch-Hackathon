/**
 * TEE Solver Type Definitions
 * 
 * Core types for the 1inch Fusion+ TEE Solver
 * Based on NEAR Chain Signatures and Shade Agent Framework
 */

// Chain identifiers
export enum ChainId {
  ETHEREUM = 'ethereum',
  NEAR = 'near',
  BITCOIN = 'bitcoin',
  COSMOS = 'cosmos',
  SOLANA = 'solana',
  POLYGON = 'polygon',
  BSC = 'bsc',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism'
}

// Token information
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  chainId: ChainId;
  priceUSD?: number;
}

// Quote request from users via WebSocket
export interface QuoteRequest {
  id: string;
  timestamp: number;
  sourceChain: ChainId;
  destinationChain: ChainId;
  sourceToken: TokenInfo;
  destinationToken: TokenInfo;
  sourceAmount: bigint;
  destinationAmount?: bigint; // Optional - exact output requests
  userAddress: string;
  deadline: number;
  slippageTolerance?: number; // Basis points (100 = 1%)
  metadata?: {
    urgency?: 'low' | 'medium' | 'high';
    maxHops?: number;
    preferredDEXs?: string[];
  };
}

// Generated quote response
export interface Quote {
  requestId: string;
  solverId: string;
  timestamp: number;
  sourceAmount: bigint;
  destinationAmount: bigint;
  estimatedGasCost: bigint;
  solverFee: bigint;
  route: RouteStep[];
  estimatedExecutionTime: number; // seconds
  validUntil: number; // timestamp
  confidence: number; // 0-100, likelihood of successful execution
}

// Route step in cross-chain execution
export interface RouteStep {
  stepId: number;
  chainId: ChainId;
  protocol: string; // 'uniswap', '1inch', 'bridge', etc.
  action: 'swap' | 'bridge' | 'wrap' | 'unwrap';
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: bigint;
  amountOut: bigint;
  gasEstimate: bigint;
  data?: any; // Protocol-specific data
}

// 1inch Fusion+ Meta-Order
export interface FusionMetaOrder {
  orderHash: string;
  maker: string; // User address
  resolver: string; // Our solver address
  sourceChain: ChainId;
  destinationChain: ChainId;
  sourceToken: string;
  destinationToken: string;
  sourceAmount: bigint;
  destinationAmount: bigint;
  deadline: number;
  salt: string;
  executionSteps: ExecutionStep[];
  constraints: SolverConstraints;
  signature?: string; // Added by Chain Signatures
}

// Execution step in meta-order
export interface ExecutionStep {
  stepId: number;
  chainId: ChainId;
  contractAddress: string;
  methodName: string;
  parameters: any[];
  value?: bigint; // ETH value if needed
  gasLimit: bigint;
  dependencies?: number[]; // Step IDs that must complete first
}

// Solver constraints and conditions
export interface SolverConstraints {
  maxExecutionTime: number; // seconds
  maxGasPrice: bigint;
  minDestinationAmount: bigint;
  allowedSlippage: number; // basis points
  requiredConfirmations: number;
  fallbackEnabled: boolean;
}

// Chain Signatures types
export interface ChainSignatureRequest {
  payload: string; // Transaction hash or data
  path: string; // Derivation path
  domainId: number; // 0 for Secp256k1, 1 for Ed25519
}

export interface ChainSignatureResponse {
  signature: string;
  publicKey: string;
  recoveryId?: number;
}

// WebSocket message types
export enum MessageType {
  QUOTE_REQUEST = 'quote_request',
  QUOTE_RESPONSE = 'quote_response',
  ORDER_CREATED = 'order_created',
  ORDER_EXECUTED = 'order_executed',
  ORDER_FAILED = 'order_failed',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error'
}

export interface WebSocketMessage {
  type: MessageType;
  id: string;
  timestamp: number;
  data: any;
}

// Solver configuration
export interface SolverConfig {
  // Identity
  solverId: string;
  nearAccount: string;
  
  // Network
  relayUrl: string;
  supportedChains: ChainId[];
  
  // Business logic
  defaultMarginBps: number; // Basis points
  maxQuoteAge: number; // seconds
  minProfitThreshold: bigint;
  
  // Performance
  maxConcurrentQuotes: number;
  quoteTimeoutMs: number;
  
  // TEE
  teeEnabled: boolean;
  attestationUrl?: string;
}

// Liquidity source information
export interface LiquiditySource {
  protocol: string;
  poolAddress: string;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  reserveA: bigint;
  reserveB: bigint;
  fee: number; // basis points
  lastUpdated: number;
}

// Bridge information for cross-chain
export interface BridgeInfo {
  name: string;
  sourceChain: ChainId;
  destinationChain: ChainId;
  fee: bigint;
  minAmount: bigint;
  maxAmount: bigint;
  estimatedTime: number; // seconds
  reliability: number; // 0-100 score
}

// Solver status and metrics
export interface SolverStatus {
  isRunning: boolean;
  isConnected: boolean;
  lastHeartbeat: number;
  quotesGenerated: number;
  ordersExecuted: number;
  successRate: number;
  averageExecutionTime: number;
  currentProfit: bigint;
  supportedChains: ChainId[];
}

// Error types
export enum SolverErrorType {
  CONNECTION_ERROR = 'connection_error',
  QUOTE_GENERATION_ERROR = 'quote_generation_error',
  SIGNATURE_ERROR = 'signature_error',
  EXECUTION_ERROR = 'execution_error',
  VALIDATION_ERROR = 'validation_error',
  TIMEOUT_ERROR = 'timeout_error'
}

export interface SolverError {
  type: SolverErrorType;
  message: string;
  code?: string;
  details?: any;
  timestamp: number;
}

// Event types for the solver
export enum SolverEventType {
  QUOTE_REQUESTED = 'quote_requested',
  QUOTE_GENERATED = 'quote_generated',
  ORDER_MATCHED = 'order_matched',
  EXECUTION_STARTED = 'execution_started',
  EXECUTION_COMPLETED = 'execution_completed',
  EXECUTION_FAILED = 'execution_failed',
  CONNECTION_ESTABLISHED = 'connection_established',
  CONNECTION_LOST = 'connection_lost'
}

export interface SolverEvent {
  type: SolverEventType;
  timestamp: number;
  data: any;
}

// Chain-specific adapter interface
export interface ChainAdapter {
  chainId: ChainId;
  
  // Token operations
  getTokenInfo(address: string): Promise<TokenInfo>;
  getTokenBalance(address: string, tokenAddress: string): Promise<bigint>;
  
  // Price and liquidity
  getTokenPrice(tokenAddress: string): Promise<number>;
  getLiquiditySources(tokenA: string, tokenB: string): Promise<LiquiditySource[]>;
  
  // Gas estimation
  estimateGasPrice(): Promise<bigint>;
  estimateGasCost(operation: string, data?: any): Promise<bigint>;
  
  // Transaction building
  buildSwapTransaction(params: SwapParams): Promise<any>;
  buildBridgeTransaction(params: BridgeParams): Promise<any>;
  
  // Address derivation for Chain Signatures
  deriveAddress(nearAccount: string, path?: string): Promise<string>;
}

// Transaction parameters
export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOutMin: bigint;
  to: string;
  deadline: number;
}

export interface BridgeParams {
  sourceToken: string;
  destinationToken: string;
  amount: bigint;
  destinationChain: ChainId;
  recipient: string;
}

// Utility types
export type Address = string;
export type Hash = string;
export type Signature = string;

// Re-export commonly used types
export * from './solver.types';