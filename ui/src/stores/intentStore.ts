/**
 * Intent Store - Manages intent creation and tracking
 */

import { create } from 'zustand';
import { IntentRequest, TokenInfo } from '@/types/intent';
import { generateId } from '@/utils/utils';

interface IntentStore {
  // Current intent being created
  currentIntent: Partial<IntentRequest> | null;
  
  // Intent history
  intents: IntentRequest[];
  
  // Actions
  createIntent: (intent: Partial<IntentRequest>) => void;
  updateIntent: (updates: Partial<IntentRequest>) => void;
  submitIntent: () => Promise<string>;
  clearCurrentIntent: () => void;
  
  // Intent management
  addIntent: (intent: IntentRequest) => void;
  updateIntentStatus: (id: string, status: IntentRequest['status']) => void;
  clearAllIntents: () => void;
  
  // Getters
  getIntentById: (id: string) => IntentRequest | undefined;
  getIntentsByStatus: (status: IntentRequest['status']) => IntentRequest[];
}

export const useIntentStore = create<IntentStore>((set, get) => ({
  currentIntent: null,
  intents: [],
  
  createIntent: (intent) => {
    set((state) => ({
      currentIntent: {
        id: generateId(),
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...intent,
      }
    }));
  },
  
  updateIntent: (updates) => {
    set((state) => ({
      currentIntent: state.currentIntent 
        ? { ...state.currentIntent, ...updates, updatedAt: Date.now() }
        : null
    }));
  },
  
  submitIntent: async () => {
    const state = get();
    if (!state.currentIntent || !state.currentIntent.id) {
      throw new Error('No current intent to submit');
    }
    
    // Validate required fields
    const { fromToken, toToken, fromAmount, minToAmount } = state.currentIntent;
    if (!fromToken || !toToken || !fromAmount || !minToAmount) {
      throw new Error('Intent is incomplete');
    }
    
    // Check for same token swap
    if (fromToken.address === toToken.address && fromToken.chainId === toToken.chainId) {
      throw new Error('Cannot swap same token');
    }
    
    // Check for zero amounts
    if (parseFloat(fromAmount) <= 0 || parseFloat(minToAmount) <= 0) {
      throw new Error('Intent is incomplete');
    }
    
    const intent = state.currentIntent as IntentRequest;
    intent.status = 'processing';
    
    // Add to intents list
    set((prevState) => ({
      intents: [...prevState.intents, intent],
      currentIntent: null,
    }));
    
    // Save to localStorage
    try {
      const updatedState = get();
      localStorage.setItem('near-intents-store', JSON.stringify({
        intents: updatedState.intents,
        currentIntent: null,
      }));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
    
    return intent.id;
  },
  
  clearCurrentIntent: () => {
    set({ currentIntent: null });
  },
  
  addIntent: (intent) => {
    set((state) => ({
      intents: [...state.intents, intent]
    }));
    
    // Save to localStorage
    try {
      const updatedState = get();
      localStorage.setItem('near-intents-store', JSON.stringify({
        intents: updatedState.intents,
        currentIntent: updatedState.currentIntent,
      }));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  },
  
  updateIntentStatus: (id, status) => {
    set((state) => ({
      intents: state.intents.map(intent => 
        intent.id === id 
          ? { ...intent, status, updatedAt: Date.now() }
          : intent
      )
    }));
  },
  
  clearAllIntents: () => {
    set({ intents: [] });
  },
  
  getIntentById: (id) => {
    return get().intents.find(intent => intent.id === id);
  },
  
  getIntentsByStatus: (status) => {
    return get().intents.filter(intent => intent.status === status);
  },
}));

// Load from localStorage on initialization
try {
  const stored = localStorage.getItem('near-intents-store');
  if (stored) {
    const data = JSON.parse(stored);
    useIntentStore.setState({
      intents: data.intents || [],
      currentIntent: data.currentIntent || null,
    });
  }
} catch (error) {
  console.warn('Failed to load from localStorage:', error);
}