/**
 * Relayer Service - Production Backend Integration
 * 
 * Connects the API Gateway to our sophisticated Relayer backend,
 * providing real cross-chain execution with profitability analysis.
 */

import { EventEmitter } from 'events';
import { CrossChainExecutor } from '../../executor-client/src/execution/CrossChainExecutor';
import { ProfitabilityAnalyzer } from '../../executor-client/src/analysis/ProfitabilityAnalyzer';
import { OrderMonitor } from '../../executor-client/src/monitoring/OrderMonitor';
import { WalletManager } from '../../executor-client/src/wallet/WalletManager';
import { Config } from '../../executor-client/src/config/config';
import { logger } from '../utils/logger';

export interface RelayerConfig {
  ethereumRpcUrl: string;
  ethereumPrivateKey: string;
  bitcoinNetwork: 'mainnet' | 'testnet';
  bitcoinPrivateKey: string;
  contractAddresses: {
    factory: string;
    registry: string;
    token: string;
  };
}

export interface ProfitabilityAnalysis {
  isProfitable: boolean;
  estimatedProfit: string;
  gasEstimate: string;
  safetyDeposit: string;
  marginPercent: number;
  riskFactors: string[];
  recommendation: 'execute' | 'wait' | 'skip';
}

export interface OrderSubmission {
  intentId: string;
  orderHash: string;
  status: 'submitted' | 'executing' | 'completed' | 'failed';
  timestamp: number;
  transactions?: {
    ethereum: string[];
    bitcoin: string[];
    near: string[];
  };
  error?: string;
}

export interface RelayerMetrics {
  totalOrders: number;
  successfulOrders: number;
  failedOrders: number;
  averageExecutionTime: number;
  totalProfit: string;
  currentLoad: number;
}

export class RelayerService extends EventEmitter {
  private config: RelayerConfig;
  private crossChainExecutor: CrossChainExecutor | null = null;
  private profitabilityAnalyzer: ProfitabilityAnalyzer | null = null;
  private orderMonitor: OrderMonitor | null = null;
  private walletManager: WalletManager | null = null;
  private isInitialized = false;
  private orderSubmissions = new Map<string, OrderSubmission>();
  private metrics: RelayerMetrics = {
    totalOrders: 0,
    successfulOrders: 0,
    failedOrders: 0,
    averageExecutionTime: 0,
    totalProfit: '0',
    currentLoad: 0
  };

  constructor(config: RelayerConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info('🔧 Initializing Relayer Service...');

    try {
      // Create configuration for executor components
      const executorConfig: Config = {
        wallet: {
          ethereum: {
            privateKey: this.config.ethereumPrivateKey,
            rpcUrl: this.config.ethereumRpcUrl,
            address: '' // Will be derived from private key
          },
          bitcoin: {
            privateKey: this.config.bitcoinPrivateKey,
            network: this.config.bitcoinNetwork,
            apiUrl: this.config.bitcoinNetwork === 'mainnet' 
              ? 'https://blockstream.info/api'
              : 'https://blockstream.info/testnet/api'
          }
        },
        ethereum: {
          rpcUrl: this.config.ethereumRpcUrl,
          contracts: {
            factory: this.config.contractAddresses.factory,
            registry: this.config.contractAddresses.registry,
            token: this.config.contractAddresses.token
          }
        },
        bitcoin: {
          network: this.config.bitcoinNetwork,
          privateKey: this.config.bitcoinPrivateKey,
          apiUrl: this.config.bitcoinNetwork === 'mainnet' 
            ? 'https://blockstream.info/api'
            : 'https://blockstream.info/testnet/api',
          feeRate: 10,
          htlcTimelock: 144,
          minConfirmations: 1,
          dustThreshold: 546
        },
        execution: {
          maxConcurrentOrders: 5,
          retryAttempts: 3,
          retryDelay: 5000,
          gasLimitMultiplier: 1.2,
          profitabilityThreshold: 0.01
        },
        dataDir: './data'
      };

      // Initialize wallet manager
      this.walletManager = new WalletManager(executorConfig);
      await this.walletManager.initialize();

      // Initialize profitability analyzer
      this.profitabilityAnalyzer = new ProfitabilityAnalyzer(executorConfig);
      await this.profitabilityAnalyzer.initialize();

      // Initialize order monitor
      this.orderMonitor = new OrderMonitor(executorConfig);
      await this.orderMonitor.initialize();

      // Initialize cross-chain executor
      this.crossChainExecutor = new CrossChainExecutor(executorConfig, this.walletManager);
      await this.crossChainExecutor.initialize();

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      logger.info('✅ Relayer Service initialized successfully');

    } catch (error) {
      logger.error('💥 Failed to initialize Relayer Service:', error);
      throw error;
    }
  }

  /**
   * Analyze intent profitability
   */
  async analyzeProfitability(intent: any): Promise<ProfitabilityAnalysis> {
    if (!this.isInitialized || !this.profitabilityAnalyzer) {
      throw new Error('Relayer Service not initialized');
    }

    logger.info('📊 Analyzing intent profitability', {
      intentId: intent.id,
      sourceToken: intent.fromToken?.symbol,
      destToken: intent.toToken?.symbol,
      amount: intent.fromAmount
    });

    try {
      // Convert UI intent to executable order format
      const executableOrder = this.convertIntentToExecutableOrder(intent);

      // Analyze profitability
      const analysis = await this.profitabilityAnalyzer.analyzeOrder(executableOrder);

      const result: ProfitabilityAnalysis = {
        isProfitable: analysis.isProfitable,
        estimatedProfit: analysis.estimatedProfit.toString(),
        gasEstimate: analysis.estimatedGasCost.toString(),
        safetyDeposit: analysis.safetyDeposit?.toString() || '0',
        marginPercent: Math.round(analysis.profitMargin * 100),
        riskFactors: analysis.riskFactors || [],
        recommendation: analysis.isProfitable ? 'execute' : 'skip'
      };

      logger.info('✅ Profitability analysis completed', {
        intentId: intent.id,
        isProfitable: result.isProfitable,
        estimatedProfit: result.estimatedProfit,
        recommendation: result.recommendation
      });

      return result;

    } catch (error) {
      logger.error('💥 Profitability analysis failed:', error);
      throw error;
    }
  }

  /**
   * Submit intent to relayer for execution
   */
  async submitIntent(intent: any): Promise<OrderSubmission> {
    if (!this.isInitialized || !this.crossChainExecutor) {
      throw new Error('Relayer Service not initialized');
    }

    const intentId = intent.id;
    const orderHash = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('📤 Submitting intent to relayer for execution', {
      intentId,
      orderHash
    });

    try {
      // Create order submission record
      const submission: OrderSubmission = {
        intentId,
        orderHash,
        status: 'submitted',
        timestamp: Date.now()
      };

      this.orderSubmissions.set(intentId, submission);
      this.metrics.totalOrders++;

      // Execute in background
      this.executeOrder(intentId, intent).catch((error) => {
        logger.error('💥 Order execution failed:', error);
        this.updateOrderStatus(intentId, 'failed', error.message);
      });

      return submission;

    } catch (error) {
      logger.error('💥 Intent submission failed:', error);
      throw error;
    }
  }

  /**
   * Get execution status for an intent
   */
  getExecutionStatus(intentId: string): OrderSubmission | null {
    return this.orderSubmissions.get(intentId) || null;
  }

  /**
   * Start monitoring order execution
   */
  startMonitoring(intentId: string, callback: (update: OrderSubmission) => void): () => void {
    const handler = (update: OrderSubmission) => {
      if (update.intentId === intentId) {
        callback(update);
      }
    };

    this.on('orderUpdate', handler);

    // Return cleanup function
    return () => {
      this.off('orderUpdate', handler);
    };
  }

  /**
   * Get relayer metrics
   */
  getMetrics(): RelayerMetrics {
    return { ...this.metrics };
  }

  /**
   * Request manual execution of an order
   */
  async requestExecution(intentId: string): Promise<{ success: boolean; message: string }> {
    const submission = this.orderSubmissions.get(intentId);
    if (!submission) {
      return { success: false, message: 'Order not found' };
    }

    if (submission.status !== 'submitted') {
      return { success: false, message: `Order already ${submission.status}` };
    }

    // Trigger immediate execution
    this.updateOrderStatus(intentId, 'executing');
    
    return { success: true, message: 'Execution requested' };
  }

  /**
   * Cancel an order
   */
  async cancelOrder(intentId: string): Promise<{ success: boolean; message: string }> {
    const submission = this.orderSubmissions.get(intentId);
    if (!submission) {
      return { success: false, message: 'Order not found' };
    }

    if (submission.status === 'completed') {
      return { success: false, message: 'Order already completed' };
    }

    // Mark as failed (cancelled)
    this.updateOrderStatus(intentId, 'failed', 'Cancelled by user');
    
    return { success: true, message: 'Order cancelled' };
  }

  /**
   * Get relayer status and health
   */
  getStatus() {
    if (!this.isInitialized) {
      return {
        isHealthy: false,
        status: null
      };
    }

    return {
      isHealthy: true,
      status: {
        isRunning: true,
        queueLength: this.orderSubmissions.size,
        totalProcessed: this.metrics.totalOrders,
        successRate: this.metrics.totalOrders > 0 
          ? (this.metrics.successfulOrders / this.metrics.totalOrders) * 100 
          : 0
      }
    };
  }

  /**
   * Stop the relayer service
   */
  async stop(): Promise<void> {
    logger.info('🛑 Stopping Relayer Service...');
    
    if (this.orderMonitor) {
      await this.orderMonitor.stop();
    }
    
    this.orderSubmissions.clear();
    this.isInitialized = false;
    
    logger.info('✅ Relayer Service stopped');
  }

  // Private methods

  private setupEventHandlers(): void {
    if (this.crossChainExecutor) {
      this.crossChainExecutor.on('executionComplete', (result) => {
        logger.info('✅ Cross-chain execution completed:', result);
        this.handleExecutionComplete(result);
      });

      this.crossChainExecutor.on('executionFailed', (result) => {
        logger.error('💥 Cross-chain execution failed:', result);
        this.handleExecutionFailed(result);
      });
    }

    if (this.orderMonitor) {
      this.orderMonitor.on('orderUpdate', (update) => {
        logger.info('📊 Order update received:', update);
        // Handle order monitor updates
      });
    }
  }

  private convertIntentToExecutableOrder(intent: any): any {
    return {
      orderHash: intent.id,
      order: {
        chainId: intent.fromToken?.chainId || 1,
        maker: intent.user,
        srcToken: intent.fromToken?.address || '',
        srcAmount: BigInt(intent.fromAmount || '0'),
        dstToken: intent.toToken?.address || '',
        dstAmount: BigInt(intent.minToAmount || '0'),
        dstChainId: intent.toToken?.chainId || 1,
        dstExecutionParams: '0x', // Would encode execution parameters
        expiryTime: intent.deadline || Math.floor(Date.now() / 1000) + 300,
        hashlock: intent.hashlock || '0x' + '0'.repeat(64),
        destinationAmount: BigInt(intent.minToAmount || '0')
      }
    };
  }

  private async executeOrder(intentId: string, intent: any): Promise<void> {
    try {
      this.updateOrderStatus(intentId, 'executing');

      // Convert to executable order
      const executableOrder = this.convertIntentToExecutableOrder(intent);

      // Execute the order
      const result = await this.crossChainExecutor!.executeAtomicSwap(executableOrder);

      if (result.success) {
        // Update submission with transaction details
        const submission = this.orderSubmissions.get(intentId);
        if (submission) {
          submission.transactions = result.transactions;
        }
        
        this.updateOrderStatus(intentId, 'completed');
        this.metrics.successfulOrders++;
      } else {
        this.updateOrderStatus(intentId, 'failed', result.error);
        this.metrics.failedOrders++;
      }

      // Update execution time
      const executionTime = Date.now() - (this.orderSubmissions.get(intentId)?.timestamp || 0);
      this.updateAverageExecutionTime(executionTime);

    } catch (error) {
      this.updateOrderStatus(intentId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      this.metrics.failedOrders++;
    }
  }

  private updateOrderStatus(intentId: string, status: OrderSubmission['status'], error?: string): void {
    const submission = this.orderSubmissions.get(intentId);
    if (!submission) return;

    submission.status = status;
    if (error) {
      submission.error = error;
    }

    this.orderSubmissions.set(intentId, submission);
    this.emit('orderUpdate', submission);
  }

  private handleExecutionComplete(result: any): void {
    // Handle successful execution
    this.metrics.totalProfit = (BigInt(this.metrics.totalProfit) + result.actualProfit).toString();
  }

  private handleExecutionFailed(result: any): void {
    // Handle failed execution
    logger.error('Execution failed for order:', result.orderHash);
  }

  private updateAverageExecutionTime(executionTime: number): void {
    const alpha = 0.1;
    if (this.metrics.averageExecutionTime === 0) {
      this.metrics.averageExecutionTime = executionTime;
    } else {
      this.metrics.averageExecutionTime = 
        this.metrics.averageExecutionTime * (1 - alpha) + executionTime * alpha;
    }
  }
}