/**
 * Intent Preview - Shows a detailed preview of the intent before submission
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  ArrowRight, 
  Clock, 
  Percent, 
  Shield, 
  Zap, 
  DollarSign,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/utils/utils';
import { IntentRequest } from '@/types/intent';
import { 
  formatTokenAmount, 
  formatUSDAmount, 
  formatPercentage, 
  formatDuration,
  truncateAddress 
} from '@/utils/utils';

interface IntentPreviewProps {
  intent: IntentRequest;
  className?: string;
}

export function IntentPreview({ intent, className }: IntentPreviewProps) {
  const deadlineSeconds = intent.deadline - Math.floor(Date.now() / 1000);
  const isValidDeadline = deadlineSeconds > 0;
  
  const priorityConfig = {
    speed: { 
      icon: <Zap className="h-4 w-4" />, 
      label: 'Speed First',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    cost: { 
      icon: <DollarSign className="h-4 w-4" />, 
      label: 'Best Price',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    security: { 
      icon: <Shield className="h-4 w-4" />, 
      label: 'Maximum Security',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  };

  const priority = priorityConfig[intent.prioritize];
  
  const fromUsdValue = intent.fromToken?.priceUSD 
    ? parseFloat(intent.fromAmount) * intent.fromToken.priceUSD
    : null;
    
  const toUsdValue = intent.toToken?.priceUSD 
    ? parseFloat(intent.minToAmount) * intent.toToken.priceUSD
    : null;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="bg-gradient-to-r from-near-50 to-bitcoin-50">
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-near-600" />
          Intent Preview
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Review your intent before submitting to solvers
        </p>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {/* Trade Summary */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Trade Summary</h3>
          
          <div className="flex items-center gap-4">
            {/* From Token */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {intent.fromToken?.symbol?.slice(0, 2) || 'N/A'}
                  </div>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
                    intent.fromToken?.chainId === 'near' && 'bg-near-500',
                    intent.fromToken?.chainId === 'ethereum' && 'bg-blue-500',
                    intent.fromToken?.chainId === 'bitcoin' && 'bg-bitcoin-500'
                  )} />
                </div>
                <div>
                  <div className="font-medium">{intent.fromToken?.symbol || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {intent.fromToken?.chainId || 'unknown'}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-semibold">
                  {formatTokenAmount(intent.fromAmount)} {intent.fromToken?.symbol || ''}
                </div>
                {fromUsdValue && (
                  <div className="text-sm text-muted-foreground">
                    {formatUSDAmount(fromUsdValue)}
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0">
              <div className="p-2 rounded-full bg-near-100">
                <ArrowRight className="h-4 w-4 text-near-600" />
              </div>
            </div>

            {/* To Token */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {intent.toToken?.symbol?.slice(0, 2) || 'N/A'}
                  </div>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
                    intent.toToken?.chainId === 'near' && 'bg-near-500',
                    intent.toToken?.chainId === 'ethereum' && 'bg-blue-500',
                    intent.toToken?.chainId === 'bitcoin' && 'bg-bitcoin-500'
                  )} />
                </div>
                <div>
                  <div className="font-medium">{intent.toToken?.symbol || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {intent.toToken?.chainId || 'unknown'}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-semibold">
                  ≥ {formatTokenAmount(intent.minToAmount)} {intent.toToken?.symbol || ''}
                </div>
                {toUsdValue && (
                  <div className="text-sm text-muted-foreground">
                    ≥ {formatUSDAmount(toUsdValue)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Intent Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Intent Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority */}
            <div className={cn(
              "p-3 rounded-lg border",
              priority.bgColor
            )}>
              <div className="flex items-center gap-2 mb-1">
                <div className={priority.color}>
                  {priority.icon}
                </div>
                <span className="text-sm font-medium">Priority</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {priority.label}
              </div>
            </div>

            {/* Slippage */}
            <div className="p-3 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Max Slippage</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatPercentage(intent.maxSlippage / 100, 1)}
              </div>
            </div>

            {/* Deadline */}
            <div className={cn(
              "p-3 rounded-lg border",
              isValidDeadline ? "bg-muted/50" : "bg-red-50 border-red-200"
            )}>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Deadline</span>
              </div>
              <div className={cn(
                "text-sm",
                isValidDeadline ? "text-muted-foreground" : "text-red-600"
              )}>
                {isValidDeadline 
                  ? formatDuration(deadlineSeconds)
                  : 'Expired'
                }
              </div>
            </div>

            {/* Intent ID */}
            <div className="p-3 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">Intent ID</span>
              </div>
              <div className="text-sm text-muted-foreground font-mono">
                {truncateAddress(intent.id, 8, 4)}
              </div>
            </div>
          </div>
        </div>

        {/* Cross-Chain Notice */}
        {intent.fromToken?.chainId !== intent.toToken?.chainId && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-near-50 to-bitcoin-50 border border-near-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="p-1 rounded-full bg-near-500">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-near-800">
                  Cross-Chain Intent Detected
                </div>
                <div className="text-xs text-near-700">
                  This intent will be executed across multiple blockchains using NEAR's 
                  chain signatures and our TEE-verified solver network.
                </div>
                <div className="flex items-center gap-4 text-xs text-near-600 mt-2">
                  <span>• MEV Protection</span>
                  <span>• Atomic Settlement</span>
                  <span>• Gas Optimization</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {!isValidDeadline && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                Transaction Deadline Expired
              </span>
            </div>
            <div className="text-xs text-red-700 mt-1">
              Please update the deadline in advanced preferences before submitting.
            </div>
          </div>
        )}

        {intent.maxSlippage > 500 && (
          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                High Slippage Tolerance
              </span>
            </div>
            <div className="text-xs text-yellow-700 mt-1">
              Your slippage tolerance is above 5%. This may result in significant price impact.
            </div>
          </div>
        )}

        {/* Solver Information */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Solver Network</h3>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• Intent will be broadcast to all available solvers</div>
            <div>• Solvers compete to provide the best execution</div>
            <div>• TEE verification ensures solver integrity</div>
            <div>• Settlement occurs on NEAR with chain signatures</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}