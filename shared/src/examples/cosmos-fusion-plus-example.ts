/**
 * Example: Creating a Fusion+ Order with Cosmos Destination
 * 
 * This example demonstrates how to extend 1inch Fusion+ to support Cosmos chains
 * as destination chains for cross-chain atomic swaps.
 */

import { 
  SwapIntent, 
  FusionPlusIntent, 
  IntentStatus,
  TokenInfo 
} from '../types/intent';
import { ChainId } from '../types/chains';
import { 
  createFusionPlusCosmosIntent,
  generateOrderHash,
  calculateSafetyDeposit,
  getDefaultTimelockStages,
  isCosmosDestination,
  validateCosmosAddress,
  getCosmosAddressPrefix,
  getCosmosNativeDenom,
  toMicroCosmos
} from '../utils/fusion-plus';

// Example: ETH → Neutron swap via 1inch Fusion+
export function createEthToNeutronFusionOrder(): FusionPlusIntent {
  // Step 1: Create base swap intent
  const baseIntent: SwapIntent = {
    intentId: 'fusion-neutron-' + Date.now(),
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

    // Destination: Native NTRN on Neutron Testnet
    destinationChain: ChainId.NEUTRON_TESTNET,
    destinationToken: {
      chainId: ChainId.NEUTRON_TESTNET,
      address: 'native', // Native NTRN token
      symbol: 'NTRN',
      decimals: 6
    } as TokenInfo,
    destinationAmount: toMicroCosmos('25', 6), // 25 NTRN in micro units
    destinationAddress: 'neutron1x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x', // Neutron address

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

  // Step 5: Create Fusion+ intent with Cosmos support
  const fusionIntent = createFusionPlusCosmosIntent(
    baseIntent,
    'neutron1abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // CosmWasm contract
    orderHash,
    safetyDeposit,
    timelockStages
  );

  return fusionIntent;
}

// Example: ETH → Juno swap via 1inch Fusion+
export function createEthToJunoFusionOrder(): FusionPlusIntent {
  const baseIntent: SwapIntent = {
    intentId: 'fusion-juno-' + Date.now(),
    maker: '0x742d35Cc6Bf8f4A1b7BE8b6F8f8f8f8f8f8f8f8f',

    // Source: USDC on Ethereum Sepolia
    sourceChain: ChainId.ETHEREUM_SEPOLIA,
    sourceToken: {
      chainId: ChainId.ETHEREUM_SEPOLIA,
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      symbol: 'USDC',
      decimals: 6
    } as TokenInfo,
    sourceAmount: '20000000', // 20 USDC

    // Destination: Native JUNO on Juno Testnet
    destinationChain: ChainId.JUNO_TESTNET,
    destinationToken: {
      chainId: ChainId.JUNO_TESTNET,
      address: 'native',
      symbol: 'JUNO',
      decimals: 6
    } as TokenInfo,
    destinationAmount: toMicroCosmos('50', 6), // 50 JUNO in micro units
    destinationAddress: 'juno1x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x2x', // Juno address

    slippageBps: 100,
    resolverFeeAmount: '200000', // 0.2 USDC resolver fee

    createdAt: Math.floor(Date.now() / 1000),
    expiryTime: Math.floor(Date.now() / 1000) + 3600,

    status: IntentStatus.PENDING
  };

  const orderHash = generateOrderHash(baseIntent);
  const safetyDeposit = calculateSafetyDeposit(baseIntent.sourceAmount);
  const timelockStages = getDefaultTimelockStages();

  return createFusionPlusCosmosIntent(
    baseIntent,
    'juno1abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456', // CosmWasm contract
    orderHash,
    safetyDeposit,
    timelockStages
  );
}

// Validation function for Cosmos Fusion+ orders
export function validateCosmosFusionOrder(order: FusionPlusIntent): boolean {
  // Check if it's a Cosmos destination order
  if (isCosmosDestination(order.destinationChain)) {
    // Must have Cosmos execution parameters
    if (!order.cosmosParams) {
      console.error('Cosmos destination order missing cosmosParams');
      return false;
    }

    // Validate Cosmos params
    if (!order.cosmosParams.contractAddress || !order.cosmosParams.msg) {
      console.error('Invalid Cosmos execution parameters');
      return false;
    }

    // Validate destination address format
    const expectedPrefix = getCosmosAddressPrefix(order.destinationChain);
    if (!validateCosmosAddress(order.destinationAddress, expectedPrefix)) {
      console.error(`Invalid Cosmos address format for chain ${order.destinationChain}`);
      return false;
    }

    // Validate native denomination
    const expectedDenom = getCosmosNativeDenom(order.destinationChain);
    if (order.destinationToken.address === 'native') {
      const funds = order.cosmosParams.funds;
      if (!funds.some(fund => fund.denom === expectedDenom)) {
        console.error(`Missing expected native denomination ${expectedDenom}`);
        return false;
      }
    }
  }

  return true;
}

// Usage example
export function demonstrateFusionPlusCosmosExtension() {
  console.log('🌌 Demonstrating 1inch Fusion+ Extension for Cosmos');
  console.log('==================================================\n');

  // Create ETH → Neutron Fusion+ order
  const ethToNeutronOrder = createEthToNeutronFusionOrder();
  console.log('📋 ETH → Neutron Fusion+ Order:');
  console.log(`├── Intent ID: ${ethToNeutronOrder.intentId}`);
  console.log(`├── Source: ${ethToNeutronOrder.sourceAmount} USDC on Ethereum`);
  console.log(`├── Destination: ${ethToNeutronOrder.destinationAmount} micro-NTRN on Neutron`);
  console.log(`├── 1inch Order Hash: ${ethToNeutronOrder.oneInchOrderHash}`);
  console.log(`├── Safety Deposit: ${ethToNeutronOrder.safetyDeposit} USDC`);
  console.log(`└── CosmWasm Contract: ${ethToNeutronOrder.cosmosParams?.contractAddress}\n`);

  // Validate the order
  const isValidNeutron = validateCosmosFusionOrder(ethToNeutronOrder);
  console.log(`✅ Neutron order validation: ${isValidNeutron ? 'PASSED' : 'FAILED'}\n`);

  // Create ETH → Juno order
  const ethToJunoOrder = createEthToJunoFusionOrder();
  console.log('📋 ETH → Juno Fusion+ Order:');
  console.log(`├── Intent ID: ${ethToJunoOrder.intentId}`);
  console.log(`├── Source: ${ethToJunoOrder.sourceAmount} USDC on Ethereum`);
  console.log(`├── Destination: ${ethToJunoOrder.destinationAmount} micro-JUNO on Juno`);
  console.log(`├── 1inch Order Hash: ${ethToJunoOrder.oneInchOrderHash}`);
  console.log(`└── CosmWasm Contract: ${ethToJunoOrder.cosmosParams?.contractAddress}\n`);

  const isValidJuno = validateCosmosFusionOrder(ethToJunoOrder);
  console.log(`✅ Juno order validation: ${isValidJuno ? 'PASSED' : 'FAILED'}\n`);

  // Test utility functions
  console.log('🔧 Testing Cosmos Utility Functions:');
  console.log(`├── isCosmosDestination(NEUTRON_TESTNET): ${isCosmosDestination(ChainId.NEUTRON_TESTNET)}`);
  console.log(`├── getCosmosAddressPrefix(NEUTRON_TESTNET): ${getCosmosAddressPrefix(ChainId.NEUTRON_TESTNET)}`);
  console.log(`├── getCosmosNativeDenom(JUNO_TESTNET): ${getCosmosNativeDenom(ChainId.JUNO_TESTNET)}`);
  console.log(`├── validateCosmosAddress('neutron1test'): ${validateCosmosAddress('neutron1test', 'neutron')}`);
  console.log(`└── toMicroCosmos('10'): ${toMicroCosmos('10')}\n`);

  console.log('🎉 Fusion+ Cosmos extension demonstrated successfully!');
  
  return { ethToNeutronOrder, ethToJunoOrder };
}

// Export examples for testing
export const COSMOS_FUSION_EXAMPLES = {
  ethToNeutron: createEthToNeutronFusionOrder,
  ethToJuno: createEthToJunoFusionOrder,
  validate: validateCosmosFusionOrder,
  demo: demonstrateFusionPlusCosmosExtension
};