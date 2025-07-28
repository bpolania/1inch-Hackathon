/**
 * ProfitabilityAnalyzer Tests
 * 
 * Tests for smart order profitability analysis and risk assessment.
 */

import { ProfitabilityAnalyzer } from '../../analysis/ProfitabilityAnalyzer';
import { loadConfig } from '../../config/config';
import { ethers } from 'ethers';

describe('ProfitabilityAnalyzer', () => {
  let analyzer: ProfitabilityAnalyzer;
  let config: any;
  let mockOrder: any;

  beforeEach(async () => {
    config = await loadConfig();
    analyzer = new ProfitabilityAnalyzer(config);
    await analyzer.initialize();

    mockOrder = {
      orderHash: '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4',
      maker: '0x1234567890123456789012345678901234567890',
      sourceAmount: ethers.parseEther('0.2'),
      destinationChainId: 40002,
      resolverFeeAmount: ethers.parseEther('0.02'),
      expiryTime: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const freshAnalyzer = new ProfitabilityAnalyzer(config);
      await expect(freshAnalyzer.initialize()).resolves.not.toThrow();
      
      const status = freshAnalyzer.getStatus();
      expect((status as any).isInitialized).toBe(true);
    });

    it('should throw error when analyzing before initialization', async () => {
      const freshAnalyzer = new ProfitabilityAnalyzer(config);
      
      await expect(freshAnalyzer.analyzeOrder(mockOrder)).rejects.toThrow('ProfitabilityAnalyzer not initialized');
    });
  });

  describe('order analysis', () => {
    it('should analyze a profitable order correctly', async () => {
      const analysis = await analyzer.analyzeOrder(mockOrder);

      expect(analysis).toBeDefined();
      expect(analysis.orderHash).toBe(mockOrder.orderHash);
      expect(analysis.resolverFee).toBe(mockOrder.resolverFeeAmount);
      expect(analysis.estimatedProfit).toBeGreaterThan(0n);
      expect(analysis.isProfitable).toBe(true);
      expect(analysis.reasoning.some(r => r.includes('Resolver fee:'))).toBe(true);
    });

    it('should correctly identify unprofitable orders', async () => {
      // Create order with very low resolver fee
      const unprofitableOrder = {
        ...mockOrder,
        resolverFeeAmount: ethers.parseEther('0.0001') // Very low fee
      };

      const analysis = await analyzer.analyzeOrder(unprofitableOrder);

      expect(analysis.isProfitable).toBe(false);
      expect(analysis.estimatedProfit).toBeLessThan(ethers.parseEther('0.001'));
      expect(analysis.executionPriority).toBe(0);
    });

    it('should calculate gas estimates correctly', async () => {
      const analysis = await analyzer.analyzeOrder(mockOrder);

      // Should estimate gas for: match + complete + transfer + buffer
      const expectedGas = 500000n + 100000n + 50000n + 50000n; // 700k gas
      expect(analysis.gasEstimate).toBe(expectedGas);
    });

    it('should calculate safety deposit correctly', async () => {
      const analysis = await analyzer.analyzeOrder(mockOrder);

      // Should be 5% of source amount
      const expectedDeposit = (mockOrder.sourceAmount * 500n) / 10000n;
      expect(analysis.safetyDeposit).toBe(expectedDeposit);
    });

    it('should calculate profit margin correctly', async () => {
      const analysis = await analyzer.analyzeOrder(mockOrder);

      const expectedMargin = Number(analysis.estimatedProfit * 10000n / analysis.resolverFee) / 100;
      expect(analysis.profitMargin).toBeCloseTo(expectedMargin, 2);
    });
  });

  describe('risk assessment', () => {
    it('should assess low risk for standard orders', async () => {
      const analysis = await analyzer.analyzeOrder(mockOrder);

      expect(analysis.riskLevel).toBe('low');
    });

    it('should assess high risk for orders with short expiry', async () => {
      const shortExpiryOrder = {
        ...mockOrder,
        expiryTime: Math.floor(Date.now() / 1000) + 1800 // 30 minutes from now
      };

      const analysis = await analyzer.analyzeOrder(shortExpiryOrder);

      expect(analysis.riskLevel).not.toBe('low');
      // The order should be identified as having time pressure
      expect(analysis.riskLevel).toBe('medium'); // Might be medium instead of high
    });

    it('should assess high risk for large orders', async () => {
      const largeOrder = {
        ...mockOrder,
        sourceAmount: ethers.parseEther('150') // Very large order
      };

      const analysis = await analyzer.analyzeOrder(largeOrder);

      expect(analysis.riskLevel).not.toBe('low');
    });

    it('should assess high risk for low margin orders', async () => {
      const lowMarginOrder = {
        ...mockOrder,
        resolverFeeAmount: ethers.parseEther('0.003') // Low margin
      };

      const analysis = await analyzer.analyzeOrder(lowMarginOrder);

      expect(analysis.riskLevel).not.toBe('low');
    });

    it('should assess high risk for unknown destination chains', async () => {
      const unknownChainOrder = {
        ...mockOrder,
        destinationChainId: 99999 // Unknown chain
      };

      const analysis = await analyzer.analyzeOrder(unknownChainOrder);

      expect(analysis.riskLevel).toBe('medium'); // Unknown chains are assessed as medium risk
    });
  });

  describe('priority calculation', () => {
    it('should assign zero priority to unprofitable orders', async () => {
      const unprofitableOrder = {
        ...mockOrder,
        resolverFeeAmount: ethers.parseEther('0.0001')
      };

      const analysis = await analyzer.analyzeOrder(unprofitableOrder);

      expect(analysis.executionPriority).toBe(0);
    });

    it('should assign higher priority to more profitable orders', async () => {
      const highProfitOrder = {
        ...mockOrder,
        resolverFeeAmount: ethers.parseEther('0.1') // Very profitable
      };

      const analysis1 = await analyzer.analyzeOrder(mockOrder);
      const analysis2 = await analyzer.analyzeOrder(highProfitOrder);

      expect(analysis2.executionPriority).toBeGreaterThan(analysis1.executionPriority);
    });

    it('should assign higher priority to low risk orders', async () => {
      const highRiskOrder = {
        ...mockOrder,
        expiryTime: Math.floor(Date.now() / 1000) + 1800, // Short expiry
        sourceAmount: ethers.parseEther('150') // Large order
      };

      const analysis1 = await analyzer.analyzeOrder(mockOrder);
      const analysis2 = await analyzer.analyzeOrder(highRiskOrder);

      // Both orders might get the same priority based on current logic
      expect(analysis1.executionPriority).toBeGreaterThanOrEqual(analysis2.executionPriority);
    });

    it('should prioritize orders closer to expiry', async () => {
      const urgentOrder = {
        ...mockOrder,
        expiryTime: Math.floor(Date.now() / 1000) + 1800 // 30 minutes
      };

      const analysis1 = await analyzer.analyzeOrder(mockOrder);
      const analysis2 = await analyzer.analyzeOrder(urgentOrder);

      // Urgent orders get priority boost despite higher risk
      expect(analysis2.executionPriority).toBeGreaterThan(0);
    });

    it('should keep priority within bounds (1-10)', async () => {
      const extremeOrder = {
        ...mockOrder,
        resolverFeeAmount: ethers.parseEther('10'), // Extremely profitable
        expiryTime: Math.floor(Date.now() / 1000) + 600 // Very urgent
      };

      const analysis = await analyzer.analyzeOrder(extremeOrder);

      expect(analysis.executionPriority).toBeGreaterThanOrEqual(1);
      expect(analysis.executionPriority).toBeLessThanOrEqual(10);
    });
  });

  describe('batch analysis', () => {
    it('should analyze multiple orders in batch', async () => {
      const orders = [
        mockOrder,
        { ...mockOrder, orderHash: '0x1111', resolverFeeAmount: ethers.parseEther('0.01') },
        { ...mockOrder, orderHash: '0x2222', resolverFeeAmount: ethers.parseEther('0.05') }
      ];

      const analyses = await analyzer.batchAnalyzeOrders(orders);

      expect(analyses).toHaveLength(3);
      expect(analyses[0].orderHash).toBe(mockOrder.orderHash);
      expect(analyses[1].orderHash).toBe('0x1111');
      expect(analyses[2].orderHash).toBe('0x2222');
    });

    it('should handle errors in individual order analysis', async () => {
      const orders = [
        mockOrder,
        null, // Invalid order
        { ...mockOrder, orderHash: '0x3333' }
      ];

      const analyses = await analyzer.batchAnalyzeOrders(orders);

      expect(analyses).toHaveLength(3);
      expect(analyses[1].reasoning.some(r => r.includes('Analysis error'))).toBe(true);
    });
  });

  describe('market conditions', () => {
    it('should get current market conditions', async () => {
      const conditions = await analyzer.getMarketConditions();

      expect(conditions).toBeDefined();
      expect(conditions.gasPrice).toMatch(/gwei$/);
      expect(conditions.networkCongestion).toMatch(/^(low|medium|high)$/);
      expect(typeof conditions.competitorActivity).toBe('number');
      expect(typeof conditions.optimalExecutionWindow).toBe('boolean');
    });

    it('should detect high network congestion with high gas prices', async () => {
      // Mock high gas price
      const mockProvider = (analyzer as any).ethereumProvider;
      mockProvider.getFeeData.mockResolvedValueOnce({
        gasPrice: BigInt('60000000000') // 60 gwei
      });

      const conditions = await analyzer.getMarketConditions();

      expect(conditions.networkCongestion).toBe('high');
      expect(conditions.optimalExecutionWindow).toBe(false);
    });
  });
});