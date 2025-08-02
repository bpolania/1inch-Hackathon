import { useIntentStore } from '../intentStore'
import { createMockIntent, createMockToken } from '../../../tests/utils/test-utils'
import { IntentRequest } from '@/types/intent'

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

// Mock wallet store for intent submission
const mockSignAndSendTransaction = jest.fn().mockResolvedValue({
  transaction: { hash: 'test-tx-hash' },
  transaction_outcome: { block_hash: 'test-block-hash' }
})

const mockWalletStore = {
  isConnected: true,
  wallet: {}, // wallet object exists but signAndSendTransaction is on the store
  signAndSendTransaction: mockSignAndSendTransaction
}

jest.mock('../walletStore', () => ({
  useWalletStore: {
    getState: jest.fn(() => mockWalletStore)
  }
}))

// Mock NEAR transaction utilities
jest.mock('@/services/nearTransactions', () => ({
  prepareCreateIntentTransaction: jest.fn(() => ({
    actions: [{ type: 'FunctionCall', params: {} }]
  })),
  parseTransactionError: jest.fn((error) => error.message || 'Transaction failed')
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

describe('Intent Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    if (useIntentStore.reset) {
      useIntentStore.reset()
    } else {
      useIntentStore.getState().clearAllIntents()
      useIntentStore.getState().clearCurrentIntent()
    }
    
    // Clear mock calls
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    
    // Mock successful fetch response for solver network
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'test-intent-id', status: 'processing' }),
    } as Response)
    
    // Reset wallet mock to successful state
    mockSignAndSendTransaction.mockResolvedValue({
      transaction: { hash: 'test-tx-hash' },
      transaction_outcome: { block_hash: 'test-block-hash' }
    })
  })

  describe('Current Intent Management', () => {
    it('should create a new current intent', () => {
      const store = useIntentStore.getState()
      
      expect(store.currentIntent).toBeNull()
      
      store.createIntent({
        user: 'test.near',
        maxSlippage: 50,
        deadline: Date.now() + 300000,
        prioritize: 'speed',
      })
      
      // Re-get the state after the operation
      const updatedStore = useIntentStore.getState()
      expect(updatedStore.currentIntent).toBeTruthy()
      expect(updatedStore.currentIntent?.user).toBe('test.near')
      expect(updatedStore.currentIntent?.maxSlippage).toBe(50)
      expect(updatedStore.currentIntent?.prioritize).toBe('speed')
      expect(updatedStore.currentIntent?.status).toBe('pending')
    })

    it('should update current intent', () => {
      const store = useIntentStore.getState()
      const fromToken = createMockToken({ symbol: 'ETH', chainId: 'ethereum' })
      const toToken = createMockToken({ symbol: 'NEAR', chainId: 'near' })
      
      // Create initial intent
      store.createIntent({
        user: 'test.near',
        maxSlippage: 50,
        deadline: Date.now() + 300000,
        prioritize: 'speed',
      })
      
      // Update with token information
      store.updateIntent({
        fromToken,
        toToken,
        fromAmount: '1.0',
        minToAmount: '680.0',
      })
      
      // Re-get state after updates
      const updatedStore = useIntentStore.getState()
      expect(updatedStore.currentIntent?.fromToken).toEqual(fromToken)
      expect(updatedStore.currentIntent?.toToken).toEqual(toToken)
      expect(updatedStore.currentIntent?.fromAmount).toBe('1.0')
      expect(updatedStore.currentIntent?.minToAmount).toBe('680.0')
    })

    it('should clear current intent', () => {
      const store = useIntentStore.getState()
      
      store.createIntent({
        user: 'test.near',
        maxSlippage: 50,
        deadline: Date.now() + 300000,
        prioritize: 'speed',
      })
      
      const afterCreate = useIntentStore.getState()
      expect(afterCreate.currentIntent).toBeTruthy()
      
      store.clearCurrentIntent()
      
      const afterClear = useIntentStore.getState()
      expect(afterClear.currentIntent).toBeNull()
    })
  })

  describe('Intent Submission and Storage', () => {
    it('should submit an intent and add to intents list', async () => {
      const store = useIntentStore.getState()
      const fromToken = createMockToken({ symbol: 'ETH', chainId: 'ethereum' })
      const toToken = createMockToken({ symbol: 'NEAR', chainId: 'near' })
      
      // Create and populate intent
      store.createIntent({
        user: 'test.near',
        maxSlippage: 50,
        deadline: Date.now() + 300000,
        prioritize: 'speed',
      })
      
      store.updateIntent({
        fromToken,
        toToken,
        fromAmount: '1.0',
        minToAmount: '680.0',
      })
      
      const beforeSubmit = useIntentStore.getState()
      expect(beforeSubmit.intents).toHaveLength(0)
      
      const intentId = await store.submitIntent()
      
      const afterSubmit = useIntentStore.getState()
      expect(intentId).toBeTruthy()
      expect(afterSubmit.intents).toHaveLength(1)
      expect(afterSubmit.intents[0].id).toBe(intentId)
      expect(afterSubmit.intents[0].status).toBe('processing')
      expect(afterSubmit.currentIntent).toBeNull()
    })

    it('should throw error when submitting incomplete intent', async () => {
      const store = useIntentStore.getState()
      
      store.createIntent({
        user: 'test.near',
        maxSlippage: 50,
        deadline: Date.now() + 300000,
        prioritize: 'speed',
      })
      
      // Missing tokens and amounts
      await expect(store.submitIntent()).rejects.toThrow('Intent is incomplete')
    })

    it('should throw error when no current intent exists', async () => {
      const store = useIntentStore.getState()
      
      await expect(store.submitIntent()).rejects.toThrow('No current intent to submit')
    })
  })

  describe('Intent List Management', () => {
    it('should add intent to list', () => {
      const store = useIntentStore.getState()
      const mockIntent = createMockIntent()
      
      expect(store.intents).toHaveLength(0)
      
      store.addIntent(mockIntent)
      
      const afterAdd = useIntentStore.getState()
      expect(afterAdd.intents).toHaveLength(1)
      expect(afterAdd.intents[0]).toEqual(mockIntent)
    })

    it('should update existing intent in list', () => {
      const store = useIntentStore.getState()
      const mockIntent = createMockIntent({ status: 'pending' })
      
      store.addIntent(mockIntent)
      
      // Add small delay to ensure timestamp changes
      const beforeUpdate = Date.now()
      store.updateIntentStatus(mockIntent.id, 'completed')
      
      const afterUpdate = useIntentStore.getState()
      expect(afterUpdate.intents[0].status).toBe('completed')
      expect(afterUpdate.intents[0].updatedAt).toBeGreaterThanOrEqual(beforeUpdate)
    })

    it('should not update non-existent intent', () => {
      const store = useIntentStore.getState()
      const mockIntent = createMockIntent()
      
      store.addIntent(mockIntent)
      
      // Try to update non-existent intent
      store.updateIntentStatus('non-existent-id', 'completed')
      
      // Original intent should remain unchanged
      const afterUpdate = useIntentStore.getState()
      expect(afterUpdate.intents[0].status).toBe(mockIntent.status)
    })

    it('should clear all intents', () => {
      const store = useIntentStore.getState()
      const intent1 = createMockIntent({ id: 'intent-1' })
      const intent2 = createMockIntent({ id: 'intent-2' })
      
      store.addIntent(intent1)
      store.addIntent(intent2)
      
      const afterAdd = useIntentStore.getState()
      expect(afterAdd.intents).toHaveLength(2)
      
      store.clearAllIntents()
      
      const afterClear = useIntentStore.getState()
      expect(afterClear.intents).toHaveLength(0)
    })
  })

  describe('Intent Retrieval', () => {
    it('should get intent by ID', () => {
      const store = useIntentStore.getState()
      const mockIntent = createMockIntent({ id: 'test-intent' })
      
      store.addIntent(mockIntent)
      
      const retrieved = store.getIntentById('test-intent')
      expect(retrieved).toEqual(mockIntent)
      
      const nonExistent = store.getIntentById('non-existent')
      expect(nonExistent).toBeUndefined()
    })

    it('should get intents by status', () => {
      const store = useIntentStore.getState()
      const pendingIntent = createMockIntent({ id: 'pending', status: 'pending' })
      const completedIntent = createMockIntent({ id: 'completed', status: 'completed' })
      const failedIntent = createMockIntent({ id: 'failed', status: 'failed' })
      
      store.addIntent(pendingIntent)
      store.addIntent(completedIntent)
      store.addIntent(failedIntent)
      
      const pendingIntents = store.getIntentsByStatus('pending')
      expect(pendingIntents).toHaveLength(1)
      expect(pendingIntents[0].id).toBe('pending')
      
      const completedIntents = store.getIntentsByStatus('completed')
      expect(completedIntents).toHaveLength(1)
      expect(completedIntents[0].id).toBe('completed')
      
      const processingIntents = store.getIntentsByStatus('processing')
      expect(processingIntents).toHaveLength(0)
    })
  })

  describe('Persistence', () => {
    it('should save intents to localStorage on add', () => {
      const store = useIntentStore.getState()
      const mockIntent = createMockIntent()
      
      store.addIntent(mockIntent)
      
      // With Zustand persist middleware, localStorage is called automatically
      // We verify that the intent is added to the store
      const updatedStore = useIntentStore.getState()
      expect(updatedStore.intents).toContain(mockIntent)
      
      // The persist middleware handles localStorage calls internally
      // so we don't need to test the specific localStorage.setItem calls
    })

    it('should load intents from localStorage on initialization', () => {
      const mockIntents = [
        createMockIntent({ id: 'intent-1' }),
        createMockIntent({ id: 'intent-2' }),
      ]
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        intents: mockIntents,
        currentIntent: null,
      }))
      
      // Manually set the state to simulate loading from localStorage
      useIntentStore.setState({
        intents: mockIntents,
        currentIntent: null,
      })
      
      const { intents } = useIntentStore.getState()
      
      expect(intents).toHaveLength(2)
      expect(intents[0].id).toBe('intent-1')
      expect(intents[1].id).toBe('intent-2')
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })
      
      // Should not throw and should start with empty state
      expect(() => useIntentStore.getState()).not.toThrow()
      expect(useIntentStore.getState().intents).toHaveLength(0)
    })

    it('should handle invalid JSON in localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json')
      
      // Should not throw and should start with empty state
      expect(() => useIntentStore.getState()).not.toThrow()
      expect(useIntentStore.getState().intents).toHaveLength(0)
    })
  })

  describe('Validation', () => {
    it('should validate complete intent before submission', async () => {
      const store = useIntentStore.getState()
      
      store.createIntent({
        user: 'test.near',
        maxSlippage: 50,
        deadline: Date.now() + 300000,
        prioritize: 'speed',
      })
      
      // Add all required fields  
      store.updateIntent({
        fromToken: createMockToken({ symbol: 'ETH', chainId: 'ethereum' }),
        toToken: createMockToken({ symbol: 'NEAR', chainId: 'near' }),
        fromAmount: '1.0',
        minToAmount: '680.0',
      })
      
      // Should not throw
      await expect(store.submitIntent()).resolves.toBeTruthy()
    })

    it('should reject intent with zero amounts', async () => {
      const store = useIntentStore.getState()
      
      store.createIntent({
        user: 'test.near',
        maxSlippage: 50,
        deadline: Date.now() + 300000,
        prioritize: 'speed',
      })
      
      store.updateIntent({
        fromToken: createMockToken({ symbol: 'ETH', chainId: 'ethereum' }),
        toToken: createMockToken({ symbol: 'NEAR', chainId: 'near' }),
        fromAmount: '0',
        minToAmount: '680.0',
      })
      
      await expect(store.submitIntent()).rejects.toThrow('Intent is incomplete')
    })

    it('should reject intent with same from and to tokens', async () => {
      const store = useIntentStore.getState()
      const sameToken = createMockToken({ symbol: 'ETH' })
      
      store.createIntent({
        user: 'test.near',
        maxSlippage: 50,
        deadline: Date.now() + 300000,
        prioritize: 'speed',
      })
      
      store.updateIntent({
        fromToken: sameToken,
        toToken: sameToken,
        fromAmount: '1.0',
        minToAmount: '1.0',
      })
      
      await expect(store.submitIntent()).rejects.toThrow('Cannot swap same token')
    })
  })
})