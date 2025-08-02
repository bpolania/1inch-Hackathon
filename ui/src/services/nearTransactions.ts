/**
 * NEAR Transaction Service - Handles intent posting to NEAR blockchain
 */

import { utils, transactions } from 'near-api-js'
import type { IntentRequest } from '@/types/intent'
import type { TransactionOptions } from '@/types/wallet'

// Contract methods for intent management
export const INTENT_CONTRACT_METHODS = {
  CREATE_INTENT: 'create_intent',
  CANCEL_INTENT: 'cancel_intent',
  RESOLVE_INTENT: 'resolve_intent',
  GET_INTENT: 'get_intent',
  GET_USER_INTENTS: 'get_user_intents'
} as const

// Gas amounts for different operations
export const GAS_AMOUNTS = {
  CREATE_INTENT: '30000000000000', // 30 TGas
  CANCEL_INTENT: '10000000000000', // 10 TGas
  RESOLVE_INTENT: '50000000000000', // 50 TGas
} as const

// Storage deposit for intent creation
export const STORAGE_DEPOSIT = '100000000000000000000000' // 0.1 NEAR

// Default contract ID for intent management
export const DEFAULT_INTENT_CONTRACT = process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID || 'intents.testnet'

/**
 * Prepares a transaction to create an intent on NEAR blockchain
 */
export function prepareCreateIntentTransaction(
  intent: IntentRequest,
  contractId: string = DEFAULT_INTENT_CONTRACT
): TransactionOptions {
  // Prepare intent data for smart contract
  const intentData = {
    id: intent.id,
    user: intent.user,
    from_token: {
      symbol: intent.fromToken?.symbol,
      chain_id: intent.fromToken?.chainId,
      address: intent.fromToken?.address,
      decimals: intent.fromToken?.decimals
    },
    to_token: {
      symbol: intent.toToken?.symbol,
      chain_id: intent.toToken?.chainId,
      address: intent.toToken?.address,
      decimals: intent.toToken?.decimals
    },
    from_amount: intent.fromAmount,
    min_to_amount: intent.minToAmount,
    max_slippage: intent.maxSlippage,
    deadline: intent.deadline,
    prioritize: intent.prioritize,
    created_at: intent.createdAt,
    status: 'pending'
  }

  // Create function call action
  const actions = [
    {
      type: 'FunctionCall',
      params: {
        methodName: INTENT_CONTRACT_METHODS.CREATE_INTENT,
        args: intentData,
        gas: GAS_AMOUNTS.CREATE_INTENT,
        deposit: STORAGE_DEPOSIT
      }
    }
  ]

  return {
    receiverId: contractId,
    actions,
    gas: GAS_AMOUNTS.CREATE_INTENT,
    deposit: STORAGE_DEPOSIT
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
 * Contract view functions for reading intent data
 */
export const VIEW_FUNCTIONS = {
  /**
   * Get intent by ID
   */
  getIntent: (intentId: string) => ({
    methodName: INTENT_CONTRACT_METHODS.GET_INTENT,
    args: { intent_id: intentId }
  }),

  /**
   * Get all intents for a user
   */
  getUserIntents: (accountId: string, status?: string) => ({
    methodName: INTENT_CONTRACT_METHODS.GET_USER_INTENTS,
    args: { 
      account_id: accountId,
      ...(status && { status })
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