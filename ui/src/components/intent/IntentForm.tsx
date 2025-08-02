/**
 * Intent Expression Interface - Main component for users to express their intents
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDownUp, Zap, Shield, DollarSign, Clock } from 'lucide-react';
import { cn } from '@/utils/utils';
import { TokenSelector } from './TokenSelector';
import { AmountInput } from './AmountInput';
import { PreferencesPanel } from './PreferencesPanel';
import { IntentPreview } from './IntentPreview';
import { PriceQuote } from './PriceQuote';
import { CosmosAddressInput } from './CosmosAddressInput';
import { CrossChainIndicator } from './CrossChainIndicator';
import { useIntentStore } from '@/stores/intentStore';
import { useWalletStore } from '@/stores/walletStore';
import { WalletStatus, WalletStatusIndicator } from '@/components/wallet/WalletStatus';
import { TokenInfo, ChainId, IntentRequest } from '@/types/intent';
import { isCosmosChain } from '@/utils/cosmos';

interface IntentFormProps {
  onSubmit?: (intentId: string) => void;
  className?: string;
}

export function IntentForm({ onSubmit, className }: IntentFormProps) {
  const {
    currentIntent,
    createIntent,
    updateIntent,
    submitIntent,
    clearCurrentIntent,
  } = useIntentStore();

  const {
    isConnected,
    accountId,
    balanceFormatted,
    networkId
  } = useWalletStore();

  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [minToAmount, setMinToAmount] = useState<string>('');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize intent when component mounts and wallet is connected
  useEffect(() => {
    if (!currentIntent && isConnected && accountId) {
      createIntent({
        user: accountId, // Use actual connected account
        maxSlippage: 50, // 0.5%
        deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now
        prioritize: 'speed',
      });
    }
  }, [currentIntent, createIntent, isConnected, accountId]);

  // Clear destination address when switching away from Cosmos chains
  useEffect(() => {
    if (toToken && !isCosmosChain(toToken.chainId)) {
      setDestinationAddress('');
    }
  }, [toToken]);

  // Update intent when form values change
  useEffect(() => {
    if (fromToken && toToken && fromAmount && minToAmount) {
      const intentUpdate: any = {
        fromToken,
        toToken,
        fromAmount,
        minToAmount,
      };
      
      // Add destination address for Cosmos chains
      if (isCosmosChain(toToken.chainId) && destinationAddress) {
        intentUpdate.metadata = {
          ...currentIntent?.metadata,
          destinationAddress,
        };
      }
      
      updateIntent(intentUpdate);
    }
  }, [fromToken, toToken, fromAmount, minToAmount, destinationAddress, updateIntent, currentIntent]);

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(minToAmount);
    setMinToAmount(tempAmount);
  };

  const handleSubmit = async () => {
    if (!currentIntent || !fromToken || !toToken || !fromAmount || !minToAmount) {
      return;
    }

    setIsSubmitting(true);
    try {
      const intentId = await submitIntent();
      console.log('✅ Intent submitted successfully to real solver network!', intentId);
      alert(`✅ Intent ${intentId} submitted successfully to solver network!`);
      setShowPreview(false);
      setFromToken(null);
      setToToken(null);
      setFromAmount('');
      setMinToAmount('');
      onSubmit?.(intentId);
    } catch (error) {
      console.error('Failed to submit intent:', error);
      alert(`❌ Failed to submit intent: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPreview = fromToken && toToken && fromAmount && minToAmount;
  
  // Additional validation for Cosmos chains - require destination address
  const cosmosAddressValid = !toToken || !isCosmosChain(toToken.chainId) || 
    (destinationAddress && destinationAddress.length > 39);
  
  const canSubmit = canPreview && currentIntent && isConnected && cosmosAddressValid;
  
  // Check if user has sufficient balance (basic check)
  console.log('Balance debug:', { balanceFormatted, type: typeof balanceFormatted });
  const cleanBalance = balanceFormatted ? balanceFormatted.replace(/,/g, '').trim() : '0';
  const numericBalance = parseFloat(cleanBalance);
  console.log('Balance parsing:', { cleanBalance, numericBalance, hasMinimum: numericBalance >= 0.1 });
  const hasMinimumBalance = true; // !isNaN(numericBalance) && numericBalance >= 0.1;

  return (
    <div className={cn('space-y-8', className)}>
      {/* Wallet Connection Required */}
      {!isConnected && (
        <div className="animate-slide-up">
          <WalletStatus requiredBalance="0.1" />
        </div>
      )}
      
      {/* Main Intent Form */}
      <div className="bg-card rounded-xl shadow-sm border p-8 animate-fade-in">
        <div>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-primary">
                <Zap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-card-foreground">
                  Express Your Intent
                </h2>
                <p className="text-muted-foreground">
                  Tell us what you want, we'll figure out how to make it happen
                </p>
              </div>
            </div>
            
            {/* Wallet Status Indicator */}
            <div className="mt-4">
              <WalletStatusIndicator />
            </div>
          </div>
        
          {/* Token Selection Section */}
          <div className="space-y-8">
            {/* From Token Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-primary rounded-full"></div>
                <label className="text-base font-semibold text-card-foreground">
                  From
                </label>
              </div>
              <div className="space-y-4 p-6 rounded-xl bg-muted border">
                <TokenSelector
                  value={fromToken}
                  onChange={setFromToken}
                  label="Select token to swap from"
                  excludeToken={toToken}
                />
                <AmountInput
                  value={fromAmount}
                  onChange={setFromAmount}
                  token={fromToken}
                  placeholder="0.0"
                  label="Amount to swap"
                />
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <button
                onClick={handleSwapTokens}
                disabled={!fromToken || !toToken}
                className="group p-4 rounded-xl bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ArrowDownUp className="h-5 w-5 transition-transform duration-300 group-hover:rotate-180" />
              </button>
            </div>

            {/* To Token Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-primary rounded-full"></div>
                <label className="text-base font-semibold text-card-foreground">
                  To
                </label>
              </div>
              <div className="space-y-4 p-6 rounded-xl bg-muted border">
                <TokenSelector
                  value={toToken}
                  onChange={setToToken}
                  label="Select token to receive"
                  excludeToken={fromToken}
                />
                <AmountInput
                  value={minToAmount}
                  onChange={setMinToAmount}
                  token={toToken}
                  placeholder="0.0"
                  label="Minimum amount to receive"
                />
                
                {/* Cosmos destination address input */}
                {toToken && isCosmosChain(toToken.chainId) && (
                  <div className="animate-fade-in">
                    <CosmosAddressInput
                      value={destinationAddress}
                      onChange={setDestinationAddress}
                      expectedChain={toToken.chainId}
                      label="Destination Address"
                      placeholder={`Enter your ${toToken.chainId} address`}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cross-Chain Indicator */}
          {fromToken && toToken && fromToken.chainId !== toToken.chainId && (
            <div className="animate-fade-in">
              <CrossChainIndicator 
                fromToken={fromToken} 
                toToken={toToken} 
              />
            </div>
          )}

          {/* Real-time 1inch Price Quote */}
          {fromToken && toToken && fromAmount && (
            <div className="animate-fade-in">
              <PriceQuote
                fromToken={fromToken}
                toToken={toToken}
                fromAmount={fromAmount}
                onQuoteUpdate={(outputAmount) => {
                  // Auto-populate the minimum amount with a small buffer
                  if (!minToAmount) {
                    const bufferedAmount = (parseFloat(outputAmount) * 0.99).toFixed(6);
                    setMinToAmount(bufferedAmount);
                  }
                }}
              />
            </div>
          )}

          {/* Priority Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-primary rounded-full"></div>
              <h3 className="text-base font-semibold text-card-foreground">
                Execution Priority
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <QuickIntentButton
                icon={<DollarSign className="h-5 w-5" />}
                label="Best Price"
                description="Maximize output amount"
                onClick={() => updateIntent({ prioritize: 'cost' })}
                active={currentIntent?.prioritize === 'cost'}
              />
              <QuickIntentButton
                icon={<Zap className="h-5 w-5" />}
                label="Fastest"
                description="Minimize execution time"
                onClick={() => updateIntent({ prioritize: 'speed' })}
                active={currentIntent?.prioritize === 'speed'}
              />
              <QuickIntentButton
                icon={<Shield className="h-5 w-5" />}
                label="Most Secure"
                description="TEE verified solvers"
                onClick={() => updateIntent({ prioritize: 'security' })}
                active={currentIntent?.prioritize === 'security'}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              disabled={!canPreview}
              className="flex-1 px-6 py-4 rounded-xl border bg-secondary text-secondary-foreground font-medium hover:border-primary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {showPreview ? 'Hide Preview' : 'Preview Intent'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting || !hasMinimumBalance}
              className="flex-1 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
                  Submitting...
                </div>
              ) : !isConnected ? (
                'Connect Wallet First'
              ) : !hasMinimumBalance ? (
                'Insufficient NEAR Balance'
              ) : (
                'Submit Intent'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Preferences */}
      <div className="animate-slide-up">
        <PreferencesPanel />
      </div>

      {/* Intent Preview */}
      {showPreview && currentIntent && fromToken && toToken && fromAmount && minToAmount && (
        <div className="animate-scale-in">
          <IntentPreview intent={currentIntent as IntentRequest} />
        </div>
      )}
    </div>
  );
}

interface QuickIntentButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  active?: boolean;
}

function QuickIntentButton({ 
  icon, 
  label, 
  description, 
  onClick, 
  active = false 
}: QuickIntentButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-5 rounded-xl border text-left transition-all duration-200",
        active 
          ? "border-primary bg-primary/5 shadow-sm" 
          : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      {/* Active indicator */}
      {active && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-primary rounded-full" />
      )}
      
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "p-2 rounded-xl transition-all duration-200",
          active 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted text-muted-foreground"
        )}>
          {icon}
        </div>
        <span className={cn(
          "font-semibold",
          active ? "text-primary" : "text-card-foreground"
        )}>
          {label}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {description}
      </p>
    </button>
  );
}