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
  
  // Cosmos Ecosystem - Following bounty specification
  NEUTRON_TESTNET = 7001,
  JUNO_TESTNET = 7002,
  
  // Future Cosmos chains
  COSMOS_HUB_MAINNET = 30001,
  COSMOS_HUB_TESTNET = 30002,
  OSMOSIS_MAINNET = 30003,
  OSMOSIS_TESTNET = 30004,
  STARGAZE_MAINNET = 30005,
  STARGAZE_TESTNET = 30006,
  AKASH_MAINNET = 30007,
  AKASH_TESTNET = 30008,
  
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
  // Cosmos Ecosystem - Bounty specified chains
  [ChainId.NEUTRON_TESTNET]: {
    id: ChainId.NEUTRON_TESTNET,
    type: ChainType.COSMOS,
    name: 'Neutron Testnet',
    nativeCurrency: { name: 'Neutron', symbol: 'NTRN', decimals: 6 },
    rpcUrl: 'https://rpc-falcron.pion-1.ntrn.tech',
    explorerUrl: 'https://neutron.celat.one/neutron-testnet',
  },
  [ChainId.JUNO_TESTNET]: {
    id: ChainId.JUNO_TESTNET,
    type: ChainType.COSMOS,
    name: 'Juno Testnet',
    nativeCurrency: { name: 'Juno', symbol: 'JUNO', decimals: 6 },
    rpcUrl: 'https://rpc.uni.junonetwork.io',
    explorerUrl: 'https://testnet.juno.explorers.guru',
  },
  
  // Future Cosmos chains
  [ChainId.COSMOS_HUB_MAINNET]: {
    id: ChainId.COSMOS_HUB_MAINNET,
    type: ChainType.COSMOS,
    name: 'Cosmos Hub',
    nativeCurrency: { name: 'Atom', symbol: 'ATOM', decimals: 6 },
    rpcUrl: 'https://cosmos-rpc.quickapi.com',
    explorerUrl: 'https://www.mintscan.io/cosmos',
  },
  [ChainId.COSMOS_HUB_TESTNET]: {
    id: ChainId.COSMOS_HUB_TESTNET,
    type: ChainType.COSMOS,
    name: 'Cosmos Hub Testnet',
    nativeCurrency: { name: 'Atom', symbol: 'ATOM', decimals: 6 },
    rpcUrl: 'https://rpc.sentry-02.theta-testnet.polypore.xyz',
    explorerUrl: 'https://explorer.theta-testnet.polypore.xyz',
  },
  [ChainId.OSMOSIS_MAINNET]: {
    id: ChainId.OSMOSIS_MAINNET,
    type: ChainType.COSMOS,
    name: 'Osmosis',
    nativeCurrency: { name: 'Osmosis', symbol: 'OSMO', decimals: 6 },
    rpcUrl: 'https://osmosis-rpc.quickapi.com',
    explorerUrl: 'https://www.mintscan.io/osmosis',
  },
  [ChainId.OSMOSIS_TESTNET]: {
    id: ChainId.OSMOSIS_TESTNET,
    type: ChainType.COSMOS,
    name: 'Osmosis Testnet',
    nativeCurrency: { name: 'Osmosis', symbol: 'OSMO', decimals: 6 },
    explorerUrl: 'https://testnet.mintscan.io/osmosis-testnet',
  },
  [ChainId.STARGAZE_MAINNET]: {
    id: ChainId.STARGAZE_MAINNET,
    type: ChainType.COSMOS,
    name: 'Stargaze',
    nativeCurrency: { name: 'Stargaze', symbol: 'STARS', decimals: 6 },
    explorerUrl: 'https://www.mintscan.io/stargaze',
  },
  [ChainId.STARGAZE_TESTNET]: {
    id: ChainId.STARGAZE_TESTNET,
    type: ChainType.COSMOS,
    name: 'Stargaze Testnet',
    nativeCurrency: { name: 'Stargaze', symbol: 'STARS', decimals: 6 },
  },
  [ChainId.AKASH_MAINNET]: {
    id: ChainId.AKASH_MAINNET,
    type: ChainType.COSMOS,
    name: 'Akash Network',
    nativeCurrency: { name: 'Akash', symbol: 'AKT', decimals: 6 },
    explorerUrl: 'https://www.mintscan.io/akash',
  },
  [ChainId.AKASH_TESTNET]: {
    id: ChainId.AKASH_TESTNET,
    type: ChainType.COSMOS,
    name: 'Akash Network Testnet',
    nativeCurrency: { name: 'Akash', symbol: 'AKT', decimals: 6 },
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