/**
 * WalletStatus - Shows wallet connection status and requirements
 */

'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useWalletStore } from '@/stores/walletStore'
import { 
  Wallet, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  ExternalLink,
  Network
} from 'lucide-react'
import { formatTokenAmount } from '@/utils/utils'

interface WalletStatusProps {
  showFullDetails?: boolean
  requiredBalance?: string // Minimum NEAR balance required
  className?: string
}

export function WalletStatus({
  showFullDetails = false,
  requiredBalance = '0.1', // Default minimum for gas fees
  className = ''
}: WalletStatusProps) {
  const {
    isConnected,
    isConnecting,
    accountId,
    balance,
    balanceFormatted,
    networkId,
    connect,
    refreshBalance
  } = useWalletStore()

  const hasMinimumBalance = balance ? 
    parseFloat(balanceFormatted || '0') >= parseFloat(requiredBalance) : 
    false

  // Connection required state
  if (!isConnected) {
    return (
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderRadius: '1rem',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.5s ease-out'
      }}>
        <div style={{ padding: '2rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                padding: '0.75rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)'
              }}>
                <AlertCircle style={{ height: '1.5rem', width: '1.5rem', color: '#ef4444' }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#f9fafb',
                  margin: 0,
                  marginBottom: '0.25rem'
                }}>
                  Wallet Connection Required
                </h3>
                <p style={{
                  color: '#d1d5db',
                  margin: 0,
                  fontSize: '0.875rem'
                }}>
                  Connect your NEAR wallet to create intents
                </p>
              </div>
            </div>
            <button
              onClick={connect}
              disabled={isConnecting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: isConnecting 
                  ? 'rgba(107, 114, 128, 0.5)' 
                  : 'linear-gradient(45deg, #3B82F6, #06B6D4)',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                fontWeight: '600',
                border: 'none',
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                opacity: isConnecting ? 0.5 : 1,
                transition: 'all 0.2s',
                boxShadow: isConnecting ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={(e) => {
                if (!isConnecting) {
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isConnecting) {
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {isConnecting ? (
                <>
                  <RefreshCw style={{ 
                    height: '1.25rem', 
                    width: '1.25rem',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet style={{ height: '1.25rem', width: '1.25rem' }} />
                  Connect Wallet
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Connected state
  return (
    <div className={`bg-card rounded-xl border border-tee-200 shadow-sm animate-fade-in ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-tee-100">
              <CheckCircle className="h-5 w-5 text-tee-600" />
            </div>
            <span className="font-semibold text-card-foreground">Wallet Connected</span>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
            networkId === 'mainnet' 
              ? 'bg-primary/10 text-primary border border-primary/20' 
              : 'bg-muted text-muted-foreground border border-border'
          }`}>
            <Network className="h-3 w-3" />
            {networkId}
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Account Info */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted border">
            <div>
              <p className="text-sm font-medium text-card-foreground">Account</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {accountId}
              </p>
            </div>
            <button
              onClick={() => window.open(`https://${networkId === 'mainnet' ? '' : 'testnet.'}nearblocks.io/address/${accountId}`, '_blank')}
              className="h-10 w-10 rounded-xl bg-secondary hover:bg-primary/10 hover:text-primary transition-all duration-200 flex items-center justify-center"
              title="View on NEAR Explorer"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>

          {/* Balance Info */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted border">
            <div>
              <p className="text-sm font-medium text-card-foreground">NEAR Balance</p>
              <p className="text-lg font-semibold mt-1">
                {balanceFormatted ? formatTokenAmount(balanceFormatted) : 'Click refresh to load'} 
                <span className="text-sm font-normal text-muted-foreground ml-1">NEAR</span>
              </p>
            </div>
            <button
              onClick={refreshBalance}
              className="h-10 w-10 rounded-xl bg-secondary hover:bg-primary/10 hover:text-primary transition-all duration-200 flex items-center justify-center"
              title="Refresh balance"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Balance Warning */}
        {!hasMinimumBalance && balance && (
          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 animate-slide-up">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded-lg bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-card-foreground">
                  You need at least {requiredBalance} NEAR to create intents and pay for gas fees.
                  {networkId === 'testnet' && (
                    <button
                      onClick={() => window.open('https://near-faucet.io/', '_blank')}
                      className="ml-2 text-primary hover:text-primary/80 underline underline-offset-2 font-medium"
                    >
                      Get testnet NEAR from faucet
                    </button>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Network Warning for Testnet */}
        {networkId === 'testnet' && (
          <div className="p-4 rounded-xl bg-bitcoin-50 border border-bitcoin-200">
            <div className="flex items-center gap-3">
              <div className="p-1 rounded-lg bg-bitcoin-100">
                <AlertCircle className="h-4 w-4 text-bitcoin-600" />
              </div>
              <p className="text-sm text-card-foreground">
                You're connected to NEAR testnet. Intents created here are for testing only.
              </p>
            </div>
          </div>
        )}

        {/* Additional Details */}
        {showFullDetails && (
          <div className="space-y-3 pt-4 border-t border-border/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-xs text-muted-foreground mb-1">Network</p>
                <p className="font-semibold capitalize text-card-foreground">{networkId}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-tee-500 animate-pulse" />
                  <span className="font-semibold text-card-foreground">Connected</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Simple status indicator for forms
export function WalletStatusIndicator({ className = '' }: { className?: string }) {
  const { isConnected, accountId, networkId } = useWalletStore()

  if (!isConnected) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        borderRadius: '0.75rem',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      }}>
        <div style={{
          padding: '0.25rem',
          borderRadius: '0.375rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)'
        }}>
          <AlertCircle style={{ height: '1rem', width: '1rem', color: '#ef4444' }} />
        </div>
        <span style={{
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#f9fafb'
        }}>
          Wallet not connected
        </span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem',
      borderRadius: '0.75rem',
      backgroundColor: 'rgba(16, 185, 129, 0.05)',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <div style={{
        padding: '0.25rem',
        borderRadius: '0.375rem',
        backgroundColor: 'rgba(16, 185, 129, 0.1)'
      }}>
        <CheckCircle style={{ height: '1rem', width: '1rem', color: '#10b981' }} />
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem'
      }}>
        <span style={{
          fontWeight: '500',
          color: '#f9fafb'
        }}>
          Connected to {accountId?.slice(0, 8)}...{accountId?.slice(-4)}
        </span>
        <div style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '0.5rem',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fontSize: '0.75rem',
          fontWeight: '500',
          color: '#10b981'
        }}>
          {networkId}
        </div>
      </div>
    </div>
  )
}