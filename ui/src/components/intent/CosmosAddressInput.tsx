/**
 * Cosmos Address Input Component
 * Provides validation and autocomplete for Cosmos bech32 addresses
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { cn } from '@/utils/utils';
import { ChainId } from '@/types/intent';
import { 
  validateCosmosAddress, 
  getChainFromCosmosAddress, 
  getCosmosChainInfo,
  COSMOS_ADDRESS_PREFIXES 
} from '@/utils/cosmos';

interface CosmosAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  expectedChain?: ChainId;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CosmosAddressInput({
  value,
  onChange,
  expectedChain,
  label,
  placeholder,
  className,
  disabled = false,
}: CosmosAddressInputProps) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [detectedChain, setDetectedChain] = useState<ChainId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate address whenever value changes
  useEffect(() => {
    if (!value.trim()) {
      setIsValid(null);
      setDetectedChain(null);
      setError(null);
      return;
    }

    const valid = validateCosmosAddress(value, expectedChain);
    const chain = getChainFromCosmosAddress(value);
    
    setIsValid(valid);
    setDetectedChain(chain);

    if (!valid) {
      if (!value.includes('1')) {
        setError('Invalid format. Cosmos addresses use bech32 format (prefix1...)');
      } else if (value.length < 40) {
        setError('Address too short. Cosmos addresses are 39-59 characters');
      } else if (value.length > 60) {
        setError('Address too long. Cosmos addresses are 39-59 characters');
      } else if (expectedChain && chain && chain !== expectedChain) {
        const expectedInfo = getCosmosChainInfo(expectedChain);
        const detectedInfo = getCosmosChainInfo(chain);
        setError(`Expected ${expectedInfo?.name} address, got ${detectedInfo?.name}`);
      } else {
        setError('Invalid Cosmos address format');
      }
    } else {
      setError(null);
    }
  }, [value, expectedChain]);

  const handleCopyExample = (prefix: string) => {
    const exampleAddress = `${prefix}1abcdefghijklmnopqrstuvwxyz1234567890abcdef`;
    navigator.clipboard.writeText(exampleAddress);
  };

  const getInputClassName = () => {
    if (!value.trim()) return '';
    if (isValid) return 'border-green-500 focus:border-green-500';
    return 'border-red-500 focus:border-red-500';
  };

  const chainInfo = detectedChain ? getCosmosChainInfo(detectedChain) : null;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {expectedChain && (
            <span className="text-gray-500 ml-1">
              ({COSMOS_ADDRESS_PREFIXES[expectedChain]}1...)
            </span>
          )}
        </label>
      )}
      
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `Enter Cosmos address (${expectedChain ? COSMOS_ADDRESS_PREFIXES[expectedChain] : 'prefix'}1...)`}
          className={cn('pr-10', getInputClassName())}
          disabled={disabled}
        />
        
        {/* Validation icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {value.trim() && (
            <>
              {isValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </>
          )}
        </div>
      </div>

      {/* Chain detection badge */}
      {chainInfo && isValid && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn('text-xs', chainInfo.color, 'text-white')}>
            {chainInfo.name}
          </Badge>
          <span className="text-xs text-gray-500">
            Detected chain: {chainInfo.name}
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Address examples for expected chain */}
      {expectedChain && !value.trim() && (
        <div className="text-xs text-gray-500 space-y-1">
          <div>Expected format:</div>
          <div className="flex items-center gap-2 font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <span>{COSMOS_ADDRESS_PREFIXES[expectedChain]}1abcdefghijklmnopqrstuvwxyz1234567890abcdef</span>
            <button
              onClick={() => handleCopyExample(COSMOS_ADDRESS_PREFIXES[expectedChain])}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Copy example"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Show supported chains when no expected chain */}
      {!expectedChain && !value.trim() && (
        <div className="text-xs text-gray-500">
          <div>Supported chains:</div>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {Object.entries(COSMOS_ADDRESS_PREFIXES).map(([chain, prefix]) => {
              const info = getCosmosChainInfo(chain as ChainId);
              return (
                <div key={chain} className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {prefix}1...
                  </Badge>
                  <span>{info?.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CosmosAddressInput;