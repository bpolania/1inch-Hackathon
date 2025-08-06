/**
 * Transaction Serialization Tests
 * 
 * Comprehensive tests for chain abstraction transaction serialization
 * covering EVM, Bitcoin, and Solana transaction formats.
 */

import { ChainSignatureManager, ChainId } from '../ChainSignatureManager';
import { logger } from '../../utils/logger';

// Mock NEAR API dependencies
jest.mock('near-api-js', () => ({
  connect: jest.fn().mockResolvedValue({
    account: jest.fn().mockResolvedValue({
      viewFunction: jest.fn().mockResolvedValue('ed25519:mockPublicKey'),
      functionCall: jest.fn().mockResolvedValue({
        signature: '0x' + 'a'.repeat(130),
        recoveryId: 27
      })
    })
  }),
  keyStores: {
    InMemoryKeyStore: jest.fn().mockImplementation(() => ({
      setKey: jest.fn()
    }))
  },
  utils: {
    KeyPair: {
      fromString: jest.fn().mockReturnValue({ publicKey: 'mock-public-key' })
    }
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('Transaction Serialization', () => {
  let chainSignatureManager: ChainSignatureManager;
  
  const testConfig = {
    nearNetwork: 'testnet' as const,
    nearAccountId: 'test-serialization.testnet',
    nearPrivateKey: 'ed25519:' + 'test'.repeat(16),
    mpcContractId: 'v1.signer-dev',
    derivationPath: 'serialization-test',
    supportedChains: [ChainId.ETHEREUM, ChainId.BITCOIN, ChainId.SOLANA]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    chainSignatureManager = new ChainSignatureManager(testConfig);
    await chainSignatureManager.initialize();
  });

  afterEach(async () => {
    await chainSignatureManager.stop();
  });

  describe('EVM Transaction Serialization', () => {
    const mockEVMTransaction = {
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f9B3e0',
      value: '1000000000000000000', // 1 ETH
      data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f9b3e00000000000000000000000000000000000000000000000000de0b6b3a7640000',
      nonce: 42,
      gasLimit: 21000,
      gasPrice: '20000000000', // 20 gwei
      chainId: 1
    };

    it('should serialize EVM transaction to proper RLP-encoded hash', async () => {
      const signatureRequest = {
        requestId: 'evm-test-001',
        targetChain: ChainId.ETHEREUM,
        transaction: mockEVMTransaction,
        derivationPath: 'evm-test',
        signatureScheme: 'secp256k1' as const
      };

      const result = await chainSignatureManager.requestSignature(signatureRequest);

      expect(result).toEqual(expect.objectContaining({
        requestId: 'evm-test-001',
        signature: expect.stringMatching(/^0x[a-fA-F0-9]+$/),
        signedTransaction: expect.objectContaining({
          ...mockEVMTransaction,
          r: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
          s: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
          v: expect.any(Number),
          signatureType: 'ecdsa-secp256k1'
        })
      }));

      expect(logger.info).toHaveBeenCalledWith(
        '🔧 Serializing EVM transaction for MPC signing',
        expect.objectContaining({
          to: mockEVMTransaction.to,
          value: mockEVMTransaction.value
        })
      );
    });

    it('should handle different EVM chains correctly', async () => {
      const chains = [
        { chainId: ChainId.ETHEREUM, expectedChainId: 1 },
        { chainId: ChainId.POLYGON, expectedChainId: 137 },
        { chainId: ChainId.ARBITRUM, expectedChainId: 42161 }
      ];

      for (const { chainId, expectedChainId } of chains) {
        const txWithChainId = { ...mockEVMTransaction, chainId: expectedChainId };
        
        const result = await chainSignatureManager.requestSignature({
          requestId: `chain-test-${chainId}`,
          targetChain: chainId,
          transaction: txWithChainId,
          derivationPath: 'chain-test',
          signatureScheme: 'secp256k1'
        });

        expect(result.signedTransaction.chainId).toBe(expectedChainId);
      }
    });

    it('should apply EIP-155 v value encoding correctly', async () => {
      const result = await chainSignatureManager.requestSignature({
        requestId: 'eip155-test',
        targetChain: ChainId.ETHEREUM,
        transaction: { ...mockEVMTransaction, chainId: 1 },
        derivationPath: 'eip155-test',
        signatureScheme: 'secp256k1'
      });

      // EIP-155: v = CHAIN_ID * 2 + 35 + {0, 1}
      const v = result.signedTransaction.v;
      expect(v >= 37).toBeTruthy(); // For mainnet: 1 * 2 + 35 + {0,1} >= 37
    });
  });

  describe('Bitcoin Transaction Serialization', () => {
    const mockBitcoinTransaction = {
      network: 'testnet',
      inputs: [{
        txid: 'a'.repeat(64),
        vout: 0,
        scriptPubKey: '76a914' + 'b'.repeat(40) + '88ac', // P2PKH script
        rawTx: 'c'.repeat(200) // Simplified raw transaction
      }],
      outputs: [{
        address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        value: 100000 // 0.001 BTC in satoshis
      }]
    };

    it('should serialize Bitcoin transaction to SIGHASH', async () => {
      const result = await chainSignatureManager.requestSignature({
        requestId: 'btc-test-001',
        targetChain: ChainId.BITCOIN,
        transaction: mockBitcoinTransaction,
        derivationPath: 'btc-test',
        signatureScheme: 'secp256k1'
      });

      expect(result).toEqual(expect.objectContaining({
        requestId: 'btc-test-001',
        signature: expect.stringMatching(/^0x[a-fA-F0-9]+$/),
        signedTransaction: expect.objectContaining({
          signatures: expect.arrayContaining([
            expect.objectContaining({
              inputIndex: 0,
              signatureType: 'ecdsa-der',
              sighashType: expect.any(Number)
            })
          ]),
          readyForBroadcast: true
        })
      }));

      expect(logger.info).toHaveBeenCalledWith(
        '🔧 Serializing Bitcoin transaction for MPC signing',
        expect.objectContaining({
          inputs: 1,
          outputs: 1
        })
      );
    });

    it('should handle Bitcoin serialization fallback gracefully', async () => {
      const invalidTransaction = {
        network: 'testnet',
        inputs: null, // Invalid inputs to trigger fallback
        outputs: []
      };

      const result = await chainSignatureManager.requestSignature({
        requestId: 'btc-fallback-test',
        targetChain: ChainId.BITCOIN,
        transaction: invalidTransaction,
        derivationPath: 'btc-fallback',
        signatureScheme: 'secp256k1'
      });

      // Should still return a result using fallback hash
      expect(result.signature).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(logger.error).toHaveBeenCalledWith(
        '💥 Failed to serialize Bitcoin transaction:',
        expect.any(Error)
      );
    });
  });

  describe('Solana Transaction Serialization', () => {
    const mockSolanaTransaction = {
      recentBlockhash: '11111111111111111111111111111111',
      feePayer: '11111111111111111111111111111112',
      instructions: [{
        programId: '11111111111111111111111111111113',
        accounts: [
          { pubkey: '11111111111111111111111111111114', isSigner: true, isWritable: true },
          { pubkey: '11111111111111111111111111111115', isSigner: false, isWritable: false }
        ],
        data: Buffer.from('test instruction data')
      }]
    };

    it('should serialize Solana transaction to message bytes', async () => {
      const result = await chainSignatureManager.requestSignature({
        requestId: 'sol-test-001',
        targetChain: ChainId.SOLANA,
        transaction: mockSolanaTransaction,
        derivationPath: 'sol-test',
        signatureScheme: 'ed25519'
      });

      expect(result).toEqual(expect.objectContaining({
        requestId: 'sol-test-001',
        signature: expect.stringMatching(/^0x[a-fA-F0-9]+$/),
        signedTransaction: expect.objectContaining({
          signatures: expect.arrayContaining([expect.stringMatching(/^0x[a-fA-F0-9]+$/)]),
          signatureType: 'ed25519',
          readyForBroadcast: true,
          feePayer: mockSolanaTransaction.feePayer
        })
      }));

      expect(logger.info).toHaveBeenCalledWith(
        '🔧 Serializing Solana transaction for MPC signing',
        expect.objectContaining({
          instructions: 1,
          accounts: 0
        })
      );
    });

    it('should validate Ed25519 signature length for Solana', async () => {
      // Mock invalid signature length
      const mockManager = chainSignatureManager as any;
      const originalCallMPC = mockManager.callMPCContract;
      
      mockManager.callMPCContract = jest.fn().mockResolvedValue({
        signature: '0x' + 'a'.repeat(126), // Invalid length (63 bytes instead of 64)
        recoveryId: undefined
      });

      await expect(
        chainSignatureManager.requestSignature({
          requestId: 'sol-invalid-sig',
          targetChain: ChainId.SOLANA,
          transaction: mockSolanaTransaction,
          derivationPath: 'sol-invalid',
          signatureScheme: 'ed25519'
        })
      ).rejects.toThrow('Invalid Ed25519 signature length');

      mockManager.callMPCContract = originalCallMPC;
    });
  });

  describe('Chain-Specific Edge Cases', () => {
    it('should handle missing transaction fields gracefully', async () => {
      const minimalTransaction = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f9B3e0'
        // Missing other fields
      };

      const result = await chainSignatureManager.requestSignature({
        requestId: 'minimal-tx-test',
        targetChain: ChainId.ETHEREUM,
        transaction: minimalTransaction,
        derivationPath: 'minimal-test',
        signatureScheme: 'secp256k1'
      });

      expect(result.signedTransaction).toEqual(expect.objectContaining({
        to: minimalTransaction.to,
        nonce: expect.any(Number),
        gasLimit: expect.any(Number),
        gasPrice: expect.any(Number)
      }));
    });

    it('should reject unsupported chains', async () => {
      await expect(
        chainSignatureManager.requestSignature({
          requestId: 'unsupported-test',
          targetChain: 'unsupported-chain' as ChainId,
          transaction: {},
          derivationPath: 'unsupported',
          signatureScheme: 'secp256k1'
        })
      ).rejects.toThrow('Unsupported chain for transaction serialization');
    });

    it('should maintain signature statistics correctly', async () => {
      const initialStats = chainSignatureManager.getStats();
      
      await chainSignatureManager.requestSignature({
        requestId: 'stats-test',
        targetChain: ChainId.ETHEREUM,
        transaction: { to: '0x742d35Cc6634C0532925a3b844Bc9e7595f9B3e0' },
        derivationPath: 'stats',
        signatureScheme: 'secp256k1'
      });

      const updatedStats = chainSignatureManager.getStats();
      
      expect(updatedStats.signaturesRequested).toBe(initialStats.signaturesRequested + 1);
      expect(updatedStats.signaturesCompleted).toBe(initialStats.signaturesCompleted + 1);
      expect(updatedStats.averageSigningTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent signature requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        requestId: `concurrent-${i}`,
        targetChain: ChainId.ETHEREUM,
        transaction: {
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f9B3e0',
          nonce: i
        },
        derivationPath: `concurrent-${i}`,
        signatureScheme: 'secp256k1' as const
      }));

      const results = await Promise.all(
        requests.map(req => chainSignatureManager.requestSignature(req))
      );

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.requestId).toBe(`concurrent-${index}`);
        expect(result.signature).toMatch(/^0x[a-fA-F0-9]+$/);
      });
    });

    it('should complete signatures within reasonable time', async () => {
      const startTime = Date.now();
      
      await chainSignatureManager.requestSignature({
        requestId: 'performance-test',
        targetChain: ChainId.ETHEREUM,
        transaction: { to: '0x742d35Cc6634C0532925a3b844Bc9e7595f9B3e0' },
        derivationPath: 'performance',
        signatureScheme: 'secp256k1'
      });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});