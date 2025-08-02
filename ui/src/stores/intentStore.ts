/**
 * Intent Store - Manages intent creation and tracking
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

export const useIntentStore = create<IntentStore>()(
  persist(
    (set, get) => ({
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
        
        try {
          // Submit to API Gateway instead of directly to NEAR
          const apiGatewayUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3001';
          
          const response = await fetch(`${apiGatewayUrl}/api/relayer/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: intent.id,
              fromToken: intent.fromToken,
              toToken: intent.toToken,
              fromAmount: intent.fromAmount,
              minToAmount: intent.minToAmount,
              user: intent.user,
              maxSlippage: intent.maxSlippage || 1,
              deadline: intent.deadline || Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API error: ${response.status}`);
          }
          
          const result = await response.json();
          
          // Update intent with solver network submission info
          intent.status = 'processing';
          intent.transactionHash = result.data?.orderHash;
          intent.blockHash = result.data?.status;
          
          // Add to intents list
          set((prevState) => ({
            intents: [...prevState.intents, intent],
            currentIntent: null,
          }));
          
          return intent.id;
          
        } catch (error) {
          console.error('Failed to submit intent to solver network:', error);
          
          // Parse error for user-friendly message
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(errorMessage);
        }
      },
      
      clearCurrentIntent: () => {
        set({ currentIntent: null });
      },
      
      addIntent: (intent) => {
        set((state) => ({
          intents: [...state.intents, intent]
        }));
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
    }),
    {
      name: 'near-intents-store',
      storage: createJSONStorage(() => {
        // Only use localStorage on client side
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        // Return a no-op storage for SSR
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      // Only persist intents, not currentIntent (since it's transient)
      partialize: (state) => ({
        intents: state.intents,
      }),
    }
  )
);

