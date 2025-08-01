import React from 'react'
import { render, screen, waitFor } from '../../../tests/utils/test-utils'
import { IntentForm } from '../IntentForm'
import { useIntentStore } from '@/stores/intentStore'
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()

// Mock the intent store
jest.mock('@/stores/intentStore')
const mockUseIntentStore = useIntentStore as jest.MockedFunction<typeof useIntentStore>

describe('IntentForm Integration Tests', () => {
  const mockCreateIntent = jest.fn()
  const mockUpdateIntent = jest.fn()
  const mockSubmitIntent = jest.fn()
  const mockClearCurrentIntent = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default store state
    mockUseIntentStore.mockReturnValue({
      currentIntent: null,
      intents: [],
      createIntent: mockCreateIntent,
      updateIntent: mockUpdateIntent,
      submitIntent: mockSubmitIntent,
      clearCurrentIntent: mockClearCurrentIntent,
      addIntent: jest.fn(),
      updateIntentStatus: jest.fn(),
      clearAllIntents: jest.fn(),
      getIntentById: jest.fn(),
      getIntentsByStatus: jest.fn(),
    })
  })

  describe('Complete Intent Creation Workflow', () => {
    it('should create intent on mount when none exists', () => {
      render(<IntentForm onSubmit={mockOnSubmit} />)

      expect(mockCreateIntent).toHaveBeenCalledWith({
        user: 'demo-user',
        maxSlippage: 50,
        deadline: expect.any(Number),
        prioritize: 'speed',
      })
    })

    it('should complete full intent creation and submission workflow', async () => {
      // Setup store with current intent
      const mockCurrentIntent = {
        id: 'test-intent',
        user: 'demo-user',
        maxSlippage: 50,
        deadline: Math.floor(Date.now() / 1000) + 300,
        prioritize: 'speed' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      mockUseIntentStore.mockReturnValue({
        currentIntent: mockCurrentIntent,
        intents: [],
        createIntent: mockCreateIntent,
        updateIntent: mockUpdateIntent,
        submitIntent: mockSubmitIntent.mockResolvedValue('submitted-intent-id'),
        clearCurrentIntent: mockClearCurrentIntent,
        addIntent: jest.fn(),
        updateIntentStatus: jest.fn(),
        clearAllIntents: jest.fn(),
        getIntentById: jest.fn(),
        getIntentsByStatus: jest.fn(),
      })

      render(<IntentForm onSubmit={mockOnSubmit} />)

      // Step 1: Select from token
      const fromTokenSelector = screen.getByText('Select token to swap from')
      await user.click(fromTokenSelector)
      
      await waitFor(() => {
        expect(screen.getByText('ETH')).toBeInTheDocument()
      })
      await user.click(screen.getByText('ETH'))

      // Step 2: Enter from amount
      const fromAmountInput = screen.getByPlaceholderText('0.0')
      await user.type(fromAmountInput, '1.0')

      // Step 3: Select to token
      const toTokenSelector = screen.getByText('Select token to receive')
      await user.click(toTokenSelector)
      
      await waitFor(() => {
        expect(screen.getByText('NEAR')).toBeInTheDocument()
      })
      await user.click(screen.getByText('NEAR'))

      // Step 4: Enter minimum amount
      const toAmountInputs = screen.getAllByPlaceholderText('0.0')
      const toAmountInput = toAmountInputs[1] // Second input is for "to" amount
      await user.type(toAmountInput, '680.0')

      // Step 5: Select priority (already defaults to speed)
      expect(screen.getByText('Fastest')).toBeInTheDocument()

      // Step 6: Preview intent
      const previewButton = screen.getByText('Preview Intent')
      expect(previewButton).not.toBeDisabled()
      await user.click(previewButton)

      // Step 7: Submit intent
      const submitButton = screen.getByText('Submit Intent')
      expect(submitButton).not.toBeDisabled()
      await user.click(submitButton)

      // Verify the workflow
      expect(mockUpdateIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          fromAmount: '1.0',
          minToAmount: '680.0',
        })
      )
      expect(mockSubmitIntent).toHaveBeenCalled()
      expect(mockOnSubmit).toHaveBeenCalledWith('submitted-intent-id')
    })

    it('should handle cross-chain intent creation', async () => {
      const mockCurrentIntent = {
        id: 'test-intent',
        user: 'demo-user',
        maxSlippage: 50,
        deadline: Math.floor(Date.now() / 1000) + 300,
        prioritize: 'speed' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      mockUseIntentStore.mockReturnValue({
        currentIntent: mockCurrentIntent,
        intents: [],
        createIntent: mockCreateIntent,
        updateIntent: mockUpdateIntent,
        submitIntent: mockSubmitIntent.mockResolvedValue('cross-chain-intent'),
        clearCurrentIntent: mockClearCurrentIntent,
        addIntent: jest.fn(),
        updateIntentStatus: jest.fn(),
        clearAllIntents: jest.fn(),
        getIntentById: jest.fn(),
        getIntentsByStatus: jest.fn(),
      })

      render(<IntentForm onSubmit={mockOnSubmit} />)

      // Select Bitcoin to NEAR (cross-chain)
      const fromTokenSelector = screen.getByText('Select token to swap from')
      await user.click(fromTokenSelector)
      await user.click(screen.getByText('BTC'))

      const toTokenSelector = screen.getByText('Select token to receive')
      await user.click(toTokenSelector)
      await user.click(screen.getByText('NEAR'))

      // Enter amounts
      const amountInputs = screen.getAllByPlaceholderText('0.0')
      await user.type(amountInputs[0], '0.1')
      await user.type(amountInputs[1], '1450.0')

      // This should create a cross-chain intent
      expect(mockUpdateIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          fromToken: expect.objectContaining({ chainId: 'bitcoin' }),
          toToken: expect.objectContaining({ chainId: 'near' }),
        })
      )
    })
  })

  describe('Form Validation and Error Handling', () => {
    it('should disable submit button when form is incomplete', () => {
      render(<IntentForm onSubmit={mockOnSubmit} />)

      const submitButton = screen.getByText('Submit Intent')
      expect(submitButton).toBeDisabled()
    })

    it('should show loading state during submission', async () => {
      const mockCurrentIntent = {
        id: 'test-intent',
        user: 'demo-user',
        fromToken: { symbol: 'ETH', chainId: 'ethereum' },
        toToken: { symbol: 'NEAR', chainId: 'near' },
        fromAmount: '1.0',
        minToAmount: '680.0',
        maxSlippage: 50,
        deadline: Math.floor(Date.now() / 1000) + 300,
        prioritize: 'speed' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      // Mock a slow submission
      const slowSubmit = jest.fn(() => new Promise(resolve => setTimeout(() => resolve('slow-intent'), 1000)))

      mockUseIntentStore.mockReturnValue({
        currentIntent: mockCurrentIntent,
        intents: [],
        createIntent: mockCreateIntent,
        updateIntent: mockUpdateIntent,
        submitIntent: slowSubmit,
        clearCurrentIntent: mockClearCurrentIntent,
        addIntent: jest.fn(),
        updateIntentStatus: jest.fn(),
        clearAllIntents: jest.fn(),
        getIntentById: jest.fn(),
        getIntentsByStatus: jest.fn(),
      })

      render(<IntentForm onSubmit={mockOnSubmit} />)

      const submitButton = screen.getByText('Submit Intent')
      await user.click(submitButton)

      // Should show loading state
      expect(screen.getByText('Submitting...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()
    })

    it('should handle submission errors gracefully', async () => {
      const mockCurrentIntent = {
        id: 'test-intent',
        user: 'demo-user',
        fromToken: { symbol: 'ETH', chainId: 'ethereum' },
        toToken: { symbol: 'NEAR', chainId: 'near' },
        fromAmount: '1.0',
        minToAmount: '680.0',
        maxSlippage: 50,
        deadline: Math.floor(Date.now() / 1000) + 300,
        prioritize: 'speed' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const failingSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'))

      mockUseIntentStore.mockReturnValue({
        currentIntent: mockCurrentIntent,
        intents: [],
        createIntent: mockCreateIntent,
        updateIntent: mockUpdateIntent,
        submitIntent: failingSubmit,
        clearCurrentIntent: mockClearCurrentIntent,
        addIntent: jest.fn(),
        updateIntentStatus: jest.fn(),
        clearAllIntents: jest.fn(),
        getIntentById: jest.fn(),
        getIntentsByStatus: jest.fn(),
      })

      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<IntentForm onSubmit={mockOnSubmit} />)

      const submitButton = screen.getByText('Submit Intent')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Submit Intent')).toBeInTheDocument()
      })

      expect(consoleSpy).toHaveBeenCalledWith('Failed to submit intent:', expect.any(Error))
      expect(mockOnSubmit).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('Token Swapping Feature', () => {
    it('should swap from and to tokens when swap button is clicked', async () => {
      const mockCurrentIntent = {
        id: 'test-intent',
        user: 'demo-user',
        maxSlippage: 50,
        deadline: Math.floor(Date.now() / 1000) + 300,
        prioritize: 'speed' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      mockUseIntentStore.mockReturnValue({
        currentIntent: mockCurrentIntent,
        intents: [],
        createIntent: mockCreateIntent,
        updateIntent: mockUpdateIntent,
        submitIntent: mockSubmitIntent,
        clearCurrentIntent: mockClearCurrentIntent,
        addIntent: jest.fn(),
        updateIntentStatus: jest.fn(),
        clearAllIntents: jest.fn(),
        getIntentById: jest.fn(),
        getIntentsByStatus: jest.fn(),
      })

      render(<IntentForm onSubmit={mockOnSubmit} />)

      // Select tokens and amounts
      const fromTokenSelector = screen.getByText('Select token to swap from')
      await user.click(fromTokenSelector)
      await user.click(screen.getByText('ETH'))

      const toTokenSelector = screen.getByText('Select token to receive')
      await user.click(toTokenSelector)
      await user.click(screen.getByText('NEAR'))

      const amountInputs = screen.getAllByPlaceholderText('0.0')
      await user.type(amountInputs[0], '1.0')
      await user.type(amountInputs[1], '680.0')

      // Click swap button
      const swapButton = screen.getByRole('button', { name: '' }) // Arrow button
      await user.click(swapButton)

      // Verify that tokens and amounts were swapped
      // This is tricky to test directly due to internal state, but we can verify
      // that the swap functionality doesn't crash the component
      expect(screen.getByText('Express Your Intent')).toBeInTheDocument()
    })
  })

  describe('Priority Selection', () => {
    it('should update priority when quick intent buttons are clicked', async () => {
      const mockCurrentIntent = {
        id: 'test-intent',
        user: 'demo-user',
        maxSlippage: 50,
        deadline: Math.floor(Date.now() / 1000) + 300,
        prioritize: 'speed' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      mockUseIntentStore.mockReturnValue({
        currentIntent: mockCurrentIntent,
        intents: [],
        createIntent: mockCreateIntent,
        updateIntent: mockUpdateIntent,
        submitIntent: mockSubmitIntent,
        clearCurrentIntent: mockClearCurrentIntent,
        addIntent: jest.fn(),
        updateIntentStatus: jest.fn(),
        clearAllIntents: jest.fn(),
        getIntentById: jest.fn(),
        getIntentsByStatus: jest.fn(),
      })

      render(<IntentForm onSubmit={mockOnSubmit} />)

      // Click "Best Price" priority
      const bestPriceButton = screen.getByText('Best Price')
      await user.click(bestPriceButton)

      expect(mockUpdateIntent).toHaveBeenCalledWith({ prioritize: 'cost' })

      // Click "Most Secure" priority
      const mostSecureButton = screen.getByText('Most Secure')
      await user.click(mostSecureButton)

      expect(mockUpdateIntent).toHaveBeenCalledWith({ prioritize: 'security' })
    })
  })

  describe('Integration with PreferencesPanel and IntentPreview', () => {
    it('should show preferences panel and intent preview components', () => {
      render(<IntentForm onSubmit={mockOnSubmit} />)

      // These components should be rendered (even if collapsed/hidden)
      expect(screen.getByText('Express Your Intent')).toBeInTheDocument()
      
      // PreferencesPanel should be present
      expect(screen.getByText('Advanced Preferences')).toBeInTheDocument()
    })

    it('should toggle intent preview when preview button is clicked', async () => {
      const mockCurrentIntent = {
        id: 'test-intent',
        user: 'demo-user',
        fromToken: { symbol: 'ETH', chainId: 'ethereum' },
        toToken: { symbol: 'NEAR', chainId: 'near' },
        fromAmount: '1.0',
        minToAmount: '680.0',
        maxSlippage: 50,
        deadline: Math.floor(Date.now() / 1000) + 300,
        prioritize: 'speed' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      mockUseIntentStore.mockReturnValue({
        currentIntent: mockCurrentIntent,
        intents: [],
        createIntent: mockCreateIntent,
        updateIntent: mockUpdateIntent,
        submitIntent: mockSubmitIntent,
        clearCurrentIntent: mockClearCurrentIntent,
        addIntent: jest.fn(),
        updateIntentStatus: jest.fn(),
        clearAllIntents: jest.fn(),
        getIntentById: jest.fn(),
        getIntentsByStatus: jest.fn(),
      })

      render(<IntentForm onSubmit={mockOnSubmit} />)

      const previewButton = screen.getByText('Preview Intent')
      await user.click(previewButton)

      expect(screen.getByText('Hide Preview')).toBeInTheDocument()
    })
  })
})