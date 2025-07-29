/**
 * Basic Fusion Manager Tests - Focus on Core Logic
 * 
 * Test our Fusion+ integration logic without complex SDK dependencies
 */

import { FusionManager } from '../../fusion/FusionManager';
import { 
  FusionConfig, 
  FUSION_CONFIG_PRESETS,
  FusionErrorType 
} from '../../fusion/types';
import { createQuoteRequest } from '../setup';

// Mock the 1inch SDKs completely
jest.mock('@1inch/cross-chain-sdk', () => ({
  NetworkEnum: {
    ETHEREUM: 1,
    POLYGON: 137,
    BINANCE: 56,
    ARBITRUM: 42161,
    OPTIMISM: 10,
    AVALANCHE: 43114,
    FANTOM: 250
  },
  PresetEnum: {
    fast: 'fast',
    medium: 'medium',
    slow: 'slow'
  },
  SDK: jest.fn().mockImplementation(() => ({
    getQuote: jest.fn().mockResolvedValue({
      quoteId: 'mock-quote-123',
      srcTokenAmount: '1000000000000000000',
      dstTokenAmount: '2000000000000000000',
      presets: {
        fast: { secretsCount: 1, estimatedTime: 180 },
        medium: { secretsCount: 2, estimatedTime: 300 },
        slow: { secretsCount: 3, estimatedTime: 600 }
      },
      params: { srcChainId: 1, dstChainId: 137 }
    }),
    createOrder: jest.fn().mockReturnValue({
      orderData: 'mock-prepared-order',
      signature: '0xmocksignature'
    }),
    submitOrder: jest.fn().mockResolvedValue({
      orderHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      status: 'pending'
    })
  })),
  PrivateKeyProviderConnector: jest.fn().mockImplementation(() => ({})),
  HashLock: {
    forSingleFill: jest.fn().mockImplementation(() => ({
      toJSON: jest.fn().mockReturnValue({ value: '0xmockhash' }),
      toBuffer: jest.fn().mockReturnValue(Buffer.from('mockhash', 'hex')),
      eq: jest.fn().mockReturnValue(true)
    })),
    forMultipleFills: jest.fn().mockImplementation(() => ({
      toJSON: jest.fn().mockReturnValue({ value: '0xmockmultihash' }),
      toBuffer: jest.fn().mockReturnValue(Buffer.from('mockmultihash', 'hex')),
      eq: jest.fn().mockReturnValue(true)
    })),
    getMerkleLeaves: jest.fn().mockReturnValue([{ value: '0xleaf1' }, { value: '0xleaf2' }])
  }
}));

jest.mock('@1inch/fusion-sdk', () => ({
  FusionSDK: jest.fn().mockImplementation(() => ({})),
  PrivateKeyProviderConnector: jest.fn().mockImplementation(() => ({})),
  NetworkEnum: {
    ETHEREUM: 1
  }
}));

describe('FusionManager - Basic Functionality', () => {
  let fusionManager: FusionManager;
  let mockConfig: FusionConfig;

  beforeEach(() => {
    const { NetworkEnum, PresetEnum } = require('@1inch/cross-chain-sdk');
    
    // Create test configuration
    mockConfig = {
      ...FUSION_CONFIG_PRESETS.development,
      supportedNetworks: [NetworkEnum.ETHEREUM, NetworkEnum.POLYGON],
      walletPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      solverAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b',
      minOrderAmount: BigInt('1000000000000000'), // 0.001 ETH
      maxOrderAmount: BigInt('1000000000000000000000') // 1000 ETH
    };

    fusionManager = new FusionManager(mockConfig);
  });

  afterEach(async () => {
    await fusionManager.stop();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize without throwing errors', async () => {
      await expect(fusionManager.initialize()).resolves.not.toThrow();
    });

    it('should set initialized flag', async () => {
      await fusionManager.initialize();
      
      // Check that the manager is initialized by checking stats
      const stats = fusionManager.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.ordersCreated).toBe('number');
    });
  });

  describe('quote request conversion', () => {
    it('should convert quote request correctly', () => {
      const { NetworkEnum } = require('@1inch/cross-chain-sdk');
      
      const quoteRequest = createQuoteRequest({
        id: 'test-request-123',
        sourceAmount: BigInt('1000000000000000000'), // 1 ETH
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      const fusionRequest = fusionManager.convertQuoteRequest(quoteRequest);

      expect(fusionRequest).toMatchObject({
        requestId: 'test-request-123',
        solverId: 'tee-solver',
        amount: '1000000000000000000',
        srcChainId: NetworkEnum.ETHEREUM,
        dstChainId: NetworkEnum.ETHEREUM,
        walletAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b',
        enableEstimate: true
      });
    });

    it('should handle unsupported chain pairs', () => {
      const quoteRequest = createQuoteRequest({
        sourceChain: 'unsupported-chain' as any,
        destinationChain: 'another-unsupported' as any
      });

      expect(() => {
        fusionManager.convertQuoteRequest(quoteRequest);
      }).toThrow('Unsupported chain pair');
    });
  });

  describe('secret generation', () => {
    it('should generate cryptographically secure secrets', () => {
      const secrets = fusionManager.generateSecrets(3);
      
      expect(secrets).toHaveLength(3);
      
      // Check each secret is a valid hex string
      secrets.forEach(secret => {
        expect(secret).toMatch(/^0x[a-f0-9]{64}$/i);
      });
      
      // Ensure secrets are unique
      expect(new Set(secrets).size).toBe(3);
    });

    it('should create hash locks from secrets', () => {
      const secrets = ['0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'];
      const hashLock = fusionManager.createHashLock(secrets);
      
      expect(hashLock).toBeDefined();
      expect(typeof hashLock.toJSON).toBe('function');
      expect(typeof hashLock.toBuffer).toBe('function');
    });

    it('should handle multiple secrets', () => {
      const secrets = fusionManager.generateSecrets(4);
      const hashLock = fusionManager.createHashLock(secrets);
      
      expect(hashLock).toBeDefined();
      expect(typeof hashLock.toJSON).toBe('function');
    });
  });

  describe('statistics tracking', () => {
    it('should initialize with zero statistics', () => {
      const stats = fusionManager.getStats();
      
      expect(stats).toMatchObject({
        ordersCreated: 0,
        ordersSubmitted: 0,
        totalVolume: 0n,
        activeOrders: 0,
        totalOrders: 0,
        averageOrderTime: 0
      });
    });

    it('should track active orders', () => {
      const activeOrders = fusionManager.getActiveOrders();
      expect(activeOrders).toEqual([]);
    });
  });

  describe('configuration validation', () => {
    it('should validate minimum and maximum order amounts', () => {
      expect(mockConfig.minOrderAmount).toBeLessThan(mockConfig.maxOrderAmount);
      expect(mockConfig.solverFeeBps).toBeGreaterThan(0);
      expect(mockConfig.solverFeeBps).toBeLessThan(10000); // Max 100%
    });

    it('should have valid network configuration', () => {
      expect(Array.isArray(mockConfig.supportedNetworks)).toBe(true);
      expect(mockConfig.supportedNetworks.length).toBeGreaterThan(0);
    });

    it('should have valid wallet configuration', () => {
      expect(mockConfig.walletPrivateKey).toMatch(/^0x[a-f0-9]{64}$/i);
      expect(mockConfig.solverAddress).toMatch(/^0x[a-f0-9]{40}$/i);
    });

    it('should have valid API configuration', () => {
      expect(mockConfig.fusionApiUrl).toContain('1inch');
      expect(mockConfig.crossChainApiUrl).toContain('1inch');
      expect(mockConfig.defaultValidityPeriod).toBeGreaterThan(0);
    });
  });

  describe('chain compatibility', () => {
    it('should identify supported chains correctly', () => {
      const { NetworkEnum } = require('@1inch/cross-chain-sdk');
      
      const supportedChains = [
        NetworkEnum.ETHEREUM,
        NetworkEnum.POLYGON, 
        NetworkEnum.ARBITRUM,
        NetworkEnum.OPTIMISM
      ];
      
      supportedChains.forEach(chainId => {
        expect(typeof chainId).toBe('number');
      });
    });

    it('should handle cross-chain vs same-chain requests differently', () => {
      const { NetworkEnum } = require('@1inch/cross-chain-sdk');
      
      const sameChainRequest = createQuoteRequest({
        sourceChain: 'ethereum',
        destinationChain: 'ethereum'
      });
      
      const crossChainRequest = createQuoteRequest({
        sourceChain: 'ethereum', 
        destinationChain: 'polygon'
      });
      
      const sameChainFusion = fusionManager.convertQuoteRequest(sameChainRequest);
      const crossChainFusion = fusionManager.convertQuoteRequest(crossChainRequest);
      
      expect(sameChainFusion.srcChainId).toBe(sameChainFusion.dstChainId);
      expect(crossChainFusion.srcChainId).not.toBe(crossChainFusion.dstChainId);
    });
  });

  describe('SDK integration', () => {
    beforeEach(async () => {
      await fusionManager.initialize();
    });

    it('should get quotes from 1inch SDK', async () => {
      const { NetworkEnum } = require('@1inch/cross-chain-sdk');
      
      const fusionRequest = {
        requestId: 'test-quote-123',
        solverId: 'tee-solver',
        srcChainId: NetworkEnum.ETHEREUM,
        dstChainId: NetworkEnum.POLYGON,
        srcTokenAddress: '0xA0b86a33E6413c3A0BbfDB4C2F3F7cEd35c9C8C4',
        dstTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amount: '1000000000000000000',
        walletAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b',
        enableEstimate: true
      };

      const quote = await fusionManager.getQuote(fusionRequest);

      expect(quote).toMatchObject({
        quoteId: 'mock-quote-123',
        srcTokenAmount: '1000000000000000000',
        dstTokenAmount: '2000000000000000000',
        presets: expect.any(Object)
      });

      // Verify SDK was called with correct parameters
      const mockSDK = fusionManager.crossChainSDK;
      expect(mockSDK.getQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          srcChainId: NetworkEnum.ETHEREUM,
          dstChainId: NetworkEnum.POLYGON,
          amount: '1000000000000000000',
          walletAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
        })
      );
    });

    it('should create orders using SDK', async () => {
      const mockQuote = {
        quoteId: 'test-quote-456',
        srcTokenAmount: '1000000000000000000',
        dstTokenAmount: '2000000000000000000',
        presets: {
          fast: { secretsCount: 2, estimatedTime: 180 }
        }
      };

      const fusionRequest = {
        requestId: 'test-order-123',
        solverId: 'tee-solver',
        srcChainId: 1,
        dstChainId: 137,
        srcTokenAddress: '0xA0b86a33E6413c3A0BbfDB4C2F3F7cEd35c9C8C4',
        dstTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amount: '1000000000000000000',
        walletAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      };

      const orderData = await fusionManager.createOrder(mockQuote, fusionRequest);

      expect(orderData).toMatchObject({
        preparedOrder: expect.any(Object),
        quote: mockQuote,
        secrets: expect.any(Array),
        secretHashes: expect.any(Array),
        hashLock: expect.any(Object),
        requestId: 'test-order-123',
        solverId: 'tee-solver'
      });

      expect(orderData.secrets).toHaveLength(2); // Based on secretsCount
      expect(orderData.secretHashes).toHaveLength(2);

      // Verify SDK createOrder was called
      const mockSDK = fusionManager.crossChainSDK;
      expect(mockSDK.createOrder).toHaveBeenCalledWith(
        mockQuote,
        expect.objectContaining({
          walletAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b',
          hashLock: expect.any(Object),
          secretHashes: expect.any(Array)
        })
      );
    });

    it('should submit orders using SDK', async () => {
      const mockOrderData = {
        preparedOrder: { orderData: 'test-order', signature: '0xtest' },
        quote: { 
          quoteId: 'test-quote-789',
          params: { srcChainId: 1 }
        },
        secretHashes: ['0xhash1', '0xhash2'],
        requestId: 'test-submit-123',
        solverId: 'tee-solver'
      };

      const orderHash = await fusionManager.submitOrder(mockOrderData);

      expect(orderHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');

      // Verify SDK submitOrder was called
      const mockSDK = fusionManager.crossChainSDK;
      expect(mockSDK.submitOrder).toHaveBeenCalledWith(
        1, // srcChainId
        mockOrderData.preparedOrder,
        'test-quote-789',
        ['0xhash1', '0xhash2']
      );

      // Verify order tracking
      const activeOrders = fusionManager.getActiveOrders();
      expect(activeOrders).toHaveLength(1);
      expect(activeOrders[0]).toMatchObject({
        orderHash,
        status: 'submitted',
        submittedAt: expect.any(Number)
      });
    });
  });

  describe('error handling', () => {
    it('should handle uninitialized state correctly', async () => {
      // Trigger an error by calling methods before initialization
      await expect(fusionManager.getQuote({
        requestId: 'test',
        solverId: 'test',
        amount: '1000',
        srcChainId: 1,
        dstChainId: 137,
        srcTokenAddress: '0x0',
        dstTokenAddress: '0x0',
        walletAddress: '0x0'
      })).rejects.toThrow('FusionManager not initialized');
    });

    it('should handle SDK errors gracefully', async () => {
      await fusionManager.initialize();

      // Mock SDK to throw error
      const mockSDK = fusionManager.crossChainSDK as any;
      mockSDK.getQuote = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      let errorEmitted = false;
      fusionManager.on('error', (error) => {
        if (error.type === FusionErrorType.INVALID_QUOTE_REQUEST) {
          errorEmitted = true;
        }
      });

      const fusionRequest = {
        requestId: 'test-error',
        solverId: 'tee-solver',
        srcChainId: 1,
        dstChainId: 137,
        srcTokenAddress: '0x0',
        dstTokenAddress: '0x0',
        amount: '1000',
        walletAddress: '0x0'
      };

      await expect(fusionManager.getQuote(fusionRequest)).rejects.toThrow('Network error');
      expect(errorEmitted).toBe(true);
    });
  });

  describe('lifecycle management', () => {
    it('should start and stop cleanly', async () => {
      await fusionManager.initialize();
      expect(() => fusionManager.stop()).not.toThrow();
    });

    it('should clear state on stop', async () => {
      await fusionManager.initialize();
      await fusionManager.stop();
      
      const stats = fusionManager.getStats();
      expect(stats.activeOrders).toBe(0);
    });
  });

  describe('utility functions', () => {
    it('should validate addresses correctly', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b';
      const invalidAddress = '0xinvalid';
      
      expect(validAddress).toMatch(/^0x[a-f0-9]{40}$/i);
      expect(invalidAddress).not.toMatch(/^0x[a-f0-9]{40}$/i);
    });

    it('should format amounts correctly', () => {
      const amount = BigInt('1000000000000000000'); // 1 ETH
      const formatted = amount.toString();
      
      expect(formatted).toBe('1000000000000000000');
      expect(BigInt(formatted)).toBe(amount);
    });

    it('should handle preset configurations', () => {
      const { PresetEnum } = require('@1inch/cross-chain-sdk');
      
      expect(mockConfig.defaultPreset).toBe(PresetEnum.fast);
      expect(Object.values(PresetEnum)).toContain(PresetEnum.fast);
      expect(Object.values(PresetEnum)).toContain(PresetEnum.medium);
      expect(Object.values(PresetEnum)).toContain(PresetEnum.slow);
    });
  });
});