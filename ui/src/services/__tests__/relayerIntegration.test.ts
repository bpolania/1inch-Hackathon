/**
 * Tests for Relayer Integration Service
 */

import { RelayerIntegrationService, OrderSubmission, ProfitabilityAnalysis } from '../relayerIntegration';
import { IntentRequest } from '@/types/intent';

// Mock fetch globally
global.fetch = jest.fn();

// Mock EventSource
class MockEventSource {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  close = jest.fn();

  constructor(public url: string) {}

  triggerMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  triggerError(error: any) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

(global as any).EventSource = MockEventSource;

describe('RelayerIntegrationService', () => {
  let service: RelayerIntegrationService;
  const mockIntent: IntentRequest = {
    id: 'intent-123',
    user: '0xuser',
    fromToken: {
      chainId: 1,
      address: '0x123',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      logoURI: ''
    },
    toToken: {
      chainId: 1,
      address: '0x456',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: ''
    },
    fromAmount: '1000000000000000000',
    minToAmount: '1000000000',
    maxSlippage: 100,
    deadline: Math.floor(Date.now() / 1000) + 300,
    status: 'pending',
    createdAt: Date.now(),
    prioritize: 'speed'
  };

  beforeEach(() => {
    service = new RelayerIntegrationService('http://localhost:3001');
    jest.clearAllMocks();
  });

  describe('checkRelayerHealth', () => {
    it('should return healthy status when service is running', async () => {
      const mockStatus = {
        isRunning: true,
        queueLength: 2,
        walletStatus: {
          ethereum: { connected: true, address: '0x123', balance: '1.5' },
          near: { connected: true, accountId: 'test.near', balance: '100' }
        },
        monitorStatus: {
          connected: true,
          lastEvent: Date.now(),
          eventsProcessed: 42
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      const result = await service.checkRelayerHealth();

      expect(result.healthy).toBe(true);
      expect(result.status).toEqual(mockStatus);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/status');
    });

    it('should return unhealthy status when service is down', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.checkRelayerHealth();

      expect(result.healthy).toBe(false);
      expect(result.status).toBeUndefined();
    });
  });

  describe('submitIntent', () => {
    it('should submit intent and return order submission', async () => {
      const mockResponse = {
        orderHash: '0xorder123',
        status: 'submitted'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.submitIntent(mockIntent);

      expect(result.intentId).toBe('intent-123');
      expect(result.orderHash).toBe('0xorder123');
      expect(result.status).toBe('submitted');
      expect(result.timestamp).toBeDefined();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/orders/submit',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"intent":{') // The actual body structure
        })
      );
    });

    it('should handle submission failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      });

      await expect(service.submitIntent(mockIntent)).rejects.toThrow('Relayer submission failed: Bad Request');
    });
  });

  describe('analyzeProfitability', () => {
    it('should return profitability analysis', async () => {
      const mockAnalysis: ProfitabilityAnalysis = {
        isProfitable: true,
        estimatedProfit: '0.01',
        gasEstimate: '0.001',
        safetyDeposit: '0.0001',
        marginPercent: 10,
        riskFactors: ['Low liquidity'],
        recommendation: 'execute'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalysis
      });

      const result = await service.analyzeProfitability(mockIntent);

      expect(result).toEqual(mockAnalysis);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/analysis/profitability',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should return conservative analysis on failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.analyzeProfitability(mockIntent);

      expect(result.isProfitable).toBe(false);
      expect(result.recommendation).toBe('wait');
      expect(result.riskFactors).toContain('Analysis service unavailable');
    });
  });

  describe('getExecutionStatus', () => {
    it('should return execution status from cache', async () => {
      // First submit an intent to populate cache
      const mockSubmission = {
        orderHash: '0xorder123',
        status: 'submitted'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubmission
      });

      await service.submitIntent(mockIntent);

      // Get status from cache
      const status = await service.getExecutionStatus('intent-123');

      expect(status).toBeDefined();
      expect(status?.intentId).toBe('intent-123');
      expect(status?.status).toBe('submitted');
    });

    it('should fetch status from API if not in cache', async () => {
      const mockStatus: OrderSubmission = {
        intentId: 'intent-456',
        orderHash: '0xorder456',
        status: 'processing',
        timestamp: Date.now()
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      const result = await service.getExecutionStatus('intent-456');

      expect(result).toEqual(mockStatus);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/orders/intent-456/status');
    });

    it('should return null if status not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      const result = await service.getExecutionStatus('intent-999');

      expect(result).toBeNull();
    });
  });

  describe('startMonitoring', () => {
    it('should start event source monitoring and handle updates', () => {
      const callback = jest.fn();
      let eventSourceInstance: MockEventSource;
      
      // Capture the EventSource instance when it's created
      const originalEventSource = (global as any).EventSource;
      (global as any).EventSource = jest.fn().mockImplementation((url: string) => {
        eventSourceInstance = new MockEventSource(url);
        return eventSourceInstance;
      });

      const cleanup = service.startMonitoring('intent-123', callback);

      // Trigger a message
      const update: OrderSubmission = {
        intentId: 'intent-123',
        orderHash: '0xorder123',
        status: 'processing',
        timestamp: Date.now()
      };

      eventSourceInstance!.triggerMessage(update);

      expect(callback).toHaveBeenCalledWith(update);

      // Test cleanup
      cleanup();
      expect(eventSourceInstance!.close).toHaveBeenCalled();

      // Restore original EventSource
      (global as any).EventSource = originalEventSource;
    });

    it('should handle parsing errors gracefully', () => {
      const callback = jest.fn();
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      let eventSourceInstance: MockEventSource;
      
      // Capture the EventSource instance when it's created
      const originalEventSource = (global as any).EventSource;
      (global as any).EventSource = jest.fn().mockImplementation((url: string) => {
        eventSourceInstance = new MockEventSource(url);
        return eventSourceInstance;
      });
      
      service.startMonitoring('intent-123', callback);

      // Trigger invalid JSON
      if (eventSourceInstance!.onmessage) {
        eventSourceInstance!.onmessage({ data: 'invalid json' });
      }

      expect(callback).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith('Failed to parse intent update:', expect.any(Error));

      // Restore
      consoleError.mockRestore();
      (global as any).EventSource = originalEventSource;
    });
  });

  describe('getRelayerMetrics', () => {
    it('should return relayer metrics', async () => {
      const mockMetrics = {
        totalOrders: 100,
        successfulExecutions: 95,
        totalProfitGenerated: '1.5',
        averageExecutionTime: 45000,
        queueLength: 3
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics
      });

      const result = await service.getRelayerMetrics();

      expect(result).toEqual(mockMetrics);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/metrics');
    });

    it('should return default metrics on failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getRelayerMetrics();

      expect(result.totalOrders).toBe(0);
      expect(result.successfulExecutions).toBe(0);
      expect(result.totalProfitGenerated).toBe('0');
    });
  });

  describe('requestImmediateExecution', () => {
    it('should request immediate execution', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const result = await service.requestImmediateExecution('intent-123');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/orders/intent-123/execute',
        { method: 'POST' }
      );
    });

    it('should return false on failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      const result = await service.requestImmediateExecution('intent-123');

      expect(result).toBe(false);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order and update cache', async () => {
      // First submit an intent
      const mockSubmission = {
        orderHash: '0xorder123',
        status: 'submitted'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubmission
      });

      await service.submitIntent(mockIntent);

      // Now cancel it
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const result = await service.cancelOrder('intent-123');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/orders/intent-123/cancel',
        { method: 'POST' }
      );

      // Check that cache was updated
      const status = await service.getExecutionStatus('intent-123');
      expect(status?.status).toBe('failed');
    });

    it('should return false on cancellation failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.cancelOrder('intent-123');

      expect(result).toBe(false);
    });
  });
});