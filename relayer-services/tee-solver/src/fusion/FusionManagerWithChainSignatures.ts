/**
 * Enhanced Fusion Manager with NEAR Chain Signatures
 * 
 * Extends the original FusionManager to support both centralized private key
 * signing and decentralized NEAR Chain Signatures MPC for true TEE
 * decentralization in production environments.
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
import { ChainSignatureManager, ChainId } from '../signatures/ChainSignatureManager';
import { FusionChainSignatureAdapter } from '../signatures/FusionChainSignatureAdapter';

import { logger } from '../utils/logger';
import { QuoteRequest, Quote, ChainId as SolverChainId } from '../types/solver.types';
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

export interface EnhancedFusionConfig extends FusionConfig {
  // Chain Signatures configuration
  enableChainSignatures: boolean;
  chainSignatureConfig?: {
    nearNetwork: 'mainnet' | 'testnet';
    nearAccountId: string;
    nearPrivateKey: string;
    derivationPath: string;
  };
  
  // Fallback configuration
  fallbackToPrivateKey: boolean;
  signatureValidation: boolean;
}

export class FusionManagerWithChainSignatures extends EventEmitter implements FusionSDKManager {
  public fusionSDK!: FusionSDK;
  public crossChainSDK!: CrossChainSDK;
  public config: EnhancedFusionConfig;
  
  private isInitialized: boolean = false;
  private connector!: PrivateKeyProviderConnector;
  
  // Chain Signatures components
  private chainSignatureManager?: ChainSignatureManager;
  private chainSignatureAdapter?: FusionChainSignatureAdapter;
  private useChainSignatures: boolean = false;
  
  // Order tracking
  private activeOrders: Map<string, FusionMetaOrder> = new Map();
  private orderHistory: FusionMetaOrder[] = [];
  
  // Enhanced statistics
  private stats = {
    ordersCreated: 0,
    ordersSubmitted: 0,
    ordersFilled: 0,
    totalVolume: 0n,
    averageOrderTime: 0,
    
    // Chain Signatures stats
    chainSignatureOrders: 0,
    privateKeyOrders: 0,
    signatureFailures: 0,
    averageSigningTime: 0
  };

  constructor(config: EnhancedFusionConfig) {
    super();
    this.config = config;
    this.useChainSignatures = config.enableChainSignatures;
    this.setupEventHandlers();
  }

  /**
   * Initialize 1inch SDK instances and Chain Signatures
   */
  async initialize(): Promise<void> {
    logger.info(' Initializing Enhanced Fusion Manager...', {
      chainSignatures: this.useChainSignatures,
      fallback: this.config.fallbackToPrivateKey
    });
    
    try {
      // Initialize Chain Signatures if enabled
      if (this.useChainSignatures) {
        await this.initializeChainSignatures();
      }
      
      // Initialize traditional components
      await this.initializeTraditionalComponents();
      
      this.isInitialized = true;
      logger.info(' Enhanced Fusion Manager initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      logger.error(' Failed to initialize Enhanced Fusion Manager:', error);
      
      // Try fallback if enabled
      if (this.useChainSignatures && this.config.fallbackToPrivateKey) {
        logger.warn(' Falling back to private key signing...');
        this.useChainSignatures = false;
        await this.initializeTraditionalComponents();
        this.isInitialized = true;
        logger.info(' Enhanced Fusion Manager initialized successfully');
        this.emit('initialized');
      } else {
        this.emitError(FusionErrorType.SDK_INITIALIZATION_FAILED, 
          `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          error
        );
        throw error;
      }
    }
  }

  /**
   * Initialize NEAR Chain Signatures components
   */
  private async initializeChainSignatures(): Promise<void> {
    if (!this.config.chainSignatureConfig) {
      throw new Error('Chain Signature configuration is required when enableChainSignatures is true');
    }

    logger.info(' Initializing NEAR Chain Signatures...');

    // Initialize Chain Signature Manager
    this.chainSignatureManager = new ChainSignatureManager({
      nearNetwork: this.config.chainSignatureConfig.nearNetwork,
      nearAccountId: this.config.chainSignatureConfig.nearAccountId,
      nearPrivateKey: this.config.chainSignatureConfig.nearPrivateKey,
      mpcContractId: this.config.chainSignatureConfig.nearNetwork === 'mainnet' 
        ? 'v1.signer' 
        : 'v1.signer-dev',
      derivationPath: this.config.chainSignatureConfig.derivationPath,
      supportedChains: this.getSupportedChainsForSignatures()
    });

    await this.chainSignatureManager.initialize();

    // Initialize Fusion Chain Signature Adapter
    this.chainSignatureAdapter = new FusionChainSignatureAdapter({
      chainSignatureManager: this.chainSignatureManager,
      derivationPath: this.config.chainSignatureConfig.derivationPath,
      enabledChains: this.config.supportedNetworks.map(net => this.networkToChainName(net)),
      signatureValidation: this.config.signatureValidation
    });

    await this.chainSignatureAdapter.initialize();

    logger.info(' NEAR Chain Signatures initialized');
  }

  /**
   * Initialize traditional 1inch SDK components
   */
  private async initializeTraditionalComponents(): Promise<void> {
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
      amount: request.amount,
      signingMethod: this.useChainSignatures ? 'chain-signatures' : 'private-key'
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
   * Create 1inch Fusion+ order with Chain Signatures or private key
   */
  async createOrder(quote: any, request: FusionQuoteRequest): Promise<any> {
    logger.info(` Creating Fusion+ order for ${request.requestId}`, {
      signingMethod: this.useChainSignatures ? 'chain-signatures' : 'private-key'
    });
    
    try {
      // Generate secrets for atomic swap
      const secretsCount = quote.presets?.fast?.secretsCount || 1;
      const secrets = this.generateSecrets(secretsCount);
      const hashLock = this.createHashLock(secrets);
      const secretHashes = secrets.map(secret => this.hashSecret(secret));
      
      // Determine solver address based on signing method
      let solverAddress: string;
      
      if (this.useChainSignatures && this.chainSignatureAdapter) {
        // Get solver address from Chain Signatures
        const targetChain = this.networkToChainName(request.srcChainId);
        const addresses = await this.chainSignatureAdapter.getSolverAddresses();
        solverAddress = addresses[targetChain] || this.config.solverAddress;
        
        logger.info(` Using Chain Signatures solver address: ${solverAddress}`);
      } else {
        // Use configured solver address for private key signing
        solverAddress = this.config.solverAddress;
        logger.info(` Using private key solver address: ${solverAddress}`);
      }
      
      // Create order parameters
      const orderParams = {
        walletAddress: solverAddress, // Use derived address
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
        secretsCount: secrets.length,
        solverAddress: solverAddress.substring(0, 10) + '...'
      });
      
      // Return our wrapped order format
      return {
        preparedOrder,
        quote,
        secrets,
        secretHashes,
        hashLock,
        requestId: request.requestId,
        solverId: request.solverId,
        solverAddress,
        signingMethod: this.useChainSignatures ? 'chain-signatures' : 'private-key'
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
   * Submit order to 1inch network using Chain Signatures or private key
   */  
  async submitOrder(orderData: any): Promise<string> {
    const startTime = Date.now();
    
    logger.info(` Submitting Fusion+ order ${orderData.requestId}`, {
      signingMethod: orderData.signingMethod || 'private-key'
    });
    
    try {
      let orderHash: string;
      
      if (this.useChainSignatures && this.chainSignatureAdapter && orderData.signingMethod === 'chain-signatures') {
        // Use Chain Signatures for signing and submission
        orderHash = await this.submitOrderWithChainSignatures(orderData);
        this.stats.chainSignatureOrders++;
      } else {
        // Use traditional private key signing
        orderHash = await this.submitOrderWithPrivateKey(orderData);
        this.stats.privateKeyOrders++;
      }
      
      const submissionTime = Date.now() - startTime;
      this.stats.ordersSubmitted++;
      this.updateSigningStats(submissionTime);
      
      // Track the order
      const metaOrder: FusionMetaOrder = {
        originalQuote: this.convertOrderToQuote(orderData),
        fusionOrder: orderData,
        secrets: orderData.secretHashes,
        hashLock: orderData.hashLock,
        orderHash,
        status: 'submitted',
        submittedAt: Date.now()
      };
      
      this.activeOrders.set(orderHash, metaOrder);
      this.orderHistory.push(metaOrder);
      
      logger.info(` Order submitted successfully in ${submissionTime}ms`, {
        requestId: orderData.requestId,
        orderHash: orderHash.substring(0, 10) + '...',
        signingMethod: orderData.signingMethod || 'private-key'
      });
      
      this.emit('order_submitted', { 
        orderHash, 
        requestId: orderData.requestId, 
        signingMethod: orderData.signingMethod 
      });
      
      return orderHash;
      
    } catch (error) {
      const submissionTime = Date.now() - startTime;
      this.stats.signatureFailures++;
      this.updateSigningStats(submissionTime);
      
      logger.error(` Order submission failed for ${orderData.requestId}:`, error);
      this.emitError(FusionErrorType.ORDER_SUBMISSION_FAILED,
        `Order submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { requestId: orderData.requestId }
      );
      throw error;
    }
  }

  /**
   * Submit order using Chain Signatures
   */
  private async submitOrderWithChainSignatures(orderData: any): Promise<string> {
    if (!this.chainSignatureAdapter) {
      throw new Error('Chain Signature Adapter not initialized');
    }

    logger.info(' Submitting order with Chain Signatures');

    try {
      // Sign the order using Chain Signatures
      const targetChain = this.networkToChainName(orderData.quote.params?.srcChainId || NetworkEnum.ETHEREUM);
      const signedResult = await this.chainSignatureAdapter.signFusionOrder(
        orderData.preparedOrder,
        targetChain
      );

      // Submit the signed order to 1inch
      const orderInfo = await this.crossChainSDK.submitOrder(
        orderData.quote.params?.srcChainId || NetworkEnum.ETHEREUM,
        signedResult.signedOrder,
        orderData.quote.quoteId,
        orderData.secretHashes
      );

      return orderInfo.orderHash;

    } catch (error) {
      logger.error(' Chain Signatures order submission failed:', error);
      
      // Try fallback if enabled
      if (this.config.fallbackToPrivateKey) {
        logger.warn(' Falling back to private key signing for this order...');
        return await this.submitOrderWithPrivateKey(orderData);
      }
      
      throw error;
    }
  }

  /**
   * Submit order using traditional private key signing
   */
  private async submitOrderWithPrivateKey(orderData: any): Promise<string> {
    logger.info(' Submitting order with private key signing');

    // Extract data from our order structure
    const { preparedOrder, quote, secretHashes } = orderData;
    
    // Use SDK to submit the order
    const orderInfo = await this.crossChainSDK.submitOrder(
      quote.params?.srcChainId || NetworkEnum.ETHEREUM,
      preparedOrder,
      quote.quoteId,
      secretHashes
    );

    return orderInfo.orderHash;
  }

  // Include all other methods from the original FusionManager...
  // (generateSecrets, createHashLock, convertToMetaOrder, etc.)

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

  // Helper methods
  private getSupportedChainsForSignatures(): ChainId[] {
    return this.config.supportedNetworks.map(network => {
      switch (network) {
        case NetworkEnum.ETHEREUM: return ChainId.ETHEREUM;
        case NetworkEnum.POLYGON: return ChainId.POLYGON;
        case NetworkEnum.ARBITRUM: return ChainId.ARBITRUM;
        case NetworkEnum.OPTIMISM: return ChainId.OPTIMISM;
        case NetworkEnum.BINANCE: return ChainId.BSC;
        default: return ChainId.ETHEREUM;
      }
    });
  }

  private networkToChainName(network: NetworkEnum): string {
    switch (network) {
      case NetworkEnum.ETHEREUM: return 'ethereum';
      case NetworkEnum.POLYGON: return 'polygon';
      case NetworkEnum.ARBITRUM: return 'arbitrum';
      case NetworkEnum.OPTIMISM: return 'optimism';
      case NetworkEnum.BINANCE: return 'bsc';
      default: return 'ethereum';
    }
  }

  private hashSecret(secret: string): string {
    // Simple keccak256 hash - in real implementation use proper crypto library
    const crypto = require('crypto');
    return '0x' + crypto.createHash('sha256').update(secret).digest('hex');
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

    // Handle Chain Signature events
    if (this.chainSignatureAdapter) {
      this.chainSignatureAdapter.on('order_signed', (data) => {
        logger.info(' Chain Signature order signed:', data);
      });

      this.chainSignatureAdapter.on('signing_failed', (data) => {
        logger.error(' Chain Signature signing failed:', data);
      });
    }
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

  private updateSigningStats(signingTime: number): void {
    const alpha = 0.1;
    if (this.stats.averageSigningTime === 0) {
      this.stats.averageSigningTime = signingTime;
    } else {
      this.stats.averageSigningTime = 
        this.stats.averageSigningTime * (1 - alpha) + signingTime * alpha;
    }
  }

  /**
   * Get current statistics including Chain Signatures metrics
   */
  getStats() {
    const baseStats = {
      ...this.stats,
      activeOrders: this.activeOrders.size,
      totalOrders: this.orderHistory.length,
      chainSignatureEnabled: this.useChainSignatures,
      fallbackEnabled: this.config.fallbackToPrivateKey
    };

    // Add Chain Signature stats if available
    if (this.chainSignatureAdapter) {
      const chainSigStats = this.chainSignatureAdapter.getStats();
      return {
        ...baseStats,
        chainSignatureStats: chainSigStats
      };
    }

    return baseStats;
  }

  /**
   * Get active orders
   */
  getActiveOrders(): FusionMetaOrder[] {
    return Array.from(this.activeOrders.values());
  }

  /**
   * Stop the enhanced fusion manager
   */
  async stop(): Promise<void> {
    logger.info(' Stopping Enhanced Fusion Manager...');
    
    try {
      if (this.chainSignatureAdapter) {
        await this.chainSignatureAdapter.stop();
      }
      
      if (this.chainSignatureManager) {
        await this.chainSignatureManager.stop();
      }
      
      this.activeOrders.clear();
      this.isInitialized = false;
      
      logger.info(' Enhanced Fusion Manager stopped');
    } catch (error) {
      logger.error('Error stopping Enhanced Fusion Manager:', error);
    }
  }
}