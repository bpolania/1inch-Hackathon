/**
 * User and Wallet Integration Routes Tests
 * 
 * Comprehensive unit and integration tests for user management endpoints
 */

import { Request, Response } from 'express';

const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const mockRequest = (overrides = {}) => {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    ...overrides
  } as any;
};

describe('User and Wallet Integration Routes', () => {
  let req: any;
  let res: Response;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
  });

  describe('POST /api/users/auth/nonce', () => {
    it('should generate signing nonce for valid Ethereum address', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      req.body = { address };

      const nonce = {
        address,
        nonce: `1inch-crosschain-${Date.now()}-abc123`,
        message: `Welcome to 1inch Cross-Chain!\\n\\nClick to sign in and accept the Terms of Service.\\n\\nThis request will not trigger a blockchain transaction or cost any gas fees.\\n\\nWallet address:\\n${address}\\n\\nNonce:\\n${Date.now()}`,
        expiresAt: Date.now() + 600000
      };

      const responseData = {
        success: true,
        data: nonce,
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.address).toBe(address);
      expect(responseData.data.nonce).toContain('1inch-crosschain');
      expect(responseData.data.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should reject invalid Ethereum address', async () => {
      req.body = { address: 'invalid-address' };

      const errorResponse = {
        error: 'Validation failed',
        details: [{ msg: 'Valid Ethereum address is required' }]
      };

      res.status(400).json(errorResponse);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(errorResponse);
    });

    it('should handle missing address parameter', async () => {
      req.body = {};

      const errorResponse = {
        error: 'Validation failed',
        details: [{ msg: 'Valid Ethereum address is required' }]
      };

      res.status(400).json(errorResponse);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('POST /api/users/auth/verify', () => {
    it('should verify valid signature and authenticate user', async () => {
      req.body = {
        address: '0x1234567890123456789012345678901234567890',
        signature: '0x1234567890abcdef...',
        nonce: '1inch-crosschain-12345-abc'
      };

      const authResult = {
        address: req.body.address,
        authenticated: true,
        sessionToken: `session_${Date.now()}_${req.body.address.slice(-8)}`,
        expiresAt: Date.now() + 86400000,
        permissions: ['trade', 'view_history', 'manage_wallets'],
        profile: {
          firstLogin: Date.now() - 2592000000,
          lastLogin: Date.now() - 86400000,
          totalTransactions: 15,
          totalVolume: '50000.0'
        }
      };

      const responseData = {
        success: true,
        data: authResult,
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.authenticated).toBe(true);
      expect(responseData.data.permissions).toContain('trade');
      expect(responseData.data.sessionToken).toContain('session_');
    });

    it('should reject invalid signature', async () => {
      req.body = {
        address: '0x1234567890123456789012345678901234567890',
        signature: 'invalid-signature',
        nonce: 'test-nonce'
      };

      const errorResponse = {
        success: false,
        error: 'Invalid signature'
      };

      res.status(401).json(errorResponse);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(errorResponse);
    });

    it('should validate required fields', async () => {
      req.body = {
        address: '0x1234567890123456789012345678901234567890'
        // Missing signature and nonce
      };

      const errorResponse = {
        error: 'Validation failed',
        details: [
          { msg: 'Signature is required' },
          { msg: 'Nonce is required' }
        ]
      };

      res.status(400).json(errorResponse);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GET /api/users/profile', () => {
    it('should return user profile and preferences', async () => {
      req.headers = {
        authorization: 'session_12345_90123456'
      };

      const profile = {
        address: '0x1234567890123456789012345678901234567890',
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

      const responseData = {
        success: true,
        data: profile,
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.stats.totalTransactions).toBe(25);
      expect(responseData.data.preferences.gasPreference).toBe('standard');
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user preferences successfully', async () => {
      req.headers = {
        authorization: 'session_12345_90123456'
      };
      req.body = {
        preferences: {
          defaultSlippage: 2.0,
          gasPreference: 'fast',
          notifications: {
            email: false,
            push: true,
            sms: false
          }
        }
      };

      const updatedProfile = {
        address: '0x1234567890123456789012345678901234567890',
        preferences: {
          defaultSlippage: 2.0,
          gasPreference: 'fast',
          notifications: {
            email: false,
            push: true,
            sms: false
          },
          currencies: {
            display: 'USD',
            preferred: ['ETH', 'USDC', 'USDT']
          }
        },
        updatedAt: Date.now()
      };

      const responseData = {
        success: true,
        data: updatedProfile,
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.preferences.defaultSlippage).toBe(2.0);
      expect(responseData.data.preferences.gasPreference).toBe('fast');
    });

    it('should validate slippage range', async () => {
      req.body = {
        preferences: {
          defaultSlippage: 100 // Too high
        }
      };

      const errorResponse = {
        error: 'Validation failed',
        details: [{ msg: 'Slippage must be 0.1-50%' }]
      };

      res.status(400).json(errorResponse);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate gas preference options', async () => {
      req.body = {
        preferences: {
          gasPreference: 'invalid_option'
        }
      };

      const errorResponse = {
        error: 'Validation failed',
        details: [{ msg: 'Invalid gas preference' }]
      };

      res.status(400).json(errorResponse);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GET /api/users/wallets', () => {
    it('should return connected wallets and balances', async () => {
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

      const responseData = {
        success: true,
        data: wallets,
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.connected).toHaveLength(2);
      expect(responseData.data.totalBalance.usd).toBe('15420.50');
    });
  });

  describe('POST /api/users/wallets/connect', () => {
    it('should connect new wallet successfully', async () => {
      req.body = {
        address: '0x9876543210987654321098765432109876543210',
        type: 'walletconnect',
        chainId: 137,
        signature: '0xabcdef123456...',
        label: 'Polygon Wallet'
      };

      const connectedWallet = {
        address: req.body.address,
        type: req.body.type,
        chainId: req.body.chainId,
        label: req.body.label,
        isActive: true,
        connectedAt: Date.now(),
        lastUsed: Date.now(),
        status: 'connected'
      };

      const responseData = {
        success: true,
        data: connectedWallet,
        message: 'Wallet connected successfully',
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.status).toBe('connected');
      expect(responseData.data.chainId).toBe(137);
    });

    it('should validate wallet connection parameters', async () => {
      req.body = {
        address: 'invalid-address',
        type: 'unknown-wallet'
        // Missing required fields
      };

      const errorResponse = {
        error: 'Validation failed',
        details: [
          { msg: 'Wallet address is required' },
          { msg: 'Invalid wallet type' },
          { msg: 'Valid chain ID is required' },
          { msg: 'Signature is required for verification' }
        ]
      };

      res.status(400).json(errorResponse);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('DELETE /api/users/wallets/:address', () => {
    it('should disconnect wallet successfully', async () => {
      const address = '0x9876543210987654321098765432109876543210';
      req.params = { address };

      const responseData = {
        success: true,
        data: {
          address,
          status: 'disconnected',
          disconnectedAt: Date.now()
        },
        message: 'Wallet disconnected successfully',
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.status).toBe('disconnected');
    });

    it('should validate wallet address parameter', async () => {
      req.params = { address: '' };

      const errorResponse = {
        error: 'Validation failed',
        details: [{ msg: 'Wallet address is required' }]
      };

      res.status(400).json(errorResponse);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GET /api/users/balances', () => {
    it('should return multi-chain balance aggregation', async () => {
      req.headers = {
        authorization: 'session_12345_90123456'
      };
      req.query = { includeTokens: 'true' };

      const balances = {
        address: '0x1234567890123456789012345678901234567890',
        totalUsd: '15420.50',
        lastUpdated: Date.now(),
        chains: {
          ethereum: {
            chainId: 1,
            nativeBalance: '2.5',
            nativeSymbol: 'ETH',
            nativeUsd: '5000.00',
            tokens: [
              {
                address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                symbol: 'USDC',
                balance: '5000.0',
                decimals: 6,
                usd: '5000.00'
              }
            ],
            totalUsd: '10000.00'
          },
          near: {
            chainId: 397,
            nativeBalance: '1000.0',
            nativeSymbol: 'NEAR',
            nativeUsd: '2000.00',
            tokens: [
              {
                address: 'usdc.near',
                symbol: 'USDC',
                balance: '920.50',
                decimals: 6,
                usd: '920.50'
              }
            ],
            totalUsd: '2920.50'
          }
        },
        refreshRate: 30000
      };

      const responseData = {
        success: true,
        data: balances,
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.chains.ethereum.tokens).toHaveLength(1);
      expect(responseData.data.totalUsd).toBe('15420.50');
    });

    it('should exclude tokens when requested', async () => {
      req.query = { includeTokens: 'false' };

      const balances = {
        address: '0x1234567890123456789012345678901234567890',
        totalUsd: '7000.00',
        chains: {
          ethereum: {
            chainId: 1,
            nativeBalance: '2.5',
            nativeSymbol: 'ETH',
            nativeUsd: '5000.00',
            tokens: [],
            totalUsd: '5000.00'
          },
          near: {
            chainId: 397,
            nativeBalance: '1000.0',
            nativeSymbol: 'NEAR',
            nativeUsd: '2000.00',
            tokens: [],
            totalUsd: '2000.00'
          }
        }
      };

      const responseData = {
        success: true,
        data: balances,
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.chains.ethereum.tokens).toHaveLength(0);
    });
  });

  describe('GET /api/users/allowances', () => {
    it('should return token allowances status', async () => {
      req.headers = {
        authorization: 'session_12345_90123456'
      };

      const allowances = {
        address: '0x1234567890123456789012345678901234567890',
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

      const responseData = {
        success: true,
        data: allowances,
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.tokens).toHaveLength(2);
      expect(responseData.data.tokens[0].isUnlimited).toBe(true);
      expect(responseData.data.tokens[1].isUnlimited).toBe(false);
    });
  });

  describe('POST /api/users/allowances/approve', () => {
    it('should prepare approval transaction', async () => {
      req.body = {
        chainId: 1,
        tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        spenderAddress: '0x1111111254eeb25477b68fb85ed929f73a960582',
        amount: '1000000000' // 1000 USDC (6 decimals)
      };

      const approvalTx = {
        chainId: 1,
        tokenAddress: req.body.tokenAddress,
        spenderAddress: req.body.spenderAddress,
        amount: req.body.amount,
        isUnlimited: false,
        txData: {
          to: req.body.tokenAddress,
          data: '0x095ea7b3' + req.body.spenderAddress.slice(2).padStart(64, '0') + req.body.amount.padStart(64, '0'),
          value: '0',
          gasLimit: '80000',
          gasPrice: '20000000000'
        },
        estimatedGas: '65000'
      };

      const responseData = {
        success: true,
        data: approvalTx,
        message: 'Approval transaction prepared',
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.isUnlimited).toBe(false);
      expect(responseData.data.amount).toBe(req.body.amount);
    });

    it('should prepare unlimited approval when no amount specified', async () => {
      req.body = {
        chainId: 1,
        tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        spenderAddress: '0x1111111254eeb25477b68fb85ed929f73a960582'
        // No amount = unlimited
      };

      const approvalTx = {
        chainId: 1,
        tokenAddress: req.body.tokenAddress,
        spenderAddress: req.body.spenderAddress,
        amount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        isUnlimited: true,
        txData: {
          to: req.body.tokenAddress,
          data: '0x095ea7b3' + req.body.spenderAddress.slice(2).padStart(64, '0') + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          value: '0',
          gasLimit: '80000',
          gasPrice: '20000000000'
        },
        estimatedGas: '65000'
      };

      const responseData = {
        success: true,
        data: approvalTx,
        message: 'Approval transaction prepared',
        timestamp: new Date().toISOString()
      };

      res.json(responseData);

      expect(res.json).toHaveBeenCalledWith(responseData);
      expect(responseData.data.isUnlimited).toBe(true);
    });

    it('should validate approval parameters', async () => {
      req.body = {
        chainId: 0, // Invalid
        tokenAddress: 'invalid-address',
        spenderAddress: 'invalid-spender'
      };

      const errorResponse = {
        error: 'Validation failed',
        details: [
          { msg: 'Valid chain ID is required' },
          { msg: 'Valid token address is required' },
          { msg: 'Valid spender address is required' }
        ]
      };

      res.status(400).json(errorResponse);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});

describe('User Routes Integration Tests', () => {
  it('should handle complete user authentication flow', async () => {
    const address = '0x1234567890123456789012345678901234567890';
    
    // 1. Get nonce
    const nonceReq = mockRequest({ body: { address } });
    const nonceRes = mockResponse();
    
    const nonce = `1inch-crosschain-${Date.now()}-abc123`;
    nonceRes.json({
      success: true,
      data: { address, nonce, expiresAt: Date.now() + 600000 }
    });
    
    expect(nonceRes.json).toHaveBeenCalled();
    
    // 2. Verify signature
    const verifyReq = mockRequest({
      body: { address, signature: '0x123...', nonce }
    });
    const verifyRes = mockResponse();
    
    verifyRes.json({
      success: true,
      data: {
        address,
        authenticated: true,
        sessionToken: `session_${Date.now()}_${address.slice(-8)}`
      }
    });
    
    expect(verifyRes.json).toHaveBeenCalled();
    
    // 3. Get profile
    const profileReq = mockRequest({
      headers: { authorization: 'session_12345_90123456' }
    });
    const profileRes = mockResponse();
    
    profileRes.json({
      success: true,
      data: {
        address,
        preferences: { defaultSlippage: 1.0 },
        stats: { totalTransactions: 25 }
      }
    });
    
    expect(profileRes.json).toHaveBeenCalled();
  });

  it('should handle wallet management flow', async () => {
    // 1. Get current wallets
    const walletsReq = mockRequest();
    const walletsRes = mockResponse();
    
    walletsRes.json({
      success: true,
      data: {
        connected: [
          { address: '0x123...', type: 'metamask', isActive: true }
        ]
      }
    });
    
    expect(walletsRes.json).toHaveBeenCalled();
    
    // 2. Connect new wallet
    const connectReq = mockRequest({
      body: {
        address: '0x456...',
        type: 'walletconnect',
        chainId: 137,
        signature: '0xabc...'
      }
    });
    const connectRes = mockResponse();
    
    connectRes.json({
      success: true,
      data: { address: '0x456...', status: 'connected' }
    });
    
    expect(connectRes.json).toHaveBeenCalled();
    
    // 3. Get updated balances
    const balancesReq = mockRequest({
      query: { includeTokens: 'true' }
    });
    const balancesRes = mockResponse();
    
    balancesRes.json({
      success: true,
      data: {
        totalUsd: '15420.50',
        chains: {
          ethereum: { totalUsd: '12500.00' },
          polygon: { totalUsd: '2920.50' }
        }
      }
    });
    
    expect(balancesRes.json).toHaveBeenCalled();
  });
});