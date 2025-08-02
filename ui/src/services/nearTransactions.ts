/**
 * NEAR Transaction Service - Handles intent posting to NEAR blockchain
 */

import { utils, transactions } from 'near-api-js'
import type { IntentRequest } from '@/types/intent'
import type { TransactionOptions } from '@/types/wallet'

// Contract methods for HTLC order management  
export const INTENT_CONTRACT_METHODS = {
  CREATE_INTENT: 'create_order',
  CANCEL_INTENT: 'cancel_order', 
  RESOLVE_INTENT: 'claim_order',
  GET_INTENT: 'get_order',
  GET_USER_INTENTS: 'get_order'
} as const

// Gas amounts for different operations
export const GAS_AMOUNTS = {
  CREATE_INTENT: '30000000000000', // 30 TGas
  CANCEL_INTENT: '10000000000000', // 10 TGas
  RESOLVE_INTENT: '50000000000000', // 50 TGas
} as const

// Storage deposit for intent creation
export const STORAGE_DEPOSIT = '100000000000000000000000' // 0.1 NEAR

// Default contract ID for HTLC order management
export const DEFAULT_INTENT_CONTRACT = process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID || 'cross-chain-htlc.demo.cuteharbor3573.testnet'

/**
 * Prepares a transaction to create an HTLC order on NEAR blockchain
 */
export function prepareCreateIntentTransaction(
  intent: IntentRequest,
  contractId: string = DEFAULT_INTENT_CONTRACT
): TransactionOptions {
  // Generate a simple hashlock for demo purposes (in production, this would be coordinated)
  const hashlock = 'a'.repeat(64) // 64-char hex string for demo
  
  // Calculate timelock (24 hours from now in blocks, ~1 second per block)
  const currentTime = Date.now()
  const timelock = Math.floor(currentTime / 1000) + (24 * 60 * 60) // 24 hours
  
  // Calculate deposit amount in yoctoNEAR
  const fromAmountNear = parseFloat(intent.fromAmount || '0')
  const resolverFeeNear = fromAmountNear * 0.01 // 1% resolver fee
  const totalDepositYocto = utils.format.parseNearAmount((fromAmountNear + resolverFeeNear).toString()) || '0'
  const resolverFeeYocto = utils.format.parseNearAmount(resolverFeeNear.toString()) || '0'
  
  // Prepare HTLC order data
  const orderData = {
    order_id: intent.id || `order-${Date.now()}`,
    hashlock,
    timelock: timelock.toString(),
    destination_chain: intent.toToken?.symbol === 'ETH' ? 'ethereum' : 'ethereum',
    destination_token: intent.toToken?.symbol || 'ETH',
    destination_amount: utils.format.parseNearAmount(intent.minToAmount || '0') || '0',
    destination_address: intent.user || 'demo.cuteharbor3573.testnet',
    resolver_fee: resolverFeeYocto
  }

  // Create function call action
  const actions = [
    {
      type: 'FunctionCall',
      params: {
        methodName: INTENT_CONTRACT_METHODS.CREATE_INTENT,
        args: orderData,
        gas: GAS_AMOUNTS.CREATE_INTENT,
        deposit: totalDepositYocto
      }
    }
  ]

  return {
    receiverId: contractId,
    actions,
    gas: GAS_AMOUNTS.CREATE_INTENT,
    deposit: totalDepositYocto
  }
}

/**
 * Prepares a transaction to cancel an intent
 */
export function prepareCancelIntentTransaction(
  intentId: string,
  contractId: string = DEFAULT_INTENT_CONTRACT
): TransactionOptions {
  const actions = [
    {
      type: 'FunctionCall',
      params: {
        methodName: INTENT_CONTRACT_METHODS.CANCEL_INTENT,
        args: { intent_id: intentId },
        gas: GAS_AMOUNTS.CANCEL_INTENT,
        deposit: '0'
      }
    }
  ]

  return {
    receiverId: contractId,
    actions,
    gas: GAS_AMOUNTS.CANCEL_INTENT,
    deposit: '0'
  }
}

/**
 * Estimates gas cost for intent creation
 */
export function estimateIntentCreationCost(): {
  gas: string
  gasPrice: string
  deposit: string
  totalNearCost: string
} {
  const gasPrice = '1000000000' // 1 GigaGas = 10^9 
  const gasCost = (BigInt(GAS_AMOUNTS.CREATE_INTENT) * BigInt(gasPrice)).toString()
  const totalCost = (BigInt(gasCost) + BigInt(STORAGE_DEPOSIT)).toString()

  return {
    gas: GAS_AMOUNTS.CREATE_INTENT,
    gasPrice,
    deposit: STORAGE_DEPOSIT,
    totalNearCost: utils.format.formatNearAmount(totalCost, 4)
  }
}

/**
 * Validates if user has sufficient balance for intent creation
 */
export function validateBalanceForIntent(
  userBalance: string, // in yoctoNEAR
  requiredAmount?: string
): {
  hasEnough: boolean
  required: string
  missing: string
} {
  const cost = estimateIntentCreationCost()
  const required = requiredAmount || cost.totalNearCost
  const requiredYocto = utils.format.parseNearAmount(required) || '0'
  
  const hasEnough = BigInt(userBalance) >= BigInt(requiredYocto)
  const missing = hasEnough ? '0' : 
    utils.format.formatNearAmount((BigInt(requiredYocto) - BigInt(userBalance)).toString(), 4)

  return {
    hasEnough,
    required,
    missing
  }
}

/**
 * Formats transaction result for display
 */
export function formatTransactionResult(result: any) {
  return {
    success: result.status && typeof result.status === 'object' && 'SuccessValue' in result.status,
    transactionHash: result.transaction?.hash,
    blockHash: result.transaction_outcome?.block_hash,
    gasUsed: result.transaction_outcome?.outcome?.gas_used,
    logs: result.receipts_outcome?.map((r: any) => r.outcome.logs).flat() || []
  }
}

/**
 * Contract view functions for reading HTLC order data
 */
export const VIEW_FUNCTIONS = {
  /**
   * Get HTLC order by ID
   */
  getIntent: (orderId: string) => ({
    methodName: INTENT_CONTRACT_METHODS.GET_INTENT,
    args: { order_id: orderId }
  }),

  /**
   * Get resolver authorization status
   */
  getUserIntents: (accountId: string) => ({
    methodName: 'is_authorized_resolver',
    args: { 
      resolver: accountId
    }
  })
}

/**
 * Error messages for common transaction failures
 */
export const TRANSACTION_ERRORS = {
  INSUFFICIENT_BALANCE: 'Insufficient NEAR balance for transaction',
  CONTRACT_NOT_FOUND: 'Intent contract not found',
  INVALID_INTENT: 'Invalid intent data',
  DEADLINE_PASSED: 'Intent deadline has already passed',
  INTENT_EXISTS: 'Intent with this ID already exists',
  USER_REJECTED: 'Transaction was rejected by user',
  NETWORK_ERROR: 'Network error occurred during transaction'
} as const

/**
 * Helper to parse transaction errors
 */
export function parseTransactionError(error: any): string {
  const errorMessage = error?.message || error?.toString() || 'Unknown error'
  
  if (errorMessage.includes('insufficient')) {
    return TRANSACTION_ERRORS.INSUFFICIENT_BALANCE
  }
  if (errorMessage.includes('reject') || errorMessage.includes('cancel')) {
    return TRANSACTION_ERRORS.USER_REJECTED
  }
  if (errorMessage.includes('contract') || errorMessage.includes('not found')) {
    return TRANSACTION_ERRORS.CONTRACT_NOT_FOUND
  }
  if (errorMessage.includes('deadline')) {
    return TRANSACTION_ERRORS.DEADLINE_PASSED
  }
  if (errorMessage.includes('exists')) {
    return TRANSACTION_ERRORS.INTENT_EXISTS
  }
  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return TRANSACTION_ERRORS.NETWORK_ERROR
  }
  
  return errorMessage
}