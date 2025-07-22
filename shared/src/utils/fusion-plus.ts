import { SwapIntent, FusionPlusIntent, OneInchImmutables } from '../types/intent';
import { keccak256, toUtf8Bytes } from 'ethers';

// Timelock stage constants (from 1inch codebase)
export enum TimelockStage {
  SrcWithdrawal = 0,
  SrcPublicWithdrawal = 1,
  SrcCancellation = 2,
  SrcPublicCancellation = 3,
  DstWithdrawal = 4,
  DstPublicWithdrawal = 5,
  DstCancellation = 6
}

// Pack timelock stages into single uint256 (1inch format)
export function packTimelocks(stages: number[]): string {
  if (stages.length !== 7) {
    throw new Error('Must provide exactly 7 timelock stages');
  }
  
  // Each stage gets 32 bits, packed into 256 bits total
  let packed = BigInt(0);
  for (let i = 0; i < stages.length; i++) {
    packed |= BigInt(stages[i]) << BigInt(i * 32);
  }
  
  return packed.toString();
}

// Unpack timelock stages from uint256
export function unpackTimelocks(packedTimelocks: string): number[] {
  const packed = BigInt(packedTimelocks);
  const stages: number[] = [];
  
  for (let i = 0; i < 7; i++) {
    const mask = BigInt(0xFFFFFFFF) << BigInt(i * 32);
    const stage = Number((packed & mask) >> BigInt(i * 32));
    stages.push(stage);
  }
  
  return stages;
}

// Convert SwapIntent to 1inch-compatible FusionPlusIntent
export function toFusionPlusIntent(
  intent: SwapIntent,
  oneInchOrderHash: string,
  safetyDeposit: string,
  timelockStages: number[]
): FusionPlusIntent {
  return {
    ...intent,
    oneInchOrderHash,
    safetyDeposit,
    timelocks: packTimelocks(timelockStages),
    srcImmutables: undefined, // Will be set when escrow is created
    dstImmutables: undefined, // Will be set when escrow is created
  };
}

// Create 1inch Immutables struct for source chain (Ethereum)
export function createSrcImmutables(
  intent: FusionPlusIntent,
  hashlock: string,
  taker: string
): OneInchImmutables {
  const token = intent.sourceToken.address === 'native' 
    ? '0x0000000000000000000000000000000000000000' 
    : intent.sourceToken.address;

  return {
    orderHash: intent.oneInchOrderHash,
    hashlock,
    maker: intent.maker,
    taker,
    token,
    amount: intent.sourceAmount,
    safetyDeposit: intent.safetyDeposit,
    timelocks: intent.timelocks,
  };
}

// Create 1inch Immutables struct for destination chain
export function createDstImmutables(
  intent: FusionPlusIntent,
  hashlock: string,
  taker: string,
  destinationAmount: string
): OneInchImmutables {
  // For non-EVM chains, token address format may differ
  const token = formatTokenForChain(intent.destinationToken.address, intent.destinationChain);

  return {
    orderHash: intent.oneInchOrderHash,
    hashlock,
    maker: intent.destinationAddress, // User receives tokens at this address
    taker,
    token,
    amount: destinationAmount,
    safetyDeposit: intent.safetyDeposit,
    timelocks: intent.timelocks,
  };
}

// Format token address for different chain types
function formatTokenForChain(address: string, chainId: number): string {
  if (address === 'native') {
    // Chain-specific native token representation
    if (chainId >= 10001 && chainId <= 10002) {
      // Aptos
      return '0x1::aptos_coin::AptosCoin';
    } else if (chainId >= 20001 && chainId <= 20008) {
      // Bitcoin-like chains use 'native' or specific identifiers
      return 'native';
    } else if (chainId >= 30001 && chainId <= 30002) {
      // Cosmos
      return 'uatom'; // or appropriate denom
    }
  }
  
  return address;
}

// Generate deterministic order hash for cross-chain intent
export function generateOrderHash(intent: SwapIntent): string {
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

// Calculate safety deposit based on swap amount (suggested 5% of source amount)
export function calculateSafetyDeposit(sourceAmount: string, depositRateBps: number = 500): string {
  const amount = BigInt(sourceAmount);
  const deposit = (amount * BigInt(depositRateBps)) / BigInt(10000);
  return deposit.toString();
}

// Default timelock stages for cross-chain swaps (in seconds)
export function getDefaultTimelockStages(): number[] {
  const now = Math.floor(Date.now() / 1000);
  
  return [
    now + 1800,   // SrcWithdrawal: 30 minutes
    now + 3600,   // SrcPublicWithdrawal: 1 hour
    now + 7200,   // SrcCancellation: 2 hours
    now + 10800,  // SrcPublicCancellation: 3 hours
    now + 1800,   // DstWithdrawal: 30 minutes
    now + 3600,   // DstPublicWithdrawal: 1 hour
    now + 7200,   // DstCancellation: 2 hours
  ];
}

// Validate that timelock stages are in correct order
export function validateTimelockStages(stages: number[]): boolean {
  if (stages.length !== 7) return false;
  
  const now = Math.floor(Date.now() / 1000);
  
  // All stages should be in the future
  if (stages.some(stage => stage <= now)) return false;
  
  // Source stages should be ordered
  if (stages[TimelockStage.SrcWithdrawal] >= stages[TimelockStage.SrcPublicWithdrawal]) return false;
  if (stages[TimelockStage.SrcPublicWithdrawal] >= stages[TimelockStage.SrcCancellation]) return false;
  if (stages[TimelockStage.SrcCancellation] >= stages[TimelockStage.SrcPublicCancellation]) return false;
  
  // Destination stages should be ordered
  if (stages[TimelockStage.DstWithdrawal] >= stages[TimelockStage.DstPublicWithdrawal]) return false;
  if (stages[TimelockStage.DstPublicWithdrawal] >= stages[TimelockStage.DstCancellation]) return false;
  
  return true;
}