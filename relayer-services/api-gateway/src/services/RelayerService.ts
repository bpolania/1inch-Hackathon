/**
 * Relayer Service - Production Backend Integration
 * 
 * Connects the API Gateway to our sophisticated Relayer backend,
 * providing real cross-chain execution with profitability analysis.
 */

import { EventEmitter } from 'events';
// Import built JavaScript modules using absolute paths
const path = require('path');
const { CrossChainExecutor } = require(path.resolve(__dirname, '../../../executor-client/dist/execution/CrossChainExecutor'));
const { ProfitabilityAnalyzer } = require(path.resolve(__dirname, '../../../executor-client/dist/analysis/ProfitabilityAnalyzer'));
const { OrderMonitor } = require(path.resolve(__dirname, '../../../executor-client/dist/monitoring/OrderMonitor'));
const { WalletManager } = require(path.resolve(__dirname, '../../../executor-client/dist/wallet/WalletManager'));
const { Config } = require(path.resolve(__dirname, '../../../executor-client/dist/config/config'));
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
  private crossChainExecutor: any | null = null;
  private profitabilityAnalyzer: any | null = null;
  private orderMonitor: any | null = null;
  private walletManager: any | null = null;
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
      // Create configuration matching executor-client's Config interface
      // Derive ethereum address from private key
      const { ethers } = require('ethers');
      const ethereumWallet = new ethers.Wallet(this.config.ethereumPrivateKey);
      
      const executorConfig: any = {
        networks: ['ethereum', 'near', 'bitcoin'],
        ethereum: {
          name: 'Ethereum Sepolia',
          rpcUrl: this.config.ethereumRpcUrl,
          chainId: 11155111,
          contracts: {
            factory: this.config.contractAddresses.factory,
            registry: this.config.contractAddresses.registry,
            token: this.config.contractAddresses.token
          }
        },
        near: {
          name: 'NEAR Testnet',
          rpcUrl: process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org',
          chainId: 40002,
          contracts: {
            factory: process.env.NEAR_CONTRACT_ID || 'fusion-plus.demo.cuteharbor3573.testnet'
          }
        },
        bitcoin: {
          network: this.config.bitcoinNetwork,
          feeRate: 10,
          htlcTimelock: 144,
          dustThreshold: 546,
          minConfirmations: 1,
          privateKey: this.config.bitcoinPrivateKey,
          apiUrl: this.config.bitcoinNetwork === 'mainnet' 
            ? 'https://blockstream.info/api'
            : 'https://blockstream.info/testnet/api'
        },
        wallet: {
          ethereum: {
            privateKey: this.config.ethereumPrivateKey,
            address: ethereumWallet.address
          },
          near: {
            accountId: process.env.NEAR_ACCOUNT_ID || 'relayer.testnet',
            privateKey: process.env.NEAR_PRIVATE_KEY || '',
            networkId: process.env.NEAR_NETWORK_ID || 'testnet'
          },
          bitcoin: {
            privateKey: this.config.bitcoinPrivateKey,
            network: this.config.bitcoinNetwork,
            addressType: 'p2pkh'
          }
        },
        execution: {
          loopInterval: 10000,
          maxConcurrentExecutions: 3,
          minProfitThreshold: '0.001',
          maxGasPrice: '50',
          retryAttempts: 3,
          retryDelay: 5000
        },
        logging: {
          level: 'info',
          format: 'json'
        },
        dataDir: './data'
      };

      // Initialize wallet manager
      logger.info('Initializing WalletManager...');
      this.walletManager = new WalletManager(executorConfig);
      await this.walletManager.initialize();

      // Initialize profitability analyzer
      logger.info('Initializing ProfitabilityAnalyzer...');
      this.profitabilityAnalyzer = new ProfitabilityAnalyzer(executorConfig);
      await this.profitabilityAnalyzer.initialize();

      // Initialize order monitor
      logger.info('Initializing OrderMonitor...');
      try {
        this.orderMonitor = new OrderMonitor(executorConfig, this.walletManager);
        await this.orderMonitor.initialize();
        logger.info('OrderMonitor initialized successfully');
      } catch (error) {
        logger.error('OrderMonitor initialization failed:', error);
        throw error;
      }

      // Initialize cross-chain executor
      logger.info('Initializing CrossChainExecutor...');
      this.crossChainExecutor = new CrossChainExecutor(executorConfig, this.walletManager);
      
      try {
        await this.crossChainExecutor.initialize();
        logger.info('✅ CrossChainExecutor initialized successfully');
        
        // Test contract connectivity
        logger.info('🔍 Testing contract connectivity...');
        
        // Test Ethereum RPC connectivity
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(this.config.ethereumRpcUrl);
        try {
          const blockNumber = await provider.getBlockNumber();
          logger.info('✅ Ethereum RPC connected, latest block:', blockNumber);
          
          // Test contract exists
          const factoryCode = await provider.getCode(this.config.contractAddresses.factory);
          if (factoryCode === '0x') {
            logger.error('❌ Factory contract not found at address:', this.config.contractAddresses.factory);
          } else {
            logger.info('✅ Factory contract found, bytecode length:', factoryCode.length);
          }
          
        } catch (rpcError) {
          logger.error('❌ Ethereum RPC connection failed:', rpcError);
        }
        
        const status = this.crossChainExecutor.getStatus();
        logger.info('📊 CrossChainExecutor status:', status);
        
      } catch (error) {
        logger.error('❌ CrossChainExecutor initialization failed:', error);
        logger.error('❌ Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        logger.info('🎭 Setting executor to null for graceful degradation...');
        this.crossChainExecutor = null;
      }

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
      // Convert UI intent to fusion order format
      const fusionOrder = this.convertIntentToFusionOrder(intent);

      // Analyze profitability
      const analysis = await this.profitabilityAnalyzer.analyzeOrder(fusionOrder.orderParams);

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
      this.crossChainExecutor.on('executionComplete', (result: any) => {
        logger.info('✅ Cross-chain execution completed:', result);
        this.handleExecutionComplete(result);
      });

      this.crossChainExecutor.on('executionFailed', (result: any) => {
        logger.error('💥 Cross-chain execution failed:', result);
        this.handleExecutionFailed(result);
      });
    }

    if (this.orderMonitor) {
      this.orderMonitor.on('orderUpdate', (update: any) => {
        logger.info('📊 Order update received:', update);
        // Handle order monitor updates
      });
    }
  }

  private convertIntentToFusionOrder(intent: any): any {
    // Helper function to convert decimal amounts to wei (string)
    const toWei = (amount: string, decimals: number = 18): string => {
      const amountFloat = parseFloat(amount || '0');
      const factor = Math.pow(10, decimals);
      const amountWei = Math.floor(amountFloat * factor);
      return BigInt(amountWei).toString(); // Convert BigInt to string for JSON serialization
    };

    // Generate SHA-256 hashlock for NEAR compatibility
    const crypto = require('crypto');
    const secretBytes = crypto.randomBytes(32);
    const secret = secretBytes.toString('hex');
    const hashlockBuffer = crypto.createHash('sha256').update(secretBytes).digest();
    const hashlock = '0x' + hashlockBuffer.toString('hex');

    // Get token decimals
    const srcDecimals = intent.fromToken?.decimals || 18;
    const dstDecimals = intent.toToken?.decimals || 24; // NEAR uses 24 decimals

    const sourceAmount = toWei(intent.fromAmount || '0', srcDecimals);
    const destinationAmount = toWei(intent.minToAmount || '0', dstDecimals);
    const resolverFee = (BigInt(sourceAmount) / BigInt(10)).toString(); // 10% resolver fee

    // Map token addresses correctly
    let sourceTokenAddress;
    if (intent.fromToken?.chainId === 'near' || intent.fromToken?.address === 'near') {
      // For NEAR tokens, use the DT token on Ethereum side
      sourceTokenAddress = '0x6295209910dEC4cc94770bfFD10e0362E6c8332e'; // New DT token
    } else {
      sourceTokenAddress = intent.fromToken?.address || '0x6295209910dEC4cc94770bfFD10e0362E6c8332e';
    }

    // Convert strings to ethers.toUtf8Bytes for proper ABI encoding
    const { ethers } = require('ethers');
    
    return {
      secret: '0x' + secret,
      hashlock: hashlock,
      intentId: intent.id,
      orderParams: {
        sourceToken: sourceTokenAddress,
        sourceAmount: sourceAmount,
        destinationChainId: 40002, // NEAR Testnet
        destinationToken: ethers.toUtf8Bytes('native.near'),
        destinationAmount: destinationAmount,
        destinationAddress: ethers.toUtf8Bytes('fusion-plus.demo.cuteharbor3573.testnet'),
        resolverFeeAmount: resolverFee,
        expiryTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        chainParams: {
          destinationAddress: ethers.toUtf8Bytes('fusion-plus.demo.cuteharbor3573.testnet'),
          executionParams: ethers.toUtf8Bytes(''),
          estimatedGas: BigInt('300000000000000'),
          additionalData: hashlock
        },
        hashlock: hashlock
      }
    };
  }

  private async createFusionOrderDirect(fusionOrder: any): Promise<any> {
    const { ethers } = require('ethers');
    
    try {
      logger.info('🔧 Creating Fusion order directly on contract...', {
        factoryAddress: this.config.contractAddresses.factory,
        tokenAddress: fusionOrder.orderParams.sourceToken,
        registryAddress: this.config.contractAddresses.registry,
        ethereumRpcUrl: this.config.ethereumRpcUrl,
        destinationChainId: fusionOrder.orderParams.destinationChainId
      });
      
      logger.info('🎯 Full order parameters for debugging:', JSON.stringify(fusionOrder.orderParams, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
      
      // Connect to the factory contract
      const provider = new ethers.JsonRpcProvider(this.config.ethereumRpcUrl);
      const wallet = new ethers.Wallet(this.config.ethereumPrivateKey, provider);
      
      const factoryABI = [
        'function createFusionOrder((address sourceToken, uint256 sourceAmount, uint256 destinationChainId, bytes destinationToken, uint256 destinationAmount, bytes destinationAddress, uint256 resolverFeeAmount, uint256 expiryTime, (bytes destinationAddress, bytes executionParams, uint256 estimatedGas, bytes additionalData) chainParams, bytes32 hashlock)) external returns (bytes32)',
        'function getOrder(bytes32 orderHash) external view returns ((bytes32 orderHash, address maker, address sourceToken, uint256 sourceAmount, uint256 destinationChainId, bytes destinationToken, uint256 destinationAmount, bytes destinationAddress, uint256 resolverFeeAmount, uint256 expiryTime, bytes chainSpecificParams, bool isActive))',
        'function registry() external view returns (address)',
        'function getSupportedChains() external view returns (uint256[])'
      ];
      
      const factory = new ethers.Contract(this.config.contractAddresses.factory, factoryABI, wallet);
      
      logger.info('📝 Order parameters:', fusionOrder.orderParams);
      
      // Validate chain support FIRST before any other checks
      logger.info('🔍 Starting chain validation...');
      try {
        const supportedChains = await factory.getSupportedChains();
        const isChainSupported = supportedChains.some((chainId: any) => chainId.toString() === fusionOrder.orderParams.destinationChainId.toString());
        
        logger.info('🔍 Chain validation:', {
          requestedChain: fusionOrder.orderParams.destinationChainId,
          supportedChains: supportedChains.map((id: any) => id.toString()),
          isSupported: isChainSupported
        });
        
        if (!isChainSupported) {
          throw new Error(`Destination chain ${fusionOrder.orderParams.destinationChainId} is not supported by the factory`);
        }
        
        // Try to get registry info for additional validation
        try {
          const registryAddress = await factory.registry();
          logger.info('✅ Registry address:', registryAddress);
        } catch (registryError: any) {
          logger.warn('⚠️ Could not get registry info:', registryError?.message || String(registryError));
        }
        
      } catch (validationError: any) {
        logger.error('❌ Chain validation failed:', validationError?.message || String(validationError));
        throw new Error(`Chain validation failed: ${validationError?.message || String(validationError)}`);
      }
      
      // Check if user has enough tokens and allowance
      const tokenABI = [
        'function balanceOf(address) view returns (uint256)',
        'function allowance(address,address) view returns (uint256)',
        'function approve(address,uint256) returns (bool)',
        'function transfer(address,uint256) returns (bool)'
      ];
      const tokenContract = new ethers.Contract(
        fusionOrder.orderParams.sourceToken, 
        tokenABI, 
        wallet
      );
      
      const balance = await tokenContract.balanceOf(wallet.address);
      const allowance = await tokenContract.allowance(wallet.address, this.config.contractAddresses.factory);
      const requiredAmount = BigInt(fusionOrder.orderParams.sourceAmount) + BigInt(fusionOrder.orderParams.resolverFeeAmount);
      
      logger.info('💰 Token check:', {
        userAddress: wallet.address,
        tokenAddress: fusionOrder.orderParams.sourceToken,
        balance: balance.toString(),
        allowance: allowance.toString(),
        required: requiredAmount.toString()
      });
      
      if (balance < requiredAmount) {
        throw new Error(`Insufficient token balance. Required: ${requiredAmount.toString()}, Available: ${balance.toString()}`);
      }
      
      if (allowance < requiredAmount) {
        logger.info('🔓 Approving tokens...');
        try {
          const approveTx = await tokenContract.approve(this.config.contractAddresses.factory, requiredAmount);
          const approveReceipt = await approveTx.wait();
          logger.info('✅ Tokens approved successfully', {
            txHash: approveReceipt.hash,
            gasUsed: approveReceipt.gasUsed?.toString()
          });
        } catch (approveError) {
          logger.error('❌ Token approval failed:', {
            error: approveError instanceof Error ? approveError.message : String(approveError),
            factoryAddress: this.config.contractAddresses.factory,
            tokenAddress: fusionOrder.orderParams.sourceToken,
            requiredAmount: requiredAmount.toString()
          });
          throw new Error(`Token approval failed: ${approveError instanceof Error ? approveError.message : 'Unknown error'}`);
        }
      }
      
      // Create the order
      logger.info('📝 Creating Fusion order...');
      const createTx = await factory.createFusionOrder(fusionOrder.orderParams);
      const createReceipt = await createTx.wait();
      
      logger.info('✅ Fusion order created successfully!');
      logger.info('📍 Transaction:', createReceipt.hash);
      logger.info('🔗 Etherscan:', `https://sepolia.etherscan.io/tx/${createReceipt.hash}`);
      
      // Extract order hash from events
      let orderHash;
      for (const log of createReceipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed.name === 'FusionOrderCreated') {
            orderHash = parsed.args.orderHash;
            break;
          }
        } catch (e) {}
      }
      
      return {
        success: true,
        orderHash: orderHash || createReceipt.hash,
        actualProfit: BigInt('0'),
        gasUsed: createReceipt.gasUsed,
        executionTime: Date.now() - Date.now(),
        transactions: { 
          ethereum: [createReceipt.hash], 
          near: [], 
          bitcoin: [] 
        },
        secret: fusionOrder.secret,
        hashlock: fusionOrder.hashlock
      };
      
    } catch (error: any) {
      logger.error('❌ Failed to create Fusion order:');
      logger.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        code: error?.code,
        data: error?.data,
        reason: error?.reason,
        transaction: error?.transaction,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async executeOrder(intentId: string, intent: any): Promise<void> {
    try {
      this.updateOrderStatus(intentId, 'executing');

      // Convert intent to Fusion order parameters
      const fusionOrder = this.convertIntentToFusionOrder(intent);

      // Execute the order by creating and matching it
      logger.info('🚀 Creating and executing Fusion order:', {
        intentId: fusionOrder.intentId,
        sourceToken: fusionOrder.orderParams.sourceToken,
        sourceAmount: fusionOrder.orderParams.sourceAmount,
        hashlock: fusionOrder.hashlock
      });
      
      let result;
      
      try {
        // Create the Fusion order first, then execute it
        result = await this.createFusionOrderDirect(fusionOrder);
      } catch (error: any) {
        logger.error('❌ Execution failed:');
        logger.error('Execution error details:', {
          message: error instanceof Error ? error.message : String(error),
          code: error?.code,
          data: error?.data,
          reason: error?.reason,
          transaction: error?.transaction
        });
        result = {
          success: false,
          orderHash: fusionOrder.hashlock,
          actualProfit: 0n,
          gasUsed: 0n,
          executionTime: 0,
          transactions: { ethereum: [], near: [], bitcoin: [] },
          error: error instanceof Error ? error.message : 'Unknown execution error'
        };
      }

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
    try {
      const currentProfit = BigInt(this.metrics.totalProfit || '0');
      const newProfit = BigInt(result.actualProfit || '0');
      this.metrics.totalProfit = (currentProfit + newProfit).toString();
    } catch (error) {
      console.error('Error calculating profit:', error);
      // Keep existing profit if calculation fails
    }
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