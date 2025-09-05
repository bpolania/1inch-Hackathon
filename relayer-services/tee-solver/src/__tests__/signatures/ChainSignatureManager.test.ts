/**
 * Chain Signature Manager Tests
 * 
 * Unit tests for NEAR MPC integration and multi-chain transaction signing
 */

import { ChainSignatureManager, ChainId, SignatureRequest } from '../../signatures/ChainSignatureManager';
import { logger } from '../../utils/logger';

// Mock NEAR API
jest.mock('near-api-js', () => ({
  connect: jest.fn(),
  keyStores: {
    InMemoryKeyStore: jest.fn().mockImplementation(() => ({
      setKey: jest.fn()
    }))
  },
  utils: {
    KeyPair: {
      fromString: jest.fn().mockReturnValue({ publicKey: 'mock-public-key' })
    },
    format: {
      parseNearAmount: jest.fn((amount) => `${amount}000000000000000000000000`)
    }
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('ChainSignatureManager', () => {
  let chainSignatureManager: ChainSignatureManager;
  let mockNearConnection: any;
  let mockNearAccount: any;

  const mockConfig = {
    nearNetwork: 'testnet' as const,
    nearAccountId: 'test-solver.testnet',
    nearPrivateKey: 'ed25519:mock-private-key',
    mpcContractId: 'v1.signer-dev',
    derivationPath: 'test-solver',
    supportedChains: [ChainId.ETHEREUM, ChainId.POLYGON, ChainId.BSC]
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock NEAR connection and account
    mockNearAccount = {
      viewFunction: jest.fn(),
      functionCall: jest.fn()
    };

    mockNearConnection = {
      account: jest.fn().mockResolvedValue(mockNearAccount)
    };

    const { connect } = require('near-api-js');
    connect.mockResolvedValue(mockNearConnection);

    chainSignatureManager = new ChainSignatureManager(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      // Mock MPC contract verification
      mockNearAccount.viewFunction.mockResolvedValue('mock-public-key');

      await chainSignatureManager.initialize();

      expect(mockNearConnection.account).toHaveBeenCalledWith('test-solver.testnet');
      expect(mockNearAccount.viewFunction).toHaveBeenCalledWith({
        contractId: 'v1.signer-dev',
        methodName: 'public_key',
        args: {}
      });
      expect(logger.info).toHaveBeenCalledWith(' Chain Signature Manager initialized', expect.any(Object));
    });

    it('should throw error if MPC contract verification fails', async () => {
      mockNearAccount.viewFunction.mockRejectedValue(new Error('Contract not found'));

      await expect(chainSignatureManager.initialize()).rejects.toThrow('MPC contract verification failed');
      expect(logger.error).toHaveBeenCalledWith(' Failed to verify MPC contract:', expect.any(Error));
    });

    it('should handle NEAR connection failure', async () => {
      const { connect } = require('near-api-js');
      connect.mockRejectedValue(new Error('NEAR connection failed'));

      await expect(chainSignatureManager.initialize()).rejects.toThrow('NEAR connection failed');
      expect(logger.error).toHaveBeenCalledWith(' Failed to initialize Chain Signature Manager:', expect.any(Error));
    });
  });

  describe('signature requests', () => {
    beforeEach(async () => {
      mockNearAccount.viewFunction.mockResolvedValue('mock-public-key');
      await chainSignatureManager.initialize();
    });

    it('should request signature successfully for Ethereum', async () => {
      const mockSignatureResult = Buffer.from('mock-signature-data', 'hex');
      mockNearAccount.functionCall.mockResolvedValue(mockSignatureResult);

      const request: SignatureRequest = {
        requestId: 'test-request-1',
        targetChain: ChainId.ETHEREUM,
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          value: '1000000000000000000',
          data: '0x',
          gasLimit: '21000',
          gasPrice: '20000000000',
          nonce: 1,
          chainId: 1
        },
        derivationPath: 'test-solver',
        signatureScheme: 'secp256k1'
      };

      const response = await chainSignatureManager.requestSignature(request);

      expect(response).toEqual({
        requestId: 'test-request-1',
        signature: expect.stringMatching(/^0x/),
        recoveryId: 0,
        signedTransaction: expect.objectContaining({
          to: '0x1234567890123456789012345678901234567890',
          signature: expect.stringMatching(/^0x/)
        }),
        targetChain: ChainId.ETHEREUM
      });

      expect(mockNearAccount.functionCall).toHaveBeenCalledWith({
        contractId: 'v1.signer-dev',
        methodName: 'sign',
        args: {
          payload: expect.any(Array),
          path: 'test-solver',
          key_version: 0
        },
        gas: BigInt('300000000000000'),
        attachedDeposit: BigInt('10000000000000000000000')
      });
    });

    it('should handle signature request for multiple chains', async () => {
      const mockSignatureResult = Buffer.from('mock-signature-data', 'hex');
      mockNearAccount.functionCall.mockResolvedValue(mockSignatureResult);

      const chains = [ChainId.ETHEREUM, ChainId.POLYGON, ChainId.BSC];
      const requests = chains.map((chain, index) => ({
        requestId: `test-request-${index + 1}`,
        targetChain: chain,
        transaction: { mockTransaction: true },
        derivationPath: 'test-solver',
        signatureScheme: 'secp256k1' as const
      }));

      const responses = await Promise.all(
        requests.map(request => chainSignatureManager.requestSignature(request))
      );

      expect(responses).toHaveLength(3);
      responses.forEach((response, index) => {
        expect(response.requestId).toBe(`test-request-${index + 1}`);
        expect(response.targetChain).toBe(chains[index]);
        expect(response.signature).toMatch(/^0x/);
      });
    });

    it('should handle unsupported chain', async () => {
      const request: SignatureRequest = {
        requestId: 'test-unsupported',
        targetChain: 'unsupported-chain' as ChainId,
        transaction: {},
        derivationPath: 'test-solver',
        signatureScheme: 'secp256k1'
      };

      await expect(chainSignatureManager.requestSignature(request)).rejects.toThrow('Unsupported chain');
    });

    it('should handle MPC contract call failure', async () => {
      mockNearAccount.functionCall.mockRejectedValue(new Error('MPC call failed'));

      const request: SignatureRequest = {
        requestId: 'test-failure',
        targetChain: ChainId.ETHEREUM,
        transaction: {},
        derivationPath: 'test-solver',
        signatureScheme: 'secp256k1'
      };

      await expect(chainSignatureManager.requestSignature(request)).rejects.toThrow('MPC call failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Chain Signature failed'), expect.any(Error));
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new ChainSignatureManager(mockConfig);

      const request: SignatureRequest = {
        requestId: 'test-uninitialized',
        targetChain: ChainId.ETHEREUM,
        transaction: {},
        derivationPath: 'test-solver',
        signatureScheme: 'secp256k1'
      };

      await expect(uninitializedManager.requestSignature(request)).rejects.toThrow('ChainSignatureManager not initialized');
    });
  });

  describe('address derivation', () => {
    beforeEach(async () => {
      mockNearAccount.viewFunction.mockResolvedValue('mock-public-key');
      await chainSignatureManager.initialize();
    });

    it('should derive address for supported chains', async () => {
      const address = await chainSignatureManager.deriveAddress(ChainId.ETHEREUM);
      
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(logger.info).toHaveBeenCalledWith(' Deriving address for ethereum', { path: 'test-solver' });
      expect(logger.info).toHaveBeenCalledWith(` Derived address for ${ChainId.ETHEREUM}: ${address}`);
    });

    it('should derive different addresses for different chains', async () => {
      const ethAddress = await chainSignatureManager.deriveAddress(ChainId.ETHEREUM);
      const polygonAddress = await chainSignatureManager.deriveAddress(ChainId.POLYGON);
      
      expect(ethAddress).not.toBe(polygonAddress);
      expect(ethAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(polygonAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should use custom derivation path', async () => {
      const customPath = 'custom-solver-path';
      const address = await chainSignatureManager.deriveAddress(ChainId.ETHEREUM, customPath);
      
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new ChainSignatureManager(mockConfig);

      await expect(uninitializedManager.deriveAddress(ChainId.ETHEREUM)).rejects.toThrow('ChainSignatureManager not initialized');
    });
  });

  describe('statistics and monitoring', () => {
    beforeEach(async () => {
      mockNearAccount.viewFunction.mockResolvedValue('mock-public-key');
      await chainSignatureManager.initialize();
    });

    it('should track signature statistics', async () => {
      mockNearAccount.functionCall.mockResolvedValue(Buffer.from('mock-signature', 'hex'));

      const request: SignatureRequest = {
        requestId: 'stats-test',
        targetChain: ChainId.ETHEREUM,
        transaction: {},
        derivationPath: 'test-solver',
        signatureScheme: 'secp256k1'
      };

      const startTime = Date.now();
      await chainSignatureManager.requestSignature(request);
      const endTime = Date.now();

      const stats = chainSignatureManager.getStats();
      expect(stats.signaturesRequested).toBe(1);
      expect(stats.signaturesCompleted).toBe(1);
      expect(stats.signaturesFailed).toBe(0);
      expect(stats.successRate).toBe(100);
      expect(stats.averageSigningTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageSigningTime).toBeLessThanOrEqual(endTime - startTime + 10);
    });

    it('should track failure statistics', async () => {
      mockNearAccount.functionCall.mockRejectedValue(new Error('Signature failed'));

      const request: SignatureRequest = {
        requestId: 'failure-stats-test',
        targetChain: ChainId.ETHEREUM,
        transaction: {},
        derivationPath: 'test-solver',
        signatureScheme: 'secp256k1'
      };

      await expect(chainSignatureManager.requestSignature(request)).rejects.toThrow();

      const stats = chainSignatureManager.getStats();
      expect(stats.signaturesRequested).toBe(1);
      expect(stats.signaturesCompleted).toBe(0);
      expect(stats.signaturesFailed).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it('should return supported chains configuration', () => {
      const supportedChains = chainSignatureManager.getSupportedChains();
      
      expect(supportedChains).toHaveLength(3);
      expect(supportedChains[0]).toEqual({
        chainId: ChainId.ETHEREUM,
        signatureScheme: 'secp256k1',
        chainName: 'Ethereum',
        domainId: 0
      });
    });

    it('should emit events for signature completion', async () => {
      mockNearAccount.functionCall.mockResolvedValue(Buffer.from('mock-signature', 'hex'));

      const eventSpy = jest.fn();
      chainSignatureManager.on('signature_completed', eventSpy);

      const request: SignatureRequest = {
        requestId: 'event-test',
        targetChain: ChainId.ETHEREUM,
        transaction: {},
        derivationPath: 'test-solver',
        signatureScheme: 'secp256k1'
      };

      await chainSignatureManager.requestSignature(request);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        requestId: 'event-test',
        targetChain: ChainId.ETHEREUM
      }));
    });
  });

  describe('cleanup', () => {
    it('should stop successfully', async () => {
      mockNearAccount.viewFunction.mockResolvedValue('mock-public-key');
      await chainSignatureManager.initialize();

      await chainSignatureManager.stop();

      expect(chainSignatureManager.getStats().isInitialized).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(' Chain Signature Manager stopped');
    });
  });
});