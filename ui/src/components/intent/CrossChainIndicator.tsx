/**
 * Cross-Chain Indicator Component
 * Shows information about cross-chain swaps and estimated fees/time
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Clock, DollarSign, Shield, Info } from 'lucide-react';
import { cn } from '@/utils/utils';
import { TokenInfo, ChainId } from '@/types/intent';
import { isCosmosChain, getCosmosChainInfo } from '@/utils/cosmos';

interface CrossChainIndicatorProps {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  className?: string;
}

export function CrossChainIndicator({ fromToken, toToken, className }: CrossChainIndicatorProps) {
  const isCrossChain = fromToken.chainId !== toToken.chainId;
  const isToCosmosChain = isCosmosChain(toToken.chainId);
  const isFromCosmosChain = isCosmosChain(fromToken.chainId);
  
  // Don't show if it's a same-chain swap
  if (!isCrossChain) return null;
  
  const fromChainInfo = getChainInfo(fromToken.chainId);
  const toChainInfo = isToCosmosChain ? getCosmosChainInfo(toToken.chainId) : getChainInfo(toToken.chainId);
  
  // Estimated fees and time based on chain types
  const getSwapEstimates = () => {
    if (isToCosmosChain || isFromCosmosChain) {
      return {
        estimatedTime: '8-12 minutes',
        bridgeFee: '~$2-5',
        gasFee: '~$1-3',
        complexity: 'Advanced',
        security: 'HTLC + Atomic Swaps'
      };
    } else {
      return {
        estimatedTime: '5-8 minutes', 
        bridgeFee: '~$1-3',
        gasFee: '~$0.50-2',
        complexity: 'Standard',
        security: 'Bridge Protocol'
      };
    }
  };
  
  const estimates = getSwapEstimates();

  return (
    <Card className={cn('border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20', className)}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Cross-Chain Swap
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {fromChainInfo?.name} → {toChainInfo?.name}
              </p>
            </div>
          </div>

          {/* Chain Flow Visualization */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 border">
            <div className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded-full', fromChainInfo?.color || 'bg-gray-400')} />
              <span className="text-sm font-medium">{fromChainInfo?.name}</span>
            </div>
            <ArrowRightLeft className="h-4 w-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded-full', toChainInfo?.color || 'bg-gray-400')} />
              <span className="text-sm font-medium">{toChainInfo?.name}</span>
            </div>
          </div>

          {/* Estimates Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <div className="font-medium">Est. Time</div>
                <div className="text-gray-600 dark:text-gray-400">{estimates.estimatedTime}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <div>
                <div className="font-medium">Bridge Fee</div>
                <div className="text-gray-600 dark:text-gray-400">{estimates.bridgeFee}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <div>
                <div className="font-medium">Security</div>
                <div className="text-gray-600 dark:text-gray-400">{estimates.security}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <div>
                <div className="font-medium">Complexity</div>
                <div className="text-gray-600 dark:text-gray-400">{estimates.complexity}</div>
              </div>
            </div>
          </div>

          {/* Special Cosmos message */}
          {(isToCosmosChain || isFromCosmosChain) && (
            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-2" />
                <div className="text-sm">
                  <div className="font-medium text-purple-900 dark:text-purple-100 mb-1">
                    Cosmos Integration
                  </div>
                  <div className="text-purple-700 dark:text-purple-300">
                    This swap uses 1inch Fusion+ with Cosmos blockchain integration. 
                    Your tokens will be swapped atomically using HTLC (Hash Time Locked Contracts) 
                    for maximum security.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status badges */}
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              Atomic Swap
            </Badge>
            <Badge variant="outline" className="text-xs">
              Non-Custodial
            </Badge>
            {(isToCosmosChain || isFromCosmosChain) && (
              <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200">
                Cosmos Ready
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to get chain info for non-Cosmos chains
function getChainInfo(chainId: ChainId) {
  const chainMapping = {
    ethereum: { name: 'Ethereum', color: 'bg-blue-500' },
    near: { name: 'NEAR Protocol', color: 'bg-green-500' },
    bitcoin: { name: 'Bitcoin', color: 'bg-orange-500' },
    osmosis: { name: 'Osmosis', color: 'bg-purple-400' },
    stargaze: { name: 'Stargaze', color: 'bg-red-500' },
    akash: { name: 'Akash', color: 'bg-green-500' },
  };
  
  return chainMapping[chainId] || { name: chainId, color: 'bg-gray-400' };
}

export default CrossChainIndicator;