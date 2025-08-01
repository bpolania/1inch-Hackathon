/**
 * Wallet Store Tests - Unit tests for NEAR wallet functionality
 */

import { useWalletStore } from '../walletStore'
import { WalletSelector } from '@near-wallet-selector/core'

// Mock NEAR wallet selector
jest.mock('@near-wallet-selector/core', () => ({
  setupWalletSelector: jest.fn()
}))

jest.mock('@near-wallet-selector/my-near-wallet', () => ({
  setupMyNearWallet: jest.fn(() => 'mock-my-near-wallet')
}))

jest.mock('@near-wallet-selector/modal-ui', () => ({
  setupModal: jest.fn(() => ({
    show: jest.fn(),
    hide: jest.fn()
  }))
}))

jest.mock('near-api-js', () => ({
  providers: {
    JsonRpcProvider: jest.fn(() => ({
      query: jest.fn()
    }))
  },
  utils: {
    format: {
      formatNearAmount: jest.fn((amount, decimals) => `${amount}_formatted`),
      parseNearAmount: jest.fn((amount) => `${amount}_parsed`)
    }
  }
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

// Mock wallet selector instance
const mockWalletSelector = {
  store: {
    observable: {
      subscribe: jest.fn()
    }
  },
  wallet: jest.fn(),
  getAccounts: jest.fn()
} as unknown as WalletSelector

describe('Wallet Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset store state directly
    useWalletStore.setState({
      isConnected: false,
      isConnecting: false,
      accountId: null,
      account: null,
      balance: null,
      balanceFormatted: null,
      wallet: null,
      selector: null,
      networkId: 'testnet'
    })
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useWalletStore.getState()
      
      expect(store.isConnected).toBe(false)
      expect(store.isConnecting).toBe(false)
      expect(store.accountId).toBeNull()
      expect(store.account).toBeNull()
      expect(store.balance).toBeNull()
      expect(store.balanceFormatted).toBeNull()
      expect(store.wallet).toBeNull()
      expect(store.networkId).toBe('testnet')
    })
  })

  describe('Connection Management', () => {
    it('should handle wallet connection flow', async () => {
      const { setupWalletSelector } = require('@near-wallet-selector/core')
      const { setupModal } = require('@near-wallet-selector/modal-ui')
      
      const mockModal = { show: jest.fn() }
      setupModal.mockReturnValue(mockModal)
      setupWalletSelector.mockResolvedValue(mockWalletSelector)
      
      const store = useWalletStore.getState()
      
      // Test connection initiation
      await store.connect()
      
      expect(setupWalletSelector).toHaveBeenCalledWith({
        network: expect.objectContaining({
          networkId: 'testnet'
        }),
        modules: expect.any(Array)
      })
      expect(mockModal.show).toHaveBeenCalled()
    })

    it('should handle connection errors gracefully', async () => {
      const { setupWalletSelector } = require('@near-wallet-selector/core')
      setupWalletSelector.mockRejectedValue(new Error('Connection failed'))
      
      const store = useWalletStore.getState()
      
      await expect(store.connect()).rejects.toThrow('Connection failed')
      expect(store.isConnecting).toBe(false)
    })

    it('should disconnect wallet properly', async () => {
      const mockWallet = {
        signOut: jest.fn().mockResolvedValue(undefined)
      }
      
      // Simulate connected state
      useWalletStore.setState({
        isConnected: true,
        accountId: 'test.near',
        wallet: mockWallet as any,
        balance: '1000000000000000000000000',
        balanceFormatted: '1.0'
      })
      
      const store = useWalletStore.getState()
      await store.disconnect()
      
      expect(mockWallet.signOut).toHaveBeenCalled()
      
      // Get updated store state after disconnect
      const updatedStore = useWalletStore.getState()
      expect(updatedStore.isConnected).toBe(false)
      expect(updatedStore.accountId).toBeNull()
      expect(updatedStore.wallet).toBeNull()
      expect(updatedStore.balance).toBeNull()
      expect(updatedStore.balanceFormatted).toBeNull()
    })

    it('should handle disconnect errors gracefully', async () => {
      const mockWallet = {
        signOut: jest.fn().mockRejectedValue(new Error('Disconnect failed'))
      }
      
      useWalletStore.setState({
        isConnected: true,
        wallet: mockWallet as any
      })
      
      const store = useWalletStore.getState()
      
      try {
        await store.disconnect()
        fail('Expected disconnect to throw error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Disconnect failed')
      }
    })
  })

  describe('Account Operations', () => {
    beforeEach(() => {
      // Set up connected state
      useWalletStore.setState({
        isConnected: true,
        accountId: 'test.near',
        networkId: 'testnet',
        selector: mockWalletSelector
      })
    })

    it('should refresh account information', async () => {
      const { providers } = require('near-api-js')
      const mockProvider = {
        query: jest.fn().mockResolvedValue({
          amount: '1000000000000000000000000',
          locked: '0',
          storage_usage: 100000
        })
      }
      providers.JsonRpcProvider.mockReturnValue(mockProvider)
      
      const store = useWalletStore.getState()
      await store.refreshAccount()
      
      expect(mockProvider.query).toHaveBeenCalledWith({
        request_type: 'view_account',
        finality: 'final',
        account_id: 'test.near'
      })
    })

    it('should refresh balance correctly', async () => {
      const { providers, utils } = require('near-api-js')
      const mockProvider = {
        query: jest.fn().mockResolvedValue({
          amount: '1000000000000000000000000'
        })
      }
      providers.JsonRpcProvider.mockReturnValue(mockProvider)
      utils.format.formatNearAmount.mockReturnValue('1.00')
      
      const store = useWalletStore.getState()
      await store.refreshBalance()
      
      // Get updated store state after refresh
      const updatedStore = useWalletStore.getState()
      expect(updatedStore.balance).toBe('1000000000000000000000000')
      expect(updatedStore.balanceFormatted).toBe('1.00')
      expect(utils.format.formatNearAmount).toHaveBeenCalledWith('1000000000000000000000000', 2)
    })

    it('should handle account refresh errors', async () => {
      const { providers } = require('near-api-js')
      const mockProvider = {
        query: jest.fn().mockRejectedValue(new Error('Network error'))
      }
      providers.JsonRpcProvider.mockReturnValue(mockProvider)
      
      const store = useWalletStore.getState()
      
      // Should not throw, just log error
      await expect(store.refreshAccount()).resolves.toBeUndefined()
    })
  })

  describe('Transaction Operations', () => {
    const mockWallet = {
      signAndSendTransaction: jest.fn(),
      signAndSendTransactions: jest.fn()
    }

    beforeEach(() => {
      useWalletStore.setState({
        isConnected: true,
        wallet: mockWallet as any
      })
    })

    it('should sign and send single transaction', async () => {
      const mockActions = [{ type: 'FunctionCall' }]
      const mockResult = { transaction: { hash: 'test-hash' } }
      
      mockWallet.signAndSendTransaction.mockResolvedValue(mockResult)
      
      const store = useWalletStore.getState()
      const result = await store.signAndSendTransaction(mockActions, 'intents.testnet')
      
      expect(mockWallet.signAndSendTransaction).toHaveBeenCalledWith({
        receiverId: 'intents.testnet',
        actions: mockActions
      })
      expect(result).toEqual(mockResult)
    })

    it('should sign and send multiple transactions', async () => {
      const mockTransactions = [
        { receiverId: 'contract1.near', actions: [] },
        { receiverId: 'contract2.near', actions: [] }
      ]
      const mockResult = { success: true }
      
      mockWallet.signAndSendTransactions.mockResolvedValue(mockResult)
      
      const store = useWalletStore.getState()
      const result = await store.signAndSendTransactions(mockTransactions)
      
      expect(mockWallet.signAndSendTransactions).toHaveBeenCalledWith({
        transactions: mockTransactions
      })
      expect(result).toEqual(mockResult)
    })

    it('should throw error when wallet not connected', async () => {
      useWalletStore.setState({ isConnected: false, wallet: null })
      
      const store = useWalletStore.getState()
      
      await expect(store.signAndSendTransaction([])).rejects.toThrow('Wallet not connected')
      await expect(store.signAndSendTransactions([])).rejects.toThrow('Wallet not connected')
    })

    it('should handle transaction errors', async () => {
      mockWallet.signAndSendTransaction.mockRejectedValue(new Error('Transaction failed'))
      
      const store = useWalletStore.getState()
      
      await expect(store.signAndSendTransaction([], 'intents.testnet')).rejects.toThrow('Transaction failed')
    })
  })

  describe('Network Operations', () => {
    it('should switch network correctly', async () => {
      const { setupWalletSelector } = require('@near-wallet-selector/core')
      setupWalletSelector.mockResolvedValue(mockWalletSelector)
      
      const store = useWalletStore.getState()
      
      await store.switchNetwork('mainnet')
      
      // Get updated store state after network switch
      const updatedStore = useWalletStore.getState()
      expect(updatedStore.networkId).toBe('mainnet')
    })

    it('should reinitialize selector when switching networks', async () => {
      const { setupWalletSelector } = require('@near-wallet-selector/core')
      setupWalletSelector.mockResolvedValue(mockWalletSelector)
      
      const store = useWalletStore.getState()
      
      await store.switchNetwork('mainnet')
      
      expect(setupWalletSelector).toHaveBeenCalledWith(
        expect.objectContaining({ 
          network: expect.objectContaining({
            networkId: 'mainnet'
          })
        })
      )
    })
  })

  describe('Observable State Management', () => {
    it('should handle wallet selector state changes', async () => {
      const { setupWalletSelector } = require('@near-wallet-selector/core')
      
      let subscriptionCallback: any
      const mockSelector = {
        ...mockWalletSelector,
        store: {
          observable: {
            subscribe: jest.fn((callback) => {
              subscriptionCallback = callback
            })
          }
        },
        wallet: jest.fn().mockResolvedValue({
          id: 'my-near-wallet',
          signOut: jest.fn()
        })
      }
      
      setupWalletSelector.mockResolvedValue(mockSelector)
      
      // Initialize selector
      const store = useWalletStore.getState()
      await store.initializeSelector()
      
      expect(mockSelector.store.observable.subscribe).toHaveBeenCalled()
      
      // Simulate account connection
      await subscriptionCallback({
        accounts: [{ accountId: 'test.near' }]
      })
      
      const updatedStore = useWalletStore.getState()
      expect(updatedStore.isConnected).toBe(true)
      expect(updatedStore.accountId).toBe('test.near')
    })

    it('should handle account disconnection', async () => {
      const { setupWalletSelector } = require('@near-wallet-selector/core')
      
      let subscriptionCallback: any
      const mockSelector = {
        ...mockWalletSelector,
        store: {
          observable: {
            subscribe: jest.fn((callback) => {
              subscriptionCallback = callback
            })
          }
        }
      }
      
      setupWalletSelector.mockResolvedValue(mockSelector)
      
      // Set connected state first
      useWalletStore.setState({
        isConnected: true,
        accountId: 'test.near',
        wallet: {} as any
      })
      
      const store = useWalletStore.getState()
      await store.initializeSelector()
      
      // Simulate account disconnection
      await subscriptionCallback({ accounts: [] })
      
      const updatedStore = useWalletStore.getState()
      expect(updatedStore.isConnected).toBe(false)
      expect(updatedStore.accountId).toBeNull()
      expect(updatedStore.wallet).toBeNull()
    })
  })

  describe('Switch Account', () => {
    it('should sign out and reconnect for account switching', async () => {
      const mockWallet = {
        signOut: jest.fn().mockResolvedValue(undefined)
      }
      
      useWalletStore.setState({
        isConnected: true,
        wallet: mockWallet as any
      })
      
      const store = useWalletStore.getState()
      
      // Mock the connect method
      store.connect = jest.fn().mockResolvedValue(undefined)
      
      await store.switchAccount()
      
      expect(mockWallet.signOut).toHaveBeenCalled()
      expect(store.connect).toHaveBeenCalled()
    })
  })
})