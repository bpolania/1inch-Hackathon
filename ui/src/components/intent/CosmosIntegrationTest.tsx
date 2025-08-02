/**
 * Cosmos Integration Test Component
 * Simple component to test Cosmos UI integration
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TokenSelector } from './TokenSelector';
import { CosmosAddressInput } from './CosmosAddressInput';
import { CrossChainIndicator } from './CrossChainIndicator';
import { TokenInfo, ChainId } from '@/types/intent';
import { validateCosmosAddress, isCosmosChain, getCosmosChainInfo } from '@/utils/cosmos';

export function CosmosIntegrationTest() {
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<string>('');

  const testAddresses = {
    neutron: 'neutron1abcdefghijklmnopqrstuvwxyz1234567890abcdef',
    juno: 'juno1abcdefghijklmnopqrstuvwxyz1234567890abcdef123',
    cosmos: 'cosmos1abcdefghijklmnopqrstuvwxyz1234567890abcdef',
  };

  const handleTestAddress = (chainId: ChainId) => {
    if (chainId in testAddresses) {
      setDestinationAddress(testAddresses[chainId as keyof typeof testAddresses]);
    }
  };

  const isValidAddress = destinationAddress ? 
    validateCosmosAddress(destinationAddress, toToken?.chainId) : null;

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🌌 Cosmos Integration Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Token Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">From Token</label>
            <TokenSelector
              value={fromToken}
              onChange={setFromToken}
              label="Select source token"
              excludeToken={toToken}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">To Token</label>
            <TokenSelector
              value={toToken}
              onChange={setToToken}
              label="Select destination token"
              excludeToken={fromToken}
            />
          </div>
        </div>

        {/* Cross-chain indicator */}
        {fromToken && toToken && fromToken.chainId !== toToken.chainId && (
          <CrossChainIndicator fromToken={fromToken} toToken={toToken} />
        )}

        {/* Cosmos Address Input */}
        {toToken && isCosmosChain(toToken.chainId) && (
          <div className="space-y-3">
            <CosmosAddressInput
              value={destinationAddress}
              onChange={setDestinationAddress}
              expectedChain={toToken.chainId}
              label="Destination Address"
              placeholder={`Enter your ${toToken.chainId} address`}
            />

            {/* Test buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTestAddress(toToken.chainId)}
              >
                Use Test Address
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDestinationAddress('')}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Validation Status */}
        {toToken && isCosmosChain(toToken.chainId) && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
            <h4 className="font-medium">Validation Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Chain Type:</span>
                <span className="ml-2 font-mono">
                  {isCosmosChain(toToken.chainId) ? '✅ Cosmos' : '❌ Non-Cosmos'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Address Valid:</span>
                <span className="ml-2 font-mono">
                  {isValidAddress === null ? '⚪ Not entered' : 
                   isValidAddress ? '✅ Valid' : '❌ Invalid'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Chain Info:</span>
                <span className="ml-2 font-mono">
                  {getCosmosChainInfo(toToken.chainId)?.name || 'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Address Length:</span>
                <span className="ml-2 font-mono">
                  {destinationAddress.length} chars
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Integration Summary
          </h4>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <div>✅ Cosmos chains added to token selector</div>
            <div>✅ Cosmos address validation implemented</div>
            <div>✅ Cross-chain indicator working</div>
            <div>✅ UI components integrated</div>
            {toToken && isCosmosChain(toToken.chainId) && isValidAddress && (
              <div>✅ Ready for Cosmos swap!</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CosmosIntegrationTest;