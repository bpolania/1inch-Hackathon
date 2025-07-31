/**
 * Test Setup for TEE Solver
 * 
 * Common test utilities and mock configurations
 */

// Mock WebSocket
jest.mock('ws');

// Fix BigInt serialization for Jest
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

// Mock environment variables
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
process.env.NODE_ENV = 'test';

// Common test utilities
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const createMockWebSocket = () => {
  const mockWs = {
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
    removeAllListeners: jest.fn()
  };
  
  // Simulate event emitters
  const eventHandlers: Record<string, Function[]> = {};
  
  mockWs.on.mockImplementation((event: string, handler: Function) => {
    if (!eventHandlers[event]) {
      eventHandlers[event] = [];
    }
    eventHandlers[event].push(handler);
    return mockWs;
  });
  
  const emit = (event: string, ...args: any[]) => {
    if (eventHandlers[event]) {
      eventHandlers[event].forEach(handler => handler(...args));
    }
  };
  
  return { mockWs, emit };
};

// Mock chain adapters using simple object approach
export const createMockChainAdapter = (chainId: string) => {
  return {
    chainId,
    getTokenInfo: jest.fn(() => Promise.resolve({
      address: '0x1234567890123456789012345678901234567890',
      symbol: 'TEST',
      decimals: 18,
      chainId
    })),
    getTokenBalance: jest.fn(() => Promise.resolve(BigInt('1000000000000000000'))),
    getTokenPrice: jest.fn(() => Promise.resolve(100)),
    getLiquiditySources: jest.fn(() => Promise.resolve([
      {
        protocol: 'uniswap',
        poolAddress: '0xpool1',
        tokenA: { address: '0xA', symbol: 'A', decimals: 18, chainId },
        tokenB: { address: '0xB', symbol: 'B', decimals: 18, chainId },
        reserveA: BigInt('1000000000000000000000'),
        reserveB: BigInt('2000000000000000000000'),
        fee: 30,
        lastUpdated: Date.now()
      }
    ])),
    estimateGasPrice: jest.fn(() => Promise.resolve(BigInt('20000000000'))),
    estimateGasCost: jest.fn(() => Promise.resolve(BigInt('200000'))),
    buildSwapTransaction: jest.fn(() => Promise.resolve({ data: '0x' })),
    buildBridgeTransaction: jest.fn(() => Promise.resolve({ data: '0x' })),
    deriveAddress: jest.fn(() => Promise.resolve('0xderived'))
  };
};

// Test data factories
export const createQuoteRequest = (overrides: any = {}) => ({
  id: 'test-request-123',
  timestamp: Date.now(),
  sourceChain: 'ethereum',
  destinationChain: 'near',
  sourceToken: {
    address: '0xA',
    symbol: 'TokenA',
    decimals: 18,
    chainId: 'ethereum'
  },
  destinationToken: {
    address: '0xB',
    symbol: 'TokenB',
    decimals: 18,
    chainId: 'near'
  },
  sourceAmount: BigInt('1000000000000000000'),
  userAddress: '0xuser',
  deadline: Math.floor(Date.now() / 1000) + 3600,
  slippageTolerance: 100,
  ...overrides
});

export const createSolverConfig = (overrides: any = {}) => ({
  solverId: 'test-solver',
  nearAccount: 'test.near',
  relayUrl: 'ws://localhost:8080',
  supportedChains: ['ethereum', 'near', 'cosmos'],
  defaultMarginBps: 30,
  maxQuoteAge: 300,
  minProfitThreshold: BigInt('1000000000000000'),
  maxConcurrentQuotes: 10,
  quoteTimeoutMs: 5000,
  teeEnabled: false,
  ...overrides
});

// Assertion helpers
export const expectBigInt = (actual: bigint, expected: bigint, tolerance = 0) => {
  const diff = actual > expected ? actual - expected : expected - actual;
  expect(Number(diff)).toBeLessThanOrEqual(tolerance);
};

// Add a dummy test to prevent "no tests" error
describe('Setup', () => {
  it('should initialize test environment', () => {
    expect(true).toBe(true);
  });
});