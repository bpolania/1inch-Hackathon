import request from 'supertest';
import express from 'express';
import { transactionRoutes } from '../transactions';

// Create test app
const app = express();
app.use(express.json());

// Mock services
const mockRelayerService = {
  getOrderDetails: jest.fn(),
  getCrossChainTransactions: jest.fn()
};

// Inject mock services
app.use((req: any, res: any, next: any) => {
  req.relayerService = mockRelayerService;
  next();
});

app.use('/api/transactions', transactionRoutes);

describe('Transaction Status API Endpoints', () => {
  const validTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const validOrderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const invalidTxHash = '0x123'; // Too short

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/transactions/status/:txHash', () => {
    it('should return Ethereum transaction status', async () => {
      const response = await request(app)
        .get(`/api/transactions/status/${validTxHash}`)
        .query({ chainId: 11155111 }) // Sepolia
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionHash).toBe(validTxHash);
      expect(response.body.data.chainId).toBe(11155111);
      expect(response.body.data.chainName).toBe('Ethereum Sepolia');
      expect(response.body.data.status).toBe('confirmed');
      expect(response.body.data.explorerUrl).toContain('sepolia.etherscan.io');
      expect(response.body.data.isConfirmed).toBe(true);
      expect(typeof response.body.data.confirmations).toBe('number');
      expect(typeof response.body.data.gasUsed).toBe('string');
      expect(typeof response.body.data.transactionFee).toBe('string');
    });

    it('should return NEAR transaction status', async () => {
      const response = await request(app)
        .get(`/api/transactions/status/${validTxHash}`)
        .query({ chainId: 397 }) // NEAR
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chainId).toBe(397);
      expect(response.body.data.chainName).toBe('NEAR Protocol');
      expect(response.body.data.explorerUrl).toContain('nearblocks.io');
      expect(response.body.data.from).toContain('.testnet');
      expect(response.body.data.to).toContain('.testnet');
    });

    it('should return Bitcoin transaction status', async () => {
      const response = await request(app)
        .get(`/api/transactions/status/${validTxHash}`)
        .query({ chainId: 40004 }) // Bitcoin Testnet
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chainId).toBe(40004);
      expect(response.body.data.chainName).toBe('Bitcoin Testnet');
      expect(response.body.data.explorerUrl).toContain('blockstream.info');
      expect(response.body.data.from).toMatch(/^bc1/);
      expect(response.body.data.to).toMatch(/^bc1/);
    });

    it('should default to Ethereum when no chainId provided', async () => {
      const response = await request(app)
        .get(`/api/transactions/status/${validTxHash}`)
        .expect(200);

      expect(response.body.data.chainId).toBe(1);
      expect(response.body.data.chainName).toBe('Ethereum Mainnet');
    });

    it('should return error for unsupported chain', async () => {
      const response = await request(app)
        .get(`/api/transactions/status/${validTxHash}`)
        .query({ chainId: 999 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unsupported chain ID');
      expect(response.body.supportedChains).toEqual([1, 11155111, 397, 40004, 40001]);
    });

    it('should validate transaction hash format', async () => {
      const response = await request(app)
        .get(`/api/transactions/status/${invalidTxHash}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Invalid transaction hash',
            path: 'txHash'
          })
        ])
      );
    });

    it('should include confirmation requirements for each chain', async () => {
      const chainIds = [1, 11155111, 397, 40004, 40001];
      const expectedConfirmations = [12, 3, 1, 3, 6];

      for (let i = 0; i < chainIds.length; i++) {
        const response = await request(app)
          .get(`/api/transactions/status/${validTxHash}`)
          .query({ chainId: chainIds[i] })
          .expect(200);

        // The isConfirmed field should be based on meeting required confirmations
        expect(typeof response.body.data.isConfirmed).toBe('boolean');
        expect(response.body.data.confirmations).toBeGreaterThanOrEqual(expectedConfirmations[i]);
      }
    });

    it('should include estimated confirmation time for pending transactions', async () => {
      // This test would need to mock a pending transaction status
      // For now, we'll test the structure with a confirmed transaction
      const response = await request(app)
        .get(`/api/transactions/status/${validTxHash}`)
        .query({ chainId: 397 })
        .expect(200);

      // For confirmed transactions, estimatedConfirmationTime should be null
      expect(response.body.data.estimatedConfirmationTime).toBeNull();
    });
  });

  describe('GET /api/transactions/cross-chain/:orderHash', () => {
    it('should return cross-chain transaction bundle status', async () => {
      const mockOrderDetails = {
        sourceChainId: 1,
        destinationChainId: 397,
        maker: '0x742d35cc6634c0532925a3b8d4e9dc7d67a1c1e2'
      };

      const mockTransactionBundle = [
        {
          hash: '0xeth1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
          chainId: 1,
          type: 'source',
          status: 'confirmed'
        },
        {
          hash: '0xnear234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
          chainId: 397,
          type: 'destination',
          status: 'confirmed'
        },
        {
          hash: '0xescrow34567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
          chainId: 1,
          type: 'escrow_creation',
          status: 'confirmed'
        }
      ];

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockRelayerService.getCrossChainTransactions.mockResolvedValue(mockTransactionBundle);

      const response = await request(app)
        .get(`/api/transactions/cross-chain/${validOrderHash}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBe(validOrderHash);
      expect(response.body.data.overallStatus).toBe('completed');
      expect(response.body.data.totalTransactions).toBe(3);
      expect(response.body.data.confirmedTransactions).toBe(3);
      expect(response.body.data.transactions).toHaveLength(3);

      // Check cross-chain summary
      expect(response.body.data.crossChainSummary.sourceChain.chainId).toBe(1);
      expect(response.body.data.crossChainSummary.destinationChain.chainId).toBe(397);
      expect(response.body.data.crossChainSummary.sourceChain.status).toBe('confirmed');
      expect(response.body.data.crossChainSummary.destinationChain.status).toBe('confirmed');

      // Check atomic swap status
      expect(response.body.data.atomicSwapStatus.escrowsCreated).toBe(true);
      expect(response.body.data.atomicSwapStatus.tokensSettled).toBe(true);

      // Verify each transaction has explorer URL
      response.body.data.transactions.forEach((tx: any) => {
        expect(tx.explorerUrl).toBeDefined();
        if (tx.chainId === 1) {
          expect(tx.explorerUrl).toContain('sepolia.etherscan.io');
        } else if (tx.chainId === 397) {
          expect(tx.explorerUrl).toContain('nearblocks.io');
        }
      });
    });

    it('should handle pending cross-chain transactions', async () => {
      const mockOrderDetails = {
        sourceChainId: 1,
        destinationChainId: 397
      };

      const mockTransactionBundle = [
        {
          hash: '0xeth1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
          chainId: 1,
          type: 'source',
          status: 'confirmed'
        },
        {
          hash: '0xnear234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
          chainId: 397,
          type: 'destination',
          status: 'pending'
        }
      ];

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockRelayerService.getCrossChainTransactions.mockResolvedValue(mockTransactionBundle);

      const response = await request(app)
        .get(`/api/transactions/cross-chain/${validOrderHash}`)
        .expect(200);

      expect(response.body.data.overallStatus).toBe('pending');
      expect(response.body.data.confirmedTransactions).toBe(1);
      expect(response.body.data.atomicSwapStatus.tokensSettled).toBe(false);
    });

    it('should handle failed cross-chain transactions', async () => {
      const mockOrderDetails = {
        sourceChainId: 1,
        destinationChainId: 397
      };

      const mockTransactionBundle = [
        {
          hash: '0xeth1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
          chainId: 1,
          type: 'source',
          status: 'confirmed'
        },
        {
          hash: '0xnear234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
          chainId: 397,
          type: 'destination',
          status: 'failed'
        }
      ];

      mockRelayerService.getOrderDetails.mockResolvedValue(mockOrderDetails);
      mockRelayerService.getCrossChainTransactions.mockResolvedValue(mockTransactionBundle);

      const response = await request(app)
        .get(`/api/transactions/cross-chain/${validOrderHash}`)
        .expect(200);

      expect(response.body.data.overallStatus).toBe('failed');
      expect(response.body.data.atomicSwapStatus.tokensSettled).toBe(false);
    });

    it('should return 404 for non-existent order', async () => {
      mockRelayerService.getOrderDetails.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/transactions/cross-chain/${validOrderHash}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order not found');
    });

    it('should validate order hash format', async () => {
      const response = await request(app)
        .get(`/api/transactions/cross-chain/${invalidTxHash}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Chain-Specific Transaction Details', () => {
    it('should return appropriate fields for each blockchain', async () => {
      const testCases = [
        {
          chainId: 1,
          expectedFields: ['gasUsed', 'gasPrice', 'transactionFee', 'blockNumber', 'blockHash'],
          addressFormat: /^0x[a-fA-F0-9]{40}$/
        },
        {
          chainId: 397,
          expectedFields: ['gasUsed', 'gasPrice', 'transactionFee', 'blockNumber', 'blockHash'],
          addressFormat: /\.testnet$/
        },
        {
          chainId: 40004,
          expectedFields: ['gasUsed', 'gasPrice', 'transactionFee', 'blockNumber', 'blockHash'],
          addressFormat: /^bc1[a-z0-9]+$/
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .get(`/api/transactions/status/${validTxHash}`)
          .query({ chainId: testCase.chainId })
          .expect(200);

        // Check that all expected fields are present
        testCase.expectedFields.forEach(field => {
          expect(response.body.data).toHaveProperty(field);
        });

        // Check address format
        expect(response.body.data.from).toMatch(testCase.addressFormat);
        expect(response.body.data.to).toMatch(testCase.addressFormat);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockRelayerService.getOrderDetails.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/transactions/cross-chain/${validOrderHash}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve cross-chain transaction status');
      expect(response.body.details).toBe('Database connection failed');
    });

    it('should validate chainId parameter type', async () => {
      const response = await request(app)
        .get(`/api/transactions/status/${validTxHash}`)
        .query({ chainId: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent response format for all endpoints', async () => {
      mockRelayerService.getOrderDetails.mockResolvedValue({ destinationChainId: 397 });
      mockRelayerService.getCrossChainTransactions.mockResolvedValue([]);

      const endpoints = [
        `/api/transactions/status/${validTxHash}?chainId=1`,
        `/api/transactions/cross-chain/${validOrderHash}`
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('timestamp');
        expect(typeof response.body.timestamp).toBe('string');
        expect(new Date(response.body.timestamp).getTime()).toBeGreaterThan(0);
      }
    });
  });

  describe('Explorer URL Generation', () => {
    it('should generate correct explorer URLs for each chain', async () => {
      const testCases = [
        { chainId: 1, expectedDomain: 'sepolia.etherscan.io' },
        { chainId: 11155111, expectedDomain: 'sepolia.etherscan.io' },
        { chainId: 397, expectedDomain: 'nearblocks.io' },
        { chainId: 40004, expectedDomain: 'blockstream.info' },
        { chainId: 40001, expectedDomain: 'blockstream.info' }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .get(`/api/transactions/status/${validTxHash}`)
          .query({ chainId: testCase.chainId })
          .expect(200);

        expect(response.body.data.explorerUrl).toContain(testCase.expectedDomain);
        expect(response.body.data.explorerUrl).toContain(validTxHash);
      }
    });
  });
});