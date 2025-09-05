/**
 * Integration Tests for Fusion+ End-to-End Flows
 * 
 * Tests complete workflows from quote to swap to execution
 * Verifies proper integration between all services
 */

import request from 'supertest';
import express from 'express';
import { oneInchRoutes } from '../routes/oneinch';
import { teeRoutes } from '../routes/tee';
import { relayerRoutes } from '../routes/relayer';
import { transactionRoutes } from '../routes/transactions';

// Enhanced service mocks for integration testing
const mockTeeService = {
  analyzeIntent: jest.fn(),
  submitToTEE: jest.fn(),
  getSupportedRoutes: jest.fn(),
  getExecutionStatus: jest.fn(),
  getStatus: jest.fn()
};

const mockRelayerService = {
  analyzeProfitability: jest.fn(),
  submitIntent: jest.fn(),
  getMetrics: jest.fn(),
  getExecutionStatus: jest.fn(),
  getStatus: jest.fn()
};

const mockWsService = {
  broadcast: jest.fn()
};

// Setup integration test app
const app = express();
app.use(express.json());
app.use((req: any, res, next) => {
  req.teeService = mockTeeService;
  req.relayerService = mockRelayerService;
  req.wsService = mockWsService;
  next();
});

app.use('/api/1inch', oneInchRoutes);
app.use('/api/tee', teeRoutes);
app.use('/api/relayer', relayerRoutes);
app.use('/api/transactions', transactionRoutes);

describe('Fusion+ Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default service responses
    mockTeeService.getSupportedRoutes.mockResolvedValue({
      destinations: ['397', '40004', '40001'],
      supportedPairs: [
        { from: '11155111', to: '397', active: true },
        { from: '11155111', to: '40004', active: true }
      ]
    });
    
    mockRelayerService.getMetrics.mockResolvedValue({
      totalExecutions: 156,
      successRate: 0.97,
      avgExecutionTime: 245000
    });
  });

  describe('Cross-Chain Swap Flow: Ethereum  NEAR', () => {
    const crossChainIntent = {
      chainId: 11155111,
      fromToken: '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43',
      toToken: 'wrap.near',
      amount: '2000000000000000000', // 2 DT
      fromAddress: '0x742d35cc6634c0532925a3b8d4e9dc7d67a1c1e2',
      toChainId: 397,
      toAddress: 'alice.near'
    };

    it('should complete full cross-chain swap workflow', async () => {
      // Step 1: Get quote
      mockTeeService.analyzeIntent.mockResolvedValue({
        estimatedOutput: '4000000000000000000000000', // 4 NEAR (24 decimals)
        formattedOutput: '4.0',
        priceImpact: 0.08,
        route: 'Fusion+ Cross-Chain via NEAR',
        gasPrice: '22000000000',
        confidence: 0.96,
        estimatedExecutionTime: 420000
      });

      mockRelayerService.analyzeProfitability.mockResolvedValue({
        isProfitable: true,
        estimatedProfit: '3980000000000000000000000',
        gasEstimate: '280000',
        confidence: 0.94,
        totalFees: '0.0075'
      });

      const quoteResponse = await request(app)
        .get('/api/1inch/quote')
        .query({
          chainId: crossChainIntent.chainId,
          fromToken: crossChainIntent.fromToken,
          toToken: crossChainIntent.toToken,
          amount: crossChainIntent.amount,
          toChainId: crossChainIntent.toChainId
        });

      expect(quoteResponse.status).toBe(200);
      expect(quoteResponse.body.data.crossChain).toBe(true);
      expect(quoteResponse.body.data.outputAmount).toBe('4000000000000000000000000');

      // Step 2: Create swap order
      mockTeeService.submitToTEE.mockResolvedValue({
        contractAddress: '0xbeEab741D2869404FcB747057f5AbdEffc3A138d',
        calldata: '0xa1b2c3d4e5f6789012345678901234567890abcdef',
        gasEstimate: '320000',
        gasPrice: '22000000000',
        expectedOutput: '3980000000000000000000000',
        orderHash: '0x1234567890abcdef1234567890abcdef12345678',
        status: 'submitted',
        estimatedExecutionTime: 420000,
        requestId: 'tee-req-12345'
      });

      const swapResponse = await request(app)
        .post('/api/1inch/swap')
        .send(crossChainIntent);

      expect(swapResponse.status).toBe(200);
      expect(swapResponse.body.data.crossChain).toBe(true);
      expect(swapResponse.body.data.tx.to).toBe('0xbeEab741D2869404FcB747057f5AbdEffc3A138d');
      expect(swapResponse.body.data.orderHash).toBe('0x1234567890abcdef1234567890abcdef12345678');

      const intentId = swapResponse.body.data.intentId;

      // Step 3: Check execution status via TEE
      mockTeeService.getExecutionStatus.mockReturnValue({
        requestId: 'tee-req-12345',
        status: 'executing',
        progress: [
          { step: 'Order Created', completed: true, timestamp: Date.now() - 60000 },
          { step: 'TEE Analysis', completed: true, timestamp: Date.now() - 45000 },
          { step: 'Cross-Chain Bridge', completed: false, timestamp: null }
        ],
        transactions: [
          { chain: 'ethereum', txHash: '0xabc123...', status: 'confirmed' },
          { chain: 'near', txHash: 'def456.near', status: 'pending' }
        ]
      });

      const statusResponse = await request(app)
        .get(`/api/tee/execution/tee-req-12345`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.status).toBe('executing');
      expect(statusResponse.body.data.transactions).toHaveLength(2);

      // Step 4: Check transaction lifecycle
      const lifecycleResponse = await request(app)
        .get(`/api/transactions/lifecycle/${intentId}`);

      expect(lifecycleResponse.status).toBe(200);
      expect(lifecycleResponse.body.data.transactionId).toBe(intentId);
      expect(lifecycleResponse.body.data.routes).toEqual([
        { from: 'ethereum', to: 'near-protocol', status: 'active' }
      ]);

      // Verify service integration
      expect(mockTeeService.analyzeIntent).toHaveBeenCalled();
      expect(mockTeeService.submitToTEE).toHaveBeenCalled();
      expect(mockRelayerService.analyzeProfitability).toHaveBeenCalled();
    });
  });

  describe('Same-Chain Swap Flow: Ethereum  Ethereum', () => {
    const sameChainIntent = {
      chainId: 11155111,
      fromToken: '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43',
      toToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      amount: '1000000000000000000', // 1 DT
      fromAddress: '0x742d35cc6634c0532925a3b8d4e9dc7d67a1c1e2'
    };

    it('should complete same-chain swap via relayer', async () => {
      // Step 1: Get quote
      mockTeeService.analyzeIntent.mockResolvedValue({
        estimatedOutput: '2000000', // 2 USDC (6 decimals)
        formattedOutput: '2.0',
        priceImpact: 0.05,
        route: 'Fusion+ Same-Chain',
        confidence: 0.98
      });

      mockRelayerService.analyzeProfitability.mockResolvedValue({
        isProfitable: true,
        estimatedProfit: '1980000',
        gasEstimate: '180000',
        confidence: 0.97,
        totalFees: '0.003'
      });

      const quoteResponse = await request(app)
        .get('/api/1inch/quote')
        .query(sameChainIntent);

      expect(quoteResponse.status).toBe(200);
      expect(quoteResponse.body.data.crossChain).toBe(false);
      expect(quoteResponse.body.data.fees.bridgeFee).toBe('0');

      // Step 2: Create swap order via relayer
      mockRelayerService.submitIntent.mockResolvedValue({
        intentId: 'relayer-intent-67890',
        orderHash: '0xfedcba0987654321fedcba0987654321fedcba09',
        status: 'submitted',
        contractAddress: '0xbeEab741D2869404FcB747057f5AbdEffc3A138d',
        calldata: '0x9876543210fedcba9876543210fedcba9876543210',
        gasEstimate: '190000',
        expectedOutput: '1980000'
      });

      const swapResponse = await request(app)
        .post('/api/1inch/swap')
        .send(sameChainIntent);

      expect(swapResponse.status).toBe(200);
      expect(swapResponse.body.data.crossChain).toBe(false);

      // Verify relayer was used (not TEE)
      expect(mockRelayerService.submitIntent).toHaveBeenCalled();
      expect(mockTeeService.submitToTEE).not.toHaveBeenCalled();

      // Step 3: Check execution status via relayer
      mockRelayerService.getExecutionStatus.mockReturnValue({
        intentId: 'relayer-intent-67890',
        status: 'completed',
        progress: [
          { step: 'Order Submitted', completed: true, timestamp: Date.now() - 30000 },
          { step: 'Execution Complete', completed: true, timestamp: Date.now() - 5000 }
        ],
        transactions: {
          ethereum: ['0x987654321...'],
          bitcoin: [],
          near: []
        }
      });

      const statusResponse = await request(app)
        .get('/api/relayer/execution/relayer-intent-67890');

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.status).toBe('completed');
    });
  });

  describe('Bitcoin Integration Flow: Ethereum  Bitcoin', () => {
    const bitcoinIntent = {
      chainId: 11155111,
      fromToken: '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43',
      toToken: 'bitcoin',
      amount: '5000000000000000000', // 5 DT
      fromAddress: '0x742d35cc6634c0532925a3b8d4e9dc7d67a1c1e2',
      toChainId: 40004, // Bitcoin testnet
      toAddress: '2MyeQNiTnrDWMcc8xE1JP9v2w6AYUhGiUpy'
    };

    it('should handle Bitcoin atomic swap flow', async () => {
      // Mock Bitcoin-specific responses
      mockTeeService.analyzeIntent.mockResolvedValue({
        estimatedOutput: '500000', // 0.005 BTC (8 decimals)
        formattedOutput: '0.005',
        priceImpact: 0.15,
        route: 'Fusion+ Bitcoin HTLC',
        confidence: 0.93,
        estimatedExecutionTime: 600000 // 10 minutes for Bitcoin
      });

      mockRelayerService.analyzeProfitability.mockResolvedValue({
        isProfitable: true,
        estimatedProfit: '490000',
        gasEstimate: '400000', // Higher gas for Bitcoin integration
        confidence: 0.91,
        totalFees: '0.012'
      });

      const quoteResponse = await request(app)
        .get('/api/1inch/quote')
        .query({
          chainId: bitcoinIntent.chainId,
          fromToken: bitcoinIntent.fromToken,
          toToken: bitcoinIntent.toToken,
          amount: bitcoinIntent.amount,
          toChainId: bitcoinIntent.toChainId
        });

      expect(quoteResponse.status).toBe(200);
      expect(quoteResponse.body.data.crossChain).toBe(true);
      expect(quoteResponse.body.data.estimatedTime).toBe(600000);

      // Create Bitcoin swap
      mockTeeService.submitToTEE.mockResolvedValue({
        contractAddress: '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8', // Bitcoin adapter
        calldata: '0xbitcoin123456789abcdef',
        gasEstimate: '420000',
        expectedOutput: '490000',
        orderHash: '0xbitcoin567890abcdef567890abcdef567890ab',
        status: 'submitted',
        estimatedExecutionTime: 600000,
        requestId: 'bitcoin-tee-98765',
        htlcDetails: {
          secretHash: '0x1234567890abcdef1234567890abcdef12345678',
          timelock: 144, // 24 hours in blocks
          htlcAddress: '2MyeQNiTnrDWMcc8xE1JP9v2w6AYUhGiUpy'
        }
      });

      const swapResponse = await request(app)
        .post('/api/1inch/swap')
        .send(bitcoinIntent);

      expect(swapResponse.status).toBe(200);
      expect(swapResponse.body.data.tx.to).toBe('0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8');
      expect(swapResponse.body.data.protocols).toContain('Cross-Chain Bridge');

      // Check Bitcoin-specific execution status
      mockTeeService.getExecutionStatus.mockReturnValue({
        requestId: 'bitcoin-tee-98765',
        status: 'executing',
        progress: [
          { step: 'Ethereum Order Created', completed: true, timestamp: Date.now() - 120000 },
          { step: 'Bitcoin HTLC Funded', completed: true, timestamp: Date.now() - 60000 },
          { step: 'Secret Reveal Pending', completed: false, timestamp: null }
        ],
        transactions: [
          { 
            chain: 'ethereum', 
            txHash: '0x63f7b796a6dae46a456c72339093d2febd2785a626db0afe2ed3d695625eaaab',
            status: 'confirmed' 
          },
          { 
            chain: 'bitcoin', 
            txHash: '76b4b593aca78c47d83d8a78d949bbc49324b063f1682ddededa4bc7c17d928c',
            status: 'confirmed',
            htlcAddress: '2MyeQNiTnrDWMcc8xE1JP9v2w6AYUhGiUpy'
          }
        ]
      });

      const statusResponse = await request(app)
        .get('/api/tee/execution/bitcoin-tee-98765');

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.transactions).toHaveLength(2);
      expect(statusResponse.body.data.transactions[1].chain).toBe('bitcoin');
      expect(statusResponse.body.data.transactions[1].htlcAddress).toBe('2MyeQNiTnrDWMcc8xE1JP9v2w6AYUhGiUpy');
    });
  });

  describe('Service Integration Validation', () => {
    it('should properly route based on chain configuration', async () => {
      const testCases = [
        { 
          from: 11155111, 
          to: 11155111, 
          expectedService: 'relayer',
          description: 'same-chain Ethereum'
        },
        { 
          from: 11155111, 
          to: 397, 
          expectedService: 'tee',
          description: 'cross-chain Ethereum to NEAR'
        },
        { 
          from: 11155111, 
          to: 40004, 
          expectedService: 'tee',
          description: 'cross-chain Ethereum to Bitcoin'
        }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        mockTeeService.submitToTEE.mockResolvedValue({
          contractAddress: '0xtest',
          orderHash: '0xtest',
          status: 'submitted'
        });

        mockRelayerService.submitIntent.mockResolvedValue({
          intentId: 'test',
          orderHash: '0xtest',
          status: 'submitted'
        });

        await request(app)
          .post('/api/1inch/swap')
          .send({
            chainId: testCase.from,
            fromToken: '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43',
            toToken: testCase.to === 397 ? 'wrap.near' : testCase.to === 40004 ? 'bitcoin' : '0xa0b8...',
            amount: '1000000000000000000',
            fromAddress: '0x742d35cc6634c0532925a3b8d4e9dc7d67a1c1e2',
            toChainId: testCase.to
          });

        if (testCase.expectedService === 'tee') {
          expect(mockTeeService.submitToTEE).toHaveBeenCalled();
          expect(mockRelayerService.submitIntent).not.toHaveBeenCalled();
        } else {
          expect(mockRelayerService.submitIntent).toHaveBeenCalled();
          expect(mockTeeService.submitToTEE).not.toHaveBeenCalled();
        }
      }
    });

    it('should validate supported routes before processing', async () => {
      mockTeeService.getSupportedRoutes.mockResolvedValue({
        destinations: ['397'], // Only NEAR supported
        supportedPairs: [
          { from: '11155111', to: '397', active: true }
        ]
      });

      // Test supported route (should work)
      const supportedResponse = await request(app)
        .get('/api/1inch/tokens/11155111');

      expect(supportedResponse.status).toBe(200);
      expect(supportedResponse.body.supportedRoutes.destinations).toEqual(['397']);

      // Verify protocols show only supported chains
      const protocolsResponse = await request(app)
        .get('/api/1inch/protocols/11155111');

      expect(protocolsResponse.status).toBe(200);
      const nearProtocol = protocolsResponse.body.data.find((p: any) => 
        p.name === 'NEAR Protocol Bridge'
      );
      expect(nearProtocol.supportedChains).toEqual(['1', '11155111']);
    });
  });
});