/**
 * 1inch API Proxy Routes
 * 
 * Provides proxy endpoints for 1inch API with caching and error handling
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
 * GET /api/1inch/quote
 * Get 1inch quote for token swap
 */
router.get('/quote', [
  query('chainId').isNumeric().withMessage('Chain ID is required'),
  query('fromToken').isString().notEmpty().withMessage('From token is required'),
  query('toToken').isString().notEmpty().withMessage('To token is required'),
  query('amount').isString().notEmpty().withMessage('Amount is required'),
  query('slippage').isNumeric().optional()
], validateRequest, async (req, res) => {
  try {
    const { chainId, fromToken, toToken, amount, slippage = 1 } = req.query;
    
    logger.info('1inch quote requested', { chainId, fromToken, toToken, amount });
    
    // Simulate 1inch API call - in production this would proxy to real 1inch API
    const mockQuote = {
      outputAmount: (BigInt(amount as string) * BigInt(2000)).toString(), // Mock 2000:1 ratio
      formattedOutput: ((Number(amount) * 2000) / 1e18).toFixed(6),
      priceImpact: 0.15,
      route: 'Uniswap V3 → 1inch → Curve',
      gasEstimate: '180000',
      gasPrice: '15000000000',
      protocols: ['Uniswap V3', '1inch', 'Curve'],
      confidence: 0.96,
      timestamp: Date.now()
    };
    
    res.json({
      success: true,
      data: mockQuote,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('1inch quote failed:', error);
    res.status(500).json({
      success: false,
      error: '1inch quote failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/1inch/tokens/:chainId
 * Get supported tokens for a chain
 */
router.get('/tokens/:chainId', [
  param('chainId').isNumeric().withMessage('Chain ID is required')
], validateRequest, async (req, res) => {
  try {
    const { chainId } = req.params;
    
    // Mock token list - in production this would proxy to real 1inch API
    const mockTokens = {
      '1': { // Ethereum
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': {
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          logoURI: 'https://token-icons.s3.amazonaws.com/eth.png'
        },
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          logoURI: 'https://token-icons.s3.amazonaws.com/usdc.png'
        },
        '0xdac17f958d2ee523a2206206994597c13d831ec7': {
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          logoURI: 'https://token-icons.s3.amazonaws.com/usdt.png'
        }
      }
    };
    
    const tokens = mockTokens[chainId as keyof typeof mockTokens] || {};
    
    res.json({
      success: true,
      data: tokens,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('1inch tokens request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tokens',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/1inch/swap
 * Create 1inch swap transaction
 */
router.post('/swap', [
  body('chainId').isNumeric().withMessage('Chain ID is required'),
  body('fromToken').isString().notEmpty().withMessage('From token is required'),
  body('toToken').isString().notEmpty().withMessage('To token is required'),
  body('amount').isString().notEmpty().withMessage('Amount is required'),
  body('fromAddress').isString().notEmpty().withMessage('From address is required'),
  body('slippage').isNumeric().optional(),
  body('disableEstimate').isBoolean().optional()
], validateRequest, async (req, res) => {
  try {
    const swapParams = req.body;
    
    logger.info('1inch swap requested', { 
      chainId: swapParams.chainId, 
      fromToken: swapParams.fromToken, 
      toToken: swapParams.toToken 
    });
    
    // Mock swap transaction - in production this would proxy to real 1inch API
    const mockSwap = {
      tx: {
        from: swapParams.fromAddress,
        to: '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch router
        data: '0x12aa3caf000000000000000000000000e37e799d5077682fa0a244d46e5649f71457bd09',
        value: swapParams.fromToken === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' 
          ? swapParams.amount 
          : '0',
        gas: '180000',
        gasPrice: '15000000000'
      },
      toTokenAmount: (BigInt(swapParams.amount) * BigInt(2000)).toString(),
      protocols: ['Uniswap V3', '1inch', 'Curve']
    };
    
    res.json({
      success: true,
      data: mockSwap,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('1inch swap failed:', error);
    res.status(500).json({
      success: false,
      error: '1inch swap failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/1inch/protocols/:chainId
 * Get supported protocols for a chain
 */
router.get('/protocols/:chainId', [
  param('chainId').isNumeric().withMessage('Chain ID is required')
], validateRequest, async (req, res) => {
  try {
    const { chainId } = req.params;
    
    // Mock protocols - in production this would proxy to real 1inch API
    const mockProtocols = [
      {
        name: 'Uniswap V3',
        part: 0.8,
        fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      },
      {
        name: '1inch Liquidity Protocol',
        part: 0.15,
        fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      },
      {
        name: 'Curve',
        part: 0.05,
        fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        toTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7'
      }
    ];
    
    res.json({
      success: true,
      data: mockProtocols,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('1inch protocols request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get protocols',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as oneInchRoutes };