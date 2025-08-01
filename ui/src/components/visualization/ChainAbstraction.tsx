/**
 * Chain Abstraction Visualization - Shows how NEAR Intents abstract away chain complexity
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  Layers, 
  Shield, 
  Zap, 
  Link,
  CheckCircle,
  Clock,
  Activity,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/utils/utils';
import { IntentRequest, ChainId } from '@/types/intent';
import { formatTokenAmount, formatDuration } from '@/utils/utils';

interface ChainAbstractionProps {
  intent?: IntentRequest;
  className?: string;
}

interface ChainStep {
  id: string;
  chainId: ChainId;
  action: string;
  description: string;
  status: 'pending' | 'executing' | 'completed';
  txHash?: string;
  gasUsed?: string;
  timeElapsed?: number;
}

export function ChainAbstraction({ intent, className }: ChainAbstractionProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);

  // Mock execution steps for visualization
  const executionSteps: ChainStep[] = intent ? [
    {
      id: 'step-1',
      chainId: intent.fromToken.chainId,
      action: 'Lock Tokens',
      description: `Lock ${formatTokenAmount(intent.fromAmount)} ${intent.fromToken.symbol}`,
      status: animationStep >= 1 ? 'completed' : animationStep === 0 ? 'executing' : 'pending',
      txHash: '0x123...456',
      gasUsed: '21000',
      timeElapsed: 3
    },
    {
      id: 'step-2',
      chainId: 'near',
      action: 'Chain Signatures',
      description: 'Generate cross-chain transaction signatures',
      status: animationStep >= 2 ? 'completed' : animationStep === 1 ? 'executing' : 'pending',
      txHash: 'CdZx...8Vm9',
      gasUsed: '0.003',
      timeElapsed: 2
    },
    {
      id: 'step-3',
      chainId: intent.toToken.chainId,
      action: 'Execute Swap',
      description: `Swap to ${intent.toToken.symbol}`,
      status: animationStep >= 3 ? 'completed' : animationStep === 2 ? 'executing' : 'pending',
      txHash: '0x789...012',
      gasUsed: '120000',
      timeElapsed: 5
    },
    {
      id: 'step-4',
      chainId: intent.toToken.chainId,
      action: 'Transfer Tokens',
      description: `Transfer ${formatTokenAmount(intent.minToAmount)} ${intent.toToken.symbol} to user`,
      status: animationStep >= 4 ? 'completed' : animationStep === 3 ? 'executing' : 'pending',
      txHash: '0x345...678',
      gasUsed: '21000',
      timeElapsed: 2
    }
  ] : [];

  // Animate through steps
  useEffect(() => {
    if (!intent || animationStep >= executionSteps.length) return;

    const timer = setTimeout(() => {
      setAnimationStep(prev => prev + 1);
    }, 3000);

    return () => clearTimeout(timer);
  }, [animationStep, executionSteps.length, intent]);

  const chainInfo = {
    near: { 
      name: 'NEAR', 
      color: 'bg-near-500', 
      textColor: 'text-near-600',
      bgColor: 'bg-near-50',
      borderColor: 'border-near-200'
    },
    ethereum: { 
      name: 'Ethereum', 
      color: 'bg-blue-500', 
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    bitcoin: { 
      name: 'Bitcoin', 
      color: 'bg-bitcoin-500', 
      textColor: 'text-bitcoin-600',
      bgColor: 'bg-bitcoin-50',
      borderColor: 'border-bitcoin-200'
    },
  };

  if (!intent) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-near-600" />
            Chain Abstraction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Submit an intent to see chain abstraction in action</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isXChain = intent.fromToken.chainId !== intent.toToken.chainId;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-near-50 via-purple-50 to-blue-50 opacity-60" />
        
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-near-600" />
            Chain Abstraction Layer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            See how NEAR Intents hide blockchain complexity from users
          </p>
        </CardHeader>

        <CardContent className="relative space-y-4">
          {/* User View vs Technical View Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "px-3 py-1 rounded-full text-sm font-medium",
                isXChain ? "bg-gradient-to-r from-near-100 to-bitcoin-100 text-near-700" : "bg-muted"
              )}>
                {isXChain ? 'Cross-Chain Intent' : 'Single-Chain Intent'}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className={cn(
                  "h-4 w-4",
                  animationStep < executionSteps.length && "animate-pulse text-green-500"
                )} />
                Step {Math.min(animationStep + 1, executionSteps.length)} of {executionSteps.length}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="flex items-center gap-2"
            >
              {showTechnicalDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showTechnicalDetails ? 'Hide' : 'Show'} Technical Details
            </Button>
          </div>

          {/* User Perspective */}
          <div className="p-4 rounded-lg bg-white/80 border">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <div className="p-1 rounded bg-green-100">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              What the User Sees
            </h3>
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <div className="p-3 rounded-lg bg-gray-100 mb-2">
                  <span className="text-lg font-semibold">{intent.fromToken.symbol}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatTokenAmount(intent.fromAmount)}
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-near-100 to-bitcoin-100">
                  <Zap className="h-4 w-4 text-near-600" />
                  <span className="text-sm font-medium">Magic Happens</span>
                  <ArrowRight className="h-4 w-4 text-near-600" />
                </div>
              </div>

              <div className="text-center">
                <div className="p-3 rounded-lg bg-gray-100 mb-2">
                  <span className="text-lg font-semibold">{intent.toToken.symbol}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  ≥ {formatTokenAmount(intent.minToAmount)}
                </div>
              </div>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              No need to understand bridges, gas tokens, or multiple transactions
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Implementation */}
      {showTechnicalDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Technical Implementation</CardTitle>
            <p className="text-sm text-muted-foreground">
              Behind the scenes: multi-chain execution with NEAR Chain Signatures
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {executionSteps.map((step, index) => (
                <ExecutionStep 
                  key={step.id}
                  step={step}
                  chainInfo={chainInfo[step.chainId]}
                  isActive={animationStep === index}
                  isCompleted={animationStep > index}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Secure</span>
            </div>
            <p className="text-sm text-muted-foreground">
              TEE-verified solvers and atomic settlement ensure security
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-600" />
              <span className="font-medium">Simple</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Express intent once, execution happens automatically
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Link className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Connected</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Seamless cross-chain operations without bridges
            </p>
          </CardContent>
        </Card>
      </div>

      {/* NEAR Chain Signatures Explanation */}
      {isXChain && (
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-near-50 to-bitcoin-50 opacity-40" />
          
          <CardHeader className="relative">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1 rounded bg-near-500">
                <Link className="h-4 w-4 text-white" />
              </div>
              NEAR Chain Signatures
            </CardTitle>
          </CardHeader>

          <CardContent className="relative space-y-3">
            <p className="text-sm text-muted-foreground">
              This cross-chain intent is powered by NEAR's Chain Signatures technology:
            </p>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-near-500 mt-2 flex-shrink-0" />
                <span>NEAR validators collectively control accounts on other blockchains</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-near-500 mt-2 flex-shrink-0" />
                <span>Threshold signatures enable atomic cross-chain execution</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-near-500 mt-2 flex-shrink-0" />
                <span>No token wrapping or bridge contracts required</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-near-500 mt-2 flex-shrink-0" />
                <span>Users interact with a single interface for any chain</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ExecutionStepProps {
  step: ChainStep;
  chainInfo: {
    name: string;
    color: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
  };
  isActive: boolean;
  isCompleted: boolean;
}

function ExecutionStep({ step, chainInfo, isActive, isCompleted }: ExecutionStepProps) {
  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-gray-400" />,
    executing: <Activity className="h-4 w-4 text-blue-500 animate-pulse" />,
    completed: <CheckCircle className="h-4 w-4 text-green-500" />
  };

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border transition-all",
      isActive && "ring-2 ring-blue-200 border-blue-300 bg-blue-50",
      isCompleted && "bg-green-50 border-green-200",
      !isActive && !isCompleted && "bg-gray-50 border-gray-200"
    )}>
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {statusIcon[step.status]}
      </div>

      {/* Chain Badge */}
      <div className={cn(
        "px-3 py-1 rounded-full text-xs font-medium border",
        chainInfo.bgColor,
        chainInfo.textColor,
        chainInfo.borderColor
      )}>
        {chainInfo.name}
      </div>

      {/* Step Details */}
      <div className="flex-1">
        <div className="font-medium text-sm">{step.action}</div>
        <div className="text-xs text-muted-foreground">{step.description}</div>
      </div>

      {/* Technical Details */}
      {isCompleted && step.txHash && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Tx: {step.txHash}</div>
          {step.gasUsed && <div>Gas: {step.gasUsed}</div>}
          {step.timeElapsed && <div>Time: {formatDuration(step.timeElapsed)}</div>}
        </div>
      )}

      {/* Loading Animation */}
      {isActive && (
        <div className="flex-shrink-0">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}