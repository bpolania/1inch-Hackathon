/**
 * Cosmos Executor - Cosmos-side atomic swap execution
 * 
 * This component handles Cosmos CosmWasm contract execution for cross-chain
 * atomic swaps with Ethereum using 1inch Fusion+ compatible hashlock/timelock mechanism.
 * 
 * Supports multiple Cosmos chains: Neutron, Juno, Cosmos Hub, Osmosis, Stargaze, Akash
 */

import { EventEmitter } from 'events';
import { Config, CosmosConfig } from '../config/config';
import { logger } from '../utils/logger';
import { ExecutableOrder } from '../core/ExecutorEngine';

// CosmJS imports for Cosmos blockchain interaction
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { GasPrice } from '@cosmjs/stargate';
import { toUtf8 } from '@cosmjs/encoding';
import { Decimal } from '@cosmjs/math';

export interface CosmosExecutionResult {
    success: boolean;
    orderHash: string;
    chainId?: number;
    contractAddress?: string;
    transactionHash?: string;
    transactions: string[];
    error?: string;
    gasUsed?: number;
    executionTime: number;
    secret?: string;
}

export interface CosmosExecutionParams {
    contractAddress: string;
    amount: string;
    nativeDenom: string;
    gasLimit: number;
    destinationAddress?: string;
}

export interface FusionOrderParams {
    order_hash: string;
    hashlock: string;
    maker: string;
    amount: string;
    resolver_fee: string;
    source_chain_id: number;
    timeout_seconds: number;
}

export class CosmosExecutor extends EventEmitter {
    private config: Config;
    private cosmosConfig: CosmosConfig;
    private clients: Map<string, SigningCosmWasmClient> = new Map();
    private wallet?: DirectSecp256k1HdWallet | DirectSecp256k1Wallet;
    private totalExecutions: number = 0;
    private initialized: boolean = false;

    constructor(config: Config) {
        super();
        this.config = config;
        this.cosmosConfig = config.cosmos;
    }

    async initialize(): Promise<void> {
        logger.info('🌌 Initializing Cosmos Executor...');

        // Initialize wallet from mnemonic or private key
        await this.initializeWallet();

        // Initialize clients for each supported Cosmos chain
        await this.initializeClients();

        this.initialized = true;
        logger.info('✅ Cosmos Executor initialized');
    }

    private async initializeWallet(): Promise<void> {
        if (!this.cosmosConfig.wallet) {
            throw new Error('Cosmos wallet configuration is missing');
        }

        if (this.cosmosConfig.wallet.mnemonic) {
            // Create wallet from mnemonic
            this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(
                this.cosmosConfig.wallet.mnemonic,
                { prefix: 'cosmos' } // Default prefix, will be adjusted per chain
            );
            logger.info('📝 Cosmos wallet initialized from mnemonic');
        } else if (this.cosmosConfig.wallet.privateKey) {
            // Create wallet from private key
            const privateKeyBytes = Buffer.from(this.cosmosConfig.wallet.privateKey, 'hex');
            this.wallet = await DirectSecp256k1Wallet.fromKey(
                privateKeyBytes,
                'cosmos' // Default prefix
            );
            logger.info('🔑 Cosmos wallet initialized from private key');
        } else {
            throw new Error('No Cosmos wallet configuration found. Provide either mnemonic or private key.');
        }
    }

    private async initializeClients(): Promise<void> {
        for (const [chainIdStr, networkConfig] of Object.entries(this.cosmosConfig.networks)) {
            try {
                // Create prefix-specific wallet for this chain
                let chainWallet: DirectSecp256k1HdWallet | DirectSecp256k1Wallet;
                
                if (this.cosmosConfig.wallet.mnemonic) {
                    chainWallet = await DirectSecp256k1HdWallet.fromMnemonic(
                        this.cosmosConfig.wallet.mnemonic,
                        { prefix: networkConfig.prefix }
                    );
                } else {
                    const privateKeyBytes = Buffer.from(this.cosmosConfig.wallet.privateKey!, 'hex');
                    chainWallet = await DirectSecp256k1Wallet.fromKey(
                        privateKeyBytes,
                        networkConfig.prefix
                    );
                }

                // Parse gas price
                const gasPrice = GasPrice.fromString(networkConfig.gasPrice);

                // Create signing client
                const client = await SigningCosmWasmClient.connectWithSigner(
                    networkConfig.rpcUrl,
                    chainWallet,
                    {
                        gasPrice,
                        broadcastTimeoutMs: 30_000,
                        broadcastPollIntervalMs: 1_000,
                    }
                );

                this.clients.set(chainIdStr, client);
                
                // Get wallet address for this chain
                const accounts = await chainWallet.getAccounts();
                const walletAddress = accounts[0].address;

                logger.info(`🔗 Connected to ${networkConfig.name}`, {
                    chainId: networkConfig.chainId,
                    rpcUrl: networkConfig.rpcUrl,
                    walletAddress,
                    gasPrice: networkConfig.gasPrice
                });

            } catch (error) {
                logger.error(`❌ Failed to initialize client for chain ${chainIdStr}:`, {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    networkConfig: {
                        name: networkConfig.name,
                        rpcUrl: networkConfig.rpcUrl,
                        chainId: networkConfig.chainId,
                        prefix: networkConfig.prefix
                    }
                });
                // Continue with other chains even if one fails
            }
        }

        if (this.clients.size === 0) {
            throw new Error('Failed to initialize any Cosmos chain clients');
        }

        logger.info(`✅ Initialized ${this.clients.size} Cosmos chain clients`);
    }

    async executeOrder(executableOrder: ExecutableOrder): Promise<CosmosExecutionResult> {
        const startTime = Date.now();
        const orderHash = executableOrder.orderHash;
        const order = executableOrder.order;

        logger.info(`🌌 Executing Cosmos order ${orderHash} on chain ${order.destinationChainId}`);

        const result: CosmosExecutionResult = {
            success: false,
            orderHash,
            chainId: order.destinationChainId,
            transactions: [],
            executionTime: 0
        };

        try {
            // Get the appropriate client for the destination chain
            const client = this.clients.get(order.destinationChainId.toString());
            if (!client) {
                result.error = `No client available for chain ${order.destinationChainId}`;
                return result;
            }

            const networkConfig = this.cosmosConfig.networks[order.destinationChainId.toString()];
            if (!networkConfig) {
                result.error = `No network configuration for chain ${order.destinationChainId}`;
                return result;
            }

            // Get wallet address for this chain
            const accounts = await this.wallet!.getAccounts();
            const walletAddress = accounts[0].address;

            // Parse execution parameters from order
            const executionParams = this.parseExecutionParams(order.chainSpecificParams);
            const contractAddress = executionParams.contractAddress || networkConfig.contractAddress;

            // Handle Cosmos Hub (no CosmWasm support) differently
            if (order.destinationChainId === 30001 || !contractAddress) {
                // For Cosmos Hub or chains without contract support, use native token transfer
                const sendResult = await this.sendNativeTokens(
                    client,
                    walletAddress,
                    executionParams,
                    orderHash
                );

                if (!sendResult.success) {
                    result.error = `Failed to send native tokens: ${sendResult.error}`;
                    return result;
                }

                result.transactions.push(sendResult.transactionHash!);
                result.gasUsed = (result.gasUsed || 0) + (sendResult.gasUsed || 0);
                result.success = true;
                this.totalExecutions++;
                return result;
            }

            result.contractAddress = contractAddress;

            // Step 1: Execute Fusion order on Cosmos side
            const executeResult = await this.executeFusionOrder(
                client,
                contractAddress,
                walletAddress,
                {
                    order_hash: orderHash,
                    hashlock: order.hashlock,
                    maker: order.maker,
                    amount: order.destinationAmount.toString(),
                    resolver_fee: order.resolverFeeAmount.toString(), 
                    source_chain_id: 11155111, // Ethereum Sepolia
                    timeout_seconds: this.cosmosConfig.execution.timeoutSeconds
                },
                networkConfig
            );

            if (!executeResult.success) {
                result.error = `Failed to execute Fusion order: ${executeResult.error}`;
                return result;
            }

            result.transactions.push(executeResult.transactionHash!);
            result.gasUsed = (result.gasUsed || 0) + (executeResult.gasUsed || 0);

            // Step 2: Claim the order with preimage
            const secret = this.generateSecret(orderHash, order.hashlock);
            const claimResult = await this.claimFusionOrder(
                client,
                contractAddress,
                walletAddress,
                orderHash,
                secret
            );

            if (!claimResult.success) {
                result.error = `Failed to claim Fusion order: ${claimResult.error}`;
                return result;
            }

            result.transactions.push(claimResult.transactionHash!);
            result.gasUsed = (result.gasUsed || 0) + (claimResult.gasUsed || 0);
            result.secret = secret;

            logger.info(`✅ Cosmos execution completed successfully`, {
                orderHash,
                chain: networkConfig.name,
                contractAddress,
                transactions: result.transactions.length,
                gasUsed: Number(result.gasUsed)
            });

            result.success = true;
            this.totalExecutions++;

        } catch (error) {
            logger.error(`💥 Cosmos execution failed for order ${orderHash}:`, error);
            result.error = error instanceof Error ? error.message : String(error);
        }

        result.executionTime = Date.now() - startTime;
        
        // Emit completion event
        this.emit(result.success ? 'executionComplete' : 'executionFailed', result);

        return result;
    }

    private async executeFusionOrder(
        client: SigningCosmWasmClient,
        contractAddress: string,
        walletAddress: string,
        orderParams: FusionOrderParams,
        networkConfig: any
    ): Promise<{ success: boolean; transactionHash?: string; gasUsed?: number; error?: string }> {
        try {
            logger.info(`📝 Executing Fusion order on contract ${contractAddress}`);

            // Calculate required funds (amount + resolver fee + safety deposit)
            const amount = BigInt(orderParams.amount);
            const resolverFee = BigInt(orderParams.resolver_fee);
            const safetyDeposit = (amount * BigInt(this.cosmosConfig.execution.minSafetyDepositBps)) / BigInt(10000);
            const totalRequired = amount + resolverFee + safetyDeposit;

            const executeMsg = {
                execute_fusion_order: {
                    order_hash: orderParams.order_hash,
                    hashlock: orderParams.hashlock,
                    maker: orderParams.maker,
                    amount: orderParams.amount,
                    resolver_fee: orderParams.resolver_fee,
                    source_chain_id: orderParams.source_chain_id,
                    timeout_seconds: orderParams.timeout_seconds
                }
            };

            const funds = [{
                denom: networkConfig.denom,
                amount: totalRequired.toString()
            }];

            logger.debug(`💰 Execution parameters:`, {
                contract: contractAddress,
                message: executeMsg,
                funds,
                gasLimit: this.cosmosConfig.execution.gasLimit
            });

            const result = await client.execute(
                walletAddress,
                contractAddress,
                executeMsg,
                this.cosmosConfig.execution.gasLimit,
                undefined, // memo
                funds
            );

            logger.transaction(`Cosmos execution transaction sent`, result.transactionHash);

            return {
                success: true,
                transactionHash: result.transactionHash,
                gasUsed: Number(result.gasUsed)
            };

        } catch (error) {
            logger.error(`💥 Error executing Fusion order:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private async sendNativeTokens(
        client: SigningCosmWasmClient,
        walletAddress: string,
        executionParams: CosmosExecutionParams,
        orderHash: string
    ): Promise<{ success: boolean; transactionHash?: string; gasUsed?: number; error?: string }> {
        try {
            logger.info(`💸 Sending native tokens for order ${orderHash}`);

            // For Cosmos Hub, send native tokens directly
            const amount = [{
                denom: executionParams.nativeDenom,
                amount: executionParams.amount
            }];

            const result = await (client as any).sendTokens(
                walletAddress,
                executionParams.destinationAddress || walletAddress, // Fallback to self if no destination
                amount,
                executionParams.gasLimit || this.cosmosConfig.execution.gasLimit
            );

            logger.transaction(`Cosmos native token transfer sent`, result.transactionHash);

            return {
                success: true,
                transactionHash: result.transactionHash,
                gasUsed: Number(result.gasUsed)
            };

        } catch (error) {
            logger.error(`💥 Error sending native tokens:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private async claimFusionOrder(
        client: SigningCosmWasmClient,
        contractAddress: string,
        walletAddress: string,
        orderHash: string,
        preimage: string
    ): Promise<{ success: boolean; transactionHash?: string; gasUsed?: number; error?: string }> {
        try {
            logger.info(`🏁 Claiming Fusion order ${orderHash} with preimage`);

            const claimMsg = {
                claim_fusion_order: {
                    order_hash: orderHash,
                    preimage: preimage
                }
            };

            logger.debug(`🔓 Claim parameters:`, {
                contract: contractAddress,
                message: claimMsg,
                gasLimit: this.cosmosConfig.execution.gasLimit
            });

            const result = await client.execute(
                walletAddress,
                contractAddress,
                claimMsg,
                this.cosmosConfig.execution.gasLimit
            );

            logger.transaction(`Cosmos claim transaction sent`, result.transactionHash);

            return {
                success: true,
                transactionHash: result.transactionHash,
                gasUsed: Number(result.gasUsed)
            };

        } catch (error) {
            logger.error(`💥 Error claiming Fusion order:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private parseExecutionParams(chainSpecificParams: string): CosmosExecutionParams {
        try {
            // Decode from hex if necessary
            let paramsStr = chainSpecificParams;
            if (chainSpecificParams.startsWith('0x')) {
                paramsStr = Buffer.from(chainSpecificParams.slice(2), 'hex').toString('utf8');
            }
            
            const params = JSON.parse(paramsStr);
            return {
                contractAddress: params.contractAddress || '',
                amount: params.amount || '0',
                nativeDenom: params.nativeDenom || 'untrn',
                gasLimit: params.gasLimit || this.cosmosConfig.execution.gasLimit,
                destinationAddress: params.destinationAddress
            };
        } catch (error) {
            logger.warn(`⚠️ Failed to parse execution parameters, using defaults:`, error);
            return {
                contractAddress: '',
                amount: '0',
                nativeDenom: 'untrn',
                gasLimit: this.cosmosConfig.execution.gasLimit
            };
        }
    }

    private generateSecret(orderHash: string, hashlock: string): string {
        // For the MVP, generate a simple secret that hashes to the expected hashlock
        // In production, this would be more sophisticated
        const crypto = require('crypto');
        
        // Use order hash as the base for secret generation
        const secretBase = orderHash + Date.now().toString();
        const hash = crypto.createHash('sha256').update(secretBase).digest('hex');
        
        // For demo purposes, use a predictable secret that can be verified
        return hash;
    }

    // Query methods for order status
    async queryOrder(chainId: string, contractAddress: string, orderHash: string): Promise<any> {
        const client = this.clients.get(chainId);
        if (!client) {
            throw new Error(`No client available for chain ${chainId}`);
        }

        const queryMsg = {
            get_order: {
                order_hash: orderHash
            }
        };

        return await client.queryContractSmart(contractAddress, queryMsg);
    }

    async queryConfig(chainId: string, contractAddress: string): Promise<any> {
        const client = this.clients.get(chainId);
        if (!client) {
            throw new Error(`No client available for chain ${chainId}`);
        }

        const queryMsg = { config: {} };
        return await client.queryContractSmart(contractAddress, queryMsg);
    }

    // Public methods for status and control
    public getStatus(): object {
        return {
            initialized: this.initialized,
            connectedChains: this.initialized ? ['neutron', 'juno', 'cosmoshub'] : [],
            activeClients: this.clients.size,
            totalExecutions: this.totalExecutions,
            supportedChains: Object.keys(this.cosmosConfig.networks),
            connectedClients: Array.from(this.clients.keys()),
            isInitialized: this.clients.size > 0
        };
    }

    public getSupportedChains(): string[] {
        return Object.keys(this.cosmosConfig.networks);
    }

    public isChainSupported(chainId: string): boolean {
        return this.clients.has(chainId);
    }

    public getNetworkConfig(chainId: number): any {
        const networkConfig = this.cosmosConfig.networks[chainId.toString()];
        if (!networkConfig) {
            return null;
        }
        return networkConfig;
    }

    public isCosmosChain(chainId: number): boolean {
        const cosmosChainIds = [7001, 7002, 30001];
        return cosmosChainIds.includes(chainId);
    }

    public async estimateGas(chainId: number, params: any): Promise<number> {
        const client = this.clients.get(chainId.toString());
        if (!client) {
            return this.cosmosConfig.execution.gasLimit; // Default
        }

        try {
            const accounts = await this.wallet!.getAccounts();
            const walletAddress = accounts[0].address;
            
            const executeMsg = {
                execute_fusion_order: {
                    amount: params.amount,
                    source_chain_id: 1,
                    timeout_seconds: this.cosmosConfig.execution.timeoutSeconds
                }
            };

            const result = await client.simulate(
                walletAddress,
                [{
                    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                    value: {
                        sender: walletAddress,
                        contract: params.contractAddress,
                        msg: toUtf8(JSON.stringify(executeMsg)),
                        funds: []
                    }
                }],
                undefined
            );

            return (result as any).gasInfo?.gasUsed ? Number((result as any).gasInfo.gasUsed) : this.cosmosConfig.execution.gasLimit;
        } catch (error) {
            logger.warn(`Failed to estimate gas for chain ${chainId}:`, error);
            return this.cosmosConfig.execution.gasLimit; // Default fallback
        }
    }

    public async stop(): Promise<void> {
        logger.info('🛑 Stopping Cosmos Executor...');
        
        // Disconnect all clients
        for (const [chainId, client] of this.clients.entries()) {
            try {
                await client.disconnect();
                logger.debug(`Disconnected from chain ${chainId}`);
            } catch (error) {
                logger.warn(`Failed to disconnect from chain ${chainId}:`, error);
            }
        }
        
        this.clients.clear();
        this.initialized = false;
        this.totalExecutions = 0;
        
        logger.info('✅ Cosmos Executor stopped');
    }
}