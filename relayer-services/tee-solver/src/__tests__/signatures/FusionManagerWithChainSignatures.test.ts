/**
 * Enhanced Fusion Manager with Chain Signatures Tests
 * 
 * Integration tests for Fusion Manager with both centralized and decentralized signing
 */

import { FusionManagerWithChainSignatures, EnhancedFusionConfig } from '../../fusion/FusionManagerWithChainSignatures';
import { ChainSignatureManager } from '../../signatures/ChainSignatureManager';
import { FusionChainSignatureAdapter } from '../../signatures/FusionChainSignatureAdapter';
import { NetworkEnum, PresetEnum } from '@1inch/cross-chain-sdk';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../signatures/ChainSignatureManager');
jest.mock('../../signatures/FusionChainSignatureAdapter');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock 1inch SDKs
jest.mock('@1inch/cross-chain-sdk', () => ({
  SDK: jest.fn().mockImplementation(() => ({
    getQuote: jest.fn(),
    createOrder: jest.fn(),
    submitOrder: jest.fn()
  })),
  PrivateKeyProviderConnector: jest.fn(),
  NetworkEnum: {
    ETHEREUM: 1,
    POLYGON: 137,
    ARBITRUM: 42161,
    OPTIMISM: 10,
    BINANCE: 56
  },
  PresetEnum: {
    fast: 'fast',
    medium: 'medium',
    slow: 'slow'
  },
  HashLock: {
    forSingleFill: jest.fn().mockReturnValue({ value: 'mock-hashlock' }),
    forMultipleFills: jest.fn().mockReturnValue({ value: 'mock-hashlock' }),
    getMerkleLeaves: jest.fn().mockReturnValue(['leaf1', 'leaf2'])
  }
}));

jest.mock('@1inch/fusion-sdk', () => ({
  FusionSDK: jest.fn().mockImplementation(() => ({})),
  PrivateKeyProviderConnector: jest.fn(),
  NetworkEnum: {
    ETHEREUM: 1
  }
}));

jest.mock('../../fusion/MockWeb3Provider', () => ({
  createMockWeb3Provider: jest.fn().mockReturnValue({
    extend: jest.fn()
  })
}));

describe('FusionManagerWithChainSignatures', () => {
  let fusionManager: FusionManagerWithChainSignatures;
  let mockChainSignatureManager: jest.Mocked<ChainSignatureManager>;
  let mockChainSignatureAdapter: jest.Mocked<FusionChainSignatureAdapter>;

  const mockConfig: EnhancedFusionConfig = {
    // Base Fusion config
    crossChainApiUrl: 'https://api.1inch.dev/fusion-plus',
    fusionApiUrl: 'https://api.1inch.dev/fusion',
    authKey: 'test-auth-key',
    walletPrivateKey: '0x' + '1'.repeat(64),
    solverAddress: '0x1234567890123456789012345678901234567890',
    supportedNetworks: [NetworkEnum.ETHEREUM, NetworkEnum.POLYGON],
    defaultPreset: PresetEnum.fast,
    defaultValidityPeriod: 3600,
    
    // Required config properties
    minOrderAmount: BigInt('1000000000000000'), // 0.001 ETH
    maxOrderAmount: BigInt('10000000000000000000'), // 10 ETH
    solverFeeBps: 20, // 0.2%
    gasLimitMultiplier: 1.1,
    
    // Chain Signatures config
    enableChainSignatures: true,
    chainSignatureConfig: {
      nearNetwork: 'testnet',
      nearAccountId: 'test-solver.testnet',
      nearPrivateKey: 'ed25519:mock-key',
      derivationPath: 'fusion-solver'
    },
    fallbackToPrivateKey: true,
    signatureValidation: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Chain Signature Manager mock
    mockChainSignatureManager = {
      initialize: jest.fn(),
      requestSignature: jest.fn(),
      deriveAddress: jest.fn(),
      getSupportedChains: jest.fn(),
      getStats: jest.fn().mockReturnValue({ isInitialized: true }),
      stop: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    // Setup Chain Signature Adapter mock
    mockChainSignatureAdapter = {
      initialize: jest.fn(),
      signFusionOrder: jest.fn(),
      getSolverAddresses: jest.fn(),
      getStats: jest.fn().mockReturnValue({ 
        ordersSignedTotal: 0, 
        ordersSignedSuccess: 0, 
        ordersSignedFailed: 0 
      }),
      stop: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    (ChainSignatureManager as any).mockImplementation(() => mockChainSignatureManager);
    (FusionChainSignatureAdapter as any).mockImplementation(() => mockChainSignatureAdapter);

    fusionManager = new FusionManagerWithChainSignatures(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize with Chain Signatures enabled', async () => {
      await fusionManager.initialize();

      expect(ChainSignatureManager).toHaveBeenCalledWith(expect.objectContaining({
        nearNetwork: 'testnet',
        nearAccountId: 'test-solver.testnet',
        nearPrivateKey: 'ed25519:mock-key',
        derivationPath: 'fusion-solver'
      }));

      expect(mockChainSignatureManager.initialize).toHaveBeenCalled();
      expect(FusionChainSignatureAdapter).toHaveBeenCalled();
      expect(mockChainSignatureAdapter.initialize).toHaveBeenCalled();

      expect(logger.info).toHaveBeenCalledWith('✅ Enhanced Fusion Manager initialized successfully');
    });

    it('should initialize without Chain Signatures when disabled', async () => {
      const configWithoutChainSig = { ...mockConfig, enableChainSignatures: false };
      const managerWithoutChainSig = new FusionManagerWithChainSignatures(configWithoutChainSig);

      await managerWithoutChainSig.initialize();

      expect(ChainSignatureManager).not.toHaveBeenCalled();
      expect(FusionChainSignatureAdapter).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('✅ Enhanced Fusion Manager initialized successfully');
    });

    it('should fallback to private key on Chain Signatures failure', async () => {
      mockChainSignatureManager.initialize.mockRejectedValue(new Error('Chain Signatures init failed'));

      await fusionManager.initialize();

      expect(logger.warn).toHaveBeenCalledWith('⚠️ Falling back to private key signing...');
      expect(logger.info).toHaveBeenCalledWith('✅ Enhanced Fusion Manager initialized successfully');
    });

    it('should throw error when fallback disabled and Chain Signatures fails', async () => {
      const configNoFallback = { ...mockConfig, fallbackToPrivateKey: false };
      const managerNoFallback = new FusionManagerWithChainSignatures(configNoFallback);
      
      mockChainSignatureManager.initialize.mockRejectedValue(new Error('Chain Signatures init failed'));

      await expect(managerNoFallback.initialize()).rejects.toThrow('Chain Signatures init failed');
    });

    it('should throw error when Chain Signatures enabled but config missing', async () => {
      const configMissingChainSig = { 
        ...mockConfig, 
        chainSignatureConfig: undefined,
        enableChainSignatures: true,
        fallbackToPrivateKey: false // Disable fallback to force error
      };
      const managerMissingConfig = new FusionManagerWithChainSignatures(configMissingChainSig);

      await expect(managerMissingConfig.initialize()).rejects.toThrow('Chain Signature configuration is required');
    });
  });

  describe('quote generation', () => {
    beforeEach(async () => {
      await fusionManager.initialize();
    });

    it('should get quote with Chain Signatures metadata', async () => {
      const mockQuote = {
        quoteId: 'quote-123',
        srcTokenAmount: '1000000000000000000',
        dstTokenAmount: '999000000000000000',
        params: { srcChainId: NetworkEnum.ETHEREUM }
      };

      // Mock SDK getQuote
      const mockCrossChainSDK = {
        getQuote: jest.fn().mockResolvedValue(mockQuote)
      };
      fusionManager.crossChainSDK = mockCrossChainSDK as any;

      const request = {
        requestId: 'test-request',
        solverId: 'tee-solver',
        srcChainId: NetworkEnum.ETHEREUM,
        dstChainId: NetworkEnum.POLYGON,
        srcTokenAddress: '0xA0b86a33E6785143ccb7c4d12Bc0B55Ab8B6A0e6',
        dstTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amount: '1000000000000000000',
        walletAddress: '0x1234567890123456789012345678901234567890',
        enableEstimate: true,
        preset: PresetEnum.fast
      };

      const quote = await fusionManager.getQuote(request);

      expect(quote).toEqual(mockQuote);
      expect(mockCrossChainSDK.getQuote).toHaveBeenCalledWith(expect.objectContaining({
        srcChainId: NetworkEnum.ETHEREUM,
        dstChainId: NetworkEnum.POLYGON,
        amount: '1000000000000000000'
      }));

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Getting 1inch quote'),
        expect.objectContaining({
          signingMethod: 'chain-signatures'
        })
      );
    });
  });

  describe('order creation with Chain Signatures', () => {
    let mockQuote: any;

    beforeEach(async () => {
      await fusionManager.initialize();

      mockQuote = {
        quoteId: 'quote-123',
        srcTokenAmount: '1000000000000000000',
        dstTokenAmount: '999000000000000000',
        params: { srcChainId: NetworkEnum.ETHEREUM },
        presets: { fast: { secretsCount: 1 } }
      };
    });

    it('should create order with Chain Signatures solver address', async () => {
      const mockSolverAddress = '0xchainSig1234567890123456789012345678901234';
      mockChainSignatureAdapter.getSolverAddresses.mockResolvedValue({
        ethereum: mockSolverAddress
      });

      const mockPreparedOrder = { orderId: 'prepared-order-123' };
      const mockCrossChainSDK = {
        createOrder: jest.fn().mockReturnValue(mockPreparedOrder)
      };
      fusionManager.crossChainSDK = mockCrossChainSDK as any;

      const request = {
        requestId: 'test-request',
        solverId: 'tee-solver',
        srcChainId: NetworkEnum.ETHEREUM,
        dstChainId: NetworkEnum.POLYGON,
        srcTokenAddress: '0xA0b86a33E6785143ccb7c4d12Bc0B55Ab8B6A0e6',
        dstTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amount: '1000000000000000000',
        walletAddress: '0x1234567890123456789012345678901234567890',
        preset: PresetEnum.fast
      };

      const order = await fusionManager.createOrder(mockQuote, request);

      expect(order.solverAddress).toBe(mockSolverAddress);
      expect(order.signingMethod).toBe('chain-signatures');
      expect(mockChainSignatureAdapter.getSolverAddresses).toHaveBeenCalled();
    });

    it('should create order with private key solver address when Chain Signatures disabled', async () => {
      const configWithoutChainSig = { ...mockConfig, enableChainSignatures: false };
      const managerWithoutChainSig = new FusionManagerWithChainSignatures(configWithoutChainSig);
      await managerWithoutChainSig.initialize();

      const mockPreparedOrder = { orderId: 'prepared-order-123' };
      const mockCrossChainSDK = {
        createOrder: jest.fn().mockReturnValue(mockPreparedOrder)
      };
      managerWithoutChainSig.crossChainSDK = mockCrossChainSDK as any;

      const request = {
        requestId: 'test-request',
        solverId: 'tee-solver',
        srcChainId: NetworkEnum.ETHEREUM,
        dstChainId: NetworkEnum.POLYGON,
        srcTokenAddress: '0xA0b86a33E6785143ccb7c4d12Bc0B55Ab8B6A0e6',
        dstTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amount: '1000000000000000000',
        walletAddress: '0x1234567890123456789012345678901234567890'
      };

      const order = await managerWithoutChainSig.createOrder(mockQuote, request);

      expect(order.solverAddress).toBe(mockConfig.solverAddress);
      expect(order.signingMethod).toBe('private-key'); // Should show private-key when disabled
    });
  });

  describe('order submission with Chain Signatures', () => {
    let mockOrderData: any;

    beforeEach(async () => {
      await fusionManager.initialize();

      mockOrderData = {
        requestId: 'test-request',
        preparedOrder: { orderId: 'prepared-123' },
        quote: { 
          quoteId: 'quote-123',
          params: { srcChainId: NetworkEnum.ETHEREUM }
        },
        secretHashes: ['0xhash1', '0xhash2'],
        signingMethod: 'chain-signatures'
      };
    });

    it('should submit order using Chain Signatures', async () => {
      const mockSignedResult = {
        signedOrder: { ...mockOrderData.preparedOrder, signature: '0xsignature' },
        signature: '0xsignature',
        solverAddress: '0xsolver123'
      };

      mockChainSignatureAdapter.signFusionOrder.mockResolvedValue(mockSignedResult);

      const mockOrderInfo = { orderHash: '0xorderHash123' };
      const mockCrossChainSDK = {
        submitOrder: jest.fn().mockResolvedValue(mockOrderInfo)
      };
      fusionManager.crossChainSDK = mockCrossChainSDK as any;

      const orderHash = await fusionManager.submitOrder(mockOrderData);

      expect(orderHash).toBe('0xorderHash123');
      expect(mockChainSignatureAdapter.signFusionOrder).toHaveBeenCalledWith(
        mockOrderData.preparedOrder,
        'ethereum'
      );
      expect(mockCrossChainSDK.submitOrder).toHaveBeenCalledWith(
        NetworkEnum.ETHEREUM,
        mockSignedResult.signedOrder,
        'quote-123',
        ['0xhash1', '0xhash2']
      );
    });

    it('should fallback to private key on Chain Signatures failure', async () => {
      mockChainSignatureAdapter.signFusionOrder.mockRejectedValue(new Error('Signing failed'));

      const mockOrderInfo = { orderHash: '0xfallbackHash123' };
      const mockCrossChainSDK = {
        submitOrder: jest.fn().mockResolvedValue(mockOrderInfo)
      };
      fusionManager.crossChainSDK = mockCrossChainSDK as any;

      const orderHash = await fusionManager.submitOrder(mockOrderData);

      expect(orderHash).toBe('0xfallbackHash123');
      expect(logger.warn).toHaveBeenCalledWith('⚠️ Falling back to private key signing for this order...');
      expect(mockCrossChainSDK.submitOrder).toHaveBeenCalledWith(
        NetworkEnum.ETHEREUM,
        mockOrderData.preparedOrder,
        'quote-123',
        ['0xhash1', '0xhash2']
      );
    });

    it('should use private key signing when Chain Signatures not enabled', async () => {
      const orderDataPrivateKey = { ...mockOrderData, signingMethod: 'private-key' };

      const mockOrderInfo = { orderHash: '0xprivateKeyHash123' };
      const mockCrossChainSDK = {
        submitOrder: jest.fn().mockResolvedValue(mockOrderInfo)
      };
      fusionManager.crossChainSDK = mockCrossChainSDK as any;

      const orderHash = await fusionManager.submitOrder(orderDataPrivateKey);

      expect(orderHash).toBe('0xprivateKeyHash123');
      expect(mockChainSignatureAdapter.signFusionOrder).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('🔑 Submitting order with private key signing');
    });

    it('should throw error when fallback disabled and Chain Signatures fails', async () => {
      const configNoFallback = { ...mockConfig, fallbackToPrivateKey: false };
      const managerNoFallback = new FusionManagerWithChainSignatures(configNoFallback);
      await managerNoFallback.initialize();

      mockChainSignatureAdapter.signFusionOrder.mockRejectedValue(new Error('Signing failed'));

      await expect(managerNoFallback.submitOrder(mockOrderData)).rejects.toThrow('Signing failed');
    });
  });

  describe('statistics and monitoring', () => {
    beforeEach(async () => {
      await fusionManager.initialize();
    });

    it('should track enhanced statistics with Chain Signatures metrics', async () => {
      const mockChainSigStats = {
        ordersSignedTotal: 5,
        ordersSignedSuccess: 4,
        ordersSignedFailed: 1,
        successRate: 80
      };

      mockChainSignatureAdapter.getStats.mockReturnValue(mockChainSigStats as any);

      const stats = fusionManager.getStats();

      expect(stats).toEqual(expect.objectContaining({
        ordersCreated: 0,
        ordersSubmitted: 0,
        chainSignatureOrders: 0,
        privateKeyOrders: 0,
        signatureFailures: 0,
        chainSignatureEnabled: true,
        fallbackEnabled: true,
        chainSignatureStats: mockChainSigStats
      }));
    });

    it('should return basic stats when Chain Signatures disabled', async () => {
      const configWithoutChainSig = { ...mockConfig, enableChainSignatures: false };
      const managerWithoutChainSig = new FusionManagerWithChainSignatures(configWithoutChainSig);
      await managerWithoutChainSig.initialize();

      const stats = managerWithoutChainSig.getStats();

      expect(stats.chainSignatureEnabled).toBe(false);
      expect((stats as any).chainSignatureStats).toBeUndefined();
    });

    it('should track order submission statistics', async () => {
      const mockOrderData = {
        requestId: 'stats-test',
        preparedOrder: {},
        quote: { quoteId: 'quote-123', params: { srcChainId: NetworkEnum.ETHEREUM } },
        secretHashes: [],
        signingMethod: 'chain-signatures'
      };

      mockChainSignatureAdapter.signFusionOrder.mockResolvedValue({
        signedOrder: {},
        signature: '0xsig',
        solverAddress: '0xaddr'
      });

      const mockCrossChainSDK = {
        submitOrder: jest.fn().mockResolvedValue({ orderHash: '0xhash' })
      };
      fusionManager.crossChainSDK = mockCrossChainSDK as any;

      await fusionManager.submitOrder(mockOrderData);

      const stats = fusionManager.getStats();
      expect(stats.ordersSubmitted).toBe(1);
      expect(stats.chainSignatureOrders).toBe(1);
      expect(stats.privateKeyOrders).toBe(0);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await fusionManager.initialize();
    });

    it('should forward Chain Signature events', () => {
      const eventData = { orderId: 'test-order' };
      const eventSpy = jest.fn();

      fusionManager.on('order_submitted', eventSpy);

      // Simulate event emission
      fusionManager.emit('order_submitted', eventData);

      expect(eventSpy).toHaveBeenCalledWith(eventData);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await fusionManager.initialize();
    });

    it('should stop all components gracefully', async () => {
      await fusionManager.stop();

      expect(mockChainSignatureAdapter.stop).toHaveBeenCalled();
      expect(mockChainSignatureManager.stop).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('✅ Enhanced Fusion Manager stopped');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockChainSignatureAdapter.stop.mockRejectedValue(new Error('Adapter stop failed'));

      await fusionManager.stop();

      expect(logger.error).toHaveBeenCalledWith('Error stopping Enhanced Fusion Manager:', expect.any(Error));
    });
  });

  describe('integration scenarios', () => {
    beforeEach(async () => {
      await fusionManager.initialize();
    });

    it('should handle complete quote-to-order-to-submission flow with Chain Signatures', async () => {
      // Setup mocks for complete flow
      const mockQuote = {
        quoteId: 'integration-quote',
        srcTokenAmount: '1000000000000000000',
        dstTokenAmount: '999000000000000000',
        params: { srcChainId: NetworkEnum.ETHEREUM },
        presets: { fast: { secretsCount: 1 } }
      };

      const mockSolverAddress = '0xintegrationSolver123456789012345678901234';
      const mockSignedResult = {
        signedOrder: { signature: '0xintegrationSig' },
        signature: '0xintegrationSig',
        solverAddress: mockSolverAddress
      };

      const mockCrossChainSDK = {
        getQuote: jest.fn().mockResolvedValue(mockQuote),
        createOrder: jest.fn().mockReturnValue({ preparedOrder: 'prepared' }),
        submitOrder: jest.fn().mockResolvedValue({ orderHash: '0xintegrationHash' })
      };

      fusionManager.crossChainSDK = mockCrossChainSDK as any;
      mockChainSignatureAdapter.getSolverAddresses.mockResolvedValue({ ethereum: mockSolverAddress });
      mockChainSignatureAdapter.signFusionOrder.mockResolvedValue(mockSignedResult);

      const request = {
        requestId: 'integration-test',
        solverId: 'tee-solver',
        srcChainId: NetworkEnum.ETHEREUM,
        dstChainId: NetworkEnum.POLYGON,
        srcTokenAddress: '0xToken1',
        dstTokenAddress: '0xToken2',
        amount: '1000000000000000000',
        walletAddress: '0xUser123',
        enableEstimate: true,
        preset: PresetEnum.fast
      };

      // Execute complete flow
      const quote = await fusionManager.getQuote(request);
      const order = await fusionManager.createOrder(quote, request);
      const orderHash = await fusionManager.submitOrder(order);

      // Verify complete flow
      expect(orderHash).toBe('0xintegrationHash');
      expect(order.solverAddress).toBe(mockSolverAddress);
      expect(order.signingMethod).toBe('chain-signatures');

      const stats = fusionManager.getStats();
      expect(stats.ordersCreated).toBe(1);
      expect(stats.ordersSubmitted).toBe(1);
      expect(stats.chainSignatureOrders).toBe(1);
    });
  });
});