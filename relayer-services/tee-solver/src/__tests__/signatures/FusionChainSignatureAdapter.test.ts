/**
 * Fusion Chain Signature Adapter Tests
 * 
 * Unit tests for bridging Chain Signatures with 1inch Fusion+ orders
 */

import { FusionChainSignatureAdapter } from '../../signatures/FusionChainSignatureAdapter';
import { ChainSignatureManager, ChainId } from '../../signatures/ChainSignatureManager';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('FusionChainSignatureAdapter', () => {
  let adapter: FusionChainSignatureAdapter;
  let mockChainSignatureManager: jest.Mocked<ChainSignatureManager>;

  const mockFusionOrder = {
    // Core order data
    srcChainId: 1 as any, // NetworkEnum.ETHEREUM
    dstChainId: 137 as any, // NetworkEnum.POLYGON  
    srcTokenAddress: '0xA0b86a33E6785143ccb7c4d12Bc0B55Ab8B6A0e6',
    dstTokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    amount: '1000000000000000000',
    walletAddress: '0xuser1234567890123456789012345678901234567890',
    
    // Order details
    quote: {
      quoteId: 'mock-quote-id',
      srcTokenAmount: '1000000000000000000',
      dstTokenAmount: '950000000000000000'
    } as any,
    validUntil: Date.now() + 300000,
    
    // Solver metadata
    solverId: 'test-solver',
    requestId: 'fusion-order-123',
    confidence: 85
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock ChainSignatureManager
    mockChainSignatureManager = {
      initialize: jest.fn(),
      requestSignature: jest.fn(),
      deriveAddress: jest.fn(),
      getSupportedChains: jest.fn(),
      getStats: jest.fn(),
      stop: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;

    const config = {
      chainSignatureManager: mockChainSignatureManager,
      derivationPath: 'fusion-solver',
      enabledChains: ['ethereum', 'polygon', 'bsc'],
      signatureValidation: true
    };

    adapter = new FusionChainSignatureAdapter(config);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: true } as any);
      mockChainSignatureManager.getSupportedChains.mockReturnValue([
        { chainId: ChainId.ETHEREUM, signatureScheme: 'secp256k1', chainName: 'Ethereum' },
        { chainId: ChainId.POLYGON, signatureScheme: 'secp256k1', chainName: 'Polygon' }
      ]);

      await adapter.initialize();

      expect(mockChainSignatureManager.getSupportedChains).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(' Fusion Chain Signature Adapter initialized', expect.any(Object));
    });

    it('should initialize ChainSignatureManager if not already initialized', async () => {
      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: false } as any);
      mockChainSignatureManager.initialize.mockResolvedValue();
      mockChainSignatureManager.getSupportedChains.mockReturnValue([]);

      await adapter.initialize();

      expect(mockChainSignatureManager.initialize).toHaveBeenCalled();
    });

    it('should warn about unsupported chains', async () => {
      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: true } as any);
      mockChainSignatureManager.getSupportedChains.mockReturnValue([
        { chainId: ChainId.ETHEREUM, signatureScheme: 'secp256k1', chainName: 'Ethereum' }
      ]);

      await adapter.initialize();

      expect(logger.warn).toHaveBeenCalledWith(
        ' Some enabled chains are not supported by Chain Signatures:', 
        ['polygon', 'bsc']
      );
    });
  });

  describe('fusion order signing', () => {
    beforeEach(async () => {
      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: true } as any);
      mockChainSignatureManager.getSupportedChains.mockReturnValue([]);
      await adapter.initialize();
    });

    it('should sign Fusion+ order successfully', async () => {
      const mockSolverAddress = '0x1234567890123456789012345678901234567890';
      const mockSignatureResponse = {
        requestId: 'fusion-12345',
        signature: '0xabcdef123456789',
        recoveryId: 1,
        signedTransaction: { ...mockFusionOrder, signature: '0xabcdef123456789' },
        targetChain: ChainId.ETHEREUM
      };

      mockChainSignatureManager.deriveAddress.mockResolvedValue(mockSolverAddress);
      mockChainSignatureManager.requestSignature.mockResolvedValue(mockSignatureResponse);

      const result = await adapter.signFusionOrder(mockFusionOrder, 'ethereum');

      expect(result).toEqual({
        signedOrder: expect.objectContaining({
          ...mockFusionOrder,
          solver: mockSolverAddress,
          signature: '0xabcdef123456789',
          signatureType: 'chain-signature-mpc'
        }),
        signature: '0xabcdef123456789',
        solverAddress: mockSolverAddress
      });

      expect(mockChainSignatureManager.deriveAddress).toHaveBeenCalledWith(ChainId.ETHEREUM, 'fusion-solver');
      expect(mockChainSignatureManager.requestSignature).toHaveBeenCalledWith(expect.objectContaining({
        targetChain: ChainId.ETHEREUM,
        derivationPath: 'fusion-solver',
        signatureScheme: 'secp256k1'
      }));
    });

    it('should handle different target chains', async () => {
      const chains = [
        { name: 'ethereum', chainId: ChainId.ETHEREUM },
        { name: 'polygon', chainId: ChainId.POLYGON },
        { name: 'bsc', chainId: ChainId.BSC }
      ];

      for (const { name, chainId } of chains) {
        const mockAddress = `0x${name}${'0'.repeat(34)}`;
        mockChainSignatureManager.deriveAddress.mockResolvedValue(mockAddress);
        mockChainSignatureManager.requestSignature.mockResolvedValue({
          requestId: 'test',
          signature: '0xsignature',
          signedTransaction: {},
          targetChain: chainId
        } as any);

        const result = await adapter.signFusionOrder(mockFusionOrder, name);

        expect(result.solverAddress).toBe(mockAddress);
        expect(mockChainSignatureManager.deriveAddress).toHaveBeenLastCalledWith(chainId, 'fusion-solver');
      }
    });

    it('should throw error for unsupported chain', async () => {
      await expect(adapter.signFusionOrder(mockFusionOrder, 'unsupported-chain')).rejects.toThrow('Unsupported target chain');
    });

    it('should handle signing failure', async () => {
      mockChainSignatureManager.deriveAddress.mockResolvedValue('0x1234567890123456789012345678901234567890');
      mockChainSignatureManager.requestSignature.mockRejectedValue(new Error('Signing failed'));

      await expect(adapter.signFusionOrder(mockFusionOrder, 'ethereum')).rejects.toThrow('Signing failed');
      expect(logger.error).toHaveBeenCalledWith(' Failed to sign Fusion+ order:', expect.any(Error));
    });

    it('should emit events on successful signing', async () => {
      const eventSpy = jest.fn();
      adapter.on('order_signed', eventSpy);

      mockChainSignatureManager.deriveAddress.mockResolvedValue('0x1234567890123456789012345678901234567890');
      mockChainSignatureManager.requestSignature.mockResolvedValue({
        requestId: 'test',
        signature: '0xsignature',
        signedTransaction: {},
        targetChain: ChainId.ETHEREUM
      } as any);

      await adapter.signFusionOrder(mockFusionOrder, 'ethereum');

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        targetChain: 'ethereum',
        signingTime: expect.any(Number)
      }));
    });

    it('should emit events on signing failure', async () => {
      const eventSpy = jest.fn();
      adapter.on('signing_failed', eventSpy);

      mockChainSignatureManager.deriveAddress.mockResolvedValue('0x1234567890123456789012345678901234567890');
      mockChainSignatureManager.requestSignature.mockRejectedValue(new Error('Signing failed'));

      await expect(adapter.signFusionOrder(mockFusionOrder, 'ethereum')).rejects.toThrow();

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        targetChain: 'ethereum',
        error: 'Signing failed'
      }));
    });

    it('should throw error if not initialized', async () => {
      const uninitializedAdapter = new FusionChainSignatureAdapter({
        chainSignatureManager: mockChainSignatureManager,
        derivationPath: 'test',
        enabledChains: ['ethereum'],
        signatureValidation: false
      });

      await expect(uninitializedAdapter.signFusionOrder(mockFusionOrder, 'ethereum')).rejects.toThrow('FusionChainSignatureAdapter not initialized');
    });
  });

  describe('multiple order signing', () => {
    beforeEach(async () => {
      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: true } as any);
      mockChainSignatureManager.getSupportedChains.mockReturnValue([]);
      await adapter.initialize();
    });

    it('should sign multiple orders concurrently', async () => {
      const orders = [
        { order: { ...mockFusionOrder, orderId: 'order-1' }, targetChain: 'ethereum' },
        { order: { ...mockFusionOrder, orderId: 'order-2' }, targetChain: 'polygon' },
        { order: { ...mockFusionOrder, orderId: 'order-3' }, targetChain: 'bsc' }
      ];

      mockChainSignatureManager.deriveAddress.mockResolvedValue('0x1234567890123456789012345678901234567890');
      mockChainSignatureManager.requestSignature.mockResolvedValue({
        requestId: 'test',
        signature: '0xsignature',
        signedTransaction: {},
        targetChain: ChainId.ETHEREUM
      } as any);

      const results = await adapter.signMultipleFusionOrders(orders);

      expect(results).toHaveLength(3);
      expect(mockChainSignatureManager.requestSignature).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith(' Successfully signed 3 Fusion+ orders');
    });

    it('should handle partial failures in concurrent signing', async () => {
      const orders = [
        { order: { ...mockFusionOrder, orderId: 'order-1' }, targetChain: 'ethereum' },
        { order: { ...mockFusionOrder, orderId: 'order-2' }, targetChain: 'polygon' }
      ];

      mockChainSignatureManager.deriveAddress.mockResolvedValue('0x1234567890123456789012345678901234567890');
      mockChainSignatureManager.requestSignature
        .mockResolvedValueOnce({
          requestId: 'test',
          signature: '0xsignature',
          signedTransaction: {},
          targetChain: ChainId.ETHEREUM
        } as any)
        .mockRejectedValueOnce(new Error('Second order failed'));

      await expect(adapter.signMultipleFusionOrders(orders)).rejects.toThrow('Second order failed');
    });
  });

  describe('signature verification', () => {
    beforeEach(async () => {
      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: true } as any);
      mockChainSignatureManager.getSupportedChains.mockReturnValue([]);
      await adapter.initialize();
    });

    it('should verify valid signature', async () => {
      const signedOrder = {
        ...mockFusionOrder,
        signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
        solver: '0x1234567890123456789012345678901234567890'
      };

      const result = await adapter.verifyOrderSignature(signedOrder, 'ethereum');

      expect(result).toEqual({
        isValid: true,
        solverAddress: '0x1234567890123456789012345678901234567890'
      });
    });

    it('should reject invalid signature', async () => {
      const signedOrder = {
        ...mockFusionOrder,
        signature: 'invalid-signature',
        solver: '0x1234567890123456789012345678901234567890'
      };

      const result = await adapter.verifyOrderSignature(signedOrder, 'ethereum');

      expect(result.isValid).toBe(false);
    });

    it('should skip verification if disabled', async () => {
      const adapterWithoutValidation = new FusionChainSignatureAdapter({
        chainSignatureManager: mockChainSignatureManager,
        derivationPath: 'test',
        enabledChains: ['ethereum'],
        signatureValidation: false
      });

      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: true } as any);
      mockChainSignatureManager.getSupportedChains.mockReturnValue([]);
      await adapterWithoutValidation.initialize();

      const result = await adapterWithoutValidation.verifyOrderSignature({}, 'ethereum');

      expect(result.isValid).toBe(true);
    });
  });

  describe('solver address derivation', () => {
    beforeEach(async () => {
      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: true } as any);
      mockChainSignatureManager.getSupportedChains.mockReturnValue([]);
      await adapter.initialize();
    });

    it('should get solver addresses for all enabled chains', async () => {
      const mockAddresses = {
        ethereum: '0xeth1234567890123456789012345678901234567890',
        polygon: '0xpoly123456789012345678901234567890123456789',
        bsc: '0xbsc1234567890123456789012345678901234567890'
      };

      mockChainSignatureManager.deriveAddress
        .mockResolvedValueOnce(mockAddresses.ethereum)
        .mockResolvedValueOnce(mockAddresses.polygon)
        .mockResolvedValueOnce(mockAddresses.bsc);

      const addresses = await adapter.getSolverAddresses();

      expect(addresses).toEqual(mockAddresses);
      expect(mockChainSignatureManager.deriveAddress).toHaveBeenCalledTimes(3);
    });

    it('should handle address derivation failures gracefully', async () => {
      mockChainSignatureManager.deriveAddress
        .mockResolvedValueOnce('0xeth1234567890123456789012345678901234567890')
        .mockRejectedValueOnce(new Error('Polygon derivation failed'))
        .mockResolvedValueOnce('0xbsc1234567890123456789012345678901234567890');

      const addresses = await adapter.getSolverAddresses();

      expect(addresses).toEqual({
        ethereum: '0xeth1234567890123456789012345678901234567890',
        bsc: '0xbsc1234567890123456789012345678901234567890'
      });
      expect(logger.warn).toHaveBeenCalledWith('Failed to derive address for polygon:', expect.any(Error));
    });
  });

  describe('statistics and monitoring', () => {
    beforeEach(async () => {
      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: true } as any);
      mockChainSignatureManager.getSupportedChains.mockReturnValue([]);
      await adapter.initialize();
    });

    it('should track signing statistics', async () => {
      mockChainSignatureManager.deriveAddress.mockResolvedValue('0x1234567890123456789012345678901234567890');
      mockChainSignatureManager.requestSignature.mockResolvedValue({
        requestId: 'test',
        signature: '0xsignature',
        signedTransaction: {},
        targetChain: ChainId.ETHEREUM
      } as any);

      const startTime = Date.now();
      await adapter.signFusionOrder(mockFusionOrder, 'ethereum');
      const endTime = Date.now();

      const stats = adapter.getStats();
      expect(stats.ordersSignedTotal).toBe(1);
      expect(stats.ordersSignedSuccess).toBe(1);
      expect(stats.ordersSignedFailed).toBe(0);
      expect(stats.successRate).toBe(100);
      expect(stats.averageSigningTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageSigningTime).toBeLessThanOrEqual(endTime - startTime + 10);
    });

    it('should track failure statistics', async () => {
      mockChainSignatureManager.deriveAddress.mockResolvedValue('0x1234567890123456789012345678901234567890');
      mockChainSignatureManager.requestSignature.mockRejectedValue(new Error('Signing failed'));

      await expect(adapter.signFusionOrder(mockFusionOrder, 'ethereum')).rejects.toThrow();

      const stats = adapter.getStats();
      expect(stats.ordersSignedTotal).toBe(1);
      expect(stats.ordersSignedSuccess).toBe(0);
      expect(stats.ordersSignedFailed).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it('should include Chain Signature Manager stats', async () => {
      const mockChainSigStats = {
        signaturesRequested: 5,
        signaturesCompleted: 4,
        signaturesFailed: 1,
        isInitialized: true
      };

      mockChainSignatureManager.getStats.mockReturnValue(mockChainSigStats as any);

      const stats = adapter.getStats();
      expect(stats.chainSignatureStats).toEqual(mockChainSigStats);
    });
  });

  describe('cleanup', () => {
    it('should stop successfully', async () => {
      mockChainSignatureManager.getStats.mockReturnValue({ isInitialized: true } as any);
      mockChainSignatureManager.getSupportedChains.mockReturnValue([]);
      await adapter.initialize();

      await adapter.stop();

      expect(logger.info).toHaveBeenCalledWith(' Fusion Chain Signature Adapter stopped');
    });
  });
});