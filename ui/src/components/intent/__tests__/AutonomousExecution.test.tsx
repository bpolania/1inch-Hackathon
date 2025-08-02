/**
 * Tests for AutonomousExecution Component
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AutonomousExecution } from '../AutonomousExecution';
import { useTEESolverIntegration } from '@/services/teeIntegration';
import { IntentRequest } from '@/types/intent';

// Mock the TEE integration hook
jest.mock('@/services/teeIntegration', () => ({
  useTEESolverIntegration: jest.fn()
}));

describe('AutonomousExecution', () => {
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

  const mockDecision = {
    shouldExecute: true,
    expectedProfit: '0.025',
    riskScore: 0.15,
    executionStrategy: 'immediate' as const,
    reason: 'High profit opportunity with minimal risk',
    profitAnalysis: {
      estimatedProfit: 0.025,
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

  const mockExecution = {
    success: false,
    transactionHashes: [],
    executionTime: 0,
    steps: [
      {
        step: 1,
        description: 'Analyzing market conditions',
        status: 'completed' as const,
        timestamp: Date.now()
      },
      {
        step: 2,
        description: 'Executing atomic swap',
        status: 'processing' as const,
        timestamp: Date.now()
      }
    ]
  };

  const mockAttestation = {
    valid: true,
    codeHash: '0xabcdef123456',
    timestamp: Date.now()
  };

  const mockTEEService = {
    submitToTEE: jest.fn(),
    analyzeIntent: jest.fn(),
    getExecutionStatus: jest.fn(),
    startMonitoring: jest.fn(),
    requestExecution: jest.fn(),
    cancelRequest: jest.fn(),
    getSupportedRoutes: jest.fn(),
    isHealthy: true,
    status: null,
    attestation: mockAttestation
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTEESolverIntegration as jest.Mock).mockReturnValue(mockTEEService);
    mockTEEService.analyzeIntent.mockResolvedValue(mockDecision);
  });

  describe('TEE Health Check', () => {
    it('should show warning when TEE is unavailable', () => {
      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        isHealthy: false
      });

      render(<AutonomousExecution intent={mockIntent} />);

      expect(screen.getByText('TEE Solver Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/The autonomous TEE solver is currently offline/)).toBeInTheDocument();
    });
  });

  describe('Autonomous Analysis', () => {
    it('should automatically analyze intent when TEE is healthy', async () => {
      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(mockTEEService.analyzeIntent).toHaveBeenCalledWith(mockIntent);
      });
    });

    it('should display analysis results', async () => {
      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('Autonomous Analysis')).toBeInTheDocument();
        expect(screen.getByText('TEE-verified intelligent decision making')).toBeInTheDocument();
        expect(screen.getByText('Execution Recommended')).toBeInTheDocument();
        expect(screen.getByText('High profit opportunity with minimal risk')).toBeInTheDocument();
        expect(screen.getByText('0.025000 ETH')).toBeInTheDocument();
      });
    });

    it('should show TEE verification status', async () => {
      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('TEE Verified')).toBeInTheDocument();
      });
    });

    it('should show unverified TEE status', async () => {
      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        attestation: { ...mockAttestation, valid: false }
      });

      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('Unverified')).toBeInTheDocument();
      });
    });

    it('should display analysis details', async () => {
      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('15.0%')).toBeInTheDocument(); // Risk Score
        expect(screen.getByText('IMMEDIATE')).toBeInTheDocument(); // Strategy
        expect(screen.getByText('GO')).toBeInTheDocument(); // Decision
      });
    });

    it('should show detailed cost analysis', async () => {
      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('Detailed Analysis')).toBeInTheDocument();
        expect(screen.getByText('Cost Breakdown')).toBeInTheDocument();
        expect(screen.getByText('0.005000 ETH')).toBeInTheDocument(); // Gas Costs
        expect(screen.getByText('0.001000 ETH')).toBeInTheDocument(); // Bridge Fees
        expect(screen.getByText('0.20%')).toBeInTheDocument(); // Slippage Impact
      });
    });

    it('should show market conditions', async () => {
      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('Market Conditions')).toBeInTheDocument();
        expect(screen.getByText('5.0%')).toBeInTheDocument(); // Volatility
        expect(screen.getByText('95%')).toBeInTheDocument(); // Liquidity
        expect(screen.getByText('0.10%')).toBeInTheDocument(); // Spreads
      });
    });

    it('should handle analysis loading state', () => {
      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        analyzeIntent: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(mockDecision), 100))
        )
      });

      render(<AutonomousExecution intent={mockIntent} />);

      expect(screen.getByText('Analyzing Intent')).toBeInTheDocument();
      expect(screen.getByText('TEE solver is evaluating profitability and risk...')).toBeInTheDocument();
    });

    it('should show rejection decision', async () => {
      const rejectionDecision = {
        ...mockDecision,
        shouldExecute: false,
        executionStrategy: 'reject' as const,
        reason: 'High risk detected'
      };
      mockTEEService.analyzeIntent.mockResolvedValueOnce(rejectionDecision);

      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('Execution Not Recommended')).toBeInTheDocument();
        expect(screen.getByText('High risk detected')).toBeInTheDocument();
        expect(screen.getByText('STOP')).toBeInTheDocument();
      });
    });
  });

  describe('TEE Submission', () => {
    it('should enable submission for recommended executions', async () => {
      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit for Autonomous Execution');
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should disable submission for rejected executions', async () => {
      const rejectionDecision = {
        ...mockDecision,
        shouldExecute: false
      };
      mockTEEService.analyzeIntent.mockResolvedValueOnce(rejectionDecision);

      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.queryByText('Submit for Autonomous Execution')).not.toBeInTheDocument();
      });
    });

    it('should submit to TEE solver', async () => {
      const mockSubmissionResult = {
        solverRequestId: 'solver-req-123',
        decision: mockDecision,
        execution: mockExecution
      };
      mockTEEService.submitToTEE.mockResolvedValueOnce(mockSubmissionResult);

      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit for Autonomous Execution');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockTEEService.submitToTEE).toHaveBeenCalledWith(mockIntent);
        expect(screen.getByText('Autonomous Execution')).toBeInTheDocument();
      });
    });

    it('should show submission error', async () => {
      mockTEEService.submitToTEE.mockRejectedValueOnce(new Error('TEE unavailable'));

      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit for Autonomous Execution');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('TEE unavailable')).toBeInTheDocument();
      });
    });
  });

  describe('Execution Monitoring', () => {
    beforeEach(async () => {
      const mockSubmissionResult = {
        solverRequestId: 'solver-req-123',
        decision: mockDecision,
        execution: mockExecution
      };
      mockTEEService.submitToTEE.mockResolvedValueOnce(mockSubmissionResult);

      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit for Autonomous Execution');
        fireEvent.click(submitButton);
      });
    });

    it('should display execution steps', async () => {
      await waitFor(() => {
        expect(screen.getByText('Execution Steps:')).toBeInTheDocument();
        expect(screen.getByText('Analyzing market conditions')).toBeInTheDocument();
        expect(screen.getByText('Executing atomic swap')).toBeInTheDocument();
      });
    });

    it('should show step status indicators', async () => {
      await waitFor(() => {
        const stepElements = screen.getAllByText(/^[0-9]+$/);
        expect(stepElements).toHaveLength(2);
        
        // First step should be completed (green)
        expect(stepElements[0]).toHaveClass('bg-green-500');
        
        // Second step should be processing (blue with animation)
        expect(stepElements[1]).toHaveClass('bg-blue-500');
        expect(stepElements[1]).toHaveClass('animate-pulse');
      });
    });

    it('should start monitoring execution updates', async () => {
      await waitFor(() => {
        expect(mockTEEService.startMonitoring).toHaveBeenCalledWith(
          'solver-req-123',
          expect.any(Function)
        );
      });
    });

    it('should show successful execution result', async () => {
      const successfulExecution = {
        ...mockExecution,
        success: true,
        actualProfit: '0.022'
      };

      render(<AutonomousExecution intent={mockIntent} />);

      // Mock the submission to return successful execution
      const mockSubmissionResult = {
        solverRequestId: 'solver-req-123',
        decision: mockDecision,
        execution: successfulExecution
      };
      mockTEEService.submitToTEE.mockResolvedValueOnce(mockSubmissionResult);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit for Autonomous Execution');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Autonomous Execution Successful')).toBeInTheDocument();
        expect(screen.getByText('Actual Profit: 0.022000 ETH')).toBeInTheDocument();
      });
    });

    it('should show execution failure', async () => {
      const failedExecution = {
        ...mockExecution,
        success: false,
        error: 'Insufficient liquidity on target chain'
      };

      render(<AutonomousExecution intent={mockIntent} />);

      const mockSubmissionResult = {
        solverRequestId: 'solver-req-123',
        decision: mockDecision,
        execution: failedExecution
      };
      mockTEEService.submitToTEE.mockResolvedValueOnce(mockSubmissionResult);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit for Autonomous Execution');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Execution Failed')).toBeInTheDocument();
        expect(screen.getByText('Insufficient liquidity on target chain')).toBeInTheDocument();
      });
    });
  });

  describe('Execution Actions', () => {
    beforeEach(async () => {
      const mockSubmissionResult = {
        solverRequestId: 'solver-req-123',
        decision: mockDecision,
        execution: mockExecution
      };
      mockTEEService.submitToTEE.mockResolvedValueOnce(mockSubmissionResult);

      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit for Autonomous Execution');
        fireEvent.click(submitButton);
      });
    });

    it('should allow prioritizing execution', async () => {
      mockTEEService.requestExecution.mockResolvedValueOnce(true);

      await waitFor(() => {
        const prioritizeButton = screen.getByText('Prioritize Execution');
        fireEvent.click(prioritizeButton);
      });

      await waitFor(() => {
        expect(mockTEEService.requestExecution).toHaveBeenCalledWith('solver-req-123');
      });
    });

    it('should allow cancelling execution', async () => {
      mockTEEService.cancelRequest.mockResolvedValueOnce(true);

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(mockTEEService.cancelRequest).toHaveBeenCalledWith('solver-req-123');
      });
    });
  });

  describe('Re-analysis', () => {
    it('should allow re-analyzing intent', async () => {
      render(<AutonomousExecution intent={mockIntent} />);

      await waitFor(() => {
        expect(screen.getByText('Re-analyze')).toBeInTheDocument();
      });

      const reanalyzeButton = screen.getByText('Re-analyze');
      fireEvent.click(reanalyzeButton);

      await waitFor(() => {
        expect(mockTEEService.analyzeIntent).toHaveBeenCalledTimes(2);
      });
    });

    it('should show manual analyze button when auto-analysis fails', async () => {
      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        isHealthy: false
      });

      render(<AutonomousExecution intent={mockIntent} />);

      // Since TEE is unhealthy, analysis shouldn't run automatically
      expect(screen.queryByText('Analyzing Intent')).not.toBeInTheDocument();
    });
  });

  describe('Risk Score Display', () => {
    it('should color-code risk scores appropriately', async () => {
      const testCases = [
        { score: 0.2, expectedClass: 'text-green-600' },
        { score: 0.5, expectedClass: 'text-yellow-600' },
        { score: 0.8, expectedClass: 'text-red-600' }
      ];

      for (const testCase of testCases) {
        const decision = {
          ...mockDecision,
          riskScore: testCase.score
        };
        mockTEEService.analyzeIntent.mockResolvedValueOnce(decision);

        const { container } = render(<AutonomousExecution intent={mockIntent} />);

        await waitFor(() => {
          const riskElement = screen.getByText(`${(testCase.score * 100).toFixed(1)}%`);
          expect(riskElement).toHaveClass(testCase.expectedClass);
        });

        container.remove();
      }
    });
  });

  describe('Component Lifecycle', () => {
    it('should call onExecutionComplete when execution finishes', async () => {
      const onComplete = jest.fn();
      const completedExecution = {
        ...mockExecution,
        success: true,
        actualProfit: '0.022'
      };

      const mockSubmissionResult = {
        solverRequestId: 'solver-req-123',
        decision: mockDecision,
        execution: mockExecution
      };
      mockTEEService.submitToTEE.mockResolvedValueOnce(mockSubmissionResult);

      render(<AutonomousExecution intent={mockIntent} onExecutionComplete={onComplete} />);

      await waitFor(() => {
        const submitButton = screen.getByText('Submit for Autonomous Execution');
        fireEvent.click(submitButton);
      });

      // Wait for startMonitoring to be called after submission and state update
      await waitFor(() => {
        expect(mockTEEService.startMonitoring).toHaveBeenCalled();
      });

      // Simulate monitoring callback
      const monitoringCallback = mockTEEService.startMonitoring.mock.calls[0][1];
      monitoringCallback(completedExecution);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(completedExecution);
      });
    });
  });
});