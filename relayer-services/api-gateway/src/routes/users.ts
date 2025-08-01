/**
 * User and Wallet Integration Routes
 * 
 * Provides user authentication, wallet management, and account functionality
 * for cross-chain operations.
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
 * POST /api/users/auth/nonce
 * Get signing nonce for wallet authentication
 */
router.post(
  '/auth/nonce',
  [
    body('address').isEthereumAddress().withMessage('Valid Ethereum address is required'),
    validateRequest
  ],
  async (req: any, res) => {
    try {
      const { address } = req.body;
      
      const nonce = {
        address,
        nonce: `1inch-crosschain-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        message: `Welcome to 1inch Cross-Chain!\n\nClick to sign in and accept the Terms of Service.\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet address:\n${address}\n\nNonce:\n${Date.now()}`,
        expiresAt: Date.now() + 600000 // 10 minutes
      };

      res.json({
        success: true,
        data: nonce,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Nonce generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate nonce',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/users/auth/verify
 * Verify wallet signature and authenticate user
 */
router.post(
  '/auth/verify',
  [
    body('address').isEthereumAddress().withMessage('Valid Ethereum address is required'),
    body('signature').notEmpty().withMessage('Signature is required'),
    body('nonce').notEmpty().withMessage('Nonce is required'),
    validateRequest
  ],
  async (req: any, res) => {
    try {
      const { address, signature, nonce } = req.body;
      
      // In production, verify the signature here
      const isValidSignature = true; // Mock verification
      
      if (!isValidSignature) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }

      const authResult = {
        address,
        authenticated: true,
        sessionToken: `session_${Date.now()}_${address.slice(-8)}`,
        expiresAt: Date.now() + 86400000, // 24 hours
        permissions: ['trade', 'view_history', 'manage_wallets'],
        profile: {
          firstLogin: Date.now() - 2592000000, // 30 days ago
          lastLogin: Date.now() - 86400000, // 1 day ago
          totalTransactions: 15,
          totalVolume: '50000.0'
        }
      };

      res.json({
        success: true,
        data: authResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Signature verification failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify signature',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/users/profile
 * Get user profile and preferences
 */
router.get('/profile', async (req: any, res) => {
  try {
    // In production, get address from authenticated session
    const userAddress = req.headers.authorization?.split('_')[2] || '0x1234567890123456789012345678901234567890';
    
    const profile = {
      address: userAddress,
      preferences: {
        defaultSlippage: 1.0,
        gasPreference: 'standard',
        notifications: {
          email: true,
          push: false,
          sms: false
        },
        currencies: {
          display: 'USD',
          preferred: ['ETH', 'USDC', 'USDT']
        }
      },
      stats: {
        totalTransactions: 25,
        successfulTransactions: 23,
        failedTransactions: 2,
        totalVolume: '125000.50',
        avgTransactionSize: '5000.00',
        favoriteRoutes: [
          { from: 'ethereum', to: 'polygon', count: 8 },
          { from: 'ethereum', to: 'near', count: 5 }
        ]
      },
      security: {
        twoFactorEnabled: false,
        lastSecurityUpdate: Date.now() - 2592000000,
        trustedDevices: 2
      }
    };

    res.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Profile request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/users/profile
 * Update user preferences
 */
router.put(
  '/profile',
  [
    body('preferences').optional().isObject().withMessage('Preferences must be an object'),
    body('preferences.defaultSlippage').optional().isFloat({ min: 0.1, max: 50 }).withMessage('Slippage must be 0.1-50%'),
    body('preferences.gasPreference').optional().isIn(['slow', 'standard', 'fast']).withMessage('Invalid gas preference'),
    validateRequest
  ],
  async (req: any, res) => {
    try {
      const { preferences } = req.body;
      const userAddress = req.headers.authorization?.split('_')[2] || '0x1234567890123456789012345678901234567890';
      
      const updatedProfile = {
        address: userAddress,
        preferences: {
          defaultSlippage: preferences?.defaultSlippage || 1.0,
          gasPreference: preferences?.gasPreference || 'standard',
          notifications: preferences?.notifications || {
            email: true,
            push: false,
            sms: false
          },
          currencies: preferences?.currencies || {
            display: 'USD',
            preferred: ['ETH', 'USDC', 'USDT']
          }
        },
        updatedAt: Date.now()
      };

      res.json({
        success: true,
        data: updatedProfile,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Profile update failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/users/wallets
 * Get connected wallets
 */
router.get('/wallets', async (req: any, res) => {
  try {
    const wallets = {
      primary: '0x1234567890123456789012345678901234567890',
      connected: [
        {
          address: '0x1234567890123456789012345678901234567890',
          type: 'metamask',
          chainId: 1,
          label: 'Primary Wallet',
          isActive: true,
          connectedAt: Date.now() - 2592000000,
          lastUsed: Date.now() - 86400000
        },
        {
          address: 'wallet.near',
          type: 'near-wallet',
          chainId: 397,
          label: 'NEAR Wallet',
          isActive: true,
          connectedAt: Date.now() - 1296000000,
          lastUsed: Date.now() - 604800000
        }
      ],
      totalBalance: {
        usd: '15420.50',
        breakdown: [
          { chain: 'ethereum', balance: '12500.00', tokens: 8 },
          { chain: 'near', balance: '2920.50', tokens: 3 }
        ]
      }
    };

    res.json({
      success: true,
      data: wallets,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Wallets request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallets',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/users/wallets/connect
 * Connect a new wallet
 */
router.post(
  '/wallets/connect',
  [
    body('address').notEmpty().withMessage('Wallet address is required'),
    body('type').isIn(['metamask', 'walletconnect', 'near-wallet', 'phantom']).withMessage('Invalid wallet type'),
    body('chainId').isInt({ min: 1 }).withMessage('Valid chain ID is required'),
    body('signature').notEmpty().withMessage('Signature is required for verification'),
    validateRequest
  ],
  async (req: any, res) => {
    try {
      const { address, type, chainId, signature, label } = req.body;
      
      const connectedWallet = {
        address,
        type,
        chainId,
        label: label || `${type} Wallet`,
        isActive: true,
        connectedAt: Date.now(),
        lastUsed: Date.now(),
        status: 'connected'
      };

      res.json({
        success: true,
        data: connectedWallet,
        message: 'Wallet connected successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Wallet connection failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to connect wallet',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/users/wallets/:address
 * Disconnect a wallet
 */
router.delete(
  '/wallets/:address',
  [
    param('address').notEmpty().withMessage('Wallet address is required'),
    validateRequest
  ],
  async (req: any, res) => {
    try {
      const { address } = req.params;
      
      res.json({
        success: true,
        data: {
          address,
          status: 'disconnected',
          disconnectedAt: Date.now()
        },
        message: 'Wallet disconnected successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Wallet disconnection failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect wallet',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/users/balances
 * Get multi-chain balance aggregation
 */
router.get(
  '/balances',
  [
    query('chains').optional().isString().withMessage('Chains must be comma-separated string'),
    query('includeTokens').optional().isBoolean().withMessage('Include tokens must be boolean'),
    validateRequest
  ],
  async (req: any, res) => {
    try {
      const { chains, includeTokens = true } = req.query;
      const userAddress = req.headers.authorization?.split('_')[2] || '0x1234567890123456789012345678901234567890';
      
      const balances = {
        address: userAddress,
        totalUsd: '15420.50',
        lastUpdated: Date.now(),
        chains: {
          ethereum: {
            chainId: 1,
            nativeBalance: '2.5',
            nativeSymbol: 'ETH',
            nativeUsd: '5000.00',
            tokens: includeTokens ? [
              {
                address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                symbol: 'USDC',
                balance: '5000.0',
                decimals: 6,
                usd: '5000.00'
              },
              {
                address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                symbol: 'USDT',
                balance: '2500.0',
                decimals: 6,
                usd: '2500.00'
              }
            ] : [],
            totalUsd: '12500.00'
          },
          near: {
            chainId: 397,
            nativeBalance: '1000.0',
            nativeSymbol: 'NEAR',
            nativeUsd: '2000.00',
            tokens: includeTokens ? [
              {
                address: 'usdc.near',
                symbol: 'USDC',
                balance: '920.50',
                decimals: 6,
                usd: '920.50'
              }
            ] : [],
            totalUsd: '2920.50'
          }
        },
        refreshRate: 30000 // 30 seconds
      };

      res.json({
        success: true,
        data: balances,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Balances request failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get balances',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/users/allowances
 * Get token allowances status
 */
router.get('/allowances', async (req: any, res) => {
  try {
    const userAddress = req.headers.authorization?.split('_')[2] || '0x1234567890123456789012345678901234567890';
    
    const allowances = {
      address: userAddress,
      lastUpdated: Date.now(),
      tokens: [
        {
          chainId: 1,
          tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          tokenSymbol: 'USDC',
          spenderAddress: '0x1111111254eeb25477b68fb85ed929f73a960582',
          spenderName: '1inch Router',
          allowance: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          isUnlimited: true,
          lastApproval: Date.now() - 86400000
        },
        {
          chainId: 1,
          tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          tokenSymbol: 'USDT',
          spenderAddress: '0x1111111254eeb25477b68fb85ed929f73a960582',
          spenderName: '1inch Router',
          allowance: '0',
          isUnlimited: false,
          lastApproval: null
        }
      ]
    };

    res.json({
      success: true,
      data: allowances,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Allowances request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get allowances',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/users/allowances/approve
 * Approve token spending
 */
router.post(
  '/allowances/approve',
  [
    body('chainId').isInt({ min: 1 }).withMessage('Valid chain ID is required'),
    body('tokenAddress').isEthereumAddress().withMessage('Valid token address is required'),
    body('spenderAddress').isEthereumAddress().withMessage('Valid spender address is required'),
    body('amount').optional().isString().withMessage('Amount must be string'),
    validateRequest
  ],
  async (req: any, res) => {
    try {
      const { chainId, tokenAddress, spenderAddress, amount } = req.body;
      
      const approvalTx = {
        chainId,
        tokenAddress,
        spenderAddress,
        amount: amount || '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        isUnlimited: !amount,
        txData: {
          to: tokenAddress,
          data: '0x095ea7b3' + spenderAddress.slice(2).padStart(64, '0') + (amount || 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff').padStart(64, '0'),
          value: '0',
          gasLimit: '80000',
          gasPrice: '20000000000'
        },
        estimatedGas: '65000'
      };

      res.json({
        success: true,
        data: approvalTx,
        message: 'Approval transaction prepared',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Approval preparation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to prepare approval',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export { router as userRoutes };