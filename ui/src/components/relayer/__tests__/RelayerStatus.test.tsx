/**
 * Tests for RelayerStatus Component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { RelayerStatus, RelayerHealthIndicator } from '../RelayerStatus';
import { useRelayerIntegration } from '@/services/relayerIntegration';

// Mock the relayer integration hook
jest.mock('@/services/relayerIntegration', () => ({
  useRelayerIntegration: jest.fn()
}));

describe('RelayerStatus', () => {
  const mockStatus = {
    isRunning: true,
    queueLength: 3,
    walletStatus: {
      ethereum: {
        connected: true,
        address: '0x1234567890123456789012345678901234567890',
        balance: '1.5'
      },
      near: {
        connected: true,
        accountId: 'test.near',
        balance: '100.5'
      }
    },
    monitorStatus: {
      connected: true,
      lastEvent: Date.now(),
      eventsProcessed: 42
    }
  };

  const mockMetrics = {
    totalOrders: 100,
    successfulExecutions: 95,
    totalProfitGenerated: '2.5',
    averageExecutionTime: 45000,
    queueLength: 3
  };

  const mockGetMetrics = jest.fn();
  const mockRelayerService = {
    isHealthy: true,
    status: mockStatus,
    submitIntent: jest.fn(),
    analyzeProfitability: jest.fn(),
    getExecutionStatus: jest.fn(),
    startMonitoring: jest.fn(),
    getMetrics: mockGetMetrics,
    requestExecution: jest.fn(),
    cancelOrder: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRelayerIntegration as jest.Mock).mockReturnValue(mockRelayerService);
  });

  describe('Full Display Mode', () => {
    it('should render main status card when healthy', () => {
      render(<RelayerStatus />);

      expect(screen.getByText('Automated Relayer Service')).toBeInTheDocument();
      expect(screen.getByText('Monitoring and executing intents')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('should render offline state', () => {
      (useRelayerIntegration as jest.Mock).mockReturnValue({
        ...mockRelayerService,
        isHealthy: false,
        status: null
      });

      render(<RelayerStatus />);

      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByText('Relayer Service Offline')).toBeInTheDocument();
    });

    it('should render loading state', () => {
      (useRelayerIntegration as jest.Mock).mockReturnValue({
        ...mockRelayerService,
        isHealthy: null,
        status: null
      });

      render(<RelayerStatus />);

      expect(screen.getByText('Checking connection...')).toBeInTheDocument();
      expect(screen.getByText('Connecting')).toBeInTheDocument();
    });

    it('should display service details when available', () => {
      render(<RelayerStatus />);

      // Queue Length
      expect(screen.getByText('Queue Length')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      // Events Processed
      expect(screen.getByText('Events Processed')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();

      // Monitor Status
      expect(screen.getByText('Monitor Status')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should display wallet status', () => {
      render(<RelayerStatus />);

      expect(screen.getByText('Wallet Status')).toBeInTheDocument();
      
      // Ethereum Wallet
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText(/0x123456\.\.\./, { exact: false })).toBeInTheDocument();
      expect(screen.getByText('1.5 ETH')).toBeInTheDocument();

      // NEAR Wallet
      expect(screen.getByText('NEAR')).toBeInTheDocument();
      expect(screen.getByText('test.near')).toBeInTheDocument();
      expect(screen.getByText('100.5 NEAR')).toBeInTheDocument();
    });

    it('should fetch and display metrics', async () => {
      mockGetMetrics.mockResolvedValueOnce(mockMetrics);

      render(<RelayerStatus />);

      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalled();
      });

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument(); // Total Orders
      expect(screen.getByText('95')).toBeInTheDocument(); // Successful
      expect(screen.getByText('2.5000')).toBeInTheDocument(); // Total Profit
      expect(screen.getByText('45s')).toBeInTheDocument(); // Avg. Time
    });

    it('should show disconnected wallet status', () => {
      const disconnectedStatus = {
        ...mockStatus,
        walletStatus: {
          ethereum: {
            connected: false,
            address: '',
            balance: '0'
          },
          near: {
            connected: false,
            accountId: '',
            balance: '0'
          }
        }
      };

      (useRelayerIntegration as jest.Mock).mockReturnValue({
        ...mockRelayerService,
        status: disconnectedStatus
      });

      render(<RelayerStatus />);

      const disconnectedElements = screen.getAllByText('Disconnected');
      expect(disconnectedElements).toHaveLength(2);
    });
  });

  describe('Compact Display Mode', () => {
    it('should render compact status when healthy', () => {
      render(<RelayerStatus compact />);

      expect(screen.getByText('Relayer: Active')).toBeInTheDocument();
      expect(screen.getByText('Queue: 3')).toBeInTheDocument();
    });

    it('should render compact offline state', () => {
      (useRelayerIntegration as jest.Mock).mockReturnValue({
        ...mockRelayerService,
        isHealthy: false,
        status: null
      });

      render(<RelayerStatus compact />);

      expect(screen.getByText('Relayer: Offline')).toBeInTheDocument();
    });

    it('should render compact loading state', () => {
      (useRelayerIntegration as jest.Mock).mockReturnValue({
        ...mockRelayerService,
        isHealthy: null,
        status: null
      });

      render(<RelayerStatus compact />);

      expect(screen.getByText('Relayer: Checking...')).toBeInTheDocument();
    });
  });

  describe('Auto-refresh Behavior', () => {
    it('should refresh metrics every 30 seconds when healthy', async () => {
      jest.useFakeTimers();
      mockGetMetrics.mockResolvedValue(mockMetrics);

      render(<RelayerStatus />);

      // Initial call
      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(mockGetMetrics).toHaveBeenCalledTimes(2);
      });

      jest.useRealTimers();
    });

    it('should not refresh metrics when unhealthy', async () => {
      jest.useFakeTimers();
      (useRelayerIntegration as jest.Mock).mockReturnValue({
        ...mockRelayerService,
        isHealthy: false
      });

      render(<RelayerStatus />);

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      expect(mockGetMetrics).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});

describe('RelayerHealthIndicator', () => {
  const mockRelayerService = {
    isHealthy: true,
    status: null,
    submitIntent: jest.fn(),
    analyzeProfitability: jest.fn(),
    getExecutionStatus: jest.fn(),
    startMonitoring: jest.fn(),
    getMetrics: jest.fn(),
    requestExecution: jest.fn(),
    cancelOrder: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRelayerIntegration as jest.Mock).mockReturnValue(mockRelayerService);
  });

  it('should render health indicator when online', () => {
    render(<RelayerHealthIndicator />);

    expect(screen.getByText('Relayer online')).toBeInTheDocument();
    
    // Check for green indicator
    const indicator = screen.getByText('Relayer online').previousElementSibling;
    expect(indicator).toHaveClass('bg-green-500');
  });

  it('should render health indicator when offline', () => {
    (useRelayerIntegration as jest.Mock).mockReturnValue({
      ...mockRelayerService,
      isHealthy: false
    });

    render(<RelayerHealthIndicator />);

    expect(screen.getByText('Relayer offline')).toBeInTheDocument();
    
    // Check for red indicator
    const indicator = screen.getByText('Relayer offline').previousElementSibling;
    expect(indicator).toHaveClass('bg-red-500');
  });

  it('should render health indicator when checking', () => {
    (useRelayerIntegration as jest.Mock).mockReturnValue({
      ...mockRelayerService,
      isHealthy: null
    });

    render(<RelayerHealthIndicator />);

    expect(screen.getByText('Relayer checking')).toBeInTheDocument();
    
    // Check for gray pulsing indicator
    const indicator = screen.getByText('Relayer checking').previousElementSibling;
    expect(indicator).toHaveClass('bg-gray-400');
    expect(indicator).toHaveClass('animate-pulse');
  });

  it('should apply custom className', () => {
    const { container } = render(<RelayerHealthIndicator className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });
});