/**
 * Amount Input - Token amount input with validation and formatting
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/utils';
import { TokenInfo } from '@/types/intent';
import { formatTokenAmount, formatUSDAmount } from '@/utils/utils';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  token?: TokenInfo | null;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function AmountInput({
  value,
  onChange,
  token,
  placeholder = '0.0',
  label,
  className,
  disabled = false,
}: AmountInputProps) {
  const [focused, setFocused] = useState(false);
  const [balance, setBalance] = useState<string>('0'); // Mock balance

  // Mock balance fetching
  useEffect(() => {
    if (token) {
      // In real app, this would fetch actual balance
      setBalance(Math.random() * 1000 + '');
    }
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow only numbers and decimal point
    if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
      onChange(inputValue);
    }
  };

  const handleMaxClick = () => {
    onChange(balance);
  };

  const handlePercentageClick = (percentage: number) => {
    const amount = (parseFloat(balance) * percentage / 100).toString();
    onChange(amount);
  };

  const usdValue = token && token.priceUSD && value 
    ? parseFloat(value) * token.priceUSD 
    : null;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      
      <div className={cn(
        "relative rounded-lg border transition-colors",
        focused ? "border-near-500 ring-2 ring-near-200" : "border-border",
        disabled && "opacity-50 cursor-not-allowed",
        "bg-background"
      )}>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={handleInputChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "flex-1 text-2xl font-medium bg-transparent border-none outline-none",
                "placeholder:text-muted-foreground",
                disabled && "cursor-not-allowed"
              )}
            />
            
            {/* Token Symbol */}
            {token && (
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                {token.symbol}
              </div>
            )}
            
            {/* Max Button */}
            {!disabled && parseFloat(balance) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMaxClick}
                className="h-6 px-2 text-xs"
              >
                MAX
              </Button>
            )}
          </div>
          
          {/* USD Value and Balance */}
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <div>
              {usdValue ? formatUSDAmount(usdValue) : ''}
            </div>
            
            {token && (
              <div className="flex items-center gap-1">
                Balance: {formatTokenAmount(balance)} {token.symbol}
              </div>
            )}
          </div>
        </div>
        
        {/* Quick Percentage Buttons */}
        {!disabled && parseFloat(balance) > 0 && (
          <div className="border-t p-2">
            <div className="flex gap-1">
              {[25, 50, 75, 100].map((percentage) => (
                <Button
                  key={percentage}
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePercentageClick(percentage)}
                  className="flex-1 h-6 text-xs"
                >
                  {percentage}%
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Validation Message */}
      {value && parseFloat(value) > parseFloat(balance) && (
        <div className="text-xs text-destructive">
          Insufficient balance
        </div>
      )}
    </div>
  );
}