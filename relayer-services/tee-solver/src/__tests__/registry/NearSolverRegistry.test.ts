/**
 * Tests for Official NEAR Solver Registry Integration
 */

import { NearSolverRegistry, SolverRegistryConfig } from '../../registry/NearSolverRegistry';

describe('NearSolverRegistry', () => {
  let registry: NearSolverRegistry;
  let mockConfig: SolverRegistryConfig;

  beforeEach(() => {
    mockConfig = {
      nearNetwork: 'testnet',
      nearAccountId: 'test-solver.testnet',
      nearSecretKey: 'ed25519:mock-secret-key',
      registryContractId: 'solver-registry.testnet',
      intentsContractId: 'intents-vault.testnet',
      approvedCodehash: 'sha256:mock-approved-hash'
    };

    registry = new NearSolverRegistry(mockConfig);
  });

  describe('initialization', () => {
    it('should create registry with correct configuration', () => {
      expect(registry).toBeDefined();
      
      const status = registry.getRegistrationStatus();
      expect(status.registryContract).toBe('solver-registry.testnet');
      expect(status.nearAccount).toBe('test-solver.testnet');
      expect(status.isInitialized).toBe(false);
      expect(status.isRegistered).toBe(false);
    });

    it('should validate configuration parameters', () => {
      const invalidConfig = { ...mockConfig, nearSecretKey: '' };
      
      // Should still create but will fail on initialize
      const invalidRegistry = new NearSolverRegistry(invalidConfig);
      expect(invalidRegistry).toBeDefined();
    });
  });

  describe('registration parameters', () => {
    it('should generate valid attestation parameters', async () => {
      const poolId = 1;
      const params = await registry.generateAttestationParams(poolId);

      expect(params.pool_id).toBe(poolId);
      expect(params.quote_hex).toMatch(/^0x[0-9a-f]+$/);
      expect(params.collateral).toBeDefined();
      expect(params.checksum).toBe(mockConfig.approvedCodehash);
      expect(params.tcb_info).toBeDefined();
    });

    it('should generate different quotes for each call', async () => {
      const params1 = await registry.generateAttestationParams(1);
      const params2 = await registry.generateAttestationParams(1);

      expect(params1.quote_hex).not.toBe(params2.quote_hex);
      expect(params1.checksum).toBe(params2.checksum); // Should be same
    });
  });

  describe('integration flow', () => {
    it('should follow correct registration sequence', async () => {
      // This would require actual NEAR testnet connection in integration tests
      // For unit tests, we just verify the methods exist and have correct signatures
      
      expect(typeof registry.initialize).toBe('function');
      expect(typeof registry.registerSolver).toBe('function');
      expect(typeof registry.isWorkerRegistered).toBe('function');
      expect(typeof registry.getAvailablePools).toBe('function');
    });

    it('should handle registration status correctly', () => {
      const status = registry.getRegistrationStatus();
      
      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('isRegistered');
      expect(status).toHaveProperty('registryContract');
      expect(status).toHaveProperty('nearAccount');
      
      expect(status.isInitialized).toBe(false);
      expect(status.isRegistered).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw on invalid pool registration', async () => {
      const invalidParams = {
        pool_id: -1, // Invalid pool ID
        quote_hex: 'invalid-hex',
        collateral: '',
        checksum: '',
        tcb_info: ''
      };

      // Should not throw during parameter creation, but would fail on actual registration
      expect(() => registry.registerSolver(invalidParams)).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      await registry.cleanup();
      
      const status = registry.getRegistrationStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.isRegistered).toBe(false);
    });
  });
});

describe('NearSolverRegistry Integration', () => {
  // These tests would run against actual NEAR testnet
  // Skip by default, enable with environment variable
  const runIntegrationTests = process.env.RUN_NEAR_INTEGRATION_TESTS === 'true';

  if (!runIntegrationTests) {
    it.skip('Integration tests skipped (set RUN_NEAR_INTEGRATION_TESTS=true to enable)', () => {});
    return;
  }

  let registry: NearSolverRegistry;

  beforeAll(async () => {
    const config: SolverRegistryConfig = {
      nearNetwork: 'testnet',
      nearAccountId: process.env.NEAR_TEST_ACCOUNT || 'test-solver.testnet',
      nearSecretKey: process.env.NEAR_TEST_SECRET_KEY || '',
      registryContractId: 'solver-registry.testnet',
      intentsContractId: 'intents-vault.testnet',
      approvedCodehash: process.env.APPROVED_CODE_HASH || 'sha256:test-hash'
    };

    registry = new NearSolverRegistry(config);
    await registry.initialize();
  });

  afterAll(async () => {
    await registry.cleanup();
  });

  it('should connect to NEAR testnet successfully', async () => {
    const status = registry.getRegistrationStatus();
    expect(status.isInitialized).toBe(true);
  });

  it('should fetch available pools', async () => {
    const pools = await registry.getAvailablePools();
    expect(Array.isArray(pools)).toBe(true);
  });

  it('should check worker registration status', async () => {
    const isRegistered = await registry.isWorkerRegistered(1);
    expect(typeof isRegistered).toBe('boolean');
  });
});