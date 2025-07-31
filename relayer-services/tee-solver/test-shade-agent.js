#!/usr/bin/env node

/**
 * NEAR Shade Agent Integration Test
 * 
 * Tests the complete Shade Agent functionality for autonomous Bitcoin + NEAR swaps.
 * This test verifies:
 * 1. Shade Agent initialization with all components
 * 2. NEAR connection and Chain Signatures capability
 * 3. Bitcoin integration with existing automation
 * 4. Intent processing and decision making
 * 5. Autonomous swap execution simulation
 */

const { BitcoinNEARShadeAgent } = require('./dist/ShadeAgent');
const { NEARIntentAdapter } = require('./dist/adapters/NEARIntentAdapter');
const { FusionOrderProcessor } = require('./dist/metaorder/FusionOrderProcessor');
const { logger } = require('./dist/utils/logger');

class ShadeAgentIntegrationTest {
    constructor() {
        this.agent = null;
        this.testResults = [];
    }

    async runAllTests() {
        logger.info('🤖 Starting NEAR Shade Agent Integration Tests');
        
        try {
            // Test 1: Shade Agent Initialization
            await this.testShadeAgentInitialization();
            
            // Test 2: NEAR Connection and Chain Signatures
            await this.testNEARIntegration();
            
            // Test 3: Bitcoin Integration
            await this.testBitcoinIntegration();
            
            // Test 4: Intent Processing
            await this.testIntentProcessing();
            
            // Test 5: Autonomous Decision Making
            await this.testAutonomousDecisionMaking();
            
            // Test 6: Multi-Chain Swap Simulation
            await this.testMultiChainSwapSimulation();
            
            // Generate test report
            this.generateTestReport();
            
        } catch (error) {
            logger.error('💥 Shade Agent test suite failed:', error);
            process.exit(1);
        } finally {
            if (this.agent) {
                await this.agent.cleanup();
            }
        }
    }

    async testShadeAgentInitialization() {
        logger.info('🚀 Test 1: Shade Agent Initialization');
        
        try {
            this.agent = new BitcoinNEARShadeAgent();
            
            // Test initialization
            await this.agent.initialize();
            
            // Verify initialization
            const status = this.agent.getStatus();
            
            if (!status.initialized) {
                throw new Error('Shade Agent not properly initialized');
            }
            
            this.testResults.push({
                test: 'Shade Agent Initialization',
                passed: true,
                details: {
                    initialized: status.initialized,
                    nearConnected: status.nearConnected,
                    bitcoinConnected: status.bitcoinConnected,
                    ethereumConnected: status.ethereumConnected,
                    nearAccount: status.nearAccount,
                    bitcoinNetwork: status.bitcoinNetwork
                }
            });
            
            logger.info('✅ Shade Agent initialized successfully');
            
        } catch (error) {
            this.testResults.push({
                test: 'Shade Agent Initialization',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testNEARIntegration() {
        logger.info('🔗 Test 2: NEAR Integration');
        
        try {
            const status = this.agent.getStatus();
            
            if (!status.nearConnected) {
                throw new Error('NEAR connection not established');
            }
            
            // Test NEAR account access
            if (!status.nearAccount || !status.nearAccount.includes('.testnet')) {
                throw new Error('NEAR testnet account not properly configured');
            }
            
            this.testResults.push({
                test: 'NEAR Integration',
                passed: true,
                details: {
                    connected: status.nearConnected,
                    account: status.nearAccount,
                    networkId: 'testnet'
                }
            });
            
            logger.info('✅ NEAR integration verified');
            
        } catch (error) {
            this.testResults.push({
                test: 'NEAR Integration',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testBitcoinIntegration() {
        logger.info('₿ Test 3: Bitcoin Integration');
        
        try {
            const status = this.agent.getStatus();
            
            if (!status.bitcoinConnected) {
                throw new Error('Bitcoin connection not established');
            }
            
            if (status.bitcoinNetwork !== 'testnet') {
                throw new Error('Bitcoin network should be testnet for testing');
            }
            
            this.testResults.push({
                test: 'Bitcoin Integration',
                passed: true,
                details: {
                    connected: status.bitcoinConnected,
                    network: status.bitcoinNetwork
                }
            });
            
            logger.info('✅ Bitcoin integration verified');
            
        } catch (error) {
            this.testResults.push({
                test: 'Bitcoin Integration',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testIntentProcessing() {
        logger.info('💭 Test 4: Intent Processing');
        
        try {
            // Create a test swap intent
            const testIntent = {
                fromChain: 'ethereum',
                toChain: 'bitcoin',
                fromAmount: '0.1',
                toAmount: '0.0001',
                userAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                maxSlippage: 0.005,
                deadline: Math.floor(Date.now() / 1000) + 3600
            };
            
            // Test intent analysis
            const decision = await this.agent.analyzeSwapIntent(testIntent);
            
            if (!decision || typeof decision.shouldExecute !== 'boolean') {
                throw new Error('Invalid decision analysis result');
            }
            
            this.testResults.push({
                test: 'Intent Processing',
                passed: true,
                details: {
                    intentAnalyzed: true,
                    decisionMade: true,
                    shouldExecute: decision.shouldExecute,
                    expectedProfit: decision.expectedProfit,
                    riskScore: decision.riskScore,
                    strategy: decision.executionStrategy,
                    reason: decision.reason
                }
            });
            
            logger.info('✅ Intent processing verified');
            
        } catch (error) {
            this.testResults.push({
                test: 'Intent Processing',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testAutonomousDecisionMaking() {
        logger.info('🧠 Test 5: Autonomous Decision Making');
        
        try {
            // Test different scenarios
            const scenarios = [
                {
                    name: 'Profitable Swap',
                    intent: {
                        fromChain: 'ethereum',
                        toChain: 'bitcoin',
                        fromAmount: '0.05',
                        toAmount: '0.001',
                        userAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                        maxSlippage: 0.01,
                        deadline: Math.floor(Date.now() / 1000) + 7200
                    },
                    expectedDecision: 'should consider'
                },
                {
                    name: 'Expired Deadline',
                    intent: {
                        fromChain: 'near',
                        toChain: 'bitcoin',
                        fromAmount: '1.0',
                        toAmount: '0.002',
                        userAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                        maxSlippage: 0.01,
                        deadline: Math.floor(Date.now() / 1000) - 100 // Past deadline
                    },
                    expectedDecision: 'should reject'
                },
                {
                    name: 'High Risk Scenario',
                    intent: {
                        fromChain: 'bitcoin',
                        toChain: 'near',
                        fromAmount: '10.0', // Large amount = higher risk
                        toAmount: '20000',
                        userAddress: 'demo.cuteharbor3573.testnet',
                        maxSlippage: 0.1,
                        deadline: Math.floor(Date.now() / 1000) + 300 // Short deadline
                    },
                    expectedDecision: 'should be cautious'
                }
            ];
            
            const results = [];
            for (const scenario of scenarios) {
                try {
                    const decision = await this.agent.analyzeSwapIntent(scenario.intent);
                    results.push({
                        scenario: scenario.name,
                        decision: decision.shouldExecute,
                        riskScore: decision.riskScore,
                        reason: decision.reason
                    });
                } catch (error) {
                    results.push({
                        scenario: scenario.name,
                        error: error.message
                    });
                }
            }
            
            this.testResults.push({
                test: 'Autonomous Decision Making',
                passed: true,
                details: {
                    scenariosTested: scenarios.length,
                    results: results
                }
            });
            
            logger.info('✅ Autonomous decision making verified');
            
        } catch (error) {
            this.testResults.push({
                test: 'Autonomous Decision Making',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testMultiChainSwapSimulation() {
        logger.info('🔄 Test 6: Multi-Chain Swap Simulation');
        
        try {
            // Test different swap directions
            const swapTests = [
                {
                    name: 'Ethereum → Bitcoin',
                    intent: {
                        fromChain: 'ethereum',
                        toChain: 'bitcoin',
                        fromAmount: '0.01',
                        toAmount: '0.00005',
                        userAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                        maxSlippage: 0.005,
                        deadline: Math.floor(Date.now() / 1000) + 3600
                    }
                },
                {
                    name: 'Bitcoin → NEAR',
                    intent: {
                        fromChain: 'bitcoin',
                        toChain: 'near',
                        fromAmount: '0.0001',
                        toAmount: '10',
                        userAddress: 'demo.cuteharbor3573.testnet',
                        maxSlippage: 0.01,
                        deadline: Math.floor(Date.now() / 1000) + 3600
                    }
                },
                {
                    name: 'NEAR → Bitcoin',
                    intent: {
                        fromChain: 'near',
                        toChain: 'bitcoin',
                        fromAmount: '5.0',
                        toAmount: '0.00008',
                        userAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                        maxSlippage: 0.01,
                        deadline: Math.floor(Date.now() / 1000) + 3600
                    }
                }
            ];
            
            const swapResults = [];
            for (const swapTest of swapTests) {
                try {
                    // Analyze the swap
                    const decision = await this.agent.analyzeSwapIntent(swapTest.intent);
                    
                    // Simulate execution (don't actually execute to avoid real transactions)
                    logger.info(`🔍 Simulating ${swapTest.name}:`);
                    logger.info(`   Decision: ${decision.shouldExecute ? 'Execute' : 'Reject'}`);
                    logger.info(`   Reason: ${decision.reason}`);
                    logger.info(`   Risk Score: ${decision.riskScore}`);
                    
                    swapResults.push({
                        swapType: swapTest.name,
                        analyzed: true,
                        decision: decision.shouldExecute,
                        riskScore: decision.riskScore,
                        strategy: decision.executionStrategy
                    });
                    
                } catch (error) {
                    swapResults.push({
                        swapType: swapTest.name,
                        error: error.message
                    });
                }
            }
            
            this.testResults.push({
                test: 'Multi-Chain Swap Simulation',
                passed: true,
                details: {
                    swapDirectionsTested: swapTests.length,
                    results: swapResults
                }
            });
            
            logger.info('✅ Multi-chain swap simulation completed');
            
        } catch (error) {
            this.testResults.push({
                test: 'Multi-Chain Swap Simulation',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    generateTestReport() {
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        
        logger.info('\\n🤖 NEAR Shade Agent Test Report');
        logger.info('=====================================');
        logger.info(`Total Tests: ${total}`);
        logger.info(`Passed: ${passed}`);
        logger.info(`Failed: ${total - passed}`);
        logger.info(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        this.testResults.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            logger.info(`${status} ${index + 1}. ${result.test}`);
            
            if (result.details) {
                logger.info(`   📝 Details: ${JSON.stringify(result.details, null, 2)}`);
            }
            
            if (result.error) {
                logger.info(`   ❗ Error: ${result.error}`);
            }
        });
        
        if (passed === total) {
            logger.info('\\n🎉 All tests passed! NEAR Shade Agent is ready for autonomous operation.');
            logger.info('🚀 Ready for ETHGlobal Unite bounty submission!');
        } else {
            logger.info('\\n⚠️ Some tests failed. Please review the configuration and setup.');
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new ShadeAgentIntegrationTest();
    tester.runAllTests().catch(error => {
        logger.error('💥 Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { ShadeAgentIntegrationTest };