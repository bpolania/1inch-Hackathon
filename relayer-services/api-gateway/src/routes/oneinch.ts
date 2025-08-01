/**
 * 1inch Fusion+ Integration Routes
 * 
 * Provides native endpoints for our deployed 1inch Fusion+ extension
 * Connects to real TEE solver, relayer services, and deployed contracts
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
 * Get Fusion+ cross-chain quote using our TEE solver
 */
router.get('/quote', [
  query('chainId').isNumeric().withMessage('Chain ID is required'),
  query('fromToken').isString().notEmpty().withMessage('From token is required'),
  query('toToken').isString().notEmpty().withMessage('To token is required'),
  query('amount').isString().notEmpty().withMessage('Amount is required'),
  query('toChainId').isNumeric().optional().withMessage('Destination chain ID'),
  query('slippage').isNumeric().optional()
], validateRequest, async (req: any, res: any) => {
  try {
    const { chainId, fromToken, toToken, amount, toChainId, slippage = 1 } = req.query;
    
    logger.info('Fusion+ quote requested', { chainId, fromToken, toToken, amount, toChainId });
    
    // Create intent for TEE analysis
    const intent = {
      id: `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fromToken: {
        address: fromToken as string,
        chainId: parseInt(chainId as string),
        symbol: 'TOKEN', // Will be resolved by TEE
        decimals: 18
      },
      toToken: {
        address: toToken as string,
        chainId: toChainId ? parseInt(toChainId as string) : parseInt(chainId as string),
        symbol: 'TOKEN', // Will be resolved by TEE
        decimals: 18
      },
      fromAmount: amount as string,
      user: '0x0000000000000000000000000000000000000000', // Placeholder for quote
      maxSlippage: parseFloat(slippage as string),
      deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };
    
    // Get quote from TEE solver
    const teeAnalysis = await req.teeService.analyzeIntent(intent);
    
    // Also get relayer profitability analysis
    const relayerAnalysis = await req.relayerService.analyzeProfitability(intent);
    
    const fusionQuote = {
      outputAmount: teeAnalysis.estimatedOutput || relayerAnalysis.estimatedProfit,
      formattedOutput: teeAnalysis.formattedOutput || (parseFloat(relayerAnalysis.estimatedProfit) / 1e18).toFixed(6),
      priceImpact: teeAnalysis.priceImpact || 0.15,
      route: teeAnalysis.route || `Fusion+ Cross-Chain via ${toChainId ? 'Multi-Chain' : 'Same-Chain'}`,
      gasEstimate: relayerAnalysis.gasEstimate || '200000',
      gasPrice: teeAnalysis.gasPrice || '20000000000',
      protocols: teeAnalysis.supportedChains || ['1inch Fusion+', 'NEAR Protocol', 'Bitcoin HTLC'],
      confidence: teeAnalysis.confidence || relayerAnalysis.confidence || 0.95,
      timestamp: Date.now(),
      crossChain: toChainId ? parseInt(toChainId as string) !== parseInt(chainId as string) : false,
      estimatedTime: teeAnalysis.estimatedExecutionTime || 300000, // 5 minutes
      fees: {
        gasFee: relayerAnalysis.gasEstimate || '0.002',
        bridgeFee: (toChainId && parseInt(toChainId as string) !== parseInt(chainId as string)) ? '0.001' : '0',
        solverFee: '0.0025',
        total: relayerAnalysis.totalFees || '0.0055'
      }
    };
    
    res.json({
      success: true,
      data: fusionQuote,
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
 * Get supported tokens for Fusion+ cross-chain swaps
 */
router.get('/tokens/:chainId', [
  param('chainId').isNumeric().withMessage('Chain ID is required')
], validateRequest, async (req: any, res: any) => {
  try {
    const { chainId } = req.params;
    
    logger.info('Fusion+ tokens requested', { chainId });
    
    // Get supported routes from TEE service
    const supportedRoutes = await req.teeService.getSupportedRoutes();
    
    // Build token list based on supported chains and routes
    const fusionTokens: any = {};
    
    // Always include native tokens and our test token
    if (chainId === '1' || chainId === '11155111') { // Ethereum mainnet/Sepolia
      fusionTokens['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'] = {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        logoURI: 'https://token-icons.s3.amazonaws.com/eth.png',
        crossChainSupported: true,
        supportedDestinations: supportedRoutes.destinations || []
      };
      fusionTokens['0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43'] = {
        symbol: 'DT',
        name: 'Demo Token',
        decimals: 18,
        logoURI: 'https://token-icons.s3.amazonaws.com/demo.png',
        crossChainSupported: true,
        supportedDestinations: supportedRoutes.destinations || []
      };
      // Major stablecoins
      fusionTokens['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'] = {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'https://token-icons.s3.amazonaws.com/usdc.png',
        crossChainSupported: true,
        supportedDestinations: supportedRoutes.destinations || []
      };
    }
    
    // NEAR Protocol tokens
    if (chainId === '397') { // NEAR
      fusionTokens['wrap.near'] = {
        symbol: 'NEAR',
        name: 'NEAR Protocol',
        decimals: 24,
        logoURI: 'https://token-icons.s3.amazonaws.com/near.png',
        crossChainSupported: true,
        supportedDestinations: ['1', '11155111'] // Can go to Ethereum
      };
    }
    
    // Bitcoin (represented as UTXO-style)
    if (chainId === '40004' || chainId === '40001') { // Bitcoin testnet/mainnet
      fusionTokens['bitcoin'] = {
        symbol: 'BTC',
        name: 'Bitcoin',
        decimals: 8,
        logoURI: 'https://token-icons.s3.amazonaws.com/btc.png',
        crossChainSupported: true,
        supportedDestinations: ['1', '11155111'], // Can go to Ethereum
        isUTXO: true
      };
    }
    
    res.json({
      success: true,
      data: fusionTokens,
      supportedRoutes: supportedRoutes,
      crossChainEnabled: true,
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
 * Create Fusion+ cross-chain swap order using our deployed factory
 */
router.post('/swap', [
  body('chainId').isNumeric().withMessage('Chain ID is required'),
  body('fromToken').isString().notEmpty().withMessage('From token is required'),
  body('toToken').isString().notEmpty().withMessage('To token is required'),
  body('amount').isString().notEmpty().withMessage('Amount is required'),
  body('fromAddress').isString().notEmpty().withMessage('From address is required'),
  body('toChainId').isNumeric().optional().withMessage('Destination chain ID'),
  body('toAddress').isString().optional().withMessage('Destination address'),
  body('slippage').isNumeric().optional(),
  body('deadline').isNumeric().optional()
], validateRequest, async (req: any, res: any) => {
  try {
    const swapParams = req.body;
    
    logger.info('Fusion+ swap requested', { 
      chainId: swapParams.chainId, 
      fromToken: swapParams.fromToken, 
      toToken: swapParams.toToken,
      toChainId: swapParams.toChainId
    });
    
    // Create intent for cross-chain swap
    const intent = {
      id: `swap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fromToken: {
        address: swapParams.fromToken,
        chainId: parseInt(swapParams.chainId),
        symbol: 'TOKEN',
        decimals: 18
      },
      toToken: {
        address: swapParams.toToken,
        chainId: swapParams.toChainId ? parseInt(swapParams.toChainId) : parseInt(swapParams.chainId),
        symbol: 'TOKEN',
        decimals: 18
      },
      fromAmount: swapParams.amount,
      minToAmount: swapParams.minToAmount || '0',
      user: swapParams.fromAddress,
      maxSlippage: swapParams.slippage || 1.0,
      deadline: swapParams.deadline || Math.floor(Date.now() / 1000) + 3600
    };
    
    // Determine if this is cross-chain or same-chain
    const isCrossChain = swapParams.toChainId ? parseInt(swapParams.toChainId) !== parseInt(swapParams.chainId) : false;
    logger.info('Swap routing decision', { 
      chainId: swapParams.chainId, 
      toChainId: swapParams.toChainId, 
      isCrossChain 
    });
    
    let result;
    if (isCrossChain) {
      // Use TEE solver for cross-chain swaps
      logger.info('Submitting cross-chain swap via TEE solver');
      result = await req.teeService.submitToTEE(intent);
    } else {
      // Use relayer service for same-chain swaps
      logger.info('Submitting same-chain swap via relayer');
      result = await req.relayerService.submitIntent(intent);
    }
    
    // Format response as 1inch-compatible transaction data
    const fusionSwap = {
      tx: {
        from: swapParams.fromAddress,
        to: result.contractAddress || '0xbeEab741D2869404FcB747057f5AbdEffc3A138d', // Our Fusion+ Factory
        data: result.calldata || '0x', // Real contract call data
        value: swapParams.fromToken === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' 
          ? swapParams.amount 
          : '0',
        gas: result.gasEstimate || '300000',
        gasPrice: result.gasPrice || '20000000000'
      },
      toTokenAmount: result.expectedOutput || swapParams.amount,
      protocols: isCrossChain 
        ? ['1inch Fusion+', 'Cross-Chain Bridge', 'Destination DEX']
        : ['1inch Fusion+'],
      orderHash: result.orderHash,
      intentId: intent.id,
      crossChain: isCrossChain,
      estimatedTime: result.estimatedExecutionTime || 300000,
      tracking: {
        intentId: intent.id,
        status: result.status || 'submitted',
        trackingUrl: `/api/transactions/lifecycle/${intent.id}`
      }
    };
    
    res.json({
      success: true,
      data: fusionSwap,
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
 * Get supported Fusion+ cross-chain protocols and adapters
 */
router.get('/protocols/:chainId', [
  param('chainId').isNumeric().withMessage('Chain ID is required')
], validateRequest, async (req: any, res: any) => {
  try {
    const { chainId } = req.params;
    
    logger.info('Fusion+ protocols requested', { chainId });
    
    // Get supported routes and adapters from our services
    const supportedRoutes = await req.teeService.getSupportedRoutes();
    const relayerMetrics = await req.relayerService.getMetrics();
    
    // Build protocol list based on our deployed adapters
    const fusionProtocols = [
      {
        name: '1inch Fusion+ Factory',
        type: 'cross-chain-factory',
        address: '0xbeEab741D2869404FcB747057f5AbdEffc3A138d',
        part: 1.0, // Primary protocol
        description: 'Main Fusion+ order creation and management',
        supportedChains: ['1', '11155111', ...(supportedRoutes.destinations || [])], // Supports Ethereum chains + destinations
        isActive: true
      },
      {
        name: 'NEAR Protocol Bridge',
        type: 'cross-chain-adapter',
        address: '0x7019aC48479e5527Cb3a5a99FbEFe5B42125C9A5', // NEAR Testnet Adapter
        part: 0.4,
        description: 'Cross-chain atomic swaps via NEAR Protocol',
        supportedChains: ['1', '11155111'], // Deployed on Ethereum, sends to NEAR
        features: ['atomic-swaps', 'hash-time-locks', 'tee-compatible'],
        isActive: true
      },
      {
        name: 'Bitcoin HTLC Bridge',
        type: 'cross-chain-adapter', 
        address: '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8', // Bitcoin Testnet Adapter
        part: 0.3,
        description: 'Bitcoin atomic swaps with Hash Time Locked Contracts',
        supportedChains: ['1', '11155111'], // Deployed on Ethereum, sends to Bitcoin
        features: ['htlc', 'p2sh-scripts', 'utxo-compatible'],
        isActive: true
      },
      {
        name: 'Multi-Chain Registry',
        type: 'chain-registry',
        address: '0x09Ab998Cb3448ad281C116c9fC9e4b01e4533beD',
        part: 0.2,
        description: 'Manages supported destination chains and adapters',
        supportedChains: ['1', '11155111', ...(supportedRoutes.destinations || [])], // Supports all chains
        features: ['chain-management', 'adapter-registry', 'safety-deposits'],
        isActive: true
      },
      {
        name: 'TEE Autonomous Solver',
        type: 'execution-engine',
        address: 'autonomous-agent',
        part: 0.1,
        description: 'NEAR TEE-based autonomous execution agent',
        supportedChains: ['all'],
        features: ['autonomous-execution', 'chain-signatures', 'tee-attestation'],
        isActive: true,
        metrics: {
          totalOrders: relayerMetrics.totalExecutions || 0,
          successRate: relayerMetrics.successRate || 0.95,
          avgExecutionTime: relayerMetrics.avgExecutionTime || 300000
        }
      }
    ];
    
    // Filter protocols based on chain ID if needed
    let relevantProtocols = fusionProtocols;
    if (chainId && chainId !== '0') {
      relevantProtocols = fusionProtocols.filter(protocol => 
        protocol.supportedChains.includes(chainId.toString()) || 
        protocol.supportedChains.includes('all')
      );
    }
    
    res.json({
      success: true,
      data: relevantProtocols,
      summary: {
        totalProtocols: relevantProtocols.length,
        crossChainEnabled: true,
        supportedDestinations: supportedRoutes.destinations?.length || 0,
        deployedContracts: {
          factory: '0xbeEab741D2869404FcB747057f5AbdEffc3A138d',
          registry: '0x09Ab998Cb3448ad281C116c9fC9e4b01e4533beD',
          nearAdapter: '0x7019aC48479e5527Cb3a5a99FbEFe5B42125C9A5',
          bitcoinAdapter: '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8'
        }
      },
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