/**
 * Configuration Management
 * 
 * Loads and validates configuration for the automated relayer service.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
    bitcoin: {
        privateKey?: string;
        network: string;
        addressType: string;
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

export interface BitcoinConfig {
    network: string;
    feeRate: number;
    htlcTimelock: number;
    dustThreshold: number;
    minConfirmations: number;
    privateKey?: string;
    apiUrl?: string;
}

export interface CosmosConfig {
    networks: {
        [chainId: string]: {
            name: string;
            rpcUrl: string;
            chainId: string;
            denom: string;
            prefix: string;
            gasPrice: string;
            contractAddress?: string;
        };
    };
    wallet: {
        mnemonic?: string;
        privateKey?: string;
    };
    execution: {
        gasLimit: number;
        timeoutSeconds: number;
        minSafetyDepositBps: number;
    };
}

export interface Config {
    networks: string[];
    ethereum: NetworkConfig;
    near: NetworkConfig;
    bitcoin: BitcoinConfig;
    cosmos: CosmosConfig;
    wallet: WalletConfig;
    execution: ExecutionConfig;
    logging: {
        level: string;
        format: string;
    };
    dataDir?: string;
}

export async function loadConfig(): Promise<Config> {
    // Validate required environment variables
    const requiredEnvVars = [
        'ETHEREUM_PRIVATE_KEY',
        'NEAR_ACCOUNT_ID',
        'NEAR_PRIVATE_KEY'
    ];

    // Add Bitcoin private key requirement if Bitcoin automation is enabled
    if (process.env.ENABLE_BITCOIN_AUTOMATION === 'true') {
        requiredEnvVars.push('BITCOIN_PRIVATE_KEY');
    }

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Required environment variable ${envVar} is not set`);
        }
    }

    const config: Config = {
        networks: ['ethereum', 'near', 'bitcoin', 'cosmos'],
        
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

        bitcoin: {
            network: process.env.BITCOIN_NETWORK || 'testnet',
            feeRate: parseInt(process.env.BITCOIN_FEE_RATE || '10'), // sat/byte
            htlcTimelock: parseInt(process.env.BITCOIN_HTLC_TIMELOCK || '144'), // blocks
            dustThreshold: parseInt(process.env.BITCOIN_DUST_THRESHOLD || '546'), // satoshis
            minConfirmations: parseInt(process.env.BITCOIN_MIN_CONFIRMATIONS || '1'),
            privateKey: process.env.BITCOIN_PRIVATE_KEY, // Optional: for real transaction execution
            apiUrl: process.env.BITCOIN_API_URL // Optional: custom API endpoint
        },

        cosmos: {
            networks: {
                '7001': { // Neutron Testnet
                    name: 'Neutron Testnet',
                    rpcUrl: process.env.NEUTRON_RPC_URL || 'https://neutron-testnet-rpc.polkachu.com:443',
                    chainId: 'pion-1',
                    denom: 'untrn',
                    prefix: 'neutron',
                    gasPrice: process.env.NEUTRON_GAS_PRICE || '0.025untrn',
                    contractAddress: process.env.NEUTRON_CONTRACT_ADDRESS
                },
                '7002': { // Juno Testnet
                    name: 'Juno Testnet',
                    rpcUrl: process.env.JUNO_RPC_URL || 'https://juno-testnet-rpc.polkachu.com:443',
                    chainId: 'uni-7',
                    denom: 'ujunox',
                    prefix: 'juno',
                    gasPrice: process.env.JUNO_GAS_PRICE || '0.025ujunox',
                    contractAddress: process.env.JUNO_CONTRACT_ADDRESS
                },
                '30001': { // Cosmos Hub Mainnet
                    name: 'Cosmos Hub',
                    rpcUrl: process.env.COSMOS_RPC_URL || 'https://cosmos-rpc.polkachu.com:443',
                    chainId: 'cosmoshub-4',
                    denom: 'uatom',
                    prefix: 'cosmos',
                    gasPrice: process.env.COSMOS_GAS_PRICE || '0.025uatom',
                    contractAddress: process.env.COSMOS_CONTRACT_ADDRESS
                }
            },
            wallet: {
                mnemonic: process.env.COSMOS_MNEMONIC,
                privateKey: process.env.COSMOS_PRIVATE_KEY
            },
            execution: {
                gasLimit: parseInt(process.env.COSMOS_GAS_LIMIT || '300000'),
                timeoutSeconds: parseInt(process.env.COSMOS_TIMEOUT_SECONDS || '3600'), // 1 hour
                minSafetyDepositBps: parseInt(process.env.COSMOS_MIN_SAFETY_DEPOSIT_BPS || '500') // 5%
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
            },
            bitcoin: {
                privateKey: process.env.BITCOIN_PRIVATE_KEY, // Optional - can be generated
                network: process.env.BITCOIN_NETWORK || 'testnet',
                addressType: process.env.BITCOIN_ADDRESS_TYPE || 'p2pkh' // p2pkh, p2sh, p2wpkh
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
        },

        dataDir: process.env.DATA_DIR || './data'
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