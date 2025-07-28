/**
 * OrderMonitor Tests
 * 
 * Tests for automated order detection and monitoring functionality.
 */

import { OrderMonitor } from '../../monitoring/OrderMonitor';
import { WalletManager } from '../../wallet/WalletManager';
import { loadConfig } from '../../config/config';
import { EventEmitter } from 'events';

describe('OrderMonitor', () => {
  let orderMonitor: OrderMonitor;
  let walletManager: WalletManager;
  let config: any;
  let mockContract: any;

  beforeEach(async () => {
    config = await loadConfig();
    walletManager = new WalletManager(config);
    await walletManager.initialize();
    
    orderMonitor = new OrderMonitor(config, walletManager);

    // Set up mock contract
    mockContract = {
      getOrder: jest.fn(),
      totalOrdersCreated: jest.fn().mockResolvedValue(BigInt('5')),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      queryFilter: jest.fn().mockResolvedValue([]),
      filters: {
        FusionOrderCreated: jest.fn().mockReturnValue('mocked-filter')
      }
    };

    // Mock the contract creation in OrderMonitor
    jest.spyOn(require('ethers'), 'Contract').mockImplementation(() => mockContract);
  });

  afterEach(async () => {
    await orderMonitor.stop();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(orderMonitor.initialize()).resolves.not.toThrow();
      
      const status = orderMonitor.getStatus();
      expect((status as any).isMonitoring).toBe(false);
      expect((status as any).contractAddress).toBe(config.ethereum.contracts.factory);
    });

    it('should set up contract with correct parameters', async () => {
      await orderMonitor.initialize();

      expect(require('ethers').Contract).toHaveBeenCalledWith(
        config.ethereum.contracts.factory,
        expect.any(Array), // ABI
        expect.any(Object)  // Provider
      );
    });

    it('should get current block number on initialization', async () => {
      await orderMonitor.initialize();
      
      const status = orderMonitor.getStatus();
      expect((status as any).lastProcessedBlock).toBe(12345); // From mock
    });
  });

  describe('monitoring lifecycle', () => {
    beforeEach(async () => {
      await orderMonitor.initialize();
    });

    it('should start monitoring successfully', async () => {
      await orderMonitor.start();
      
      const status = orderMonitor.getStatus();
      expect((status as any).isMonitoring).toBe(true);
      expect(mockContract.on).toHaveBeenCalledWith('FusionOrderCreated', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('FusionOrderMatched', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('FusionOrderCompleted', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('FusionOrderCancelled', expect.any(Function));
    });

    it('should stop monitoring successfully', async () => {
      await orderMonitor.start();
      await orderMonitor.stop();
      
      const status = orderMonitor.getStatus();
      expect((status as any).isMonitoring).toBe(false);
      expect(mockContract.removeAllListeners).toHaveBeenCalled();
    });

    it('should not start if already monitoring', async () => {
      await orderMonitor.start();
      
      // Second start should be ignored
      await orderMonitor.start();
      
      expect(mockContract.on).toHaveBeenCalledTimes(4); // Only called once
    });

    it('should handle stop when not monitoring', async () => {
      await expect(orderMonitor.stop()).resolves.not.toThrow();
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await orderMonitor.initialize();
      await orderMonitor.start();

      // Mock successful order fetch
      mockContract.getOrder.mockResolvedValue({
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
      });
    });

    it('should emit newOrder event for FusionOrderCreated', async () => {
      const orderHash = '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4';
      const maker = '0x1234567890123456789012345678901234567890';
      const sourceAmount = BigInt('200000000000000000');
      const destinationChainId = BigInt('40002');

      let newOrderEmitted = false;
      let emittedOrder: any = null;

      orderMonitor.on('newOrder', (order) => {
        newOrderEmitted = true;
        emittedOrder = order;
      });

      // Simulate FusionOrderCreated event
      const eventHandler = mockContract.on.mock.calls.find(call => call[0] === 'FusionOrderCreated')[1];
      await eventHandler(orderHash, maker, sourceAmount, destinationChainId, {
        blockNumber: 12346,
        transactionHash: '0xf45e3f29a382dbb79df313a9382923898105915f48b610ab605cb13861c9b029'
      });

      expect(newOrderEmitted).toBe(true);
      expect(emittedOrder).toBeDefined();
      expect(emittedOrder.orderHash).toBe(orderHash);
      expect(emittedOrder.maker).toBe(maker);
      expect(emittedOrder.sourceAmount).toBe(sourceAmount);
    });

    it('should emit orderUpdate event for FusionOrderMatched', async () => {
      const orderHash = '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4';
      const resolver = '0x04e7B48DD6D9f33ffD1A7Be63fF91e6F318492ed';
      const safetyDeposit = BigInt('10000000000000000');

      let orderUpdateEmitted = false;
      let emittedUpdate: any = null;

      orderMonitor.on('orderUpdate', (hash, update) => {
        orderUpdateEmitted = true;
        emittedUpdate = { hash, update };
      });

      // Simulate FusionOrderMatched event
      const eventHandler = mockContract.on.mock.calls.find(call => call[0] === 'FusionOrderMatched')[1];
      await eventHandler(orderHash, resolver, safetyDeposit, {
        blockNumber: 12347,
        transactionHash: '0x8eea5557477e7ddf34c47380c01dbae3262639c7d35fc3b94dcb37cfc7101421'
      });

      expect(orderUpdateEmitted).toBe(true);
      expect(emittedUpdate.hash).toBe(orderHash);
      expect(emittedUpdate.update.status).toBe('matched');
      expect(emittedUpdate.update.resolver).toBe(resolver);
    });

    it('should emit orderUpdate event for FusionOrderCompleted', async () => {
      const orderHash = '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4';
      const secret = '0xa9aab023149fea18759fd15443bd11bfca388dfe7f0813e372a75ce8a37dd7bc';

      let orderUpdateEmitted = false;
      let emittedUpdate: any = null;

      orderMonitor.on('orderUpdate', (hash, update) => {
        orderUpdateEmitted = true;
        emittedUpdate = { hash, update };
      });

      // First add to known orders
      const knownOrders = orderMonitor.getKnownOrders();
      (orderMonitor as any).knownOrders.add(orderHash);

      // Simulate FusionOrderCompleted event
      const eventHandler = mockContract.on.mock.calls.find(call => call[0] === 'FusionOrderCompleted')[1];
      await eventHandler(orderHash, secret, {
        blockNumber: 12348,
        transactionHash: '0x89ad2ece9ee5dd8e2de1c949a72ecbd9087139a5411d79ec1f9eb75cb0b5a018'
      });

      expect(orderUpdateEmitted).toBe(true);
      expect(emittedUpdate.hash).toBe(orderHash);
      expect(emittedUpdate.update.status).toBe('completed');
      expect(emittedUpdate.update.secret).toBe(secret);

      // Should remove from known orders
      expect(orderMonitor.getKnownOrders()).not.toContain(orderHash);
    });

    it('should emit orderUpdate event for FusionOrderCancelled', async () => {
      const orderHash = '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4';
      const reason = 'Expired';

      let orderUpdateEmitted = false;
      let emittedUpdate: any = null;

      orderMonitor.on('orderUpdate', (hash, update) => {
        orderUpdateEmitted = true;
        emittedUpdate = { hash, update };
      });

      // First add to known orders
      (orderMonitor as any).knownOrders.add(orderHash);

      // Simulate FusionOrderCancelled event
      const eventHandler = mockContract.on.mock.calls.find(call => call[0] === 'FusionOrderCancelled')[1];
      await eventHandler(orderHash, reason, {
        blockNumber: 12349,
        transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      expect(orderUpdateEmitted).toBe(true);
      expect(emittedUpdate.hash).toBe(orderHash);
      expect(emittedUpdate.update.status).toBe('cancelled');
      expect(emittedUpdate.update.reason).toBe(reason);

      // Should remove from known orders
      expect(orderMonitor.getKnownOrders()).not.toContain(orderHash);
    });
  });

  describe('missed event recovery', () => {
    beforeEach(async () => {
      await orderMonitor.initialize();
    });

    it('should scan for missed events when new blocks are available', async () => {
      // Mock new block number
      const mockProvider = walletManager.getEthereumProvider();
      (mockProvider.getBlockNumber as jest.Mock).mockResolvedValue(12350);

      // Mock missed events
      const mockEvent = {
        args: [
          '0x3333333333333333333333333333333333333333333333333333333333333333',
          '0x1234567890123456789012345678901234567890',
          BigInt('200000000000000000'),
          BigInt('40002')
        ],
        blockNumber: 12347,
        transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111'
      };
      mockContract.queryFilter.mockResolvedValue([mockEvent]);

      await orderMonitor.start();

      // Trigger missed event scan
      await (orderMonitor as any).scanForMissedEvents();

      expect(mockContract.queryFilter).toHaveBeenCalledWith(
        'mocked-filter',
        12346, // lastProcessedBlock + 1
        12350  // current block
      );

      expect(mockContract.getOrder).toHaveBeenCalledWith(mockEvent.args[0]);
    });

    it('should not scan when no new blocks are available', async () => {
      // Mock same block number
      const mockProvider = walletManager.getEthereumProvider();
      (mockProvider.getBlockNumber as jest.Mock).mockResolvedValue(12345);

      await orderMonitor.start();

      // Trigger missed event scan
      await (orderMonitor as any).scanForMissedEvents();

      expect(mockContract.queryFilter).not.toHaveBeenCalled();
    });

    it('should handle errors in missed event scanning gracefully', async () => {
      const mockProvider = walletManager.getEthereumProvider();
      (mockProvider.getBlockNumber as jest.Mock).mockResolvedValue(12350);
      mockContract.queryFilter.mockRejectedValue(new Error('RPC Error'));

      await orderMonitor.start();

      // Should not throw
      await expect((orderMonitor as any).scanForMissedEvents()).resolves.not.toThrow();
    });
  });

  describe('order tracking', () => {
    beforeEach(async () => {
      await orderMonitor.initialize();
    });

    it('should track known orders', () => {
      const orderHash = '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4';
      
      expect(orderMonitor.getKnownOrders()).toHaveLength(0);
      
      (orderMonitor as any).knownOrders.add(orderHash);
      
      expect(orderMonitor.getKnownOrders()).toContain(orderHash);
      expect(orderMonitor.getKnownOrders()).toHaveLength(1);
    });

    it('should not emit duplicate orders', async () => {
      const orderHash = '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4';
      
      // Mock order fetch
      mockContract.getOrder.mockResolvedValue({
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
      });

      await orderMonitor.start();

      let emissionCount = 0;
      orderMonitor.on('newOrder', () => {
        emissionCount++;
      });

      // Simulate same event twice
      const eventHandler = mockContract.on.mock.calls.find(call => call[0] === 'FusionOrderCreated')[1];
      
      await eventHandler(orderHash, '0x1234567890123456789012345678901234567890', BigInt('200000000000000000'), BigInt('40002'), {
        blockNumber: 12346,
        transactionHash: '0xf45e3f29a382dbb79df313a9382923898105915f48b610ab605cb13861c9b029'
      });

      await eventHandler(orderHash, '0x1234567890123456789012345678901234567890', BigInt('200000000000000000'), BigInt('40002'), {
        blockNumber: 12347,
        transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111'
      });

      expect(emissionCount).toBe(1); // Should only emit once
    });
  });

  describe('status reporting', () => {
    it('should provide monitoring status', async () => {
      await orderMonitor.initialize();
      
      const status = orderMonitor.getStatus();
      
      expect(status).toBeDefined();
      expect((status as any).isMonitoring).toBe(false);
      // Use current block from mock, since it might be changed by previous tests
      expect((status as any).lastProcessedBlock).toBeGreaterThanOrEqual(12345);
      expect((status as any).knownOrdersCount).toBe(0);
      expect((status as any).contractAddress).toBe(config.ethereum.contracts.factory);
    });

    it('should update status when monitoring starts', async () => {
      await orderMonitor.initialize();
      await orderMonitor.start();
      
      const status = orderMonitor.getStatus();
      
      expect((status as any).isMonitoring).toBe(true);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await orderMonitor.initialize();
      await orderMonitor.start();
    });

    it('should handle contract call errors gracefully', async () => {
      mockContract.getOrder.mockRejectedValue(new Error('Contract call failed'));

      const eventHandler = mockContract.on.mock.calls.find(call => call[0] === 'FusionOrderCreated')[1];
      
      // Should not throw
      await expect(eventHandler(
        '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4',
        '0x1234567890123456789012345678901234567890',
        BigInt('200000000000000000'),
        BigInt('40002'),
        { blockNumber: 12346, transactionHash: '0x1111' }
      )).resolves.not.toThrow();
    });

    it('should handle null order data gracefully', async () => {
      mockContract.getOrder.mockResolvedValue(null);

      let newOrderEmitted = false;
      orderMonitor.on('newOrder', () => {
        newOrderEmitted = true;
      });

      const eventHandler = mockContract.on.mock.calls.find(call => call[0] === 'FusionOrderCreated')[1];
      
      await eventHandler(
        '0x2a4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f4',
        '0x1234567890123456789012345678901234567890',
        BigInt('200000000000000000'),
        BigInt('40002'),
        { blockNumber: 12346, transactionHash: '0x1111' }
      );

      expect(newOrderEmitted).toBe(false);
    });
  });
});