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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      {label && (
        <label style={{
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#f9fafb'
        }}>
          {label}
        </label>
      )}
      
      <div style={{
        position: 'relative',
        borderRadius: '0.75rem',
        border: focused ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'default',
        backdropFilter: 'blur(10px)',
        boxShadow: focused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
      }}>
        <div style={{ padding: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '1rem'
          }}>
            {/* Input Section */}
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={value}
                onChange={handleInputChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={placeholder}
                disabled={disabled}
                style={{
                  width: '100%',
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f9fafb',
                  cursor: disabled ? 'not-allowed' : 'text'
                }}
              />
            </div>
            
            {/* Token Symbol and Max Button Section */}
            {token && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '0.5rem'
              }}>
                {/* Token Symbol */}
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#d1d5db',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.375rem'
                }}>
                  {token.symbol}
                </div>
                
                {/* Max Button */}
                {!disabled && parseFloat(balance) > 0 && (
                  <button
                    onClick={handleMaxClick}
                    style={{
                      height: '1.5rem',
                      padding: '0 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: '#3B82F6',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    MAX
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* USD Value and Balance */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            color: '#9ca3af'
          }}>
            <div style={{ fontWeight: '500' }}>
              {usdValue ? formatUSDAmount(usdValue) : '—'}
            </div>
            
            {token && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                Balance: {formatTokenAmount(balance)} {token.symbol}
              </div>
            )}
          </div>
        </div>
        
        {/* Quick Percentage Buttons */}
        {!disabled && parseFloat(balance) > 0 && (
          <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0.75rem'
          }}>
            <div style={{
              display: 'flex',
              gap: '0.5rem'
            }}>
              {[25, 50, 75, 100].map((percentage) => (
                <button
                  key={percentage}
                  onClick={() => handlePercentageClick(percentage)}
                  style={{
                    flex: 1,
                    height: '2rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#d1d5db',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.color = '#3B82F6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = '#d1d5db';
                  }}
                >
                  {percentage}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Validation Message */}
      {value && parseFloat(value) > parseFloat(balance) && (
        <div style={{
          fontSize: '0.75rem',
          color: '#ef4444',
          fontWeight: '500'
        }}>
          Insufficient balance
        </div>
      )}
    </div>
  );
}