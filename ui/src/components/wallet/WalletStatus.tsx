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
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-medium">Wallet Connection Required</h3>
                <p className="text-sm text-muted-foreground">
                  Connect your NEAR wallet to create intents
                </p>
              </div>
            </div>
            <Button 
              onClick={connect} 
              disabled={isConnecting}
              className="shrink-0"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect Wallet
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Connected state
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Wallet Connected</span>
          </div>
          <Badge 
            variant={networkId === 'mainnet' ? 'default' : 'secondary'}
            className="text-xs"
          >
            <Network className="h-3 w-3 mr-1" />
            {networkId}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Account Info */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-sm font-medium">Account</p>
            <p className="text-xs text-muted-foreground font-mono">
              {accountId}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`https://${networkId === 'mainnet' ? '' : 'testnet.'}nearblocks.io/address/${accountId}`, '_blank')}
            className="h-8 w-8 p-0"
            title="View on NEAR Explorer"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>

        {/* Balance Info */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-sm font-medium">NEAR Balance</p>
            <p className="text-lg font-semibold">
              {balanceFormatted ? formatTokenAmount(balanceFormatted) : 'Click refresh to load'} NEAR
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshBalance}
            className="h-8 w-8 p-0"
            title="Refresh balance"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* Balance Warning */}
        {!hasMinimumBalance && balance && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need at least {requiredBalance} NEAR to create intents and pay for gas fees.
              {networkId === 'testnet' && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto ml-1 text-blue-600"
                  onClick={() => window.open('https://near-faucet.io/', '_blank')}
                >
                  Get testnet NEAR from faucet
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Network Warning for Testnet */}
        {networkId === 'testnet' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You're connected to NEAR testnet. Intents created here are for testing only.
            </AlertDescription>
          </Alert>
        )}

        {/* Additional Details */}
        {showFullDetails && (
          <div className="space-y-2 pt-2 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Network</p>
                <p className="font-medium capitalize">{networkId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="font-medium">Connected</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Simple status indicator for forms
export function WalletStatusIndicator({ className = '' }: { className?: string }) {
  const { isConnected, accountId, networkId } = useWalletStore()

  if (!isConnected) {
    return (
      <div className={`flex items-center gap-2 text-sm text-orange-600 ${className}`}>
        <AlertCircle className="h-4 w-4" />
        <span>Wallet not connected</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-green-600 ${className}`}>
      <CheckCircle className="h-4 w-4" />
      <span>
        Connected to {accountId?.slice(0, 8)}...{accountId?.slice(-4)} ({networkId})
      </span>
    </div>
  )
}