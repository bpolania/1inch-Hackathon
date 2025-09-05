/**
 * Solver Competition Dashboard - Shows real-time solver competition for intents
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  Users, 
  Clock, 
  Shield, 
  Zap, 
  DollarSign,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Activity
} from 'lucide-react';
import { cn } from '@/utils/utils';
import { SolverBid, IntentRequest, SolverInfo } from '@/types/intent';
import { 
  formatTokenAmount, 
  formatUSDAmount, 
  formatPercentage,
  formatDuration,
  truncateAddress 
} from '@/utils/utils';

interface SolverCompetitionProps {
  intent: IntentRequest;
  className?: string;
}

// Mock solver data - in real app this would come from WebSocket
const MOCK_SOLVERS: SolverInfo[] = [
  {
    id: 'solver-1',
    name: '1inch Solver',
    reputation: 0.98,
    totalVolume: 2500000000,
    successRate: 0.995,
    avgExecutionTime: 12,
    teeVerified: true,
    specialties: ['ethereum', 'near']
  },
  {
    id: 'solver-2', 
    name: 'Jupiter Solver',
    reputation: 0.96,
    totalVolume: 1800000000,
    successRate: 0.992,
    avgExecutionTime: 8,
    teeVerified: true,
    specialties: ['near', 'bitcoin']
  },
  {
    id: 'solver-3',
    name: 'CoW Protocol',
    reputation: 0.94,
    totalVolume: 1200000000,
    successRate: 0.989,
    avgExecutionTime: 15,
    teeVerified: false,
    specialties: ['ethereum']
  },
  {
    id: 'solver-4',
    name: 'DEX Aggregator Pro',
    reputation: 0.92,
    totalVolume: 800000000,
    successRate: 0.987,
    avgExecutionTime: 10,
    teeVerified: true,
    specialties: ['ethereum', 'near', 'bitcoin']
  }
];

export function SolverCompetition({ intent, className }: SolverCompetitionProps) {
  const [bids, setBids] = useState<SolverBid[]>([]);
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds for auction
  const [phase, setPhase] = useState<'collecting' | 'evaluating' | 'selected' | 'executing'>('collecting');
  const [selectedBid, setSelectedBid] = useState<SolverBid | null>(null);

  // Simulate real-time bid updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (phase === 'collecting' && timeLeft > 0) {
        setTimeLeft(prev => prev - 1);
        
        // Randomly add new bids
        if (Math.random() < 0.3 && bids.length < MOCK_SOLVERS.length) {
          const availableSolvers = MOCK_SOLVERS.filter(
            solver => !bids.find(bid => bid.solverId === solver.id)
          );
          
          if (availableSolvers.length > 0) {
            const solver = availableSolvers[Math.floor(Math.random() * availableSolvers.length)];
            const newBid = generateMockBid(solver, intent);
            setBids(prev => [...prev, newBid].sort((a, b) => 
              parseFloat(b.outputAmount) - parseFloat(a.outputAmount)
            ));
          }
        }
        
        // Update existing bids slightly
        setBids(prev => prev.map(bid => ({
          ...bid,
          outputAmount: (parseFloat(bid.outputAmount) * (0.998 + Math.random() * 0.004)).toString()
        })).sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount)));
      }
      
      if (timeLeft <= 0 && phase === 'collecting') {
        setPhase('evaluating');
        setTimeout(() => {
          if (bids.length > 0) {
            setSelectedBid(bids[0]);
            setPhase('selected');
          }
        }, 2000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, phase, bids, intent]);

  const generateMockBid = (solver: SolverInfo, intent: IntentRequest): SolverBid => {
    const baseAmount = parseFloat(intent.minToAmount);
    const improvement = 1 + (Math.random() * 0.1); // 0-10% improvement
    const outputAmount = (baseAmount * improvement).toString();
    
    return {
      id: `bid-${solver.id}-${Date.now()}`,
      solverId: solver.id,
      intentId: intent.id,
      outputAmount,
      executionTime: Math.floor(solver.avgExecutionTime * (0.8 + Math.random() * 0.4)),
      gasCost: (Math.random() * 50 + 10).toString(),
      confidence: 0.85 + Math.random() * 0.14,
      route: generateMockRoute(intent),
      timestamp: Date.now(),
      status: 'pending'
    };
  };

  const generateMockRoute = (intent: IntentRequest) => {
    const routes = [
      `${intent.fromToken.symbol}  DEX A  ${intent.toToken.symbol}`,
      `${intent.fromToken.symbol}  Bridge  DEX B  ${intent.toToken.symbol}`,
      `${intent.fromToken.symbol}  AMM  ${intent.toToken.symbol}`,
      `${intent.fromToken.symbol}  Aggregator  ${intent.toToken.symbol}`
    ];
    return routes[Math.floor(Math.random() * routes.length)];
  };

  const bestBid = bids[0];
  const improvement = bestBid ? 
    ((parseFloat(bestBid.outputAmount) - parseFloat(intent.minToAmount)) / parseFloat(intent.minToAmount) * 100) : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Competition Status */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-purple-50 to-green-50 opacity-60" />
        
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-600" />
            Solver Competition
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {bids.length} solvers competing
            </div>
            {phase === 'collecting' && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {timeLeft}s remaining
              </div>
            )}
            <div className="flex items-center gap-1">
              <Activity className={cn(
                "h-4 w-4",
                phase === 'collecting' && "animate-pulse text-green-500"
              )} />
              {phase === 'collecting' && 'Live auction'}
              {phase === 'evaluating' && 'Evaluating bids'}
              {phase === 'selected' && 'Best solver selected'}
              {phase === 'executing' && 'Executing intent'}
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-4">
          {/* Best Bid Highlight */}
          {bestBid && (
            <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-blue-50 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium">Current Best Offer</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  +{formatPercentage(improvement, 2)} better
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Output Amount</div>
                  <div className="font-semibold">
                    {formatTokenAmount(bestBid.outputAmount)} {intent.toToken.symbol}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Execution Time</div>
                  <div className="font-semibold">{bestBid.executionTime}s</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Solver</div>
                  <div className="font-semibold">
                    {MOCK_SOLVERS.find(s => s.id === bestBid.solverId)?.name}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {phase === 'collecting' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Auction Progress</span>
                <span>{30 - timeLeft}/30s</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${((30 - timeLeft) / 30) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Solver Bids List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Bids</CardTitle>
        </CardHeader>
        <CardContent>
          {bids.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Waiting for solver bids...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bids.map((bid, index) => (
                <SolverBidCard 
                  key={bid.id}
                  bid={bid}
                  solver={MOCK_SOLVERS.find(s => s.id === bid.solverId)!}
                  intent={intent}
                  rank={index + 1}
                  isSelected={selectedBid?.id === bid.id}
                  isWinning={index === 0}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competition Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">Best Improvement</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              +{formatPercentage(improvement, 2)}
            </div>
            <div className="text-xs text-muted-foreground">
              vs. minimum amount
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">TEE Verified</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {bids.filter(bid => MOCK_SOLVERS.find(s => s.id === bid.solverId)?.teeVerified).length}/{bids.length}
            </div>
            <div className="text-xs text-muted-foreground">
              solvers verified
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Avg. Speed</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {bids.length > 0 ? Math.round(bids.reduce((acc, bid) => acc + bid.executionTime, 0) / bids.length) : 0}s
            </div>
            <div className="text-xs text-muted-foreground">
              execution time
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface SolverBidCardProps {
  bid: SolverBid;
  solver: SolverInfo;
  intent: IntentRequest;
  rank: number;
  isSelected: boolean;
  isWinning: boolean;
}

function SolverBidCard({ bid, solver, intent, rank, isSelected, isWinning }: SolverBidCardProps) {
  const improvement = ((parseFloat(bid.outputAmount) - parseFloat(intent.minToAmount)) / parseFloat(intent.minToAmount) * 100);
  const outputUsdValue = intent.toToken.priceUSD ? parseFloat(bid.outputAmount) * intent.toToken.priceUSD : null;

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-all",
      isSelected && "ring-2 ring-green-200 border-green-300 bg-green-50",
      isWinning && !isSelected && "border-yellow-300 bg-yellow-50",
      !isSelected && !isWinning && "border-border hover:border-muted-foreground"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
            rank === 1 && "bg-yellow-100 text-yellow-700",
            rank === 2 && "bg-gray-100 text-gray-700", 
            rank === 3 && "bg-orange-100 text-orange-700",
            rank > 3 && "bg-muted text-muted-foreground"
          )}>
            {rank}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{solver.name}</span>
              {solver.teeVerified && (
                <Shield className="h-3 w-3 text-blue-600" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatPercentage(solver.reputation * 100, 1)} reputation
            </div>
          </div>
        </div>
        
        {isSelected && (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Selected</span>
          </div>
        )}
        
        {isWinning && !isSelected && (
          <div className="text-yellow-600 text-sm font-medium">
            Leading
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground mb-1">Output</div>
          <div className="font-semibold">
            {formatTokenAmount(bid.outputAmount)}
          </div>
          {outputUsdValue && (
            <div className="text-xs text-muted-foreground">
              {formatUSDAmount(outputUsdValue)}
            </div>
          )}
        </div>
        
        <div>
          <div className="text-muted-foreground mb-1">Improvement</div>
          <div className={cn(
            "font-semibold",
            improvement > 0 ? "text-green-600" : "text-muted-foreground"
          )}>
            {improvement > 0 ? '+' : ''}{formatPercentage(improvement, 2)}
          </div>
        </div>
        
        <div>
          <div className="text-muted-foreground mb-1">Speed</div>
          <div className="font-semibold">{bid.executionTime}s</div>
        </div>
        
        <div>
          <div className="text-muted-foreground mb-1">Confidence</div>
          <div className="font-semibold">
            {formatPercentage(bid.confidence * 100, 0)}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t">
        <div className="text-xs text-muted-foreground">
          <strong>Route:</strong> {bid.route}
        </div>
      </div>
    </div>
  );
}