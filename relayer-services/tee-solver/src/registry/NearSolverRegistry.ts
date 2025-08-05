/**
 * NEAR Official Solver Registry Integration
 * 
 * Integrates with Near-One/tee-solver Registry for official TEE solver registration
 * and compliance with NEAR bounty requirements.
 */

import { connect, keyStores, Account, Contract as NearContract } from 'near-api-js';
import { logger } from '../utils/logger';

// Official contract interfaces from Near-One/tee-solver
export interface Worker {
  pool_id: number;
  checksum: string;
  codehash: string;
}

export interface SolverRegistryConfig {
  nearNetwork: 'testnet' | 'mainnet';
  nearAccountId: string;
  nearSecretKey: string;
  registryContractId: string;
  intentsContractId: string;
  approvedCodehash: string;
}

export interface RegistrationParams {
  pool_id: number;
  quote_hex: string;
  collateral: string;
  checksum: string;
  tcb_info: string;
}

export class NearSolverRegistry {
  private config: SolverRegistryConfig;
  private nearConnection: any;
  private nearAccount: Account | null = null;
  private registryContract: any;
  private isRegistered: boolean = false;

  constructor(config: SolverRegistryConfig) {
    this.config = config;
  }

  /**
   * Initialize connection to NEAR and solver registry
   */
  async initialize(): Promise<void> {
    logger.info('🔧 Initializing NEAR Solver Registry...', {
      network: this.config.nearNetwork,
      registry: this.config.registryContractId
    });

    try {
      // Initialize NEAR connection
      await this.initializeNearConnection();
      
      // Connect to registry contract
      await this.connectToRegistry();
      
      // Verify our codehash is approved
      await this.verifyCodehashApproval();
      
      logger.info('✅ NEAR Solver Registry initialized successfully');
      
    } catch (error) {
      logger.error('💥 Failed to initialize NEAR Solver Registry:', error);
      throw error;
    }
  }

  /**
   * Register this solver with the official NEAR registry
   */
  async registerSolver(params: RegistrationParams): Promise<boolean> {
    if (!this.nearAccount || !this.registryContract) {
      throw new Error('Registry not initialized');
    }

    logger.info('📝 Registering solver with NEAR registry...', {
      poolId: params.pool_id,
      codehash: this.config.approvedCodehash.substring(0, 16) + '...'
    });

    try {
      // Call the official register_worker method
      const result = await this.registryContract.register_worker(
        {
          pool_id: params.pool_id,
          quote_hex: params.quote_hex,
          collateral: params.collateral,
          checksum: params.checksum,
          tcb_info: params.tcb_info
        },
        {
          gas: '300000000000000', // 300 TGas
          attachedDeposit: '1' // 1 yoctoNEAR as required
        }
      );

      this.isRegistered = true;
      logger.info('✅ Solver registered successfully with NEAR registry', {
        transactionHash: result.transaction?.hash,
        poolId: params.pool_id
      });

      return true;

    } catch (error) {
      logger.error('💥 Solver registration failed:', error);
      throw error;
    }
  }

  /**
   * Check if solver is registered for a specific pool
   */
  async isWorkerRegistered(poolId: number): Promise<boolean> {
    if (!this.registryContract) {
      return false;
    }

    try {
      const worker = await this.registryContract.get_worker({
        account_id: this.config.nearAccountId
      });

      return worker && worker.pool_id === poolId;
      
    } catch (error) {
      logger.debug('Worker not found in registry:', error);
      return false;
    }
  }

  /**
   * Get available pools from the registry
   */
  async getAvailablePools(): Promise<any[]> {
    if (!this.registryContract) {
      throw new Error('Registry not initialized');
    }

    try {
      const pools = await this.registryContract.get_pools();
      
      logger.info(`📊 Found ${pools.length} available pools in registry`);
      return pools;
      
    } catch (error) {
      logger.error('💥 Failed to fetch pools:', error);
      throw error;
    }
  }

  /**
   * Initialize NEAR connection with proper configuration
   */
  private async initializeNearConnection(): Promise<void> {
    const keyStore = new keyStores.InMemoryKeyStore();
    
    if (this.config.nearSecretKey) {
      const keyPair = require('near-api-js').utils.KeyPair.fromString(this.config.nearSecretKey);
      await keyStore.setKey(this.config.nearNetwork, this.config.nearAccountId, keyPair);
    }

    const config = {
      networkId: this.config.nearNetwork,
      keyStore,
      nodeUrl: this.config.nearNetwork === 'mainnet' 
        ? 'https://rpc.mainnet.near.org' 
        : 'https://rpc.testnet.near.org',
      walletUrl: `https://wallet.${this.config.nearNetwork}.near.org`,
      helperUrl: `https://helper.${this.config.nearNetwork}.near.org`
    };

    this.nearConnection = await connect(config);
    this.nearAccount = await this.nearConnection.account(this.config.nearAccountId);
    
    // Verify account exists and has balance
    const accountState = await this.nearAccount.state();
    logger.info('💰 NEAR account state:', {
      balance: require('near-api-js').utils.format.formatNearAmount(accountState.amount),
      storage: accountState.storage_usage
    });
  }

  /**
   * Connect to the official solver registry contract
   */
  private async connectToRegistry(): Promise<void> {
    if (!this.nearAccount) {
      throw new Error('NEAR account not initialized');
    }

    this.registryContract = new NearContract(
      this.nearAccount,
      this.config.registryContractId,
      {
        // View methods (read-only)
        viewMethods: [
          'get_pools',
          'get_worker',
          'get_approved_codehashes',
          'is_codehash_approved'
        ],
        // Change methods (require gas and fees)
        changeMethods: [
          'register_worker',
          'unregister_worker'
        ]
      }
    );

    logger.info('🔗 Connected to solver registry contract:', this.config.registryContractId);
  }

  /**
   * Verify our Docker image codehash is approved by the registry
   */
  private async verifyCodehashApproval(): Promise<void> {
    if (!this.registryContract) {
      throw new Error('Registry contract not connected');
    }

    try {
      const isApproved = await this.registryContract.is_codehash_approved({
        codehash: this.config.approvedCodehash
      });

      if (!isApproved) {
        throw new Error(`Codehash ${this.config.approvedCodehash} is not approved by registry`);
      }

      logger.info('✅ Docker image codehash is approved by registry');
      
    } catch (error) {
      logger.error('💥 Codehash verification failed:', error);
      throw error;
    }
  }

  /**
   * Generate TEE attestation parameters for registration
   */
  async generateAttestationParams(poolId: number): Promise<RegistrationParams> {
    logger.info('🔐 Generating TEE attestation parameters...');

    // This would integrate with actual TEE attestation
    // For now, providing the structure needed
    return {
      pool_id: poolId,
      quote_hex: await this.generateTEEQuote(),
      collateral: await this.getTEECollateral(),
      checksum: this.config.approvedCodehash,
      tcb_info: await this.getTCBInfo()
    };
  }

  /**
   * Generate TEE quote (placeholder for actual TEE integration)
   */
  private async generateTEEQuote(): Promise<string> {
    // In production, this would call actual TEE attestation APIs
    const mockQuote = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(1024)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return mockQuote;
  }

  /**
   * Get TEE collateral data (placeholder for actual TEE integration)
   */
  private async getTEECollateral(): Promise<string> {
    // In production, this would fetch from Intel PCCS
    return JSON.stringify({
      tcbInfo: 'mock-tcb-info',
      certificates: ['cert1', 'cert2'],
      crlDistribution: 'mock-crl'
    });
  }

  /**
   * Get TCB (Trusted Computing Base) info
   */
  private async getTCBInfo(): Promise<string> {
    // In production, this would be actual TCB information
    return JSON.stringify({
      tcbLevel: 'upToDate',
      tcbDate: new Date().toISOString(),
      pceSvn: 13,
      pceId: 0
    });
  }

  /**
   * Get registration status
   */
  getRegistrationStatus(): {
    isInitialized: boolean;
    isRegistered: boolean;
    registryContract: string;
    nearAccount: string;
  } {
    return {
      isInitialized: !!this.nearAccount && !!this.registryContract,
      isRegistered: this.isRegistered,
      registryContract: this.config.registryContractId,
      nearAccount: this.config.nearAccountId
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up NEAR Solver Registry...');
    this.nearAccount = null;
    this.registryContract = null;
    this.isRegistered = false;
  }
}