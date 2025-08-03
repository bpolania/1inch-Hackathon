/**
 * NEAR Intents Dashboard - Complete intent management interface
 */

'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Activity, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertCircle,
  BarChart3,
  Layers,
  Zap,
  Settings,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/utils/utils';
import { IntentForm } from '@/components/intent/IntentForm';
import { SolverCompetition } from '@/components/solver/SolverCompetition';
import { WalletButtonCompact } from '@/components/wallet/WalletButton';
import { RelayerStatus } from '@/components/relayer/RelayerStatus';
import { TEEStatus } from '@/components/tee/TEEStatus';
import { useIntentStore } from '@/stores/intentStore';
import { IntentRequest } from '@/types/intent';
import { formatTokenAmount, formatUSDAmount, truncateAddress } from '@/utils/utils';
import { NetworkTester } from '@/components/debug/NetworkTester';
import { WalletTroubleshooting } from '@/components/wallet/WalletTroubleshooting';

// Simple Header Component with inline styles
const SimpleHeader = () => (
  <div style={{
    position: 'sticky',
    top: 0,
    zIndex: 50,
    backgroundColor: '#111827',
    borderBottom: '1px solid #374151',
    padding: '1rem 2rem'
  }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <div style={{
          padding: '0.5rem',
          borderRadius: '0.5rem',
          background: 'linear-gradient(45deg, #3B82F6, #06B6D4)'
        }}>
          <Layers style={{ height: '1.5rem', width: '1.5rem', color: 'white' }} />
        </div>
        <span style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          color: 'white'
        }}>
          TOTAL FUSION+
        </span>
      </div>
      
      {/* Wallet Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <button style={{
          padding: '0.5rem',
          borderRadius: '0.5rem',
          backgroundColor: 'transparent',
          border: 'none',
          color: '#9CA3AF',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}>
          <Settings style={{ height: '1.25rem', width: '1.25rem' }} />
        </button>
        <WalletButtonCompact />
      </div>
    </div>
  </div>
);

export function IntentsDashboard() {
  const { 
    intents, 
    currentIntent, 
    clearCurrentIntent 
  } = useIntentStore();
  
  const [activeTab, setActiveTab] = useState('create');
  const [selectedIntent, setSelectedIntent] = useState<IntentRequest | null>(null);

  // Switch to competition view when intent is submitted
  const handleIntentSubmitted = (intentId: string) => {
    const intent = intents.find(i => i.id === intentId);
    if (intent) {
      setSelectedIntent(intent);
      setActiveTab('competition');
    }
  };

  // Create new intent
  const handleCreateNew = () => {
    clearCurrentIntent();
    setSelectedIntent(null);
    setActiveTab('create');
  };

  // Mock stats - in real app this would come from the store/API
  const stats = {
    totalIntents: intents.length,
    completedIntents: intents.filter(i => i.status === 'completed').length,
    totalVolume: intents
      .filter(i => i.status === 'completed')
      .reduce((acc, intent) => {
        const usdValue = intent.fromToken.priceUSD 
          ? parseFloat(intent.fromAmount) * intent.fromToken.priceUSD 
          : 0;
        return acc + usdValue;
      }, 0),
    avgExecutionTime: 12 // seconds
  };

  const recentIntents = intents
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #581c87 100%)',
      color: '#e5e7eb'
    }}>
      <SimpleHeader />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '3rem 2rem'
      }}>
        {/* Main Content Container */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: 'calc(100vh - 200px)',
          gap: '3rem'
        }}>
          <div style={{ width: '100%', maxWidth: '600px' }}>
            {/* Header Section */}
            <div style={{
              textAlign: 'center',
              marginBottom: '3rem'
            }}>
              <h1 style={{
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#f9fafb',
                marginBottom: '1rem',
                letterSpacing: '-0.025em'
              }}>
                Cross-Chain Intent Expression
              </h1>
              <p style={{
                fontSize: '1.125rem',
                color: '#d1d5db',
                lineHeight: '1.6',
                maxWidth: '500px',
                margin: '0 auto'
              }}>
                Express what you want, let our solver network figure out how to make it happen across chains
              </p>
            </div>
          
            {/* Network Debug Tool (Development Only) */}
            {process.env.NODE_ENV === 'development' && (
              <div style={{
                maxWidth: '500px',
                margin: '0 auto 2rem auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <NetworkTester />
                <WalletTroubleshooting />
              </div>
            )}
          
            {/* Main Trading Interface */}
            <div style={{
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              borderRadius: '1.5rem',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              padding: '2.5rem',
              maxWidth: '500px',
              margin: '0 auto'
            }}>
              {/* Tab Toggle */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '2rem',
                backgroundColor: 'rgba(51, 65, 85, 0.6)',
                padding: '0.5rem',
                borderRadius: '0.75rem'
              }}>
                <button 
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    backgroundColor: activeTab === 'create' ? 'rgba(59, 130, 246, 0.8)' : 'transparent',
                    color: activeTab === 'create' ? '#ffffff' : '#9ca3af'
                  }}
                  onClick={() => setActiveTab('create')}
                  onMouseEnter={(e) => {
                    if (activeTab !== 'create') {
                      e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.5)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== 'create') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#9ca3af';
                    }
                  }}
                >
                  Swap
                </button>
                <button 
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    backgroundColor: activeTab === 'analytics' ? 'rgba(59, 130, 246, 0.8)' : 'transparent',
                    color: activeTab === 'analytics' ? '#ffffff' : '#9ca3af'
                  }}
                  onClick={() => setActiveTab('analytics')}
                  onMouseEnter={(e) => {
                    if (activeTab !== 'analytics') {
                      e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.5)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== 'analytics') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#9ca3af';
                    }
                  }}
                >
                  Limit
                </button>
              </div>
              
              {/* Tab Content */}
              <div>
                {activeTab === 'create' && <IntentForm onSubmit={handleIntentSubmitted} />}
                {activeTab === 'analytics' && (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    color: '#d1d5db',
                    fontSize: '1.125rem'
                  }}>
                    <p>Limit orders coming soon</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Additional Features Section */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 2rem 3rem 2rem'
      }}>
        {activeTab === 'competition' && selectedIntent && (
          <div style={{
            maxWidth: '1000px',
            margin: '0 auto',
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '1.5rem',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            backdropFilter: 'blur(20px)',
            padding: '2rem'
          }}>
            <SolverCompetition intent={selectedIntent} />
          </div>
        )}
        {activeTab === 'relayer' && (
          <div style={{
            maxWidth: '1000px',
            margin: '0 auto',
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '1.5rem',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            backdropFilter: 'blur(20px)',
            padding: '2rem'
          }}>
            <RelayerStatus />
          </div>
        )}
        {activeTab === 'tee' && (
          <div style={{
            maxWidth: '1000px',
            margin: '0 auto',
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '1.5rem',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            backdropFilter: 'blur(20px)',
            padding: '2rem'
          }}>
            <TEEStatus />
          </div>
        )}
      </div>
    </div>
  );
}