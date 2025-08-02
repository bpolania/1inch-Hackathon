/**
 * 1inch API Service Layer
 * Provides integration with 1inch aggregation protocol for cross-chain swaps
 */

import { useState } from 'react';

// API Gateway configuration - routes through our backend for enhanced caching and error handling
const API_GATEWAY_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3001';
const ONEINCH_API_BASE = `${API_GATEWAY_BASE_URL}/api/1inch`;
const FALLBACK_ONEINCH_BASE_URL = 'https://api.1inch.dev';
const ONEINCH_API_VERSION = 'v6.0';

// Supported chain IDs for 1inch
export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  BSC: 56,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  AVALANCHE: 43114,
  GNOSIS: 100,
  FANTOM: 250,
  KLAYTN: 8217,
  AURORA: 1313161554,
  ZK_SYNC_ERA: 324,
  BASE: 8453,
} as const;

export type ChainId = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS];

// 1inch API Types
export interface TokenInfo {
  address: string;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
}

export interface QuoteParams {
  src: string; // Token address to swap from
  dst: string; // Token address to swap to
  amount: string; // Amount to swap (in wei)
  fee?: string; // Fee percentage (0-3)
  gasPrice?: string; // Gas price in wei
  complexityLevel?: string; // 0, 1, 2, or 3
  parts?: string; // Number of parts to split the swap
  mainRouteParts?: string; // Number of main route parts
  gasLimit?: string; // Gas limit for the swap
  includeTokensInfo?: boolean;
  includeProtocols?: boolean;
  includeGas?: boolean;
  connectorTokens?: string; // Comma-separated list of connector token addresses
}

export interface QuoteResponse {
  dstAmount: string; // Expected output amount
  srcAmount: string; // Input amount
  protocols: Protocol[][];
  gas?: string;
  gasPrice?: string;
  toToken: TokenInfo;
  fromToken: TokenInfo;
}

export interface Protocol {
  name: string;
  part: number;
  fromTokenAddress: string;
  toTokenAddress: string;
}

export interface SwapParams extends QuoteParams {
  from: string; // Wallet address
  slippage: number; // Slippage tolerance (1-50)
  disableEstimate?: boolean;
  allowPartialFill?: boolean;
  referrer?: string;
}

export interface SwapResponse {
  dstAmount: string;
  srcAmount: string;
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: string;
  };
  protocols: Protocol[][];
  toToken: TokenInfo;
  fromToken: TokenInfo;
}

export interface ApprovalParams {
  tokenAddress: string;
  amount?: string; // Optional, defaults to unlimited approval
}

export interface ApprovalResponse {
  data: string;
  gasPrice: string;
  to: string;
  value: string;
}

// Error types for 1inch API
export class OneInchAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'OneInchAPIError';
  }
}

/**
 * 1inch API Service
 * Handles all interactions with the 1inch aggregation protocol
 */
export class OneInchService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.baseUrl = `${ONEINCH_BASE_URL}/${ONEINCH_API_VERSION}`;
    this.apiKey = apiKey;
  }

  /**
   * Build headers for API requests
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Make API request with error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.buildHeaders(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new OneInchAPIError(
          `1inch API error: ${response.status} ${response.statusText}`,
          response.status,
          errorData
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof OneInchAPIError) {
        throw error;
      }
      
      throw new OneInchAPIError(
        `Network error when calling 1inch API: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get supported tokens for a chain
   */
  async getTokens(chainId: ChainId): Promise<Record<string, TokenInfo>> {
    return this.makeRequest<Record<string, TokenInfo>>(`/${chainId}/tokens`);
  }

  /**
   * Get quote for a swap
   */
  async getQuote(chainId: ChainId, params: QuoteParams): Promise<QuoteResponse> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    return this.makeRequest<QuoteResponse>(`/${chainId}/quote?${searchParams}`);
  }

  /**
   * Get swap transaction data
   */
  async getSwap(chainId: ChainId, params: SwapParams): Promise<SwapResponse> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    return this.makeRequest<SwapResponse>(`/${chainId}/swap?${searchParams}`);
  }

  /**
   * Get approval transaction data
   */
  async getApproval(chainId: ChainId, params: ApprovalParams): Promise<ApprovalResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append('tokenAddress', params.tokenAddress);
    
    if (params.amount) {
      searchParams.append('amount', params.amount);
    }

    return this.makeRequest<ApprovalResponse>(`/${chainId}/approve/transaction?${searchParams}`);
  }

  /**
   * Get spender address for approvals
   */
  async getSpender(chainId: ChainId): Promise<{ address: string }> {
    return this.makeRequest<{ address: string }>(`/${chainId}/approve/spender`);
  }

  /**
   * Check if token needs approval
   */
  async checkAllowance(
    chainId: ChainId,
    tokenAddress: string,
    walletAddress: string
  ): Promise<{ allowance: string }> {
    const searchParams = new URLSearchParams();
    searchParams.append('tokenAddress', tokenAddress);
    searchParams.append('walletAddress', walletAddress);

    return this.makeRequest<{ allowance: string }>(`/${chainId}/approve/allowance?${searchParams}`);
  }

  /**
   * Get aggregated liquidity sources
   */
  async getLiquiditySources(chainId: ChainId): Promise<Record<string, any>> {
    return this.makeRequest<Record<string, any>>(`/${chainId}/liquidity-sources`);
  }

  /**
   * Health check for the API
   */
  async healthCheck(chainId: ChainId): Promise<{ status: string }> {
    return this.makeRequest<{ status: string }>(`/${chainId}/healthcheck`);
  }
}

// Utility functions for working with 1inch

/**
 * Convert amount to wei (assumes 18 decimals by default)
 */
export function toWei(amount: string | number, decimals: number = 18): string {
  const factor = BigInt(10) ** BigInt(decimals);
  const amountBigInt = BigInt(Math.floor(Number(amount) * Number(factor)));
  return amountBigInt.toString();
}

/**
 * Convert wei to human readable amount
 */
export function fromWei(amount: string, decimals: number = 18): string {
  const factor = BigInt(10) ** BigInt(decimals);
  const amountBigInt = BigInt(amount);
  const result = Number(amountBigInt) / Number(factor);
  return result.toString();
}

/**
 * Get native token address for chain (used for ETH, MATIC, etc.)
 */
export function getNativeTokenAddress(): string {
  return '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
}

/**
 * Check if address is native token
 */
export function isNativeToken(address: string): boolean {
  return address.toLowerCase() === getNativeTokenAddress().toLowerCase();
}

/**
 * Format 1inch protocol route for display
 */
export function formatProtocolRoute(protocols: Protocol[][]): string {
  if (protocols.length === 0) return 'Direct';
  
  const firstRoute = protocols[0];
  if (firstRoute.length === 0) return 'Direct';
  
  const protocolNames = firstRoute.map(p => p.name);
  return protocolNames.join(' → ');
}

/**
 * Calculate price impact from quote
 */
export function calculatePriceImpact(
  inputAmount: string,
  outputAmount: string,
  inputPrice: number,
  outputPrice: number
): number {
  const expectedOutput = (Number(inputAmount) * inputPrice) / outputPrice;
  const actualOutput = Number(outputAmount);
  const impact = ((expectedOutput - actualOutput) / expectedOutput) * 100;
  return Math.max(0, impact);
}

/**
 * Enhanced Quote Service for UI Integration
 * Provides real-time quote functionality with caching and error handling
 */
export class OneInchQuoteService {
  private service: OneInchService;
  private quotesCache = new Map<string, { quote: QuoteResponse; timestamp: number }>();
  private readonly CACHE_TTL = 10000; // 10 seconds

  constructor(apiKey?: string) {
    this.service = new OneInchService(apiKey);
  }

  /**
   * Get real-time quote with caching
   */
  async getQuoteWithCache(
    chainId: ChainId,
    fromToken: string,
    toToken: string,
    amount: string,
    options: Partial<QuoteParams> = {}
  ): Promise<QuoteResponse | null> {
    const cacheKey = `${chainId}-${fromToken}-${toToken}-${amount}`;
    const cached = this.quotesCache.get(cacheKey);
    
    // Return cached quote if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.quote;
    }

    try {
      const quote = await this.service.getQuote(chainId, {
        src: fromToken,
        dst: toToken,
        amount,
        includeTokensInfo: true,
        includeGas: true,
        ...options
      });

      // Cache the quote
      this.quotesCache.set(cacheKey, {
        quote,
        timestamp: Date.now()
      });

      return quote;
    } catch (error) {
      console.error('Failed to get 1inch quote:', error);
      return null;
    }
  }

  /**
   * Get quote for UI display (formatted)
   */
  async getUIQuote(
    chainId: ChainId,
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number = 1
  ): Promise<{
    outputAmount: string;
    formattedOutput: string;
    priceImpact: number;
    route: string;
    gasEstimate: string;
    gasPrice: string;
    protocols: string[];
    confidence: number;
  } | null> {
    const quote = await this.getQuoteWithCache(chainId, fromToken, toToken, amount, {
      fee: slippage.toString()
    });

    if (!quote) return null;

    // Format for UI display
    const formattedOutput = fromWei(quote.dstAmount, quote.toToken.decimals);
    const protocols = quote.protocols.flat().map(p => p.name);
    const route = formatProtocolRoute(quote.protocols);

    return {
      outputAmount: quote.dstAmount,
      formattedOutput,
      priceImpact: 0, // Calculate if needed
      route,
      gasEstimate: quote.gas || '0',
      gasPrice: quote.gasPrice || '0',
      protocols,
      confidence: 0.95 // Mock confidence score
    };
  }

  /**
   * Get multiple quotes for best price comparison
   */
  async getCompetitiveQuotes(
    chainId: ChainId,
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<Array<{
    provider: string;
    outputAmount: string;
    gasEstimate: string;
    route: string;
    protocols: string[];
  }>> {
    const quotes = await Promise.allSettled([
      // Different complexity levels for variety
      this.getQuoteWithCache(chainId, fromToken, toToken, amount, { complexityLevel: '0' }),
      this.getQuoteWithCache(chainId, fromToken, toToken, amount, { complexityLevel: '1' }),
      this.getQuoteWithCache(chainId, fromToken, toToken, amount, { complexityLevel: '2' })
    ]);

    return quotes
      .map((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const quote = result.value;
          return {
            provider: `1inch-${index}`,
            outputAmount: quote.dstAmount,
            gasEstimate: quote.gas || '0',
            route: formatProtocolRoute(quote.protocols),
            protocols: quote.protocols.flat().map(p => p.name)
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{
        provider: string;
        outputAmount: string;
        gasEstimate: string;
        route: string;
        protocols: string[];
      }>;
  }

  /**
   * Clear quote cache
   */
  clearCache(): void {
    this.quotesCache.clear();
  }

  /**
   * Check if tokens are supported on chain
   */
  async validateTokens(chainId: ChainId, tokenAddresses: string[]): Promise<boolean> {
    try {
      const tokens = await this.service.getTokens(chainId);
      return tokenAddresses.every(address => 
        address in tokens || isNativeToken(address)
      );
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }
}

/**
 * React Hook for 1inch Integration
 * Provides easy integration with React components
 */
export function useOneInchQuotes() {
  const [quoteService] = useState(() => new OneInchQuoteService(process.env.NEXT_PUBLIC_ONEINCH_API_KEY));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getQuote = async (
    chainId: ChainId,
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number = 1
  ) => {
    if (!amount || amount === '0') return null;

    setIsLoading(true);
    setError(null);

    try {
      const quote = await quoteService.getUIQuote(chainId, fromToken, toToken, amount, slippage);
      setIsLoading(false);
      return quote;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  };

  const getCompetitiveQuotes = async (
    chainId: ChainId,
    fromToken: string,
    toToken: string,
    amount: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const quotes = await quoteService.getCompetitiveQuotes(chainId, fromToken, toToken, amount);
      setIsLoading(false);
      return quotes;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsLoading(false);
      return [];
    }
  };

  return {
    getQuote,
    getCompetitiveQuotes,
    isLoading,
    error,
    clearCache: () => quoteService.clearCache(),
    validateTokens: (chainId: ChainId, tokens: string[]) => 
      quoteService.validateTokens(chainId, tokens)
  };
}

// Create default instances
export const oneInchService = new OneInchService(process.env.NEXT_PUBLIC_ONEINCH_API_KEY);
export const oneInchQuoteService = new OneInchQuoteService(process.env.NEXT_PUBLIC_ONEINCH_API_KEY);