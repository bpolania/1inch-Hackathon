/**
 * Intent Store - Manages intent creation and tracking
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { IntentRequest, SolverResponse, IntentSettlement } from '@/types/intent';

interface IntentStore {
  // Current intent being created
  currentIntent: Partial<IntentRequest> | null;
  
  // Intent history
  intentHistory: IntentRequest[];
  
  // Active solver competitions
  activeCompetitions: Map<string, {
    intent: IntentRequest;
    responses: SolverResponse[];
    timeRemaining: number;
    selectedSolver?: string;
  }>;
  
  // Active settlements
  activeSettlements: Map<string, IntentSettlement>;
  
  // Actions
  createIntent: (intent: Partial<IntentRequest>) => void;
  updateIntent: (updates: Partial<IntentRequest>) => void;
  submitIntent: () => Promise<string>;
  clearCurrentIntent: () => void;
  
  addSolverResponse: (intentId: string, response: SolverResponse) => void;
  selectSolver: (intentId: string, solverId: string) => void;
  
  updateSettlement: (intentId: string, settlement: Partial<IntentSettlement>) => void;
  
  // Getters
  getIntentById: (id: string) => IntentRequest | undefined;
  getCompetitionById: (id: string) => any | undefined;
  getSettlementById: (id: string) => IntentSettlement | undefined;
}

export const useIntentStore = create<IntentStore>()(
  devtools(
    persist(
      (set, get) => ({
        currentIntent: null,
        intentHistory: [],
        activeCompetitions: new Map(),
        activeSettlements: new Map(),
        
        createIntent: (intent) => {
          set((state) => ({
            currentIntent: {
              id: generateIntentId(),
              status: 'pending',
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
            throw new Error('No intent to submit');
          }
          
          const intent = state.currentIntent as IntentRequest;
          
          // Add to history
          set((prevState) => ({
            intentHistory: [...prevState.intentHistory, intent],
            currentIntent: null,
          }));
          
          // Initialize competition
          set((prevState) => {
            const newCompetitions = new Map(prevState.activeCompetitions);
            newCompetitions.set(intent.id, {
              intent,
              responses: [],
              timeRemaining: 30000, // 30 seconds for demo
            });
            return { activeCompetitions: newCompetitions };
          });
          
          return intent.id;
        },
        
        clearCurrentIntent: () => {
          set({ currentIntent: null });
        },
        
        addSolverResponse: (intentId, response) => {
          set((state) => {
            const newCompetitions = new Map(state.activeCompetitions);
            const competition = newCompetitions.get(intentId);
            
            if (competition) {
              competition.responses.push(response);
              // Sort by competitiveRank
              competition.responses.sort((a, b) => a.competitiveRank - b.competitiveRank);
              newCompetitions.set(intentId, competition);
            }
            
            return { activeCompetitions: newCompetitions };
          });
        },
        
        selectSolver: (intentId, solverId) => {
          set((state) => {
            const newCompetitions = new Map(state.activeCompetitions);
            const competition = newCompetitions.get(intentId);
            
            if (competition) {
              competition.selectedSolver = solverId;
              newCompetitions.set(intentId, competition);
              
              // Initialize settlement
              const selectedResponse = competition.responses.find(r => r.solverId === solverId);
              if (selectedResponse) {
                const newSettlements = new Map(state.activeSettlements);
                newSettlements.set(intentId, {
                  intentId,
                  selectedSolver: selectedResponse,
                  currentStep: 0,
                  totalSteps: selectedResponse.executionPlan.length,
                  chainSignatureTxs: [],
                  status: 'initializing',
                });
                return { 
                  activeCompetitions: newCompetitions,
                  activeSettlements: newSettlements,
                };
              }
            }
            
            return { activeCompetitions: newCompetitions };
          });
        },
        
        updateSettlement: (intentId, updates) => {
          set((state) => {
            const newSettlements = new Map(state.activeSettlements);
            const settlement = newSettlements.get(intentId);
            
            if (settlement) {
              newSettlements.set(intentId, { ...settlement, ...updates });
            }
            
            return { activeSettlements: newSettlements };
          });
        },
        
        getIntentById: (id) => {
          return get().intentHistory.find(intent => intent.id === id);
        },
        
        getCompetitionById: (id) => {
          return get().activeCompetitions.get(id);
        },
        
        getSettlementById: (id) => {
          return get().activeSettlements.get(id);
        },
      }),
      {
        name: 'near-intents-store',
        partialize: (state) => ({
          intentHistory: state.intentHistory,
          // Don't persist active competitions and settlements
        }),
      }
    ),
    { name: 'IntentStore' }
  )
);

// Utility function to generate intent IDs
function generateIntentId(): string {
  return `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}