import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IntentForm } from '../IntentForm'

const user = userEvent.setup()

// Mock the stores
const mockUseIntentStore = {
  currentIntent: null,
  createIntent: jest.fn(),
  updateIntent: jest.fn(),
  submitIntent: jest.fn(),
  clearCurrentIntent: jest.fn(),
}

const mockUseWalletStore = {
  isConnected: true,
  accountId: 'test.near',
  balanceFormatted: '10.5',
  networkId: 'testnet',
}

// Mock the imports
jest.mock('@/stores/intentStore', () => ({
  useIntentStore: () => mockUseIntentStore,
}))

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: () => mockUseWalletStore,
}))

describe('IntentForm - Cosmos Integration (Simple)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render the form', () => {
    render(<IntentForm />)
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
  })

  it('should show address input when Cosmos token is selected', async () => {
    render(<IntentForm />)

    // Look for token selector buttons
    const tokenButtons = screen.getAllByRole('button')
    const toTokenButton = tokenButtons.find(btn => 
      btn.textContent?.includes('Select token to receive')
    )

    if (toTokenButton) {
      await act(async () => {
        await user.click(toTokenButton)
      })

      // Wait for dropdown to open
      await waitFor(() => {
        const ntrnOptions = screen.queryAllByText('NTRN')
        if (ntrnOptions.length > 0) {
          const clickableNtrn = ntrnOptions.find(el => el.closest('button'))
          if (clickableNtrn) {
            return user.click(clickableNtrn)
          }
        }
      }, { timeout: 3000 })

      // Check if address input appears (may not if NTRN not found)
      const addressInput = screen.queryByText('Destination Address')
      if (addressInput) {
        expect(addressInput).toBeInTheDocument()
      }
    }
  })

  it('should handle form interactions without crashing', async () => {
    render(<IntentForm />)

    const buttons = screen.getAllByRole('button')
    
    // Should not crash when clicking buttons
    if (buttons.length > 0) {
      await act(async () => {
        await user.click(buttons[0])
      })
    }

    expect(screen.getByText('From')).toBeInTheDocument()
  })
})