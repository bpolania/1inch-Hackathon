/**
 * WalletButton Tests - Integration tests for wallet connection UI
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { WalletButton, WalletButtonCompact, WalletCard } from '../WalletButton'
import { useWalletStore } from '@/stores/walletStore'
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()

// Mock the wallet store
jest.mock('@/stores/walletStore')
const mockUseWalletStore = useWalletStore as jest.MockedFunction<typeof useWalletStore>

// Mock icons
jest.mock('lucide-react', () => ({
  Wallet: () => <div data-testid="wallet-icon" />,
  LogOut: () => <div data-testid="logout-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  Network: () => <div data-testid="network-icon" />,
}))

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, title, size, variant }: any) => 
    <button onClick={onClick} disabled={disabled} className={className} title={title}>
      {children}
    </button>,
}))

describe('WalletButton', () => {
  const mockWalletActions = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    refreshBalance: jest.fn(),
    refreshAccount: jest.fn(),
    switchAccount: jest.fn(),
    signAndSendTransaction: jest.fn(),
    signAndSendTransactions: jest.fn(),
    switchNetwork: jest.fn(),
    initializeSelector: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Not Connected State', () => {
    beforeEach(() => {
      mockUseWalletStore.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        accountId: null,
        account: null,
        balance: null,
        balanceFormatted: null,
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })
    })

    it('should show connect wallet button when not connected', () => {
      render(<WalletButton />)
      
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
      expect(screen.getByTestId('wallet-icon')).toBeInTheDocument()
    })

    it('should call connect when connect button is clicked', async () => {
      render(<WalletButton />)
      
      const connectButton = screen.getByRole('button', { name: /connect wallet/i })
      
      await act(async () => {
        await user.click(connectButton)
      })
      
      expect(mockWalletActions.connect).toHaveBeenCalled()
    })

    it('should show connecting state', () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: false,
        isConnecting: true,
        accountId: null,
        account: null,
        balance: null,
        balanceFormatted: null,
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      render(<WalletButton />)
      
      expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument()
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('Connected State', () => {
    const mockConnectedState = {
      isConnected: true,
      isConnecting: false,
      accountId: 'test.near',
      account: {
        amount: '1000000000000000000000000',
        locked: '0',
        storage_usage: 100000
      },
      balance: '1000000000000000000000000',
      balanceFormatted: '1.00',
      selector: {} as any,
      wallet: {} as any,
      networkId: 'testnet' as const,
      ...mockWalletActions
    }

    beforeEach(() => {
      mockUseWalletStore.mockReturnValue(mockConnectedState)
    })

    it('should show connected wallet information', () => {
      render(<WalletButton />)
      
      expect(screen.getByText('test.near')).toBeInTheDocument()
      expect(screen.getByText('1 NEAR')).toBeInTheDocument()
      expect(screen.getByText('testnet')).toBeInTheDocument()
      expect(screen.getByTestId('wallet-icon')).toBeInTheDocument()
    })

    it('should truncate long account names', () => {
      mockUseWalletStore.mockReturnValue({
        ...mockConnectedState,
        accountId: 'very-long-account-name-that-should-be-truncated.near'
      })

      render(<WalletButton />)
      
      expect(screen.getByText('very-long-accoun...near')).toBeInTheDocument()
    })

    it('should show mainnet badge when connected to mainnet', () => {
      mockUseWalletStore.mockReturnValue({
        ...mockConnectedState,
        networkId: 'mainnet'
      })

      render(<WalletButton />)
      
      expect(screen.getByText('mainnet')).toBeInTheDocument()
    })

    it('should call disconnect when logout button is clicked', async () => {
      render(<WalletButton />)
      
      const logoutButton = screen.getByRole('button', { name: /disconnect wallet/i })
      
      await act(async () => {
        await user.click(logoutButton)
      })
      
      expect(mockWalletActions.disconnect).toHaveBeenCalled()
    })

    it('should call refreshBalance when refresh button is clicked', async () => {
      render(<WalletButton />)
      
      const refreshButton = screen.getByRole('button', { name: /refresh balance/i })
      
      await act(async () => {
        await user.click(refreshButton)
      })
      
      expect(mockWalletActions.refreshBalance).toHaveBeenCalled()
    })

    it('should handle missing balance gracefully', () => {
      mockUseWalletStore.mockReturnValue({
        ...mockConnectedState,
        balance: null,
        balanceFormatted: null
      })

      render(<WalletButton />)
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('Size Variants', () => {
    const mockConnectedState = {
      isConnected: true,
      isConnecting: false,
      accountId: 'test.near',
      account: null,
      balance: '1000000000000000000000000',
      balanceFormatted: '1.00',
      selector: null,
      wallet: null,
      networkId: 'testnet' as const,
      ...mockWalletActions
    }

    it('should render compact version for small size', () => {
      mockUseWalletStore.mockReturnValue(mockConnectedState)

      render(<WalletButton size="sm" />)
      
      // Should show truncated account name
      expect(screen.getByText('test.near')).toBeInTheDocument()
      
      // Should not show balance for small size
      expect(screen.queryByText('1 NEAR')).not.toBeInTheDocument()
    })

    it('should render full card for large size', () => {
      mockUseWalletStore.mockReturnValue(mockConnectedState)

      render(<WalletButton size="lg" />)
      
      expect(screen.getByText('test.near')).toBeInTheDocument()
      expect(screen.getByText('1 NEAR')).toBeInTheDocument()
      expect(screen.getByText('testnet')).toBeInTheDocument()
    })
  })

  describe('WalletButtonCompact', () => {
    it('should render compact wallet button', () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        accountId: null,
        account: null,
        balance: null,
        balanceFormatted: null,
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      render(<WalletButtonCompact />)
      
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
    })
  })

  describe('WalletCard', () => {
    it('should render full wallet card', () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        accountId: 'test.near',
        account: null,
        balance: '1000000000000000000000000',
        balanceFormatted: '1.00',
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      render(<WalletCard />)
      
      expect(screen.getByText('test.near')).toBeInTheDocument()
      expect(screen.getByText('1 NEAR')).toBeInTheDocument()
      expect(screen.getByText('testnet')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseWalletStore.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        accountId: null,
        account: null,
        balance: null,
        balanceFormatted: null,
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })
    })

    it('should handle connect error gracefully', async () => {
      mockWalletActions.connect.mockRejectedValue(new Error('Connection failed'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      render(<WalletButton />)
      
      const connectButton = screen.getByRole('button', { name: /connect wallet/i })
      
      await act(async () => {
        await user.click(connectButton)
      })
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to connect wallet:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })

    it('should handle disconnect error gracefully', async () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        accountId: 'test.near',
        account: null,
        balance: '1000000000000000000000000',
        balanceFormatted: '1.00',
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      mockWalletActions.disconnect.mockRejectedValue(new Error('Disconnect failed'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      render(<WalletButton />)
      
      const logoutButton = screen.getByRole('button', { name: /disconnect wallet/i })
      
      await act(async () => {
        await user.click(logoutButton)
      })
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to disconnect wallet:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })

    it('should handle refresh error gracefully', async () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        accountId: 'test.near',
        account: null,
        balance: '1000000000000000000000000',
        balanceFormatted: '1.00',
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      mockWalletActions.refreshBalance.mockRejectedValue(new Error('Refresh failed'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      render(<WalletButton />)
      
      const refreshButton = screen.getByRole('button', { name: /refresh balance/i })
      
      await act(async () => {
        await user.click(refreshButton)
      })
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh balance:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles and labels', () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        accountId: null,
        account: null,
        balance: null,
        balanceFormatted: null,
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      render(<WalletButton />)
      
      const button = screen.getByRole('button', { name: /connect wallet/i })
      expect(button).toBeInTheDocument()
    })

    it('should have proper titles for icon buttons', () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        accountId: 'test.near',
        account: null,
        balance: '1000000000000000000000000',
        balanceFormatted: '1.00',
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      render(<WalletButton />)
      
      expect(screen.getByRole('button', { name: /disconnect wallet/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh balance/i })).toBeInTheDocument()
    })
  })
})