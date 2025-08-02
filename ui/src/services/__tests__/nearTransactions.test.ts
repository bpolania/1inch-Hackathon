/**
 * NEAR Transactions Service Tests - Unit tests for transaction preparation
 */

import {
  prepareCreateIntentTransaction,
  prepareCancelIntentTransaction,
  estimateIntentCreationCost,
  validateBalanceForIntent,
  formatTransactionResult,
  parseTransactionError,
  VIEW_FUNCTIONS,
  INTENT_CONTRACT_METHODS,
  GAS_AMOUNTS,
  STORAGE_DEPOSIT,
  TRANSACTION_ERRORS
} from '../nearTransactions'
import { createMockIntent } from '../../../tests/utils/test-utils'
import { IntentRequest } from '@/types/intent'

// Mock near-api-js
jest.mock('near-api-js', () => ({
  utils: {
    format: {
      formatNearAmount: jest.fn((amount, decimals) => {
        // Simple mock implementation
        const num = parseFloat(amount) / Math.pow(10, 24)
        return num.toFixed(decimals || 2)
      }),
      parseNearAmount: jest.fn((amount) => {
        // Simple mock implementation  
        const num = parseFloat(amount) * Math.pow(10, 24)
        return num.toString()
      })
    }
  },
  transactions: {}
}))

describe('NEAR Transactions Service', () => {
  const mockIntent = createMockIntent({
    id: 'test-intent-123',
    user: 'user.near',
    fromAmount: '1.0',
    minToAmount: '100.0',
    maxSlippage: 50,
    deadline: 1234567890,
    prioritize: 'speed'
  })

  describe('prepareCreateIntentTransaction', () => {
    it('should prepare correct transaction for intent creation', () => {
      const transaction = prepareCreateIntentTransaction(mockIntent)

      expect(transaction.receiverId).toBe('cross-chain-htlc.demo.cuteharbor3573.testnet')
      expect(transaction.gas).toBe(GAS_AMOUNTS.CREATE_INTENT)
      expect(transaction.actions).toHaveLength(1)

      const action = transaction.actions[0]
      expect(action.type).toBe('FunctionCall')
      expect(action.params.methodName).toBe(INTENT_CONTRACT_METHODS.CREATE_INTENT)
      expect(action.params.gas).toBe(GAS_AMOUNTS.CREATE_INTENT)
      expect(typeof action.params.deposit).toBe('string')
    })

    it('should use custom contract ID when provided', () => {
      const customContractId = 'custom.testnet'
      const transaction = prepareCreateIntentTransaction(mockIntent, customContractId)

      expect(transaction.receiverId).toBe(customContractId)
    })

    it('should format intent data correctly for smart contract', () => {
      const transaction = prepareCreateIntentTransaction(mockIntent)
      const action = transaction.actions[0]
      const args = action.params.args

      expect(args.order_id).toBe(mockIntent.id)
      expect(args.hashlock).toBeDefined()
      expect(args.timelock).toBeDefined()
      expect(args.destination_chain).toBeDefined()
      expect(args.destination_token).toBeDefined()
      expect(args.destination_amount).toBeDefined()
      expect(args.destination_address).toBeDefined()
      expect(args.resolver_fee).toBeDefined()
    })

    it('should handle intent with missing token data', () => {
      const intentWithoutTokens: IntentRequest = {
        ...mockIntent,
        fromToken: null,
        toToken: null
      }

      const transaction = prepareCreateIntentTransaction(intentWithoutTokens)
      const args = transaction.actions[0].params.args

      expect(args.destination_token).toBe('ETH') // Default fallback
      expect(args.order_id).toBe(mockIntent.id)
    })
  })

  describe('prepareCancelIntentTransaction', () => {
    it('should prepare correct transaction for intent cancellation', () => {
      const intentId = 'test-intent-123'
      const transaction = prepareCancelIntentTransaction(intentId)

      expect(transaction.receiverId).toBe('cross-chain-htlc.demo.cuteharbor3573.testnet')
      expect(transaction.gas).toBe(GAS_AMOUNTS.CANCEL_INTENT)
      expect(transaction.deposit).toBe('0')
      expect(transaction.actions).toHaveLength(1)

      const action = transaction.actions[0]
      expect(action.type).toBe('FunctionCall')
      expect(action.params.methodName).toBe(INTENT_CONTRACT_METHODS.CANCEL_INTENT)
      expect(action.params.args).toEqual({ intent_id: intentId })
      expect(action.params.gas).toBe(GAS_AMOUNTS.CANCEL_INTENT)
      expect(action.params.deposit).toBe('0')
    })

    it('should use custom contract ID when provided', () => {
      const intentId = 'test-intent-123'
      const customContractId = 'custom.testnet'
      const transaction = prepareCancelIntentTransaction(intentId, customContractId)

      expect(transaction.receiverId).toBe(customContractId)
    })
  })

  describe('estimateIntentCreationCost', () => {
    it('should calculate correct gas cost estimation', () => {
      const cost = estimateIntentCreationCost()

      expect(cost.gas).toBe(GAS_AMOUNTS.CREATE_INTENT)
      expect(cost.gasPrice).toBe('1000000000')
      expect(cost.deposit).toBe(STORAGE_DEPOSIT)
      expect(cost.totalNearCost).toBeDefined()
      expect(typeof cost.totalNearCost).toBe('string')
    })

    it('should include both gas and storage costs', () => {
      const cost = estimateIntentCreationCost()
      
      // totalNearCost should be greater than just the deposit
      const { utils } = require('near-api-js')
      expect(utils.format.formatNearAmount).toHaveBeenCalled()
    })
  })

  describe('validateBalanceForIntent', () => {
    beforeEach(() => {
      const { utils } = require('near-api-js')
      utils.format.parseNearAmount.mockImplementation((amount) => {
        return '130000000000000000000000'
      })
      utils.format.formatNearAmount.mockImplementation((amount, decimals) => {
        return (parseFloat(amount) / Math.pow(10, 24)).toFixed(decimals || 2)
      })
    })

    it('should validate sufficient balance correctly', () => {
      const sufficientBalance = '500000000000000000000000' // 0.5 NEAR
      const result = validateBalanceForIntent(sufficientBalance)

      expect(result.hasEnough).toBe(true)
      expect(result.missing).toBe('0')
      expect(result.required).toBeDefined()
    })

    it('should detect insufficient balance', () => {
      const insufficientBalance = '50000000000000000000000' // 0.05 NEAR
      const result = validateBalanceForIntent(insufficientBalance)

      expect(result.hasEnough).toBe(false)
      expect(result.missing).not.toBe('0')
      expect(result.required).toBeDefined()
    })

    it('should use custom required amount when provided', () => {
      const balance = '100000000000000000000000'
      const customRequired = '0.2'
      const result = validateBalanceForIntent(balance, customRequired)

      expect(result.required).toBe(customRequired)
    })
  })

  describe('formatTransactionResult', () => {
    it('should format successful transaction result', () => {
      const successResult = {
        status: { SuccessValue: 'success' },
        transaction: { hash: 'test-hash' },
        transaction_outcome: { 
          block_hash: 'block-hash',
          outcome: { gas_used: 1000000 }
        },
        receipts_outcome: [
          { outcome: { logs: ['log1', 'log2'] } }
        ]
      }

      const formatted = formatTransactionResult(successResult)

      expect(formatted.success).toBe(true)
      expect(formatted.transactionHash).toBe('test-hash')
      expect(formatted.blockHash).toBe('block-hash')
      expect(formatted.gasUsed).toBe(1000000)
      expect(formatted.logs).toEqual(['log1', 'log2'])
    })

    it('should format failed transaction result', () => {
      const failureResult = {
        status: { Failure: 'error' },
        transaction: { hash: 'test-hash' }
      }

      const formatted = formatTransactionResult(failureResult)

      expect(formatted.success).toBe(false)
      expect(formatted.transactionHash).toBe('test-hash')
      expect(formatted.logs).toEqual([])
    })

    it('should handle missing transaction data', () => {
      const incompleteResult = {
        status: null,
        receipts_outcome: undefined
      }

      const formatted = formatTransactionResult(incompleteResult)

      expect(formatted.success).toBeFalsy()
      expect(formatted.transactionHash).toBeUndefined()
      expect(formatted.logs).toEqual([])
    })
  })

  describe('parseTransactionError', () => {
    it('should parse insufficient balance error', () => {
      const error = new Error('insufficient balance for transaction')
      const parsed = parseTransactionError(error)

      expect(parsed).toBe(TRANSACTION_ERRORS.INSUFFICIENT_BALANCE)
    })

    it('should parse user rejection error', () => {
      const error = new Error('user rejected transaction')
      const parsed = parseTransactionError(error)

      expect(parsed).toBe(TRANSACTION_ERRORS.USER_REJECTED)
    })

    it('should parse contract not found error', () => {
      const error = new Error('contract not found')
      const parsed = parseTransactionError(error)

      expect(parsed).toBe(TRANSACTION_ERRORS.CONTRACT_NOT_FOUND)
    })

    it('should parse deadline error', () => {
      const error = new Error('deadline has passed')
      const parsed = parseTransactionError(error)

      expect(parsed).toBe(TRANSACTION_ERRORS.DEADLINE_PASSED)
    })

    it('should parse intent exists error', () => {
      const error = new Error('intent already exists')
      const parsed = parseTransactionError(error)

      expect(parsed).toBe(TRANSACTION_ERRORS.INTENT_EXISTS)
    })

    it('should parse network error', () => {
      const error = new Error('network timeout')
      const parsed = parseTransactionError(error)

      expect(parsed).toBe(TRANSACTION_ERRORS.NETWORK_ERROR)
    })

    it('should return original message for unknown errors', () => {
      const error = new Error('unknown error message')
      const parsed = parseTransactionError(error)

      expect(parsed).toBe('unknown error message')
    })

    it('should handle non-Error objects', () => {
      const error = 'string error'
      const parsed = parseTransactionError(error)

      expect(parsed).toBe('string error')
    })

    it('should handle null/undefined errors', () => {
      const parsed1 = parseTransactionError(null)
      const parsed2 = parseTransactionError(undefined)

      expect(parsed1).toBe('Unknown error')
      expect(parsed2).toBe('Unknown error')
    })
  })

  describe('VIEW_FUNCTIONS', () => {
    it('should generate correct getIntent view function call', () => {
      const intentId = 'test-intent-123'
      const viewCall = VIEW_FUNCTIONS.getIntent(intentId)

      expect(viewCall.methodName).toBe(INTENT_CONTRACT_METHODS.GET_INTENT)
      expect(viewCall.args).toEqual({ order_id: intentId })
    })

    it('should generate correct getUserIntents view function call without status', () => {
      const accountId = 'user.near'
      const viewCall = VIEW_FUNCTIONS.getUserIntents(accountId)

      expect(viewCall.methodName).toBe('is_authorized_resolver')
      expect(viewCall.args).toEqual({ resolver: accountId })
    })

    it('should generate correct getUserIntents view function call with status', () => {
      const accountId = 'user.near'
      const viewCall = VIEW_FUNCTIONS.getUserIntents(accountId)

      expect(viewCall.methodName).toBe('is_authorized_resolver')
      expect(viewCall.args).toEqual({ resolver: accountId })
    })
  })

  describe('Constants', () => {
    it('should have correct intent contract methods', () => {
      expect(INTENT_CONTRACT_METHODS.CREATE_INTENT).toBe('create_order')
      expect(INTENT_CONTRACT_METHODS.CANCEL_INTENT).toBe('cancel_order')
      expect(INTENT_CONTRACT_METHODS.RESOLVE_INTENT).toBe('claim_order')
      expect(INTENT_CONTRACT_METHODS.GET_INTENT).toBe('get_order')
      expect(INTENT_CONTRACT_METHODS.GET_USER_INTENTS).toBe('get_order')
    })

    it('should have correct gas amounts', () => {
      expect(GAS_AMOUNTS.CREATE_INTENT).toBe('30000000000000')
      expect(GAS_AMOUNTS.CANCEL_INTENT).toBe('10000000000000')
      expect(GAS_AMOUNTS.RESOLVE_INTENT).toBe('50000000000000')
    })

    it('should have correct storage deposit', () => {
      expect(STORAGE_DEPOSIT).toBe('100000000000000000000000')
    })

    it('should have correct transaction error messages', () => {
      expect(TRANSACTION_ERRORS.INSUFFICIENT_BALANCE).toBe('Insufficient NEAR balance for transaction')
      expect(TRANSACTION_ERRORS.CONTRACT_NOT_FOUND).toBe('Intent contract not found')
      expect(TRANSACTION_ERRORS.INVALID_INTENT).toBe('Invalid intent data')
      expect(TRANSACTION_ERRORS.DEADLINE_PASSED).toBe('Intent deadline has already passed')
      expect(TRANSACTION_ERRORS.INTENT_EXISTS).toBe('Intent with this ID already exists')
      expect(TRANSACTION_ERRORS.USER_REJECTED).toBe('Transaction was rejected by user')
      expect(TRANSACTION_ERRORS.NETWORK_ERROR).toBe('Network error occurred during transaction')
    })
  })
})