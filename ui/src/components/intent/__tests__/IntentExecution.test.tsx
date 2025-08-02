/**
 * Tests for IntentExecution Component
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { IntentExecution } from '../IntentExecution';
import { useRelayerIntegration } from '@/services/relayerIntegration';
import { IntentRequest } from '@/types/intent';

// Mock the relayer integration hook
jest.mock('@/services/relayerIntegration', () => ({
  useRelayerIntegration: jest.fn()
}));

describe('IntentExecution', () => {
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

  const mockProfitabilityAnalysis = {
    isProfitable: true,
    estimatedProfit: '0.015',
    gasEstimate: '0.001',
    safetyDeposit: '0.0001',
    marginPercent: 15,
    riskFactors: ['Low liquidity'],
    recommendation: 'execute' as const
  };

  const mockSubmission = {
    intentId: 'intent-123',
    orderHash: '0xorder123',
    status: 'submitted' as const,
    timestamp: Date.now()
  };

  const mockExecutionComplete = jest.fn();
  const mockRelayerService = {
    submitIntent: jest.fn(),
    analyzeProfitability: jest.fn(),
    getExecutionStatus: jest.fn(),
    startMonitoring: jest.fn(),
    requestExecution: jest.fn(),
    cancelOrder: jest.fn(),
    isHealthy: true,
    status: null,
    getMetrics: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRelayerIntegration as jest.Mock).mockReturnValue(mockRelayerService);
    mockRelayerService.analyzeProfitability.mockResolvedValue(mockProfitabilityAnalysis);
  });

  describe('Profitability Analysis', () => {
    it('should automatically analyze profitability on mount', async () => {
      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(mockRelayerService.analyzeProfitability).toHaveBeenCalledWith(mockIntent);
      });

      // Wait for the profitability analysis to render
      await waitFor(() => {
        expect(screen.getByText('Profitability Analysis')).toBeInTheDocument();
      });

      expect(screen.getByText('0.015000 ETH')).toBeInTheDocument();
      expect(screen.getByText('15.00%')).toBeInTheDocument();
      expect(screen.getByText('EXECUTE')).toBeInTheDocument();
    });

    it('should display risk factors when present', async () => {
      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('Risk Factors')).toBeInTheDocument();
        expect(screen.getByText('• Low liquidity')).toBeInTheDocument();
      });
    });

    it('should show not profitable analysis', async () => {
      const unprofitableAnalysis = {
        ...mockProfitabilityAnalysis,
        isProfitable: false,
        recommendation: 'skip' as const,
        marginPercent: -5
      };
      mockRelayerService.analyzeProfitability.mockResolvedValueOnce(unprofitableAnalysis);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('SKIP')).toBeInTheDocument();
      });
    });
  });

  describe('Intent Submission', () => {
    it('should enable submit button when profitable', async () => {
      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should disable submit button when not profitable', async () => {
      const unprofitableAnalysis = {
        ...mockProfitabilityAnalysis,
        isProfitable: false
      };
      mockRelayerService.analyzeProfitability.mockResolvedValueOnce(unprofitableAnalysis);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        expect(submitButton).toBeDisabled();
      });
    });

    it('should submit intent when button clicked', async () => {
      mockRelayerService.submitIntent.mockResolvedValueOnce(mockSubmission);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('Submit to Relayer')).toBeInTheDocument();
      });

      const submitButton = screen.getByText('Submit to Relayer');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRelayerService.submitIntent).toHaveBeenCalledWith(mockIntent);
        expect(screen.getByText('Submitted')).toBeInTheDocument();
      });
    });

    it('should show error on submission failure', async () => {
      mockRelayerService.submitIntent.mockRejectedValueOnce(new Error('Submission failed'));

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Submission failed')).toBeInTheDocument();
      });
    });
  });

  describe('Execution Status Tracking', () => {
    it('should display execution progress steps', async () => {
      mockRelayerService.submitIntent.mockResolvedValueOnce(mockSubmission);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Execution Status')).toBeInTheDocument();
        expect(screen.getByText('Submitted to relayer')).toBeInTheDocument();
        expect(screen.getByText('Submitted')).toBeInTheDocument();
        expect(screen.getByText('Processing')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });

    it('should display order hash', async () => {
      mockRelayerService.submitIntent.mockResolvedValueOnce(mockSubmission);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Order Hash:')).toBeInTheDocument();
        expect(screen.getByText(/0xorder123\.\.\./, { exact: false })).toBeInTheDocument();
      });
    });

    it('should monitor execution updates', async () => {
      const mockCleanup = jest.fn();
      mockRelayerService.startMonitoring.mockReturnValue(mockCleanup);
      mockRelayerService.submitIntent.mockResolvedValueOnce(mockSubmission);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockRelayerService.startMonitoring).toHaveBeenCalledWith(
          'intent-123',
          expect.any(Function)
        );
      });
    });

    it('should show execution result on completion', async () => {
      const completedSubmission = {
        ...mockSubmission,
        status: 'completed' as const,
        transactionHash: '0xtx123',
        executionResult: {
          success: true,
          actualProfit: '0.014',
          gasUsed: '150000'
        }
      };

      mockRelayerService.submitIntent.mockResolvedValueOnce(completedSubmission);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Execution Result')).toBeInTheDocument();
        expect(screen.getByText('Success')).toBeInTheDocument();
        expect(screen.getByText('Actual Profit: 0.014000 ETH')).toBeInTheDocument();
        expect(screen.getByText('Gas Used: 150,000')).toBeInTheDocument();
      });
    });

    it('should show execution failure', async () => {
      const failedSubmission = {
        ...mockSubmission,
        status: 'failed' as const,
        executionResult: {
          success: false,
          error: 'Insufficient liquidity'
        }
      };

      mockRelayerService.submitIntent.mockResolvedValueOnce(failedSubmission);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('Error: Insufficient liquidity')).toBeInTheDocument();
      });
    });
  });

  describe('Execution Actions', () => {
    it('should allow requesting immediate execution', async () => {
      mockRelayerService.submitIntent.mockResolvedValueOnce(mockSubmission);
      mockRelayerService.requestExecution.mockResolvedValueOnce(true);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        const executeButton = screen.getByText('Request Immediate Execution');
        expect(executeButton).toBeInTheDocument();
        fireEvent.click(executeButton);
      });

      await waitFor(() => {
        expect(mockRelayerService.requestExecution).toHaveBeenCalledWith('intent-123');
      });
    });

    it('should allow cancelling order', async () => {
      mockRelayerService.submitIntent.mockResolvedValueOnce(mockSubmission);
      mockRelayerService.cancelOrder.mockResolvedValueOnce(true);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        expect(cancelButton).toBeInTheDocument();
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(mockRelayerService.cancelOrder).toHaveBeenCalledWith('intent-123');
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during submission', async () => {
      mockRelayerService.submitIntent.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockSubmission), 100))
      );

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      expect(screen.getByText('Submitting...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Callback Handling', () => {
    it('should call onExecutionComplete when execution completes', async () => {
      const onComplete = jest.fn();
      const completedSubmission = {
        ...mockSubmission,
        status: 'completed' as const,
        executionResult: {
          success: true,
          actualProfit: '0.014'
        }
      };

      mockRelayerService.submitIntent.mockResolvedValueOnce(mockSubmission);
      
      const { rerender } = render(
        <IntentExecution 
          intent={mockIntent} 
          onExecutionComplete={onComplete}
        />
      );

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      // Wait for startMonitoring to be called after submission and state update
      await waitFor(() => {
        expect(mockRelayerService.startMonitoring).toHaveBeenCalled();
      });

      // Simulate monitoring update
      const monitoringCallback = mockRelayerService.startMonitoring.mock.calls[0][1];
      monitoringCallback(completedSubmission);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(completedSubmission);
      });
    });
  });

  describe('Transaction Display', () => {
    it('should display transaction hash when available', async () => {
      const submissionWithTx = {
        ...mockSubmission,
        transactionHash: '0xtx123456789'
      };

      mockRelayerService.submitIntent.mockResolvedValueOnce(submissionWithTx);

      render(<IntentExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit to Relayer');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Transaction:')).toBeInTheDocument();
        expect(screen.getByText(/0xtx123456\.\.\./, { exact: false })).toBeInTheDocument();
      });
    });
  });
});