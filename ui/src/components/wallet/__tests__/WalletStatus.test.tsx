/**
 * WalletStatus Tests - Integration tests for wallet status display
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { WalletStatus, WalletStatusIndicator } from '../WalletStatus'
import { useWalletStore } from '@/stores/walletStore'
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()

// Mock the wallet store
jest.mock('@/stores/walletStore')
const mockUseWalletStore = useWalletStore as jest.MockedFunction<typeof useWalletStore>

// Mock icons
jest.mock('lucide-react', () => ({
  Wallet: () => <div data-testid="wallet-icon" />,
  AlertCircle: () => <div data-testid="alert-icon" />,
  CheckCircle: () => <div data-testid="check-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
  Network: () => <div data-testid="network-icon" />,
}))

// Mock utils
jest.mock('@/utils/utils', () => ({
  formatTokenAmount: (amount: string) => amount
}))

// Mock window.open
Object.defineProperty(window, 'open', {
  value: jest.fn(),
})

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, title }: any) => 
    <button onClick={onClick} disabled={disabled} className={className} title={title}>
      {children}
    </button>,
}))

describe('WalletStatus', () => {
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

    it('should show connection required message', () => {
      render(<WalletStatus />)
      
      expect(screen.getByText('Wallet Connection Required')).toBeInTheDocument()
      expect(screen.getByText('Connect your NEAR wallet to create intents')).toBeInTheDocument()
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
    })

    it('should show connect button and call connect on click', async () => {
      render(<WalletStatus />)
      
      const connectButton = screen.getByRole('button', { name: /connect wallet/i })
      expect(connectButton).toBeInTheDocument()
      
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

      render(<WalletStatus />)
      
      expect(screen.getByText('Connecting...')).toBeInTheDocument()
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

    it('should show wallet connected status', () => {
      render(<WalletStatus />)
      
      expect(screen.getByText('Wallet Connected')).toBeInTheDocument()
      expect(screen.getByTestId('check-icon')).toBeInTheDocument()
      expect(screen.getByText('testnet')).toBeInTheDocument()
      expect(screen.getByTestId('network-icon')).toBeInTheDocument()
    })

    it('should display account information', () => {
      render(<WalletStatus />)
      
      expect(screen.getByText('Account')).toBeInTheDocument()
      expect(screen.getByText('test.near')).toBeInTheDocument()
      expect(screen.getByTestId('external-link-icon')).toBeInTheDocument()
    })

    it('should display balance information', () => {
      render(<WalletStatus />)
      
      expect(screen.getByText('NEAR Balance')).toBeInTheDocument()
      expect(screen.getByText('1.00 NEAR')).toBeInTheDocument()
    })

    it('should call refreshBalance when refresh button is clicked', async () => {
      render(<WalletStatus />)
      
      const refreshButtons = screen.getAllByTitle('Refresh balance')
      expect(refreshButtons).toHaveLength(1)
      
      await act(async () => {
        await user.click(refreshButtons[0])
      })
      
      expect(mockWalletActions.refreshBalance).toHaveBeenCalled()
    })

    it('should open NEAR explorer when external link is clicked', async () => {
      const mockOpen = jest.fn()
      window.open = mockOpen

      render(<WalletStatus />)
      
      const explorerButton = screen.getByTitle('View on NEAR Explorer')
      
      await act(async () => {
        await user.click(explorerButton)
      })
      
      expect(mockOpen).toHaveBeenCalledWith(
        'https://testnet.nearblocks.io/address/test.near',
        '_blank'
      )
    })

    it('should show mainnet badge when connected to mainnet', () => {
      mockUseWalletStore.mockReturnValue({
        ...mockConnectedState,
        networkId: 'mainnet'
      })

      render(<WalletStatus />)
      
      expect(screen.getByText('mainnet')).toBeInTheDocument()
    })

    it('should show loading when balance is not available', () => {
      mockUseWalletStore.mockReturnValue({
        ...mockConnectedState,
        balance: null,
        balanceFormatted: null
      })

      render(<WalletStatus />)
      
      expect(screen.getByText('Loading... NEAR')).toBeInTheDocument()
    })
  })

  describe('Balance Warnings', () => {
    it('should show insufficient balance warning', () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        accountId: 'test.near',
        account: null,
        balance: '50000000000000000000000', // 0.05 NEAR
        balanceFormatted: '0.05',
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      render(<WalletStatus requiredBalance="0.1" />)
      
      expect(screen.getByText(/You need at least 0.1 NEAR to create intents/)).toBeInTheDocument()
    })

    it('should show testnet faucet link for testnet', () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        accountId: 'test.near',
        account: null,
        balance: '50000000000000000000000', // 0.05 NEAR
        balanceFormatted: '0.05',
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      render(<WalletStatus />)
      
      expect(screen.getByText('Get testnet NEAR from faucet')).toBeInTheDocument()
    })

    it('should not show faucet link for mainnet', () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        accountId: 'test.near',
        account: null,
        balance: '50000000000000000000000', // 0.05 NEAR
        balanceFormatted: '0.05',
        selector: null,
        wallet: null,
        networkId: 'mainnet',
        ...mockWalletActions
      })

      render(<WalletStatus />)
      
      expect(screen.queryByText('Get testnet NEAR from faucet')).not.toBeInTheDocument()
    })

    it('should show testnet warning', () => {
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

      render(<WalletStatus />)
      
      expect(screen.getByText(/You're connected to NEAR testnet/)).toBeInTheDocument()
    })
  })

  describe('Full Details Mode', () => {
    beforeEach(() => {
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
    })

    it('should show additional details when requested', () => {
      render(<WalletStatus showFullDetails={true} />)
      
      expect(screen.getByText('Network')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('should not show additional details by default', () => {
      render(<WalletStatus showFullDetails={false} />)
      
      expect(screen.queryByText('Status')).not.toBeInTheDocument()
    })
  })

  describe('Custom Props', () => {
    it('should apply custom className', () => {
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

      const { container } = render(<WalletStatus className="custom-class" />)
      
      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should use custom required balance', () => {
      mockUseWalletStore.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        accountId: 'test.near',
        account: null,
        balance: '200000000000000000000000', // 0.2 NEAR
        balanceFormatted: '0.2',
        selector: null,
        wallet: null,
        networkId: 'testnet',
        ...mockWalletActions
      })

      render(<WalletStatus requiredBalance="0.5" />)
      
      expect(screen.getByText(/You need at least 0.5 NEAR/)).toBeInTheDocument()
    })
  })
})

describe('WalletStatusIndicator', () => {
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

  it('should show not connected indicator', () => {
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

    render(<WalletStatusIndicator />)
    
    expect(screen.getByText('Wallet not connected')).toBeInTheDocument()
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
  })

  it('should show connected indicator with truncated account', () => {
    mockUseWalletStore.mockReturnValue({
      isConnected: true,
      isConnecting: false,
      accountId: 'very-long-account-name.near',
      account: null,
      balance: null,
      balanceFormatted: null,
      selector: null,
      wallet: null,
      networkId: 'mainnet',
      ...mockWalletActions
    })

    render(<WalletStatusIndicator />)
    
    expect(screen.getByText(/Connected to very-lon.*near.*mainnet/)).toBeInTheDocument()
    expect(screen.getByTestId('check-icon')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
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

    const { container } = render(<WalletStatusIndicator className="custom-indicator" />)
    
    expect(container.firstChild).toHaveClass('custom-indicator')
  })
})