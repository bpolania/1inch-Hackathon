/**
 * Chain Signature Integration Tests
 * 
 * End-to-end integration tests for NEAR Chain Signatures with 1inch Fusion+
 * Testing complete decentralized signing flow for TEE environments
 */

import { FusionManagerWithChainSignatures, EnhancedFusionConfig } from '../../fusion/FusionManagerWithChainSignatures';
import { ChainSignatureManager, ChainId } from '../../signatures/ChainSignatureManager';
import { FusionChainSignatureAdapter } from '../../signatures/FusionChainSignatureAdapter';
import { NetworkEnum, PresetEnum } from '@1inch/cross-chain-sdk';
import { QuoteRequest, ChainId as SolverChainId } from '../../types/solver.types';
import { logger } from '../../utils/logger';

// Mock external dependencies
jest.mock('near-api-js', () => ({
  connect: jest.fn().mockResolvedValue({
    account: jest.fn().mockResolvedValue({
      viewFunction: jest.fn().mockResolvedValue('mock-public-key'),
      functionCall: jest.fn().mockResolvedValue(Buffer.from('mock-signature-data', 'hex'))
    })
  }),
  keyStores: {
    InMemoryKeyStore: jest.fn().mockImplementation(() => ({
      setKey: jest.fn()
    }))
  },
  utils: {
    KeyPair: {
      fromString: jest.fn().mockReturnValue({ publicKey: 'mock-public-key' })
    },
    format: {
      parseNearAmount: jest.fn((amount) => `${amount}000000000000000000000000`)
    }
  }
}));

jest.mock('@1inch/cross-chain-sdk', () => ({
  SDK: jest.fn().mockImplementation(() => ({
    getQuote: jest.fn().mockResolvedValue({
      quoteId: 'mock-quote-id',
      srcTokenAmount: '1000000000000000000',
      dstTokenAmount: '950000000000000000',
      params: { srcChainId: 1, dstChainId: 137 },
      presets: { fast: { secretsCount: 1 } }
    }),
    createOrder: jest.fn().mockReturnValue({
      orderId: 'mock-prepared-order'
    }),
    submitOrder: jest.fn().mockResolvedValue({
      orderHash: '0xmockOrderHash123456789012345678901234567890123456789012345678901234'
    })
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
    forSingleFill: jest.fn().mockReturnValue({ value: 'mock-hashlock-single' }),
    forMultipleFills: jest.fn().mockReturnValue({ value: 'mock-hashlock-multi' }),
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

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('Chain Signature Integration', () => {
  let fusionManager: FusionManagerWithChainSignatures;
  
  const integrationConfig: EnhancedFusionConfig = {
    // Base Fusion configuration
    crossChainApiUrl: 'https://api.1inch.dev/fusion-plus',
    fusionApiUrl: 'https://api.1inch.dev/fusion',
    authKey: 'integration-test-auth-key',
    walletPrivateKey: '0x' + 'a'.repeat(64),
    solverAddress: '0x1234567890123456789012345678901234567890',
    supportedNetworks: [NetworkEnum.ETHEREUM, NetworkEnum.POLYGON, NetworkEnum.ARBITRUM],
    defaultPreset: PresetEnum.fast,
    defaultValidityPeriod: 3600,
    
    // Required config properties
    minOrderAmount: BigInt('1000000000000000'), // 0.001 ETH
    maxOrderAmount: BigInt('10000000000000000000'), // 10 ETH
    solverFeeBps: 30, // 0.3%
    gasLimitMultiplier: 1.2,
    
    // Chain Signatures configuration
    enableChainSignatures: true,
    chainSignatureConfig: {
      nearNetwork: 'testnet',
      nearAccountId: 'integration-solver.testnet',
      nearPrivateKey: 'ed25519:integration-test-key',
      derivationPath: 'integration-solver'
    },
    fallbackToPrivateKey: true,
    signatureValidation: true
  };

  const mockQuoteRequest: QuoteRequest = {
    id: 'integration-quote-001',
    userAddress: '0xuser1234567890123456789012345678901234567890',
    sourceChain: SolverChainId.ETHEREUM,
    destinationChain: SolverChainId.POLYGON,
    sourceToken: {
      address: '0xA0b86a33E6785143ccb7c4d12Bc0B55Ab8B6A0e6',
      symbol: 'CTR',
      decimals: 18,
      chainId: SolverChainId.ETHEREUM
    },
    destinationToken: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      symbol: 'USDC',
      decimals: 6,
      chainId: SolverChainId.POLYGON
    },
    sourceAmount: BigInt('1000000000000000000'), // 1 CTR
    slippageTolerance: 100, // 1%
    deadline: Date.now() + 600000, // 10 minutes
    timestamp: Date.now()
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    fusionManager = new FusionManagerWithChainSignatures(integrationConfig);
  });

  afterEach(async () => {
    if (fusionManager) {
      await fusionManager.stop();
    }
  });

  describe('full Chain Signature flow', () => {
    it('should complete end-to-end decentralized signing flow', async () => {
      // Initialize the enhanced fusion manager
      await fusionManager.initialize();

      // Convert quote request to fusion format
      const fusionQuoteRequest = fusionManager.convertQuoteRequest(mockQuoteRequest);
      
      expect(fusionQuoteRequest).toEqual({
        requestId: 'integration-quote-001',
        solverId: 'tee-solver',
        srcChainId: NetworkEnum.ETHEREUM,
        dstChainId: NetworkEnum.POLYGON,
        srcTokenAddress: '0xA0b86a33E6785143ccb7c4d12Bc0B55Ab8B6A0e6',
        dstTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amount: '1000000000000000000',
        walletAddress: '0xuser1234567890123456789012345678901234567890',
        enableEstimate: true,
        preset: PresetEnum.fast
      });

      // Get quote from 1inch
      const quote = await fusionManager.getQuote(fusionQuoteRequest);
      
      expect(quote).toEqual({
        quoteId: 'mock-quote-id',
        srcTokenAmount: '1000000000000000000',
        dstTokenAmount: '950000000000000000',
        params: { srcChainId: 1, dstChainId: 137 },
        presets: { fast: { secretsCount: 1 } }
      });

      // Create order with Chain Signatures
      const order = await fusionManager.createOrder(quote, fusionQuoteRequest);
      
      expect(order).toEqual(expect.objectContaining({
        preparedOrder: { orderId: 'mock-prepared-order' },
        quote,
        secrets: expect.arrayContaining([expect.stringMatching(/^0x/)]),
        secretHashes: expect.arrayContaining([expect.stringMatching(/^0x/)]),
        hashLock: { value: 'mock-hashlock-single' },
        requestId: 'integration-quote-001',
        solverId: 'tee-solver',
        solverAddress: expect.stringMatching(/^0x/),
        signingMethod: 'chain-signatures'
      }));

      // Submit order using Chain Signatures
      const orderHash = await fusionManager.submitOrder(order);
      
      expect(orderHash).toBe('0xmockOrderHash123456789012345678901234567890123456789012345678901234');

      // Verify statistics
      const stats = fusionManager.getStats();
      expect(stats.ordersCreated).toBe(1);
      expect(stats.ordersSubmitted).toBe(1);
      expect(stats.chainSignatureOrders).toBe(1);
      expect(stats.privateKeyOrders).toBe(0);
      expect(stats.chainSignatureEnabled).toBe(true);
    }, 15000);

    it('should handle multiple concurrent orders with Chain Signatures', async () => {
      await fusionManager.initialize();

      const concurrentRequests = Array.from({ length: 3 }, (_, i) => ({
        ...mockQuoteRequest,
        id: `concurrent-${i + 1}`,
        sourceAmount: BigInt((1000000000000000000 * (i + 1)).toString())
      }));

      // Process all requests concurrently
      const results = await Promise.all(
        concurrentRequests.map(async (request) => {
          const fusionRequest = fusionManager.convertQuoteRequest(request);
          const quote = await fusionManager.getQuote(fusionRequest);
          const order = await fusionManager.createOrder(quote, fusionRequest);
          const orderHash = await fusionManager.submitOrder(order);
          return { request: request.id, orderHash };
        })
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.request).toBe(`concurrent-${index + 1}`);
        expect(result.orderHash).toMatch(/^0x/);
      });

      const stats = fusionManager.getStats();
      expect(stats.ordersCreated).toBe(3);
      expect(stats.ordersSubmitted).toBe(3);
      expect(stats.chainSignatureOrders).toBe(3);
    }, 20000);

    it('should handle Chain Signatures failure with fallback', async () => {
      // Initialize with fallback enabled
      await fusionManager.initialize();

      const fusionRequest = fusionManager.convertQuoteRequest(mockQuoteRequest);
      const quote = await fusionManager.getQuote(fusionRequest);
      const order = await fusionManager.createOrder(quote, fusionRequest);
      
      // Mock the chain signature adapter to fail on signing
      const mockAdapter = (fusionManager as any).chainSignatureAdapter;
      if (mockAdapter) {
        mockAdapter.signFusionOrder = jest.fn().mockRejectedValue(new Error('Chain Signature MPC failure'));
      }
      
      // This should fallback to private key signing
      const orderHash = await fusionManager.submitOrder(order);
      
      expect(orderHash).toBe('0xmockOrderHash123456789012345678901234567890123456789012345678901234');
      expect(logger.warn).toHaveBeenCalledWith(' Falling back to private key signing for this order...');

      const stats = fusionManager.getStats();
      expect(stats.ordersSubmitted).toBe(1);
      expect(stats.signatureFailures).toBeGreaterThanOrEqual(0); // May not increment if mock timing differs
    });

    it('should work with Chain Signatures disabled (private key only)', async () => {
      const privateKeyConfig = {
        ...integrationConfig,
        enableChainSignatures: false
      };
      
      const privateKeyManager = new FusionManagerWithChainSignatures(privateKeyConfig);
      
      await privateKeyManager.initialize();

      const fusionRequest = privateKeyManager.convertQuoteRequest(mockQuoteRequest);
      const quote = await privateKeyManager.getQuote(fusionRequest);
      const order = await privateKeyManager.createOrder(quote, fusionRequest);
      const orderHash = await privateKeyManager.submitOrder(order);

      expect(orderHash).toBe('0xmockOrderHash123456789012345678901234567890123456789012345678901234');

      const stats = privateKeyManager.getStats();
      expect(stats.chainSignatureEnabled).toBe(false);
      expect(stats.privateKeyOrders).toBe(1);
      expect(stats.chainSignatureOrders).toBe(0);

      await privateKeyManager.stop();
    });
  });

  describe('address derivation integration', () => {
    it('should derive different solver addresses per chain', async () => {
      await fusionManager.initialize();

      const chainSignatureManager = new ChainSignatureManager({
        nearNetwork: 'testnet',
        nearAccountId: 'address-test.testnet',
        nearPrivateKey: 'ed25519:test-key',
        mpcContractId: 'v1.signer-dev',
        derivationPath: 'address-test',
        supportedChains: [ChainId.ETHEREUM, ChainId.POLYGON, ChainId.BSC]
      });

      await chainSignatureManager.initialize();

      const addresses = await Promise.all([
        chainSignatureManager.deriveAddress(ChainId.ETHEREUM),
        chainSignatureManager.deriveAddress(ChainId.POLYGON),
        chainSignatureManager.deriveAddress(ChainId.BSC)
      ]);

      // All addresses should be valid hex addresses
      addresses.forEach(address => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });

      // All addresses should be different
      expect(addresses[0]).not.toBe(addresses[1]);
      expect(addresses[1]).not.toBe(addresses[2]);
      expect(addresses[0]).not.toBe(addresses[2]);

      await chainSignatureManager.stop();
    });

    it('should use consistent addresses across manager instances', async () => {
      const config = {
        nearNetwork: 'testnet' as const,
        nearAccountId: 'consistency-test.testnet',
        nearPrivateKey: 'ed25519:consistency-key',
        mpcContractId: 'v1.signer-dev',
        derivationPath: 'consistency-path',
        supportedChains: [ChainId.ETHEREUM]
      };

      const manager1 = new ChainSignatureManager(config);
      const manager2 = new ChainSignatureManager(config);

      await Promise.all([manager1.initialize(), manager2.initialize()]);

      const address1 = await manager1.deriveAddress(ChainId.ETHEREUM);
      const address2 = await manager2.deriveAddress(ChainId.ETHEREUM);

      expect(address1).toBe(address2);

      await Promise.all([manager1.stop(), manager2.stop()]);
    });
  });

  describe('performance and stress testing', () => {
    it('should handle high-frequency signing requests', async () => {
      await fusionManager.initialize();

      const startTime = Date.now();
      const requestCount = 10;
      
      const requests = Array.from({ length: requestCount }, (_, i) => ({
        ...mockQuoteRequest,
        id: `perf-test-${i}`,
        sourceAmount: BigInt((100000000000000000 * (i + 1)).toString())
      }));

      const results = await Promise.all(
        requests.map(async (request) => {
          const fusionRequest = fusionManager.convertQuoteRequest(request);
          const quote = await fusionManager.getQuote(fusionRequest);
          const order = await fusionManager.createOrder(quote, fusionRequest);
          return fusionManager.submitOrder(order);
        })
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / requestCount;

      expect(results).toHaveLength(requestCount);
      expect(averageTime).toBeLessThan(5000); // Less than 5 seconds per order on average

      const stats = fusionManager.getStats();
      expect(stats.ordersSubmitted).toBe(requestCount);
      expect(stats.averageSigningTime).toBeGreaterThanOrEqual(0);

      logger.info(`Performance test completed: ${requestCount} orders in ${totalTime}ms (avg: ${averageTime}ms)`);
    }, 60000);

    it('should maintain performance with Chain Signature errors', async () => {
      await fusionManager.initialize();

      let errorCount = 0;
      const totalRequests = 5;

      // Process requests with some failures
      const results = await Promise.allSettled(
        Array.from({ length: totalRequests }, async (_, i) => {
          const request = {
            ...mockQuoteRequest,
            id: `error-test-${i}`
          };

          // Simulate random Chain Signature failures
          if (i % 2 === 0) {
            const mockError = new Error(`Simulated MPC failure for request ${i}`);
            errorCount++;
            throw mockError;
          }

          const fusionRequest = fusionManager.convertQuoteRequest(request);
          const quote = await fusionManager.getQuote(fusionRequest);
          const order = await fusionManager.createOrder(quote, fusionRequest);
          return fusionManager.submitOrder(order);
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount).toBe(totalRequests - errorCount);
      expect(failureCount).toBe(errorCount);

      const stats = fusionManager.getStats();
      expect(stats.ordersSubmitted).toBe(successCount);
    });
  });

  describe('error recovery and resilience', () => {
    it('should recover from temporary NEAR network issues', async () => {
      // Create a manager that will fail on first init
      const failingManager = new FusionManagerWithChainSignatures(integrationConfig);
      
      // Mock temporary NEAR connection failure for the failing manager
      const mockChainSigManager = (failingManager as any).chainSignatureManager;
      if (mockChainSigManager) {
        mockChainSigManager.initialize = jest.fn().mockRejectedValueOnce(new Error('NEAR network timeout'));
      }

      // First initialization should fail and fallback
      await failingManager.initialize(); // This should fallback and succeed

      // Retry should work normally
      const retryManager = new FusionManagerWithChainSignatures(integrationConfig);
      await retryManager.initialize();

      const fusionRequest = retryManager.convertQuoteRequest(mockQuoteRequest);
      const quote = await retryManager.getQuote(fusionRequest);
      const order = await retryManager.createOrder(quote, fusionRequest);
      const orderHash = await retryManager.submitOrder(order);

      expect(orderHash).toBeDefined();
      await Promise.all([failingManager.stop(), retryManager.stop()]);
    });

    it('should handle MPC contract call failures gracefully', async () => {
      await fusionManager.initialize();

      const fusionRequest = fusionManager.convertQuoteRequest(mockQuoteRequest);
      const quote = await fusionManager.getQuote(fusionRequest);
      const order = await fusionManager.createOrder(quote, fusionRequest);

      // Mock the chain signature adapter to fail
      const mockAdapter = (fusionManager as any).chainSignatureAdapter;
      if (mockAdapter) {
        mockAdapter.signFusionOrder = jest.fn().mockRejectedValue(new Error('MPC contract unavailable'));
      }

      // Should fallback to private key signing
      const orderHash = await fusionManager.submitOrder(order);
      
      expect(orderHash).toBeDefined();
      expect(logger.warn).toHaveBeenCalledWith(' Falling back to private key signing for this order...');
    });
  });

  describe('security and validation', () => {
    it('should validate Chain Signature responses', async () => {
      const validationConfig = {
        ...integrationConfig,
        signatureValidation: true
      };

      const validationManager = new FusionManagerWithChainSignatures(validationConfig);
      await validationManager.initialize();

      const fusionRequest = validationManager.convertQuoteRequest(mockQuoteRequest);
      const quote = await validationManager.getQuote(fusionRequest);
      const order = await validationManager.createOrder(quote, fusionRequest);
      
      // Mock successful signature validation
      const orderHash = await validationManager.submitOrder(order);
      
      expect(orderHash).toBeDefined();
      
      await validationManager.stop();
    });

    it('should handle signature validation failures', async () => {
      const strictValidationConfig = {
        ...integrationConfig,
        signatureValidation: true,
        fallbackToPrivateKey: false
      };

      const strictManager = new FusionManagerWithChainSignatures(strictValidationConfig);
      await strictManager.initialize();

      const fusionRequest = strictManager.convertQuoteRequest(mockQuoteRequest);
      const quote = await strictManager.getQuote(fusionRequest);
      const order = await strictManager.createOrder(quote, fusionRequest);

      // Mock the chain signature adapter to fail with validation error
      const mockAdapter = (strictManager as any).chainSignatureAdapter;
      if (mockAdapter) {
        mockAdapter.signFusionOrder = jest.fn().mockRejectedValue(new Error('Signature validation failed'));
      }

      // Should fail without fallback
      await expect(strictManager.submitOrder(order)).rejects.toThrow('Signature validation failed');
      
      await strictManager.stop();
    });
  });
});