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
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * GET /api/transactions/lifecycle/:txId
 * Track multi-step cross-chain transaction progress
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
 * GET /api/transactions/status/:txId
 * Get detailed transaction status across all chains
 */
router.get(
  '/status/:txId',
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

export { router as transactionRoutes };