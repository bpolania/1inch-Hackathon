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
      <div className={`bg-card rounded-xl border border-border shadow-sm animate-fade-in ${className}`}>
        <div className="p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">Wallet Connection Required</h3>
                <p className="text-muted-foreground">
                  Connect your NEAR wallet to create intents
                </p>
              </div>
            </div>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="h-5 w-5 mr-2" />
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
      <div className={`flex items-center gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/20 ${className}`}>
        <div className="p-1 rounded-lg bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
        </div>
        <span className="text-sm font-medium text-card-foreground">Wallet not connected</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl bg-tee-50 border border-tee-200 animate-fade-in ${className}`}>
      <div className="p-1 rounded-lg bg-tee-100">
        <CheckCircle className="h-4 w-4 text-tee-600" />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-card-foreground">
          Connected to {accountId?.slice(0, 8)}...{accountId?.slice(-4)}
        </span>
        <div className="px-2 py-1 rounded-full bg-tee-100 text-xs font-medium text-tee-700">
          {networkId}
        </div>
      </div>
    </div>
  )
}