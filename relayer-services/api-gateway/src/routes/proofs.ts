import { Router } from 'express';
import { param, validationResult } from 'express-validator';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { ProofService } from '../services/ProofService';

const router = Router();

// Initialize ProofService (will be injected via middleware in production)
let proofService: ProofService | null = null;

// Middleware to inject ProofService
router.use((req: any, res: any, next: any) => {
  if (!proofService) {
    proofService = new ProofService({
      ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/PROJECT_ID',
      nearRpcUrl: process.env.NEAR_RPC_URL,
      bitcoinRpcUrl: process.env.BITCOIN_RPC_URL,
      bitcoinRpcUser: process.env.BITCOIN_RPC_USER,
      bitcoinRpcPass: process.env.BITCOIN_RPC_PASS,
    });
  }
  req.proofService = proofService;
  next();
});

// Types and interfaces
interface EscrowLockProof {
  txHash: string;
  blockNumber: number;
  blockHash: string;
  logIndex: number;
  eventSignature: string;
}

interface NEARExecutionProof {
  nearProof: {
    transactionId: string;
    blockHash: string;
    blockHeight: number;
    receiptProof: string;
    nearBlocksUrl: string;
  } | null;
  executionStatus: 'pending' | 'completed' | 'failed';
}

interface BitcoinExecutionProof {
  bitcoinProof: {
    transactionId: string;
    blockHash?: string;
    blockHeight?: number;
    confirmations?: number;
    htlcUnlockProof?: string;
    blockstreamUrl: string;
    status?: string;
  } | null;
  executionStatus: 'pending' | 'completed' | 'failed';
}

interface SettlementProof {
  tokenTransfer: {
    fromAddress: string;
    toAddress: string;
    tokenAmount: string;
    transactionHash: string;
    blockNumber: number;
  } | null;
  balanceProof: {
    balanceBefore: string;
    balanceAfter: string;
    balanceChange: string;
    proofBlock: number;
  } | null;
  explorerUrl: string;
  verificationStatus: 'pending' | 'confirmed' | 'failed';
}

// Basic ABIs for contract interactions
const ESCROW_ABI = [
  "event EscrowCreated(bytes32 indexed orderHash, address escrowAddress, uint256 amount)",
  "function getBalance() external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

/**
 * GET /api/proofs/escrow/:orderHash
 * Get cryptographic proof of escrow lock
 */
router.get('/escrow/:orderHash', [
  param('orderHash').isLength({ min: 66, max: 66 }).withMessage('Invalid order hash format')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { orderHash } = req.params;
    
    logger.info(`Generating escrow proof for order: ${orderHash}`);

    // Use ProofService to generate the proof
    const proofData = await req.proofService.generateEscrowProof(orderHash);
    
    const response = {
      success: true,
      data: proofData,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Escrow proof generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate escrow proof',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/proofs/cross-chain/:orderHash
 * Get proof of cross-chain execution and atomic coordination
 */
router.get('/cross-chain/:orderHash', [
  param('orderHash').isLength({ min: 66, max: 66 }).withMessage('Invalid order hash format')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { orderHash } = req.params;
    
    logger.info(`Generating cross-chain proof for order: ${orderHash}`);

    // Use ProofService to generate the proof
    const proofData = await req.proofService.generateCrossChainProof(orderHash);
    
    const response = {
      success: true,
      data: proofData,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Cross-chain proof generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate cross-chain proof',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/proofs/settlement/:orderHash/:userAddress
 * Get proof that user received tokens on destination chain
 */
router.get('/settlement/:orderHash/:userAddress', [
  param('orderHash').isLength({ min: 66, max: 66 }).withMessage('Invalid order hash'),
  param('userAddress').isLength({ min: 42, max: 42 }).matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid Ethereum address format')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { orderHash, userAddress } = req.params;
    
    logger.info(`Generating settlement proof for order: ${orderHash}, user: ${userAddress}`);

    // Use ProofService to generate the proof
    const proofData = await req.proofService.generateSettlementProof(orderHash, userAddress);
    
    const response = {
      success: true,
      data: proofData,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Settlement proof generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate settlement proof',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/proofs/health
 * Get health status of proof services
 */
router.get('/health', async (req: any, res: any) => {
  try {
    const healthStatus = await req.proofService.healthCheck();
    
    res.json({
      success: true,
      data: {
        service: 'proof-api',
        version: '1.0.0',
        ...healthStatus
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Proof health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Service health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/proofs/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', async (req: any, res: any) => {
  try {
    const cacheStats = req.proofService.getCacheStats();
    
    res.json({
      success: true,
      data: {
        ...cacheStats,
        summary: {
          totalEntries: cacheStats.size,
          activeEntries: cacheStats.entries.filter((e: any) => !e.isExpired).length,
          expiredEntries: cacheStats.entries.filter((e: any) => e.isExpired).length,
          hitRate: 'N/A' // Could be implemented with hit/miss counters
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/proofs/cache
 * Clear proof cache
 */
router.delete('/cache', async (req: any, res: any) => {
  try {
    const statsBefore = req.proofService.getCacheStats();
    req.proofService.clearCache();
    
    res.json({
      success: true,
      data: {
        message: 'Cache cleared successfully',
        entriesRemoved: statsBefore.size
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Extend Express Request interface for ProofService
declare global {
  namespace Express {
    interface Request {
      proofService: ProofService;
    }
  }
}

export { router as proofRoutes };