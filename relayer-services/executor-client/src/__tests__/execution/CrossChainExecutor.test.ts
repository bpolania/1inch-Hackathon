/**
 * CrossChainExecutor Tests
 * 
 * Tests for automated cross-chain atomic swap execution functionality.
 */

import { CrossChainExecutor } from '../../execution/CrossChainExecutor';
import { WalletManager } from '../../wallet/WalletManager';
import { loadConfig } from '../../config/config';
import { ExecutableOrder } from '../../core/ExecutorEngine';
import { ethers } from 'ethers';

describe('CrossChainExecutor', () => {
  let executor: CrossChainExecutor;
  let walletManager: WalletManager;
  let config: any;
  let mockFactoryContract: any;
  let mockRegistryContract: any;
  let mockTokenContract: any;
  let mockExecutableOrder: ExecutableOrder;

  beforeEach(async () => {
    config = await loadConfig();
    walletManager = new WalletManager(config);
    await walletManager.initialize();
    
    executor = new CrossChainExecutor(config, walletManager);

    // Set up mock contracts
    mockFactoryContract = {
      getOrder: jest.fn(),
      matchFusionOrder: jest.fn(),
      completeFusionOrder: jest.fn(),
      sourceEscrows: jest.fn(),
      destinationEscrows: jest.fn(),
      registry: jest.fn().mockResolvedValue('0x59CE43Ea20892EC3Eff00fc7506cbfA9813FE0ca')
    };

    mockRegistryContract = {
      calculateMinSafetyDeposit: jest.fn().mockResolvedValue(ethers.parseEther('0.01'))
    };

    mockTokenContract = {
      balanceOf: jest.fn(),
      transfer: jest.fn(),
      allowance: jest.fn(),
      approve: jest.fn()
    };

    // Mock contract creation
    jest.spyOn(require('ethers'), 'Contract')
      .mockImplementationOnce(() => mockFactoryContract)  // Factory
      .mockImplementationOnce(() => mockRegistryContract) // Registry
      .mockImplementationOnce(() => mockTokenContract);   // Token

    mockExecutableOrder = {
      orderHash: '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4',
      order: {
        maker: '0x1234567890123456789012345678901234567890',
        sourceAmount: ethers.parseEther('0.2'),
        destinationChainId: 40002,
        resolverFeeAmount: ethers.parseEther('0.02'),
        expiryTime: Math.floor(Date.now() / 1000) + 3600
      },
      profitability: {
        estimatedProfit: ethers.parseEther('0.015'),
        gasEstimate: BigInt('650000'),
        safetyDeposit: ethers.parseEther('0.01'),
        isProfitable: true
      },
      priority: 8
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(executor.initialize()).resolves.not.toThrow();
      
      const status = executor.getStatus();
      expect((status as any).isInitialized).toBe(true);
      expect((status as any).walletAddress).toBe(config.wallet.ethereum.address);
    });

    it('should initialize contracts with correct addresses', async () => {
      await executor.initialize();

      expect(require('ethers').Contract).toHaveBeenCalledWith(
        config.ethereum.contracts.factory,
        expect.any(Array),
        expect.any(Object)
      );

      expect(mockFactoryContract.registry).toHaveBeenCalled();
    });
  });

  describe('atomic swap execution', () => {
    beforeEach(async () => {
      await executor.initialize();

      // Set up successful mocks
      mockFactoryContract.sourceEscrows.mockResolvedValue(ethers.ZeroAddress);
      mockFactoryContract.matchFusionOrder.mockResolvedValue({
        hash: '0x8eea5557477e7ddf34c47380c01dbae3262639c7d35fc3b94dcb37cfc7101421',
        wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('500000') })
      });
      mockFactoryContract.completeFusionOrder.mockResolvedValue({
        hash: '0x89ad2ece9ee5dd8e2de1c949a72ecbd9087139a5411d79ec1f9eb75cb0b5a018',
        wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('100000') })
      });
      mockTokenContract.transfer.mockResolvedValue({
        hash: '0x2acb4a06f215004f797769582264970310ff4d77bb11dd7b2f2971ad2d911bc3',
        wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('50000') })
      });
    });

    it('should execute complete atomic swap successfully', async () => {
      mockFactoryContract.sourceEscrows
        .mockResolvedValueOnce(ethers.ZeroAddress) // Not matched initially
        .mockResolvedValue('0x1030e56f8b6D003E74D41bc70fD3a1BF7AB96006'); // Matched after

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(result.success).toBe(true);
      expect(result.orderHash).toBe(mockExecutableOrder.orderHash);
      expect(result.transactions.ethereum).toHaveLength(3); // match, complete, settlement
      expect(result.transactions.near).toHaveLength(3); // mock NEAR transactions
      expect(result.actualProfit).toBeGreaterThan(0n);
    });

    it('should handle already matched orders', async () => {
      mockFactoryContract.sourceEscrows.mockResolvedValue('0x1030e56f8b6D003E74D41bc70fD3a1BF7AB96006');

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(result.success).toBe(true);
      expect(mockFactoryContract.matchFusionOrder).not.toHaveBeenCalled();
    });

    it('should fail if Ethereum matching fails', async () => {
      mockFactoryContract.matchFusionOrder.mockRejectedValue(new Error('Insufficient funds'));

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to match Ethereum order');
    });

    it('should fail if NEAR execution fails', async () => {
      mockFactoryContract.sourceEscrows.mockResolvedValue('0x1030e56f8b6D003E74D41bc70fD3a1BF7AB96006');
      
      // Mock NEAR execution failure by making the executor throw
      jest.spyOn(executor as any, 'executeNearSide').mockResolvedValue({
        success: false,
        transactions: [],
        secret: '',
        error: 'NEAR execution failed'
      });

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to execute destination chain');
    });

    it('should fail if Ethereum completion fails', async () => {
      mockFactoryContract.sourceEscrows.mockResolvedValue('0x1030e56f8b6D003E74D41bc70fD3a1BF7AB96006');
      mockFactoryContract.completeFusionOrder.mockRejectedValue(new Error('Invalid secret'));

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to complete Ethereum order');
    });

    it('should fail if token settlement fails', async () => {
      mockFactoryContract.sourceEscrows.mockResolvedValue('0x1030e56f8b6D003E74D41bc70fD3a1BF7AB96006');
      mockTokenContract.transfer.mockRejectedValue(new Error('Transfer failed'));

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to settle tokens');
    });
  });

  describe('Ethereum order matching', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    it('should match order with correct safety deposit', async () => {
      mockFactoryContract.sourceEscrows.mockResolvedValue(ethers.ZeroAddress);
      const mockTx = {
        hash: '0x8eea5557477e7ddf34c47380c01dbae3262639c7d35fc3b94dcb37cfc7101421',
        wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('500000') })
      };
      mockFactoryContract.matchFusionOrder.mockResolvedValue(mockTx);

      const result = await (executor as any).matchEthereumOrder(
        mockExecutableOrder.orderHash,
        mockExecutableOrder.order
      );

      expect(result.success).toBe(true);
      expect(mockRegistryContract.calculateMinSafetyDeposit).toHaveBeenCalledWith(
        mockExecutableOrder.order.destinationChainId,
        mockExecutableOrder.order.sourceAmount
      );
      expect(mockFactoryContract.matchFusionOrder).toHaveBeenCalledWith(
        mockExecutableOrder.orderHash,
        { value: ethers.parseEther('0.01') }
      );
    });

    it('should fail if insufficient ETH balance', async () => {
      mockFactoryContract.sourceEscrows.mockResolvedValue(ethers.ZeroAddress);
      
      // Mock insufficient balance
      const mockProvider = walletManager.getEthereumProvider();
      (mockProvider.getBalance as jest.Mock).mockResolvedValue(ethers.parseEther('0.005'));

      const result = await (executor as any).matchEthereumOrder(
        mockExecutableOrder.orderHash,
        mockExecutableOrder.order
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient ETH balance');
    });

    it('should skip matching if already matched', async () => {
      mockFactoryContract.sourceEscrows.mockResolvedValue('0x1030e56f8b6D003E74D41bc70fD3a1BF7AB96006');

      const result = await (executor as any).matchEthereumOrder(
        mockExecutableOrder.orderHash,
        mockExecutableOrder.order
      );

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(0);
      expect(mockFactoryContract.matchFusionOrder).not.toHaveBeenCalled();
    });
  });

  describe('NEAR execution', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    it('should generate deterministic secret', async () => {
      const result = await (executor as any).executeNearSide(
        mockExecutableOrder.orderHash,
        mockExecutableOrder.order
      );

      expect(result.success).toBe(true);
      expect(result.secret).toBeDefined();
      expect(result.secret).toHaveLength(64); // 32 bytes in hex
      expect(result.transactions).toHaveLength(3); // Mock NEAR transactions
    });

    it('should return consistent secret for same order', async () => {
      const result1 = await (executor as any).executeNearSide(
        mockExecutableOrder.orderHash,
        mockExecutableOrder.order
      );
      
      const result2 = await (executor as any).executeNearSide(
        mockExecutableOrder.orderHash,
        mockExecutableOrder.order
      );

      expect(result1.secret).toBe(result2.secret);
    });
  });

  describe('Ethereum order completion', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    it('should complete order with revealed secret', async () => {
      const secret = 'a9aab023149fea18759fd15443bd11bfca388dfe7f0813e372a75ce8a37dd7bc';
      const mockTx = {
        hash: '0x89ad2ece9ee5dd8e2de1c949a72ecbd9087139a5411d79ec1f9eb75cb0b5a018',
        wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('100000') })
      };
      mockFactoryContract.completeFusionOrder.mockResolvedValue(mockTx);

      const result = await (executor as any).completeEthereumOrder(
        mockExecutableOrder.orderHash,
        secret
      );

      expect(result.success).toBe(true);
      expect(mockFactoryContract.completeFusionOrder).toHaveBeenCalledWith(
        mockExecutableOrder.orderHash,
        '0x' + secret
      );
    });

    it('should handle completion errors', async () => {
      const secret = 'invalid_secret';
      mockFactoryContract.completeFusionOrder.mockRejectedValue(new Error('Invalid preimage'));

      const result = await (executor as any).completeEthereumOrder(
        mockExecutableOrder.orderHash,
        secret
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid preimage');
    });
  });

  describe('token settlement', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    it('should settle tokens to source escrow', async () => {
      const escrowAddress = '0x1030e56f8b6D003E74D41bc70fD3a1BF7AB96006';
      mockFactoryContract.sourceEscrows.mockResolvedValue(escrowAddress);
      
      const mockTx = {
        hash: '0x2acb4a06f215004f797769582264970310ff4d77bb11dd7b2f2971ad2d911bc3',
        wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('50000') })
      };
      mockTokenContract.transfer.mockResolvedValue(mockTx);

      const result = await (executor as any).settleTokens(
        mockExecutableOrder.orderHash,
        mockExecutableOrder.order
      );

      expect(result.success).toBe(true);
      expect(mockTokenContract.transfer).toHaveBeenCalledWith(
        escrowAddress,
        mockExecutableOrder.order.sourceAmount
      );
    });

    it('should fail if no source escrow exists', async () => {
      mockFactoryContract.sourceEscrows.mockResolvedValue(ethers.ZeroAddress);

      const result = await (executor as any).settleTokens(
        mockExecutableOrder.orderHash,
        mockExecutableOrder.order
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Source escrow not found');
    });
  });

  describe('profit calculation', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    it('should calculate actual profit correctly', async () => {
      const gasUsed = BigInt('650000');
      const profit = await (executor as any).calculateActualProfit(mockExecutableOrder.order, gasUsed);

      // Profit = resolver fee - gas cost
      const expectedGasCost = gasUsed * BigInt('20000000000'); // 20 gwei from mock
      const expectedProfit = mockExecutableOrder.order.resolverFeeAmount - expectedGasCost;

      expect(profit).toBe(expectedProfit);
    });

    it('should return zero for negative profit', async () => {
      const highGasUsed = BigInt('5000000'); // Very high gas usage
      const profit = await (executor as any).calculateActualProfit(mockExecutableOrder.order, highGasUsed);

      expect(profit).toBe(0n);
    });
  });

  describe('event emission', () => {
    beforeEach(async () => {
      // Clear all mocks to avoid interference from other tests
      jest.clearAllMocks();
      
      await executor.initialize();

      // Set up successful mocks (copied from atomic swap execution)
      mockFactoryContract.sourceEscrows.mockResolvedValue(ethers.ZeroAddress);
      mockFactoryContract.matchFusionOrder.mockResolvedValue({
        hash: '0x8eea5557477e7ddf34c47380c01dbae3262639c7d35fc3b94dcb37cfc7101421',
        wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('500000') })
      });
      mockFactoryContract.completeFusionOrder.mockResolvedValue({
        hash: '0x89ad2ece9ee5dd8e2de1c949a72ecbd9087139a5411d79ec1f9eb75cb0b5a018',
        wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('100000') })
      });
      mockTokenContract.transfer.mockResolvedValue({
        hash: '0x2acb4a06f215004f797769582264970310ff4d77bb11dd7b2f2971ad2d911bc3',
        wait: jest.fn().mockResolvedValue({ gasUsed: BigInt('50000') })
      });
    });

    it('should emit executionComplete event on success', async () => {
      // Force a simple success path by having order already matched
      mockFactoryContract.sourceEscrows.mockResolvedValue('0x1030e56f8b6D003E74D41bc70fD3a1BF7AB96006');

      let eventEmitted = false;
      let emittedResult: any = null;

      executor.on('executionComplete', (result) => {
        eventEmitted = true;
        emittedResult = result;
      });

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(result.success).toBe(true); // First check if execution was successful
      expect(eventEmitted).toBe(true);
      expect(emittedResult).toBeDefined();
      expect(emittedResult.success).toBe(true);
    });

    it('should emit executionFailed event on failure', async () => {
      mockFactoryContract.matchFusionOrder.mockRejectedValue(new Error('Execution failed'));

      let eventEmitted = false;
      let emittedResult: any = null;

      executor.on('executionFailed', (result) => {
        eventEmitted = true;
        emittedResult = result;
      });

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(eventEmitted).toBe(true);
      expect(emittedResult).toBeDefined();
      expect(emittedResult.success).toBe(false);
    });
  });

  describe('status reporting', () => {
    it('should provide status information', () => {
      const status = executor.getStatus();

      expect(status).toBeDefined();
      expect((status as any).walletAddress).toBe(config.wallet.ethereum.address);
      expect((status as any).factoryContract).toBe(config.ethereum.contracts.factory);
      expect((status as any).isInitialized).toBe(false);
    });

    it('should update status after initialization', async () => {
      await executor.initialize();
      
      const status = executor.getStatus();
      expect((status as any).isInitialized).toBe(true);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    it('should handle unexpected errors gracefully', async () => {
      // Simulate unexpected error
      jest.spyOn(executor as any, 'matchEthereumOrder').mockRejectedValue(new Error('Unexpected error'));

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should track execution time even on failure', async () => {
      mockFactoryContract.matchFusionOrder.mockRejectedValue(new Error('Test error'));

      const result = await executor.executeAtomicSwap(mockExecutableOrder);

      expect(result.success).toBe(false);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });
});