/**
 * Test setup and configuration
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.NEAR_NETWORK = 'testnet';
process.env.NEAR_ACCOUNT_ID = 'test-account.testnet';
process.env.NEAR_PRIVATE_KEY = 'ed25519:test-private-key';
process.env.ETHEREUM_RPC_URL = 'https://sepolia.infura.io/v3/test';
process.env.ETHEREUM_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
process.env.BITCOIN_NETWORK = 'testnet';
process.env.BITCOIN_PRIVATE_KEY = 'cVt4o7BGAig1UXywgGSmARhxMdzP5qvQsxKkSsc1XEkw3tDTQFpy';
process.env.ENABLE_CHAIN_SIGNATURES = 'true';
process.env.TEE_MODE = 'false'; // Disable TEE for testing

// Suppress console logs during tests unless explicitly needed
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  // Close any open connections
});