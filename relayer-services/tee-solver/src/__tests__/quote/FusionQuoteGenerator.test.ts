/**
 * FusionQuoteGenerator Tests
 * 
 * Test the enhanced quote generator with 1inch Fusion+ integration
 */

import { FusionQuoteGenerator } from '../../quote/FusionQuoteGenerator';
import { QuoteGenerator } from '../../quote/QuoteGenerator';
import { FusionManager } from '../../fusion/FusionManager';
import { 
  FusionConfig, 
  FUSION_CONFIG_PRESETS 
} from '../../fusion/types';
import { 
  createQuoteRequest, 
  createSolverConfig, 
  createMockChainAdapter,
  wait 
} from '../setup';
import { ChainId } from '../../types/solver.types';

// Mock dependencies
jest.mock('../../quote/QuoteGenerator');
jest.mock('../../fusion/FusionManager');
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
  }
}));

describe('FusionQuoteGenerator', () => {
  let fusionQuoteGenerator: FusionQuoteGenerator;
  let mockBaseGenerator: jest.Mocked<QuoteGenerator>;
  let mockFusionManager: jest.Mocked<FusionManager>;
  let solverConfig: any;
  let fusionConfig: FusionConfig;

  beforeEach(() => {
    // Create configurations
    solverConfig = createSolverConfig();
    fusionConfig = {
      ...FUSION_CONFIG_PRESETS.development,
      supportedNetworks: [1, 137], // Ethereum, Polygon
      walletPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      solverAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b',
      minOrderAmount: BigInt('1000000000000000'),
      maxOrderAmount: BigInt('1000000000000000000000')
    };

    // Create mocks
    mockBaseGenerator = {
      initialize: jest.fn().mockResolvedValue(undefined),
      generateQuote: jest.fn().mockResolvedValue({
        requestId: 'base-quote-123',
        solverId: 'tee-solver',
        timestamp: Date.now(),
        sourceAmount: BigInt('1000000000000000000'),
        destinationAmount: BigInt('1950000000000000000'),
        estimatedGasCost: BigInt('150000'),
        solverFee: BigInt('50000000000000000'),
        route: [],
        estimatedExecutionTime: 300,
        validUntil: Date.now() + 300000,
        confidence: 85
      }),
      getStats: jest.fn().mockReturnValue({
        quotesGenerated: 5,
        averageGenerationTime: 45,
        competitionWinRate: 75
      }),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockFusionManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      convertToMetaOrder: jest.fn().mockResolvedValue({
        originalQuote: expect.any(Object),
        fusionOrder: {
          requestId: 'test-123',
          solverId: 'tee-solver',
          orderHash: '0xmockorderhash'
        },
        secrets: ['0xsecret1'],
        hashLock: { value: '0xhashlock' },
        status: 'pending'
      }),
      getActiveOrders: jest.fn().mockReturnValue([]),
      getStats: jest.fn().mockReturnValue({
        ordersCreated: 2,
        ordersSubmitted: 1,
        activeOrders: 1,
        totalOrders: 2
      }),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    // Mock constructors
    (QuoteGenerator as jest.MockedClass<typeof QuoteGenerator>).mockImplementation(() => mockBaseGenerator);
    (FusionManager as jest.MockedClass<typeof FusionManager>).mockImplementation(() => mockFusionManager);

    // Create instance
    fusionQuoteGenerator = new FusionQuoteGenerator(solverConfig, fusionConfig);
  });

  afterEach(async () => {
    if (fusionQuoteGenerator && fusionQuoteGenerator.stop) {
      await fusionQuoteGenerator.stop();
    }
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize both base generator and fusion manager', async () => {
      const adapters = new Map([
        [ChainId.ETHEREUM, createMockChainAdapter(ChainId.ETHEREUM) as any],
        [ChainId.POLYGON, createMockChainAdapter(ChainId.POLYGON) as any]
      ]);

      await fusionQuoteGenerator.initialize(adapters);

      expect(mockBaseGenerator.initialize).toHaveBeenCalledWith(adapters);
      expect(mockFusionManager.initialize).toHaveBeenCalled();
    });

    it('should emit initialized event', async () => {
      const initSpy = jest.fn();
      fusionQuoteGenerator.on('initialized', initSpy);

      const adapters = new Map();
      await fusionQuoteGenerator.initialize(adapters);

      expect(initSpy).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockFusionManager.initialize.mockRejectedValueOnce(new Error('Init failed'));

      const adapters = new Map();
      await expect(fusionQuoteGenerator.initialize(adapters)).rejects.toThrow('Init failed');
    });
  });

  describe('quote generation', () => {
    beforeEach(async () => {
      const adapters = new Map();
      await fusionQuoteGenerator.initialize(adapters);
    });

    it('should generate enhanced quotes with Fusion+ compatibility', async () => {
      const quoteRequest = createQuoteRequest({
        id: 'enhanced-quote-123',
        sourceChain: 'ethereum',
        destinationChain: 'polygon',
        sourceAmount: BigInt('1000000000000000000'),
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      const quote = await fusionQuoteGenerator.generateQuote(quoteRequest, false);

      expect(mockBaseGenerator.generateQuote).toHaveBeenCalledWith(quoteRequest);
      expect(quote).toMatchObject({
        requestId: 'base-quote-123',
        solverId: 'tee-solver',
        sourceAmount: BigInt('1000000000000000000'),
        destinationAmount: expect.any(BigInt),
        confidence: expect.any(Number)
      });

      // Should have enhanced confidence for compatible chains
      expect(quote.confidence).toBeGreaterThanOrEqual(85);
    });

    it('should create Fusion+ meta-orders when requested', async () => {
      const quoteRequest = createQuoteRequest({
        id: 'meta-order-test-456',
        sourceChain: 'ethereum',
        destinationChain: 'polygon',
        sourceAmount: BigInt('2000000000000000000'),
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      // Set up event listener to capture the fusion_order_created event
      const fusionOrderCreatedSpy = jest.fn();
      fusionQuoteGenerator.on('fusion_order_created', fusionOrderCreatedSpy);

      const quote = await fusionQuoteGenerator.generateQuote(quoteRequest, true);

      expect(mockBaseGenerator.generateQuote).toHaveBeenCalledWith(quoteRequest);
      expect(mockFusionManager.convertToMetaOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'base-quote-123',
          confidence: expect.any(Number),
          destinationAmount: expect.any(BigInt)
        })
      );

      // Should emit fusion order created event
      expect(fusionOrderCreatedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.any(String),
          metaOrder: expect.any(Object),
          creationTime: expect.any(Number)
        })
      );
    });

    it('should handle Fusion+ incompatible requests gracefully', async () => {
      const quoteRequest = createQuoteRequest({
        id: 'incompatible-test',
        sourceChain: 'unsupported-chain' as any,
        destinationChain: 'another-unsupported' as any,
        sourceAmount: BigInt('100'), // Too small
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      // Should still generate quote but not create Fusion+ order
      const quote = await fusionQuoteGenerator.generateQuote(quoteRequest, true);

      expect(mockBaseGenerator.generateQuote).toHaveBeenCalledWith(quoteRequest);
      expect(mockFusionManager.convertToMetaOrder).not.toHaveBeenCalled();
      
      // Should have reduced confidence for incompatible requests
      expect(quote.confidence).toBeLessThan(85);
    });

    it('should apply competitive pricing adjustments for Fusion+', async () => {
      const quoteRequest = createQuoteRequest({
        id: 'pricing-test',
        sourceChain: 'ethereum',
        destinationChain: 'polygon',
        sourceAmount: BigInt('1000000000000000000'),
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      const quote = await fusionQuoteGenerator.generateQuote(quoteRequest, false);

      // Should have applied pricing adjustments
      expect(quote.destinationAmount).toBeGreaterThan(BigInt('1950000000000000000')); // Base + fee reduction
      expect(quote.solverFee).toBeLessThan(BigInt('50000000000000000')); // Reduced fee
    });
  });

  describe('meta-order creation', () => {
    beforeEach(async () => {
      const adapters = new Map();
      await fusionQuoteGenerator.initialize(adapters);
    });

    it('should create meta-orders from quotes', async () => {
      const quote = {
        requestId: 'meta-test-789',
        solverId: 'tee-solver',
        timestamp: Date.now(),
        sourceAmount: BigInt('1000000000000000000'),
        destinationAmount: BigInt('1980000000000000000'),
        estimatedGasCost: BigInt('150000'),
        solverFee: BigInt('20000000000000000'),
        route: [],
        estimatedExecutionTime: 300,
        validUntil: Date.now() + 300000,
        confidence: 90
      };

      const quoteRequest = createQuoteRequest({
        id: 'meta-test-789',
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      const metaOrder = await fusionQuoteGenerator.createFusionMetaOrder(quote, quoteRequest);

      expect(mockFusionManager.convertToMetaOrder).toHaveBeenCalledWith(quote);
      expect(metaOrder).toMatchObject({
        originalQuote: expect.any(Object),
        fusionOrder: expect.any(Object),
        status: 'pending'
      });
    });

    it('should track meta-order creation statistics', async () => {
      const quote = {
        requestId: 'stats-test',
        solverId: 'tee-solver',
        timestamp: Date.now(),
        sourceAmount: BigInt('1000000000000000000'),
        destinationAmount: BigInt('1980000000000000000'),
        estimatedGasCost: BigInt('150000'),
        solverFee: BigInt('20000000000000000'),
        route: [],
        estimatedExecutionTime: 300,
        validUntil: Date.now() + 300000,
        confidence: 90
      };

      const quoteRequest = createQuoteRequest({
        id: 'stats-test',
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      const initialStats = fusionQuoteGenerator.getStats();
      
      await fusionQuoteGenerator.createFusionMetaOrder(quote, quoteRequest);

      const finalStats = fusionQuoteGenerator.getStats();
      expect(finalStats.fusionOrdersCreated).toBeGreaterThan(initialStats.fusionOrdersCreated || 0);
    });

    it('should handle meta-order creation failures', async () => {
      mockFusionManager.convertToMetaOrder.mockRejectedValueOnce(new Error('Order creation failed'));

      const quote = {
        requestId: 'failure-test',
        solverId: 'tee-solver',
        timestamp: Date.now(),
        sourceAmount: BigInt('1000000000000000000'),
        destinationAmount: BigInt('1980000000000000000'),
        estimatedGasCost: BigInt('150000'),
        solverFee: BigInt('20000000000000000'),
        route: [],
        estimatedExecutionTime: 300,
        validUntil: Date.now() + 300000,
        confidence: 90
      };

      const quoteRequest = createQuoteRequest({
        id: 'failure-test',
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      await expect(fusionQuoteGenerator.createFusionMetaOrder(quote, quoteRequest))
        .rejects.toThrow('Order creation failed');
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      const adapters = new Map();
      await fusionQuoteGenerator.initialize(adapters);
    });

    it('should forward base generator events', async () => {
      const errorSpy = jest.fn();
      fusionQuoteGenerator.on('error', errorSpy);

      // Get the event handler that was registered
      const errorHandler = mockBaseGenerator.on.mock.calls.find(call => call[0] === 'error')[1];
      
      // Simulate base generator error by calling the handler directly
      const errorEvent = { type: 'QUOTE_GENERATION_ERROR', message: 'Test error' };
      errorHandler(errorEvent);

      expect(errorSpy).toHaveBeenCalledWith(errorEvent);
    });

    it('should forward fusion manager events', async () => {
      const fusionErrorSpy = jest.fn();
      fusionQuoteGenerator.on('fusion_error', fusionErrorSpy);

      // Get the event handler that was registered  
      const errorHandler = mockFusionManager.on.mock.calls.find(call => call[0] === 'error')[1];
      
      // Simulate fusion manager error by calling the handler directly
      const fusionError = { type: 'ORDER_CREATION_FAILED', message: 'Fusion error' };
      errorHandler(fusionError);

      expect(fusionErrorSpy).toHaveBeenCalledWith(fusionError);
    });

    it('should emit fusion-specific events', async () => {
      const orderCreatedSpy = jest.fn();
      fusionQuoteGenerator.on('fusion_order_created', orderCreatedSpy);

      const quoteRequest = createQuoteRequest({
        id: 'event-test',
        sourceChain: 'ethereum',
        destinationChain: 'polygon',
        userAddress: '0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'
      });

      await fusionQuoteGenerator.generateQuote(quoteRequest, true);

      // Should emit fusion order created event
      expect(orderCreatedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.any(String),
          metaOrder: expect.any(Object),
          creationTime: expect.any(Number)
        })
      );
    });
  });

  describe('statistics and monitoring', () => {
    beforeEach(async () => {
      const adapters = new Map();
      await fusionQuoteGenerator.initialize(adapters);
    });

    it('should provide comprehensive statistics', async () => {
      const stats = fusionQuoteGenerator.getStats();

      expect(stats).toMatchObject({
        // Base generator stats
        quotesGenerated: expect.any(Number),
        averageGenerationTime: expect.any(Number),
        competitionWinRate: expect.any(Number),
        
        // Enhanced stats
        averageQuoteTime: expect.any(Number),
        
        // Fusion manager stats  
        fusionActiveOrders: expect.any(Number),
        fusionTotalOrders: expect.any(Number),
        
        // Combined metrics
        totalQuotes: expect.any(Number),
        fusionConversionRate: expect.any(Number)
      });
    });

    it('should track Fusion+ conversion rates', async () => {
      // Generate quotes with and without Fusion+ orders
      const requests = [
        createQuoteRequest({ id: 'fusion-1', sourceChain: 'ethereum', destinationChain: 'polygon' }),
        createQuoteRequest({ id: 'fusion-2', sourceChain: 'ethereum', destinationChain: 'polygon' }),
        createQuoteRequest({ id: 'no-fusion', sourceChain: 'unsupported' as any, destinationChain: 'unsupported' as any })
      ];

      await fusionQuoteGenerator.generateQuote(requests[0], true);
      await fusionQuoteGenerator.generateQuote(requests[1], true);
      await fusionQuoteGenerator.generateQuote(requests[2], false);

      const stats = fusionQuoteGenerator.getStats();
      
      // Should track conversion rate (2 fusion orders / 3 total quotes)
      expect(stats.fusionConversionRate).toBeGreaterThan(0);
      expect(stats.fusionConversionRate).toBeLessThanOrEqual(100);
    });

    it('should get active Fusion+ orders', async () => {
      const activeOrders = fusionQuoteGenerator.getActiveFusionOrders();

      expect(mockFusionManager.getActiveOrders).toHaveBeenCalled();
      expect(Array.isArray(activeOrders)).toBe(true);
    });
  });

  describe('lifecycle management', () => {
    it('should stop all components cleanly', async () => {
      const adapters = new Map();
      await fusionQuoteGenerator.initialize(adapters);

      await fusionQuoteGenerator.stop();

      expect(mockBaseGenerator.stop).toHaveBeenCalled();
      expect(mockFusionManager.stop).toHaveBeenCalled();
    });

    it('should handle stop errors gracefully', async () => {
      const adapters = new Map();
      await fusionQuoteGenerator.initialize(adapters);

      mockFusionManager.stop.mockRejectedValueOnce(new Error('Stop failed'));

      // Should not throw even if one component fails to stop
      await expect(fusionQuoteGenerator.stop()).resolves.not.toThrow();
    });
  });
});