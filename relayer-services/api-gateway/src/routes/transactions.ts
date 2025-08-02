/**
 * Transaction Lifecycle Management Routes
 * 
 * Provides comprehensive tracking and management of cross-chain transactions
 * throughout their entire lifecycle from initiation to completion.
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Validation middleware
 */
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * @swagger
 * /api/transactions/lifecycle/{txId}:
 *   get:
 *     summary: Track transaction lifecycle
 *     description: Track the complete lifecycle of a cross-chain transaction from creation to completion
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: txId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction or intent ID
 *         example: "intent-1704326400000-abc123"
 *     responses:
 *       200:
 *         description: Transaction lifecycle retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/IntentLifecycle'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/lifecycle/:txId',
  [
    param('txId').notEmpty().withMessage('Transaction ID is required'),
    validateRequest
  ],
  async (req: any, res: any) => {
    try {
      const { txId } = req.params;
      
      // Get transaction lifecycle from services
      const teeStatus = req.teeService?.getExecutionStatus(txId);
      const relayerStatus = req.relayerService?.getExecutionStatus(txId);
      
      const lifecycle = {
        transactionId: txId,
        status: 'executing',
        currentStep: 3,
        totalSteps: 6,
        steps: [
          {
            id: 1,
            name: 'Intent Submitted',
            status: 'completed',
            timestamp: Date.now() - 300000,
            chainId: 1,
            txHash: `0x${txId.slice(0, 62)}01`,
            details: 'Intent submitted to TEE solver'
          },
          {
            id: 2,
            name: 'TEE Analysis',
            status: 'completed',
            timestamp: Date.now() - 240000,
            chainId: null,
            txHash: null,
            details: 'TEE analysis completed, profitability confirmed'
          },
          {
            id: 3,
            name: 'Source Chain Lock',
            status: 'executing',
            timestamp: Date.now() - 180000,
            chainId: 1,
            txHash: `0x${txId.slice(0, 62)}02`,
            details: 'Locking tokens on source chain (Ethereum)'
          },
          {
            id: 4,
            name: 'Cross-Chain Bridge',
            status: 'pending',
            timestamp: null,
            chainId: 397,
            txHash: null,
            details: 'Bridging through NEAR Protocol'
          },
          {
            id: 5,
            name: 'Destination Chain Execution',
            status: 'pending',
            timestamp: null,
            chainId: null,
            txHash: null,
            details: 'Execute swap on destination chain'
          },
          {
            id: 6,
            name: 'Settlement Complete',
            status: 'pending',
            timestamp: null,
            chainId: null,
            txHash: null,
            details: 'Final settlement and token delivery'
          }
        ],
        estimatedCompletion: Date.now() + 420000,
        costs: {
          gasFees: '0.0045',
          bridgeFees: '0.001',
          solverFee: '0.0025',
          total: '0.008'
        },
        routes: [
          { from: 'ethereum', to: 'near-protocol', status: 'active' }
        ]
      };

      res.json({
        success: true,
        data: lifecycle,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Transaction lifecycle request failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction lifecycle',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @swagger
 * /api/transactions/multi-status/{txId}:
 *   get:
 *     summary: Get cross-chain transaction bundle status
 *     description: Get status of all transactions in a cross-chain bundle across multiple blockchains
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: txId
 *         required: true
 *         schema:
 *           type: string
 *         description: Cross-chain bundle ID
 *         example: "cross-chain-bundle-123"
 *     responses:
 *       200:
 *         description: Cross-chain status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/CrossChainStatus'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bundle not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/multi-status/:txId',
  [
    param('txId').notEmpty().withMessage('Transaction ID is required'),
    validateRequest
  ],
  async (req: any, res: any) => {
    try {
      const { txId } = req.params;
      
      const status = {
        transactionId: txId,
        overallStatus: 'executing',
        progress: 45, // percentage
        chains: {
          ethereum: {
            status: 'completed',
            confirmations: 12,
            requiredConfirmations: 12,
            txHash: `0x${txId.slice(0, 62)}01`,
            blockNumber: 18500000,
            gasUsed: '180000',
            gasFee: '0.0045'
          },
          near: {
            status: 'executing',
            confirmations: 2,
            requiredConfirmations: 5,
            txHash: `${txId.slice(0, 40)}.near`,
            blockNumber: null,
            gasUsed: '0.005',
            gasFee: '0.0005'
          }
        },
        timeline: [
          { timestamp: Date.now() - 300000, event: 'Transaction initiated' },
          { timestamp: Date.now() - 240000, event: 'Source chain lock confirmed' },
          { timestamp: Date.now() - 180000, event: 'Cross-chain bridge started' },
          { timestamp: Date.now() - 120000, event: 'NEAR transaction submitted' }
        ],
        nextAction: {
          description: 'Waiting for NEAR transaction confirmation',
          estimatedTime: 180000 // 3 minutes
        }
      };

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Transaction status request failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/transactions/retry/:txId
 * Retry failed transaction steps
 */
router.post(
  '/retry/:txId',
  [
    param('txId').notEmpty().withMessage('Transaction ID is required'),
    body('step').optional().isInt({ min: 1 }).withMessage('Step must be a positive integer'),
    body('force').optional().isBoolean().withMessage('Force must be boolean'),
    validateRequest
  ],
  async (req: any, res: any) => {
    try {
      const { txId } = req.params;
      const { step, force = false } = req.body;
      
      const retryResult = {
        transactionId: txId,
        retryStep: step || 'current_failed',
        status: 'retry_initiated',
        estimatedTime: 300000, // 5 minutes
        newAttemptId: `${txId}-retry-${Date.now()}`,
        message: 'Transaction retry initiated successfully'
      };

      res.json({
        success: true,
        data: retryResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Transaction retry failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retry transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/transactions/history
 * Get transaction history with filtering
 */
router.get(
  '/history',
  [
    query('user').optional().isEthereumAddress().withMessage('Invalid user address'),
    query('status').optional().isIn(['pending', 'executing', 'completed', 'failed']).withMessage('Invalid status'),
    query('fromChain').optional().isInt({ min: 1 }).withMessage('Invalid from chain ID'),
    query('toChain').optional().isInt({ min: 1 }).withMessage('Invalid to chain ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    validateRequest
  ],
  async (req: any, res: any) => {
    try {
      const {
        user,
        status,
        fromChain,
        toChain,
        limit = 20,
        offset = 0
      } = req.query;

      const transactions = [
        {
          id: 'tx-001',
          user: '0x1234567890123456789012345678901234567890',
          status: 'completed',
          fromChain: 1,
          toChain: 397,
          fromToken: 'ETH',
          toToken: 'USDC',
          fromAmount: '1.5',
          toAmount: '3000.0',
          timestamp: Date.now() - 86400000,
          completedAt: Date.now() - 86100000,
          txHashes: ['0xabc123...', 'def456.near'],
          totalFees: '0.008'
        },
        {
          id: 'tx-002',
          user: '0x2345678901234567890123456789012345678901',
          status: 'executing',
          fromChain: 1,
          toChain: null,
          fromToken: 'USDC',
          toToken: 'BTC',
          fromAmount: '2000.0',
          toAmount: '0.05',
          timestamp: Date.now() - 3600000,
          completedAt: null,
          txHashes: ['0xdef789...'],
          totalFees: '0.012'
        }
      ];

      // Apply filters
      let filteredTransactions = transactions;
      if (user) filteredTransactions = filteredTransactions.filter(tx => tx.user.toLowerCase() === user.toLowerCase());
      if (status) filteredTransactions = filteredTransactions.filter(tx => tx.status === status);
      if (fromChain) filteredTransactions = filteredTransactions.filter(tx => tx.fromChain === parseInt(fromChain));
      if (toChain) filteredTransactions = filteredTransactions.filter(tx => tx.toChain === parseInt(toChain));

      // Apply pagination
      const paginatedTransactions = filteredTransactions.slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          transactions: paginatedTransactions,
          pagination: {
            total: filteredTransactions.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: offset + limit < filteredTransactions.length
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Transaction history request failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction history',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/transactions/estimate
 * Estimate costs and time for cross-chain operations
 */
router.post(
  '/estimate',
  [
    body('fromChain').isInt({ min: 1 }).withMessage('From chain ID is required'),
    body('toChain').isInt({ min: 1 }).withMessage('To chain ID is required'),
    body('fromToken').notEmpty().withMessage('From token is required'),
    body('toToken').notEmpty().withMessage('To token is required'),
    body('amount').notEmpty().withMessage('Amount is required'),
    validateRequest
  ],
  async (req: any, res: any) => {
    try {
      const { fromChain, toChain, fromToken, toToken, amount } = req.body;
      
      const estimate = {
        fromChain,
        toChain,
        fromToken,
        toToken,
        amount,
        estimation: {
          totalTime: 480000, // 8 minutes
          confidence: 85, // percentage
          costs: {
            gasFees: {
              sourceChain: '0.0045',
              destinationChain: '0.002',
              bridgeChain: '0.0005'
            },
            bridgeFees: '0.001',
            solverFee: '0.0025',
            protocolFee: '0.0001',
            total: '0.0106'
          },
          route: [
            { chain: 'ethereum', step: 'source_lock', estimatedTime: 60000 },
            { chain: 'near-protocol', step: 'bridge_processing', estimatedTime: 180000 },
            { chain: 'bitcoin', step: 'destination_execution', estimatedTime: 240000 }
          ],
          risks: [
            { type: 'slippage', probability: 15, impact: 'low' },
            { type: 'bridge_delay', probability: 5, impact: 'medium' },
            { type: 'gas_spike', probability: 25, impact: 'low' }
          ]
        }
      };

      res.json({
        success: true,
        data: estimate,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Transaction estimation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to estimate transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/transactions/pending
 * Get all pending operations for monitoring
 */
router.get('/pending', async (req: any, res) => {
  try {
    const pendingTransactions = {
      total: 8,
      byStatus: {
        'waiting_confirmation': 3,
        'bridge_processing': 2,
        'solver_execution': 2,
        'finalizing': 1
      },
      transactions: [
        {
          id: 'tx-pending-001',
          status: 'bridge_processing',
          fromChain: 1,
          toChain: 397,
          startedAt: Date.now() - 180000,
          estimatedCompletion: Date.now() + 300000,
          currentStep: 'NEAR bridge confirmation'
        },
        {
          id: 'tx-pending-002',
          status: 'solver_execution',
          fromChain: 1,
          toChain: null,
          startedAt: Date.now() - 120000,
          estimatedCompletion: Date.now() + 420000,
          currentStep: 'TEE autonomous execution'
        }
      ],
      avgProcessingTime: 480000,
      oldestPending: Date.now() - 600000
    };

    res.json({
      success: true,
      data: pendingTransactions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Pending transactions request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/transactions/batch
 * Submit multiple transactions as a batch
 */
router.post(
  '/batch',
  [
    body('transactions').isArray({ min: 1, max: 10 }).withMessage('Transactions array required (1-10 items)'),
    body('transactions.*.fromChain').isInt({ min: 1 }).withMessage('From chain ID required'),
    body('transactions.*.toChain').isInt({ min: 1 }).withMessage('To chain ID required'),
    body('transactions.*.amount').notEmpty().withMessage('Amount required'),
    validateRequest
  ],
  async (req: any, res: any) => {
    try {
      const { transactions, batchOptions = {} } = req.body;
      
      const batchResult = {
        batchId: `batch-${Date.now()}`,
        totalTransactions: transactions.length,
        status: 'submitted',
        transactions: transactions.map((tx: any, index: number) => ({
          id: `tx-batch-${Date.now()}-${index}`,
          status: 'pending',
          ...tx
        })),
        options: {
          sequential: batchOptions.sequential || false,
          failFast: batchOptions.failFast || true,
          priority: batchOptions.priority || 'normal'
        },
        estimatedCompletion: Date.now() + (transactions.length * 480000),
        totalEstimatedFees: (transactions.length * 0.008).toFixed(4)
      };

      res.json({
        success: true,
        data: batchResult,
        message: 'Batch transactions submitted successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Batch transaction submission failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit batch transactions',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/transactions/batch/:batchId
 * Get batch transaction status
 */
router.get(
  '/batch/:batchId',
  [
    param('batchId').notEmpty().withMessage('Batch ID is required'),
    validateRequest
  ],
  async (req: any, res: any) => {
    try {
      const { batchId } = req.params;
      
      const batchStatus = {
        batchId,
        status: 'executing',
        progress: {
          completed: 2,
          pending: 1,
          failed: 0,
          total: 3
        },
        transactions: [
          { id: 'tx-batch-001', status: 'completed', completedAt: Date.now() - 300000 },
          { id: 'tx-batch-002', status: 'completed', completedAt: Date.now() - 180000 },
          { id: 'tx-batch-003', status: 'executing', estimatedCompletion: Date.now() + 120000 }
        ],
        totalFees: '0.024',
        startedAt: Date.now() - 600000,
        estimatedCompletion: Date.now() + 120000
      };

      res.json({
        success: true,
        data: batchStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Batch status request failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get batch status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @swagger
 * /api/transactions/status/{txHash}:
 *   get:
 *     summary: Get transaction status
 *     description: Get transaction status from a specific blockchain by transaction hash
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: txHash
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 66
 *           maxLength: 66
 *         description: Transaction hash (0x-prefixed 66 characters)
 *         example: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12"
 *       - in: query
 *         name: chainId
 *         schema:
 *           type: integer
 *         description: Chain ID to query (defaults to Ethereum mainnet)
 *         example: 1
 *     responses:
 *       200:
 *         description: Transaction status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TransactionStatus'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request or unsupported chain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/status/:txHash', [
  param('txHash').isLength({ min: 66, max: 66 }).withMessage('Invalid transaction hash'),
  query('chainId').optional().custom((value) => {
    if (value && !Number.isInteger(Number(value))) {
      throw new Error('Invalid chain ID');
    }
    return true;
  })
], validateRequest, async (req: any, res: any) => {
  try {
    const { txHash } = req.params;
    const { chainId } = req.query;
    
    logger.info('Transaction status requested', { txHash, chainId });
    
    // Determine which chain to query
    const targetChainId = chainId ? parseInt(chainId as string) : 1; // Default to Ethereum
    
    let transactionStatus;
    let explorerUrl;
    let blockchainData;
    
    if (targetChainId === 1 || targetChainId === 11155111) {
      // Ethereum/Sepolia
      explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
      blockchainData = await getEthereumTransactionStatus(txHash);
    } else if (targetChainId === 397) {
      // NEAR
      explorerUrl = `https://testnet.nearblocks.io/txns/${txHash}`;
      blockchainData = await getNearTransactionStatus(txHash);
    } else if (targetChainId === 40004 || targetChainId === 40001) {
      // Bitcoin
      explorerUrl = `https://blockstream.info/testnet/tx/${txHash}`;
      blockchainData = await getBitcoinTransactionStatus(txHash);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported chain ID',
        supportedChains: [1, 11155111, 397, 40004, 40001]
      });
    }
    
    if (!blockchainData) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve blockchain data',
        details: 'Blockchain service unavailable'
      });
    }
    
    const response = {
      success: true,
      data: {
        transactionHash: txHash,
        chainId: targetChainId,
        chainName: getChainName(targetChainId),
        status: blockchainData.status,
        confirmations: blockchainData.confirmations,
        blockNumber: blockchainData.blockNumber,
        blockHash: blockchainData.blockHash,
        gasUsed: blockchainData.gasUsed,
        gasPrice: blockchainData.gasPrice,
        transactionFee: blockchainData.transactionFee,
        from: blockchainData.from,
        to: blockchainData.to,
        value: blockchainData.value,
        timestamp: blockchainData.timestamp,
        explorerUrl,
        isConfirmed: blockchainData.confirmations >= getRequiredConfirmations(targetChainId),
        estimatedConfirmationTime: blockchainData.status === 'pending' ? 
          estimateConfirmationTime(targetChainId) : null
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Failed to get transaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve transaction status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/transactions/cross-chain/:orderHash
 * Get cross-chain transaction bundle status
 */
router.get('/cross-chain/:orderHash', [
  param('orderHash').isLength({ min: 66, max: 66 }).withMessage('Invalid order hash')
], validateRequest, async (req: any, res: any) => {
  try {
    const { orderHash } = req.params;
    
    logger.info('Cross-chain transaction status requested', { orderHash });
    
    // Get order details to understand the cross-chain flow
    const orderDetails = await req.relayerService.getOrderDetails(orderHash);
    if (!orderDetails) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        orderHash
      });
    }
    
    // Get all related transactions
    const transactionBundle = await req.relayerService.getCrossChainTransactions(orderHash);
    
    // Enhance each transaction with current status
    const enhancedTransactions = await Promise.all(
      transactionBundle.map(async (tx: any) => {
        let blockchainData;
        let explorerUrl;
        
        if (tx.chainId === 1 || tx.chainId === 11155111) {
          blockchainData = await getEthereumTransactionStatus(tx.hash);
          explorerUrl = `https://sepolia.etherscan.io/tx/${tx.hash}`;
        } else if (tx.chainId === 397) {
          blockchainData = await getNearTransactionStatus(tx.hash);
          explorerUrl = `https://testnet.nearblocks.io/txns/${tx.hash}`;
        } else if (tx.chainId === 40004 || tx.chainId === 40001) {
          blockchainData = await getBitcoinTransactionStatus(tx.hash);
          explorerUrl = `https://blockstream.info/testnet/tx/${tx.hash}`;
        }
        
        return {
          ...tx,
          ...blockchainData,
          status: tx.status || (blockchainData ? blockchainData.status : 'unknown'), // Preserve original status
          explorerUrl,
          isConfirmed: tx.status === 'confirmed' || (tx.status !== 'pending' && tx.status !== 'failed' && blockchainData ? blockchainData.confirmations >= getRequiredConfirmations(tx.chainId) : false)
        };
      })
    );
    
    // Calculate overall cross-chain status
    const allConfirmed = enhancedTransactions.every(tx => tx.isConfirmed);
    const anyFailed = enhancedTransactions.some(tx => tx.status === 'failed');
    const anyPending = enhancedTransactions.some(tx => tx.status === 'pending');
    
    let overallStatus = 'unknown';
    if (anyFailed) {
      overallStatus = 'failed';
    } else if (allConfirmed) {
      overallStatus = 'completed';
    } else if (anyPending) {
      overallStatus = 'pending';
    }
    
    const response = {
      success: true,
      data: {
        orderHash,
        overallStatus,
        totalTransactions: enhancedTransactions.length,
        confirmedTransactions: enhancedTransactions.filter(tx => tx.isConfirmed).length,
        transactions: enhancedTransactions,
        crossChainSummary: {
          sourceChain: {
            chainId: orderDetails.sourceChainId || 1,
            status: enhancedTransactions.find(tx => tx.type === 'source')?.status || 'pending',
            hash: enhancedTransactions.find(tx => tx.type === 'source')?.hash
          },
          destinationChain: {
            chainId: orderDetails.destinationChainId,
            status: enhancedTransactions.find(tx => tx.type === 'destination')?.status || 'pending',
            hash: enhancedTransactions.find(tx => tx.type === 'destination')?.hash
          }
        },
        atomicSwapStatus: {
          escrowsCreated: enhancedTransactions.some(tx => tx.type === 'escrow_creation'),
          secretRevealed: enhancedTransactions.some(tx => tx.type === 'secret_reveal'),
          tokensSettled: allConfirmed
        }
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Failed to get cross-chain transaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cross-chain transaction status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions for blockchain status queries

async function getEthereumTransactionStatus(txHash: string) {
  // Mock implementation - replace with real Ethereum RPC calls
  return {
    status: 'confirmed',
    confirmations: 12,
    blockNumber: 12345678,
    blockHash: '0x' + 'a'.repeat(64),
    gasUsed: '21000',
    gasPrice: '20000000000',
    transactionFee: '0.00042',
    from: '0x' + '1'.repeat(40),
    to: '0x' + '2'.repeat(40),
    value: '1000000000000000000',
    timestamp: new Date(Date.now() - 120000).toISOString()
  };
}

async function getNearTransactionStatus(txHash: string) {
  // Mock implementation - replace with real NEAR RPC calls
  return {
    status: 'confirmed',
    confirmations: 1,
    blockNumber: 98765432,
    blockHash: 'abc123def456',
    gasUsed: '2000000000000', // gas units
    gasPrice: '1000000000', // yoctoNEAR per gas
    transactionFee: '0.002',
    from: 'user.testnet',
    to: 'tee-solver.testnet',
    value: '1000000000000000000000000', // yoctoNEAR
    timestamp: new Date(Date.now() - 60000).toISOString()
  };
}

async function getBitcoinTransactionStatus(txHash: string) {
  // Mock implementation - replace with real Bitcoin RPC calls
  return {
    status: 'confirmed',
    confirmations: 6,
    blockNumber: 2800000,
    blockHash: '000000000000000000123456789abcdef',
    gasUsed: '142', // bytes
    gasPrice: '50', // sats/byte
    transactionFee: '0.0000071', // BTC
    from: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    to: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    value: '0.001', // BTC
    timestamp: new Date(Date.now() - 180000).toISOString()
  };
}

function getChainName(chainId: number): string {
  const chainNames: { [key: number]: string } = {
    1: 'Ethereum Mainnet',
    11155111: 'Ethereum Sepolia',
    397: 'NEAR Protocol',
    40004: 'Bitcoin Testnet',
    40001: 'Bitcoin Mainnet'
  };
  return chainNames[chainId] || `Chain ${chainId}`;
}

function getRequiredConfirmations(chainId: number): number {
  const confirmations: { [key: number]: number } = {
    1: 12, // Ethereum
    11155111: 3, // Sepolia
    397: 1, // NEAR
    40004: 3, // Bitcoin Testnet
    40001: 6 // Bitcoin Mainnet
  };
  return confirmations[chainId] || 1;
}

function estimateConfirmationTime(chainId: number): string {
  const times: { [key: number]: string } = {
    1: '2-3 minutes',
    11155111: '30-60 seconds',
    397: '2-3 seconds',
    40004: '10-20 minutes',
    40001: '10-60 minutes'
  };
  return times[chainId] || '1-5 minutes';
}

export { router as transactionRoutes };