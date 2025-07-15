// Time constants (in seconds)
export const TIME_CONSTANTS = {
  MIN_EXPIRY_TIME: 300, // 5 minutes minimum
  MAX_EXPIRY_TIME: 86400, // 24 hours maximum
  DEFAULT_EXPIRY_TIME: 3600, // 1 hour default
  
  // HTLC timelock recommendations per chain
  HTLC_TIMELOCK: {
    ETHEREUM: 3600, // 1 hour (for ~300 blocks)
    APTOS: 1800, // 30 minutes
    BITCOIN: 7200, // 2 hours (for ~12 blocks)
    COSMOS: 3600, // 1 hour
  },
  
  // Safety buffer for cross-chain timing
  CROSS_CHAIN_BUFFER: 600, // 10 minutes
} as const;

// Fee constants
export const FEE_CONSTANTS = {
  MIN_RESOLVER_FEE_BPS: 10, // 0.1% minimum
  DEFAULT_RESOLVER_FEE_BPS: 30, // 0.3% default
  MAX_RESOLVER_FEE_BPS: 500, // 5% maximum
  
  // Slippage
  MIN_SLIPPAGE_BPS: 10, // 0.1% minimum
  DEFAULT_SLIPPAGE_BPS: 50, // 0.5% default
  MAX_SLIPPAGE_BPS: 1000, // 10% maximum
} as const;

// Native token addresses
export const NATIVE_TOKEN_ADDRESS = 'native';

// Common token addresses per chain (examples)
export const COMMON_TOKENS = {
  ETHEREUM: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
  ETHEREUM_SEPOLIA: {
    WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
    USDC: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
  },
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  MIN_SWAP_AMOUNT_USD: 10, // $10 minimum swap
  MAX_SWAP_AMOUNT_USD: 1000000, // $1M maximum swap
  MAX_INTENT_ID_LENGTH: 66, // 0x + 64 hex chars
  MAX_ADDRESS_LENGTH: 128, // To accommodate different chain formats
} as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_CHAIN: 'Invalid or unsupported chain ID',
  INVALID_TOKEN: 'Invalid token address',
  INVALID_AMOUNT: 'Invalid amount',
  INVALID_EXPIRY: 'Invalid expiry time',
  INVALID_SIGNATURE: 'Invalid intent signature',
  INVALID_HASHLOCK: 'Invalid hashlock',
  INTENT_EXPIRED: 'Intent has expired',
  INSUFFICIENT_RESOLVER_FEE: 'Resolver fee too low',
  SLIPPAGE_TOO_HIGH: 'Slippage tolerance too high',
  AMOUNT_TOO_LOW: 'Amount below minimum',
  AMOUNT_TOO_HIGH: 'Amount above maximum',
} as const;