import { randomBytes } from 'crypto';
import { keccak256, toUtf8Bytes } from 'ethers';
import { SwapIntent, IntentStatus, TokenInfo } from '../types/intent';
import { ChainId } from '../types/chains';
import { TIME_CONSTANTS } from '../constants';

export function generateIntentId(): string {
  return '0x' + randomBytes(32).toString('hex');
}

export function generateHashlock(preimage: string): string {
  return keccak256(toUtf8Bytes(preimage));
}

export function generatePreimage(): string {
  return '0x' + randomBytes(32).toString('hex');
}

export function createIntent(params: {
  maker: string;
  sourceChain: ChainId;
  sourceToken: TokenInfo;
  sourceAmount: string;
  destinationChain: ChainId;
  destinationToken: TokenInfo;
  destinationAmount: string;
  destinationAddress: string;
  slippageBps: number;
  resolverFeeAmount: string;
  expiryTime?: number;
}): SwapIntent {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    intentId: generateIntentId(),
    maker: params.maker,
    sourceChain: params.sourceChain,
    sourceToken: params.sourceToken,
    sourceAmount: params.sourceAmount,
    destinationChain: params.destinationChain,
    destinationToken: params.destinationToken,
    destinationAmount: params.destinationAmount,
    destinationAddress: params.destinationAddress,
    slippageBps: params.slippageBps,
    resolverFeeAmount: params.resolverFeeAmount,
    createdAt: now,
    expiryTime: params.expiryTime || (now + TIME_CONSTANTS.DEFAULT_EXPIRY_TIME),
    status: IntentStatus.PENDING,
  };
}

export function calculateMinDestinationAmount(
  destinationAmount: string,
  slippageBps: number
): string {
  try {
    const amount = BigInt(destinationAmount);
    const slippage = BigInt(slippageBps);
    
    // Calculate minimum amount after slippage
    // minAmount = amount * (10000 - slippageBps) / 10000
    const minAmount = (amount * (10000n - slippage)) / 10000n;
    
    return minAmount.toString();
  } catch {
    return '0';
  }
}

export function isIntentExecutable(intent: SwapIntent): boolean {
  // Check if intent can be executed
  if (intent.status !== IntentStatus.PENDING) return false;
  
  // Check if expired
  const now = Math.floor(Date.now() / 1000);
  if (now >= intent.expiryTime) return false;
  
  // Check if there's enough time to execute
  const timeRemaining = intent.expiryTime - now;
  if (timeRemaining < TIME_CONSTANTS.MIN_EXPIRY_TIME) return false;
  
  return true;
}

export function formatIntentForSigning(intent: SwapIntent): any {
  // Format intent for EIP-712 signing - convert 'native' to zero address for EIP-712
  const formatTokenAddress = (address: string) => 
    address === 'native' ? '0x0000000000000000000000000000000000000000' : address;

  return {
    intentId: intent.intentId,
    maker: intent.maker,
    sourceChain: intent.sourceChain,
    sourceToken: formatTokenAddress(intent.sourceToken.address),
    sourceAmount: intent.sourceAmount,
    destinationChain: intent.destinationChain,
    destinationToken: formatTokenAddress(intent.destinationToken.address),
    destinationAmount: intent.destinationAmount,
    destinationAddress: intent.destinationAddress,
    slippageBps: intent.slippageBps,
    resolverFeeAmount: intent.resolverFeeAmount,
    expiryTime: intent.expiryTime,
  };
}

export function getIntentHash(intent: SwapIntent): string {
  // Create a deterministic hash of the intent
  const data = [
    intent.intentId,
    intent.maker,
    intent.sourceChain.toString(),
    intent.sourceToken.address,
    intent.sourceAmount,
    intent.destinationChain.toString(),
    intent.destinationToken.address,
    intent.destinationAmount,
    intent.destinationAddress,
    intent.slippageBps.toString(),
    intent.resolverFeeAmount,
    intent.expiryTime.toString(),
  ].join(':');
  
  return keccak256(toUtf8Bytes(data));
}

export function estimateExecutionTime(
  sourceChain: ChainId,
  destinationChain: ChainId
): number {
  // Estimate time in seconds to complete a cross-chain swap
  const estimates: Record<string, number> = {
    ETHEREUM: 900, // 15 minutes
    APTOS: 300, // 5 minutes
    BITCOIN: 3600, // 60 minutes
    COSMOS: 600, // 10 minutes
  };
  
  const sourceType = sourceChain.toString().split('_')[0];
  const destType = destinationChain.toString().split('_')[0];
  
  const sourceTime = estimates[sourceType] || 900;
  const destTime = estimates[destType] || 900;
  
  // Total time is sum of both chains plus buffer
  return sourceTime + destTime + TIME_CONSTANTS.CROSS_CHAIN_BUFFER;
}