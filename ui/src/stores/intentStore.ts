/**
 * Intent Store - Manages intent creation and tracking
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { IntentRequest, TokenInfo } from '@/types/intent';
import { generateId } from '@/utils/utils';
import { prepareCreateIntentTransaction, parseTransactionError } from '@/services/nearTransactions';

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
          // Get wallet store dynamically to avoid circular dependency
          const { useWalletStore } = await import('./walletStore');
          const wallet = useWalletStore.getState();
          
          if (!wallet.isConnected || !wallet.wallet) {
            throw new Error('Wallet not connected');
          }
          
          // Prepare NEAR transaction
          const contractId = 'intents.testnet'; // TODO: Make this configurable
          const transactionOptions = prepareCreateIntentTransaction(intent, contractId);
          
          // Submit to NEAR blockchain
          const result = await wallet.signAndSendTransaction(transactionOptions.actions, contractId);
          
          // Update intent with transaction info
          intent.status = 'processing';
          intent.transactionHash = result.transaction?.hash;
          intent.blockHash = result.transaction_outcome?.block_hash;
          
          // Add to intents list
          set((prevState) => ({
            intents: [...prevState.intents, intent],
            currentIntent: null,
          }));
          
          return intent.id;
          
        } catch (error) {
          console.error('Failed to submit intent to NEAR:', error);
          
          // Parse error for user-friendly message
          const errorMessage = parseTransactionError(error);
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

