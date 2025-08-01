/**
 * TEE Solver Integration Service
 * Connects the UI with the autonomous TEE solver for intent processing
 */

import { IntentRequest } from '@/types/intent';

// TEE Solver service configuration
const TEE_SOLVER_BASE_URL = process.env.NEXT_PUBLIC_TEE_SOLVER_URL || 'http://localhost:3002';

export interface SwapIntent {
  fromChain: 'bitcoin' | 'near' | 'ethereum';
  toChain: 'bitcoin' | 'near' | 'ethereum';
  fromAmount: string;
  toAmount: string;
  fromToken?: string;
  toToken?: string;
  userAddress: string;
  maxSlippage: number;
  deadline: number;
}

export interface SwapDecision {
  shouldExecute: boolean;
  expectedProfit: string;
  riskScore: number;
  executionStrategy: 'immediate' | 'delayed' | 'reject';
  reason: string;
  profitAnalysis?: {
    estimatedProfit: number;
    costAnalysis: {
      gasCosts: number;
      bridgeFees: number;
      slippageImpact: number;
    };
    marketConditions: {
      volatility: number;
      liquidity: number;
      spreads: number;
    };
  };
}

export interface SwapExecution {
  success: boolean;
  transactionHashes: string[];
  executionTime: number;
  actualProfit?: string;
  error?: string;
  steps?: ExecutionStep[];
}

export interface ExecutionStep {
  step: number;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactionHash?: string;
  timestamp: number;
  details?: any;
}

export interface TEEStatus {
  isRunning: boolean;
  isHealthy: boolean;
  attestationValid: boolean;
  chainSignaturesEnabled: boolean;
  supportedChains: string[];
  lastHeartbeat: number;
  statistics: {
    totalSwaps: number;
    successfulSwaps: number;
    totalProfit: string;
    averageExecutionTime: number;
    uptime: number;
  };
}

/**
 * Main TEE Solver Integration Service
 */
export class TEESolverIntegrationService {
  private baseUrl: string;

  constructor(baseUrl: string = TEE_SOLVER_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if TEE solver is running and healthy
   */
  async checkTEEHealth(): Promise<{ healthy: boolean; status?: TEEStatus }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/status`);
      if (!response.ok) {
        return { healthy: false };
      }

      const status = await response.json();
      return { healthy: true, status };
    } catch (error) {
      console.error('TEE health check failed:', error);
      return { healthy: false };
    }
  }

  /**
   * Convert UI intent to TEE solver format
   */
  private convertIntentToSwapIntent(intent: IntentRequest): SwapIntent {
    return {
      fromChain: 'ethereum', // Default to Ethereum for now
      toChain: 'near',
      fromAmount: intent.fromAmount,
      toAmount: intent.minToAmount || '0',
      fromToken: intent.fromToken?.address,
      toToken: intent.toToken?.address,
      userAddress: intent.user,
      maxSlippage: intent.maxSlippage / 100, // Convert from basis points to decimal
      deadline: intent.deadline
    };
  }

  /**
   * Submit intent to TEE solver for autonomous processing
   */
  async submitToTEESolver(intent: IntentRequest): Promise<{
    solverRequestId: string;
    decision: SwapDecision;
    execution?: SwapExecution;
  }> {
    try {
      const swapIntent = this.convertIntentToSwapIntent(intent);
      
      const response = await fetch(`${this.baseUrl}/api/intents/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: intent.id,
          swapIntent,
          timestamp: Date.now(),
          source: 'ui'
        })
      });

      if (!response.ok) {
        throw new Error(`TEE submission failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('TEE solver submission failed:', error);
      throw error;
    }
  }

  /**
   * Get autonomous analysis for an intent without executing
   */
  async analyzeIntent(intent: IntentRequest): Promise<SwapDecision> {
    try {
      const swapIntent = this.convertIntentToSwapIntent(intent);
      
      const response = await fetch(`${this.baseUrl}/api/analysis/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapIntent })
      });

      if (!response.ok) {
        throw new Error(`TEE analysis failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('TEE analysis failed:', error);
      
      // Return safe default analysis
      return {
        shouldExecute: false,
        expectedProfit: '0',
        riskScore: 1.0,
        executionStrategy: 'reject',
        reason: 'TEE analysis service unavailable'
      };
    }
  }

  /**
   * Get execution status for a TEE solver request
   */
  async getExecutionStatus(solverRequestId: string): Promise<SwapExecution | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/executions/${solverRequestId}`);
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get TEE execution status:', error);
      return null;
    }
  }

  /**
   * Start real-time monitoring for TEE execution updates
   */
  startTEEMonitoring(solverRequestId: string, callback: (update: SwapExecution) => void): () => void {
    const eventSource = new EventSource(`${this.baseUrl}/api/executions/${solverRequestId}/events`);
    
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        callback(update);
      } catch (error) {
        console.error('Failed to parse TEE execution update:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('TEE monitoring connection error:', error);
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  /**
   * Get TEE attestation information
   */
  async getTEEAttestation(): Promise<{
    valid: boolean;
    codeHash: string;
    measurements: any;
    timestamp: number;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tee/attestation`);
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get TEE attestation:', error);
      return null;
    }
  }

  /**
   * Get available swap routes supported by TEE solver
   */
  async getSupportedRoutes(): Promise<Array<{
    fromChain: string;
    toChain: string;
    enabled: boolean;
    estimatedTime: number;
    supportedTokens: string[];
  }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/routes/supported`);
      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get supported routes:', error);
      return [];
    }
  }

  /**
   * Request immediate execution of a pending analysis
   */
  async requestImmediateExecution(solverRequestId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/executions/${solverRequestId}/execute`, {
        method: 'POST'
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to request immediate execution:', error);
      return false;
    }
  }

  /**
   * Cancel a pending TEE solver request
   */
  async cancelTEERequest(solverRequestId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/intents/${solverRequestId}/cancel`, {
        method: 'POST'
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to cancel TEE request:', error);
      return false;
    }
  }
}

/**
 * React Hook for TEE Solver Integration
 */
export function useTEESolverIntegration() {
  const [service] = useState(() => new TEESolverIntegrationService());
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [status, setStatus] = useState<TEEStatus | null>(null);
  const [attestation, setAttestation] = useState<any>(null);

  // Check TEE health and attestation on mount
  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      const health = await service.checkTEEHealth();
      if (mounted) {
        setIsHealthy(health.healthy);
        setStatus(health.status || null);
      }
    };

    const checkAttestation = async () => {
      const attestationData = await service.getTEEAttestation();
      if (mounted) {
        setAttestation(attestationData);
      }
    };

    checkHealth();
    checkAttestation();
    
    // Check health every 30 seconds
    const healthInterval = setInterval(checkHealth, 30000);
    // Check attestation every 5 minutes
    const attestationInterval = setInterval(checkAttestation, 300000);

    return () => {
      mounted = false;
      clearInterval(healthInterval);
      clearInterval(attestationInterval);
    };
  }, [service]);

  const submitToTEE = async (intent: IntentRequest) => {
    return await service.submitToTEESolver(intent);
  };

  const analyzeIntent = async (intent: IntentRequest) => {
    return await service.analyzeIntent(intent);
  };

  const getExecutionStatus = async (solverRequestId: string) => {
    return await service.getExecutionStatus(solverRequestId);
  };

  const startMonitoring = (solverRequestId: string, callback: (update: SwapExecution) => void) => {
    return service.startTEEMonitoring(solverRequestId, callback);
  };

  const getSupportedRoutes = async () => {
    return await service.getSupportedRoutes();
  };

  const requestExecution = async (solverRequestId: string) => {
    return await service.requestImmediateExecution(solverRequestId);
  };

  const cancelRequest = async (solverRequestId: string) => {
    return await service.cancelTEERequest(solverRequestId);
  };

  return {
    isHealthy,
    status,
    attestation,
    submitToTEE,
    analyzeIntent,
    getExecutionStatus,
    startMonitoring,
    getSupportedRoutes,
    requestExecution,
    cancelRequest
  };
}

// React imports (needed for the hook)
import { useState, useEffect } from 'react';

// Create default service instance
export const teeSolverIntegrationService = new TEESolverIntegrationService();