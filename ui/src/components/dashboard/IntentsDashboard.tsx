/**
 * NEAR Intents Dashboard - Complete intent management interface
 */

'use client';

import React, { useState, useEffect } from 'react';
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
  Zap
} from 'lucide-react';
import { cn } from '@/utils/utils';
import { IntentForm } from '@/components/intent/IntentForm';
import { SolverCompetition } from '@/components/solver/SolverCompetition';
import { WalletButtonCompact } from '@/components/wallet/WalletButton';
import { useIntentStore } from '@/stores/intentStore';
import { IntentRequest } from '@/types/intent';
import { formatTokenAmount, formatUSDAmount, truncateAddress } from '@/utils/utils';
import { NetworkTester } from '@/components/debug/NetworkTester';
import { WalletTroubleshooting } from '@/components/wallet/WalletTroubleshooting';

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
    <div className="min-h-screen" style={{ backgroundColor: '#f9fafb' }}>
      <div className="container mx-auto p-6 space-y-12">
        {/* Header */}
        <div className="text-center space-y-8 animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <div className="flex-1" /> {/* Spacer */}
            
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-sm" style={{ backgroundColor: '#2563eb' }}>
                <Layers className="h-8 w-8" style={{ color: 'white' }} />
              </div>
              <div>
                <h1 className="text-4xl font-bold" style={{ color: '#111827' }}>
                  NEAR Intents
                </h1>
                <p className="text-sm font-medium" style={{ color: '#4b5563' }}>
                  Powered by TEE Solvers
                </p>
              </div>
            </div>
            
            <div className="flex-1 flex justify-end">
              <WalletButtonCompact />
            </div>
          </div>
          
          <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: '#4b5563' }}>
            Express what you want, let our solver network figure out how to make it happen across chains
          </p>
          
          {/* Network Debug Tool (Development Only) - Hidden in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="max-w-md mx-auto space-y-4">
              <NetworkTester />
              <WalletTroubleshooting />
            </div>
          )}
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="rounded-xl shadow-sm border p-6 text-center hover:shadow-md transition-shadow" style={{ backgroundColor: 'white' }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ backgroundColor: '#dbeafe' }}>
                <Activity className="h-6 w-6" style={{ color: '#2563eb' }} />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: '#111827' }}>{stats.totalIntents}</div>
              <div className="text-sm font-medium" style={{ color: '#6b7280' }}>Total Intents</div>
            </div>
            <div className="rounded-xl shadow-sm border p-6 text-center hover:shadow-md transition-shadow" style={{ backgroundColor: 'white' }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ backgroundColor: '#dcfce7' }}>
                <CheckCircle className="h-6 w-6" style={{ color: '#16a34a' }} />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: '#111827' }}>{stats.completedIntents}</div>
              <div className="text-sm font-medium" style={{ color: '#6b7280' }}>Completed</div>
            </div>
            <div className="rounded-xl shadow-sm border p-6 text-center hover:shadow-md transition-shadow" style={{ backgroundColor: 'white' }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ backgroundColor: '#e0f2fe' }}>
                <TrendingUp className="h-6 w-6" style={{ color: '#0284c7' }} />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: '#111827' }}>
                {formatUSDAmount(stats.totalVolume)}
              </div>
              <div className="text-sm font-medium" style={{ color: '#6b7280' }}>Total Volume</div>
            </div>
            <div className="rounded-xl shadow-sm border p-6 text-center hover:shadow-md transition-shadow" style={{ backgroundColor: 'white' }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ backgroundColor: '#fed7aa' }}>
                <Zap className="h-6 w-6" style={{ color: '#ea580c' }} />
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: '#111827' }}>{stats.avgExecutionTime}s</div>
              <div className="text-sm font-medium" style={{ color: '#6b7280' }}>Avg. Speed</div>
            </div>
          </div>
        </div>

        {/* Main Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex justify-center">
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl border" style={{ backgroundColor: '#f3f4f6' }}>
              <button
                onClick={() => setActiveTab('create')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm"
                style={activeTab === 'create' 
                  ? { backgroundColor: 'white', color: '#2563eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }
                  : { color: '#6b7280' }
                }
              >
                <Plus className="h-4 w-4" />
                Create Intent
              </button>
              <button
                onClick={() => setActiveTab('competition')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm"
                style={activeTab === 'competition'
                  ? { backgroundColor: 'white', color: '#2563eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }
                  : { color: '#6b7280' }
                }
              >
                <Activity className="h-4 w-4" />
                Competition
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm"
                style={activeTab === 'history'
                  ? { backgroundColor: 'white', color: '#2563eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }
                  : { color: '#6b7280' }
                }
              >
                <Clock className="h-4 w-4" />
                History
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm"
                style={activeTab === 'analytics'
                  ? { backgroundColor: 'white', color: '#2563eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }
                  : { color: '#6b7280' }
                }
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </button>
            </div>
          </div>

          {/* Create Intent Tab */}
          {activeTab === 'create' && (
            <div className="animate-fade-in">
              <div className="max-w-2xl mx-auto">
                <IntentForm onSubmit={handleIntentSubmitted} />
              </div>
            </div>
          )}

          {/* Competition Tab */}
          <TabsContent value="competition" className="space-y-6">
            {selectedIntent ? (
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Solver Competition</h2>
                    <p className="text-sm text-muted-foreground">
                      Intent: {truncateAddress(selectedIntent.id)}
                    </p>
                  </div>
                  <Button onClick={handleCreateNew} variant="outline">
                    Create New Intent
                  </Button>
                </div>
                <SolverCompetition intent={selectedIntent} />
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Active Competition</h3>
                <p className="text-muted-foreground mb-4">
                  Create an intent to see the solver competition in action
                </p>
                <Button onClick={() => setActiveTab('create')}>
                  Create Intent
                </Button>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Intent History</h2>
                <Button onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Intent
                </Button>
              </div>

              {recentIntents.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Intent History</h3>
                  <p className="text-muted-foreground mb-4">
                    Your completed intents will appear here
                  </p>
                  <Button onClick={() => setActiveTab('create')}>
                    Create Your First Intent
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentIntents.map((intent) => (
                    <IntentHistoryCard 
                      key={intent.id} 
                      intent={intent}
                      onViewCompetition={() => {
                        setSelectedIntent(intent);
                        setActiveTab('competition');
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-xl font-semibold mb-6">Protocol Analytics</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Chain Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Chain Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-near-500" />
                          <span className="text-sm">NEAR</span>
                        </div>
                        <span className="text-sm font-medium">45%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-sm">Ethereum</span>
                        </div>
                        <span className="text-sm font-medium">35%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-bitcoin-500" />
                          <span className="text-sm">Bitcoin</span>
                        </div>
                        <span className="text-sm font-medium">20%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Success Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Success Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Success Rate</span>
                          <span>98.5%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: '98.5%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Avg. Improvement</span>
                          <span>+3.2%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: '65%' }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Solvers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Solvers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">1inch Solver</span>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-500" />
                          <span className="text-sm font-medium">35%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Jupiter Solver</span>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-500" />
                          <span className="text-sm font-medium">28%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">CoW Protocol</span>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-500" />
                          <span className="text-sm font-medium">22%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

interface IntentHistoryCardProps {
  intent: IntentRequest;
  onViewCompetition: () => void;
}

function IntentHistoryCard({ intent, onViewCompetition }: IntentHistoryCardProps) {
  const statusConfig = {
    pending: { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock },
    processing: { color: 'text-blue-600', bg: 'bg-blue-50', icon: Activity },
    completed: { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
    failed: { color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
    expired: { color: 'text-gray-600', bg: 'bg-gray-50', icon: Clock },
  };

  const status = statusConfig[intent.status];
  const StatusIcon = status.icon;

  const fromUsdValue = intent.fromToken.priceUSD 
    ? parseFloat(intent.fromAmount) * intent.fromToken.priceUSD
    : null;

  const isXChain = intent.fromToken.chainId !== intent.toToken.chainId;

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", status.bg)}>
              <StatusIcon className={cn("h-4 w-4", status.color)} />
            </div>
            <div>
              <div className="font-medium">
                {formatTokenAmount(intent.fromAmount)} {intent.fromToken.symbol} → {intent.toToken.symbol}
              </div>
              <div className="text-xs text-muted-foreground">
                {truncateAddress(intent.id)} • {new Date(intent.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isXChain && (
              <div className="px-2 py-1 rounded-full bg-gradient-to-r from-near-100 to-bitcoin-100 text-xs font-medium">
                Cross-Chain
              </div>
            )}
            <div className={cn("px-2 py-1 rounded-full text-xs font-medium", status.bg, status.color)}>
              {intent.status}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Amount</div>
            <div className="font-medium">
              {formatTokenAmount(intent.fromAmount)} {intent.fromToken.symbol}
            </div>
            {fromUsdValue && (
              <div className="text-xs text-muted-foreground">
                {formatUSDAmount(fromUsdValue)}
              </div>
            )}
          </div>
          
          <div>
            <div className="text-muted-foreground mb-1">From Chain</div>
            <div className="font-medium capitalize">{intent.fromToken.chainId}</div>
          </div>
          
          <div>
            <div className="text-muted-foreground mb-1">To Chain</div>
            <div className="font-medium capitalize">{intent.toToken.chainId}</div>
          </div>
          
          <div className="flex justify-end">
            <Button 
              size="sm" 
              variant="outline"
              onClick={onViewCompetition}
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}