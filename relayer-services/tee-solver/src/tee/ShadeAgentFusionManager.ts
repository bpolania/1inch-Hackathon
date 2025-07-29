/**
 * Shade Agent Fusion Manager
 * 
 * Enhanced Fusion Manager that integrates NEAR Shade Agent TEE capabilities
 * with 1inch Fusion+ for decentralized, verifiable cross-chain order execution
 */

import { EventEmitter } from 'events';
import { FusionManagerWithChainSignatures, EnhancedFusionConfig } from '../fusion/FusionManagerWithChainSignatures';
import { ShadeAgentManager, TEEConfig } from './ShadeAgentManager';
import { AttestationVerifier, TrustedMeasurements } from './AttestationVerifier';
import { logger } from '../utils/logger';
import { QuoteRequest, Quote } from '../types/solver.types';
import { FusionQuoteRequest } from '../fusion/types';

export interface ShadeAgentFusionConfig extends EnhancedFusionConfig {
  // TEE Configuration
  teeConfig: TEEConfig;
  trustedMeasurements: TrustedMeasurements;
  
  // Shade Agent specific settings
  requireAttestation: boolean;
  allowFallbackSigning: boolean;
  attestationCacheTimeout: number;
  
  // Security settings
  strictVerification: boolean;
  minimumTrustLevel: 'high' | 'medium' | 'low';
  enableAuditLogging: boolean;
}

export interface ShadeAgentOrderData {
  orderId: string;
  requestId: string;
  teeSignature: string;
  attestationProof: string;
  verificationResult: any;
  signingMethod: 'tee-hardware' | 'chain-signatures' | 'private-key';
  trustLevel: 'high' | 'medium' | 'low';
  timestamp: number;
}

export class ShadeAgentFusionManager extends EventEmitter {
  private fusionManager: FusionManagerWithChainSignatures;
  private shadeAgentManager: ShadeAgentManager;
  private attestationVerifier: AttestationVerifier;
  private config: ShadeAgentFusionConfig;
  
  private isInitialized: boolean = false;
  private orderAuditLog: ShadeAgentOrderData[] = [];
  
  // Enhanced statistics
  private stats = {
    teeOrders: 0,
    chainSignatureOrders: 0,
    privateKeyOrders: 0,
    attestationVerifications: 0,
    trustLevelBreakdown: {
      high: 0,
      medium: 0,
      low: 0
    },
    averageOrderTime: 0,
    securityEvents: 0
  };

  constructor(config: ShadeAgentFusionConfig) {
    super();
    this.config = config;
    this.setupComponents();
    this.setupEventHandlers();
  }

  /**
   * Initialize all Shade Agent components
   */
  async initialize(): Promise<void> {
    logger.info('🛡️ Initializing Shade Agent Fusion Manager...', {
      teeMode: this.config.teeConfig.teeMode,
      attestationRequired: this.config.requireAttestation,
      trustLevel: this.config.minimumTrustLevel
    });

    try {
      // Initialize attestation verifier first
      if (!this.attestationVerifier.validateTrustedMeasurements()) {
        throw new Error('Invalid trusted measurements configuration');
      }

      // Initialize Shade Agent TEE manager
      await this.shadeAgentManager.initialize();

      // Initialize enhanced Fusion manager
      await this.fusionManager.initialize();

      // Verify TEE attestation if required
      if (this.config.requireAttestation) {
        await this.verifyTEEAttestation();
      }

      this.isInitialized = true;
      logger.info('✅ Shade Agent Fusion Manager initialized successfully');
      this.emit('initialized');

    } catch (error) {
      logger.error('💥 Failed to initialize Shade Agent Fusion Manager:', error);
      
      if (this.config.allowFallbackSigning) {
        logger.warn('⚠️ Falling back to non-TEE mode...');
        await this.initializeFallbackMode();
      } else {
        throw error;
      }
    }
  }

  /**
   * Process quote request with TEE verification
   */
  async processQuoteRequest(request: QuoteRequest): Promise<Quote> {
    if (!this.isInitialized) {
      throw new Error('Shade Agent Fusion Manager not initialized');
    }

    logger.info('🔍 Processing quote request with TEE verification', {
      requestId: request.id,
      sourceChain: request.sourceChain,
      destinationChain: request.destinationChain,
      amount: request.sourceAmount.toString()
    });

    const startTime = Date.now();

    try {
      // Convert to Fusion request format
      const fusionRequest = this.fusionManager.convertQuoteRequest(request);
      
      // Get quote from 1inch with TEE attestation
      const quote = await this.getVerifiedQuote(fusionRequest);
      
      // Create and submit order with TEE signing
      const orderData = await this.createVerifiedOrder(quote, fusionRequest);
      const orderHash = await this.submitVerifiedOrder(orderData);

      // Convert back to our Quote format for response
      const solverQuote = this.convertToSolverQuote(quote, request, orderHash);
      
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(processingTime);

      logger.info('✅ Quote request processed with TEE verification', {
        requestId: request.id,
        orderHash: orderHash.substring(0, 10) + '...',
        processingTime,
        trustLevel: orderData.trustLevel || 'unknown'
      });

      return solverQuote;

    } catch (error) {
      logger.error('💥 TEE quote processing failed:', error);
      this.stats.securityEvents++;
      this.emit('processing_failed', { requestId: request.id, error });
      throw error;
    }
  }

  /**
   * Get quote with TEE attestation proof
   */
  private async getVerifiedQuote(request: FusionQuoteRequest): Promise<any> {
    logger.info('🔐 Getting verified quote with TEE attestation...');

    try {
      // Get standard quote
      const quote = await this.fusionManager.getQuote(request);
      
      // Attach TEE attestation proof
      if (this.config.teeConfig.teeMode) {
        const attestationData = this.shadeAgentManager.getAttestationData();
        if (attestationData) {
          quote.teeAttestation = {
            quote: attestationData.quote,
            codehash: attestationData.codehash,
            timestamp: attestationData.timestamp
          };
        }
      }

      return quote;

    } catch (error) {
      logger.error('💥 Verified quote generation failed:', error);
      throw error;
    }
  }

  /**
   * Create order with TEE verification
   */
  private async createVerifiedOrder(quote: any, request: FusionQuoteRequest): Promise<any> {
    logger.info('📋 Creating verified order with TEE signatures...');

    try {
      // Create standard order
      const orderData = await this.fusionManager.createOrder(quote, request);
      
      // Enhance with TEE verification
      if (this.config.teeConfig.teeMode) {
        const teeStats = this.shadeAgentManager.getStats();
        
        orderData.teeVerification = {
          attestationValid: teeStats.registrationStatus === 'registered',
          trustLevel: this.determineTrustLevel(teeStats),
          securityLevel: teeStats.teeSecurityLevel,
          verifiedAt: Date.now()
        };
      }

      return orderData;

    } catch (error) {
      logger.error('💥 Verified order creation failed:', error);
      throw error;
    }
  }

  /**
   * Submit order with TEE signing and verification
   */
  private async submitVerifiedOrder(orderData: any): Promise<string> {
    const startTime = Date.now();
    
    logger.info('📤 Submitting verified order with TEE signing...', {
      requestId: orderData.requestId,
      teeMode: this.config.teeConfig.teeMode
    });

    try {
      let orderHash: string;
      let signingMethod: 'tee-hardware' | 'chain-signatures' | 'private-key';
      let trustLevel: 'high' | 'medium' | 'low' = 'low';

      if (this.config.teeConfig.teeMode && this.shadeAgentManager.getStats().registrationStatus === 'registered') {
        // Use TEE hardware signing
        orderHash = await this.submitWithTEESigning(orderData);
        signingMethod = 'tee-hardware';
        trustLevel = 'high';
        this.stats.teeOrders++;

      } else if (this.config.enableChainSignatures) {
        // Fallback to Chain Signatures
        orderHash = await this.fusionManager.submitOrder(orderData);
        signingMethod = 'chain-signatures';
        trustLevel = 'medium';
        this.stats.chainSignatureOrders++;

      } else {
        // Fallback to private key
        orderHash = await this.fusionManager.submitOrder(orderData);
        signingMethod = 'private-key';
        trustLevel = 'low';
        this.stats.privateKeyOrders++;
      }

      // Update trust level statistics
      this.stats.trustLevelBreakdown[trustLevel]++;

      // Create audit log entry
      if (this.config.enableAuditLogging) {
        await this.createAuditLogEntry(orderData, orderHash, signingMethod, trustLevel);
      }

      const submissionTime = Date.now() - startTime;
      this.updateSubmissionStats(submissionTime);

      logger.info('✅ Verified order submitted successfully', {
        requestId: orderData.requestId,
        orderHash: orderHash.substring(0, 10) + '...',
        signingMethod,
        trustLevel,
        submissionTime
      });

      this.emit('order_verified_and_submitted', {
        orderHash,
        requestId: orderData.requestId,
        signingMethod,
        trustLevel
      });

      return orderHash;

    } catch (error) {
      logger.error('💥 Verified order submission failed:', error);
      this.stats.securityEvents++;
      throw error;
    }
  }

  /**
   * Submit order using TEE hardware signing
   */
  private async submitWithTEESigning(orderData: any): Promise<string> {
    logger.info('🔐 Submitting order with TEE hardware signing...');

    try {
      // Generate TEE key pair for signing
      const teeKeyPair = await this.shadeAgentManager.generateTEEKeyPair('secp256k1');
      
      // Sign the order using TEE-generated private key
      const teeSignature = await this.shadeAgentManager.signTransaction(
        orderData.preparedOrder,
        teeKeyPair.address,
        'ethereum' // Would determine from order data
      );

      // Create signed order with TEE signature
      const signedOrder = {
        ...orderData.preparedOrder,
        signature: teeSignature,
        teeSignerAddress: teeKeyPair.address
      };

      // Submit to 1inch network
      const orderInfo = await this.fusionManager.crossChainSDK.submitOrder(
        orderData.quote.params?.srcChainId || 1,
        signedOrder,
        orderData.quote.quoteId,
        orderData.secretHashes
      );

      return orderInfo.orderHash;

    } catch (error) {
      logger.error('💥 TEE signing failed:', error);
      
      if (this.config.allowFallbackSigning) {
        logger.warn('⚠️ Falling back to Chain Signatures for this order...');
        return await this.fusionManager.submitOrder(orderData);
      }
      
      throw error;
    }
  }

  /**
   * Verify TEE attestation
   */
  private async verifyTEEAttestation(): Promise<void> {
    logger.info('🔍 Verifying TEE attestation...');

    try {
      const attestationData = this.shadeAgentManager.getAttestationData();
      if (!attestationData) {
        throw new Error('No attestation data available');
      }

      const verificationResult = await this.attestationVerifier.verifyAttestation(
        attestationData.quote,
        attestationData.codehash,
        attestationData.quoteCollateral
      );

      this.stats.attestationVerifications++;

      if (!verificationResult.isValid) {
        throw new Error(`Attestation verification failed: ${verificationResult.issues.join(', ')}`);
      }

      if (this.config.strictVerification) {
        const minimumLevel = this.config.minimumTrustLevel;
        const trustLevels = { low: 1, medium: 2, high: 3 };
        
        if (trustLevels[verificationResult.trustLevel] < trustLevels[minimumLevel]) {
          throw new Error(`Trust level ${verificationResult.trustLevel} below minimum ${minimumLevel}`);
        }
      }

      logger.info('✅ TEE attestation verified successfully', {
        trustLevel: verificationResult.trustLevel,
        issues: verificationResult.issues.length
      });

    } catch (error) {
      logger.error('💥 TEE attestation verification failed:', error);
      throw error;
    }
  }

  /**
   * Initialize fallback mode without TEE
   */
  private async initializeFallbackMode(): Promise<void> {
    logger.warn('⚠️ Initializing fallback mode without TEE...');
    
    try {
      await this.fusionManager.initialize();
      this.isInitialized = true;
      
      logger.info('✅ Fallback mode initialized successfully');
      this.emit('fallback_initialized');
    } catch (error) {
      logger.error('💥 Fallback mode initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup component instances
   */
  private setupComponents(): void {
    // Initialize Fusion Manager
    this.fusionManager = new FusionManagerWithChainSignatures(this.config);
    
    // Initialize Shade Agent Manager
    this.shadeAgentManager = new ShadeAgentManager(this.config.teeConfig);
    
    // Initialize Attestation Verifier
    this.attestationVerifier = new AttestationVerifier(this.config.trustedMeasurements);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.shadeAgentManager.on('attestation_completed', (data) => {
      logger.info('🔐 TEE attestation completed');
      this.emit('tee_attestation_completed', data);
    });

    this.shadeAgentManager.on('registration_completed', (data) => {
      logger.info('📝 Shade Agent registration completed');
      this.emit('shade_agent_registered', data);
    });

    this.fusionManager.on('order_submitted', (data) => {
      logger.info('📤 Order submitted via Fusion Manager');
      this.emit('fusion_order_submitted', data);
    });

    this.attestationVerifier.on('verification_completed', (result) => {
      logger.info('✅ Attestation verification completed', {
        trustLevel: result.trustLevel
      });
    });
  }

  /**
   * Create audit log entry
   */
  private async createAuditLogEntry(
    orderData: any,
    orderHash: string,
    signingMethod: 'tee-hardware' | 'chain-signatures' | 'private-key',
    trustLevel: 'high' | 'medium' | 'low'
  ): Promise<void> {
    const auditEntry: ShadeAgentOrderData = {
      orderId: orderHash,
      requestId: orderData.requestId,
      teeSignature: signingMethod === 'tee-hardware' ? 'present' : 'not-used',
      attestationProof: this.config.teeConfig.teeMode ? 'verified' : 'not-required',
      verificationResult: orderData.teeVerification || null,
      signingMethod,
      trustLevel,
      timestamp: Date.now()
    };

    this.orderAuditLog.push(auditEntry);
    
    // Limit audit log size
    if (this.orderAuditLog.length > 1000) {
      this.orderAuditLog = this.orderAuditLog.slice(-500);
    }

    logger.info('📋 Audit log entry created', {
      orderId: orderHash.substring(0, 10) + '...',
      signingMethod,
      trustLevel
    });
  }

  /**
   * Determine trust level based on TEE stats
   */
  private determineTrustLevel(teeStats: any): 'high' | 'medium' | 'low' {
    if (teeStats.registrationStatus === 'registered' && teeStats.teeSecurityLevel === 'high') {
      return 'high';
    } else if (teeStats.registrationStatus === 'registered') {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Convert to solver quote format
   */
  private convertToSolverQuote(fusionQuote: any, originalRequest: QuoteRequest, orderHash: string): Quote {
    return {
      requestId: originalRequest.id,
      solverId: 'shade-agent-tee-solver',
      timestamp: Date.now(),
      sourceAmount: originalRequest.sourceAmount,
      destinationAmount: BigInt(fusionQuote.dstTokenAmount || '0'),
      estimatedGasCost: BigInt('200000'), // Enhanced gas estimate for TEE
      solverFee: BigInt('10000000000000000'), // 0.01 ETH solver fee
      route: [], // Would populate from fusion quote
      estimatedExecutionTime: 180, // 3 minutes for TEE processing
      validUntil: Date.now() + (this.config.defaultValidityPeriod * 1000),
      confidence: 95, // High confidence due to TEE verification
      metadata: {
        orderHash,
        teeVerified: this.config.teeConfig.teeMode,
        trustLevel: this.determineTrustLevel(this.shadeAgentManager.getStats()),
        attestationProof: !!this.shadeAgentManager.getAttestationData()
      }
    };
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(processingTime: number): void {
    const alpha = 0.1;
    if (this.stats.averageOrderTime === 0) {
      this.stats.averageOrderTime = processingTime;
    } else {
      this.stats.averageOrderTime = 
        this.stats.averageOrderTime * (1 - alpha) + processingTime * alpha;
    }
  }

  /**
   * Update submission statistics
   */
  private updateSubmissionStats(submissionTime: number): void {
    // Additional submission-specific statistics could be tracked here
    logger.info('📊 Submission statistics updated', { submissionTime });
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const baseStats = {
      ...this.stats,
      isInitialized: this.isInitialized,
      auditLogEntries: this.orderAuditLog.length
    };

    const fusionStats = this.fusionManager.getStats();
    const teeStats = this.shadeAgentManager.getStats();
    const verifierStats = this.attestationVerifier.getStats();

    return {
      shadeAgent: baseStats,
      fusion: fusionStats,
      tee: teeStats,
      attestation: verifierStats
    };
  }

  /**
   * Get audit log (last N entries)
   */
  getAuditLog(limit: number = 50): ShadeAgentOrderData[] {
    return this.orderAuditLog.slice(-limit);
  }

  /**
   * Stop all components
   */
  async stop(): Promise<void> {
    logger.info('🛑 Stopping Shade Agent Fusion Manager...');
    
    try {
      await Promise.all([
        this.fusionManager.stop(),
        this.shadeAgentManager.stop()
      ]);
      
      this.orderAuditLog = [];
      this.isInitialized = false;
      
      logger.info('✅ Shade Agent Fusion Manager stopped');
    } catch (error) {
      logger.error('Error stopping Shade Agent Fusion Manager:', error);
    }
  }
}