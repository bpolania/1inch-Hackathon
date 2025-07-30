/**
 * Fusion Chain Signature Adapter
 * 
 * Bridges NEAR Chain Signatures with 1inch Fusion+ orders,
 * replacing centralized wallet signing with decentralized MPC signing
 * for true decentralization in TEE environments.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { ChainSignatureManager, ChainId } from './ChainSignatureManager';
import { 
  FusionOrderSigningRequest, 
  FusionOrderSigningResponse,
  ChainSignatureError,
  SOLVER_TO_CHAIN_SIG_MAPPING
} from './types';
import { 
  FusionConfig,
  FusionPlusOrder,
  FusionMetaOrder 
} from '../fusion/types';

export interface FusionChainSignatureConfig {
  chainSignatureManager: ChainSignatureManager;
  derivationPath: string;
  enabledChains: string[];
  signatureValidation: boolean;
}

export class FusionChainSignatureAdapter extends EventEmitter {
  private chainSignatureManager: ChainSignatureManager;
  private config: FusionChainSignatureConfig;
  private isInitialized: boolean = false;
  
  // Statistics tracking
  private stats = {
    ordersSignedTotal: 0,
    ordersSignedSuccess: 0,
    ordersSignedFailed: 0,
    averageSigningTime: 0,
    chainsSupported: [] as string[]
  };

  constructor(config: FusionChainSignatureConfig) {
    super();
    this.chainSignatureManager = config.chainSignatureManager;
    this.config = config;
    this.stats.chainsSupported = config.enabledChains;
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    logger.info('🔧 Initializing Fusion Chain Signature Adapter...');
    
    try {
      // Ensure Chain Signature Manager is initialized
      if (!this.chainSignatureManager.getStats().isInitialized) {
        await this.chainSignatureManager.initialize();
      }
      
      // Verify supported chains
      const supportedChains = this.chainSignatureManager.getSupportedChains();
      const enabledChains = this.config.enabledChains;
      
      const unsupportedChains = enabledChains.filter(chain => 
        !supportedChains.some(supported => supported.chainId === chain)
      );
      
      if (unsupportedChains.length > 0) {
        logger.warn('⚠️ Some enabled chains are not supported by Chain Signatures:', unsupportedChains);
      }
      
      this.isInitialized = true;
      
      logger.info('✅ Fusion Chain Signature Adapter initialized', {
        enabledChains: this.config.enabledChains,
        derivationPath: this.config.derivationPath
      });
      
      this.emit('initialized');
      
    } catch (error) {
      logger.error('💥 Failed to initialize Fusion Chain Signature Adapter:', error);
      throw error;
    }
  }

  /**
   * Sign a 1inch Fusion+ order using Chain Signatures
   */
  async signFusionOrder(
    fusionOrder: FusionPlusOrder, 
    targetChain: string
  ): Promise<{ signedOrder: any; signature: string; solverAddress: string }> {
    
    if (!this.isInitialized) {
      throw new Error('FusionChainSignatureAdapter not initialized');
    }

    const startTime = Date.now();
    const orderId = `fusion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.stats.ordersSignedTotal++;

    logger.info(`🔏 Signing Fusion+ order using Chain Signatures`, {
      orderId,
      targetChain,
      orderType: 'fusion-plus'
    });

    try {
      // Convert target chain to Chain Signature format
      const chainId = this.convertToChainSignatureChain(targetChain);
      
      // Derive solver address for this chain
      const solverAddress = await this.chainSignatureManager.deriveAddress(
        chainId, 
        this.config.derivationPath
      );

      // Prepare order for signing
      const orderForSigning = this.prepareOrderForSigning(fusionOrder, solverAddress);
      
      // Create signature request
      const signatureRequest = {
        requestId: orderId,
        targetChain: chainId,
        transaction: orderForSigning,
        derivationPath: this.config.derivationPath,
        signatureScheme: this.getSignatureScheme(chainId)
      };

      // Request signature from Chain Signatures
      const signatureResponse = await this.chainSignatureManager.requestSignature(signatureRequest);
      
      // Process signed order
      const signedOrder = this.processSignedOrder(
        fusionOrder,
        signatureResponse,
        solverAddress
      );

      const signingTime = Date.now() - startTime;
      this.updateSigningStats(signingTime, true);

      logger.info(`✅ Fusion+ order signed in ${signingTime}ms`, {
        orderId,
        targetChain,
        solverAddress: solverAddress.substring(0, 10) + '...'
      });

      this.emit('order_signed', {
        orderId,
        targetChain,
        signingTime,
        solverAddress
      });

      return {
        signedOrder,
        signature: signatureResponse.signature,
        solverAddress
      };

    } catch (error) {
      const signingTime = Date.now() - startTime;
      this.updateSigningStats(signingTime, false);

      logger.error(`💥 Failed to sign Fusion+ order:`, error);
      
      this.emit('signing_failed', {
        orderId,
        targetChain,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Sign multiple Fusion+ orders concurrently
   */
  async signMultipleFusionOrders(
    orders: Array<{ order: FusionPlusOrder; targetChain: string }>
  ): Promise<Array<{ signedOrder: any; signature: string; solverAddress: string }>> {
    
    logger.info(`🔏 Signing ${orders.length} Fusion+ orders concurrently`);

    try {
      const signingPromises = orders.map(({ order, targetChain }) =>
        this.signFusionOrder(order, targetChain)
      );

      const results = await Promise.all(signingPromises);
      
      logger.info(`✅ Successfully signed ${results.length} Fusion+ orders`);
      return results;

    } catch (error) {
      logger.error('💥 Failed to sign multiple Fusion+ orders:', error);
      throw error;
    }
  }

  /**
   * Verify a signed order signature
   */
  async verifyOrderSignature(
    signedOrder: any,
    targetChain: string
  ): Promise<{ isValid: boolean; solverAddress?: string }> {
    
    if (!this.config.signatureValidation) {
      return { isValid: true };
    }

    logger.info(`🔍 Verifying order signature for ${targetChain}`);

    try {
      // Chain-specific signature verification
      const chainId = this.convertToChainSignatureChain(targetChain);
      const verification = await this.performSignatureVerification(signedOrder, chainId);
      
      logger.info(`${verification.isValid ? '✅' : '❌'} Signature verification result: ${verification.isValid}`);
      
      return verification;

    } catch (error) {
      logger.error('💥 Signature verification failed:', error);
      return { isValid: false };
    }
  }

  /**
   * Get derived solver addresses for all supported chains
   */
  async getSolverAddresses(): Promise<Record<string, string>> {
    const addresses: Record<string, string> = {};
    
    for (const chainName of this.config.enabledChains) {
      try {
        const chainId = this.convertToChainSignatureChain(chainName);
        const address = await this.chainSignatureManager.deriveAddress(
          chainId, 
          this.config.derivationPath
        );
        addresses[chainName] = address;
      } catch (error) {
        logger.warn(`Failed to derive address for ${chainName}:`, error);
      }
    }
    
    return addresses;
  }

  // Private helper methods

  private setupEventHandlers(): void {
    // Forward Chain Signature Manager events
    this.chainSignatureManager.on('signature_completed', (data) => {
      this.emit('chain_signature_completed', data);
    });

    this.chainSignatureManager.on('signature_failed', (data) => {
      this.emit('chain_signature_failed', data);
    });

    this.chainSignatureManager.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private convertToChainSignatureChain(targetChain: string): ChainId {
    // Convert solver chain names to Chain Signature chain IDs
    switch (targetChain.toLowerCase()) {
      case 'ethereum':
        return ChainId.ETHEREUM;
      case 'polygon':
        return ChainId.POLYGON;
      case 'arbitrum':
        return ChainId.ARBITRUM;
      case 'optimism':
        return ChainId.OPTIMISM;
      case 'bsc':
      case 'binance':
        return ChainId.BSC;
      case 'bitcoin':
        return ChainId.BITCOIN;
      case 'solana':
        return ChainId.SOLANA;
      default:
        throw new Error(`Unsupported target chain: ${targetChain}`);
    }
  }

  private getSignatureScheme(chainId: ChainId): 'secp256k1' | 'ed25519' {
    switch (chainId) {
      case ChainId.ETHEREUM:
      case ChainId.POLYGON:
      case ChainId.ARBITRUM:
      case ChainId.OPTIMISM:
      case ChainId.BSC:
      case ChainId.BITCOIN:
        return 'secp256k1';
      
      case ChainId.SOLANA:
      case ChainId.NEAR:
        return 'ed25519';
        
      default:
        return 'secp256k1';
    }
  }

  private prepareOrderForSigning(fusionOrder: FusionPlusOrder, solverAddress: string): any {
    // Prepare the Fusion+ order data for signing
    // This includes adding the solver address and formatting for the target chain
    
    return {
      ...fusionOrder,
      solver: solverAddress,
      timestamp: Date.now(),
      // Add chain-specific formatting here
      signatureRequired: true
    };
  }

  private processSignedOrder(
    originalOrder: FusionPlusOrder,
    signatureResponse: any,
    solverAddress: string
  ): any {
    // Process the signature response and create a complete signed order
    
    return {
      ...originalOrder,
      solver: solverAddress,
      signature: signatureResponse.signature,
      signedAt: Date.now(),
      signatureType: 'chain-signature-mpc',
      recoveryId: signatureResponse.recoveryId
    };
  }

  private async performSignatureVerification(
    signedOrder: any,
    chainId: ChainId
  ): Promise<{ isValid: boolean; solverAddress?: string }> {
    
    // Perform chain-specific signature verification
    // This would use the appropriate cryptographic libraries for each chain
    
    try {
      // For now, return a basic validation
      const hasValidSignature = signedOrder.signature && 
                              signedOrder.signature.startsWith('0x') && 
                              signedOrder.signature.length > 130;
      
      return {
        isValid: hasValidSignature,
        solverAddress: signedOrder.solver
      };
      
    } catch (error) {
      logger.error('Signature verification error:', error);
      return { isValid: false };
    }
  }

  private updateSigningStats(signingTime: number, success: boolean): void {
    if (success) {
      this.stats.ordersSignedSuccess++;
    } else {
      this.stats.ordersSignedFailed++;
    }

    // Update average signing time
    const totalSigned = this.stats.ordersSignedSuccess + this.stats.ordersSignedFailed;
    const alpha = 1 / totalSigned;
    this.stats.averageSigningTime = 
      this.stats.averageSigningTime * (1 - alpha) + signingTime * alpha;
  }

  /**
   * Get adapter statistics
   */
  getStats() {
    const chainSigStats = this.chainSignatureManager.getStats();
    
    return {
      ...this.stats,
      successRate: this.stats.ordersSignedTotal > 0 
        ? (this.stats.ordersSignedSuccess / this.stats.ordersSignedTotal) * 100 
        : 0,
      isInitialized: this.isInitialized,
      chainSignatureStats: chainSigStats
    };
  }

  /**
   * Stop the adapter
   */
  async stop(): Promise<void> {
    logger.info('🛑 Stopping Fusion Chain Signature Adapter...');
    this.isInitialized = false;
    logger.info('✅ Fusion Chain Signature Adapter stopped');
  }
}