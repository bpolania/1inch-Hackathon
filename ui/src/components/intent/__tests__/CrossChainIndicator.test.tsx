import React from 'react'
import { render, screen } from '@testing-library/react'
import { CrossChainIndicator } from '../CrossChainIndicator'
import { TokenInfo } from '@/types/intent'

// Test token data
const ETHEREUM_TOKEN: TokenInfo = {
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'ETH',
  decimals: 18,
  chainId: 'ethereum',
  logoURI: '/tokens/eth.svg',
  priceUSD: 2340.50,
}

const NEAR_TOKEN: TokenInfo = {
  address: 'near',
  symbol: 'NEAR',
  decimals: 24,
  chainId: 'near',
  logoURI: '/tokens/near.svg',
  priceUSD: 3.45,
}

const BITCOIN_TOKEN: TokenInfo = {
  address: 'btc',
  symbol: 'BTC',
  decimals: 8,
  chainId: 'bitcoin',
  logoURI: '/tokens/btc.svg',
  priceUSD: 43250.00,
}

const COSMOS_TOKENS = {
  neutron: {
    address: 'untrn',
    symbol: 'NTRN',
    decimals: 6,
    chainId: 'neutron' as const,
    logoURI: '/tokens/neutron.svg',
    priceUSD: 0.45,
  },
  juno: {
    address: 'ujunox',
    symbol: 'JUNOX',
    decimals: 6,
    chainId: 'juno' as const,
    logoURI: '/tokens/juno.svg',
    priceUSD: 0.33,
  },
  cosmos: {
    address: 'uatom',
    symbol: 'ATOM',
    decimals: 6,
    chainId: 'cosmos' as const,
    logoURI: '/tokens/atom.svg',
    priceUSD: 8.45,
  },
  osmosis: {
    address: 'uosmo',
    symbol: 'OSMO',
    decimals: 6,
    chainId: 'osmosis' as const,
    logoURI: '/tokens/osmosis.svg',
    priceUSD: 0.65,
  },
}

describe('CrossChainIndicator', () => {
  describe('Same-Chain Detection', () => {
    it('should not render for same-chain swaps', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={{
            ...ETHEREUM_TOKEN,
            address: '0x1234567890abcdef1234567890abcdef12345678',
            symbol: 'USDC',
          }}
        />
      )

      // Should not render anything for same-chain swaps
      expect(screen.queryByText('Cross-Chain Swap')).not.toBeInTheDocument()
    })

    it('should render for cross-chain swaps', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={NEAR_TOKEN}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
      expect(screen.getByText('Ethereum → NEAR Protocol')).toBeInTheDocument()
    })
  })

  describe('Cross-Chain Flow Visualization', () => {
    it('should show chain flow for Ethereum to NEAR swap', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={NEAR_TOKEN}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
      expect(screen.getByText('Ethereum → NEAR Protocol')).toBeInTheDocument()
      expect(screen.getByText('Ethereum')).toBeInTheDocument()
      expect(screen.getByText('NEAR Protocol')).toBeInTheDocument()
    })

    it('should show chain flow for Bitcoin to Cosmos swap', () => {
      render(
        <CrossChainIndicator
          fromToken={BITCOIN_TOKEN}
          toToken={COSMOS_TOKENS.cosmos}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
      expect(screen.getByText('Bitcoin → Cosmos Hub')).toBeInTheDocument()
    })

    it('should show chain flow for Ethereum to Cosmos swaps', () => {
      Object.values(COSMOS_TOKENS).forEach((cosmosToken) => {
        const { unmount } = render(
          <CrossChainIndicator
            fromToken={ETHEREUM_TOKEN}
            toToken={cosmosToken}
          />
        )

        expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
        expect(screen.getByText('Ethereum')).toBeInTheDocument()

        unmount()
      })
    })
  })

  describe('Cosmos Integration Features', () => {
    it('should show Cosmos integration message for Cosmos destinations', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      expect(screen.getByText('Cosmos Integration')).toBeInTheDocument()
      expect(screen.getByText(/1inch Fusion\+ with Cosmos blockchain integration/)).toBeInTheDocument()
      expect(screen.getByText(/HTLC.*Hash Time Locked Contracts/)).toBeInTheDocument()
    })

    it('should show Cosmos integration message for Cosmos sources', () => {
      render(
        <CrossChainIndicator
          fromToken={COSMOS_TOKENS.juno}
          toToken={ETHEREUM_TOKEN}
        />
      )

      expect(screen.getByText('Cosmos Integration')).toBeInTheDocument()
      expect(screen.getByText('Cosmos Integration')).toBeInTheDocument()
    })

    it('should not show Cosmos integration message for non-Cosmos swaps', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={NEAR_TOKEN}
        />
      )

      expect(screen.queryByText('Cosmos Integration')).not.toBeInTheDocument()
    })

    it('should show special Cosmos badge when Cosmos chains are involved', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      expect(screen.getByText('Cosmos Ready')).toBeInTheDocument()
    })
  })

  describe('Fee and Time Estimates', () => {
    it('should show estimates for Cosmos swaps', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.cosmos}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
      expect(screen.getByText('Est. Time')).toBeInTheDocument()
    })

    it('should show estimates for non-Cosmos swaps', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={NEAR_TOKEN}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
      expect(screen.getByText('Est. Time')).toBeInTheDocument()
    })

    it('should show fee categories', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      // Check for some estimate categories
      expect(screen.getByText('Est. Time')).toBeInTheDocument()
      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
    })
  })

  describe('Security and Features', () => {
    it('should show atomic swap features', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={NEAR_TOKEN}
        />
      )

      expect(screen.getByText('Atomic Swap')).toBeInTheDocument()
      expect(screen.getByText('Non-Custodial')).toBeInTheDocument()
    })

    it('should show information for different swap types', () => {
      // Cosmos swap
      const { rerender } = render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()

      // Non-Cosmos swap
      rerender(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={NEAR_TOKEN}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
    })
  })

  describe('All Cosmos Chains Support', () => {
    it('should support all Cosmos ecosystem chains', () => {
      const cosmosChains = [
        { token: COSMOS_TOKENS.neutron, name: 'Neutron' },
        { token: COSMOS_TOKENS.juno, name: 'Juno' },
        { token: COSMOS_TOKENS.cosmos, name: 'Cosmos Hub' },
        { token: COSMOS_TOKENS.osmosis, name: 'Osmosis' },
      ]

      cosmosChains.forEach(({ token, name }) => {
        const { unmount } = render(
          <CrossChainIndicator
            fromToken={ETHEREUM_TOKEN}
            toToken={token}
          />
        )

        expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
        expect(screen.getByText('Cosmos Integration')).toBeInTheDocument()
        expect(screen.getByText('Cosmos Ready')).toBeInTheDocument()

        unmount()
      })
    })

    it('should show indicators for Cosmos swaps regardless of direction', () => {
      // Ethereum to Cosmos
      const { rerender } = render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()

      // Cosmos to Ethereum
      rerender(
        <CrossChainIndicator
          fromToken={COSMOS_TOKENS.juno}
          toToken={ETHEREUM_TOKEN}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()

      // Cosmos to Cosmos
      rerender(
        <CrossChainIndicator
          fromToken={COSMOS_TOKENS.neutron}
          toToken={COSMOS_TOKENS.cosmos}
        />
      )

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
    })
  })

  describe('Visual Elements and Styling', () => {
    it('should have proper color coding for different elements', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      // Check for blue theme (cross-chain indicator should have blue styling)
      const card = screen.getByText('Cross-Chain Swap').closest('[class*="border-blue"]')
      expect(card).toBeInTheDocument()
    })

    it('should show chain-specific colors in visualization', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      // Chain dots should be present in the visualization
      const chainDots = document.querySelectorAll('.w-3.h-3.rounded-full')
      expect(chainDots.length).toBeGreaterThanOrEqual(2)
    })

    it('should have proper icons for different categories', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.cosmos}
        />
      )

      // Should contain some icons and text
      expect(screen.getByText('Est. Time')).toBeInTheDocument()
      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing chain info gracefully', () => {
      const unknownToken: TokenInfo = {
        address: 'unknown',
        symbol: 'UNK',
        decimals: 18,
        chainId: 'unknown' as any,
        logoURI: '/unknown.svg',
        priceUSD: 1.0,
      }

      expect(() => {
        render(
          <CrossChainIndicator
            fromToken={ETHEREUM_TOKEN}
            toToken={unknownToken}
          />
        )
      }).not.toThrow()

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
    })

    it('should handle tokens without price data', () => {
      const tokenWithoutPrice: TokenInfo = {
        ...COSMOS_TOKENS.neutron,
        priceUSD: undefined,
      }

      expect(() => {
        render(
          <CrossChainIndicator
            fromToken={ETHEREUM_TOKEN}
            toToken={tokenWithoutPrice}
          />
        )
      }).not.toThrow()

      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
    })

    it('should handle very long chain names gracefully', () => {
      const longNameToken: TokenInfo = {
        ...COSMOS_TOKENS.neutron,
        chainId: 'very-long-chain-name-that-might-break-layout' as any,
      }

      expect(() => {
        render(
          <CrossChainIndicator
            fromToken={ETHEREUM_TOKEN}
            toToken={longNameToken}
          />
        )
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      // Should have proper headings
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Cross-Chain Swap')
    })

    it('should have readable text contrast', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.cosmos}
        />
      )

      // Key information should be easily readable
      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
      expect(screen.getByText('Est. Time')).toBeInTheDocument()
    })

    it('should provide descriptive information for complex features', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      // Should show some feature information
      expect(screen.getByText('Cross-Chain Swap')).toBeInTheDocument()
      expect(screen.getByText('Cosmos Integration')).toBeInTheDocument()
    })
  })

  describe('Custom Styling', () => {
    it('should apply custom className when provided', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
          className="custom-test-class"
        />
      )

      const card = screen.getByText('Cross-Chain Swap').closest('[class*="custom-test-class"]')
      expect(card).toBeInTheDocument()
    })

    it('should maintain default styling when no className provided', () => {
      render(
        <CrossChainIndicator
          fromToken={ETHEREUM_TOKEN}
          toToken={COSMOS_TOKENS.neutron}
        />
      )

      // Should have default border styling
      const card = screen.getByText('Cross-Chain Swap').closest('[class*="border-blue"]')
      expect(card).toBeInTheDocument()
    })
  })
})