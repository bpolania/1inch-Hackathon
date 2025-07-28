/**
 * Jest Test Setup
 * 
 * Global test configuration and mocks for the automated relayer tests.
 */

// Mock environment variables for testing
process.env.ETHEREUM_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
process.env.NEAR_ACCOUNT_ID = 'test-resolver.testnet';
process.env.NEAR_PRIVATE_KEY = 'ed25519:1234567890123456789012345678901234567890123456789012345678901234567890';
process.env.ETHEREUM_FACTORY_ADDRESS = '0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a';
process.env.ETHEREUM_REGISTRY_ADDRESS = '0x59CE43Ea20892EC3Eff00fc7506cbfA9813FE0ca';
process.env.ETHEREUM_TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
process.env.NEAR_CONTRACT_ID = 'fusion-plus.demo.cuteharbor3573.testnet';
process.env.ETHEREUM_RPC_URL = 'http://localhost:8545'; // Mock RPC
process.env.NEAR_RPC_URL = 'http://localhost:3030'; // Mock RPC

// Mock ethers using manual mock file
jest.mock('ethers');

// Suppress console logs during testing unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }
});

afterEach(() => {
  if (!process.env.VERBOSE_TESTS) {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
});

// Global test utilities
(global as any).sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock order data for testing
(global as any).mockOrder = {
  orderHash: '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4',
  maker: '0x1234567890123456789012345678901234567890',
  sourceToken: '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43',
  sourceAmount: BigInt('200000000000000000'), // 0.2 tokens
  destinationChainId: 40002,
  destinationToken: 'near',
  destinationAmount: BigInt('4000000000000000000000'), // 0.004 NEAR
  resolverFeeAmount: BigInt('20000000000000000'), // 0.02 tokens
  expiryTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  hashlock: '0xdc10e49df5552b2daadb1864d6f38c59764669b67ac9bcc81a03f292ffed1515',
  isActive: true,
  blockNumber: 12345,
  transactionHash: '0xf45e3f29a382dbb79df313a9382923898105915f48b610ab605cb13861c9b029'
};

// Fix BigInt serialization for Jest
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

// Dummy test to prevent "no tests" error
describe('Test Setup', () => {
  it('should have properly mocked environment', () => {
    expect(process.env.ETHEREUM_PRIVATE_KEY).toBeDefined();
    expect((global as any).mockOrder).toBeDefined();
  });
});