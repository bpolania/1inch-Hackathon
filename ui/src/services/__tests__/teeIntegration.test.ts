/**
 * Tests for TEE Solver Integration Service
 */

import { TEESolverIntegrationService, SwapDecision, SwapExecution, TEEStatus } from '../teeIntegration';
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

describe('TEESolverIntegrationService', () => {
  let service: TEESolverIntegrationService;
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
    service = new TEESolverIntegrationService('http://localhost:3002');
    jest.clearAllMocks();
  });

  describe('checkTEEHealth', () => {
    it('should return healthy status when TEE is running', async () => {
      const mockStatus: TEEStatus = {
        isRunning: true,
        isHealthy: true,
        attestationValid: true,
        chainSignaturesEnabled: true,
        supportedChains: ['ethereum', 'near', 'bitcoin'],
        lastHeartbeat: Date.now(),
        statistics: {
          totalSwaps: 100,
          successfulSwaps: 95,
          totalProfit: '5.25',
          averageExecutionTime: 30000,
          uptime: 3600000
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      const result = await service.checkTEEHealth();

      expect(result.healthy).toBe(true);
      expect(result.status).toEqual(mockStatus);
      expect(result.status?.attestationValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3002/status');
    });

    it('should return unhealthy status when TEE is down', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.checkTEEHealth();

      expect(result.healthy).toBe(false);
      expect(result.status).toBeUndefined();
    });
  });

  describe('submitToTEESolver', () => {
    it('should submit intent and return decision with execution', async () => {
      const mockResponse = {
        solverRequestId: 'solver-req-123',
        decision: {
          shouldExecute: true,
          expectedProfit: '0.015',
          riskScore: 0.25,
          executionStrategy: 'immediate',
          reason: 'Profitable with low risk'
        },
        execution: {
          success: false,
          transactionHashes: [],
          executionTime: 0
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.submitToTEESolver(mockIntent);

      expect(result.solverRequestId).toBe('solver-req-123');
      expect(result.decision.shouldExecute).toBe(true);
      expect(result.execution).toBeDefined();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/submit',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"intentId":"intent-123"')
        })
      );
    });

    it('should handle submission errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable'
      });

      await expect(service.submitToTEESolver(mockIntent)).rejects.toThrow('TEE submission failed: Service Unavailable');
    });
  });

  describe('analyzeIntent', () => {
    it('should return autonomous analysis decision', async () => {
      const mockDecision: SwapDecision = {
        shouldExecute: true,
        expectedProfit: '0.02',
        riskScore: 0.15,
        executionStrategy: 'immediate',
        reason: 'High profit opportunity with minimal risk',
        profitAnalysis: {
          estimatedProfit: 0.02,
          costAnalysis: {
            gasCosts: 0.005,
            bridgeFees: 0.001,
            slippageImpact: 0.002
          },
          marketConditions: {
            volatility: 0.05,
            liquidity: 0.95,
            spreads: 0.001
          }
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDecision
      });

      const result = await service.analyzeIntent(mockIntent);

      expect(result).toEqual(mockDecision);
      expect(result.profitAnalysis).toBeDefined();
      expect(result.profitAnalysis?.marketConditions.liquidity).toBe(0.95);
    });

    it('should return safe default on analysis failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('TEE unavailable'));

      const result = await service.analyzeIntent(mockIntent);

      expect(result.shouldExecute).toBe(false);
      expect(result.expectedProfit).toBe('0');
      expect(result.riskScore).toBe(1.0);
      expect(result.executionStrategy).toBe('reject');
      expect(result.reason).toBe('TEE analysis service unavailable');
    });
  });

  describe('getExecutionStatus', () => {
    it('should return execution status', async () => {
      const mockExecution: SwapExecution = {
        success: true,
        transactionHashes: ['0xtx1', '0xtx2'],
        executionTime: 25000,
        actualProfit: '0.018',
        steps: [
          {
            step: 1,
            description: 'Analyzing market conditions',
            status: 'completed',
            timestamp: Date.now()
          },
          {
            step: 2,
            description: 'Executing atomic swap',
            status: 'completed',
            transactionHash: '0xtx1',
            timestamp: Date.now()
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockExecution
      });

      const result = await service.getExecutionStatus('solver-req-123');

      expect(result).toEqual(mockExecution);
      expect(result?.steps).toHaveLength(2);
      expect(result?.success).toBe(true);
    });

    it('should return null if execution not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      const result = await service.getExecutionStatus('solver-req-999');

      expect(result).toBeNull();
    });
  });

  describe('startTEEMonitoring', () => {
    it('should start event source monitoring for execution updates', () => {
      const callback = jest.fn();
      let eventSourceInstance: MockEventSource;
      
      // Capture the EventSource instance when it's created
      const originalEventSource = (global as any).EventSource;
      (global as any).EventSource = jest.fn().mockImplementation((url: string) => {
        eventSourceInstance = new MockEventSource(url);
        return eventSourceInstance;
      });

      const cleanup = service.startTEEMonitoring('solver-req-123', callback);

      // Trigger an execution update
      const update: SwapExecution = {
        success: false,
        transactionHashes: ['0xtx1'],
        executionTime: 0,
        steps: [
          {
            step: 1,
            description: 'Processing',
            status: 'processing',
            timestamp: Date.now()
          }
        ]
      };

      eventSourceInstance!.triggerMessage(update);

      expect(callback).toHaveBeenCalledWith(update);

      // Test cleanup
      cleanup();
      expect(eventSourceInstance!.close).toHaveBeenCalled();

      // Restore original EventSource
      (global as any).EventSource = originalEventSource;
    });
  });

  describe('getTEEAttestation', () => {
    it('should return valid attestation information', async () => {
      const mockAttestation = {
        valid: true,
        codeHash: '0xabcdef123456...',
        measurements: {
          mrenclave: '0x123...',
          mrsigner: '0x456...',
          isvprodid: 1,
          isvsvn: 1
        },
        timestamp: Date.now()
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAttestation
      });

      const result = await service.getTEEAttestation();

      expect(result).toEqual(mockAttestation);
      expect(result?.valid).toBe(true);
      expect(result?.codeHash).toBeDefined();
    });

    it('should return null on attestation fetch failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      const result = await service.getTEEAttestation();

      expect(result).toBeNull();
    });
  });

  describe('getSupportedRoutes', () => {
    it('should return supported swap routes', async () => {
      const mockRoutes = [
        {
          fromChain: 'ethereum',
          toChain: 'near',
          enabled: true,
          estimatedTime: 5,
          supportedTokens: ['ETH', 'USDC', 'USDT']
        },
        {
          fromChain: 'bitcoin',
          toChain: 'ethereum',
          enabled: true,
          estimatedTime: 30,
          supportedTokens: ['BTC']
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoutes
      });

      const result = await service.getSupportedRoutes();

      expect(result).toHaveLength(2);
      expect(result[0].fromChain).toBe('ethereum');
      expect(result[0].supportedTokens).toContain('USDC');
    });

    it('should return empty array on failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getSupportedRoutes();

      expect(result).toEqual([]);
    });
  });

  describe('requestImmediateExecution', () => {
    it('should request immediate execution for pending analysis', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const result = await service.requestImmediateExecution('solver-req-123');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/execution/solver-req-123',
        { method: 'POST' }
      );
    });
  });

  describe('cancelTEERequest', () => {
    it('should cancel a pending TEE request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const result = await service.cancelTEERequest('solver-req-123');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/execution/solver-req-123',
        { method: 'DELETE' }
      );
    });
  });

  describe('convertIntentToSwapIntent', () => {
    it('should correctly convert UI intent to TEE swap intent format', () => {
      // Access the private method through a workaround for testing
      const serviceAny = service as any;
      const swapIntent = serviceAny.convertIntentToSwapIntent(mockIntent);

      expect(swapIntent.fromChain).toBe('ethereum');
      expect(swapIntent.toChain).toBe('near');
      expect(swapIntent.fromAmount).toBe('1000000000000000000');
      expect(swapIntent.toAmount).toBe('1000000000');
      expect(swapIntent.fromToken).toBe('0x123');
      expect(swapIntent.toToken).toBe('0x456');
      expect(swapIntent.userAddress).toBe('0xuser');
      expect(swapIntent.maxSlippage).toBe(1); // 100 basis points = 1%
      expect(swapIntent.deadline).toBe(mockIntent.deadline);
    });
  });
});