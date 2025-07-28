/**
 * WalletManager Tests
 * 
 * Tests for multi-chain wallet management functionality.
 */

import { WalletManager } from '../../wallet/WalletManager';
import { loadConfig } from '../../config/config';
import { ethers } from 'ethers';

describe('WalletManager', () => {
  let walletManager: WalletManager;
  let config: any;

  beforeEach(async () => {
    config = await loadConfig();
    walletManager = new WalletManager(config);
  });

  describe('initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(walletManager.initialize()).resolves.not.toThrow();
      
      const status = walletManager.getStatus();
      expect((status as any).isInitialized).toBe(true);
      expect((status as any).ethereum.address).toBe(config.wallet.ethereum.address);
      expect((status as any).near.accountId).toBe(config.wallet.near.accountId);
    });

    it('should throw error when accessing methods before initialization', () => {
      expect(() => walletManager.getEthereumProvider()).toThrow('WalletManager not initialized');
      expect(() => walletManager.getEthereumSigner()).toThrow('WalletManager not initialized');
      expect(() => walletManager.getNearAccount()).toThrow('WalletManager not initialized');
    });

    it('should provide access to Ethereum components after initialization', async () => {
      await walletManager.initialize();

      const provider = walletManager.getEthereumProvider();
      const signer = walletManager.getEthereumSigner();
      const wallet = walletManager.getEthereumWallet();

      expect(provider).toBeDefined();
      expect(signer).toBeDefined();
      expect(wallet).toBeDefined();
      expect(wallet.address).toBe(config.wallet.ethereum.address);
    });

    it('should provide access to NEAR components after initialization', async () => {
      await walletManager.initialize();

      const nearAccount = walletManager.getNearAccount();
      
      expect(nearAccount).toBeDefined();
      expect(nearAccount.accountId).toBe(config.wallet.near.accountId);
    });
  });

  describe('balance management', () => {
    beforeEach(async () => {
      await walletManager.initialize();
    });

    it('should get Ethereum balance', async () => {
      const balance = await walletManager.getEthereumBalance();
      
      expect(balance).toBeDefined();
      expect(typeof balance).toBe('bigint');
      expect(balance).toBe(BigInt('25000000000000000')); // 0.025 ETH from mock
    });

    it('should get NEAR balance', async () => {
      const balance = await walletManager.getNearBalance();
      
      expect(balance).toBeDefined();
      expect(typeof balance).toBe('string');
      expect(balance).toBe('7.96'); // Mock balance
    });

    it('should check if balances are sufficient', async () => {
      const balances = await walletManager.checkBalances();
      
      expect(balances).toBeDefined();
      expect(balances.ethereum).toBeDefined();
      expect(balances.near).toBeDefined();
      
      expect(balances.ethereum.balance).toBe('0.025');
      expect(balances.ethereum.sufficient).toBe(true);
      expect(balances.near.balance).toBe('7.96');
      expect(balances.near.sufficient).toBe(true);
    });

    it('should detect insufficient Ethereum balance', async () => {
      // Mock low balance
      const mockProvider = walletManager.getEthereumProvider();
      (mockProvider.getBalance as jest.Mock).mockResolvedValueOnce(BigInt('5000000000000000')); // 0.005 ETH

      const balances = await walletManager.checkBalances();
      
      expect(balances.ethereum.sufficient).toBe(false);
    });
  });

  describe('gas estimation', () => {
    beforeEach(async () => {
      await walletManager.initialize();
    });

    it('should estimate gas costs for operations', async () => {
      const operations = ['matchOrder', 'completeOrder', 'tokenTransfer'];
      const gasEstimate = await walletManager.estimateGasCosts(operations);
      
      expect(gasEstimate).toBeDefined();
      expect(gasEstimate.ethereum).toBeDefined();
      expect(gasEstimate.near).toBe('0.01');
      expect(gasEstimate.total).toMatch(/ETH \+ 0\.01 NEAR/);
      
      // Should be sum of all operations
      const expectedGas = BigInt('650000'); // 500k + 100k + 50k
      const expectedCost = expectedGas * BigInt('20000000000'); // 20 gwei
      expect(gasEstimate.ethereum).toBe(expectedCost);
    });

    it('should handle unknown operations gracefully', async () => {
      const operations = ['unknownOperation'];
      const gasEstimate = await walletManager.estimateGasCosts(operations);
      
      expect(gasEstimate.ethereum).toBe(BigInt('0'));
    });
  });

  describe('status reporting', () => {
    it('should provide basic status when not initialized', () => {
      const status = walletManager.getStatus();
      
      expect((status as any).isInitialized).toBe(false);
      expect((status as any).ethereum.address).toBe(config.wallet.ethereum.address);
      expect((status as any).near.accountId).toBe(config.wallet.near.accountId);
    });

    it('should provide detailed status when initialized', async () => {
      await walletManager.initialize();
      
      const detailedStatus = await walletManager.getDetailedStatus();
      
      expect((detailedStatus as any).isInitialized).toBe(true);
      expect((detailedStatus as any).balances).toBeDefined();
      expect((detailedStatus as any).readyForExecution).toBe(true);
    });

    it('should indicate not ready when balances are insufficient', async () => {
      await walletManager.initialize();
      
      // Mock insufficient balance
      const mockProvider = walletManager.getEthereumProvider();
      (mockProvider.getBalance as jest.Mock).mockResolvedValueOnce(BigInt('1000000000000000')); // 0.001 ETH
      
      const detailedStatus = await walletManager.getDetailedStatus();
      
      expect((detailedStatus as any).readyForExecution).toBe(false);
    });
  });
});