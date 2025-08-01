import React from 'react'
import { render, screen, waitFor } from '../utils/test-utils'
import { IntentsDashboard } from '@/components/dashboard/IntentsDashboard'
import { useIntentStore } from '@/stores/intentStore'
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()

// Mock the intent store with more realistic behavior
jest.mock('@/stores/intentStore')
const mockUseIntentStore = useIntentStore as jest.MockedFunction<typeof useIntentStore>

describe('Complete Intent Workflow E2E', () => {
  let mockStoreState: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Initialize mock store state
    mockStoreState = {
      currentIntent: null,
      intents: [],
      createIntent: jest.fn((data) => {
        mockStoreState.currentIntent = {
          id: 'new-intent-' + Date.now(),
          ...data,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      }),
      updateIntent: jest.fn((updates) => {
        if (mockStoreState.currentIntent) {
          mockStoreState.currentIntent = {
            ...mockStoreState.currentIntent,
            ...updates,
            updatedAt: Date.now(),
          }
        }
      }),
      submitIntent: jest.fn(async () => {
        if (mockStoreState.currentIntent) {
          const intentId = mockStoreState.currentIntent.id
          mockStoreState.intents.push({
            ...mockStoreState.currentIntent,
            status: 'processing',
          })
          mockStoreState.currentIntent = null
          return intentId
        }
        throw new Error('No current intent to submit')
      }),
      clearCurrentIntent: jest.fn(() => {
        mockStoreState.currentIntent = null
      }),
      addIntent: jest.fn((intent) => {
        mockStoreState.intents.push(intent)
      }),
      updateIntentStatus: jest.fn((id, status) => {
        const intentIndex = mockStoreState.intents.findIndex(i => i.id === id)
        if (intentIndex >= 0) {
          mockStoreState.intents[intentIndex] = {
            ...mockStoreState.intents[intentIndex],
            status,
            updatedAt: Date.now(),
          }
        }
      }),
      clearAllIntents: jest.fn(() => {
        mockStoreState.intents = []
      }),
      getIntentById: jest.fn((id) => {
        return mockStoreState.intents.find(i => i.id === id)
      }),
      getIntentsByStatus: jest.fn((status) => {
        return mockStoreState.intents.filter(i => i.status === status)
      }),
    }

    mockUseIntentStore.mockImplementation(() => mockStoreState)
  })

  describe('Same-Chain Intent Creation and Execution', () => {
    it('should complete full same-chain intent workflow', async () => {
      render(<IntentsDashboard />)

      // Verify we start on the create tab
      expect(screen.getByText('Express Your Intent')).toBeInTheDocument()
      expect(screen.getByText('Total Intents')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument() // No intents initially

      // Step 1: Select NEAR as from token
      const fromTokenSelector = screen.getByText('Select token to swap from')
      await user.click(fromTokenSelector)
      
      await waitFor(() => {
        expect(screen.getByText('NEAR')).toBeInTheDocument()
      })
      await user.click(screen.getByText('NEAR'))

      // Step 2: Enter from amount
      const fromAmountInput = screen.getByLabelText('Amount to swap')
      await user.type(fromAmountInput, '100')

      // Step 3: Select USDT as to token (same chain)
      const toTokenSelector = screen.getByText('Select token to receive')
      await user.click(toTokenSelector)
      
      await waitFor(() => {
        expect(screen.getByText('USDT')).toBeInTheDocument()
      })
      await user.click(screen.getByText('USDT'))

      // Step 4: Enter minimum amount
      const toAmountInput = screen.getByLabelText('Minimum amount to receive')
      await user.type(toAmountInput, '340')

      // Step 5: Select priority (best price for same-chain)
      const bestPriceButton = screen.getByText('Best Price')
      await user.click(bestPriceButton)

      // Step 6: Submit intent
      const submitButton = screen.getByText('Submit Intent')
      expect(submitButton).not.toBeDisabled()
      await user.click(submitButton)

      // Should automatically switch to competition tab
      await waitFor(() => {
        expect(screen.getByText('Solver Competition')).toBeInTheDocument()
        expect(screen.getByText('Live Bids')).toBeInTheDocument()
      })

      // Verify intent was created and submitted
      expect(mockStoreState.submitIntent).toHaveBeenCalled()
      expect(mockStoreState.intents).toHaveLength(1)
      expect(mockStoreState.intents[0].status).toBe('processing')
    })
  })

  describe('Cross-Chain Intent Creation and Execution', () => {
    it('should complete full cross-chain intent workflow', async () => {
      render(<IntentsDashboard />)

      // Step 1: Select ETH as from token
      const fromTokenSelector = screen.getByText('Select token to swap from')
      await user.click(fromTokenSelector)
      await user.click(screen.getByText('ETH'))

      // Step 2: Enter from amount
      const fromAmountInput = screen.getByLabelText('Amount to swap')
      await user.type(fromAmountInput, '1.0')

      // Step 3: Select NEAR as to token (cross-chain)
      const toTokenSelector = screen.getByText('Select token to receive')
      await user.click(toTokenSelector)
      await user.click(screen.getByText('NEAR'))

      // Step 4: Enter minimum amount
      const toAmountInput = screen.getByLabelText('Minimum amount to receive')
      await user.type(toAmountInput, '680')

      // Step 5: Choose security priority for cross-chain
      const securityButton = screen.getByText('Most Secure')
      await user.click(securityButton)

      // Step 6: Open advanced preferences
      const preferencesHeader = screen.getByText('Advanced Preferences')
      await user.click(preferencesHeader)

      // Step 7: Adjust slippage for cross-chain
      await waitFor(() => {
        const slippageButton = screen.getByText('1.0%')
        expect(slippageButton).toBeInTheDocument()
      })
      await user.click(screen.getByText('1.0%'))

      // Step 8: Preview intent
      const previewButton = screen.getByText('Preview Intent')
      await user.click(previewButton)

      await waitFor(() => {
        expect(screen.getByText('Intent Preview')).toBeInTheDocument()
        expect(screen.getByText('Cross-Chain Intent Detected')).toBeInTheDocument()
      })

      // Step 9: Submit cross-chain intent
      const submitButton = screen.getByText('Submit Intent')
      await user.click(submitButton)

      // Should switch to competition and show cross-chain competition
      await waitFor(() => {
        expect(screen.getByText('Solver Competition')).toBeInTheDocument()
        expect(screen.getByText('TEE Verified')).toBeInTheDocument()
      })

      // Verify cross-chain intent specifics
      expect(mockStoreState.intents[0].fromToken.chainId).toBe('ethereum')
      expect(mockStoreState.intents[0].toToken.chainId).toBe('near')
      expect(mockStoreState.intents[0].prioritize).toBe('security')
    })
  })

  describe('Intent History and Management', () => {
    it('should track intent history and allow navigation', async () => {
      // Pre-populate with some completed intents
      mockStoreState.intents = [
        {
          id: 'completed-1',
          user: 'demo-user',
          fromToken: { symbol: 'ETH', chainId: 'ethereum', address: '0x...', decimals: 18 },
          toToken: { symbol: 'NEAR', chainId: 'near', address: 'near', decimals: 24 },
          fromAmount: '1.0',
          minToAmount: '680.0',
          maxSlippage: 50,
          deadline: Date.now() + 300000,
          prioritize: 'speed',
          status: 'completed',
          createdAt: Date.now() - 3600000, // 1 hour ago
          updatedAt: Date.now() - 3000000, // 50 minutes ago
        },
        {
          id: 'failed-1',
          user: 'demo-user',
          fromToken: { symbol: 'BTC', chainId: 'bitcoin', address: 'btc', decimals: 8 },
          toToken: { symbol: 'USDT', chainId: 'near', address: 'usdt.near', decimals: 6 },
          fromAmount: '0.1',
          minToAmount: '4300.0',
          maxSlippage: 100,
          deadline: Date.now() - 3600000, // Expired
          prioritize: 'cost',
          status: 'failed',
          createdAt: Date.now() - 7200000, // 2 hours ago
          updatedAt: Date.now() - 6000000, // 100 minutes ago
        },
      ]

      render(<IntentsDashboard />)

      // Switch to history tab
      const historyTab = screen.getByText('History')
      await user.click(historyTab)

      await waitFor(() => {
        expect(screen.getByText('Intent History')).toBeInTheDocument()
        expect(screen.getByText('1.00 ETH → NEAR')).toBeInTheDocument()
        expect(screen.getByText('0.10 BTC → USDT')).toBeInTheDocument()
      })

      // Check status indicators
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('failed')).toBeInTheDocument()

      // Check cross-chain indicators
      expect(screen.getAllByText('Cross-Chain')).toHaveLength(2)

      // Click on completed intent to view details
      const viewDetailsButtons = screen.getAllByText('View Details')
      await user.click(viewDetailsButtons[0])

      // Should switch to competition tab with selected intent
      await waitFor(() => {
        expect(screen.getByText('Solver Competition')).toBeInTheDocument()
        expect(screen.getByText('Intent: completed-1')).toBeInTheDocument()
      })
    })
  })

  describe('Analytics and Metrics', () => {
    it('should display protocol analytics correctly', async () => {
      // Pre-populate with diverse intents for analytics
      mockStoreState.intents = [
        {
          id: 'eth-near-1',
          fromToken: { symbol: 'ETH', chainId: 'ethereum', priceUSD: 2340, address: '0x...', decimals: 18 },
          toToken: { symbol: 'NEAR', chainId: 'near', address: 'near', decimals: 24 },
          fromAmount: '1.0',
          status: 'completed',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'btc-near-1',
          fromToken: { symbol: 'BTC', chainId: 'bitcoin', priceUSD: 43250, address: 'btc', decimals: 8 },
          toToken: { symbol: 'NEAR', chainId: 'near', address: 'near', decimals: 24 },
          fromAmount: '0.05',
          status: 'completed',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'near-usdt-1',
          fromToken: { symbol: 'NEAR', chainId: 'near', priceUSD: 3.45, address: 'near', decimals: 24 },
          toToken: { symbol: 'USDT', chainId: 'near', address: 'usdt.near', decimals: 6 },
          fromAmount: '100.0',
          status: 'completed',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]

      render(<IntentsDashboard />)

      // Check main dashboard stats
      expect(screen.getByText('3')).toBeInTheDocument() // Total intents
      expect(screen.getByText('3')).toBeInTheDocument() // Completed intents
      
      // Calculate expected total volume: (1.0 * 2340) + (0.05 * 43250) + (100.0 * 3.45)
      const expectedVolume = 2340 + 2162.5 + 345 // = $4847.5
      expect(screen.getByText('$4.85K')).toBeInTheDocument()

      // Switch to analytics tab
      const analyticsTab = screen.getByText('Analytics')
      await user.click(analyticsTab)

      await waitFor(() => {
        expect(screen.getByText('Protocol Analytics')).toBeInTheDocument()
        expect(screen.getByText('Chain Distribution')).toBeInTheDocument()
        expect(screen.getByText('Success Metrics')).toBeInTheDocument()
        expect(screen.getByText('Top Solvers')).toBeInTheDocument()
      })

      // Check chain distribution (mock data in component)
      expect(screen.getByText('45%')).toBeInTheDocument() // NEAR
      expect(screen.getByText('35%')).toBeInTheDocument() // Ethereum
      expect(screen.getByText('20%')).toBeInTheDocument() // Bitcoin

      // Check success metrics
      expect(screen.getByText('98.5%')).toBeInTheDocument() // Success rate
      expect(screen.getByText('+3.2%')).toBeInTheDocument() // Avg improvement

      // Check top solvers
      expect(screen.getByText('1inch Solver')).toBeInTheDocument()
      expect(screen.getByText('Jupiter Solver')).toBeInTheDocument()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle submission failures gracefully', async () => {
      // Mock submission failure
      mockStoreState.submitIntent = jest.fn().mockRejectedValue(new Error('Network error'))
      
      render(<IntentsDashboard />)

      // Create a valid intent
      const fromTokenSelector = screen.getByText('Select token to swap from')
      await user.click(fromTokenSelector)
      await user.click(screen.getByText('ETH'))

      const fromAmountInput = screen.getByLabelText('Amount to swap')
      await user.type(fromAmountInput, '1.0')

      const toTokenSelector = screen.getByText('Select token to receive')
      await user.click(toTokenSelector)
      await user.click(screen.getByText('NEAR'))

      const toAmountInput = screen.getByLabelText('Minimum amount to receive')
      await user.type(toAmountInput, '680')

      // Try to submit
      const submitButton = screen.getByText('Submit Intent')
      await user.click(submitButton)

      // Should not switch tabs and should show error in console
      await waitFor(() => {
        expect(screen.getByText('Express Your Intent')).toBeInTheDocument()
      })

      // Intent should not be added to list
      expect(mockStoreState.intents).toHaveLength(0)
    })

    it('should handle empty state gracefully', async () => {
      render(<IntentsDashboard />)

      // Check empty states
      expect(screen.getByText('0')).toBeInTheDocument() // Total intents

      // Switch to history tab
      await user.click(screen.getByText('History'))
      
      await waitFor(() => {
        expect(screen.getByText('No Intent History')).toBeInTheDocument()
        expect(screen.getByText('Your completed intents will appear here')).toBeInTheDocument()
      })

      // Switch to competition tab
      await user.click(screen.getByText('Competition'))
      
      await waitFor(() => {
        expect(screen.getByText('No Active Competition')).toBeInTheDocument()
        expect(screen.getByText('Create an intent to see the solver competition in action')).toBeInTheDocument()
      })
    })

    it('should validate form inputs properly', async () => {
      render(<IntentsDashboard />)

      // Try to submit without any tokens selected
      const submitButton = screen.getByText('Submit Intent')
      expect(submitButton).toBeDisabled()

      // Select only from token
      const fromTokenSelector = screen.getByText('Select token to swap from')
      await user.click(fromTokenSelector)
      await user.click(screen.getByText('ETH'))

      // Should still be disabled
      expect(submitButton).toBeDisabled()

      // Add amount but no to token
      const fromAmountInput = screen.getByLabelText('Amount to swap')
      await user.type(fromAmountInput, '1.0')
      expect(submitButton).toBeDisabled()

      // Add to token but no to amount
      const toTokenSelector = screen.getByText('Select token to receive')
      await user.click(toTokenSelector)
      await user.click(screen.getByText('NEAR'))
      expect(submitButton).toBeDisabled()

      // Finally add to amount - should enable
      const toAmountInput = screen.getByLabelText('Minimum amount to receive')
      await user.type(toAmountInput, '680')
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('Real-time Updates and State Management', () => {
    it('should update intent status in real-time', async () => {
      render(<IntentsDashboard />)

      // Create and submit an intent first
      const fromTokenSelector = screen.getByText('Select token to swap from')
      await user.click(fromTokenSelector)
      await user.click(screen.getByText('ETH'))

      const fromAmountInput = screen.getByLabelText('Amount to swap')
      await user.type(fromAmountInput, '1.0')

      const toTokenSelector = screen.getByText('Select token to receive')
      await user.click(toTokenSelector)
      await user.click(screen.getByText('NEAR'))

      const toAmountInput = screen.getByLabelText('Minimum amount to receive')
      await user.type(toAmountInput, '680')

      await user.click(screen.getByText('Submit Intent'))

      // Should be in competition tab with processing status
      await waitFor(() => {
        expect(screen.getByText('Solver Competition')).toBeInTheDocument()
      })

      // Simulate real-time status update
      const intentId = mockStoreState.intents[0].id
      mockStoreState.updateIntentStatus(intentId, 'completed')

      // Switch to history to see updated status
      await user.click(screen.getByText('History'))

      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument()
      })

      // Stats should update
      expect(screen.getByText('1')).toBeInTheDocument() // Total and completed
    })
  })
})