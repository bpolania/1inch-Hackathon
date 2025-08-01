import request from 'supertest';
import express from 'express';
import { oneInchRoutes } from '../oneinch';

// Create test app
const app = express();
app.use(express.json());

// Mock services
const mockTeeService = {
  getExecutionStatus: jest.fn()
};

const mockRelayerService = {
  getOrderDetails: jest.fn(),
  getExecutionStatus: jest.fn(),
  getEscrowAddresses: jest.fn(),
  getUserOrders: jest.fn(),
  cancelOrder: jest.fn(),
  getCrossChainTransactions: jest.fn()
};

// Inject mock services
app.use((req: any, res: any, next: any) => {
  req.teeService = mockTeeService;
  req.relayerService = mockRelayerService;
  next();
});

app.use('/api/1inch', oneInchRoutes);

describe('Order Management API Endpoints', () => {
  const validOrderHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const validUserAddress = '0x742d35cc6634c0532925a3b8d4e9dc7d67a1c1e2';
  const invalidOrderHash = '0x123'; // Too short

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/1inch/orders/:orderHash', () => {
    it('should return order details for valid order hash', async () => {
      const mockOrderDetails = {
        maker: validUserAddress,
        sourceToken: '0xA0b86a33E9...',
        sourceAmount: '1000000000000000000',
        destinationChainId: 397,
        destinationToken: 'wrap.testnet',
        destinationAmount: '1000000000000000000000',
        destinationAddress: 'user.testnet',
        expiryTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        resolverFeeAmount: '10000000000000000',
        isActive: true
      };

      const mockEscrowAddresses = {
        source: '0x1111111111111111111111111111111111111111',
        destination: '0x2222222222222222222222222222222222222222'
      };

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockTeeService.getExecutionStatus.mockResolvedValue({ status: 'executing', message: 'TEE processing' });
      mockRelayerService.getExecutionStatus.mockResolvedValue({ status: 'executing', message: 'Relayer processing' });
      mockRelayerService.getEscrowAddresses.mockResolvedValue(mockEscrowAddresses);

      const response = await request(app)
        .get(`/api/1inch/orders/${validOrderHash}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBe(validOrderHash);
      expect(response.body.data.order).toMatchObject({
        maker: mockOrderDetails.maker,
        sourceToken: mockOrderDetails.sourceToken,
        sourceAmount: mockOrderDetails.sourceAmount,
        destinationChainId: mockOrderDetails.destinationChainId
      });
      expect(response.body.data.status).toBe('matched');
      expect(response.body.data.escrowAddresses).toEqual(mockEscrowAddresses);
      expect(response.body.data.canCancel).toBe(false); // Already matched
    });

    it('should return 404 for non-existent order', async () => {
      mockRelayerService.getOrderDetails.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/1inch/orders/${validOrderHash}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order not found or inactive');
    });

    it('should return validation error for invalid order hash', async () => {
      const response = await request(app)
        .get(`/api/1inch/orders/${invalidOrderHash}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/1inch/orders', () => {
    it('should return user orders with pagination', async () => {
      const mockOrdersResult = {
        orders: [
          {
            orderHash: validOrderHash,
            maker: validUserAddress,
            sourceToken: '0xA0b86a33E9...',
            sourceAmount: '1000000000000000000',
            status: 'pending',
            expiryTime: Math.floor(Date.now() / 1000) + 3600
          }
        ],
        total: 1
      };

      mockRelayerService.getUserOrders.mockResolvedValue(mockOrdersResult);
      mockTeeService.getExecutionStatus.mockResolvedValue({ status: 'pending' });
      mockRelayerService.getExecutionStatus.mockResolvedValue({ status: 'pending' });

      const response = await request(app)
        .get('/api/1inch/orders')
        .query({ userAddress: validUserAddress, limit: 10, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
      expect(response.body.data.orders[0].orderHash).toBe(validOrderHash);
      expect(response.body.data.orders[0].canCancel).toBe(true); // Pending order
      expect(response.body.data.pagination).toMatchObject({
        total: 1,
        limit: 10,
        offset: 0,
        hasMore: false
      });
    });

    it('should filter orders by status', async () => {
      const mockOrdersResult = {
        orders: [],
        total: 0
      };

      mockRelayerService.getUserOrders.mockResolvedValue(mockOrdersResult);

      const response = await request(app)
        .get('/api/1inch/orders')
        .query({ status: 'completed', limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(0);
      expect(mockRelayerService.getUserOrders).toHaveBeenCalledWith({
        userAddress: undefined,
        status: 'completed',
        chainId: undefined,
        limit: 10,
        offset: 0
      });
    });

    it('should validate status parameter', async () => {
      const response = await request(app)
        .get('/api/1inch/orders')
        .query({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('DELETE /api/1inch/orders/:orderHash', () => {
    it('should cancel order successfully', async () => {
      const mockOrderDetails = {
        maker: validUserAddress,
        sourceToken: '0xA0b86a33E9...',
        sourceAmount: '1000000000000000000',
        expiryTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        isActive: true
      };

      const mockEscrowAddresses = {
        source: null,
        destination: null
      };

      const mockCancellationResult = {
        success: true,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gasUsed: '21000'
      };

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockRelayerService.getEscrowAddresses.mockResolvedValue(mockEscrowAddresses);
      mockRelayerService.cancelOrder.mockResolvedValue(mockCancellationResult);

      const response = await request(app)
        .delete(`/api/1inch/orders/${validOrderHash}`)
        .send({ userAddress: validUserAddress })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
      expect(response.body.data.transactionHash).toBe(mockCancellationResult.transactionHash);
      expect(response.body.data.etherscanUrl).toContain('sepolia.etherscan.io');
    });

    it('should reject cancellation from non-maker', async () => {
      const mockOrderDetails = {
        maker: '0x' + '9'.repeat(40), // Different address
        isActive: true
      };

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);

      const response = await request(app)
        .delete(`/api/1inch/orders/${validOrderHash}`)
        .send({ userAddress: validUserAddress })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Only order maker can cancel the order');
    });

    it('should reject cancellation of already matched order', async () => {
      const mockOrderDetails = {
        maker: validUserAddress,
        isActive: true,
        expiryTime: Math.floor(Date.now() / 1000) + 3600
      };

      const mockEscrowAddresses = {
        source: '0x1111111111111111111111111111111111111111',
        destination: null
      };

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockRelayerService.getEscrowAddresses.mockResolvedValue(mockEscrowAddresses);

      const response = await request(app)
        .delete(`/api/1inch/orders/${validOrderHash}`)
        .send({ userAddress: validUserAddress })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot cancel order that has already been matched');
    });

    it('should reject cancellation of expired order', async () => {
      const mockOrderDetails = {
        maker: validUserAddress,
        isActive: true,
        expiryTime: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };

      const mockEscrowAddresses = {
        source: null,
        destination: null
      };

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockRelayerService.getEscrowAddresses.mockResolvedValue(mockEscrowAddresses);

      const response = await request(app)
        .delete(`/api/1inch/orders/${validOrderHash}`)
        .send({ userAddress: validUserAddress })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order has already expired');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .delete(`/api/1inch/orders/${validOrderHash}`)
        .send({}) // Missing userAddress
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/1inch/orders/:orderHash/status', () => {
    it('should return detailed order status', async () => {
      const mockOrderDetails = {
        maker: validUserAddress,
        sourceToken: '0xA0b86a33E9...',
        sourceAmount: '1000000000000000000',
        destinationChainId: 397,
        expiryTime: Math.floor(Date.now() / 1000) + 3600,
        isActive: true
      };

      const mockEscrowAddresses = {
        source: '0x1111111111111111111111111111111111111111',
        destination: '0x2222222222222222222222222222222222222222'
      };

      const mockTeeStatus = {
        status: 'executing',
        startedAt: new Date(Date.now() - 60000).toISOString()
      };

      const mockRelayerStatus = {
        status: 'executing',
        completedAt: null
      };

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockTeeService.getExecutionStatus.mockResolvedValue(mockTeeStatus);
      mockRelayerService.getExecutionStatus.mockResolvedValue(mockRelayerStatus);
      mockRelayerService.getEscrowAddresses.mockResolvedValue(mockEscrowAddresses);

      const response = await request(app)
        .get(`/api/1inch/orders/${validOrderHash}/status`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBe(validOrderHash);
      expect(response.body.data.overallStatus).toBe('executing');
      expect(response.body.data.progress).toBe(70);
      expect(response.body.data.canCancel).toBe(false);
      expect(response.body.data.isExpired).toBe(false);
      
      // Check stage breakdown
      expect(response.body.data.stages.orderCreated.status).toBe('completed');
      expect(response.body.data.stages.orderMatched.status).toBe('completed');
      expect(response.body.data.stages.crossChainExecution.status).toBe('executing');
      expect(response.body.data.stages.settlement.status).toBe('executing');
      
      // Check technical details
      expect(response.body.data.technical.escrowAddresses).toEqual(mockEscrowAddresses);
      expect(response.body.data.technical.timeRemaining).toBeGreaterThan(0);
    });

    it('should handle completed order status', async () => {
      const mockOrderDetails = {
        maker: validUserAddress,
        expiryTime: Math.floor(Date.now() / 1000) + 3600,
        isActive: true
      };

      const mockEscrowAddresses = {
        source: '0x1111111111111111111111111111111111111111',
        destination: '0x2222222222222222222222222222222222222222'
      };

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockTeeService.getExecutionStatus.mockResolvedValue({ status: 'completed' });
      mockRelayerService.getExecutionStatus.mockResolvedValue({ 
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      mockRelayerService.getEscrowAddresses.mockResolvedValue(mockEscrowAddresses);

      const response = await request(app)
        .get(`/api/1inch/orders/${validOrderHash}/status`)
        .expect(200);

      expect(response.body.data.overallStatus).toBe('completed');
      expect(response.body.data.progress).toBe(100);
      expect(response.body.data.nextAction).toBe('Cross-chain swap completed successfully');
    });

    it('should handle expired order', async () => {
      const mockOrderDetails = {
        maker: validUserAddress,
        expiryTime: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        isActive: true
      };

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockTeeService.getExecutionStatus.mockResolvedValue({ status: 'pending' });
      mockRelayerService.getExecutionStatus.mockResolvedValue({ status: 'pending' });
      mockRelayerService.getEscrowAddresses.mockResolvedValue({ source: null, destination: null });

      const response = await request(app)
        .get(`/api/1inch/orders/${validOrderHash}/status`)
        .expect(200);

      expect(response.body.data.overallStatus).toBe('expired');
      expect(response.body.data.isExpired).toBe(true);
      expect(response.body.data.canRefund).toBe(true);
      expect(response.body.data.technical.timeRemaining).toBe(0);
    });

    it('should return 404 for non-existent order', async () => {
      mockRelayerService.getOrderDetails.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/1inch/orders/${validOrderHash}/status`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockRelayerService.getOrderDetails.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get(`/api/1inch/orders/${validOrderHash}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve order details');
      expect(response.body.details).toBe('Service unavailable');
    });

    it('should validate order hash format consistently', async () => {
      const endpoints = [
        `/api/1inch/orders/${invalidOrderHash}`,
        `/api/1inch/orders/${invalidOrderHash}/status`
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      }
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent response format for all endpoints', async () => {
      // Setup mocks for successful responses
      const mockOrderDetails = {
        maker: validUserAddress,
        sourceToken: '0xA0b86a33E9...',
        sourceAmount: '1000000000000000000',
        destinationChainId: 397,
        expiryTime: Math.floor(Date.now() / 1000) + 3600,
        isActive: true
      };

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockRelayerService.getUserOrders.mockResolvedValue({ orders: [], total: 0 });
      mockTeeService.getExecutionStatus.mockResolvedValue({ status: 'pending' });
      mockRelayerService.getExecutionStatus.mockResolvedValue({ status: 'pending' });
      mockRelayerService.getEscrowAddresses.mockResolvedValue({ source: null, destination: null });

      const endpoints = [
        `/api/1inch/orders/${validOrderHash}`,
        '/api/1inch/orders',
        `/api/1inch/orders/${validOrderHash}/status`
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('timestamp');
        expect(typeof response.body.timestamp).toBe('string');
      }
    });
  });
});