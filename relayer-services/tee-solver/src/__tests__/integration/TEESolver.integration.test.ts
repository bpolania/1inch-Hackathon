/**
 * TEE Solver Integration Tests
 * 
 * Test the full solver flow from quote request to meta-order generation
 */

import { IntentListener } from '../../intent/IntentListener';
import { QuoteGenerator } from '../../quote/QuoteGenerator';
import { ChainId, MessageType, QuoteRequest, Quote } from '../../types/solver.types';
import { 
  createMockWebSocket,
  createMockChainAdapter,
  createQuoteRequest, 
  createSolverConfig,
  wait 
} from '../setup';

jest.mock('ws');

describe('TEE Solver Integration', () => {
  let intentListener: IntentListener;
  let quoteGenerator: QuoteGenerator;
  let config: any;
  let mockWs: any;
  let emit: any;
  let adapters: Map<any, any>;

  beforeEach(async () => {
    config = createSolverConfig();
    
    // Set up components
    intentListener = new IntentListener(config);
    quoteGenerator = new QuoteGenerator(config);
    
    // Set up WebSocket mock
    const mockSetup = createMockWebSocket();
    mockWs = mockSetup.mockWs;
    emit = mockSetup.emit;
    
    const WebSocket = require('ws');
    WebSocket.mockImplementation(() => mockWs);
    
    // Set up chain adapters
    adapters = new Map([
      [ChainId.ETHEREUM, createMockChainAdapter(ChainId.ETHEREUM)],
      [ChainId.NEAR, createMockChainAdapter(ChainId.NEAR)],
      [ChainId.COSMOS, createMockChainAdapter(ChainId.COSMOS)]
    ]);
    
    // Initialize components
    const initPromise = intentListener.initialize();
    await wait(10);
    emit('open');
    await initPromise;
    
    await quoteGenerator.initialize(adapters);
    
    // Wire up event handlers
    intentListener.on('quote_requested', async (request: QuoteRequest) => {
      try {
        const quote = await quoteGenerator.generateQuote(request);
        await intentListener.submitQuote(quote);
      } catch (error) {
        console.error('Quote generation failed:', error);
      }
    });
  });

  afterEach(async () => {
    await intentListener.stop();
    await quoteGenerator.stop();
    jest.clearAllMocks();
  });

  describe('end-to-end quote flow', () => {
    it('should receive request and submit quote', async () => {
      const quoteRequest = createQuoteRequest();
      const message = {
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-123',
        timestamp: Date.now(),
        data: quoteRequest
      };

      // Send quote request
      emit('message', JSON.stringify(message));
      
      // Wait for processing
      await wait(100);

      // Should have submitted a quote
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(MessageType.QUOTE_RESPONSE)
      );

      // Verify quote format
      const sentCalls = mockWs.send.mock.calls;
      const quoteCall = sentCalls.find(call => 
        call[0].includes(MessageType.QUOTE_RESPONSE)
      );
      
      expect(quoteCall).toBeDefined();
      
      const sentMessage = JSON.parse(quoteCall[0]);
      expect(sentMessage.type).toBe(MessageType.QUOTE_RESPONSE);
      expect(sentMessage.data).toMatchObject({
        requestId: quoteRequest.id,
        sourceAmount: quoteRequest.sourceAmount.toString(),
        route: expect.any(Array),
        confidence: expect.any(Number)
      });
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = [];
      
      // Send 5 concurrent requests
      for (let i = 0; i < 5; i++) {
        const request = createQuoteRequest({ id: `request-${i}` });
        requests.push(request);
        
        const message = {
          type: MessageType.QUOTE_REQUEST,
          id: `msg-${i}`,
          timestamp: Date.now(),
          data: request
        };
        
        emit('message', JSON.stringify(message));
      }

      // Wait for all quotes to be processed
      await wait(200);

      // Should have submitted 5 quotes
      const quoteCalls = mockWs.send.mock.calls.filter(call =>
        call[0].includes(MessageType.QUOTE_RESPONSE)
      );
      
      expect(quoteCalls).toHaveLength(5);

      // Verify each quote corresponds to a request
      const submittedRequestIds = quoteCalls.map(call => {
        const message = JSON.parse(call[0]);
        return message.data.requestId;
      });

      expect(submittedRequestIds.sort()).toEqual([
        'request-0',
        'request-1',
        'request-2',
        'request-3',
        'request-4'
      ]);
    });

    it('should generate appropriate routes for different chain pairs', async () => {
      const testCases = [
        {
          sourceChain: ChainId.ETHEREUM,
          destinationChain: ChainId.ETHEREUM,
          expectedSteps: 1 // Direct swap
        },
        {
          sourceChain: ChainId.ETHEREUM,
          destinationChain: ChainId.NEAR,
          expectedSteps: 2 // At least swap + bridge
        },
        {
          sourceChain: ChainId.ETHEREUM,
          destinationChain: ChainId.COSMOS,
          expectedSteps: 2 // At least swap + bridge
        }
      ];

      for (const testCase of testCases) {
        const request = createQuoteRequest({
          id: `test-${testCase.sourceChain}-${testCase.destinationChain}`,
          sourceChain: testCase.sourceChain,
          destinationChain: testCase.destinationChain
        });

        const message = {
          type: MessageType.QUOTE_REQUEST,
          id: `msg-${Date.now()}`,
          timestamp: Date.now(),
          data: request
        };

        emit('message', JSON.stringify(message));
        await wait(100);

        const quoteCall = mockWs.send.mock.calls.find(call =>
          call[0].includes(request.id)
        );

        expect(quoteCall).toBeDefined();
        
        const sentMessage = JSON.parse(quoteCall[0]);
        expect(sentMessage.data.route.length).toBeGreaterThanOrEqual(testCase.expectedSteps);
      }
    });
  });

  describe('error handling', () => {
    it('should handle quote generation failures gracefully', async () => {
      // Make quote generation fail
      const adapter = adapters.get(ChainId.ETHEREUM);
      adapter.getLiquiditySources.mockRejectedValue(new Error('No liquidity'));

      const request = createQuoteRequest({
        sourceChain: ChainId.ETHEREUM,
        destinationChain: ChainId.ETHEREUM
      });

      const message = {
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-fail',
        timestamp: Date.now(),
        data: request
      };

      emit('message', JSON.stringify(message));
      await wait(100);

      // Should not submit a quote for failed generation
      const quoteCalls = mockWs.send.mock.calls.filter(call =>
        call[0].includes(MessageType.QUOTE_RESPONSE) && 
        call[0].includes(request.id)
      );
      
      expect(quoteCalls).toHaveLength(0);
    });

    it('should continue processing after individual failures', async () => {
      const adapter = adapters.get(ChainId.ETHEREUM);
      
      // Make first request fail
      adapter.getLiquiditySources.mockRejectedValueOnce(new Error('Temporary error'));
      
      const request1 = createQuoteRequest({ id: 'fail-request' });
      const request2 = createQuoteRequest({ id: 'success-request' });

      // Send both requests
      emit('message', JSON.stringify({
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-1',
        timestamp: Date.now(),
        data: request1
      }));

      emit('message', JSON.stringify({
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-2',
        timestamp: Date.now(),
        data: request2
      }));

      await wait(100);

      // Should have processed the second request successfully
      const quoteCalls = mockWs.send.mock.calls.filter(call =>
        call[0].includes(MessageType.QUOTE_RESPONSE)
      );

      expect(quoteCalls).toHaveLength(1);
      expect(quoteCalls[0][0]).toContain('success-request');
    });
  });

  describe('performance', () => {
    it('should generate quotes within timeout', async () => {
      const request = createQuoteRequest();
      const message = {
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-perf',
        timestamp: Date.now(),
        data: request
      };

      const startTime = Date.now();
      emit('message', JSON.stringify(message));
      
      // Wait for quote
      await wait(100);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(config.quoteTimeoutMs);

      // Verify quote was submitted
      const quoteCalls = mockWs.send.mock.calls.filter(call =>
        call[0].includes(MessageType.QUOTE_RESPONSE)
      );
      
      expect(quoteCalls).toHaveLength(1);
    });

    it('should handle rapid successive requests', async () => {
      const requestCount = 20;
      const requests = [];

      // Send many requests rapidly
      for (let i = 0; i < requestCount; i++) {
        const request = createQuoteRequest({ id: `rapid-${i}` });
        requests.push(request);
        
        emit('message', JSON.stringify({
          type: MessageType.QUOTE_REQUEST,
          id: `msg-${i}`,
          timestamp: Date.now(),
          data: request
        }));
      }

      // Wait for processing
      await wait(500);

      // Should have processed all requests
      const quoteCalls = mockWs.send.mock.calls.filter(call =>
        call[0].includes(MessageType.QUOTE_RESPONSE)
      );

      expect(quoteCalls).toHaveLength(requestCount);
    });
  });

  describe('quote quality', () => {
    it('should generate competitive quotes', async () => {
      const request = createQuoteRequest({
        sourceAmount: BigInt('1000000000000000000'), // 1 ETH
        metadata: { urgency: 'low' }
      });

      const message = {
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-quality',
        timestamp: Date.now(),
        data: request
      };

      emit('message', JSON.stringify(message));
      await wait(100);

      const quoteCall = mockWs.send.mock.calls.find(call =>
        call[0].includes(MessageType.QUOTE_RESPONSE)
      );
      
      const sentMessage = JSON.parse(quoteCall[0]);
      const quote = sentMessage.data;

      // Verify quote quality
      expect(quote.destinationAmount).toBeDefined();
      expect(BigInt(quote.destinationAmount)).toBeGreaterThan(0n);
      
      // Solver fee should be reasonable (less than 5% for test scenarios)
      const feeRatio = Number(BigInt(quote.solverFee)) / Number(request.sourceAmount);
      expect(feeRatio).toBeLessThan(0.05);
      
      // Should have high confidence for simple swap
      if (request.sourceChain === request.destinationChain) {
        expect(quote.confidence).toBeGreaterThan(80);
      }
    });

    it('should adjust pricing based on market conditions', async () => {
      // Test different urgency levels
      const normalRequest = createQuoteRequest({
        id: 'normal',
        metadata: { urgency: 'low' }
      });

      const urgentRequest = createQuoteRequest({
        id: 'urgent',
        metadata: { urgency: 'high' }
      });

      // Send both requests
      emit('message', JSON.stringify({
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-normal',
        timestamp: Date.now(),
        data: normalRequest
      }));

      emit('message', JSON.stringify({
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-urgent',
        timestamp: Date.now(),
        data: urgentRequest
      }));

      await wait(100);

      // Find both quotes
      const normalQuoteCall = mockWs.send.mock.calls.find(call =>
        call[0].includes('normal')
      );
      const urgentQuoteCall = mockWs.send.mock.calls.find(call =>
        call[0].includes('urgent')
      );

      const normalQuote = JSON.parse(normalQuoteCall[0]).data;
      const urgentQuote = JSON.parse(urgentQuoteCall[0]).data;

      // Urgent should have higher fee
      expect(BigInt(urgentQuote.solverFee)).toBeGreaterThan(BigInt(normalQuote.solverFee));
    });
  });

  describe('monitoring and statistics', () => {
    it('should track solver performance', async () => {
      // Process several quotes
      for (let i = 0; i < 5; i++) {
        const request = createQuoteRequest({ id: `stats-${i}` });
        emit('message', JSON.stringify({
          type: MessageType.QUOTE_REQUEST,
          id: `msg-${i}`,
          timestamp: Date.now(),
          data: request
        }));
      }

      await wait(200);

      // Check statistics
      const listenerStatus = intentListener.getStatus();
      const generatorStats = quoteGenerator.getStats();

      expect(listenerStatus.quotesGenerated).toBe(5);
      expect(generatorStats.quotesGenerated).toBe(5);
      expect(generatorStats.averageGenerationTime).toBeGreaterThan(0);
    });
  });

  describe('multi-chain support', () => {
    it('should support all configured chains', async () => {
      const chains = [ChainId.ETHEREUM, ChainId.NEAR, ChainId.COSMOS];
      
      for (const sourceChain of chains) {
        for (const destChain of chains) {
          const request = createQuoteRequest({
            id: `chain-${sourceChain}-${destChain}`,
            sourceChain,
            destinationChain: destChain,
            sourceToken: {
              address: '0xA',
              symbol: 'TokenA',
              decimals: 18,
              chainId: sourceChain
            },
            destinationToken: {
              address: '0xB',
              symbol: 'TokenB',
              decimals: 18,
              chainId: destChain
            }
          });

          emit('message', JSON.stringify({
            type: MessageType.QUOTE_REQUEST,
            id: `msg-${sourceChain}-${destChain}`,
            timestamp: Date.now(),
            data: request
          }));
        }
      }

      await wait(300);

      // Should have generated quotes for all chain pairs
      const quoteCalls = mockWs.send.mock.calls.filter(call =>
        call[0].includes(MessageType.QUOTE_RESPONSE)
      );

      expect(quoteCalls).toHaveLength(9); // 3x3 chain combinations
    });
  });
});