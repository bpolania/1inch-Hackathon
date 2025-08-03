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

  // Cosmos Ecosystem tokens
  // Neutron Testnet
  {
    address: 'untrn',
    symbol: 'NTRN',
    decimals: 6,
    chainId: 'neutron',
    logoURI: '/tokens/neutron.svg',
    priceUSD: 0.45,
  },
  {
    address: 'neutron1fhkzytllmzv8xqz6cjcm5k0qj58y8w8gknhfmzj',
    symbol: 'USDC.axl',
    decimals: 6,
    chainId: 'neutron',
    logoURI: '/tokens/usdc.svg',
    priceUSD: 1.00,
  },

  // Juno Testnet  
  {
    address: 'ujunox',
    symbol: 'JUNOX',
    decimals: 6,
    chainId: 'juno',
    logoURI: '/tokens/juno.svg',
    priceUSD: 0.33,
  },
  {
    address: 'juno1mkw83sv6c7sjdvsaplrzc8yaes9l42p4mhy0ssuxjnyzl87c9eps7dswql',
    symbol: 'USDC',
    decimals: 6,
    chainId: 'juno',
    logoURI: '/tokens/usdc.svg',
    priceUSD: 1.00,
  },

  // Cosmos Hub
  {
    address: 'uatom',
    symbol: 'ATOM',
    decimals: 6,
    chainId: 'cosmos',
    logoURI: '/tokens/atom.svg',
    priceUSD: 8.45,
  },

  // Osmosis
  {
    address: 'uosmo',
    symbol: 'OSMO',
    decimals: 6,
    chainId: 'osmosis',
    logoURI: '/tokens/osmosis.svg',
    priceUSD: 0.65,
  },

  // Stargaze
  {
    address: 'ustars',
    symbol: 'STARS',
    decimals: 6,
    chainId: 'stargaze',
    logoURI: '/tokens/stargaze.svg',
    priceUSD: 0.02,
  },

  // Akash
  {
    address: 'uakt',
    symbol: 'AKT',
    decimals: 6,
    chainId: 'akash',
    logoURI: '/tokens/akash.svg',
    priceUSD: 3.22,
  },
];

const CHAIN_INFO = {
  near: { name: 'NEAR', color: 'bg-near-500', textColor: 'text-near-600' },
  ethereum: { name: 'Ethereum', color: 'bg-blue-500', textColor: 'text-blue-600' },
  bitcoin: { name: 'Bitcoin', color: 'bg-bitcoin-500', textColor: 'text-bitcoin-600' },
  neutron: { name: 'Neutron', color: 'bg-purple-500', textColor: 'text-purple-600' },
  juno: { name: 'Juno', color: 'bg-pink-500', textColor: 'text-pink-600' },
  cosmos: { name: 'Cosmos Hub', color: 'bg-indigo-500', textColor: 'text-indigo-600' },
  osmosis: { name: 'Osmosis', color: 'bg-gradient-to-r bg-purple-400', textColor: 'text-purple-600' },
  stargaze: { name: 'Stargaze', color: 'bg-red-500', textColor: 'text-red-600' },
  akash: { name: 'Akash', color: 'bg-green-500', textColor: 'text-green-600' },
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
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '0.75rem',
          color: value ? '#f9fafb' : '#9ca3af',
          cursor: 'pointer',
          transition: 'all 0.2s',
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }}
      >
        {value ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flex: 1
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{ position: 'relative' }}>
                <TokenIcon token={value} size="sm" />
                <ChainBadge chainId={value.chainId} />
              </div>
              <div>
                <div style={{
                  fontWeight: '600',
                  color: '#f9fafb',
                  fontSize: '0.95rem'
                }}>
                  {value.symbol}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#9ca3af'
                }}>
                  {CHAIN_INFO[value.chainId].name} • ${value.priceUSD?.toFixed(2)}
                </div>
              </div>
            </div>
            <button
              onClick={handleClear}
              style={{
                padding: '0.25rem',
                borderRadius: '0.25rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X style={{ height: '0.875rem', width: '0.875rem' }} />
            </button>
          </div>
        ) : (
          <span style={{ fontSize: '0.95rem' }}>{label || 'Select token'}</span>
        )}
        <ChevronDown style={{
          height: '1rem',
          width: '1rem',
          transition: 'transform 0.2s',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          marginLeft: '0.5rem'
        }} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40
            }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            marginTop: '0.5rem',
            zIndex: 50,
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(20px)',
            overflow: 'hidden'
          }}>
            {/* Search */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div style={{ position: 'relative' }}>
                <Search style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: '1rem',
                  width: '1rem',
                  color: '#9ca3af'
                }} />
                <input
                  type="text"
                  placeholder="Search tokens or chains..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '2.5rem',
                    paddingRight: '0.75rem',
                    paddingTop: '0.5rem',
                    paddingBottom: '0.5rem',
                    fontSize: '0.875rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    color: '#f9fafb',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
              </div>
            </div>

            {/* Token List */}
            <div style={{
              maxHeight: '16rem',
              overflowY: 'auto'
            }}>
              {filteredTokens.length === 0 ? (
                <div style={{
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '0.875rem',
                  color: '#9ca3af'
                }}>
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
          </div>
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
      style={{
        width: '100%',
        padding: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'left',
        borderRadius: '0.5rem',
        margin: '0.25rem'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <div style={{ position: 'relative' }}>
        <TokenIcon token={token} size="md" />
        <ChainBadge chainId={token.chainId} />
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.25rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{
              fontWeight: '600',
              color: '#f9fafb',
              fontSize: '0.95rem'
            }}>
              {token.symbol}
            </span>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#d1d5db'
            }}>
              {CHAIN_INFO[token.chainId].name}
            </span>
          </div>
          {token.priceUSD && (
            <span style={{
              fontWeight: '600',
              color: '#10b981',
              fontSize: '0.875rem'
            }}>
              ${token.priceUSD.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: token.priceUSD >= 1 ? 2 : 6 
              })}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '0.75rem',
          color: '#9ca3af'
        }}>
          {token.address.length > 20 
            ? `${token.address.slice(0, 8)}...${token.address.slice(-6)}`
            : token.address
          }
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
  const sizeMap = {
    sm: { width: '1.5rem', height: '1.5rem', fontSize: '0.625rem' },
    md: { width: '2rem', height: '2rem', fontSize: '0.75rem' },
    lg: { width: '2.5rem', height: '2.5rem', fontSize: '0.875rem' },
  };

  const sizeStyle = sizeMap[size];

  return (
    <div style={{
      width: sizeStyle.width,
      height: sizeStyle.height,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '600',
      fontSize: sizeStyle.fontSize,
      color: 'white',
      border: '2px solid rgba(255, 255, 255, 0.2)'
    }}>
      {token.symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface ChainBadgeProps {
  chainId: ChainId;
}

function ChainBadge({ chainId }: ChainBadgeProps) {
  const chainColors = {
    near: '#00D4AA',
    ethereum: '#627EEA',
    bitcoin: '#F7931A',
    neutron: '#8B5CF6',
    juno: '#EC4899',
    cosmos: '#6366F1',
    osmosis: '#9333EA',
    stargaze: '#EF4444',
    akash: '#10B981',
  };
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '-0.125rem',
      right: '-0.125rem',
      width: '0.75rem',
      height: '0.75rem',
      borderRadius: '50%',
      backgroundColor: chainColors[chainId] || '#6B7280',
      border: '2px solid rgba(30, 41, 59, 0.9)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
    }} />
  );
}