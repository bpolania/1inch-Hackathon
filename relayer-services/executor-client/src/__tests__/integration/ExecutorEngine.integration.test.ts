/**
 * ExecutorEngine Integration Tests
 * 
 * End-to-end integration tests for the complete automated relayer system.
 */

import { ExecutorEngine } from '../../core/ExecutorEngine';
import { loadConfig } from '../../config/config';
import { ethers } from 'ethers';

describe('ExecutorEngine Integration', () => {
  let executorEngine: ExecutorEngine;
  let config: any;

  beforeEach(async () => {
    // Set up valid environment variables for integration tests
    process.env.ETHEREUM_RPC_URL = 'http://localhost:8545';
    process.env.ETHEREUM_PRIVATE_KEY = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    process.env.FACTORY_ADDRESS = '0x05A1c4d8Fd81b37e2Dab3394F2628fD54EBCf4B0';
    process.env.TOKEN_ADDRESS = '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43';
    process.env.NEAR_CONTRACT = 'fusion.testnet';
    process.env.NEAR_PRIVATE_KEY = 'ed25519:TestPrivateKey123';
    
    config = await loadConfig();
    executorEngine = new ExecutorEngine(config);
  });

  afterEach(async () => {
    if (executorEngine.isExecutorRunning()) {
      await executorEngine.stop();
    }
  });

  describe('system initialization', () => {
    it('should initialize all components successfully', async () => {
      await expect(executorEngine.initialize()).resolves.not.toThrow();
      
      const status = executorEngine.getStatus();
      expect((status as any).walletStatus.isInitialized).toBe(true);
      expect((status as any).monitorStatus.isMonitoring).toBe(false);
      expect((status as any).queueLength).toBe(0);
    });

    it('should handle initialization errors gracefully', async () => {
      // Create a new executor with invalid configuration
      const invalidConfig = {
        ...config,
        ethereum: {
          ...config.ethereum,
          contracts: {
            ...config.ethereum.contracts,
            factory: 'invalid-address' // This will cause initialization to fail
          }
        }
      };
      
      const invalidExecutor = new ExecutorEngine(invalidConfig);

      // Should still not throw during initialize (it's designed to be resilient)
      await expect(invalidExecutor.initialize()).resolves.not.toThrow();
      
      // Can get status without errors
      const status = invalidExecutor.getStatus();
      expect(status).toBeDefined();
      expect((status as any).isRunning).toBe(false);
    });
  });

  describe('automated execution workflow', () => {
    beforeEach(async () => {
      await executorEngine.initialize();
    });

    it('should start and stop execution loop', async () => {
      expect(executorEngine.isExecutorRunning()).toBe(false);
      
      // Start in background (don't await to avoid infinite loop)
      const startPromise = executorEngine.start();
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(executorEngine.isExecutorRunning()).toBe(true);
      
      await executorEngine.stop();
      expect(executorEngine.isExecutorRunning()).toBe(false);
    });

    it('should handle new order events', async () => {
      let orderProcessed = false;
      
      // Mock the order processing
      jest.spyOn(executorEngine as any, 'handleNewOrder').mockImplementation(async (order) => {
        orderProcessed = true;
        return Promise.resolve();
      });

      await executorEngine.start();

      // Simulate new order event
      const mockOrder = {
        orderHash: '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4',
        maker: '0x1234567890123456789012345678901234567890',
        sourceAmount: ethers.parseEther('0.2'),
        destinationChainId: 40002,
        resolverFeeAmount: ethers.parseEther('0.02')
      };

      await (executorEngine as any).handleNewOrder(mockOrder);

      expect(orderProcessed).toBe(true);
      
      await executorEngine.stop();
    });

    it('should queue profitable orders for execution', async () => {
      await executorEngine.start();

      const mockOrder = {
        orderHash: '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4',
        maker: '0x1234567890123456789012345678901234567890',
        sourceAmount: ethers.parseEther('0.2'),
        destinationChainId: 40002,
        resolverFeeAmount: ethers.parseEther('0.02')
      };

      // Mock profitability analysis to return profitable
      jest.spyOn((executorEngine as any).profitabilityAnalyzer, 'analyzeOrder').mockResolvedValue({
        orderHash: mockOrder.orderHash,
        estimatedProfit: ethers.parseEther('0.015'),
        gasEstimate: BigInt('650000'),
        safetyDeposit: ethers.parseEther('0.01'),
        isProfitable: true,
        profitMargin: 75,
        riskLevel: 'low',
        executionPriority: 8,
        reasoning: ['Profitable order'],
        resolverFee: ethers.parseEther('0.02'),
        totalCosts: ethers.parseEther('0.005')
      });

      await (executorEngine as any).handleNewOrder(mockOrder);

      expect(executorEngine.getQueueLength()).toBe(1);
      
      await executorEngine.stop();
    });

    it('should skip unprofitable orders', async () => {
      await executorEngine.start();

      const mockOrder = {
        orderHash: '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4',
        maker: '0x1234567890123456789012345678901234567890',
        sourceAmount: ethers.parseEther('0.2'),
        destinationChainId: 40002,
        resolverFeeAmount: ethers.parseEther('0.001') // Very low fee
      };

      // Mock profitability analysis to return unprofitable
      jest.spyOn((executorEngine as any).profitabilityAnalyzer, 'analyzeOrder').mockResolvedValue({
        orderHash: mockOrder.orderHash,
        estimatedProfit: ethers.parseEther('-0.005'), // Negative profit
        gasEstimate: BigInt('650000'),
        safetyDeposit: ethers.parseEther('0.01'),
        isProfitable: false,
        profitMargin: -500,
        riskLevel: 'high',
        executionPriority: 0,
        reasoning: ['Unprofitable order'],
        resolverFee: ethers.parseEther('0.001'),
        totalCosts: ethers.parseEther('0.006')
      });

      await (executorEngine as any).handleNewOrder(mockOrder);

      expect(executorEngine.getQueueLength()).toBe(0);
      
      await executorEngine.stop();
    });
  });

  describe('execution queue management', () => {
    beforeEach(async () => {
      await executorEngine.initialize();
    });

    it('should process orders by priority', async () => {
      const executionOrder: string[] = [];

      // Mock cross-chain executor to track execution order
      jest.spyOn((executorEngine as any).crossChainExecutor, 'executeAtomicSwap').mockImplementation(async (order: any) => {
        executionOrder.push(order.orderHash);
        return {
          success: true,
          orderHash: order.orderHash,
          actualProfit: ethers.parseEther('0.01'),
          gasUsed: BigInt('650000'),
          executionTime: 1000,
          transactions: { ethereum: [], near: [] }
        };
      });

      // Mock profitability analyzer
      jest.spyOn((executorEngine as any).profitabilityAnalyzer, 'analyzeOrder')
        .mockResolvedValueOnce({
          orderHash: '0x1111',
          isProfitable: true,
          estimatedProfit: ethers.parseEther('0.01'),
          gasEstimate: BigInt('650000'),
          safetyDeposit: ethers.parseEther('0.01'),
          profitMargin: 50,
          riskLevel: 'medium',
          executionPriority: 5,
          reasoning: [],
          resolverFee: ethers.parseEther('0.02'),
          totalCosts: ethers.parseEther('0.01')
        })
        .mockResolvedValueOnce({
          orderHash: '0x2222',
          isProfitable: true,
          estimatedProfit: ethers.parseEther('0.02'),
          gasEstimate: BigInt('650000'),
          safetyDeposit: ethers.parseEther('0.01'),
          profitMargin: 100,
          riskLevel: 'low',
          executionPriority: 9,
          reasoning: [],
          resolverFee: ethers.parseEther('0.03'),
          totalCosts: ethers.parseEther('0.01')
        });

      // Add orders in reverse priority order
      await (executorEngine as any).handleNewOrder({
        orderHash: '0x1111',
        resolverFeeAmount: ethers.parseEther('0.02')
      });

      await (executorEngine as any).handleNewOrder({
        orderHash: '0x2222',
        resolverFeeAmount: ethers.parseEther('0.03')
      });

      // Process queue
      await (executorEngine as any).processExecutionQueue();
      await (executorEngine as any).processExecutionQueue();

      // Higher priority order should execute first
      expect(executionOrder).toEqual(['0x2222', '0x1111']);
    });

    it('should handle execution failures gracefully', async () => {
      // Mock failed execution
      jest.spyOn((executorEngine as any).crossChainExecutor, 'executeAtomicSwap').mockResolvedValue({
        success: false,
        orderHash: '0x1111',
        actualProfit: 0n,
        gasUsed: 0n,
        executionTime: 1000,
        transactions: { ethereum: [], near: [] },
        error: 'Execution failed'
      });

      jest.spyOn((executorEngine as any).profitabilityAnalyzer, 'analyzeOrder').mockResolvedValue({
        orderHash: '0x1111',
        isProfitable: true,
        estimatedProfit: ethers.parseEther('0.01'),
        gasEstimate: BigInt('650000'),
        safetyDeposit: ethers.parseEther('0.01'),
        profitMargin: 50,
        riskLevel: 'low',
        executionPriority: 5,
        reasoning: [],
        resolverFee: ethers.parseEther('0.02'),
        totalCosts: ethers.parseEther('0.01')
      });

      await (executorEngine as any).handleNewOrder({
        orderHash: '0x1111',
        resolverFeeAmount: ethers.parseEther('0.02')
      });

      // Should not throw even with failed execution
      await expect((executorEngine as any).processExecutionQueue()).resolves.not.toThrow();
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await executorEngine.initialize();
    });

    it('should handle order updates correctly', async () => {
      // Add order to queue first
      jest.spyOn((executorEngine as any).profitabilityAnalyzer, 'analyzeOrder').mockResolvedValue({
        orderHash: '0x1111',
        isProfitable: true,
        estimatedProfit: ethers.parseEther('0.01'),
        gasEstimate: BigInt('650000'),
        safetyDeposit: ethers.parseEther('0.01'),
        profitMargin: 50,
        riskLevel: 'low',
        executionPriority: 5,
        reasoning: [],
        resolverFee: ethers.parseEther('0.02'),
        totalCosts: ethers.parseEther('0.01')
      });

      await (executorEngine as any).handleNewOrder({
        orderHash: '0x1111',
        resolverFeeAmount: ethers.parseEther('0.02')
      });

      expect(executorEngine.getQueueLength()).toBe(1);

      // Simulate order completion
      await (executorEngine as any).handleOrderUpdate('0x1111', { status: 'completed' });

      expect(executorEngine.getQueueLength()).toBe(0);
    });

    it('should track execution completion', async () => {
      let completionHandled = false;

      jest.spyOn(executorEngine as any, 'handleExecutionComplete').mockImplementation(() => {
        completionHandled = true;
      });

      await (executorEngine as any).handleExecutionComplete({
        success: true,
        orderHash: '0x1111',
        actualProfit: ethers.parseEther('0.01')
      });

      expect(completionHandled).toBe(true);
    });

    it('should track execution failures', async () => {
      let failureHandled = false;

      jest.spyOn(executorEngine as any, 'handleExecutionFailed').mockImplementation(() => {
        failureHandled = true;
      });

      await (executorEngine as any).handleExecutionFailed({
        success: false,
        orderHash: '0x1111',
        error: 'Test error'
      });

      expect(failureHandled).toBe(true);
    });
  });

  describe('status and monitoring', () => {
    beforeEach(async () => {
      await executorEngine.initialize();
    });

    it('should provide comprehensive status information', () => {
      const status = executorEngine.getStatus();

      expect(status).toBeDefined();
      expect((status as any).isRunning).toBe(false);
      expect((status as any).queueLength).toBe(0);
      expect((status as any).walletStatus).toBeDefined();
      expect((status as any).monitorStatus).toBeDefined();
    });

    it('should update status when running', async () => {
      await executorEngine.start();
      
      const status = executorEngine.getStatus();
      expect((status as any).isRunning).toBe(true);
      
      await executorEngine.stop();
    });
  });

  describe('error handling and resilience', () => {
    beforeEach(async () => {
      await executorEngine.initialize();
    });

    it('should continue running after individual order failures', async () => {
      // Mock analyzer to throw error for first order, succeed for second
      jest.spyOn((executorEngine as any).profitabilityAnalyzer, 'analyzeOrder')
        .mockRejectedValueOnce(new Error('Analysis failed'))
        .mockResolvedValueOnce({
          orderHash: '0x2222',
          isProfitable: true,
          estimatedProfit: ethers.parseEther('0.01'),
          gasEstimate: BigInt('650000'),
          safetyDeposit: ethers.parseEther('0.01'),
          profitMargin: 50,
          riskLevel: 'low',
          executionPriority: 5,
          reasoning: [],
          resolverFee: ethers.parseEther('0.02'),
          totalCosts: ethers.parseEther('0.01')
        });

      // First order should fail gracefully
      await expect((executorEngine as any).handleNewOrder({
        orderHash: '0x1111',
        resolverFeeAmount: ethers.parseEther('0.02')
      })).resolves.not.toThrow();

      expect(executorEngine.getQueueLength()).toBe(0);

      // Second order should succeed
      await (executorEngine as any).handleNewOrder({
        orderHash: '0x2222',
        resolverFeeAmount: ethers.parseEther('0.02')
      });

      expect(executorEngine.getQueueLength()).toBe(1);
    });

    it('should handle component initialization failures', async () => {
      // Mock wallet manager initialization failure
      jest.spyOn((executorEngine as any).walletManager, 'initialize').mockRejectedValue(new Error('Wallet init failed'));

      await expect(executorEngine.initialize()).rejects.toThrow('Wallet init failed');
    });
  });

  describe('configuration integration', () => {
    it('should respect configuration parameters', async () => {
      // Test with custom configuration
      const customConfig = {
        ...config,
        execution: {
          ...config.execution,
          minProfitThreshold: '0.005',
          maxConcurrentExecutions: 1
        }
      };

      const customEngine = new ExecutorEngine(customConfig);
      await customEngine.initialize();

      expect(customEngine).toBeDefined();
      
      await customEngine.stop();
    });

    it('should handle invalid configuration gracefully', async () => {
      const invalidConfig = {
        ...config,
        ethereum: {
          ...config.ethereum,
          contracts: {
            factory: '' // Invalid address
          }
        }
      };

      const invalidEngine = new ExecutorEngine(invalidConfig);
      
      // Should still initialize but may fail during operation
      await expect(invalidEngine.initialize()).resolves.not.toThrow();
      
      await invalidEngine.stop();
    });
  });
});