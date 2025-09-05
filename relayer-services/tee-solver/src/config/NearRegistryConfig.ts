/**
 * Configuration loader for Official NEAR Solver Registry Integration
 */

import { TEEConfig } from '../tee/ShadeAgentManager';

export function loadNearRegistryConfig(): TEEConfig {
  const config: TEEConfig = {
    teeMode: process.env.TEE_MODE === 'enabled',
    attestationEndpoint: process.env.TEE_ATTESTATION_ENDPOINT || 'https://phala-cloud-attestation.com/api/v1',
    shadeAgentContract: process.env.SHADE_AGENT_CONTRACT || 'shade-agent-verifier.testnet',
    expectedCodeHash: process.env.EXPECTED_CODE_HASH || 'sha256:default-hash',
    nearNetwork: (process.env.NEAR_NETWORK as 'testnet' | 'mainnet') || 'testnet',
    nearAccountId: process.env.NEXT_PUBLIC_accountId || 'tee-solver.testnet',
    nearSecretKey: process.env.NEXT_PUBLIC_secretKey || '',
    
    // Official NEAR registry configuration
    registryContractId: process.env.NEAR_REGISTRY_CONTRACT || 'solver-registry.testnet',
    intentsContractId: process.env.NEAR_INTENTS_CONTRACT || 'intents-vault.testnet',
    targetPoolId: process.env.NEAR_TARGET_POOL_ID ? parseInt(process.env.NEAR_TARGET_POOL_ID) : undefined
  };

  // Validate required fields
  if (!config.nearSecretKey) {
    throw new Error('NEXT_PUBLIC_secretKey is required for NEAR registry integration');
  }

  if (!config.expectedCodeHash || config.expectedCodeHash === 'sha256:default-hash') {
    throw new Error('EXPECTED_CODE_HASH must be set to your approved Docker image hash');
  }

  return config;
}

export function getRegistryContractAddresses(network: 'testnet' | 'mainnet') {
  if (network === 'mainnet') {
    return {
      registryContract: 'solver-registry.near',
      intentsContract: 'intents-vault.near'
    };
  } else {
    return {
      registryContract: 'solver-registry.testnet',
      intentsContract: 'intents-vault.testnet'
    };
  }
}