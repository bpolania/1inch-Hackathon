/**
 * Wallet Manager - Multi-Chain Wallet Integration
 * 
 * Manages private keys and wallet connections for both Ethereum and NEAR.
 * Handles the wallet functionality that was manually done in our scripts.
 */

import { ethers } from 'ethers';
import { Config } from '../config/config';
import { logger } from '../utils/logger';

export class WalletManager {
    private config: Config;
    private ethereumProvider!: ethers.Provider;
    private ethereumSigner!: ethers.Signer;
    private ethereumWallet!: ethers.Wallet;
    private nearAccount: any; // NEAR account object
    private isInitialized: boolean = false;

    constructor(config: Config) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        logger.info(' Initializing Wallet Manager...');

        // Initialize Ethereum wallet
        await this.initializeEthereumWallet();

        // Initialize NEAR wallet
        await this.initializeNearWallet();

        this.isInitialized = true;
        logger.info(' Wallet Manager initialized');

        // Log wallet info
        const ethBalance = await this.getEthereumBalance();
        const nearBalance = await this.getNearBalance();

        logger.info(' Wallet Status:', {
            ethereum: {
                address: this.config.wallet.ethereum.address,
                balance: `${ethers.formatEther(ethBalance)} ETH`,
                network: this.config.ethereum.name
            },
            near: {
                accountId: this.config.wallet.near.accountId,
                balance: `${nearBalance} NEAR`,
                network: this.config.near.name
            }
        });
    }

    private async initializeEthereumWallet(): Promise<void> {
        try {
            // Create provider
            this.ethereumProvider = new ethers.JsonRpcProvider(this.config.ethereum.rpcUrl);

            // Create wallet from private key
            this.ethereumWallet = new ethers.Wallet(
                this.config.wallet.ethereum.privateKey,
                this.ethereumProvider
            );

            this.ethereumSigner = this.ethereumWallet;

            // Verify connection
            const network = await this.ethereumProvider.getNetwork();
            if (Number(network.chainId) !== this.config.ethereum.chainId) {
                throw new Error(`Chain ID mismatch. Expected ${this.config.ethereum.chainId}, got ${network.chainId}`);
            }

            logger.info(` Connected to Ethereum: ${this.config.ethereum.name} (Chain ID: ${network.chainId})`);

        } catch (error) {
            logger.error(' Failed to initialize Ethereum wallet:', error);
            throw error;
        }
    }

    private async initializeNearWallet(): Promise<void> {
        try {
            // For now, we'll simulate NEAR wallet initialization
            // In a production implementation, this would use near-api-js
            
            logger.info(` NEAR wallet configured for ${this.config.wallet.near.accountId}`);
            
            // Mock NEAR account object
            this.nearAccount = {
                accountId: this.config.wallet.near.accountId,
                networkId: this.config.wallet.near.networkId,
                // In real implementation, this would have actual NEAR API methods
            };

        } catch (error) {
            logger.error(' Failed to initialize NEAR wallet:', error);
            throw error;
        }
    }

    // Ethereum wallet methods
    public getEthereumProvider(): ethers.Provider {
        this.ensureInitialized();
        return this.ethereumProvider;
    }

    public getEthereumSigner(): ethers.Signer {
        this.ensureInitialized();
        return this.ethereumSigner;
    }

    public getEthereumWallet(): ethers.Wallet {
        this.ensureInitialized();
        return this.ethereumWallet;
    }

    public async getEthereumBalance(): Promise<bigint> {
        this.ensureInitialized();
        return await this.ethereumProvider.getBalance(this.config.wallet.ethereum.address);
    }

    // NEAR wallet methods
    public getNearAccount(): any {
        this.ensureInitialized();
        return this.nearAccount;
    }

    public async getNearBalance(): Promise<string> {
        this.ensureInitialized();
        // In real implementation, this would query actual NEAR balance
        return "7.96"; // Mock balance
    }

    // Utility methods
    public async checkBalances(): Promise<{
        ethereum: { balance: string; sufficient: boolean };
        near: { balance: string; sufficient: boolean };
    }> {
        const ethBalance = await this.getEthereumBalance();
        const nearBalance = await this.getNearBalance();

        // Define minimum required balances
        const minEthBalance = ethers.parseEther("0.01"); // 0.01 ETH for gas
        const minNearBalance = 0.1; // 0.1 NEAR for operations

        return {
            ethereum: {
                balance: ethers.formatEther(ethBalance),
                sufficient: ethBalance >= minEthBalance
            },
            near: {
                balance: nearBalance,
                sufficient: parseFloat(nearBalance) >= minNearBalance
            }
        };
    }

    public async estimateGasCosts(operations: string[]): Promise<{
        ethereum: bigint;
        near: string;
        total: string;
    }> {
        // Estimate gas costs for typical operations
        const ethGasPrice = (await this.ethereumProvider.getFeeData()).gasPrice || 0n;
        
        // Typical gas usage for our operations
        const gasEstimates = {
            matchOrder: 500000n,     // Match fusion order (deploys escrows)
            completeOrder: 100000n,  // Complete order with secret
            tokenTransfer: 50000n    // ERC20 transfer
        };

        let totalEthGas = 0n;
        for (const op of operations) {
            if (gasEstimates[op as keyof typeof gasEstimates]) {
                totalEthGas += gasEstimates[op as keyof typeof gasEstimates];
            }
        }

        const ethGasCost = totalEthGas * ethGasPrice;
        const nearGasCost = "0.01"; // Estimated NEAR gas cost

        return {
            ethereum: ethGasCost,
            near: nearGasCost,
            total: `${ethers.formatEther(ethGasCost)} ETH + ${nearGasCost} NEAR`
        };
    }

    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('WalletManager not initialized. Call initialize() first.');
        }
    }

    // Status and monitoring
    public getStatus(): object {
        return {
            isInitialized: this.isInitialized,
            ethereum: {
                address: this.config.wallet.ethereum.address,
                network: this.config.ethereum.name,
                chainId: this.config.ethereum.chainId
            },
            near: {
                accountId: this.config.wallet.near.accountId,
                networkId: this.config.wallet.near.networkId
            }
        };
    }

    public async getDetailedStatus(): Promise<object> {
        if (!this.isInitialized) {
            return this.getStatus();
        }

        const balances = await this.checkBalances();
        
        return {
            ...this.getStatus(),
            balances,
            readyForExecution: balances.ethereum.sufficient && balances.near.sufficient
        };
    }
}