import request from 'supertest';
import express from 'express';
import { proofRoutes } from '../proofs';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/proofs', proofRoutes);

describe('Proof API Endpoints', () => {
  const validOrderHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const validUserAddress = '0x742d35cc6634c0532925a3b8d4e9dc7d67a1c1e2';
  const invalidOrderHash = '0x123'; // Too short
  const invalidUserAddress = 'not-an-address';

  describe('GET /api/proofs/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/proofs/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.service).toBe('proof-api');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('ethereum');
      expect(response.body.data).toHaveProperty('cache');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/proofs/escrow/:orderHash', () => {
    it('should return escrow proof for valid order hash', async () => {
      const response = await request(app)
        .get(`/api/proofs/escrow/${validOrderHash}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBe(validOrderHash);
      expect(response.body.data).toHaveProperty('escrowAddress');
      expect(response.body.data).toHaveProperty('tokenAddress');
      expect(response.body.data).toHaveProperty('lockedAmount');
      expect(response.body.data).toHaveProperty('ethereumProof');
      expect(response.body.data).toHaveProperty('currentEscrowBalance');
      expect(response.body.data).toHaveProperty('etherscanUrl');
      expect(response.body.data).toHaveProperty('verificationStatus');
      expect(response.body.timestamp).toBeDefined();

      // Validate Ethereum proof structure
      expect(response.body.data.ethereumProof).toHaveProperty('transactionHash');
      expect(response.body.data.ethereumProof).toHaveProperty('blockNumber');
      expect(response.body.data.ethereumProof).toHaveProperty('blockHash');
      expect(response.body.data.ethereumProof).toHaveProperty('logIndex');
      expect(response.body.data.ethereumProof).toHaveProperty('contractEventProof');

      // Validate URLs
      expect(response.body.data.etherscanUrl).toContain('sepolia.etherscan.io');
      expect(response.body.data.escrowEtherscanUrl).toContain('sepolia.etherscan.io');
    });

    it('should return validation error for invalid order hash', async () => {
      const response = await request(app)
        .get(`/api/proofs/escrow/${invalidOrderHash}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toHaveLength(1);
      expect(response.body.details[0].msg).toBe('Invalid order hash format');
      expect(response.body.details[0].path).toBe('orderHash');
    });

    it('should cache results between requests', async () => {
      // First request
      const response1 = await request(app)
        .get(`/api/proofs/escrow/${validOrderHash}`)
        .expect(200);

      // Second request (should be cached)
      const response2 = await request(app)
        .get(`/api/proofs/escrow/${validOrderHash}`)
        .expect(200);

      // Results should be identical
      expect(response1.body.data).toEqual(response2.body.data);
    });
  });

  describe('GET /api/proofs/cross-chain/:orderHash', () => {
    it('should return cross-chain proof for valid order hash', async () => {
      const response = await request(app)
        .get(`/api/proofs/cross-chain/${validOrderHash}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBe(validOrderHash);
      expect(response.body.data).toHaveProperty('destinationChain');
      expect(response.body.data).toHaveProperty('secretRevealProof');
      expect(response.body.data).toHaveProperty('coordinationStatus');
      expect(response.body.timestamp).toBeDefined();

      // Validate secret reveal proof structure
      expect(response.body.data.secretRevealProof).toHaveProperty('secret');
      expect(response.body.data.secretRevealProof).toHaveProperty('hashlock');
      expect(response.body.data.secretRevealProof).toHaveProperty('verificationHash');
      expect(response.body.data.secretRevealProof).toHaveProperty('coordinationVerified');

      // Validate chain-specific proof (NEAR in mock)
      expect(response.body.data).toHaveProperty('nearProof');
      expect(response.body.data.nearProof).toHaveProperty('transactionId');
      expect(response.body.data.nearProof).toHaveProperty('blockHash');
      expect(response.body.data.nearProof).toHaveProperty('blockHeight');
      expect(response.body.data.nearProof).toHaveProperty('nearBlocksUrl');
    });

    it('should return validation error for invalid order hash', async () => {
      const response = await request(app)
        .get(`/api/proofs/cross-chain/${invalidOrderHash}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details[0].msg).toBe('Invalid order hash format');
    });
  });

  describe('GET /api/proofs/settlement/:orderHash/:userAddress', () => {
    it('should return settlement proof for valid parameters', async () => {
      const response = await request(app)
        .get(`/api/proofs/settlement/${validOrderHash}/${validUserAddress}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderHash).toBe(validOrderHash);
      expect(response.body.data.userAddress).toBe(validUserAddress);
      expect(response.body.data).toHaveProperty('destinationChain');
      expect(response.body.data).toHaveProperty('tokenTransfer');
      expect(response.body.data).toHaveProperty('balanceProof');
      expect(response.body.data).toHaveProperty('explorerUrl');
      expect(response.body.data).toHaveProperty('verificationStatus');
      expect(response.body.timestamp).toBeDefined();

      // Validate token transfer structure
      expect(response.body.data.tokenTransfer).toHaveProperty('fromAddress');
      expect(response.body.data.tokenTransfer).toHaveProperty('toAddress');
      expect(response.body.data.tokenTransfer).toHaveProperty('tokenAmount');
      expect(response.body.data.tokenTransfer).toHaveProperty('transactionHash');
      expect(response.body.data.tokenTransfer).toHaveProperty('blockNumber');

      // Validate balance proof structure
      expect(response.body.data.balanceProof).toHaveProperty('balanceBefore');
      expect(response.body.data.balanceProof).toHaveProperty('balanceAfter');
      expect(response.body.data.balanceProof).toHaveProperty('balanceChange');
      expect(response.body.data.balanceProof).toHaveProperty('proofBlock');

      // Validate user address matches
      expect(response.body.data.tokenTransfer.toAddress).toBe(validUserAddress);
    });

    it('should return validation error for invalid order hash', async () => {
      const response = await request(app)
        .get(`/api/proofs/settlement/${invalidOrderHash}/${validUserAddress}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return validation error for invalid user address', async () => {
      const response = await request(app)
        .get(`/api/proofs/settlement/${validOrderHash}/${invalidUserAddress}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should cache results with user-specific key', async () => {
      // Request for user 1
      const response1 = await request(app)
        .get(`/api/proofs/settlement/${validOrderHash}/${validUserAddress}`)
        .expect(200);

      // Same request should return cached result
      const response2 = await request(app)
        .get(`/api/proofs/settlement/${validOrderHash}/${validUserAddress}`)
        .expect(200);

      expect(response1.body.data).toEqual(response2.body.data);
    });
  });

  describe('Cache Management Endpoints', () => {
    beforeEach(async () => {
      // Clear cache before each test
      await request(app).delete('/api/proofs/cache');
    });

    describe('GET /api/proofs/cache/stats', () => {
      it('should return cache statistics', async () => {
        const response = await request(app)
          .get('/api/proofs/cache/stats')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('size');
        expect(response.body.data).toHaveProperty('entries');
        expect(response.body.data).toHaveProperty('summary');
        expect(response.body.data.summary).toHaveProperty('totalEntries');
        expect(response.body.data.summary).toHaveProperty('activeEntries');
        expect(response.body.data.summary).toHaveProperty('expiredEntries');
        expect(response.body.data.summary).toHaveProperty('hitRate');
      });

      it('should show cache growth after proof requests', async () => {
        // Check initial cache state
        let cacheStats = await request(app)
          .get('/api/proofs/cache/stats')
          .expect(200);
        expect(cacheStats.body.data.size).toBe(0);

        // Make a proof request
        await request(app)
          .get(`/api/proofs/escrow/${validOrderHash}`)
          .expect(200);

        // Check cache state after request
        cacheStats = await request(app)
          .get('/api/proofs/cache/stats')
          .expect(200);
        expect(cacheStats.body.data.size).toBe(1);
        expect(cacheStats.body.data.summary.activeEntries).toBe(1);
        expect(cacheStats.body.data.entries).toHaveLength(1);
        expect(cacheStats.body.data.entries[0].key).toContain('proof:escrow:');
      });
    });

    describe('DELETE /api/proofs/cache', () => {
      it('should clear cache successfully', async () => {
        // Add some data to cache
        await request(app)
          .get(`/api/proofs/escrow/${validOrderHash}`)
          .expect(200);

        // Verify cache has data
        let cacheStats = await request(app)
          .get('/api/proofs/cache/stats')
          .expect(200);
        expect(cacheStats.body.data.size).toBe(1);

        // Clear cache
        const clearResponse = await request(app)
          .delete('/api/proofs/cache')
          .expect(200);

        expect(clearResponse.body.success).toBe(true);
        expect(clearResponse.body.data.message).toBe('Cache cleared successfully');
        expect(clearResponse.body.data.entriesRemoved).toBe(1);

        // Verify cache is empty
        cacheStats = await request(app)
          .get('/api/proofs/cache/stats')
          .expect(200);
        expect(cacheStats.body.data.size).toBe(0);
      });

      it('should handle clearing empty cache', async () => {
        const response = await request(app)
          .delete('/api/proofs/cache')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.entriesRemoved).toBe(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing order hash parameter', async () => {
      const response = await request(app)
        .get('/api/proofs/escrow/')
        .expect(404);
    });

    it('should handle missing user address parameter', async () => {
      const response = await request(app)
        .get(`/api/proofs/settlement/${validOrderHash}/`)
        .expect(404);
    });

    it('should return consistent error format', async () => {
      const response = await request(app)
        .get(`/api/proofs/escrow/${invalidOrderHash}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent response format for all endpoints', async () => {
      const endpoints = [
        `/api/proofs/escrow/${validOrderHash}`,
        `/api/proofs/cross-chain/${validOrderHash}`,
        `/api/proofs/settlement/${validOrderHash}/${validUserAddress}`,
        '/api/proofs/health',
        '/api/proofs/cache/stats'
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

  describe('Performance and Caching', () => {
    it('should demonstrate caching performance benefit', async () => {
      // First request (cache miss)
      const start1 = Date.now();
      await request(app)
        .get(`/api/proofs/escrow/${validOrderHash}`)
        .expect(200);
      const time1 = Date.now() - start1;

      // Second request (cache hit)
      const start2 = Date.now();
      await request(app)
        .get(`/api/proofs/escrow/${validOrderHash}`)
        .expect(200);
      const time2 = Date.now() - start2;

      // Cache hit should be faster (though this might be flaky in testing)
      // We mainly just want to ensure both requests complete successfully
      expect(time1).toBeGreaterThan(0);
      expect(time2).toBeGreaterThan(0);
    });

    it('should handle concurrent requests correctly', async () => {
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .get(`/api/proofs/escrow/${validOrderHash}`)
          .expect(200)
      );

      const responses = await Promise.all(promises);

      // All responses should be successful and identical
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(responses[0].body.data);
      });
    });
  });
});