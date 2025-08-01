/**
 * NEAR Wallet Integration Types
 */

import type { AccountView } from 'near-api-js/lib/providers/provider'
import type { WalletSelector, Wallet } from '@near-wallet-selector/core'
import type { providers } from 'near-api-js'

export interface WalletState {
  // Connection status
  isConnected: boolean
  isConnecting: boolean
  
  // Account information
  accountId: string | null
  account: AccountView | null
  
  // Balance information
  balance: string | null // NEAR balance in yoctoNEAR
  balanceFormatted: string | null // Human readable balance
  
  // Wallet selector instance
  selector: WalletSelector | null
  wallet: Wallet | null
  
  // Network information
  networkId: 'mainnet' | 'testnet'
}

export interface WalletActions {
  // Connection management
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  switchAccount: () => Promise<void>
  
  // Account operations
  refreshAccount: () => Promise<void>
  refreshBalance: () => Promise<void>
  
  // Transaction operations
  signAndSendTransaction: (actions: any[], receiverId?: string) => Promise<any>
  signAndSendTransactions: (transactions: any[]) => Promise<any>
  
  // Network operations
  switchNetwork: (networkId: 'mainnet' | 'testnet') => Promise<void>
  
  // Internal helper methods
  initializeSelector: () => Promise<void>
  createProvider: (networkId: 'mainnet' | 'testnet') => providers.JsonRpcProvider
}

export interface WalletStore extends WalletState, WalletActions {}

export interface WalletConfig {
  networkId: 'mainnet' | 'testnet'
  contractId?: string
  methodNames?: string[]
}

export interface TransactionOptions {
  receiverId: string
  actions: any[]
  gas?: string
  deposit?: string
}

// NEAR specific types
export interface NEARBalance {
  total: string
  stateStaked: string
  staked: string
  available: string
}

export interface AccountBalance {
  available: string
  staked: string
  stateStaked: string
  total: string
}