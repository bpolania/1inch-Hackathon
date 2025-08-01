import { useIntentStore } from '../intentStore'
import { createMockIntent, createMockToken } from '../../../tests/utils/test-utils'
import { IntentRequest } from '@/types/intent'

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
    useIntentStore.getState().clearAllIntents()
    useIntentStore.getState().clearCurrentIntent()
    
    // Clear mock calls
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
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
      
      expect(store.currentIntent).toBeTruthy()
      expect(store.currentIntent?.user).toBe('test.near')
      expect(store.currentIntent?.maxSlippage).toBe(50)
      expect(store.currentIntent?.prioritize).toBe('speed')
      expect(store.currentIntent?.status).toBe('pending')
    })

    it('should update current intent', () => {
      const store = useIntentStore.getState()
      const fromToken = createMockToken({ symbol: 'ETH' })
      const toToken = createMockToken({ symbol: 'NEAR' })
      
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
      
      expect(store.currentIntent?.fromToken).toEqual(fromToken)
      expect(store.currentIntent?.toToken).toEqual(toToken)
      expect(store.currentIntent?.fromAmount).toBe('1.0')
      expect(store.currentIntent?.minToAmount).toBe('680.0')
    })

    it('should clear current intent', () => {
      const store = useIntentStore.getState()
      
      store.createIntent({
        user: 'test.near',
        maxSlippage: 50,
        deadline: Date.now() + 300000,
        prioritize: 'speed',
      })
      
      expect(store.currentIntent).toBeTruthy()
      
      store.clearCurrentIntent()
      
      expect(store.currentIntent).toBeNull()
    })
  })

  describe('Intent Submission and Storage', () => {
    it('should submit an intent and add to intents list', async () => {
      const store = useIntentStore.getState()
      const fromToken = createMockToken({ symbol: 'ETH' })
      const toToken = createMockToken({ symbol: 'NEAR' })
      
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
      
      expect(store.intents).toHaveLength(0)
      
      const intentId = await store.submitIntent()
      
      expect(intentId).toBeTruthy()
      expect(store.intents).toHaveLength(1)
      expect(store.intents[0].id).toBe(intentId)
      expect(store.intents[0].status).toBe('processing')
      expect(store.currentIntent).toBeNull()
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
      
      expect(store.intents).toHaveLength(1)
      expect(store.intents[0]).toEqual(mockIntent)
    })

    it('should update existing intent in list', () => {
      const store = useIntentStore.getState()
      const mockIntent = createMockIntent({ status: 'pending' })
      
      store.addIntent(mockIntent)
      
      store.updateIntentStatus(mockIntent.id, 'completed')
      
      expect(store.intents[0].status).toBe('completed')
      expect(store.intents[0].updatedAt).toBeGreaterThan(mockIntent.updatedAt)
    })

    it('should not update non-existent intent', () => {
      const store = useIntentStore.getState()
      const mockIntent = createMockIntent()
      
      store.addIntent(mockIntent)
      
      // Try to update non-existent intent
      store.updateIntentStatus('non-existent-id', 'completed')
      
      // Original intent should remain unchanged
      expect(store.intents[0].status).toBe(mockIntent.status)
    })

    it('should clear all intents', () => {
      const store = useIntentStore.getState()
      const intent1 = createMockIntent({ id: 'intent-1' })
      const intent2 = createMockIntent({ id: 'intent-2' })
      
      store.addIntent(intent1)
      store.addIntent(intent2)
      
      expect(store.intents).toHaveLength(2)
      
      store.clearAllIntents()
      
      expect(store.intents).toHaveLength(0)
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
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'near-intents-store',
        expect.stringContaining(mockIntent.id)
      )
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
      
      // Create new store instance to trigger loading
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
        fromToken: createMockToken({ symbol: 'ETH' }),
        toToken: createMockToken({ symbol: 'NEAR' }),
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
        fromToken: createMockToken({ symbol: 'ETH' }),
        toToken: createMockToken({ symbol: 'NEAR' }),
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