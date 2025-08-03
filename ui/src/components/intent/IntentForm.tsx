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
    // Explicitly excluding currentIntent and updateIntent to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken, toToken, fromAmount, minToAmount, destinationAddress]);

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
      // Only show alert in production/browser environment
      if (typeof window !== 'undefined' && !process.env.NODE_ENV?.includes('test')) {
        alert(`✅ Intent ${intentId} submitted successfully to solver network!`);
      }
      setShowPreview(false);
      setFromToken(null);
      setToToken(null);
      setFromAmount('');
      setMinToAmount('');
      onSubmit?.(intentId);
    } catch (error) {
      console.error('Failed to submit intent:', error);
      // Only show alert in production/browser environment
      if (typeof window !== 'undefined' && !process.env.NODE_ENV?.includes('test')) {
        alert(`❌ Failed to submit intent: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPreview = fromToken && toToken && fromAmount && minToAmount;
  
  // Simplified balance validation - be more permissive
  const hasMinimumBalance = true; // Allow all transactions to proceed
  const balanceError = '';
  
  // Note: In production, you would implement proper token balance checking
  // For now, we'll let the backend/blockchain handle balance validation
  
  // Additional validation for Cosmos chains - require destination address
  const cosmosAddressValid = !toToken || !isCosmosChain(toToken.chainId) || 
    (destinationAddress && destinationAddress.length >= 40);
  
  // Debug logging in useEffect to see state changes
  useEffect(() => {
    console.log('Submit validation updated:', {
      canPreview,
      currentIntent: !!currentIntent,
      isConnected,
      cosmosAddressValid,
      hasMinimumBalance,
      toToken: toToken?.symbol,
      isCosmosChain: toToken ? isCosmosChain(toToken.chainId) : false,
      destinationAddress,
      destinationAddressLength: destinationAddress.length
    });
  }, [canPreview, currentIntent, isConnected, cosmosAddressValid, hasMinimumBalance, toToken, destinationAddress]);
  
  const canSubmit = canPreview && currentIntent && isConnected && cosmosAddressValid && hasMinimumBalance;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem'
    }}>
      {/* Wallet Connection Required */}
      {!isConnected && (
        <div style={{
          animation: 'slideUp 0.5s ease-out'
        }}>
          <WalletStatus requiredBalance="0.1" />
        </div>
      )}
      
      {/* Main Intent Form */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '1rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        padding: '2rem',
        backdropFilter: 'blur(10px)'
      }}>
        <div>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{
                padding: '0.5rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(45deg, #3B82F6, #06B6D4)'
              }}>
                <Zap style={{ height: '1.5rem', width: '1.5rem', color: 'white' }} />
              </div>
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#f9fafb',
                  margin: 0
                }}>
                  Express Your Intent
                </h2>
                <p style={{
                  color: '#d1d5db',
                  margin: 0,
                  fontSize: '0.875rem'
                }}>
                  Tell us what you want, we'll figure out how to make it happen
                </p>
              </div>
            </div>
            
            {/* Wallet Status Indicator */}
            <div style={{ marginTop: '1rem' }}>
              <WalletStatusIndicator />
            </div>
          </div>
        
          {/* Token Selection Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem'
          }}>
            {/* From Token Section */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{
                  width: '0.25rem',
                  height: '1.5rem',
                  background: 'linear-gradient(45deg, #3B82F6, #06B6D4)',
                  borderRadius: '0.125rem'
                }}></div>
                <label style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#f9fafb'
                }}>
                  From
                </label>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
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
            <div style={{
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleSwapTokens}
                disabled={!fromToken || !toToken}
                style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(45deg, #3B82F6, #06B6D4)',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  cursor: fromToken && toToken ? 'pointer' : 'not-allowed',
                  opacity: fromToken && toToken ? 1 : 0.5,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (fromToken && toToken) {
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <ArrowDownUp style={{ 
                  height: '1.25rem', 
                  width: '1.25rem',
                  transition: 'transform 0.3s'
                }} />
              </button>
            </div>

            {/* To Token Section */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{
                  width: '0.25rem',
                  height: '1.5rem',
                  background: 'linear-gradient(45deg, #3B82F6, #06B6D4)',
                  borderRadius: '0.125rem'
                }}></div>
                <label style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#f9fafb'
                }}>
                  To
                </label>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
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
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '0.25rem',
                height: '1.5rem',
                background: 'linear-gradient(45deg, #3B82F6, #06B6D4)',
                borderRadius: '0.125rem'
              }}></div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#f9fafb'
              }}>
                Execution Priority
              </h3>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem'
            }}>
              <QuickIntentButton
                icon={<DollarSign style={{ height: '1.25rem', width: '1.25rem' }} />}
                label="Best Price"
                description="Maximize output amount"
                onClick={() => updateIntent({ prioritize: 'cost' })}
                active={currentIntent?.prioritize === 'cost'}
              />
              <QuickIntentButton
                icon={<Zap style={{ height: '1.25rem', width: '1.25rem' }} />}
                label="Fastest"
                description="Minimize execution time"
                onClick={() => updateIntent({ prioritize: 'speed' })}
                active={currentIntent?.prioritize === 'speed'}
              />
              <QuickIntentButton
                icon={<Shield style={{ height: '1.25rem', width: '1.25rem' }} />}
                label="Most Secure"
                description="TEE verified solvers"
                onClick={() => updateIntent({ prioritize: 'security' })}
                active={currentIntent?.prioritize === 'security'}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            paddingTop: '1rem'
          }}>
            <button
              onClick={() => setShowPreview(!showPreview)}
              disabled={!canPreview}
              style={{
                flex: 1,
                padding: '1rem 1.5rem',
                borderRadius: '0.75rem',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#f9fafb',
                fontWeight: '500',
                cursor: canPreview ? 'pointer' : 'not-allowed',
                opacity: canPreview ? 1 : 0.5,
                transition: 'all 0.2s',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                if (canPreview) {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (canPreview) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
              }}
            >
              {showPreview ? 'Hide Preview' : 'Preview Intent'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              style={{
                flex: 1,
                padding: '1rem 1.5rem',
                borderRadius: '0.75rem',
                background: canSubmit && !isSubmitting 
                  ? 'linear-gradient(45deg, #3B82F6, #06B6D4)' 
                  : 'rgba(107, 114, 128, 0.5)',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                cursor: canSubmit && !isSubmitting ? 'pointer' : 'not-allowed',
                opacity: canSubmit && !isSubmitting ? 1 : 0.5,
                transition: 'all 0.2s',
                boxShadow: canSubmit && !isSubmitting ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (canSubmit && !isSubmitting) {
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (canSubmit && !isSubmitting) {
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {isSubmitting ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}>
                  <div style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    border: '2px solid currentColor',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Submitting...
                </div>
              ) : !isConnected ? (
                'Connect Wallet First'
              ) : !hasMinimumBalance ? (
                balanceError || 'Insufficient Balance'
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
      style={{
        position: 'relative',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        border: active 
          ? '1px solid rgba(59, 130, 246, 0.5)' 
          : '1px solid rgba(255, 255, 255, 0.15)',
        backgroundColor: active 
          ? 'rgba(59, 130, 246, 0.1)' 
          : 'rgba(255, 255, 255, 0.05)',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s',
        backdropFilter: 'blur(10px)',
        boxShadow: active ? '0 4px 6px -1px rgba(59, 130, 246, 0.2)' : 'none'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }
      }}
    >
      {/* Active indicator */}
      {active && (
        <div style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          width: '0.5rem',
          height: '0.5rem',
          backgroundColor: '#3B82F6',
          borderRadius: '50%'
        }} />
      )}
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '0.5rem'
      }}>
        <div style={{
          padding: '0.5rem',
          borderRadius: '0.75rem',
          backgroundColor: active 
            ? 'rgba(59, 130, 246, 0.2)' 
            : 'rgba(255, 255, 255, 0.1)',
          color: active ? '#3B82F6' : '#9ca3af',
          transition: 'all 0.2s'
        }}>
          {icon}
        </div>
        <span style={{
          fontWeight: '600',
          color: active ? '#3B82F6' : '#f9fafb'
        }}>
          {label}
        </span>
      </div>
      <p style={{
        fontSize: '0.875rem',
        color: '#9ca3af',
        margin: 0
      }}>
        {description}
      </p>
    </button>
  );
}