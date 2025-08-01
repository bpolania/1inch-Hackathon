/**
 * Token Selector - Multi-chain token selection component
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/utils/utils';
import { TokenInfo, ChainId } from '@/types/intent';
import { formatTokenAmount, formatUSDAmount } from '@/utils/utils';

// Mock token data - in real app this would come from an API
const MOCK_TOKENS: TokenInfo[] = [
  // NEAR tokens
  {
    address: 'near',
    symbol: 'NEAR',
    decimals: 24,
    chainId: 'near',
    logoURI: '/tokens/near.svg',
    priceUSD: 3.45,
  },
  {
    address: 'usdt.tether-token.near',
    symbol: 'USDT',
    decimals: 6,
    chainId: 'near',
    logoURI: '/tokens/usdt.svg',
    priceUSD: 1.00,
  },
  {
    address: 'wrap.near',
    symbol: 'wNEAR',
    decimals: 24,
    chainId: 'near',
    logoURI: '/tokens/wnear.svg',
    priceUSD: 3.45,
  },
  
  // Ethereum tokens
  {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    decimals: 18,
    chainId: 'ethereum',
    logoURI: '/tokens/eth.svg',
    priceUSD: 2340.50,
  },
  {
    address: '0xA0b86a33E6441b53De59C3399b322D45CB1C76d7',
    symbol: 'USDC',
    decimals: 6,
    chainId: 'ethereum',
    logoURI: '/tokens/usdc.svg',
    priceUSD: 1.00,
  },
  {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    decimals: 18,
    chainId: 'ethereum',
    logoURI: '/tokens/dai.svg',
    priceUSD: 1.00,
  },
  
  // Bitcoin (conceptual)
  {
    address: 'btc',
    symbol: 'BTC',
    decimals: 8,
    chainId: 'bitcoin',
    logoURI: '/tokens/btc.svg',
    priceUSD: 43250.00,
  },
];

const CHAIN_INFO = {
  near: { name: 'NEAR', color: 'bg-near-500', textColor: 'text-near-600' },
  ethereum: { name: 'Ethereum', color: 'bg-blue-500', textColor: 'text-blue-600' },
  bitcoin: { name: 'Bitcoin', color: 'bg-bitcoin-500', textColor: 'text-bitcoin-600' },
};

interface TokenSelectorProps {
  value: TokenInfo | null;
  onChange: (token: TokenInfo | null) => void;
  label?: string;
  excludeToken?: TokenInfo | null;
  className?: string;
}

export function TokenSelector({ 
  value, 
  onChange, 
  label, 
  excludeToken,
  className 
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTokens = useMemo(() => {
    let tokens = MOCK_TOKENS;
    
    // Exclude the other selected token
    if (excludeToken) {
      tokens = tokens.filter(token => 
        !(token.address === excludeToken.address && token.chainId === excludeToken.chainId)
      );
    }
    
    // Filter by search query
    if (searchQuery) {
      tokens = tokens.filter(token =>
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        CHAIN_INFO[token.chainId].name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return tokens;
  }, [excludeToken, searchQuery]);

  const handleTokenSelect = (token: TokenInfo) => {
    onChange(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full justify-between h-auto p-4",
          !value && "text-muted-foreground"
        )}
      >
        {value ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <TokenIcon token={value} size="sm" />
                <ChainBadge chainId={value.chainId} />
              </div>
              <div className="text-left">
                <div className="font-medium">{value.symbol}</div>
                <div className="text-xs text-muted-foreground">
                  {CHAIN_INFO[value.chainId].name}
                </div>
              </div>
            </div>
            <div
              onClick={handleClear}
              className="ml-auto p-1 hover:bg-destructive/10 hover:text-destructive rounded cursor-pointer"
            >
              <X className="h-3 w-3" />
            </div>
          </div>
        ) : (
          <span>{label || 'Select token'}</span>
        )}
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform",
          isOpen && "transform rotate-180"
        )} />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <Card className="absolute top-full mt-2 w-full z-50 shadow-lg">
            <CardContent className="p-0">
              {/* Search */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search tokens or chains..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-near-500"
                  />
                </div>
              </div>

              {/* Token List */}
              <div className="max-h-64 overflow-y-auto">
                {filteredTokens.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No tokens found
                  </div>
                ) : (
                  filteredTokens.map((token) => (
                    <TokenOption
                      key={`${token.chainId}-${token.address}`}
                      token={token}
                      onClick={() => handleTokenSelect(token)}
                      isSelected={value?.address === token.address && value?.chainId === token.chainId}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

interface TokenOptionProps {
  token: TokenInfo;
  onClick: () => void;
  isSelected: boolean;
}

function TokenOption({ token, onClick, isSelected }: TokenOptionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors text-left",
        isSelected && "bg-accent"
      )}
    >
      <div className="relative">
        <TokenIcon token={token} size="md" />
        <ChainBadge chainId={token.chainId} />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{token.symbol}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
            {CHAIN_INFO[token.chainId].name}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {token.priceUSD && formatUSDAmount(token.priceUSD)}
        </div>
      </div>
    </button>
  );
}

interface TokenIconProps {
  token: TokenInfo;
  size: 'sm' | 'md' | 'lg';
}

function TokenIcon({ token, size }: TokenIconProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  return (
    <div className={cn(
      "rounded-full bg-muted flex items-center justify-center font-medium text-xs",
      sizeClasses[size]
    )}>
      {token.symbol.slice(0, 2)}
    </div>
  );
}

interface ChainBadgeProps {
  chainId: ChainId;
}

function ChainBadge({ chainId }: ChainBadgeProps) {
  const chain = CHAIN_INFO[chainId];
  
  return (
    <div className={cn(
      "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
      chain.color
    )} />
  );
}