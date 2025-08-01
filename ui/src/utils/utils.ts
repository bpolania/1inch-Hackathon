import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format token amounts with appropriate decimals
 */
export function formatTokenAmount(amount: string | number, decimals: number = 6): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    if (amount === '') return '0';
    return 'NaN';
  }
  if (num === 0) return '0';
  if (num < 0) {
    if (Math.abs(num) < 0.000001) return '< 0.000001';
    if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(decimals).replace(/\.?0+$/, '');
  }
  if (num < 0.000001) return '< 0.000001';
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  
  return num.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Format USD amounts
 */
export function formatUSDAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (num === 0) return '$0';
  if (num < 0.01) return '< $0.01';
  if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format time duration in human readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Format percentage with appropriate precision
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate slippage percentage
 */
export function calculateSlippage(expectedAmount: number, actualAmount: number): number {
  if (expectedAmount === 0) return 0;
  if (expectedAmount === Infinity) return Infinity;
  if (actualAmount === Infinity) return -Infinity;
  
  const result = ((expectedAmount - actualAmount) / expectedAmount) * 100;
  return isNaN(result) ? 0 : result;
}

/**
 * Validate NEAR account ID
 */
export function isValidNearAccountId(accountId: string): boolean {
  const nearAccountRegex = /^[a-z0-9._-]+$/;
  return nearAccountRegex.test(accountId) && accountId.length >= 2 && accountId.length <= 64;
}

/**
 * Validate Ethereum address
 */
export function isValidEthereumAddress(address: string): boolean {
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
}

/**
 * Validate Bitcoin address (simplified)
 */
export function isValidBitcoinAddress(address: string): boolean {
  // Basic validation for common Bitcoin address formats
  const p2pkhRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // P2PKH/P2SH
  const bech32Regex = /^(bc1|tb1)[a-zA-HJ-NP-Z0-9]{25,87}$/; // Bech32
  
  return p2pkhRegex.test(address) || bech32Regex.test(address);
}