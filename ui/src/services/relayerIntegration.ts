/**
 * Relayer Integration Service
 * Connects the UI with the automated executor-client relayer service
 * 
 * Updated to use real backend API Gateway with production relayer integration
 */

import { IntentRequest } from '@/types/intent';

// API Gateway configuration - now connects to real backend
const API_GATEWAY_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3001';
const RELAYER_API_BASE_URL = `${API_GATEWAY_BASE_URL}/api/relayer`;

export interface RelayerStatus {
  isRunning: boolean;
  queueLength: number;
  walletStatus: {
    ethereum: {
      connected: boolean;
      address: string;
      balance: string;
    };
    near: {
      connected: boolean;
      accountId: string;
      balance: string;
    };
  };
  monitorStatus: {
    connected: boolean;
    lastEvent: number;
    eventsProcessed: number;
  };
}

export interface OrderSubmission {
  intentId: string;
  orderHash?: string;
  status: 'pending' | 'submitted' | 'processing' | 'completed' | 'failed';
  transactionHash?: string;
  executionResult?: {
    success: boolean;
    actualProfit?: string;
    gasUsed?: string;
    error?: string;
  };
  timestamp: number;
}

export interface ProfitabilityAnalysis {
  isProfitable: boolean;
  estimatedProfit: string;
  gasEstimate: string;
  safetyDeposit: string;
  marginPercent: number;
  riskFactors: string[];
  recommendation: 'execute' | 'skip' | 'wait';
}

/**
 * Main Relayer Integration Service
 */
export class RelayerIntegrationService {
  private baseUrl: string;
  private submissions = new Map<string, OrderSubmission>();

  constructor(baseUrl: string = RELAYER_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if relayer service is running and healthy
   */
  async checkRelayerHealth(): Promise<{ healthy: boolean; status?: RelayerStatus }> {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      if (!response.ok) {
        return { healthy: false };
      }

      const result = await response.json();
      
      // Transform API Gateway response to expected format
      const status: RelayerStatus = {
        isRunning: result.status?.isRunning || false,
        queueLength: result.status?.queueLength || 0,
        walletStatus: {
          ethereum: {
            connected: true,
            address: result.status?.ethereumAddress || '',
            balance: result.status?.ethereumBalance || '0'
          },
          near: {
            connected: true,
            accountId: result.status?.nearAccountId || '',
            balance: result.status?.nearBalance || '0'
          }
        },
        monitorStatus: {
          connected: result.isHealthy || false,
          lastEvent: Date.now(),
          eventsProcessed: result.status?.totalProcessed || 0
        }
      };

      return { healthy: result.isHealthy, status };
    } catch (error) {
      console.error('Relayer health check failed:', error);
      return { healthy: false };
    }
  }

  /**
   * Submit intent to relayer for automated execution
   */
  async submitIntent(intent: IntentRequest): Promise<OrderSubmission> {
    try {
      // Submit intent to real relayer service via API Gateway
      const response = await fetch(`${this.baseUrl}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent })
      });

      if (!response.ok) {
        throw new Error(`Relayer submission failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      const submission: OrderSubmission = {
        intentId: intent.id,
        orderHash: result.data?.orderHash,
        status: 'submitted',
        timestamp: Date.now()
      };

      // Store submission for tracking
      this.submissions.set(intent.id, submission);

      return submission;
    } catch (error) {
      const submission: OrderSubmission = {
        intentId: intent.id,
        status: 'failed',
        timestamp: Date.now()
      };

      this.submissions.set(intent.id, submission);
      
      console.error('Intent submission failed:', error);
      throw error;
    }
  }

  /**
   * Get profitability analysis for an intent
   */
  async analyzeProfitability(intent: IntentRequest): Promise<ProfitabilityAnalysis> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent })
      });

      if (!response.ok) {
        throw new Error(`Profitability analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (error) {
      console.error('Profitability analysis failed:', error);
      
      // Return conservative analysis on failure
      return {
        isProfitable: false,
        estimatedProfit: '0',
        gasEstimate: '0',
        safetyDeposit: '0',
        marginPercent: 0,
        riskFactors: ['Analysis service unavailable'],
        recommendation: 'wait'
      };
    }
  }

  /**
   * Get execution status for an intent
   */
  async getExecutionStatus(intentId: string): Promise<OrderSubmission | null> {
    // Check local cache first
    const cached = this.submissions.get(intentId);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/orders/${intentId}/status`);
      if (!response.ok) {
        return null;
      }

      const submission = await response.json();
      this.submissions.set(intentId, submission);
      return submission;
    } catch (error) {
      console.error('Failed to get execution status:', error);
      return null;
    }
  }

  /**
   * Start real-time monitoring for intent updates
   */
  startMonitoring(intentId: string, callback: (update: OrderSubmission) => void): () => void {
    const eventSource = new EventSource(`${this.baseUrl}/api/orders/${intentId}/events`);
    
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        this.submissions.set(intentId, update);
        callback(update);
      } catch (error) {
        console.error('Failed to parse intent update:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Intent monitoring connection error:', error);
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  /**
   * Get relayer statistics and metrics
   */
  async getRelayerMetrics(): Promise<{
    totalOrders: number;
    successfulExecutions: number;
    totalProfitGenerated: string;
    averageExecutionTime: number;
    queueLength: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/metrics`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get relayer metrics:', error);
      return {
        totalOrders: 0,
        successfulExecutions: 0,
        totalProfitGenerated: '0',
        averageExecutionTime: 0,
        queueLength: 0
      };
    }
  }

  /**
   * Request immediate execution of a pending order
   */
  async requestImmediateExecution(intentId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/orders/${intentId}/execute`, {
        method: 'POST'
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to request immediate execution:', error);
      return false;
    }
  }

  /**
   * Cancel a pending order
   */
  async cancelOrder(intentId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/orders/${intentId}/cancel`, {
        method: 'POST'
      });

      if (response.ok) {
        const submission = this.submissions.get(intentId);
        if (submission) {
          submission.status = 'failed';
          this.submissions.set(intentId, submission);
        }
      }

      return response.ok;
    } catch (error) {
      console.error('Failed to cancel order:', error);
      return false;
    }
  }
}

/**
 * React Hook for Relayer Integration
 */
export function useRelayerIntegration() {
  const [service] = useState(() => new RelayerIntegrationService());
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [status, setStatus] = useState<RelayerStatus | null>(null);

  // Check relayer health on mount
  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      const health = await service.checkRelayerHealth();
      if (mounted) {
        setIsHealthy(health.healthy);
        setStatus(health.status || null);
      }
    };

    checkHealth();
    
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [service]);

  const submitIntent = async (intent: IntentRequest) => {
    return await service.submitIntent(intent);
  };

  const analyzeProfitability = async (intent: IntentRequest) => {
    return await service.analyzeProfitability(intent);
  };

  const getExecutionStatus = async (intentId: string) => {
    return await service.getExecutionStatus(intentId);
  };

  const startMonitoring = (intentId: string, callback: (update: OrderSubmission) => void) => {
    return service.startMonitoring(intentId, callback);
  };

  const getMetrics = async () => {
    return await service.getRelayerMetrics();
  };

  const requestExecution = async (intentId: string) => {
    return await service.requestImmediateExecution(intentId);
  };

  const cancelOrder = async (intentId: string) => {
    return await service.cancelOrder(intentId);
  };

  return {
    isHealthy,
    status,
    submitIntent,
    analyzeProfitability,
    getExecutionStatus,
    startMonitoring,
    getMetrics,
    requestExecution,
    cancelOrder
  };
}

// React imports (needed for the hook)
import { useState, useEffect } from 'react';

// Create default service instance
export const relayerIntegrationService = new RelayerIntegrationService();