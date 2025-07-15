import { SwapIntent, TokenInfo } from '../types/intent';
import { ChainId } from '../types/chains';
import { createIntent } from '../utils/intent';
import { NATIVE_TOKEN_ADDRESS } from '../constants';

// Example token definitions
export const EXAMPLE_TOKENS: Record<string, TokenInfo> = {
  ETH_MAINNET: {
    chainId: ChainId.ETHEREUM_MAINNET,
    address: NATIVE_TOKEN_ADDRESS,
    symbol: 'ETH',
    decimals: 18,
  },
  USDC_ETHEREUM: {
    chainId: ChainId.ETHEREUM_MAINNET,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    decimals: 6,
  },
  APT_MAINNET: {
    chainId: ChainId.APTOS_MAINNET,
    address: NATIVE_TOKEN_ADDRESS,
    symbol: 'APT',
    decimals: 8,
  },
  BTC_MAINNET: {
    chainId: ChainId.BITCOIN_MAINNET,
    address: NATIVE_TOKEN_ADDRESS,
    symbol: 'BTC',
    decimals: 8,
  },
  ATOM_MAINNET: {
    chainId: ChainId.COSMOS_HUB_MAINNET,
    address: NATIVE_TOKEN_ADDRESS,
    symbol: 'ATOM',
    decimals: 6,
  },
};

// Example 1: ETH to BTC swap
export function createEthToBtcIntent(): SwapIntent {
  return createIntent({
    maker: '0x1234567890123456789012345678901234567890',
    sourceChain: ChainId.ETHEREUM_MAINNET,
    sourceToken: EXAMPLE_TOKENS.ETH_MAINNET,
    sourceAmount: '1000000000000000000', // 1 ETH
    destinationChain: ChainId.BITCOIN_MAINNET,
    destinationToken: EXAMPLE_TOKENS.BTC_MAINNET,
    destinationAmount: '2500000', // 0.025 BTC (assuming 1 ETH = 0.025 BTC)
    destinationAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    slippageBps: 50, // 0.5% slippage
    resolverFeeAmount: '3000000000000000', // 0.003 ETH resolver fee
  });
}

// Example 2: USDC to APT swap
export function createUsdcToAptIntent(): SwapIntent {
  return createIntent({
    maker: '0x2345678901234567890123456789012345678901',
    sourceChain: ChainId.ETHEREUM_MAINNET,
    sourceToken: EXAMPLE_TOKENS.USDC_ETHEREUM,
    sourceAmount: '1000000000', // 1000 USDC
    destinationChain: ChainId.APTOS_MAINNET,
    destinationToken: EXAMPLE_TOKENS.APT_MAINNET,
    destinationAmount: '12500000000', // 125 APT (assuming 1 APT = $8)
    destinationAddress: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    slippageBps: 100, // 1% slippage
    resolverFeeAmount: '5000000', // 5 USDC resolver fee
  });
}

// Example 3: BTC to ATOM swap
export function createBtcToAtomIntent(): SwapIntent {
  return createIntent({
    maker: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    sourceChain: ChainId.BITCOIN_MAINNET,
    sourceToken: EXAMPLE_TOKENS.BTC_MAINNET,
    sourceAmount: '5000000', // 0.05 BTC
    destinationChain: ChainId.COSMOS_HUB_MAINNET,
    destinationToken: EXAMPLE_TOKENS.ATOM_MAINNET,
    destinationAmount: '250000000', // 250 ATOM (assuming 1 ATOM = ~$10)
    destinationAddress: 'cosmos1234567890abcdef1234567890abcdef12345678',
    slippageBps: 75, // 0.75% slippage
    resolverFeeAmount: '25000', // 0.00025 BTC resolver fee
  });
}

// Example 4: APT to ETH swap
export function createAptToEthIntent(): SwapIntent {
  return createIntent({
    maker: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    sourceChain: ChainId.APTOS_MAINNET,
    sourceToken: EXAMPLE_TOKENS.APT_MAINNET,
    sourceAmount: '10000000000', // 100 APT
    destinationChain: ChainId.ETHEREUM_MAINNET,
    destinationToken: EXAMPLE_TOKENS.ETH_MAINNET,
    destinationAmount: '800000000000000000', // 0.8 ETH
    destinationAddress: '0x3456789012345678901234567890123456789012',
    slippageBps: 200, // 2% slippage
    resolverFeeAmount: '300000000', // 3 APT resolver fee
    expiryTime: Math.floor(Date.now() / 1000) + 7200, // 2 hours from now
  });
}

// Example 5: Cross-chain testnet swap for development
export function createTestnetIntent(): SwapIntent {
  return createIntent({
    maker: '0x9876543210987654321098765432109876543210',
    sourceChain: ChainId.ETHEREUM_SEPOLIA,
    sourceToken: {
      chainId: ChainId.ETHEREUM_SEPOLIA,
      address: NATIVE_TOKEN_ADDRESS,
      symbol: 'ETH',
      decimals: 18,
    },
    sourceAmount: '100000000000000000', // 0.1 ETH
    destinationChain: ChainId.APTOS_TESTNET,
    destinationToken: {
      chainId: ChainId.APTOS_TESTNET,
      address: NATIVE_TOKEN_ADDRESS,
      symbol: 'APT',
      decimals: 8,
    },
    destinationAmount: '1250000000', // 12.5 APT
    destinationAddress: '0xtest1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    slippageBps: 300, // 3% slippage (higher for testnet)
    resolverFeeAmount: '1000000000000000', // 0.001 ETH resolver fee
  });
}

// Helper function to create custom intent with validation
export function createCustomIntent(params: {
  maker: string;
  sourceChain: ChainId;
  sourceToken: string;
  sourceAmount: string;
  destinationChain: ChainId;
  destinationToken: string;
  destinationAmount: string;
  destinationAddress: string;
  slippageBps?: number;
  resolverFeeAmount?: string;
  expiryTimeHours?: number;
}): SwapIntent {
  // Determine token info based on chain and address
  const getTokenInfo = (chainId: ChainId, address: string): TokenInfo => {
    if (address === NATIVE_TOKEN_ADDRESS) {
      const chainName = Object.keys(ChainId)[Object.values(ChainId).indexOf(chainId)];
      const symbol = chainName.split('_')[0];
      const decimals = chainId < 20000 ? 18 : chainId < 30000 ? 8 : 6;
      
      return { chainId, address, symbol, decimals };
    }
    
    // For non-native tokens, we'd typically look up decimals from contract
    // For this example, we'll use reasonable defaults
    return { 
      chainId, 
      address, 
      symbol: 'UNKNOWN', 
      decimals: chainId < 20000 ? 18 : 8 
    };
  };

  const sourceToken = getTokenInfo(params.sourceChain, params.sourceToken);
  const destinationToken = getTokenInfo(params.destinationChain, params.destinationToken);

  const expiryTime = params.expiryTimeHours 
    ? Math.floor(Date.now() / 1000) + (params.expiryTimeHours * 3600)
    : undefined;

  const resolverFeeAmount = params.resolverFeeAmount || 
    (BigInt(params.sourceAmount) / 1000n).toString(); // Default 0.1% fee

  return createIntent({
    maker: params.maker,
    sourceChain: params.sourceChain,
    sourceToken,
    sourceAmount: params.sourceAmount,
    destinationChain: params.destinationChain,
    destinationToken,
    destinationAmount: params.destinationAmount,
    destinationAddress: params.destinationAddress,
    slippageBps: params.slippageBps || 50,
    resolverFeeAmount,
    expiryTime,
  });
}

export const EXAMPLE_INTENTS = {
  ethToBtc: createEthToBtcIntent,
  usdcToApt: createUsdcToAptIntent,
  btcToAtom: createBtcToAtomIntent,
  aptToEth: createAptToEthIntent,
  testnet: createTestnetIntent,
};