/**
 * Tests for PriceQuote Component
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PriceQuote, CompactPriceQuote } from '../PriceQuote';
import { useOneInchQuotes } from '@/services/oneinch';
import { TokenInfo } from '@/types/intent';

// Mock the 1inch service hook
jest.mock('@/services/oneinch', () => ({
  ...jest.requireActual('@/services/oneinch'),
  useOneInchQuotes: jest.fn(),
  SUPPORTED_CHAINS: {
    ETHEREUM: 1
  }
}));

describe('PriceQuote', () => {
  const mockFromToken: TokenInfo = {
    chainId: 1,
    address: '0x123',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoURI: ''
  };

  const mockToToken: TokenInfo = {
    chainId: 1,
    address: '0x456',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: ''
  };

  const mockQuote = {
    outputAmount: '1000000000',
    formattedOutput: '1000.000000',
    priceImpact: 0.5,
    route: 'Uniswap → SushiSwap',
    gasEstimate: '150000',
    gasPrice: '20000000000',
    protocols: ['Uniswap', 'SushiSwap'],
    confidence: 0.95
  };

  const mockGetQuote = jest.fn();
  const mockQuoteService = {
    getQuote: mockGetQuote,
    getCompetitiveQuotes: jest.fn(),
    isLoading: false,
    error: null,
    clearCache: jest.fn(),
    validateTokens: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useOneInchQuotes as jest.Mock).mockReturnValue(mockQuoteService);
  });

  describe('Basic Functionality', () => {
    it('should not render when inputs are invalid', () => {
      const { container } = render(
        <PriceQuote
          fromToken={null}
          toToken={mockToToken}
          fromAmount=""
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should fetch quote when all inputs are valid', async () => {
      mockGetQuote.mockResolvedValueOnce(mockQuote);

      render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
        />
      );

      await waitFor(() => {
        expect(mockGetQuote).toHaveBeenCalledWith(
          1, // ETHEREUM chain ID
          '0x123',
          '0x456',
          '1000000000000000000', // 1 ETH in wei
          1 // 1% slippage
        );
      });
    });

    it('should display quote results', async () => {
      mockGetQuote.mockResolvedValueOnce(mockQuote);

      render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('1inch Best Quote')).toBeInTheDocument();
        expect(screen.getByText('1000.000000 USDC')).toBeInTheDocument();
        expect(screen.getByText('0.50%')).toBeInTheDocument();
        expect(screen.getByText('Uniswap → SushiSwap')).toBeInTheDocument();
      });
    });

    it('should call onQuoteUpdate callback', async () => {
      const onQuoteUpdate = jest.fn();
      mockGetQuote.mockResolvedValueOnce(mockQuote);

      render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
          onQuoteUpdate={onQuoteUpdate}
        />
      );

      await waitFor(() => {
        expect(onQuoteUpdate).toHaveBeenCalledWith('1000.000000');
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state', () => {
      (useOneInchQuotes as jest.Mock).mockReturnValue({
        ...mockQuoteService,
        isLoading: true
      });

      render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
        />
      );

      expect(screen.getByText('Getting best price...')).toBeInTheDocument();
    });

    it('should show error state', () => {
      const errorMessage = 'Failed to fetch quote';
      (useOneInchQuotes as jest.Mock).mockReturnValue({
        ...mockQuoteService,
        error: errorMessage
      });

      render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
        />
      );

      expect(screen.getByText('Quote Error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Price Impact Warnings', () => {
    it('should show warning for high price impact', async () => {
      const highImpactQuote = {
        ...mockQuote,
        priceImpact: 5.5
      };
      mockGetQuote.mockResolvedValueOnce(highImpactQuote);

      render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('High Price Impact')).toBeInTheDocument();
        expect(screen.getByText(/This swap has a high price impact/)).toBeInTheDocument();
      });
    });

    it('should show appropriate color for different price impacts', async () => {
      // Test different price impact levels
      const testCases = [
        { impact: 0.5, expectedClass: 'text-green-500' },
        { impact: 2, expectedClass: 'text-yellow-500' },
        { impact: 5, expectedClass: 'text-red-500' }
      ];

      for (const testCase of testCases) {
        mockGetQuote.mockResolvedValueOnce({
          ...mockQuote,
          priceImpact: testCase.impact
        });

        const { container } = render(
          <PriceQuote
            fromToken={mockFromToken}
            toToken={mockToToken}
            fromAmount="1"
          />
        );

        await waitFor(() => {
          const impactElement = screen.getByText(`${testCase.impact.toFixed(2)}%`);
          expect(impactElement.parentElement).toHaveClass(testCase.expectedClass);
        });

        // Clean up for next iteration
        container.remove();
      }
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh quote when refresh button is clicked', async () => {
      mockGetQuote.mockResolvedValueOnce(mockQuote);

      render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('1inch Best Quote')).toBeInTheDocument();
      });

      // Click refresh button
      const refreshButton = screen.getByTitle('Refresh quote');
      fireEvent.click(refreshButton);

      // Should fetch quote again
      await waitFor(() => {
        expect(mockGetQuote).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Protocol Display', () => {
    it('should display protocols used', async () => {
      mockGetQuote.mockResolvedValueOnce(mockQuote);

      render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Protocols Used')).toBeInTheDocument();
        expect(screen.getByText('Uniswap')).toBeInTheDocument();
        expect(screen.getByText('SushiSwap')).toBeInTheDocument();
      });
    });

    it('should limit protocol display and show count', async () => {
      const manyProtocolsQuote = {
        ...mockQuote,
        protocols: ['Uniswap', 'SushiSwap', 'Curve', 'Balancer', 'Bancor']
      };
      mockGetQuote.mockResolvedValueOnce(manyProtocolsQuote);

      render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Uniswap')).toBeInTheDocument();
        expect(screen.getByText('SushiSwap')).toBeInTheDocument();
        expect(screen.getByText('Curve')).toBeInTheDocument();
        expect(screen.getByText('+2 more')).toBeInTheDocument();
      });
    });
  });

  describe('Debouncing', () => {
    it('should debounce quote requests', async () => {
      const { rerender } = render(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="1"
        />
      );

      // Quick successive changes
      rerender(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="2"
        />
      );

      rerender(
        <PriceQuote
          fromToken={mockFromToken}
          toToken={mockToToken}
          fromAmount="3"
        />
      );

      // Should only call once after debounce
      await waitFor(() => {
        expect(mockGetQuote).toHaveBeenCalledTimes(1);
        expect(mockGetQuote).toHaveBeenLastCalledWith(
          1,
          '0x123',
          '0x456',
          '3000000000000000000', // 3 ETH
          1
        );
      });
    });
  });
});

describe('CompactPriceQuote', () => {
  const mockFromToken: TokenInfo = {
    chainId: 1,
    address: '0x123',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoURI: ''
  };

  const mockToToken: TokenInfo = {
    chainId: 1,
    address: '0x456',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: ''
  };

  const mockQuote = {
    outputAmount: '1000000000',
    formattedOutput: '1000.000000',
    priceImpact: 0.5,
    route: 'Uniswap',
    gasEstimate: '150000',
    gasPrice: '20000000000',
    protocols: ['Uniswap'],
    confidence: 0.95
  };

  const mockGetQuote = jest.fn();
  const mockQuoteService = {
    getQuote: mockGetQuote,
    getCompetitiveQuotes: jest.fn(),
    isLoading: false,
    error: null,
    clearCache: jest.fn(),
    validateTokens: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useOneInchQuotes as jest.Mock).mockReturnValue(mockQuoteService);
  });

  it('should render compact quote display', async () => {
    mockGetQuote.mockResolvedValueOnce(mockQuote);

    render(
      <CompactPriceQuote
        fromToken={mockFromToken}
        toToken={mockToToken}
        fromAmount="1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1inch Quote:')).toBeInTheDocument();
      expect(screen.getByText('1000.0000 USDC')).toBeInTheDocument();
    });
  });

  it('should show loading state in compact mode', () => {
    (useOneInchQuotes as jest.Mock).mockReturnValue({
      ...mockQuoteService,
      isLoading: true
    });

    render(
      <CompactPriceQuote
        fromToken={mockFromToken}
        toToken={mockToToken}
        fromAmount="1"
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should not render when quote is null and not loading', () => {
    mockGetQuote.mockResolvedValueOnce(null);

    const { container } = render(
      <CompactPriceQuote
        fromToken={mockFromToken}
        toToken={mockToToken}
        fromAmount="1"
      />
    );

    // Should show the label but no quote
    expect(screen.queryByText('1inch Quote:')).not.toBeInTheDocument();
  });
});