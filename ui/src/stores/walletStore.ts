/**
 * Wallet Store - Manages NEAR wallet connections and account state
 */

import { create } from 'zustand'
import { setupWalletSelector } from '@near-wallet-selector/core'
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet'
import { setupHereWallet } from '@near-wallet-selector/here-wallet'
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet'
import { setupSender } from '@near-wallet-selector/sender'
import { setupMathWallet } from '@near-wallet-selector/math-wallet'
import { setupNightly } from '@near-wallet-selector/nightly'
import { setupLedger } from '@near-wallet-selector/ledger'
import { setupWalletConnect } from '@near-wallet-selector/wallet-connect'
import { setupModal } from '@near-wallet-selector/modal-ui'
import { providers, utils } from 'near-api-js'
import type { WalletStore, WalletConfig, NEARBalance } from '@/types/wallet'

// Default configuration
const DEFAULT_CONFIG: WalletConfig = {
  networkId: 'testnet', // Start with testnet for development
  contractId: undefined, // No specific contract required for basic wallet connection
  methodNames: [] // No specific methods required for basic wallet connection
}

// RPC endpoint configuration with fallbacks
const RPC_ENDPOINTS = {
  mainnet: [
    'https://rpc.mainnet.near.org',
    'https://near-mainnet.lava.build',
    'https://endpoints.omniatech.io/v1/near/mainnet/public',
  ],
  testnet: [
    'https://rpc.testnet.near.org',
    'https://near-testnet.lava.build', 
    'https://endpoints.omniatech.io/v1/near/testnet/public',
  ]
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  // Initial state
  isConnected: false,
  isConnecting: false,
  accountId: null,
  account: null,
  balance: null,
  balanceFormatted: null,
  selector: null,
  wallet: null,
  networkId: DEFAULT_CONFIG.networkId,

  // Connection management
  connect: async () => {
    try {
      console.log('🔄 Starting wallet connection...')
      set({ isConnecting: true })
      const state = get()
      
      // Initialize wallet selector if not already done
      if (!state.selector) {
        console.log('🔧 Initializing wallet selector...')
        await get().initializeSelector()
      }
      
      const selector = get().selector
      if (!selector) {
        throw new Error('Wallet selector not initialized')
      }

      console.log('📱 Opening wallet selection modal...')
      
      // Ensure we're on the client side
      if (typeof window === 'undefined') {
        throw new Error('Wallet connection can only be initiated on the client side')
      }
      
      // Show wallet selection modal
      try {
        console.log('🔧 Creating modal with selector:', selector)
        const modal = setupModal(selector, {
          contractId: 'wrap.testnet', // Use a known testnet contract for modal setup
          theme: 'auto'
        })
        
        console.log('🔧 Modal object created:', modal)
        console.log('🔧 Modal methods available:', Object.keys(modal))
        
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          console.log('🔧 Calling modal.show() after delay...')
          modal.show()
          console.log('✅ Modal.show() called successfully')
          
          // Check if modal is actually in DOM
          setTimeout(() => {
            const modalElement = document.querySelector('.near-wallet-selector-modal')
            const modalRoot = document.getElementById('near-wallet-selector-modal')
            console.log('🔍 Modal in DOM:', modalElement ? 'YES' : 'NO')
            console.log('🔍 Modal root div:', modalRoot ? 'YES' : 'NO')
            if (modalElement) {
              console.log('🎨 Modal style:', window.getComputedStyle(modalElement).display)
              console.log('🎨 Modal parent:', modalElement.parentElement)
            }
            
            // Try to find any wallet selector related elements
            const allModals = document.querySelectorAll('[class*="wallet"]')
            console.log('🔍 All wallet-related elements:', allModals.length)
            
            // Check for the main modal container
            const modalContainer = document.querySelector('.nws-modal')
            const modalOverlay = document.querySelector('.nws-modal-overlay')
            const modalWrapper = document.querySelector('.nws-modal-wrapper')
            
            console.log('🔍 Modal container:', modalContainer ? 'YES' : 'NO')
            console.log('🔍 Modal overlay:', modalOverlay ? 'YES' : 'NO') 
            console.log('🔍 Modal wrapper:', modalWrapper ? 'YES' : 'NO')
            
            if (modalContainer) {
              const style = window.getComputedStyle(modalContainer)
              console.log('🎨 Modal container styles:', {
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                zIndex: style.zIndex,
                position: style.position
              })
              
              // Log modal state without forcing styles
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                console.log('🔧 Modal appears to be hidden by CSS')
              } else {
                console.log('✅ Modal appears to be visible')
              }
            }
            
            allModals.forEach((el, i) => {
              console.log(`🔍 Element ${i}:`, el.className, el.tagName)
            })
            
            // Look for the actual modal container with more specific selectors
            const possibleModals = [
              document.querySelector('[class*="nws"]'),
              document.querySelector('[class*="near-wallet-selector"]'),
              document.querySelector('[class*="modal"]'),
              document.querySelector('div[role="dialog"]'),
              document.querySelector('[aria-modal="true"]')
            ].filter(Boolean)
            
            console.log('🔍 Found modal containers:', possibleModals.length)
            possibleModals.forEach((modal, i) => {
              if (modal) {
                console.log(`🔍 Modal ${i}:`, modal.className, modal.tagName)
                const style = window.getComputedStyle(modal)
                console.log(`🎨 Modal ${i} styles:`, {
                  position: style.position,
                  display: style.display,
                  zIndex: style.zIndex,
                  background: style.backgroundColor
                })
                
                // Just log the modal state - let CSS handle positioning
                if (style.position !== 'fixed') {
                  console.log('🔧 Modal position will be fixed by CSS:', modal.className)
                } else {
                  console.log('✅ Modal positioned correctly')
                }
              }
            })
          }, 100)
        }, 50)
        
      } catch (modalError) {
        console.error('❌ Failed to create or show modal:', modalError)
        throw modalError
      }
      
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error)
      set({ isConnecting: false })
      
      // Provide user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('account') && error.message.includes('exist')) {
          alert('❌ Account not found. Please make sure you have a NEAR testnet account created.')
        } else if (error.message.includes('network')) {
          alert('❌ Network error. Please check your connection and try again.')
        } else {
          alert(`❌ Connection failed: ${error.message}`)
        }
      } else {
        alert('❌ Unknown connection error occurred.')
      }
      
      throw error
    }
  },

  disconnect: async () => {
    try {
      const { wallet } = get()
      if (wallet) {
        await wallet.signOut()
      }
      
      set({
        isConnected: false,
        accountId: null,
        account: null,
        balance: null,
        balanceFormatted: null,
        wallet: null
      })
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
      throw error
    }
  },

  switchAccount: async () => {
    const { wallet } = get()
    if (wallet) {
      await wallet.signOut()
      await get().connect()
    }
  },

  // Helper function to create RPC provider with fallbacks
  createProvider: (networkId: 'mainnet' | 'testnet') => {
    const endpoints = RPC_ENDPOINTS[networkId]
    return new providers.JsonRpcProvider({
      url: endpoints[0]
    })
  },

  // Account operations
  refreshAccount: async () => {
    const { selector, accountId, networkId } = get()
    if (!selector || !accountId) return

    try {
      const provider = get().createProvider(networkId)
      
      const account = await provider.query<any>({
        request_type: 'view_account',
        finality: 'final',
        account_id: accountId
      })
      
      set({ account })
      await get().refreshBalance()
    } catch (error) {
      console.error('Failed to refresh account:', error)
      // Don't throw here to avoid breaking the UI
    }
  },

  refreshBalance: async () => {
    const { selector, accountId, networkId } = get()
    if (!selector || !accountId) return

    try {
      const provider = get().createProvider(networkId)
      
      const account = await provider.query<any>({
        request_type: 'view_account',
        finality: 'final',
        account_id: accountId
      })
      
      const balance = account.amount
      const balanceFormatted = utils.format.formatNearAmount(balance, 2)
      
      set({ balance, balanceFormatted })
      
    } catch (error) {
      console.error('Failed to refresh balance:', error)
      // Don't throw here to avoid breaking the UI
    }
  },

  // Transaction operations
  signAndSendTransaction: async (actions, receiverId?: string) => {
    const { wallet } = get()
    if (!wallet) {
      throw new Error('Wallet not connected')
    }

    if (!receiverId) {
      throw new Error('Contract receiver ID is required for transactions')
    }

    try {
      return await wallet.signAndSendTransaction({
        receiverId,
        actions
      })
    } catch (error) {
      console.error('Transaction failed:', error)
      throw error
    }
  },

  signAndSendTransactions: async (transactions) => {
    const { wallet } = get()
    if (!wallet) {
      throw new Error('Wallet not connected')
    }

    try {
      return await wallet.signAndSendTransactions({ transactions })
    } catch (error) {
      console.error('Transactions failed:', error)
      throw error
    }
  },

  // Network operations
  switchNetwork: async (networkId) => {
    set({ networkId })
    // Re-initialize selector with new network
    await get().initializeSelector()
    // Refresh account if connected
    if (get().isConnected) {
      await get().refreshAccount()
    }
  },

  // Internal helper method
  initializeSelector: async () => {
    const { networkId } = get()
    
    try {
      const selector = await setupWalletSelector({
        network: {
          networkId: networkId,
          nodeUrl: RPC_ENDPOINTS[networkId][0], // Use primary RPC endpoint
          helperUrl: networkId === 'mainnet'
            ? 'https://helper.near.org'
            : 'https://helper.testnet.near.org',
          explorerUrl: networkId === 'mainnet'
            ? 'https://nearblocks.io'
            : 'https://testnet.nearblocks.io',
          indexerUrl: networkId === 'mainnet'
            ? 'https://api.kitwallet.app'
            : 'https://testnet-api.kitwallet.app'
        },
        modules: [
          setupMyNearWallet({
            walletUrl: networkId === 'mainnet' 
              ? 'https://app.mynearwallet.com'
              : 'https://testnet.mynearwallet.com'
          }),
          // Other wallets can be enabled as needed
          // setupHereWallet(),
          // setupMeteorWallet(),
          // setupSender(),
          // setupMathWallet(),
          // setupNightly(),
          // setupLedger(),
          // setupWalletConnect({
          //   projectId: 'your-wallet-connect-project-id',
          //   metadata: {
          //     name: 'NEAR Intents',
          //     description: 'Cross-chain intent execution platform',
          //     url: 'https://near-intents.app',
          //     icons: ['https://near-intents.app/icon.png']
          //   }
          // })
        ]
      })

      set({ selector })

      // Listen for account changes
      selector.store.observable.subscribe(async (state) => {
        console.log('📡 Wallet state update:', state)
        const { accounts, selectedWalletId } = state
        
        // Check if a wallet is being selected
        if (selectedWalletId && accounts.length === 0) {
          console.log('🔄 Wallet selected, waiting for accounts...', selectedWalletId)
          set({ isConnecting: true })
          return
        }
        
        if (accounts.length > 0) {
          const accountId = accounts[0].accountId
          console.log('🔗 Attempting to connect account:', accountId)
          try {
            const wallet = await selector.wallet()
            console.log('✅ Wallet connected successfully:', accountId)
            set({ 
              isConnected: true, 
              isConnecting: false,
              accountId,
              wallet
            })
            // Don't auto-refresh to avoid RPC issues during connection
            // User can manually refresh if needed
          } catch (error) {
            console.error('❌ Failed to get wallet for account:', accountId, error)
            set({ 
              isConnecting: false,
              isConnected: false 
            })
          }
        } else if (!selectedWalletId) {
          console.log('🔌 No accounts found, disconnecting')
          set({ 
            isConnected: false, 
            isConnecting: false,
            accountId: null,
            account: null,
            balance: null,
            balanceFormatted: null,
            wallet: null
          })
        }
      })

    } catch (error) {
      console.error('Failed to initialize wallet selector:', error)
      set({ isConnecting: false })
      throw error
    }
  }
}))

// Initialize wallet selector on store creation (client-side only)
if (typeof window !== 'undefined') {
  useWalletStore.getState().initializeSelector().catch(console.error)
}