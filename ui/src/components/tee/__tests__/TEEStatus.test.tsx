/**
 * Tests for TEEStatus Component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TEEStatus, TEEHealthIndicator } from '../TEEStatus';
import { useTEESolverIntegration } from '@/services/teeIntegration';

// Mock the TEE integration hook
jest.mock('@/services/teeIntegration', () => ({
  useTEESolverIntegration: jest.fn()
}));

describe('TEEStatus', () => {
  const mockStatus = {
    isRunning: true,
    isHealthy: true,
    attestationValid: true,
    chainSignaturesEnabled: true,
    supportedChains: ['ethereum', 'near', 'bitcoin'],
    lastHeartbeat: Date.now(),
    statistics: {
      totalSwaps: 150,
      successfulSwaps: 145,
      totalProfit: '3.25',
      averageExecutionTime: 25000,
      uptime: 7200000 // 2 hours
    }
  };

  const mockAttestation = {
    valid: true,
    codeHash: '0xabcdef1234567890abcdef1234567890',
    measurements: {
      mrenclave: '0x123456',
      mrsigner: '0x789abc',
      isvprodid: 1,
      isvsvn: 1
    },
    timestamp: Date.now()
  };

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
    },
    {
      fromChain: 'near',
      toChain: 'bitcoin',
      enabled: false,
      estimatedTime: 45,
      supportedTokens: ['NEAR']
    }
  ];

  const mockGetSupportedRoutes = jest.fn();
  const mockTEEService = {
    isHealthy: true,
    status: mockStatus,
    attestation: mockAttestation,
    submitToTEE: jest.fn(),
    analyzeIntent: jest.fn(),
    getExecutionStatus: jest.fn(),
    startMonitoring: jest.fn(),
    getSupportedRoutes: mockGetSupportedRoutes,
    requestExecution: jest.fn(),
    cancelRequest: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTEESolverIntegration as jest.Mock).mockReturnValue(mockTEEService);
  });

  describe('Full Display Mode', () => {
    it('should render main TEE status when healthy', () => {
      render(<TEEStatus />);

      expect(screen.getByText('TEE Autonomous Solver')).toBeInTheDocument();
      expect(screen.getByText('Autonomous intent processing active')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render TEE features status', () => {
      render(<TEEStatus />);

      // TEE Attestation
      expect(screen.getByText('TEE Attestation')).toBeInTheDocument();
      expect(screen.getByText('Valid')).toBeInTheDocument();

      // Chain Signatures
      expect(screen.getByText('Chain Signatures')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    it('should display supported chains', () => {
      render(<TEEStatus />);

      expect(screen.getByText('Supported Chains')).toBeInTheDocument();
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Near')).toBeInTheDocument();
      expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    });

    it('should display TEE attestation details', () => {
      render(<TEEStatus />);

      expect(screen.getByText('TEE Attestation Details')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('Code Hash')).toBeInTheDocument();
      expect(screen.getByText(/0xabcdef123456\.\.\./, { exact: false })).toBeInTheDocument();
    });

    it('should display attestation measurements', () => {
      render(<TEEStatus />);

      expect(screen.getByText('TEE Measurements')).toBeInTheDocument();
      expect(screen.getByText('mrenclave:')).toBeInTheDocument();
      expect(screen.getByText('mrsigner:')).toBeInTheDocument();
    });

    it('should display autonomous performance statistics', () => {
      render(<TEEStatus />);

      expect(screen.getByText('Autonomous Performance')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Total Swaps
      expect(screen.getByText('145')).toBeInTheDocument(); // Successful
      expect(screen.getByText('3.2500')).toBeInTheDocument(); // Total Profit
      expect(screen.getByText('25s')).toBeInTheDocument(); // Avg. Time
      expect(screen.getByText('2h')).toBeInTheDocument(); // Uptime
    });

    it('should fetch and display supported routes', async () => {
      mockGetSupportedRoutes.mockResolvedValueOnce(mockRoutes);

      render(<TEEStatus />);

      await waitFor(() => {
        expect(mockGetSupportedRoutes).toHaveBeenCalled();
      });

      expect(screen.getByText('Supported Swap Routes')).toBeInTheDocument();
      expect(screen.getByText('Ethereum → Near')).toBeInTheDocument();
      expect(screen.getByText('Bitcoin → Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Near → Bitcoin')).toBeInTheDocument();
      expect(screen.getByText('~5min')).toBeInTheDocument();
      expect(screen.getByText('~30min')).toBeInTheDocument();
    });

    it('should show offline warning', () => {
      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        isHealthy: false,
        status: null
      });

      render(<TEEStatus />);

      expect(screen.getByText('TEE Solver Offline')).toBeInTheDocument();
      expect(screen.getByText(/The autonomous TEE solver is currently unavailable/)).toBeInTheDocument();
    });

    it('should show invalid attestation warning', () => {
      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        attestation: { ...mockAttestation, valid: false }
      });

      render(<TEEStatus />);

      expect(screen.getByText('TEE Attestation Invalid')).toBeInTheDocument();
      expect(screen.getByText(/The TEE attestation could not be verified/)).toBeInTheDocument();
    });

    it('should handle disabled features', () => {
      const disabledStatus = {
        ...mockStatus,
        attestationValid: false,
        chainSignaturesEnabled: false
      };

      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        status: disabledStatus
      });

      render(<TEEStatus />);

      expect(screen.getByText('Invalid')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });

  describe('Compact Display Mode', () => {
    it('should render compact status when healthy', () => {
      render(<TEEStatus compact />);

      expect(screen.getByText('TEE: Active')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('should render compact offline state', () => {
      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        isHealthy: false,
        status: null
      });

      render(<TEEStatus compact />);

      expect(screen.getByText('TEE: Offline')).toBeInTheDocument();
    });

    it('should render compact unverified state', () => {
      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        attestation: { ...mockAttestation, valid: false }
      });

      render(<TEEStatus compact />);

      expect(screen.getByText('Unverified')).toBeInTheDocument();
    });

    it('should render compact loading state', () => {
      (useTEESolverIntegration as jest.Mock).mockReturnValue({
        ...mockTEEService,
        isHealthy: null,
        status: null
      });

      render(<TEEStatus compact />);

      expect(screen.getByText('TEE: Checking...')).toBeInTheDocument();
    });
  });

  describe('Route Display', () => {
    it('should show enabled routes with green indicator', async () => {
      mockGetSupportedRoutes.mockResolvedValueOnce(mockRoutes);

      render(<TEEStatus />);

      await waitFor(() => {
        const enabledRoutes = screen.getAllByText(/Ethereum → Near|Bitcoin → Ethereum/);
        enabledRoutes.forEach(route => {
          const indicator = route.previousElementSibling;
          expect(indicator).toHaveClass('bg-green-500');
        });
      });
    });

    it('should show disabled routes with gray indicator', async () => {
      mockGetSupportedRoutes.mockResolvedValueOnce(mockRoutes);

      render(<TEEStatus />);

      await waitFor(() => {
        const disabledRoute = screen.getByText('Near → Bitcoin');
        const indicator = disabledRoute.previousElementSibling;
        expect(indicator).toHaveClass('bg-gray-400');
      });
    });
  });
});

describe('TEEHealthIndicator', () => {
  const mockTEEService = {
    isHealthy: true,
    status: null,
    attestation: { valid: true },
    submitToTEE: jest.fn(),
    analyzeIntent: jest.fn(),
    getExecutionStatus: jest.fn(),
    startMonitoring: jest.fn(),
    getSupportedRoutes: jest.fn(),
    requestExecution: jest.fn(),
    cancelRequest: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTEESolverIntegration as jest.Mock).mockReturnValue(mockTEEService);
  });

  it('should render health indicator when verified', () => {
    render(<TEEHealthIndicator />);

    expect(screen.getByText('TEE verified')).toBeInTheDocument();
    
    // Check for green indicator
    const indicator = screen.getByText('TEE verified').previousElementSibling?.previousElementSibling;
    expect(indicator).toHaveClass('bg-green-500');
  });

  it('should render health indicator when offline', () => {
    (useTEESolverIntegration as jest.Mock).mockReturnValue({
      ...mockTEEService,
      isHealthy: false
    });

    render(<TEEHealthIndicator />);

    expect(screen.getByText('TEE offline')).toBeInTheDocument();
    
    // Check for red indicator
    const indicator = screen.getByText('TEE offline').previousElementSibling?.previousElementSibling;
    expect(indicator).toHaveClass('bg-red-500');
  });

  it('should render health indicator when checking', () => {
    (useTEESolverIntegration as jest.Mock).mockReturnValue({
      ...mockTEEService,
      isHealthy: null
    });

    render(<TEEHealthIndicator />);

    expect(screen.getByText('TEE checking')).toBeInTheDocument();
    
    // Check for gray pulsing indicator
    const indicator = screen.getByText('TEE checking').previousElementSibling?.previousElementSibling;
    expect(indicator).toHaveClass('bg-gray-400');
    expect(indicator).toHaveClass('animate-pulse');
  });

  it('should show attestation validity indicator', () => {
    render(<TEEHealthIndicator />);

    // Should have an additional green dot for valid attestation
    const elements = screen.getByText('TEE verified').parentElement?.querySelectorAll('.bg-green-400');
    expect(elements?.length).toBeGreaterThan(0);
  });

  it('should show invalid attestation indicator', () => {
    (useTEESolverIntegration as jest.Mock).mockReturnValue({
      ...mockTEEService,
      attestation: { valid: false }
    });

    render(<TEEHealthIndicator />);

    // Should have a red dot for invalid attestation
    const elements = screen.getByText('TEE verified').parentElement?.querySelectorAll('.bg-red-400');
    expect(elements?.length).toBeGreaterThan(0);
  });
});