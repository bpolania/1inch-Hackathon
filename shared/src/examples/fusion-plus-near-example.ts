/**
 * Example: Creating a Fusion+ Order with NEAR Destination
 * 
 * This example demonstrates how to extend 1inch Fusion+ to support NEAR Protocol
 * as a destination chain for cross-chain atomic swaps.
 */

import { 
  SwapIntent, 
  FusionPlusIntent, 
  IntentStatus,
  TokenInfo 
} from '../types/intent';
import { ChainId } from '../types/chains';
import { 
  createFusionPlusNearIntent,
  generateOrderHash,
  calculateSafetyDeposit,
  getDefaultTimelockStages,
  isNearDestination
} from '../utils/fusion-plus';

// Example: ETH  NEAR swap via 1inch Fusion+
export function createEthToNearFusionOrder(): FusionPlusIntent {
  // Step 1: Create base swap intent
  const baseIntent: SwapIntent = {
    intentId: 'fusion-near-' + Date.now(),
    maker: '0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f', // Ethereum address
    
    // Source: USDC on Ethereum Sepolia
    sourceChain: ChainId.ETHEREUM_SEPOLIA,
    sourceToken: {
      chainId: ChainId.ETHEREUM_SEPOLIA,
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
      symbol: 'USDC',
      decimals: 6
    } as TokenInfo,
    sourceAmount: '10000000', // 10 USDC

    // Destination: NEAR on NEAR Testnet
    destinationChain: ChainId.NEAR_TESTNET,
    destinationToken: {
      chainId: ChainId.NEAR_TESTNET,
      address: 'native', // Native NEAR token
      symbol: 'NEAR',
      decimals: 24
    } as TokenInfo,
    destinationAmount: '2000000000000000000000000', // 2 NEAR in yoctoNEAR
    destinationAddress: 'user.testnet', // NEAR account to receive tokens

    // Trading parameters
    slippageBps: 100, // 1% slippage
    resolverFeeAmount: '100000', // 0.1 USDC resolver fee

    // Timing
    createdAt: Math.floor(Date.now() / 1000),
    expiryTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry

    // Status
    status: IntentStatus.PENDING
  };

  // Step 2: Generate order hash for 1inch compatibility
  const orderHash = generateOrderHash(baseIntent);

  // Step 3: Calculate safety deposit (5% of source amount)
  const safetyDeposit = calculateSafetyDeposit(baseIntent.sourceAmount);

  // Step 4: Get default timelock stages
  const timelockStages = getDefaultTimelockStages();

  // Step 5: Create Fusion+ intent with NEAR support
  const fusionIntent = createFusionPlusNearIntent(
    baseIntent,
    'cross-chain-htlc.demo.cuteharbor3573.testnet', // NEAR contract
    orderHash,
    safetyDeposit,
    timelockStages
  );

  return fusionIntent;
}

// Example: NEAR  ETH swap via 1inch Fusion+
export function createNearToEthFusionOrder(): FusionPlusIntent {
  const baseIntent: SwapIntent = {
    intentId: 'fusion-eth-' + Date.now(),
    maker: 'user.testnet', // NEAR account

    // Source: NEAR on NEAR Testnet
    sourceChain: ChainId.NEAR_TESTNET,
    sourceToken: {
      chainId: ChainId.NEAR_TESTNET,
      address: 'native',
      symbol: 'NEAR',
      decimals: 24
    } as TokenInfo,
    sourceAmount: '2000000000000000000000000', // 2 NEAR

    // Destination: USDC on Ethereum Sepolia
    destinationChain: ChainId.ETHEREUM_SEPOLIA,
    destinationToken: {
      chainId: ChainId.ETHEREUM_SEPOLIA,
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      symbol: 'USDC',
      decimals: 6
    } as TokenInfo,
    destinationAmount: '10000000', // 10 USDC
    destinationAddress: '0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f',

    slippageBps: 100,
    resolverFeeAmount: '100000000000000000000000', // 0.1 NEAR resolver fee

    createdAt: Math.floor(Date.now() / 1000),
    expiryTime: Math.floor(Date.now() / 1000) + 3600,

    status: IntentStatus.PENDING
  };

  const orderHash = generateOrderHash(baseIntent);
  const safetyDeposit = calculateSafetyDeposit(baseIntent.sourceAmount);
  const timelockStages = getDefaultTimelockStages();

  // Note: This would be a NEAR-to-ETH swap, so no NEAR execution params needed
  // The NEAR side would be the source, Ethereum side would be destination
  return {
    ...baseIntent,
    oneInchOrderHash: orderHash,
    safetyDeposit,
    timelocks: '0', // Would be properly packed
    // No nearParams since NEAR is the source, not destination
  } as FusionPlusIntent;
}

// Validation function for NEAR Fusion+ orders
export function validateNearFusionOrder(order: FusionPlusIntent): boolean {
  // Check if it's a NEAR destination order
  if (isNearDestination(order.destinationChain)) {
    // Must have NEAR execution parameters
    if (!order.nearParams) {
      console.error('NEAR destination order missing nearParams');
      return false;
    }

    // Validate NEAR params
    if (!order.nearParams.contractId || !order.nearParams.methodName) {
      console.error('Invalid NEAR execution parameters');
      return false;
    }
  }

  // Check if it's a NEAR source order
  if (isNearDestination(order.sourceChain)) {
    // NEAR source orders should have proper token format
    if (order.sourceToken.address === 'native' && order.sourceToken.decimals !== 24) {
      console.error('Invalid NEAR native token decimals');
      return false;
    }
  }

  return true;
}

// Usage example
export function demonstrateFusionPlusNearExtension() {
  console.log(' Demonstrating 1inch Fusion+ Extension for NEAR');
  console.log('===============================================\n');

  // Create ETH  NEAR Fusion+ order
  const ethToNearOrder = createEthToNearFusionOrder();
  console.log(' ETH  NEAR Fusion+ Order:');
  console.log(` Intent ID: ${ethToNearOrder.intentId}`);
  console.log(` Source: ${ethToNearOrder.sourceAmount} USDC on Ethereum`);
  console.log(` Destination: ${ethToNearOrder.destinationAmount} yoctoNEAR on NEAR`);
  console.log(` 1inch Order Hash: ${ethToNearOrder.oneInchOrderHash}`);
  console.log(` Safety Deposit: ${ethToNearOrder.safetyDeposit} USDC`);
  console.log(` NEAR Contract: ${ethToNearOrder.nearParams?.contractId}\n`);

  // Validate the order
  const isValid = validateNearFusionOrder(ethToNearOrder);
  console.log(` Order validation: ${isValid ? 'PASSED' : 'FAILED'}\n`);

  // Create reverse order
  const nearToEthOrder = createNearToEthFusionOrder();
  console.log(' NEAR  ETH Fusion+ Order:');
  console.log(` Intent ID: ${nearToEthOrder.intentId}`);
  console.log(` Source: ${nearToEthOrder.sourceAmount} yoctoNEAR on NEAR`);
  console.log(` Destination: ${nearToEthOrder.destinationAmount} USDC on Ethereum`);
  console.log(` 1inch Order Hash: ${nearToEthOrder.oneInchOrderHash}\n`);

  console.log(' Fusion+ NEAR extension demonstrated successfully!');
  
  return { ethToNearOrder, nearToEthOrder };
}