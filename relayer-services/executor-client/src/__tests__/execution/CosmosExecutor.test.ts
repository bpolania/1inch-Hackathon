/**
 * CosmosExecutor Tests
 * 
 * Tests for Cosmos blockchain atomic swap execution functionality.
 */

import { CosmosExecutor } from '../../execution/CosmosExecutor';
import { loadConfig } from '../../config/config';
import { ExecutableOrder } from '../../core/ExecutorEngine';
import { ethers } from 'ethers';

// Mock CosmJS dependencies
jest.mock('@cosmjs/cosmwasm-stargate', () => ({
    SigningCosmWasmClient: {
        connectWithSigner: jest.fn()
    }
}));

jest.mock('@cosmjs/proto-signing', () => ({
    DirectSecp256k1HdWallet: {
        fromMnemonic: jest.fn()
    },
    DirectSecp256k1Wallet: {
        fromKey: jest.fn()
    }
}));

describe('CosmosExecutor', () => {
    let executor: CosmosExecutor;
    let config: any;
    let mockCosmosClient: any;
    let mockWallet: any;
    let mockExecutableOrder: ExecutableOrder;

    beforeEach(async () => {
        config = await loadConfig();
        
        // Mock CosmJS wallet
        mockWallet = {
            getAccounts: jest.fn().mockResolvedValue([{
                address: 'neutron1test123456789',
                algo: 'secp256k1',
                pubkey: new Uint8Array(33)
            }])
        };

        // Mock CosmJS client
        mockCosmosClient = {
            execute: jest.fn(),
            queryContractSmart: jest.fn(),
            getAccount: jest.fn(),
            getBalance: jest.fn(),
            simulate: jest.fn(),
            sendTokens: jest.fn(),
            disconnect: jest.fn()
        };

        // Mock CosmJS static methods
        const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
        DirectSecp256k1HdWallet.fromMnemonic.mockResolvedValue(mockWallet);

        const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
        SigningCosmWasmClient.connectWithSigner.mockResolvedValue(mockCosmosClient);

        executor = new CosmosExecutor(config);

        mockExecutableOrder = {
            orderHash: '0x3b4f18bfbf216fb4454bae8361e24a8daefa37b540dd72ba993d5f37f8c000f5',
            order: {
                maker: '0x2345678901234567890123456789012345678901',
                sourceAmount: ethers.parseEther('0.3'),
                destinationChainId: 7001, // Neutron
                resolverFeeAmount: ethers.parseEther('0.03'),
                expiryTime: Math.floor(Date.now() / 1000) + 3600
            },
            profitability: {
                estimatedProfit: ethers.parseEther('0.02'),
                gasEstimate: BigInt('300000'),
                safetyDeposit: ethers.parseEther('0.015'),
                isProfitable: true
            },
            priority: 7,
            chainSpecificParams: JSON.stringify({
                contractAddress: 'neutron1contract123456789',
                amount: '300000000',
                denom: 'untrn'
            })
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully with mnemonic', async () => {
            await expect(executor.initialize()).resolves.not.toThrow();
            
            const status = executor.getStatus();
            expect(status).toMatchObject({
                initialized: true,
                connectedChains: expect.arrayContaining(['neutron', 'juno', 'cosmoshub'])
            });
        });

        it('should validate Cosmos configuration', async () => {
            await executor.initialize();
            
            const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
            expect(DirectSecp256k1HdWallet.fromMnemonic).toHaveBeenCalledWith(
                config.cosmos.wallet.mnemonic,
                expect.objectContaining({
                    prefix: 'neutron'
                })
            );
        });

        it('should connect to all configured Cosmos chains', async () => {
            await executor.initialize();
            
            const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
            expect(SigningCosmWasmClient.connectWithSigner).toHaveBeenCalledTimes(3); // neutron, juno, cosmoshub
        });
    });

    describe('chain detection', () => {
        beforeEach(async () => {
            await executor.initialize();
        });

        it('should detect Neutron chain correctly', () => {
            const order = { ...mockExecutableOrder.order, destinationChainId: 7001 };
            expect((executor as any).isCosmosChain(order.destinationChainId)).toBe(true);
        });

        it('should detect Juno chain correctly', () => {
            const order = { ...mockExecutableOrder.order, destinationChainId: 7002 };
            expect((executor as any).isCosmosChain(order.destinationChainId)).toBe(true);
        });

        it('should detect Cosmos Hub correctly', () => {
            const order = { ...mockExecutableOrder.order, destinationChainId: 30001 };
            expect((executor as any).isCosmosChain(order.destinationChainId)).toBe(true);
        });

        it('should not detect non-Cosmos chains', () => {
            expect((executor as any).isCosmosChain(1)).toBe(false);
            expect((executor as any).isCosmosChain(40002)).toBe(false);
            expect((executor as any).isCosmosChain(40003)).toBe(false);
        });
    });

    describe('order execution', () => {
        beforeEach(async () => {
            await executor.initialize();
            
            // Mock successful CosmWasm execution
            mockCosmosClient.execute.mockResolvedValue({
                transactionHash: 'ABC123DEF456',
                gasUsed: 250000,
                gasWanted: 300000
            });

            mockCosmosClient.getBalance.mockResolvedValue({
                amount: '1000000',
                denom: 'untrn'
            });

            mockCosmosClient.simulate.mockResolvedValue({
                gasInfo: {
                    gasUsed: 250000,
                    gasWanted: 300000
                }
            });
        });

        it('should execute Neutron order successfully', async () => {
            const result = await executor.executeOrder(mockExecutableOrder);

            expect(result.success).toBe(true);
            expect(result.transactionHash).toBe('ABC123DEF456');
            expect(result.gasUsed).toBe(250000);
            expect(result.chainId).toBe(7001);
        });

        it('should execute Juno order successfully', async () => {
            const junoOrder = {
                ...mockExecutableOrder,
                order: { ...mockExecutableOrder.order, destinationChainId: 7002 },
                chainSpecificParams: JSON.stringify({
                    contractAddress: 'juno1contract123456789',
                    amount: '300000000',
                    denom: 'ujunox'
                })
            };

            const result = await executor.executeOrder(junoOrder);

            expect(result.success).toBe(true);
            expect(result.chainId).toBe(7002);
        });

        it('should execute Cosmos Hub order successfully', async () => {
            const cosmosOrder = {
                ...mockExecutableOrder,
                order: { ...mockExecutableOrder.order, destinationChainId: 30001 },
                chainSpecificParams: JSON.stringify({
                    contractAddress: '', // Cosmos Hub doesn't support CosmWasm
                    amount: '300000000',
                    denom: 'uatom'
                })
            };

            // Mock native token transfer for Cosmos Hub
            mockCosmosClient.sendTokens.mockResolvedValue({
                transactionHash: 'COSMOS123',
                gasUsed: 150000
            });

            const result = await executor.executeOrder(cosmosOrder);

            expect(result.success).toBe(true);
            expect(result.chainId).toBe(30001);
            expect(mockCosmosClient.sendTokens).toHaveBeenCalled();
        });

        it('should handle unsupported chain IDs', async () => {
            const invalidOrder = {
                ...mockExecutableOrder,
                order: { ...mockExecutableOrder.order, destinationChainId: 99999 }
            };

            const result = await executor.executeOrder(invalidOrder);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported Cosmos chain');
        });

        it('should handle CosmWasm execution errors', async () => {
            mockCosmosClient.execute.mockRejectedValue(new Error('Contract execution failed'));

            const result = await executor.executeOrder(mockExecutableOrder);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Contract execution failed');
        });

        it('should handle insufficient balance', async () => {
            mockCosmosClient.getBalance.mockResolvedValue({
                amount: '100', // Very small balance
                denom: 'untrn'
            });

            const result = await executor.executeOrder(mockExecutableOrder);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Insufficient balance');
        });
    });

    describe('parameter parsing', () => {
        beforeEach(async () => {
            await executor.initialize();
        });

        it('should parse execution parameters correctly', () => {
            const params = JSON.stringify({
                contractAddress: 'neutron1test123',
                amount: '1000000',
                denom: 'untrn',
                gasLimit: 300000
            });

            const parsed = (executor as any).parseExecutionParams(params);

            expect(parsed).toEqual({
                contractAddress: 'neutron1test123',
                amount: '1000000',
                denom: 'untrn',
                gasLimit: 300000
            });
        });

        it('should handle missing parameters with defaults', () => {
            const params = JSON.stringify({
                contractAddress: 'neutron1test123'
            });

            const parsed = (executor as any).parseExecutionParams(params);

            expect(parsed.gasLimit).toBe(300000); // Default value
            expect(parsed.amount).toBeDefined();
        });

        it('should handle invalid JSON parameters', () => {
            const invalidParams = 'invalid json}';

            expect(() => {
                (executor as any).parseExecutionParams(invalidParams);
            }).toThrow();
        });
    });

    describe('network configuration', () => {
        beforeEach(async () => {
            await executor.initialize();
        });

        it('should get Neutron network configuration', () => {
            const config = (executor as any).getNetworkConfig(7001);

            expect(config).toEqual({
                name: 'Neutron Testnet',
                rpcUrl: expect.stringContaining('neutron'),
                chainId: 'pion-1',
                denom: 'untrn',
                prefix: 'neutron',
                gasPrice: '0.025untrn',
                contractAddress: expect.any(String)
            });
        });

        it('should get Juno network configuration', () => {
            const config = (executor as any).getNetworkConfig(7002);

            expect(config).toEqual({
                name: 'Juno Testnet',
                rpcUrl: expect.stringContaining('juno'),
                chainId: 'uni-6',
                denom: 'ujunox',
                prefix: 'juno',
                gasPrice: '0.025ujunox',
                contractAddress: expect.any(String)
            });
        });

        it('should get Cosmos Hub network configuration', () => {
            const config = (executor as any).getNetworkConfig(30001);

            expect(config).toEqual({
                name: 'Cosmos Hub',
                rpcUrl: expect.stringContaining('cosmos'),
                chainId: 'cosmoshub-4',
                denom: 'uatom',
                prefix: 'cosmos',
                gasPrice: '0.025uatom',
                contractAddress: '' // No CosmWasm support
            });
        });

        it('should return null for unsupported networks', () => {
            const config = (executor as any).getNetworkConfig(99999);
            expect(config).toBeNull();
        });
    });

    describe('gas estimation', () => {
        beforeEach(async () => {
            await executor.initialize();
        });

        it('should estimate gas for CosmWasm execution', async () => {
            mockCosmosClient.simulate.mockResolvedValue({
                gasInfo: {
                    gasUsed: 280000,
                    gasWanted: 300000
                }
            });

            const gasEstimate = await (executor as any).estimateGas(7001, {
                contractAddress: 'neutron1test123',
                amount: '1000000',
                denom: 'untrn'
            });

            expect(gasEstimate).toBe(280000);
            expect(mockCosmosClient.simulate).toHaveBeenCalled();
        });

        it('should handle gas estimation errors', async () => {
            mockCosmosClient.simulate.mockRejectedValue(new Error('Simulation failed'));

            const gasEstimate = await (executor as any).estimateGas(7001, {
                contractAddress: 'neutron1test123',
                amount: '1000000',
                denom: 'untrn'
            });

            expect(gasEstimate).toBe(300000); // Default gas limit
        });
    });

    describe('status and monitoring', () => {
        it('should provide status before initialization', () => {
            const status = executor.getStatus();

            expect(status).toEqual({
                initialized: false,
                connectedChains: [],
                activeClients: 0,
                totalExecutions: 0
            });
        });

        it('should provide status after initialization', async () => {
            await executor.initialize();

            const status = executor.getStatus();

            expect(status).toEqual({
                initialized: true,
                connectedChains: ['neutron', 'juno', 'cosmoshub'],
                activeClients: 3,
                totalExecutions: 0
            });
        });

        it('should track execution count', async () => {
            await executor.initialize();
            
            mockCosmosClient.execute.mockResolvedValue({
                transactionHash: 'ABC123',
                gasUsed: 250000
            });

            await executor.executeOrder(mockExecutableOrder);

            const status = executor.getStatus();
            expect(status.totalExecutions).toBe(1);
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            await executor.initialize();
        });

        it('should stop and disconnect all clients', async () => {
            await executor.stop();

            expect(mockCosmosClient.disconnect).toHaveBeenCalledTimes(3);
            
            const status = executor.getStatus();
            expect(status.initialized).toBe(false);
            expect(status.activeClients).toBe(0);
        });
    });

    describe('error resilience', () => {
        beforeEach(async () => {
            await executor.initialize();
        });

        it('should handle client connection failures gracefully', async () => {
            const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
            SigningCosmWasmClient.connectWithSigner.mockRejectedValueOnce(new Error('Connection failed'));

            // Should not throw even if one client fails to connect
            await expect(executor.initialize()).resolves.not.toThrow();
        });

        it('should retry failed operations', async () => {
            mockCosmosClient.execute
                .mockRejectedValueOnce(new Error('Temporary failure'))
                .mockResolvedValueOnce({
                    transactionHash: 'RETRY123',
                    gasUsed: 250000
                });

            const result = await executor.executeOrder(mockExecutableOrder);

            expect(result.success).toBe(true);
            expect(mockCosmosClient.execute).toHaveBeenCalledTimes(2);
        });
    });
});