/**
 * Fusion Integration Tests
 * 
 * Test the complete flow from quote request to 1inch Fusion+ meta-order submission
 */

import { FusionManager } from '../../fusion/FusionManager';
import { FusionQuoteGenerator } from '../../quote/FusionQuoteGenerator';
import { IntentListener } from '../../intent/IntentListener';
import { 
  FusionConfig, 
  FUSION_CONFIG_PRESETS,
  FusionErrorType 
} from '../../fusion/types';
import { 
  createQuoteRequest, 
  createSolverConfig,
  createMockWebSocket,
  createMockChainAdapter,
  wait 
} from '../setup';
import { NetworkEnum, PresetEnum } from '@1inch/cross-chain-sdk';
import { ChainId } from '../../types/solver.types';

// Mock all external dependencies
jest.mock('@1inch/cross-chain-sdk', () => ({
  NetworkEnum: {
    ETHEREUM: 1,
    POLYGON: 137,
    BINANCE: 56,
    ARBITRUM: 42161,
    OPTIMISM: 10
  },
  PresetEnum: {
    fast: 'fast',
    medium: 'medium', 
    slow: 'slow'
  },
  SDK: jest.fn().mockImplementation(() => ({
    getQuote: jest.fn().mockResolvedValue({
      quoteId: 'integration-quote-123',
      srcTokenAmount: '1000000000000000000',
      dstTokenAmount: '1980000000000000000', // After fees
      presets: {
        fast: { secretsCount: 1, estimatedTime: 180 },
        medium: { secretsCount: 2, estimatedTime: 300 },
        slow: { secretsCount: 3, estimatedTime: 600 }
      },
      params: { srcChainId: 1, dstChainId: 137 },
      srcEscrowFactory: '0xSourceEscrowFactory',
      dstEscrowFactory: '0xDstEscrowFactory',
      prices: { fast: '100', medium: '95', slow: '90' },
      volume: { fast: '1000', medium: '800', slow: '600' },
      whitelist: ['0xResolver1', '0xResolver2'],
      timeLocks: {
        srcWithdrawal: 3600,
        srcPublicWithdrawal: 7200,
        srcCancellation: 1800,
        srcPublicCancellation: 3600,
        dstWithdrawal: 3600,
        dstPublicWithdrawal: 7200,
        dstCancellation: 1800
      }
    }),
    createOrder: jest.fn().mockReturnValue({
      orderData: {
        maker: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b',
        taker: '0x0000000000000000000000000000000000000000',
        makerAsset: '0xA0b86a33E6413c3A0BbfDB4C2F3F7cEd35c9C8C4',
        takerAsset: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        makingAmount: '1000000000000000000',
        takingAmount: '1980000000000000000',
        salt: '123456789'
      },
      signature: '0xmockintegrationSignature12345'
    }),
    submitOrder: jest.fn().mockResolvedValue({
      orderHash: '0xintegration1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      status: 'pending',
      submittedAt: Date.now()
    })
  })),
  PrivateKeyProviderConnector: jest.fn().mockImplementation(() => ({})),
  HashLock: {
    forSingleFill: jest.fn().mockImplementation(() => ({
      toJSON: jest.fn().mockReturnValue({ value: '0xintegrationhash' }),
      toBuffer: jest.fn().mockReturnValue(Buffer.from('integrationhash', 'hex')),
      eq: jest.fn().mockReturnValue(true)
    })),
    forMultipleFills: jest.fn().mockImplementation(() => ({
      toJSON: jest.fn().mockReturnValue({ value: '0xmultiintegrationhash' }),
      toBuffer: jest.fn().mockReturnValue(Buffer.from('multiintegrationhash', 'hex')),
      eq: jest.fn().mockReturnValue(true)
    })),
    getMerkleLeaves: jest.fn().mockReturnValue([
      { value: '0xleaf1' }, 
      { value: '0xleaf2' }, 
      { value: '0xleaf3' }
    ])
  }
}));

jest.mock('@1inch/fusion-sdk', () => ({
  FusionSDK: jest.fn().mockImplementation(() => ({})),
  PrivateKeyProviderConnector: jest.fn().mockImplementation(() => ({})),
  NetworkEnum: { ETHEREUM: 1 }
}));

jest.mock('ws');

describe('Fusion Integration - End-to-End Flow', () => {
  let fusionManager: FusionManager;
  let fusionQuoteGenerator: FusionQuoteGenerator;
  let intentListener: IntentListener;
  let solverConfig: any;
  let fusionConfig: FusionConfig;
  let mockWs: any;
  let emit: any;

  beforeEach(async () => {
    // Create configurations
    solverConfig = createSolverConfig();
    fusionConfig = {
      ...FUSION_CONFIG_PRESETS.development,
      supportedNetworks: [NetworkEnum.ETHEREUM, NetworkEnum.POLYGON],
      walletPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      solverAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b',
      minOrderAmount: BigInt('1000000000000000'),
      maxOrderAmount: BigInt('1000000000000000000000')
    };

    // Set up WebSocket mock
    const mockSetup = createMockWebSocket();
    mockWs = mockSetup.mockWs;
    emit = mockSetup.emit;
    
    const WebSocket = require('ws');
    WebSocket.mockImplementation(() => mockWs);

    // Initialize components
    fusionManager = new FusionManager(fusionConfig);
    fusionQuoteGenerator = new FusionQuoteGenerator(solverConfig, fusionConfig);
    intentListener = new IntentListener(solverConfig);

    // Initialize all components
    await fusionManager.initialize();
    
    // Set up proper chain adapters for FusionQuoteGenerator
    const adapters = new Map([
      [ChainId.ETHEREUM, createMockChainAdapter(ChainId.ETHEREUM) as any],
      [ChainId.POLYGON, createMockChainAdapter(ChainId.POLYGON) as any]
    ]);
    await fusionQuoteGenerator.initialize(adapters);
    
    const initPromise = intentListener.initialize();
    await wait(10);
    emit('open');
    await initPromise;
  });

  afterEach(async () => {
    await Promise.all([
      fusionManager.stop(),
      fusionQuoteGenerator.stop(),
      intentListener.stop()
    ]);
    jest.clearAllMocks();
  });

  describe('complete quote-to-order flow', () => {
    it('should process quote request end-to-end with Fusion+ integration', async () => {
      // 1. Create a quote request
      const quoteRequest = createQuoteRequest({
        id: 'integration-test-123',
        sourceChain: 'ethereum',
        destinationChain: 'polygon',
        sourceAmount: BigInt('1000000000000000000'), // 1 ETH
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      // 2. Generate quote with Fusion+ integration
      const quote = await fusionQuoteGenerator.generateQuote(quoteRequest, true);

      expect(quote).toMatchObject({
        requestId: 'integration-test-123',
        solverId: solverConfig.solverId,
        sourceAmount: BigInt('1000000000000000000'),
        destinationAmount: expect.any(BigInt),
        confidence: expect.any(Number)
      });

      // Should have reasonable confidence for Fusion+ compatible requests  
      expect(quote.confidence).toBeGreaterThanOrEqual(60);
    });

    it('should create and submit complete Fusion+ meta-order', async () => {
      // 1. Convert quote request to Fusion format
      const quoteRequest = createQuoteRequest({
        id: 'meta-order-test-456',
        sourceChain: 'ethereum',
        destinationChain: 'polygon',
        sourceAmount: BigInt('2000000000000000000'), // 2 ETH
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      const fusionRequest = fusionManager.convertQuoteRequest(quoteRequest);

      // 2. Get 1inch quote
      const fusionQuote = await fusionManager.getQuote(fusionRequest);

      expect(fusionQuote).toMatchObject({
        quoteId: 'integration-quote-123',
        srcTokenAmount: '1000000000000000000',
        dstTokenAmount: '1980000000000000000',
        presets: expect.any(Object)
      });

      // 3. Create order from quote
      const orderData = await fusionManager.createOrder(fusionQuote, fusionRequest);

      expect(orderData).toMatchObject({
        preparedOrder: expect.any(Object),
        quote: fusionQuote,
        secrets: expect.any(Array),
        secretHashes: expect.any(Array),
        hashLock: expect.any(Object),
        requestId: 'meta-order-test-456'
      });

      // 4. Submit order to 1inch network
      const orderHash = await fusionManager.submitOrder(orderData);

      expect(orderHash).toBe('0xintegration1234567890abcdef1234567890abcdef1234567890abcdef1234567890');

      // 5. Verify order is tracked
      const activeOrders = fusionManager.getActiveOrders();
      expect(activeOrders).toHaveLength(1);
      expect(activeOrders[0]).toMatchObject({
        orderHash,
        status: 'submitted',
        submittedAt: expect.any(Number)
      });
    });

    it('should handle different chain combinations', async () => {
      const testCases = [
        { src: 'ethereum', dst: 'ethereum', expectedSteps: 'same-chain' },
        { src: 'ethereum', dst: 'polygon', expectedSteps: 'cross-chain' },
        { src: 'polygon', dst: 'arbitrum', expectedSteps: 'cross-chain' }
      ];

      for (const testCase of testCases) {
        const quoteRequest = createQuoteRequest({
          id: `chain-test-${testCase.src}-${testCase.dst}`,
          sourceChain: testCase.src,
          destinationChain: testCase.dst,
          sourceAmount: BigInt('1000000000000000000'),
          userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
        });

        const fusionRequest = fusionManager.convertQuoteRequest(quoteRequest);
        const quote = await fusionManager.getQuote(fusionRequest);

        expect(quote.quoteId).toBeDefined();

        if (testCase.expectedSteps === 'same-chain') {
          expect(fusionRequest.srcChainId).toBe(fusionRequest.dstChainId);
        } else {
          expect(fusionRequest.srcChainId).not.toBe(fusionRequest.dstChainId);
        }
      }
    });
  });

  describe('performance and concurrency', () => {
    it('should handle multiple concurrent quote requests', async () => {
      const concurrentRequests = 5;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const quoteRequest = createQuoteRequest({
          id: `concurrent-test-${i}`,
          sourceChain: 'ethereum',
          destinationChain: 'polygon',
          sourceAmount: BigInt(`${i + 1}000000000000000000`), // 1-5 ETH
          userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
        });

        requests.push(
          fusionQuoteGenerator.generateQuote(quoteRequest, true)
        );
      }

      const quotes = await Promise.all(requests);

      expect(quotes).toHaveLength(concurrentRequests);
      quotes.forEach((quote, index) => {
        expect(quote.requestId).toBe(`concurrent-test-${index}`);
        expect(quote.sourceAmount).toBe(BigInt(`${index + 1}000000000000000000`));
      });
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const loadRequests = 10;

      const requests = Array.from({ length: loadRequests }, (_, i) => {
        const quoteRequest = createQuoteRequest({
          id: `load-test-${i}`,
          sourceChain: 'ethereum',
          destinationChain: 'polygon',
          sourceAmount: BigInt('1000000000000000000'),
          userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
        });
        return fusionQuoteGenerator.generateQuote(quoteRequest, true);
      });

      await Promise.all(requests);

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / loadRequests;

      // Should process quotes quickly (under 100ms average in tests)
      expect(averageTime).toBeLessThan(100);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle partial failures gracefully', async () => {
      // Mock SDK to fail on specific requests
      const mockSDK = fusionManager.crossChainSDK;
      const mockSDKAny = mockSDK as any;
      (mockSDKAny.getQuote = jest.fn()
        .mockResolvedValueOnce({ quoteId: 'success-1', srcTokenAmount: '1000' })
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ quoteId: 'success-3', srcTokenAmount: '1000' }));

      const requests = [
        createQuoteRequest({ id: 'partial-test-1' }),
        createQuoteRequest({ id: 'partial-test-2' }),
        createQuoteRequest({ id: 'partial-test-3' })
      ];

      const results = await Promise.allSettled(
        requests.map(req => {
          const fusionReq = fusionManager.convertQuoteRequest(req);
          return fusionManager.getQuote(fusionReq);
        })
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      // Verify successful requests got proper quotes
      if (results[0].status === 'fulfilled') {
        expect(results[0].value.quoteId).toBe('success-1');
      }
      if (results[2].status === 'fulfilled') {
        expect(results[2].value.quoteId).toBe('success-3');
      }
    });

    it('should maintain service availability during errors', async () => {
      // Cause temporary SDK failure
      const mockSDK = fusionManager.crossChainSDK;
      const mockSDKAny1 = mockSDK as any;
      mockSDKAny1.getQuote = jest.fn().mockRejectedValueOnce(new Error('Temporary failure'));

      const quoteRequest = createQuoteRequest({
        id: 'availability-test',
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      // First request should fail
      const fusionRequest = fusionManager.convertQuoteRequest(quoteRequest);
      await expect(fusionManager.getQuote(fusionRequest)).rejects.toThrow('Temporary failure');

      // Subsequent requests should work
      const mockSDKAny2 = mockSDK as any;
      mockSDKAny2.getQuote = jest.fn().mockResolvedValueOnce({
        quoteId: 'recovery-quote',
        srcTokenAmount: '1000000000000000000'
      });

      const recoveryRequest = createQuoteRequest({
        id: 'recovery-test',
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      const recoveryFusionRequest = fusionManager.convertQuoteRequest(recoveryRequest);
      const recoveryQuote = await fusionManager.getQuote(recoveryFusionRequest);

      expect(recoveryQuote.quoteId).toBe('recovery-quote');
    });
  });

  describe('statistics and monitoring', () => {
    it('should track comprehensive statistics', async () => {
      const initialStats = fusionManager.getStats();
      expect(initialStats.ordersCreated).toBe(0);
      expect(initialStats.ordersSubmitted).toBe(0);

      // Process some orders
      const quoteRequest = createQuoteRequest({
        id: 'stats-test',
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      const fusionRequest = fusionManager.convertQuoteRequest(quoteRequest);
      const quote = await fusionManager.getQuote(fusionRequest);
      const orderData = await fusionManager.createOrder(quote, fusionRequest);
      await fusionManager.submitOrder(orderData);

      const finalStats = fusionManager.getStats();
      expect(finalStats.ordersCreated).toBe(1);
      expect(finalStats.ordersSubmitted).toBe(1);
      expect(finalStats.activeOrders).toBe(1);
      expect(finalStats.totalOrders).toBe(1);
    });

    it('should track quote generator statistics', async () => {
      const initialStats = fusionQuoteGenerator.getStats();
      expect(initialStats.quotesGenerated).toBeDefined();

      // Generate some quotes
      const requests = Array.from({ length: 3 }, (_, i) => 
        createQuoteRequest({
          id: `stats-quote-${i}`,
          sourceChain: 'ethereum',
          destinationChain: 'polygon',
          userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
        })
      );

      for (const request of requests) {
        await fusionQuoteGenerator.generateQuote(request, true);
      }

      const finalStats = fusionQuoteGenerator.getStats();
      expect(finalStats.quotesGenerated).toBeGreaterThan(initialStats.quotesGenerated);
      expect(finalStats.averageQuoteTime).toBeGreaterThan(0);
    });
  });
});