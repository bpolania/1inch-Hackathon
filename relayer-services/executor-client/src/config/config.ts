/**
 * Configuration Management
 * 
 * Loads and validates configuration for the automated relayer service.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface NetworkConfig {
    name: string;
    rpcUrl: string;
    chainId: number;
    contracts: {
        factory?: string;
        registry?: string;
        token?: string;
    };
}

export interface WalletConfig {
    ethereum: {
        privateKey: string;
        address: string;
    };
    near: {
        accountId: string;
        privateKey: string;
        networkId: string;
    };
}

export interface ExecutionConfig {
    loopInterval: number; // milliseconds
    maxConcurrentExecutions: number;
    minProfitThreshold: string; // in ETH
    maxGasPrice: string; // in gwei
    retryAttempts: number;
    retryDelay: number; // milliseconds
}

export interface Config {
    networks: string[];
    ethereum: NetworkConfig;
    near: NetworkConfig;
    wallet: WalletConfig;
    execution: ExecutionConfig;
    logging: {
        level: string;
        format: string;
    };
}

export async function loadConfig(): Promise<Config> {
    // Validate required environment variables
    const requiredEnvVars = [
        'ETHEREUM_PRIVATE_KEY',
        'NEAR_ACCOUNT_ID',
        'NEAR_PRIVATE_KEY'
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Required environment variable ${envVar} is not set`);
        }
    }

    const config: Config = {
        networks: ['ethereum', 'near'],
        
        ethereum: {
            name: 'Ethereum Sepolia',
            rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
            chainId: 11155111,
            contracts: {
                factory: process.env.ETHEREUM_FACTORY_ADDRESS || '0x2E053bA098E2DB09C7F61A2854063BB2161b7b0a',
                registry: process.env.ETHEREUM_REGISTRY_ADDRESS || '0x59CE43Ea20892EC3Eff00fc7506cbfA9813FE0ca',
                token: process.env.ETHEREUM_TOKEN_ADDRESS || '0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43'
            }
        },

        near: {
            name: 'NEAR Testnet',
            rpcUrl: process.env.NEAR_RPC_URL || 'https://rpc.testnet.near.org',
            chainId: 40002,
            contracts: {
                factory: process.env.NEAR_CONTRACT_ID || 'fusion-plus.demo.cuteharbor3573.testnet'
            }
        },

        wallet: {
            ethereum: {
                privateKey: process.env.ETHEREUM_PRIVATE_KEY!,
                address: '' // Will be derived from private key
            },
            near: {
                accountId: process.env.NEAR_ACCOUNT_ID!,
                privateKey: process.env.NEAR_PRIVATE_KEY!,
                networkId: process.env.NEAR_NETWORK_ID || 'testnet'
            }
        },

        execution: {
            loopInterval: parseInt(process.env.EXECUTION_LOOP_INTERVAL || '10000'), // 10 seconds
            maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '3'),
            minProfitThreshold: process.env.MIN_PROFIT_THRESHOLD || '0.001', // 0.001 ETH minimum profit
            maxGasPrice: process.env.MAX_GAS_PRICE || '50', // 50 gwei max
            retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
            retryDelay: parseInt(process.env.RETRY_DELAY || '5000') // 5 seconds
        },

        logging: {
            level: process.env.LOG_LEVEL || 'info',
            format: process.env.LOG_FORMAT || 'json'
        }
    };

    // Derive Ethereum address from private key
    try {
        const wallet = new (await import('ethers')).ethers.Wallet(config.wallet.ethereum.privateKey);
        config.wallet.ethereum.address = wallet.address;
    } catch (error) {
        throw new Error(`Invalid Ethereum private key: ${error}`);
    }

    return config;
}

export function validateConfig(config: Config): void {
    // Additional validation logic
    if (!config.ethereum.contracts.factory) {
        throw new Error('Ethereum factory contract address is required');
    }

    if (!config.near.contracts.factory) {
        throw new Error('NEAR contract ID is required');
    }

    if (parseFloat(config.execution.minProfitThreshold) <= 0) {
        throw new Error('Minimum profit threshold must be positive');
    }

    if (config.execution.maxConcurrentExecutions <= 0) {
        throw new Error('Max concurrent executions must be positive');
    }
}