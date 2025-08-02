/**
 * Cosmos utility functions for UI
 */

import { ChainId } from '@/types/intent';

// Cosmos chain prefixes mapping
export const COSMOS_ADDRESS_PREFIXES: Record<string, string> = {
  neutron: 'neutron',
  juno: 'juno', 
  cosmos: 'cosmos',
  osmosis: 'osmo',
  stargaze: 'stars',
  akash: 'akash',
};

// Cosmos native denominations
export const COSMOS_NATIVE_DENOMS: Record<string, string> = {
  neutron: 'untrn',
  juno: 'ujunox',
  cosmos: 'uatom', 
  osmosis: 'uosmo',
  stargaze: 'ustars',
  akash: 'uakt',
};

/**
 * Validates a Cosmos bech32 address format
 */
export function validateCosmosAddress(address: string, expectedChain?: ChainId): boolean {
  if (!address || typeof address !== 'string') return false;

  // Basic bech32 format validation: prefix + "1" + 38-58 chars
  const bech32Regex = /^[a-z]+1[a-z0-9]{38,58}$/;
  if (!bech32Regex.test(address)) return false;

  // Optional chain-specific prefix validation
  if (expectedChain && COSMOS_ADDRESS_PREFIXES[expectedChain]) {
    const expectedPrefix = COSMOS_ADDRESS_PREFIXES[expectedChain];
    if (!address.startsWith(expectedPrefix + '1')) {
      return false;
    }
  }

  return true;
}

/**
 * Gets the chain ID from a Cosmos address prefix
 */
export function getChainFromCosmosAddress(address: string): ChainId | null {
  if (!address || !address.includes('1')) return null;
  
  const prefix = address.split('1')[0];
  
  for (const [chainId, expectedPrefix] of Object.entries(COSMOS_ADDRESS_PREFIXES)) {
    if (prefix === expectedPrefix) {
      return chainId as ChainId;
    }
  }
  
  return null;
}

/**
 * Checks if a chain ID is a Cosmos chain
 */
export function isCosmosChain(chainId: ChainId): boolean {
  return Object.keys(COSMOS_ADDRESS_PREFIXES).includes(chainId);
}

/**
 * Gets the native denomination for a Cosmos chain
 */
export function getCosmosNativeDenom(chainId: ChainId): string | null {
  return COSMOS_NATIVE_DENOMS[chainId] || null;
}

/**
 * Formats a Cosmos amount with proper decimals
 */
export function formatCosmosAmount(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  
  // Cosmos tokens typically use 6 decimals
  return (num / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * Converts a human-readable amount to micro units (Cosmos standard)
 */
export function toCosmosBaseUnits(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  
  return Math.floor(num * Math.pow(10, decimals)).toString();
}

/**
 * Gets Cosmos chain information for UI display
 */
export interface CosmosChainInfo {
  chainId: ChainId;
  name: string;
  prefix: string;
  nativeDenom: string;
  nativeSymbol: string;
  explorerUrl?: string;
  color: string;
}

export const COSMOS_CHAIN_INFO: Record<string, CosmosChainInfo> = {
  neutron: {
    chainId: 'neutron',
    name: 'Neutron Testnet',
    prefix: 'neutron',
    nativeDenom: 'untrn',
    nativeSymbol: 'NTRN',
    explorerUrl: 'https://neutron.celat.one/neutron-testnet',
    color: 'bg-purple-500',
  },
  juno: {
    chainId: 'juno',
    name: 'Juno Testnet', 
    prefix: 'juno',
    nativeDenom: 'ujunox',
    nativeSymbol: 'JUNOX',
    explorerUrl: 'https://testnet.juno.explorers.guru',
    color: 'bg-pink-500',
  },
  cosmos: {
    chainId: 'cosmos',
    name: 'Cosmos Hub',
    prefix: 'cosmos',
    nativeDenom: 'uatom',
    nativeSymbol: 'ATOM',
    explorerUrl: 'https://www.mintscan.io/cosmos',
    color: 'bg-indigo-500',
  },
  osmosis: {
    chainId: 'osmosis',
    name: 'Osmosis',
    prefix: 'osmo', 
    nativeDenom: 'uosmo',
    nativeSymbol: 'OSMO',
    explorerUrl: 'https://www.mintscan.io/osmosis',
    color: 'bg-purple-400',
  },
  stargaze: {
    chainId: 'stargaze',
    name: 'Stargaze',
    prefix: 'stars',
    nativeDenom: 'ustars', 
    nativeSymbol: 'STARS',
    explorerUrl: 'https://www.mintscan.io/stargaze',
    color: 'bg-red-500',
  },
  akash: {
    chainId: 'akash',
    name: 'Akash Network',
    prefix: 'akash',
    nativeDenom: 'uakt',
    nativeSymbol: 'AKT', 
    explorerUrl: 'https://www.mintscan.io/akash',
    color: 'bg-green-500',
  },
};

/**
 * Gets display information for a Cosmos chain
 */
export function getCosmosChainInfo(chainId: ChainId): CosmosChainInfo | null {
  return COSMOS_CHAIN_INFO[chainId] || null;
}