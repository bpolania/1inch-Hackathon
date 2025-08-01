/**
 * Jest Test Setup
 * 
 * Global test configuration and setup for all test files
 */

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.testUtils = {
  
  /**
   * Sleep for specified milliseconds
   */
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * Generate random test data
   */
  randomString: (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  /**
   * Generate random Ethereum address
   */
  randomAddress: () => {
    const hex = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += hex[Math.floor(Math.random() * 16)];
    }
    return address;
  },
  
  /**
   * Generate random transaction hash
   */
  randomTxHash: () => {
    const hex = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += hex[Math.floor(Math.random() * 16)];
    }
    return hash;
  }
};

// Global mock implementations
global.mockImplementations = {
  
  /**
   * Mock Express Response
   */
  mockResponse: () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.header = jest.fn().mockReturnValue(res);
    return res;
  },
  
  /**
   * Mock Express Request
   */
  mockRequest: (overrides = {}) => {
    return {
      params: {},
      query: {},
      body: {},
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
      method: 'GET',
      url: '/',
      path: '/',
      ...overrides
    };
  },
  
  /**
   * Mock WebSocket
   */
  mockWebSocket: () => {
    return {
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
  },
  
  /**
   * Mock Service
   */
  mockService: (methods = []) => {
    const service: any = {};
    methods.forEach(method => {
      service[method] = jest.fn();
    });
    return service;
  }
};

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.NEAR_NETWORK = 'testnet';
process.env.BITCOIN_NETWORK = 'testnet';

// Global beforeEach and afterEach hooks
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset console mocks
  (console.log as jest.Mock).mockClear();
  (console.info as jest.Mock).mockClear();
  (console.warn as jest.Mock).mockClear();
  (console.error as jest.Mock).mockClear();
});

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});

// Global test matchers
expect.extend({
  
  /**
   * Custom matcher for API responses
   */
  toBeValidApiResponse(received: any, expectedStatus = 200) {
    const pass = received && 
                 typeof received.status === 'function' &&
                 typeof received.json === 'function';
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid API response`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid API response with status and json methods`,
        pass: false,
      };
    }
  },
  
  /**
   * Custom matcher for transaction objects
   */
  toBeValidTransaction(received: any) {
    const requiredFields = ['id', 'status', 'fromChain', 'toChain', 'timestamp'];
    const hasAllFields = requiredFields.every(field => received && received.hasOwnProperty(field));
    
    if (hasAllFields) {
      return {
        message: () => `Expected ${received} not to be a valid transaction`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to have all required transaction fields: ${requiredFields.join(', ')}`,
        pass: false,
      };
    }
  },
  
  /**
   * Custom matcher for batch objects
   */
  toBeValidBatch(received: any) {
    const requiredFields = ['batchId', 'totalTransactions', 'status', 'transactions'];
    const hasAllFields = requiredFields.every(field => received && received.hasOwnProperty(field));
    const hasValidTransactions = received && Array.isArray(received.transactions);
    
    if (hasAllFields && hasValidTransactions) {
      return {
        message: () => `Expected ${received} not to be a valid batch`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid batch with fields: ${requiredFields.join(', ')} and transactions array`,
        pass: false,
      };
    }
  },
  
  /**
   * Custom matcher for WebSocket messages
   */
  toBeValidWebSocketMessage(received: any) {
    const hasType = received && received.hasOwnProperty('type');
    const hasTimestamp = received && received.hasOwnProperty('timestamp');
    
    if (hasType && hasTimestamp) {
      return {
        message: () => `Expected ${received} not to be a valid WebSocket message`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid WebSocket message with type and timestamp`,
        pass: false,
      };
    }
  }
});

// Declare global types for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidApiResponse(expectedStatus?: number): R;
      toBeValidTransaction(): R;
      toBeValidBatch(): R;
      toBeValidWebSocketMessage(): R;
    }
  }
  
  var testUtils: {
    sleep: (ms: number) => Promise<void>;
    randomString: (length?: number) => string;
    randomAddress: () => string;
    randomTxHash: () => string;
  };
  
  var mockImplementations: {
    mockResponse: () => any;
    mockRequest: (overrides?: any) => any;
    mockWebSocket: () => any;
    mockService: (methods?: string[]) => any;
  };
}

// Export setup for external use
export {};