/**
 * Real-time Price Quote Display Component
 * Shows 1inch quotes and price information in the IntentForm
 */

'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Zap, Route, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/utils';
import { useOneInchQuotes, SUPPORTED_CHAINS } from '@/services/oneinch';
import { TokenInfo } from '@/types/intent';

interface PriceQuoteProps {
  fromToken: TokenInfo | null;
  toToken: TokenInfo | null;
  fromAmount: string;
  onQuoteUpdate?: (outputAmount: string) => void;
  className?: string;
}

export function PriceQuote({ 
  fromToken, 
  toToken, 
  fromAmount, 
  onQuoteUpdate,
  className 
}: PriceQuoteProps) {
  const { getQuote, isLoading, error } = useOneInchQuotes();
  const [quote, setQuote] = useState<any>(null);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get quote when inputs change
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchQuote = async () => {
      if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) === 0) {
        setQuote(null);
        return;
      }

      try {
        // Use Ethereum mainnet as default for quotes
        const chainId = SUPPORTED_CHAINS.ETHEREUM;
        
        // Convert amount to wei for the quote
        const amountWei = (BigInt(Math.floor(parseFloat(fromAmount) * 1e18))).toString();
        
        // Use real token addresses for mainnet
        const fromTokenAddress = fromToken.address || '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // ETH
        const toTokenAddress = toToken.address || '0xA0b86991c6218b36C1d19D4a2e9Eb0cE3606eB48'; // Real USDC mainnet
        
        const quoteResult = await getQuote(
          chainId,
          fromTokenAddress,
          toTokenAddress,
          amountWei,
          1 // 1% slippage
        );

        if (quoteResult) {
          setQuote(quoteResult);
          setPriceImpact(parseFloat(String(quoteResult.priceImpact || '0')));
          onQuoteUpdate?.(quoteResult.formattedOutput);
        }
      } catch (err) {
        console.error('Quote error:', err);
      }
    };

    // Debounce the quote request
    timeoutId = setTimeout(fetchQuote, 500);

    return () => clearTimeout(timeoutId);
  }, [fromToken, toToken, fromAmount, getQuote, onQuoteUpdate, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) === 0) {
    return null;
  }

  if (error) {
    return (
      <div className={cn('p-4 rounded-xl border border-red-200 bg-red-50', className)}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Quote Error</span>
        </div>
        <p className="text-sm text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Quote Loading State */}
      {isLoading && (
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 animate-pulse">
          <div className="flex items-center gap-2 text-blue-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Getting best price...</span>
          </div>
        </div>
      )}

      {/* Quote Results */}
      {quote && !isLoading && (
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold text-card-foreground">
                1inch Best Quote
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              title="Refresh quote"
            >
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          {/* Price Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">You receive</span>
              <div className="text-right">
                <div className="text-lg font-bold text-card-foreground">
                  {parseFloat(quote.formattedOutput).toFixed(6)} {toToken.symbol}
                </div>
                <div className="text-xs text-muted-foreground">
                   ${(parseFloat(quote.formattedOutput) * 1).toFixed(2)} USD
                </div>
              </div>
            </div>

            {/* Price Impact */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Price Impact</span>
              <div 
                data-testid="price-impact"
                className={cn(
                  'flex items-center gap-1 text-sm font-medium',
                  priceImpact > 3 ? 'text-red-500' : 
                  priceImpact > 1 ? 'text-yellow-500' : 'text-green-500'
                )}>
                {priceImpact > 1 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {priceImpact.toFixed(2)}%
              </div>
            </div>

            {/* Route */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Route</span>
              <div className="flex items-center gap-1 text-sm">
                <Route className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground truncate max-w-32" title={quote.route}>
                  {quote.route}
                </span>
              </div>
            </div>

            {/* Gas Estimate */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Est. Gas</span>
              <div className="text-sm text-muted-foreground">
                {parseInt(quote.gasEstimate) > 0 ? 
                  ` ${(parseInt(quote.gasEstimate) / 1000000).toFixed(1)}M` : 
                  'N/A'
                }
              </div>
            </div>

            {/* Protocols Used */}
            {quote.protocols && quote.protocols.length > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Protocols Used
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {quote.protocols.slice(0, 3).map((protocol: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground"
                    >
                      {protocol}
                    </span>
                  ))}
                  {quote.protocols.length > 3 && (
                    <span className="px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                      +{quote.protocols.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Confidence Score */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${quote.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {(quote.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Price Impact Warning */}
          {priceImpact > 3 && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">High Price Impact</span>
              </div>
              <p className="text-xs text-red-500 mt-1">
                This swap has a high price impact. Consider reducing the amount or trying again later.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact Price Quote Component for smaller spaces
 */
export function CompactPriceQuote({ 
  fromToken, 
  toToken, 
  fromAmount, 
  onQuoteUpdate,
  className 
}: PriceQuoteProps) {
  const { getQuote, isLoading } = useOneInchQuotes();
  const [quote, setQuote] = useState<any>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchQuote = async () => {
      if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) === 0) {
        setQuote(null);
        return;
      }

      try {
        const chainId = SUPPORTED_CHAINS.ETHEREUM;
        const amountWei = (BigInt(Math.floor(parseFloat(fromAmount) * 1e18))).toString();
        
        // Use real token addresses for mainnet
        const fromTokenAddress = fromToken.address || '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // ETH
        const toTokenAddress = toToken.address || '0xA0b86991c6218b36C1d19D4a2e9Eb0cE3606eB48'; // Real USDC mainnet
        
        const quoteResult = await getQuote(
          chainId,
          fromTokenAddress,
          toTokenAddress,
          amountWei,
          1
        );

        if (quoteResult) {
          setQuote(quoteResult);
          onQuoteUpdate?.(quoteResult.formattedOutput);
        }
      } catch (err) {
        console.error('Compact quote error:', err);
      }
    };

    timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [fromToken, toToken, fromAmount, getQuote, onQuoteUpdate]);

  if (!quote && !isLoading) return null;

  return (
    <div className={cn('flex items-center justify-between text-sm', className)}>
      <span className="text-muted-foreground">1inch Quote:</span>
      {isLoading ? (
        <div className="flex items-center gap-1 text-blue-500">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : quote ? (
        <span className="font-medium text-card-foreground">
          {parseFloat(quote.formattedOutput).toFixed(4)} {toToken?.symbol}
        </span>
      ) : null}
    </div>
  );
}