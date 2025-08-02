/**
 * Configuration Tests
 * 
 * Tests for configuration loading and validation.
 */

import { loadConfig, validateConfig } from '../../config/config';

describe('Configuration', () => {
  describe('loadConfig', () => {
    it('should load configuration with environment variables', async () => {
      const config = await loadConfig();

      expect(config).toBeDefined();
      expect(config.networks).toEqual(['ethereum', 'near', 'bitcoin', 'cosmos']);
      expect(config.ethereum.chainId).toBe(11155111);
      expect(config.near.chainId).toBe(40002);
      expect(config.wallet.ethereum.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should derive Ethereum address from private key', async () => {
      const config = await loadConfig();

      expect(config.wallet.ethereum.address).toBe('0x2e988A386a799F506693793c6A5AF6B54dfAaBfB');
    });

    it('should have default execution parameters', async () => {
      const config = await loadConfig();

      expect(config.execution.loopInterval).toBe(10000);
      expect(config.execution.maxConcurrentExecutions).toBe(3);
      expect(config.execution.minProfitThreshold).toBe('0.001');
      expect(config.execution.retryAttempts).toBe(3);
    });

    it('should throw error for missing required environment variables', async () => {
      const originalPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;
      delete process.env.ETHEREUM_PRIVATE_KEY;

      await expect(loadConfig()).rejects.toThrow('Required environment variable ETHEREUM_PRIVATE_KEY is not set');

      process.env.ETHEREUM_PRIVATE_KEY = originalPrivateKey;
    });

    it('should throw error for invalid private key', async () => {
      const originalPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;
      process.env.ETHEREUM_PRIVATE_KEY = 'invalid_private_key';

      await expect(loadConfig()).rejects.toThrow('Invalid Ethereum private key');

      process.env.ETHEREUM_PRIVATE_KEY = originalPrivateKey;
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', async () => {
      const config = await loadConfig();
      
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw error for missing factory address', async () => {
      const config = await loadConfig();
      config.ethereum.contracts.factory = '';

      expect(() => validateConfig(config)).toThrow('Ethereum factory contract address is required');
    });

    it('should throw error for missing NEAR contract', async () => {
      const config = await loadConfig();
      config.near.contracts.factory = '';

      expect(() => validateConfig(config)).toThrow('NEAR contract ID is required');
    });

    it('should throw error for invalid profit threshold', async () => {
      const config = await loadConfig();
      config.execution.minProfitThreshold = '-0.001';

      expect(() => validateConfig(config)).toThrow('Minimum profit threshold must be positive');
    });

    it('should throw error for invalid max concurrent executions', async () => {
      const config = await loadConfig();
      config.execution.maxConcurrentExecutions = 0;

      expect(() => validateConfig(config)).toThrow('Max concurrent executions must be positive');
    });
  });
});