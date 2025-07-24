export enum ChainId {
  // EVM Chains
  ETHEREUM_MAINNET = 1,
  ETHEREUM_SEPOLIA = 11155111,
  
  // Non-EVM Chains - Using custom IDs
  APTOS_MAINNET = 10001,
  APTOS_TESTNET = 10002,
  
  BITCOIN_MAINNET = 20001,
  BITCOIN_TESTNET = 20002,
  
  DOGECOIN_MAINNET = 20003,
  DOGECOIN_TESTNET = 20004,
  
  LITECOIN_MAINNET = 20005,
  LITECOIN_TESTNET = 20006,
  
  BITCOIN_CASH_MAINNET = 20007,
  BITCOIN_CASH_TESTNET = 20008,
  
  COSMOS_HUB_MAINNET = 30001,
  COSMOS_HUB_TESTNET = 30002,
  
  NEAR_MAINNET = 40001,
  NEAR_TESTNET = 40002,
}

export enum ChainType {
  EVM = 'EVM',
  APTOS = 'APTOS',
  BITCOIN = 'BITCOIN',
  COSMOS = 'COSMOS',
  NEAR = 'NEAR',
}

export interface ChainInfo {
  id: ChainId;
  type: ChainType;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl?: string;
  explorerUrl?: string;
}

export const CHAIN_INFO: Record<ChainId, ChainInfo> = {
  [ChainId.ETHEREUM_MAINNET]: {
    id: ChainId.ETHEREUM_MAINNET,
    type: ChainType.EVM,
    name: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    explorerUrl: 'https://etherscan.io',
  },
  [ChainId.ETHEREUM_SEPOLIA]: {
    id: ChainId.ETHEREUM_SEPOLIA,
    type: ChainType.EVM,
    name: 'Ethereum Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  [ChainId.APTOS_MAINNET]: {
    id: ChainId.APTOS_MAINNET,
    type: ChainType.APTOS,
    name: 'Aptos Mainnet',
    nativeCurrency: { name: 'Aptos', symbol: 'APT', decimals: 8 },
    explorerUrl: 'https://explorer.aptoslabs.com',
  },
  [ChainId.APTOS_TESTNET]: {
    id: ChainId.APTOS_TESTNET,
    type: ChainType.APTOS,
    name: 'Aptos Testnet',
    nativeCurrency: { name: 'Aptos', symbol: 'APT', decimals: 8 },
    explorerUrl: 'https://explorer.aptoslabs.com',
  },
  [ChainId.BITCOIN_MAINNET]: {
    id: ChainId.BITCOIN_MAINNET,
    type: ChainType.BITCOIN,
    name: 'Bitcoin',
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 8 },
    explorerUrl: 'https://blockstream.info',
  },
  [ChainId.BITCOIN_TESTNET]: {
    id: ChainId.BITCOIN_TESTNET,
    type: ChainType.BITCOIN,
    name: 'Bitcoin Testnet',
    nativeCurrency: { name: 'Bitcoin', symbol: 'tBTC', decimals: 8 },
    explorerUrl: 'https://blockstream.info/testnet',
  },
  [ChainId.DOGECOIN_MAINNET]: {
    id: ChainId.DOGECOIN_MAINNET,
    type: ChainType.BITCOIN,
    name: 'Dogecoin',
    nativeCurrency: { name: 'Dogecoin', symbol: 'DOGE', decimals: 8 },
    explorerUrl: 'https://blockchair.com/dogecoin',
  },
  [ChainId.DOGECOIN_TESTNET]: {
    id: ChainId.DOGECOIN_TESTNET,
    type: ChainType.BITCOIN,
    name: 'Dogecoin Testnet',
    nativeCurrency: { name: 'Dogecoin', symbol: 'tDOGE', decimals: 8 },
  },
  [ChainId.LITECOIN_MAINNET]: {
    id: ChainId.LITECOIN_MAINNET,
    type: ChainType.BITCOIN,
    name: 'Litecoin',
    nativeCurrency: { name: 'Litecoin', symbol: 'LTC', decimals: 8 },
    explorerUrl: 'https://blockchair.com/litecoin',
  },
  [ChainId.LITECOIN_TESTNET]: {
    id: ChainId.LITECOIN_TESTNET,
    type: ChainType.BITCOIN,
    name: 'Litecoin Testnet',
    nativeCurrency: { name: 'Litecoin', symbol: 'tLTC', decimals: 8 },
  },
  [ChainId.BITCOIN_CASH_MAINNET]: {
    id: ChainId.BITCOIN_CASH_MAINNET,
    type: ChainType.BITCOIN,
    name: 'Bitcoin Cash',
    nativeCurrency: { name: 'Bitcoin Cash', symbol: 'BCH', decimals: 8 },
    explorerUrl: 'https://blockchair.com/bitcoin-cash',
  },
  [ChainId.BITCOIN_CASH_TESTNET]: {
    id: ChainId.BITCOIN_CASH_TESTNET,
    type: ChainType.BITCOIN,
    name: 'Bitcoin Cash Testnet',
    nativeCurrency: { name: 'Bitcoin Cash', symbol: 'tBCH', decimals: 8 },
  },
  [ChainId.COSMOS_HUB_MAINNET]: {
    id: ChainId.COSMOS_HUB_MAINNET,
    type: ChainType.COSMOS,
    name: 'Cosmos Hub',
    nativeCurrency: { name: 'Atom', symbol: 'ATOM', decimals: 6 },
    explorerUrl: 'https://www.mintscan.io/cosmos',
  },
  [ChainId.COSMOS_HUB_TESTNET]: {
    id: ChainId.COSMOS_HUB_TESTNET,
    type: ChainType.COSMOS,
    name: 'Cosmos Hub Testnet',
    nativeCurrency: { name: 'Atom', symbol: 'ATOM', decimals: 6 },
  },
  [ChainId.NEAR_MAINNET]: {
    id: ChainId.NEAR_MAINNET,
    type: ChainType.NEAR,
    name: 'NEAR Protocol',
    nativeCurrency: { name: 'NEAR', symbol: 'NEAR', decimals: 24 },
    rpcUrl: 'https://rpc.mainnet.near.org',
    explorerUrl: 'https://nearblocks.io',
  },
  [ChainId.NEAR_TESTNET]: {
    id: ChainId.NEAR_TESTNET,
    type: ChainType.NEAR,
    name: 'NEAR Testnet',
    nativeCurrency: { name: 'NEAR', symbol: 'NEAR', decimals: 24 },
    rpcUrl: 'https://rpc.testnet.near.org',
    explorerUrl: 'https://testnet.nearblocks.io',
  },
};