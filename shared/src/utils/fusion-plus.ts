import { SwapIntent, FusionPlusIntent, OneInchImmutables, NearExecutionParams, CosmosExecutionParams } from '../types/intent';
import { ChainId, ChainType, CHAIN_INFO } from '../types/chains';
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
    } else if (isCosmosChain(chainId)) {
      // Cosmos chains - return appropriate native denom
      return getCosmosNativeDenom(chainId);
    } else if (chainId >= 40001 && chainId <= 40002) {
      // NEAR Protocol
      return 'near'; // Native NEAR token identifier
    }
  }
  
  return address;
}

// Check if a chain ID belongs to Cosmos ecosystem
export function isCosmosChain(chainId: number): boolean {
  return chainId === ChainId.NEUTRON_TESTNET || 
         chainId === ChainId.JUNO_TESTNET ||
         (chainId >= 30001 && chainId <= 30008);
}

// Get native denomination for Cosmos chains
export function getCosmosNativeDenom(chainId: number): string {
  switch (chainId) {
    case ChainId.NEUTRON_TESTNET:
      return 'untrn';
    case ChainId.JUNO_TESTNET:
      return 'ujuno';
    case ChainId.COSMOS_HUB_MAINNET:
    case ChainId.COSMOS_HUB_TESTNET:
      return 'uatom';
    case ChainId.OSMOSIS_MAINNET:
    case ChainId.OSMOSIS_TESTNET:
      return 'uosmo';
    case ChainId.STARGAZE_MAINNET:
    case ChainId.STARGAZE_TESTNET:
      return 'ustars';
    case ChainId.AKASH_MAINNET:
    case ChainId.AKASH_TESTNET:
      return 'uakt';
    default:
      return 'uatom'; // Default to ATOM
  }
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

// NEAR-specific utility functions

// Create NEAR execution parameters for Fusion+ orders
export function createNearExecutionParams(
  contractId: string,
  intent: FusionPlusIntent,
  hashlock: string
): NearExecutionParams {
  return {
    contractId,
    methodName: 'execute_fusion_order',
    args: {
      order_hash: intent.oneInchOrderHash,
      hashlock,
      amount: intent.destinationAmount,
      maker: intent.destinationAddress,
      resolver_fee: intent.resolverFeeAmount,
      timelocks: intent.timelocks
    },
    attachedDeposit: intent.destinationAmount,
    gas: '100000000000000' // 100 TGas
  };
}

// Check if destination chain is NEAR
export function isNearDestination(chainId: ChainId): boolean {
  return chainId === ChainId.NEAR_MAINNET || chainId === ChainId.NEAR_TESTNET;
}

// Get NEAR chain type from destination chain
export function getNearChainInfo(chainId: ChainId) {
  if (!isNearDestination(chainId)) {
    throw new Error('Chain is not NEAR');
  }
  return CHAIN_INFO[chainId];
}

// Convert NEAR amount to yoctoNEAR (24 decimals)
export function toYoctoNear(nearAmount: string): string {
  const amount = BigInt(nearAmount);
  return (amount * BigInt(10 ** 24)).toString();
}

// Convert yoctoNEAR to NEAR
export function fromYoctoNear(yoctoAmount: string): string {
  const amount = BigInt(yoctoAmount);
  return (amount / BigInt(10 ** 24)).toString();
}

// Create Fusion+ intent with NEAR destination
export function createFusionPlusNearIntent(
  intent: SwapIntent,
  contractId: string,
  oneInchOrderHash: string,
  safetyDeposit: string,
  timelockStages: number[]
): FusionPlusIntent {
  if (!isNearDestination(intent.destinationChain)) {
    throw new Error('Destination chain must be NEAR');
  }

  const fusionIntent = toFusionPlusIntent(intent, oneInchOrderHash, safetyDeposit, timelockStages);
  
  // Add NEAR-specific parameters
  fusionIntent.nearParams = createNearExecutionParams(
    contractId,
    fusionIntent,
    intent.hashlock || ''
  );

  return fusionIntent;
}

// Cosmos-specific utility functions

// Create Cosmos execution parameters for Fusion+ orders
export function createCosmosExecutionParams(
  contractAddress: string,
  intent: FusionPlusIntent,
  hashlock: string
): CosmosExecutionParams {
  const nativeDenom = getCosmosNativeDenom(intent.destinationChain);
  
  return {
    contractAddress,
    msg: {
      execute_fusion_order: {
        order_hash: intent.oneInchOrderHash,
        hashlock,
        amount: intent.destinationAmount,
        maker: intent.destinationAddress,
        resolver_fee: intent.resolverFeeAmount,
        timelocks: intent.timelocks
      }
    },
    funds: [
      {
        denom: nativeDenom,
        amount: intent.destinationAmount
      }
    ],
    gasLimit: 300000 // Default gas limit for Cosmos transactions
  };
}

// Check if destination chain is Cosmos
export function isCosmosDestination(chainId: ChainId): boolean {
  return isCosmosChain(chainId);
}

// Get Cosmos chain info from destination chain
export function getCosmosChainInfo(chainId: ChainId) {
  if (!isCosmosDestination(chainId)) {
    throw new Error('Chain is not Cosmos');
  }
  return CHAIN_INFO[chainId];
}

// Convert Cosmos amount to micro units (6 decimals for most Cosmos tokens)
export function toMicroCosmos(amount: string, decimals: number = 6): string {
  const amountBig = BigInt(amount);
  return (amountBig * BigInt(10 ** decimals)).toString();
}

// Convert micro units to standard Cosmos amount
export function fromMicroCosmos(microAmount: string, decimals: number = 6): string {
  const amount = BigInt(microAmount);
  return (amount / BigInt(10 ** decimals)).toString();
}

// Validate Cosmos bech32 address format
export function validateCosmosAddress(address: string, expectedPrefix?: string): boolean {
  // Basic bech32 validation
  if (!/^[a-z0-9]+1[a-z0-9]{38,58}$/.test(address)) {
    return false;
  }
  
  // Check prefix if provided
  if (expectedPrefix) {
    return address.startsWith(expectedPrefix);
  }
  
  // Accept common Cosmos prefixes
  const validPrefixes = ['neutron', 'juno', 'cosmos', 'osmo', 'stars', 'akash'];
  return validPrefixes.some(prefix => address.startsWith(prefix));
}

// Get expected address prefix for Cosmos chain
export function getCosmosAddressPrefix(chainId: ChainId): string {
  switch (chainId) {
    case ChainId.NEUTRON_TESTNET:
      return 'neutron';
    case ChainId.JUNO_TESTNET:
      return 'juno';
    case ChainId.COSMOS_HUB_MAINNET:
    case ChainId.COSMOS_HUB_TESTNET:
      return 'cosmos';
    case ChainId.OSMOSIS_MAINNET:
    case ChainId.OSMOSIS_TESTNET:
      return 'osmo';
    case ChainId.STARGAZE_MAINNET:
    case ChainId.STARGAZE_TESTNET:
      return 'stars';
    case ChainId.AKASH_MAINNET:
    case ChainId.AKASH_TESTNET:
      return 'akash';
    default:
      return 'cosmos';
  }
}

// Create Fusion+ intent with Cosmos destination
export function createFusionPlusCosmosIntent(
  intent: SwapIntent,
  contractAddress: string,
  oneInchOrderHash: string,
  safetyDeposit: string,
  timelockStages: number[]
): FusionPlusIntent {
  if (!isCosmosDestination(intent.destinationChain)) {
    throw new Error('Intent destination chain must be Cosmos');
  }

  const fusionIntent = toFusionPlusIntent(
    intent,
    oneInchOrderHash,
    safetyDeposit,
    timelockStages
  );

  // Add Cosmos-specific execution parameters
  const hashlock = generateOrderHash(intent); // Placeholder - would use actual hashlock
  const cosmosParams = createCosmosExecutionParams(contractAddress, fusionIntent, hashlock);

  return {
    ...fusionIntent,
    cosmosParams // This field would need to be added to FusionPlusIntent interface
  };
}