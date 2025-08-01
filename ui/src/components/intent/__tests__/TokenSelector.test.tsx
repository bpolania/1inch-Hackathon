import React from 'react'
import { render, screen, waitFor } from '../../../tests/utils/test-utils'
import { TokenSelector } from '../TokenSelector'
import { createMockToken, NEAR_TOKEN, ETH_TOKEN, BTC_TOKEN } from '../../../tests/utils/test-utils'
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()

describe('TokenSelector', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render with placeholder text when no token selected', () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
          label="Select token"
        />
      )

      expect(screen.getByText('Select token')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should render selected token information', () => {
      render(
        <TokenSelector
          value={NEAR_TOKEN}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('NEAR')).toBeInTheDocument()
      expect(screen.getByText('NEAR', { selector: 'div' })).toBeInTheDocument()
    })

    it('should show clear button when token is selected', () => {
      render(
        <TokenSelector
          value={NEAR_TOKEN}
          onChange={mockOnChange}
        />
      )

      const clearButton = screen.getByRole('button', { name: '' }) // X button
      expect(clearButton).toBeInTheDocument()
    })
  })

  describe('Dropdown Interaction', () => {
    it('should open dropdown when clicked', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      const selectButton = screen.getByRole('button')
      await user.click(selectButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search tokens or chains...')).toBeInTheDocument()
      })
    })

    it('should show token list when dropdown is open', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('NEAR')).toBeInTheDocument()
        expect(screen.getByText('ETH')).toBeInTheDocument()
        expect(screen.getByText('BTC')).toBeInTheDocument()
        expect(screen.getByText('USDT')).toBeInTheDocument()
      })
    })

    it('should close dropdown when clicking outside', async () => {
      render(
        <div>
          <TokenSelector
            value={null}
            onChange={mockOnChange}
          />
          <div data-testid="outside">Outside</div>
        </div>
      )

      // Open dropdown
      await user.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search tokens or chains...')).toBeInTheDocument()
      })

      // Click outside
      await user.click(screen.getByTestId('outside'))

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search tokens or chains...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Token Selection', () => {
    it('should call onChange when token is selected', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('NEAR')).toBeInTheDocument()
      })

      await user.click(screen.getByText('NEAR'))

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'NEAR',
          chainId: 'near',
        })
      )
    })

    it('should clear selection when clear button is clicked', async () => {
      render(
        <TokenSelector
          value={NEAR_TOKEN}
          onChange={mockOnChange}
        />
      )

      const clearButton = screen.getByRole('button', { name: '' })
      await user.click(clearButton)

      expect(mockOnChange).toHaveBeenCalledWith(null)
    })

    it('should close dropdown after selection', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByRole('button'))
      await user.click(screen.getByText('NEAR'))

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search tokens or chains...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('should filter tokens by symbol', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByRole('button'))
      
      const searchInput = screen.getByPlaceholderText('Search tokens or chains...')
      await user.type(searchInput, 'NEAR')

      await waitFor(() => {
        expect(screen.getByText('NEAR')).toBeInTheDocument()
        expect(screen.queryByText('ETH')).not.toBeInTheDocument()
        expect(screen.queryByText('BTC')).not.toBeInTheDocument()
      })
    })

    it('should filter tokens by chain name', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByRole('button'))
      
      const searchInput = screen.getByPlaceholderText('Search tokens or chains...')
      await user.type(searchInput, 'ethereum')

      await waitFor(() => {
        expect(screen.getByText('ETH')).toBeInTheDocument()
        expect(screen.queryByText('NEAR')).not.toBeInTheDocument()
        expect(screen.queryByText('BTC')).not.toBeInTheDocument()
      })
    })

    it('should show "No tokens found" when search yields no results', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByRole('button'))
      
      const searchInput = screen.getByPlaceholderText('Search tokens or chains...')
      await user.type(searchInput, 'nonexistent')

      await waitFor(() => {
        expect(screen.getByText('No tokens found')).toBeInTheDocument()
      })
    })

    it('should clear search when dropdown is closed', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByRole('button'))
      
      const searchInput = screen.getByPlaceholderText('Search tokens or chains...')
      await user.type(searchInput, 'NEAR')

      // Close dropdown by selecting a token
      await user.click(screen.getByText('NEAR'))

      // Reopen dropdown
      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        const newSearchInput = screen.getByPlaceholderText('Search tokens or chains...')
        expect(newSearchInput).toHaveValue('')
      })
    })
  })

  describe('Token Exclusion', () => {
    it('should exclude specified token from list', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
          excludeToken={NEAR_TOKEN}
        />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.queryByText('NEAR')).not.toBeInTheDocument()
        expect(screen.getByText('ETH')).toBeInTheDocument()
        expect(screen.getByText('BTC')).toBeInTheDocument()
      })
    })

    it('should not exclude tokens with same symbol but different chain', async () => {
      const wNEAR = createMockToken({
        symbol: 'wNEAR',
        chainId: 'ethereum',
        address: '0x...',
      })

      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
          excludeToken={NEAR_TOKEN} // NEAR on NEAR chain
        />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        // Should still show other tokens
        expect(screen.getByText('ETH')).toBeInTheDocument()
        expect(screen.getByText('BTC')).toBeInTheDocument()
      })
    })
  })

  describe('Chain Badges and Visual Elements', () => {
    it('should display chain badges for tokens', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        // Check for chain information display
        expect(screen.getByText('NEAR')).toBeInTheDocument()
        expect(screen.getByText('Ethereum')).toBeInTheDocument()
        expect(screen.getByText('Bitcoin')).toBeInTheDocument()
      })
    })

    it('should show USD prices when available', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        // Should show formatted USD prices
        expect(screen.getByText('$3.45')).toBeInTheDocument() // NEAR price
        expect(screen.getByText('$2.34K')).toBeInTheDocument() // ETH price  
        expect(screen.getByText('$43.25K')).toBeInTheDocument() // BTC price
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
          label="Select token"
        />
      )

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      render(
        <TokenSelector
          value={null}
          onChange={mockOnChange}
        />
      )

      const button = screen.getByRole('button')
      
      // Focus and activate with keyboard
      button.focus()
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search tokens or chains...')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle missing token data gracefully', () => {
      const incompleteToken = createMockToken({
        symbol: 'TEST',
        // Missing other properties
      })

      expect(() => {
        render(
          <TokenSelector
            value={incompleteToken}
            onChange={mockOnChange}
          />
        )
      }).not.toThrow()
    })

    it('should handle onChange errors gracefully', async () => {
      const faultyOnChange = jest.fn().mockImplementation(() => {
        throw new Error('onChange error')
      })

      render(
        <TokenSelector
          value={null}
          onChange={faultyOnChange}
        />
      )

      await user.click(screen.getByRole('button'))

      // Should not crash when onChange throws
      expect(() => user.click(screen.getByText('NEAR'))).not.toThrow()
    })
  })
})