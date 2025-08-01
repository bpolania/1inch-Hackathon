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
import { useIntentStore } from '@/stores/intentStore';
import { useWalletStore } from '@/stores/walletStore';
import { WalletStatus, WalletStatusIndicator } from '@/components/wallet/WalletStatus';
import { TokenInfo, ChainId, IntentRequest } from '@/types/intent';

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

  // Update intent when form values change
  useEffect(() => {
    if (fromToken && toToken && fromAmount && minToAmount) {
      updateIntent({
        fromToken,
        toToken,
        fromAmount,
        minToAmount,
      });
    }
  }, [fromToken, toToken, fromAmount, minToAmount, updateIntent]);

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
      setShowPreview(false);
      setFromToken(null);
      setToToken(null);
      setFromAmount('');
      setMinToAmount('');
      onSubmit?.(intentId);
    } catch (error) {
      console.error('Failed to submit intent:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPreview = fromToken && toToken && fromAmount && minToAmount;
  const canSubmit = canPreview && currentIntent && isConnected;
  
  // Check if user has sufficient balance (basic check)
  const hasMinimumBalance = balanceFormatted ? parseFloat(balanceFormatted) >= 0.1 : false;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Wallet Connection Required */}
      {!isConnected && (
        <WalletStatus requiredBalance="0.1" />
      )}
      
      {/* Main Intent Form */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-near-50 to-transparent opacity-50" />
        
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-near-500" />
            Express Your Intent
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tell us what you want, we'll figure out how to make it happen
          </p>
          
          {/* Wallet Status Indicator */}
          <div className="mt-3">
            <WalletStatusIndicator />
          </div>
        </CardHeader>
        
        <CardContent className="relative space-y-6">
          {/* From Token Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              From
            </label>
            <div className="space-y-3">
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
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwapTokens}
              disabled={!fromToken || !toToken}
              className="rounded-full border-2 hover:rotate-180 transition-transform duration-300"
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          {/* To Token Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              To
            </label>
            <div className="space-y-3">
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
            </div>
          </div>

          {/* Quick Intent Examples */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <QuickIntentButton
              icon={<DollarSign className="h-4 w-4" />}
              label="Best Price"
              description="Maximize output amount"
              onClick={() => updateIntent({ prioritize: 'cost' })}
              active={currentIntent?.prioritize === 'cost'}
            />
            <QuickIntentButton
              icon={<Zap className="h-4 w-4" />}
              label="Fastest"
              description="Minimize execution time"
              onClick={() => updateIntent({ prioritize: 'speed' })}
              active={currentIntent?.prioritize === 'speed'}
            />
            <QuickIntentButton
              icon={<Shield className="h-4 w-4" />}
              label="Most Secure"
              description="TEE verified solvers"
              onClick={() => updateIntent({ prioritize: 'security' })}
              active={currentIntent?.prioritize === 'security'}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              disabled={!canPreview}
              className="flex-1"
            >
              {showPreview ? 'Hide Preview' : 'Preview Intent'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting || !hasMinimumBalance}
              className="flex-1 bg-gradient-to-r from-near-500 to-bitcoin-500 hover:from-near-600 hover:to-bitcoin-600"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  Submitting...
                </div>
              ) : !isConnected ? (
                'Connect Wallet First'
              ) : !hasMinimumBalance ? (
                'Insufficient NEAR Balance'
              ) : (
                'Submit Intent'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Preferences */}
      <PreferencesPanel />

      {/* Intent Preview */}
      {showPreview && currentIntent && fromToken && toToken && fromAmount && minToAmount && (
        <IntentPreview intent={currentIntent as IntentRequest} />
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
        "p-3 rounded-lg border transition-all text-left space-y-1",
        "hover:border-near-300 hover:bg-near-50",
        active 
          ? "border-near-500 bg-near-50 ring-2 ring-near-200" 
          : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          "p-1 rounded",
          active ? "text-near-600" : "text-muted-foreground"
        )}>
          {icon}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}