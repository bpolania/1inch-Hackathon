/**
 * IntentListener Tests
 * 
 * Test WebSocket communication, quote request handling, and resilience
 */

import { IntentListener } from '../../intent/IntentListener';
import { MessageType, QuoteRequest, SolverEventType } from '../../types/solver.types';
import { 
  createMockWebSocket, 
  createQuoteRequest, 
  createSolverConfig, 
  wait 
} from '../setup';

jest.mock('ws');

describe('IntentListener', () => {
  let intentListener: IntentListener;
  let config: any;
  let mockWs: any;
  let emit: any;

  beforeEach(() => {
    config = createSolverConfig();
    intentListener = new IntentListener(config);
    
    const mockSetup = createMockWebSocket();
    mockWs = mockSetup.mockWs;
    emit = mockSetup.emit;
    
    // Mock WebSocket constructor
    const WebSocket = require('ws');
    WebSocket.mockImplementation(() => mockWs);
  });

  afterEach(async () => {
    await intentListener.stop();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should connect to WebSocket relay successfully', async () => {
      const initPromise = intentListener.initialize();
      
      // Simulate connection
      await wait(10);
      emit('open');
      
      await initPromise;
      
      expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should send solver registration on connection', async () => {
      const initPromise = intentListener.initialize();
      
      await wait(10);
      emit('open');
      
      await initPromise;
      
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('solver_registration')
      );
      
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.data.solverId).toBe(config.solverId);
      expect(sentData.data.supportedChains).toEqual(config.supportedChains);
    });

    it('should handle connection timeout', async () => {
      // Don't emit 'open' event - connection should timeout
      const initPromise = intentListener.initialize();
      
      // Wait longer than the test would normally wait
      await expect(initPromise).rejects.toThrow('WebSocket connection timeout');
    }, 15000); // Increase test timeout to 15 seconds
  });

  describe('quote request handling', () => {
    beforeEach(async () => {
      const initPromise = intentListener.initialize();
      await wait(10);
      emit('open');
      await initPromise;
    });

    it('should emit quote_requested event for valid requests', async () => {
      const quoteRequest = createQuoteRequest();
      const message = {
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-123',
        timestamp: Date.now(),
        data: quoteRequest
      };

      let emittedRequest: QuoteRequest | null = null;
      intentListener.on('quote_requested', (request) => {
        emittedRequest = request;
      });

      emit('message', JSON.stringify(message));
      await wait(10);

      expect(emittedRequest).toEqual(quoteRequest);
    });

    it('should ignore requests for unsupported chains', async () => {
      const quoteRequest = createQuoteRequest({
        sourceChain: 'unsupported-chain'
      });
      const message = {
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-123',
        timestamp: Date.now(),
        data: quoteRequest
      };

      let emittedRequest: QuoteRequest | null = null;
      intentListener.on('quote_requested', (request) => {
        emittedRequest = request;
      });

      emit('message', JSON.stringify(message));
      await wait(10);

      expect(emittedRequest).toBeNull();
    });

    it('should validate quote requests', async () => {
      const invalidRequests = [
        createQuoteRequest({ id: '' }), // Missing ID
        createQuoteRequest({ sourceAmount: 0n }), // Zero amount
        createQuoteRequest({ deadline: Date.now() / 1000 - 100 }), // Past deadline
        createQuoteRequest({ userAddress: '' }), // Missing user address
      ];

      let emittedCount = 0;
      intentListener.on('quote_requested', () => {
        emittedCount++;
      });

      for (const request of invalidRequests) {
        const message = {
          type: MessageType.QUOTE_REQUEST,
          id: 'msg-' + Math.random(),
          timestamp: Date.now(),
          data: request
        };
        emit('message', JSON.stringify(message));
      }

      await wait(10);
      expect(emittedCount).toBe(0);
    });
  });

  describe('quote submission', () => {
    beforeEach(async () => {
      const initPromise = intentListener.initialize();
      await wait(10);
      emit('open');
      await initPromise;
    });

    it('should submit quotes back to relay', async () => {
      const quote = {
        requestId: 'test-123',
        solverId: config.solverId,
        timestamp: Date.now(),
        sourceAmount: BigInt('1000000000000000000'),
        destinationAmount: BigInt('2000000000000000000'),
        estimatedGasCost: BigInt('100000000000000'),
        solverFee: BigInt('10000000000000'),
        route: [],
        estimatedExecutionTime: 60,
        validUntil: Date.now() + 300000,
        confidence: 95
      };

      await intentListener.submitQuote(quote);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(MessageType.QUOTE_RESPONSE)
      );

      const sentData = JSON.parse(mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1][0]);
      expect(sentData.type).toBe(MessageType.QUOTE_RESPONSE);
      expect(sentData.data).toEqual(expect.objectContaining({
        requestId: quote.requestId,
        destinationAmount: quote.destinationAmount.toString()
      }));
    });

    it('should throw error if not connected', async () => {
      await intentListener.stop();

      const quote = {
        requestId: 'test-123',
        solverId: config.solverId,
        timestamp: Date.now(),
        sourceAmount: BigInt('1000000000000000000'),
        destinationAmount: BigInt('2000000000000000000'),
        estimatedGasCost: BigInt('100000000000000'),
        solverFee: BigInt('10000000000000'),
        route: [],
        estimatedExecutionTime: 60,
        validUntil: Date.now() + 300000,
        confidence: 95
      };

      await expect(intentListener.submitQuote(quote)).rejects.toThrow('Not connected to relay');
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      const initPromise = intentListener.initialize();
      await wait(10);
      emit('open');
      await initPromise;
    });

    it('should handle order created notifications', async () => {
      const orderData = {
        orderHash: '0xabcd',
        requestId: 'test-123',
        maker: '0xuser'
      };

      let emittedData: any = null;
      intentListener.on('order_created', (data) => {
        emittedData = data;
      });

      const message = {
        type: MessageType.ORDER_CREATED,
        id: 'msg-123',
        timestamp: Date.now(),
        data: orderData
      };

      emit('message', JSON.stringify(message));
      await wait(10);

      expect(emittedData).toEqual(orderData);
    });

    it('should handle heartbeat messages', async () => {
      const message = {
        type: MessageType.HEARTBEAT,
        id: 'msg-123',
        timestamp: Date.now(),
        data: {}
      };

      emit('message', JSON.stringify(message));
      await wait(10);

      const status = intentListener.getStatus();
      expect(status.lastHeartbeat).toBeGreaterThan(0);
    });

    it('should emit solver events', async () => {
      const events: any[] = [];
      intentListener.on('solver_event', (event) => {
        events.push(event);
      });

      const quoteRequest = createQuoteRequest();
      const message = {
        type: MessageType.QUOTE_REQUEST,
        id: 'msg-123',
        timestamp: Date.now(),
        data: quoteRequest
      };

      emit('message', JSON.stringify(message));
      await wait(10);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(SolverEventType.QUOTE_REQUESTED);
    });
  });

  describe('connection resilience', () => {
    beforeEach(async () => {
      const initPromise = intentListener.initialize();
      await wait(10);
      emit('open');
      await initPromise;
    });

    it('should handle disconnection events', async () => {
      let connectionLostEmitted = false;
      intentListener.on('connection_lost', () => {
        connectionLostEmitted = true;
      });

      emit('close', 1000, 'Normal closure');
      await wait(10);

      expect(connectionLostEmitted).toBe(true);
    });

    it('should track reconnection attempts', async () => {
      // Access private property to check reconnection attempts
      const getReconnectAttempts = () => (intentListener as any).reconnectAttempts;
      
      const initialAttempts = getReconnectAttempts();
      
      emit('close', 1000, 'Normal closure');
      await wait(10);
      
      expect(getReconnectAttempts()).toBeGreaterThan(initialAttempts);
    });

    it('should emit error for max reconnection attempts', async () => {
      let maxAttemptsErrorEmitted = false;
      intentListener.on('error', (error) => {
        if (error.message && error.message.includes('Max reconnection attempts')) {
          maxAttemptsErrorEmitted = true;
        }
      });

      // Manually set reconnection attempts to max
      (intentListener as any).reconnectAttempts = 10;
      
      emit('close', 1000, 'Connection lost');
      await wait(10);

      expect(maxAttemptsErrorEmitted).toBe(true);
    });
  });

  describe('message queue processing', () => {
    beforeEach(async () => {
      const initPromise = intentListener.initialize();
      await wait(10);
      emit('open');
      await initPromise;
    });

    it('should process messages in order', async () => {
      const processedIds: string[] = [];
      intentListener.on('quote_requested', (request) => {
        processedIds.push(request.id);
      });

      // Send multiple messages rapidly
      for (let i = 0; i < 5; i++) {
        const message = {
          type: MessageType.QUOTE_REQUEST,
          id: `msg-${i}`,
          timestamp: Date.now(),
          data: createQuoteRequest({ id: `request-${i}` })
        };
        emit('message', JSON.stringify(message));
      }

      await wait(50);

      expect(processedIds).toEqual([
        'request-0',
        'request-1',
        'request-2',
        'request-3',
        'request-4'
      ]);
    });

    it('should handle invalid message formats gracefully', async () => {
      let errorEmitted = false;
      intentListener.on('error', () => {
        errorEmitted = true;
      });

      // Send invalid JSON
      emit('message', 'invalid json');
      
      // Send message without type
      emit('message', JSON.stringify({ id: 'test' }));
      
      await wait(10);

      expect(errorEmitted).toBe(true);
    });
  });

  describe('status reporting', () => {
    it('should provide accurate status information', async () => {
      const initPromise = intentListener.initialize();
      await wait(10);
      emit('open');
      await initPromise;

      // Send some quote requests
      for (let i = 0; i < 3; i++) {
        const message = {
          type: MessageType.QUOTE_REQUEST,
          id: `msg-${i}`,
          timestamp: Date.now(),
          data: createQuoteRequest()
        };
        emit('message', JSON.stringify(message));
      }

      await wait(10);

      const status = intentListener.getStatus();
      expect(status.isConnected).toBe(true);
      expect(status.quotesGenerated).toBe(0); // Haven't submitted any
      expect(status.supportedChains).toEqual(config.supportedChains);
    });

    it('should calculate success rate', async () => {
      const initPromise = intentListener.initialize();
      await wait(10);
      emit('open');
      await initPromise;

      // Receive 5 requests (wait for processing)
      for (let i = 0; i < 5; i++) {
        const message = {
          type: MessageType.QUOTE_REQUEST,
          id: `msg-${i}`,
          timestamp: Date.now(),
          data: createQuoteRequest()
        };
        emit('message', JSON.stringify(message));
        await wait(5); // Allow message processing
      }

      // Submit 3 quotes
      for (let i = 0; i < 3; i++) {
        await intentListener.submitQuote({
          requestId: `test-${i}`,
          solverId: config.solverId,
          timestamp: Date.now(),
          sourceAmount: BigInt('1000000000000000000'),
          destinationAmount: BigInt('2000000000000000000'),
          estimatedGasCost: BigInt('100000000000000'),
          solverFee: BigInt('10000000000000'),
          route: [],
          estimatedExecutionTime: 60,
          validUntil: Date.now() + 300000,
          confidence: 95
        });
      }

      const status = intentListener.getStatus();
      expect(status.successRate).toBe(60); // 3/5 = 60%
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on stop', async () => {
      const initPromise = intentListener.initialize();
      await wait(10);
      emit('open');
      await initPromise;

      await intentListener.stop();

      expect(mockWs.close).toHaveBeenCalled();
      
      const status = intentListener.getStatus();
      expect(status.isConnected).toBe(false);
    });
  });
});