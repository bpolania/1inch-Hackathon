/**
 * WalletButton - Main wallet connection button component
 */

'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useWalletStore } from '@/stores/walletStore'
import { Wallet, LogOut, RefreshCw, AlertCircle } from 'lucide-react'
import { formatTokenAmount, cn } from '@/utils/utils'

interface WalletButtonProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
  showBalance?: boolean
  showNetwork?: boolean
  className?: string
}

export function WalletButton({
  variant = 'default',
  size = 'default',
  showBalance = true,
  showNetwork = true,
  className = ''
}: WalletButtonProps) {
  const {
    isConnected,
    isConnecting,
    accountId,
    balanceFormatted,
    networkId,
    connect,
    disconnect,
    refreshBalance
  } = useWalletStore()

  const handleConnect = async () => {
    try {
      await connect()
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      // TODO: Add toast notification
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
      // TODO: Add toast notification
    }
  }

  const handleRefresh = async () => {
    try {
      await refreshBalance()
    } catch (error) {
      console.error('Failed to refresh balance:', error)
      // TODO: Add toast notification
    }
  }

  // Loading state
  if (isConnecting) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={`${className}`}
      >
        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
        Connecting...
      </Button>
    )
  }

  // Not connected state
  if (!isConnected || !accountId) {
    return (
      <button
        onClick={handleConnect}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          borderRadius: '0.75rem',
          background: 'linear-gradient(45deg, #3B82F6, #06B6D4)',
          color: 'white',
          border: 'none',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          fontSize: '0.875rem'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <Wallet style={{ height: '1rem', width: '1rem' }} />
        Connect Wallet
      </button>
    )
  }

  // Connected state - compact button for small sizes
  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {accountId.length > 12 
            ? `${accountId.slice(0, 8)}...${accountId.slice(-4)}`
            : accountId
          }
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="h-8 w-8 p-0"
          title="Disconnect wallet"
        >
          <LogOut className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  // Connected state - full card display
  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-near-500/10">
              <Wallet className="h-5 w-5 text-near-600" />
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {accountId.length > 20 
                    ? `${accountId.slice(0, 16)}...${accountId.slice(-4)}`
                    : accountId
                  }
                </span>
                {showNetwork && (
                  <Badge 
                    variant={networkId === 'mainnet' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {networkId}
                  </Badge>
                )}
              </div>
              
              {showBalance && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">
                    {balanceFormatted ? `${formatTokenAmount(balanceFormatted)} NEAR` : 'Loading...'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    className="h-4 w-4 p-0"
                    title="Refresh balance"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" title="Connected" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="text-muted-foreground hover:text-foreground"
              title="Disconnect wallet"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for navigation/headers - 1inch style
export function WalletButtonCompact({ className = '' }: { className?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <WalletButton
        variant="default"
        size="default"
        showBalance={false}
        showNetwork={false}
        className=""
      />
    </div>
  )
}

// Full display version for dashboard/main areas
export function WalletCard({ className = '' }: { className?: string }) {
  return (
    <WalletButton
      variant="default"
      size="lg"
      showBalance={true}
      showNetwork={true}
      className={className}
    />
  )
}