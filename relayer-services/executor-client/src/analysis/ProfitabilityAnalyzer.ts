/**
 * Profitability Analyzer - Smart Order Selection
 * 
 * Analyzes orders to determine profitability and priority.
 * This is the "brain" that decides which orders are worth executing.
 */

import { ethers } from 'ethers';
import { Config } from '../config/config';
import { logger } from '../utils/logger';

export interface ProfitabilityAnalysis {
    orderHash: string;
    estimatedProfit: bigint;
    gasEstimate: bigint;
    safetyDeposit: bigint;
    resolverFee: bigint;
    totalCosts: bigint;
    profitMargin: number; // percentage
    isProfitable: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    executionPriority: number; // 1-10, higher is better
    reasoning: string[];
}

export class ProfitabilityAnalyzer {
    private config: Config;
    private ethereumProvider!: ethers.Provider;
    private isInitialized: boolean = false;

    constructor(config: Config) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        logger.info(' Initializing Profitability Analyzer...');

        // We'll get the provider from the config
        this.ethereumProvider = new ethers.JsonRpcProvider(this.config.ethereum.rpcUrl);

        this.isInitialized = true;
        logger.info(' Profitability Analyzer initialized');
    }

    async analyzeOrder(order: any): Promise<ProfitabilityAnalysis> {
        this.ensureInitialized();

        logger.debug(` Analyzing profitability for order ${order.orderHash}`);

        const analysis: ProfitabilityAnalysis = {
            orderHash: order.orderHash,
            estimatedProfit: 0n,
            gasEstimate: 0n,
            safetyDeposit: 0n,
            resolverFee: 0n,
            totalCosts: 0n,
            profitMargin: 0,
            isProfitable: false,
            riskLevel: 'medium',
            executionPriority: 0,
            reasoning: []
        };

        try {
            // 1. Calculate resolver fee (revenue)
            analysis.resolverFee = BigInt(order.resolverFeeAmount || 0);
            analysis.reasoning.push(`Resolver fee: ${ethers.formatEther(analysis.resolverFee)} ETH`);

            // 2. Estimate gas costs
            analysis.gasEstimate = await this.estimateGasCosts(order);
            const gasPrice = (await this.ethereumProvider.getFeeData()).gasPrice || 0n;
            const gasCost = analysis.gasEstimate * gasPrice;
            analysis.reasoning.push(`Gas cost: ${ethers.formatEther(gasCost)} ETH (${analysis.gasEstimate} gas @ ${ethers.formatUnits(gasPrice, 'gwei')} gwei)`);

            // 3. Calculate safety deposit (this gets returned, but ties up capital)
            analysis.safetyDeposit = await this.estimateSafetyDeposit(order);
            analysis.reasoning.push(`Safety deposit: ${ethers.formatEther(analysis.safetyDeposit)} ETH (refunded on completion)`);

            // 4. Estimate NEAR transaction costs
            const nearCosts = this.estimateNearCosts(order);
            analysis.reasoning.push(`NEAR costs: ~${nearCosts} NEAR`);

            // 5. Calculate total costs
            analysis.totalCosts = gasCost; // Safety deposit doesn't count as it's returned
            
            // 6. Calculate estimated profit
            analysis.estimatedProfit = analysis.resolverFee - analysis.totalCosts;

            // 7. Calculate profit margin
            if (analysis.resolverFee > 0n) {
                analysis.profitMargin = Number(analysis.estimatedProfit * 10000n / analysis.resolverFee) / 100;
            }

            // 8. Determine if profitable
            const minProfitThreshold = ethers.parseEther(this.config.execution.minProfitThreshold);
            analysis.isProfitable = analysis.estimatedProfit >= minProfitThreshold;

            if (analysis.isProfitable) {
                analysis.reasoning.push(` Profitable: ${ethers.formatEther(analysis.estimatedProfit)} ETH profit (${analysis.profitMargin.toFixed(2)}% margin)`);
            } else {
                analysis.reasoning.push(` Not profitable: ${ethers.formatEther(analysis.estimatedProfit)} ETH (below ${ethers.formatEther(minProfitThreshold)} ETH threshold)`);
            }

            // 9. Assess risk level
            analysis.riskLevel = this.assessRiskLevel(order, analysis);

            // 10. Calculate execution priority
            analysis.executionPriority = this.calculatePriority(order, analysis);

            logger.debug(` Analysis complete for ${order.orderHash}:`, {
                profitable: analysis.isProfitable,
                profit: ethers.formatEther(analysis.estimatedProfit),
                margin: `${analysis.profitMargin.toFixed(2)}%`,
                priority: analysis.executionPriority,
                risk: analysis.riskLevel
            });

        } catch (error) {
            logger.error(` Error analyzing order ${order.orderHash}:`, error);
            analysis.reasoning.push(` Analysis error: ${error}`);
        }

        return analysis;
    }

    private async estimateGasCosts(order: any): Promise<bigint> {
        // Estimate gas costs for the complete execution flow:
        // 1. matchFusionOrder (deploys escrows)
        // 2. completeFusionOrder (reveals secret)
        // 3. ERC20 transfer (token settlement)

        const gasEstimates = {
            matchOrder: 500000n,     // High due to escrow deployment
            completeOrder: 100000n,  // Simple state update
            tokenTransfer: 50000n,   // Standard ERC20 transfer
            buffer: 50000n           // Safety buffer
        };

        return gasEstimates.matchOrder + gasEstimates.completeOrder + gasEstimates.tokenTransfer + gasEstimates.buffer;
    }

    private async estimateSafetyDeposit(order: any): Promise<bigint> {
        // Safety deposit is typically 5% of the source amount
        // This is returned after successful execution, so it's not a "cost" per se,
        // but it does tie up capital temporarily

        const sourceAmount = BigInt(order.sourceAmount || 0);
        const depositPercentage = 500n; // 5% in basis points
        
        return (sourceAmount * depositPercentage) / 10000n;
    }

    private estimateNearCosts(order: any): string {
        // Estimate NEAR transaction costs
        // Based on our manual executions, NEAR operations cost ~0.0242 NEAR total
        return "0.025";
    }

    private assessRiskLevel(order: any, analysis: ProfitabilityAnalysis): 'low' | 'medium' | 'high' {
        const risks = [];

        // Check time to expiry
        const currentTime = Math.floor(Date.now() / 1000);
        const timeToExpiry = order.expiryTime - currentTime;
        
        if (timeToExpiry < 3600) { // Less than 1 hour
            risks.push('short_expiry');
        }

        // Check order size (larger orders are riskier)
        const sourceAmount = BigInt(order.sourceAmount || 0);
        if (sourceAmount > ethers.parseEther("100")) { // Orders > 100 tokens
            risks.push('large_order');
        }

        // Check profit margin
        if (analysis.profitMargin < 10) { // Less than 10% margin
            risks.push('low_margin');
        }

        // Check destination chain
        if (order.destinationChainId !== 40002) { // Not NEAR testnet
            risks.push('unknown_chain');
        }

        // Determine overall risk level
        if (risks.length === 0) return 'low';
        if (risks.length <= 2) return 'medium';
        return 'high';
    }

    private calculatePriority(order: any, analysis: ProfitabilityAnalysis): number {
        if (!analysis.isProfitable) return 0;

        let priority = 5; // Base priority

        // Higher profit = higher priority
        const profitETH = Number(ethers.formatEther(analysis.estimatedProfit));
        priority += Math.min(profitETH * 10, 3); // Up to +3 for high profit

        // Lower risk = higher priority
        switch (analysis.riskLevel) {
            case 'low': priority += 2; break;
            case 'medium': priority += 1; break;
            case 'high': priority -= 1; break;
        }

        // Time pressure (closer to expiry = higher priority to avoid loss)
        const currentTime = Math.floor(Date.now() / 1000);
        const timeToExpiry = order.expiryTime - currentTime;
        
        if (timeToExpiry < 3600) { // Less than 1 hour
            priority += 2;
        } else if (timeToExpiry < 7200) { // Less than 2 hours
            priority += 1;
        }

        // Ensure priority is within bounds
        return Math.max(1, Math.min(10, Math.round(priority)));
    }

    // Market analysis methods for future enhancement
    public async getMarketConditions(): Promise<{
        gasPrice: string;
        networkCongestion: 'low' | 'medium' | 'high';
        competitorActivity: number;
        optimalExecutionWindow: boolean;
    }> {
        const feeData = await this.ethereumProvider.getFeeData();
        const gasPrice = feeData.gasPrice || 0n;
        const gasPriceGwei = Number(ethers.formatUnits(gasPrice, 'gwei'));

        return {
            gasPrice: `${gasPriceGwei.toFixed(1)} gwei`,
            networkCongestion: gasPriceGwei > 50 ? 'high' : gasPriceGwei > 20 ? 'medium' : 'low',
            competitorActivity: 0, // Would track other resolvers
            optimalExecutionWindow: gasPriceGwei < 30 // Arbitrary threshold
        };
    }

    public async batchAnalyzeOrders(orders: any[]): Promise<ProfitabilityAnalysis[]> {
        logger.info(` Batch analyzing ${orders.length} orders...`);

        const analyses = await Promise.all(
            orders.map(async (order) => {
                try {
                    return await this.analyzeOrder(order);
                } catch (error) {
                    // Return error analysis for failed orders
                    return {
                        orderHash: order?.orderHash || 'invalid',
                        estimatedProfit: 0n,
                        gasEstimate: 0n,
                        safetyDeposit: 0n,
                        resolverFee: 0n,
                        totalCosts: 0n,
                        profitMargin: 0,
                        isProfitable: false,
                        riskLevel: 'high' as const,
                        executionPriority: 0,
                        reasoning: [` Analysis error: ${error}`]
                    };
                }
            })
        );

        const profitable = analyses.filter(a => a.isProfitable).length;
        logger.info(` Batch analysis complete: ${profitable}/${orders.length} orders profitable`);

        return analyses;
    }

    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('ProfitabilityAnalyzer not initialized. Call initialize() first.');
        }
    }

    public getStatus(): object {
        return {
            isInitialized: this.isInitialized,
            minProfitThreshold: this.config.execution.minProfitThreshold,
            maxGasPrice: this.config.execution.maxGasPrice
        };
    }
}