/**
 * Fusion Manager - 1inch Fusion+ Integration
 * 
 * Handles conversion from our TEE solver quotes to 1inch Fusion+ meta-orders
 * and manages the entire 1inch SDK integration lifecycle.
 */

import { EventEmitter } from 'events';
import {
  SDK as CrossChainSDK,
  PrivateKeyProviderConnector,
  NetworkEnum,
  PresetEnum,
  HashLock
} from '@1inch/cross-chain-sdk';

import {
  FusionSDK,
  PrivateKeyProviderConnector as FusionConnector,
  NetworkEnum as FusionNetworkEnum
} from '@1inch/fusion-sdk';

import { createMockWeb3Provider, Web3Like } from './MockWeb3Provider';

import { logger } from '../utils/logger';
import { QuoteRequest, Quote, ChainId } from '../types/solver.types';
import {
  FusionConfig,
  FusionQuoteRequest,
  FusionPlusOrder,
  FusionMetaOrder,
  FusionSDKManager,
  FusionError,
  FusionErrorType,
  CHAIN_ID_TO_NETWORK
} from './types';

export class FusionManager extends EventEmitter implements FusionSDKManager {
  public fusionSDK!: FusionSDK;
  public crossChainSDK!: CrossChainSDK;
  public config: FusionConfig;
  
  private isInitialized: boolean = false;
  private connector!: PrivateKeyProviderConnector;
  
  // Order tracking
  private activeOrders: Map<string, FusionMetaOrder> = new Map();
  private orderHistory: FusionMetaOrder[] = [];
  
  // Statistics
  private stats = {
    ordersCreated: 0,
    ordersSubmitted: 0,
    ordersFilled: 0,
    totalVolume: 0n,
    averageOrderTime: 0
  };

  constructor(config: FusionConfig) {
    super();
    this.config = config;
    this.setupEventHandlers();
  }

  /**
   * Initialize 1inch SDK instances
   */
  async initialize(): Promise<void> {
    logger.info(' Initializing Fusion Manager...');
    
    try {
      // Create mock Web3 provider for development
      const web3Provider = createMockWeb3Provider(1); // Ethereum mainnet
      
      // Create blockchain provider connector with Web3 provider
      this.connector = new PrivateKeyProviderConnector(
        this.config.walletPrivateKey,
        web3Provider as any
      );
      
      // Initialize Cross-Chain SDK
      this.crossChainSDK = new CrossChainSDK({
        url: this.config.crossChainApiUrl,
        authKey: this.config.authKey,
        blockchainProvider: this.connector
      });
      
      // For single-chain Fusion orders (future use)
      this.fusionSDK = new FusionSDK({
        url: this.config.fusionApiUrl,
        network: FusionNetworkEnum.ETHEREUM, // Use Fusion SDK's NetworkEnum
        blockchainProvider: new FusionConnector(
          this.config.walletPrivateKey,
          web3Provider as any
        )
      });
      
      this.isInitialized = true;
      logger.info(' Fusion Manager initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      logger.error(' Failed to initialize Fusion Manager:', error);
      this.emitError(FusionErrorType.SDK_INITIALIZATION_FAILED, 
        `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        error
      );
      throw error;
    }
  }

  /**
   * Convert our QuoteRequest to 1inch FusionQuoteRequest
   */
  convertQuoteRequest(request: QuoteRequest): FusionQuoteRequest {
    // Map our chain IDs to 1inch networks
    const srcChainId = CHAIN_ID_TO_NETWORK[request.sourceChain];
    const dstChainId = CHAIN_ID_TO_NETWORK[request.destinationChain];
    
    if (!srcChainId || !dstChainId) {
      throw new Error(`Unsupported chain pair: ${request.sourceChain} -> ${request.destinationChain}`);
    }
    
    return {
      requestId: request.id,
      solverId: 'tee-solver',
      
      // 1inch SDK required fields (matching QuoteParams)
      srcChainId,
      dstChainId,
      srcTokenAddress: request.sourceToken.address,
      dstTokenAddress: request.destinationToken.address,
      amount: request.sourceAmount.toString(),
      walletAddress: request.userAddress,
      
      // Optional configuration
      enableEstimate: true,
      preset: this.config.defaultPreset
    };
  }

  /**
   * Get quote from 1inch Cross-Chain SDK
   */
  async getQuote(request: FusionQuoteRequest): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('FusionManager not initialized');
    }
    
    logger.info(` Getting 1inch quote for ${request.requestId}`, {
      srcChainId: request.srcChainId,
      dstChainId: request.dstChainId,
      amount: request.amount
    });
    
    try {
      // Use the SDK's actual parameter structure
      const quoteParams = {
        srcChainId: request.srcChainId,
        dstChainId: request.dstChainId,
        srcTokenAddress: request.srcTokenAddress,
        dstTokenAddress: request.dstTokenAddress,
        amount: request.amount,
        walletAddress: request.walletAddress,
        enableEstimate: request.enableEstimate,
        permit: request.permit,
        takingFeeBps: request.takingFeeBps,
        source: request.source,
        isPermit2: request.isPermit2
      };
      
      const quote = await this.crossChainSDK.getQuote(quoteParams as any);
      
      logger.info(` 1inch quote received`, {
        requestId: request.requestId,
        dstAmount: quote.dstTokenAmount,
        quoteId: quote.quoteId
      });
      
      return quote;
      
    } catch (error) {
      logger.error(` 1inch quote failed for ${request.requestId}:`, error);
      this.emitError(FusionErrorType.INVALID_QUOTE_REQUEST,
        `Quote request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { requestId: request.requestId, request }
      );
      throw error;
    }
  }

  /**
   * Create 1inch Fusion+ order from quote using SDK
   */
  async createOrder(quote: any, request: FusionQuoteRequest): Promise<any> {
    logger.info(` Creating Fusion+ order for ${request.requestId}`);
    
    try {
      // Generate secrets for atomic swap
      const secretsCount = quote.presets?.fast?.secretsCount || 1;
      const secrets = this.generateSecrets(secretsCount);
      const hashLock = this.createHashLock(secrets);
      const secretHashes = secrets.map(secret => this.hashSecret(secret));
      
      // Create order parameters
      const orderParams = {
        walletAddress: request.walletAddress,
        hashLock,
        secretHashes,
        permit: request.permit,
        preset: request.preset || this.config.defaultPreset,
        source: request.source
      };
      
      // Use SDK to create the prepared order
      const preparedOrder = this.crossChainSDK.createOrder(quote, orderParams);
      
      this.stats.ordersCreated++;
      
      logger.info(` Fusion+ order created`, {
        requestId: request.requestId,
        preset: orderParams.preset,
        secretsCount: secrets.length
      });
      
      // Return our wrapped order format
      return {
        preparedOrder,
        quote,
        secrets,
        secretHashes,
        hashLock,
        requestId: request.requestId,
        solverId: request.solverId
      };
      
    } catch (error) {
      logger.error(` Order creation failed for ${request.requestId}:`, error);
      this.emitError(FusionErrorType.ORDER_CREATION_FAILED,
        `Order creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { requestId: request.requestId }
      );
      throw error;
    }
  }

  /**
   * Submit order to 1inch network using SDK
   */  
  async submitOrder(orderData: any): Promise<string> {
    logger.info(` Submitting Fusion+ order ${orderData.requestId}`);
    
    try {
      // Extract data from our order structure
      const { preparedOrder, quote, secretHashes, requestId } = orderData;
      
      // Use SDK to submit the order
      // submitOrder(srcChainId: SupportedChain, order: EvmCrossChainOrder, quoteId: string, secretHashes: string[])
      const orderInfo = await this.crossChainSDK.submitOrder(
        quote.params?.srcChainId || NetworkEnum.ETHEREUM,
        preparedOrder,
        quote.quoteId,
        secretHashes
      );
      
      const orderHash = orderInfo.orderHash;
      this.stats.ordersSubmitted++;
      
      // Track the order
      const metaOrder: FusionMetaOrder = {
        originalQuote: this.convertOrderToQuote(orderData),
        fusionOrder: orderData,
        secrets: secretHashes,
        hashLock: orderData.hashLock,
        orderHash,
        status: 'submitted',
        submittedAt: Date.now()
      };
      
      this.activeOrders.set(orderHash, metaOrder);
      this.orderHistory.push(metaOrder);
      
      logger.info(` Order submitted successfully`, {
        requestId,
        orderHash: orderHash.substring(0, 10) + '...'
      });
      
      this.emit('order_submitted', { orderHash, requestId });
      
      return orderHash;
      
    } catch (error) {
      logger.error(` Order submission failed for ${orderData.requestId}:`, error);
      this.emitError(FusionErrorType.ORDER_SUBMISSION_FAILED,
        `Order submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { requestId: orderData.requestId }
      );
      throw error;
    }
  }

  /**
   * Convert our Quote to 1inch Fusion+ meta-order
   */
  async convertToMetaOrder(quote: Quote): Promise<FusionMetaOrder> {
    logger.info(` Converting quote ${quote.requestId} to Fusion+ meta-order`);
    
    try {
      // Create quote request from our quote
      const quoteRequest = this.createQuoteRequestFromQuote(quote);
      
      // Get 1inch quote
      const fusionQuote = await this.getQuote(quoteRequest);
      
      // Create 1inch order
      const fusionOrder = await this.createOrder(fusionQuote, quoteRequest);
      
      // Create meta-order
      const metaOrder: FusionMetaOrder = {
        originalQuote: quote,
        fusionOrder,
        secrets: fusionOrder.secretHashes,
        hashLock: fusionOrder.hashLock,
        status: 'pending'
      };
      
      logger.info(` Meta-order created for ${quote.requestId}`);
      
      return metaOrder;
      
    } catch (error) {
      logger.error(` Meta-order conversion failed for ${quote.requestId}:`, error);
      throw error;
    }
  }

  /**
   * Generate cryptographic secrets for atomic swaps
   */
  generateSecrets(count: number): string[] {
    const secrets = [];
    for (let i = 0; i < count; i++) {
      // Generate 32-byte random secret
      const secret = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      secrets.push(secret);
    }
    return secrets;
  }

  /**
   * Create hash lock from secrets using 1inch SDK
   */
  createHashLock(secrets: string[]): HashLock {
    // Use the actual 1inch HashLock creation methods
    if (secrets.length === 1) {
      // Single fill order
      return HashLock.forSingleFill(secrets[0]);
    } else {
      // Multiple fills order
      const leaves = HashLock.getMerkleLeaves(secrets);
      return HashLock.forMultipleFills(leaves);
    }
  }

  // Helper methods

  private hashSecret(secret: string): string {
    // Simple keccak256 hash - in real implementation use proper crypto library
    const crypto = require('crypto');
    return '0x' + crypto.createHash('sha256').update(secret).digest('hex');
  }

  private calculateMerkleRoot(hashes: string[]): string {
    // Simplified Merkle root calculation
    if (hashes.length === 1) return hashes[0];
    
    const crypto = require('crypto');
    const combined = hashes.join('');
    return '0x' + crypto.createHash('sha256').update(combined).digest('hex');
  }

  private calculateOrderConfidence(quote: any, preset: any): number {
    // Base confidence from quote
    let confidence = 90;
    
    // Reduce for cross-chain complexity
    if (quote.srcChainId !== quote.dstChainId) {
      confidence -= 10;
    }
    
    // Adjust based on preset (fast = less confident, slow = more confident)
    if (preset.name === 'fast') {
      confidence -= 5;
    } else if (preset.name === 'slow') {
      confidence += 5;
    }
    
    return Math.max(50, Math.min(100, confidence));
  }

  private convertOrderToQuote(orderData: any): Quote {
    // Convert our order data back to our Quote format for tracking
    return {
      requestId: orderData.requestId,
      solverId: orderData.solverId,
      timestamp: Date.now(),
      sourceAmount: BigInt(orderData.quote.srcTokenAmount || '0'),
      destinationAmount: BigInt(orderData.quote.dstTokenAmount || '0'),
      estimatedGasCost: BigInt('150000'), // Default gas estimate
      solverFee: BigInt('5000000000000000'), // Default solver fee
      route: [], // Would need to convert from 1inch route format
      estimatedExecutionTime: 300, // 5 minutes default
      validUntil: Date.now() + (this.config.defaultValidityPeriod * 1000),
      confidence: 85 // Default confidence
    };
  }

  private createQuoteRequestFromQuote(quote: Quote): FusionQuoteRequest {
    // This would need the original request data - for now create a minimal version
    return {
      requestId: quote.requestId,
      solverId: quote.solverId,
      amount: quote.sourceAmount.toString(),
      srcChainId: NetworkEnum.ETHEREUM, // Would need to determine from context
      dstChainId: NetworkEnum.ETHEREUM, // Would need to determine from context
      srcTokenAddress: '0x0', // Would need from original request
      dstTokenAddress: '0x0', // Would need from original request
      walletAddress: '0x0', // Would need from original request
      preset: this.config.defaultPreset
    };
  }

  private setupEventHandlers(): void {
    // Handle internal events
    this.on('order_submitted', (data) => {
      logger.info(' Order submitted event:', data);
    });
  }

  private emitError(type: FusionErrorType, message: string, details?: any): void {
    const error: FusionError = {
      type,
      message,
      details,
      timestamp: Date.now()
    };
    this.emit('error', error);
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeOrders: this.activeOrders.size,
      totalOrders: this.orderHistory.length
    };
  }

  /**
   * Get active orders
   */
  getActiveOrders(): FusionMetaOrder[] {
    return Array.from(this.activeOrders.values());
  }

  /**
   * Stop the fusion manager
   */
  async stop(): Promise<void> {
    logger.info(' Stopping Fusion Manager...');
    this.activeOrders.clear();
    this.isInitialized = false;
    logger.info(' Fusion Manager stopped');
  }
}