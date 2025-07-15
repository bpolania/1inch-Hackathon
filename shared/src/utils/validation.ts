import { SwapIntent, TokenInfo } from '../types/intent';
import { ChainId, CHAIN_INFO, ChainType } from '../types/chains';
import { 
  TIME_CONSTANTS, 
  FEE_CONSTANTS, 
  VALIDATION_LIMITS,
  ERROR_MESSAGES,
  NATIVE_TOKEN_ADDRESS 
} from '../constants';

export function validateChainId(chainId: ChainId): boolean {
  return chainId in CHAIN_INFO;
}

export function validateTokenAddress(address: string, chainId: ChainId): boolean {
  if (address === NATIVE_TOKEN_ADDRESS) {
    return true;
  }
  
  const chainInfo = CHAIN_INFO[chainId];
  if (!chainInfo) return false;
  
  switch (chainInfo.type) {
    case ChainType.EVM:
      // EVM address validation (0x + 40 hex chars)
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    
    case ChainType.APTOS:
      // Aptos address validation (0x + up to 64 hex chars)
      return /^0x[a-fA-F0-9]{1,64}$/.test(address);
    
    case ChainType.BITCOIN:
      // For Bitcoin-like chains, we use script hashes or addresses
      // This is simplified - real validation would be chain-specific
      return address.length >= 26 && address.length <= 62;
    
    case ChainType.COSMOS:
      // Cosmos bech32 address validation (simplified)
      return /^[a-z]+1[a-z0-9]{38,}$/.test(address);
    
    default:
      return false;
  }
}

export function validateAmount(amount: string): boolean {
  try {
    const num = BigInt(amount);
    return num > 0n;
  } catch {
    return false;
  }
}

export function validateIntent(intent: SwapIntent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate chains
  if (!validateChainId(intent.sourceChain)) {
    errors.push(`Source chain: ${ERROR_MESSAGES.INVALID_CHAIN}`);
  }
  if (!validateChainId(intent.destinationChain)) {
    errors.push(`Destination chain: ${ERROR_MESSAGES.INVALID_CHAIN}`);
  }
  
  // Validate token addresses
  if (!validateTokenAddress(intent.sourceToken.address, intent.sourceChain)) {
    errors.push(`Source token: ${ERROR_MESSAGES.INVALID_TOKEN}`);
  }
  if (!validateTokenAddress(intent.destinationToken.address, intent.destinationChain)) {
    errors.push(`Destination token: ${ERROR_MESSAGES.INVALID_TOKEN}`);
  }
  
  // Validate amounts
  if (!validateAmount(intent.sourceAmount)) {
    errors.push(`Source amount: ${ERROR_MESSAGES.INVALID_AMOUNT}`);
  }
  if (!validateAmount(intent.destinationAmount)) {
    errors.push(`Destination amount: ${ERROR_MESSAGES.INVALID_AMOUNT}`);
  }
  if (!validateAmount(intent.resolverFeeAmount)) {
    errors.push(`Resolver fee: ${ERROR_MESSAGES.INVALID_AMOUNT}`);
  }
  
  // Validate destination address
  if (!validateAddress(intent.destinationAddress, intent.destinationChain)) {
    errors.push('Invalid destination address');
  }
  
  // Validate slippage
  if (intent.slippageBps < FEE_CONSTANTS.MIN_SLIPPAGE_BPS || 
      intent.slippageBps > FEE_CONSTANTS.MAX_SLIPPAGE_BPS) {
    errors.push(ERROR_MESSAGES.SLIPPAGE_TOO_HIGH);
  }
  
  // Validate timing
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = intent.expiryTime - now;
  
  if (timeUntilExpiry < TIME_CONSTANTS.MIN_EXPIRY_TIME) {
    errors.push(ERROR_MESSAGES.INTENT_EXPIRED);
  }
  if (timeUntilExpiry > TIME_CONSTANTS.MAX_EXPIRY_TIME) {
    errors.push(ERROR_MESSAGES.INVALID_EXPIRY);
  }
  
  // Validate intent ID
  if (!intent.intentId || intent.intentId.length > VALIDATION_LIMITS.MAX_INTENT_ID_LENGTH) {
    errors.push('Invalid intent ID');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateAddress(address: string, chainId: ChainId): boolean {
  const chainInfo = CHAIN_INFO[chainId];
  if (!chainInfo) return false;
  
  switch (chainInfo.type) {
    case ChainType.EVM:
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    
    case ChainType.APTOS:
      return /^0x[a-fA-F0-9]{1,64}$/.test(address);
    
    case ChainType.BITCOIN:
      // Simplified - real validation would check specific format per chain
      return address.length >= 26 && address.length <= 62;
    
    case ChainType.COSMOS:
      return /^[a-z]+1[a-z0-9]{38,}$/.test(address);
    
    default:
      return false;
  }
}

export function calculateResolverFeePercentage(
  resolverFeeAmount: string,
  sourceAmount: string
): number {
  try {
    const fee = BigInt(resolverFeeAmount);
    const amount = BigInt(sourceAmount);
    if (amount === 0n) return 0;
    
    // Calculate fee percentage in basis points
    return Number((fee * 10000n) / amount);
  } catch {
    return 0;
  }
}

export function isIntentExpired(expiryTime: number): boolean {
  return Math.floor(Date.now() / 1000) > expiryTime;
}

export function getRequiredTimelock(sourceChain: ChainId, destinationChain: ChainId): number {
  const sourceType = CHAIN_INFO[sourceChain]?.type;
  const destType = CHAIN_INFO[destinationChain]?.type;
  
  if (!sourceType || !destType) {
    return TIME_CONSTANTS.HTLC_TIMELOCK.ETHEREUM; // Default
  }
  
  // Get base timelock for each chain
  const sourceTimelock = TIME_CONSTANTS.HTLC_TIMELOCK[sourceType] || TIME_CONSTANTS.HTLC_TIMELOCK.ETHEREUM;
  const destTimelock = TIME_CONSTANTS.HTLC_TIMELOCK[destType] || TIME_CONSTANTS.HTLC_TIMELOCK.ETHEREUM;
  
  // Use the longer timelock plus buffer for cross-chain safety
  return Math.max(sourceTimelock, destTimelock) + TIME_CONSTANTS.CROSS_CHAIN_BUFFER;
}