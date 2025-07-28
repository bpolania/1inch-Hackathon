/**
 * Ethers.js Mock for Testing
 * 
 * This mock replaces ethers functionality to avoid actual network calls during testing.
 */

const originalEthers = jest.requireActual('ethers');

// Mock provider that returns predictable values
const mockProvider = {
  getNetwork: jest.fn().mockResolvedValue({ chainId: 11155111n }),
  getBlockNumber: jest.fn().mockResolvedValue(12345),
  getBalance: jest.fn().mockResolvedValue(BigInt('25000000000000000')), // 0.025 ETH
  getFeeData: jest.fn().mockResolvedValue({
    gasPrice: BigInt('20000000000') // 20 gwei
  }),
  getCode: jest.fn().mockResolvedValue('0x608060405234801561001057600080fd5b50'),
  getTransactionReceipt: jest.fn().mockResolvedValue({
    status: 1,
    gasUsed: BigInt('100000'),
    blockNumber: 12345,
    transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234'
  }),
  estimateGas: jest.fn().mockResolvedValue(BigInt('650000'))
};

// Mock contract that returns predictable values
const mockContract = {
  getOrder: jest.fn().mockResolvedValue({
    maker: '0x1234567890123456789012345678901234567890',
    isActive: true,
    sourceToken: '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43',
    sourceAmount: BigInt('200000000000000000'),
    destinationChainId: BigInt('40002'),
    destinationToken: '0x0000000000000000000000000000000000000000',
    destinationAmount: BigInt('4000000000000000000000'),
    resolverFeeAmount: BigInt('20000000000000000'),
    expiryTime: BigInt(Math.floor(Date.now() / 1000) + 3600),
    hashlock: '0xdc10e49df5552b2daadb1864d6f38c59764669b67ac9bcc81a03f292ffed1515'
  }),
  matchFusionOrder: jest.fn().mockResolvedValue({
    hash: '0x8eea5557477e7ddf34c47380c01dbae3262639c7d35fc3b94dcb37cfc7101421',
    wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('500000') })
  }),
  completeFusionOrder: jest.fn().mockResolvedValue({
    hash: '0x89ad2ece9ee5dd8e2de1c949a72ecbd9087139a5411d79ec1f9eb75cb0b5a018',
    wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('100000') })
  }),
  sourceEscrows: jest.fn().mockResolvedValue('0x0000000000000000000000000000000000000000'),
  destinationEscrows: jest.fn().mockResolvedValue('0x0000000000000000000000000000000000000000'),
  registry: jest.fn().mockResolvedValue('0x59CE43Ea20892EC3Eff00fc7506cbfA9813FE0ca'),
  calculateMinSafetyDeposit: jest.fn().mockResolvedValue(BigInt('10000000000000000')), // 0.01 ETH
  totalOrdersCreated: jest.fn().mockResolvedValue(BigInt('5')),
  balanceOf: jest.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 token
  transfer: jest.fn().mockResolvedValue({
    hash: '0x2acb4a06f215004f797769582264970310ff4d77bb11dd7b2f2971ad2d911bc3',
    wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('50000') })
  }),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  queryFilter: jest.fn().mockResolvedValue([]),
  filters: {
    FusionOrderCreated: jest.fn().mockReturnValue('mocked-filter')
  }
};

// Mock wallet with validation
const createMockWallet = (privateKey: string) => {
  // Validate private key format (should be 64 hex chars with optional 0x prefix)
  const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
    throw new Error('Invalid private key');
  }
  
  return {
    address: '0x2e988A386a799F506693793c6A5AF6B54dfAaBfB',
    privateKey,
    connect: jest.fn().mockReturnValue({
      address: '0x2e988A386a799F506693793c6A5AF6B54dfAaBfB',
      getAddress: jest.fn().mockResolvedValue('0x2e988A386a799F506693793c6A5AF6B54dfAaBfB')
    })
  };
};

export const JsonRpcProvider = jest.fn().mockImplementation(() => mockProvider);
export const Contract = jest.fn().mockImplementation(() => mockContract);
export const Wallet = jest.fn().mockImplementation((privateKey: string) => createMockWallet(privateKey));

// Re-export all other ethers functionality
export const { parseEther, formatEther, ZeroAddress, parseUnits, formatUnits, keccak256, toUtf8Bytes, zeroPadValue } = originalEthers;

// Also create the ethers object for dynamic imports
export const ethers = {
  ...originalEthers,
  JsonRpcProvider,
  Contract,
  Wallet
};

export default {
  ...originalEthers,
  JsonRpcProvider,
  Contract,
  Wallet,
  ethers
};