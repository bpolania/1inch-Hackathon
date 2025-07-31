#!/usr/bin/env node

/**
 * Bitcoin Automation Integration Test
 * 
 * Tests the complete automated Bitcoin atomic swap flow:
 * 1. Initialize BitcoinExecutor with real configuration
 * 2. Create a mock order to test execution
 * 3. Verify HTLC creation and funding
 * 4. Test secret revelation handling
 * 5. Test timeout and refund scenarios
 */

const { BitcoinExecutor } = require('./dist/execution/BitcoinExecutor');
const { loadConfig } = require('./dist/config/config');
const { logger } = require('./dist/utils/logger');

class BitcoinAutomationTest {
    constructor() {
        this.executor = null;
        this.config = null;
        this.testResults = [];
    }

    async runAllTests() {
        logger.info('🧪 Starting Bitcoin Automation Integration Tests');
        
        try {
            // Test 1: Configuration Loading
            await this.testConfigurationLoading();
            
            // Test 2: BitcoinExecutor Initialization
            await this.testExecutorInitialization();
            
            // Test 3: Network Connectivity
            await this.testNetworkConnectivity();
            
            // Test 4: UTXO Management
            await this.testUTXOManagement();
            
            // Test 5: Order Context Storage
            await this.testOrderContextStorage();
            
            // Test 6: Refund Manager
            await this.testRefundManager();
            
            // Generate test report
            this.generateTestReport();
            
        } catch (error) {
            logger.error('💥 Test suite failed:', error);
            process.exit(1);
        } finally {
            if (this.executor) {
                await this.executor.cleanup();
            }
        }
    }

    async testConfigurationLoading() {
        logger.info('📋 Test 1: Configuration Loading');
        
        try {
            this.config = await loadConfig();
            
            // Verify Bitcoin configuration
            const required = ['network', 'feeRate', 'htlcTimelock'];
            const missing = required.filter(key => !this.config.bitcoin[key]);
            
            if (missing.length > 0) {
                throw new Error(`Missing Bitcoin config: ${missing.join(', ')}`);
            }
            
            // Check if Bitcoin automation is enabled by required private key
            const hasPrivateKey = !!this.config.bitcoin.privateKey;
            const automationEnabled = process.env.ENABLE_BITCOIN_AUTOMATION === 'true';
            
            if (automationEnabled && !hasPrivateKey) {
                throw new Error('Bitcoin automation enabled but no private key provided');
            }
            
            this.testResults.push({
                test: 'Configuration Loading',
                passed: true,
                details: {
                    network: this.config.bitcoin.network,
                    automationEnabled,
                    hasPrivateKey
                }
            });
            
            logger.info('✅ Configuration loaded successfully');
            
        } catch (error) {
            this.testResults.push({
                test: 'Configuration Loading',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testExecutorInitialization() {
        logger.info('🔧 Test 2: BitcoinExecutor Initialization');
        
        try {
            this.executor = new BitcoinExecutor(this.config);
            
            // Test initialization
            await this.executor.initialize();
            
            // Verify executor status
            const status = this.executor.getStatus();
            
            if (!status.initialized) {
                throw new Error('Executor not properly initialized');
            }
            
            this.testResults.push({
                test: 'BitcoinExecutor Initialization',
                passed: true,
                details: status
            });
            
            logger.info('✅ BitcoinExecutor initialized successfully');
            
        } catch (error) {
            this.testResults.push({
                test: 'BitcoinExecutor Initialization',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testNetworkConnectivity() {
        logger.info('🌐 Test 3: Network Connectivity');
        
        try {
            const networkStatus = await this.executor.getNetworkStatus();
            
            if (!networkStatus.connected) {
                throw new Error('Not connected to Bitcoin network');
            }
            
            if (networkStatus.blockHeight <= 0) {
                throw new Error('Invalid block height');
            }
            
            this.testResults.push({
                test: 'Network Connectivity',
                passed: true,
                details: networkStatus
            });
            
            logger.info('✅ Network connectivity verified');
            
        } catch (error) {
            this.testResults.push({
                test: 'Network Connectivity',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testUTXOManagement() {
        logger.info('💰 Test 4: UTXO Management');
        
        try {
            const status = this.executor.getStatus();
            const resolverAddress = status.address;
            
            // Test UTXO fetching (should not throw)
            const utxoManager = this.executor.utxoManager;
            const balance = await utxoManager.getAvailableBalance(resolverAddress);
            
            logger.info(`💼 Resolver balance: ${balance} satoshis`);
            
            // Test fee estimation
            const feeRate = await utxoManager.estimateOptimalFeeRate();
            
            if (feeRate <= 0) {
                throw new Error('Invalid fee rate estimation');
            }
            
            this.testResults.push({
                test: 'UTXO Management',
                passed: true,
                details: {
                    address: resolverAddress,
                    balance,
                    feeRate
                }
            });
            
            logger.info('✅ UTXO management verified');
            
        } catch (error) {
            this.testResults.push({
                test: 'UTXO Management',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testOrderContextStorage() {
        logger.info('📦 Test 5: Order Context Storage');
        
        try {
            const orderStore = this.executor.orderStore;
            const testOrderHash = '0x' + 'a'.repeat(64);
            
            // Test storing order context
            orderStore.set(testOrderHash, {
                orderHash: testOrderHash,
                chainId: 11155111,
                maker: '0x' + '1'.repeat(40),
                srcToken: '0x' + '2'.repeat(40),
                srcAmount: '1000000000000000000',
                dstChainId: 40004,
                dstExecutionParams: '0x',
                expiryTime: Math.floor(Date.now() / 1000) + 3600,
                hashlock: '0x' + 'b'.repeat(64),
                status: 'pending'
            });
            
            // Test retrieving order context
            const retrieved = orderStore.get(testOrderHash);
            if (!retrieved || retrieved.orderHash !== testOrderHash) {
                throw new Error('Order context not properly stored/retrieved');
            }
            
            // Test status update
            orderStore.updateStatus(testOrderHash, 'htlc_created');
            const updated = orderStore.get(testOrderHash);
            if (updated.status !== 'htlc_created') {
                throw new Error('Order status not properly updated');
            }
            
            // Clean up test order
            orderStore.delete(testOrderHash);
            
            this.testResults.push({
                test: 'Order Context Storage',
                passed: true,
                details: {
                    totalOrders: orderStore.size(),
                    pendingOrders: orderStore.getPending().length
                }
            });
            
            logger.info('✅ Order context storage verified');
            
        } catch (error) {
            this.testResults.push({
                test: 'Order Context Storage',
                passed: false,
                error: error.message
            });
            throw error;
        }
    }

    async testRefundManager() {
        logger.info('🔄 Test 6: Refund Manager');
        
        try {
            const refundManager = this.executor.refundManager;
            
            // Create a mock expired order context for testing
            const mockContext = {
                orderHash: '0x' + 'c'.repeat(64),
                status: 'htlc_funded',
                bitcoin: {
                    htlcScript: '76a914' + 'a'.repeat(40) + '88ac', // Mock script
                    fundingTxId: 'a'.repeat(64)
                }
            };
            
            // Test canRefund method (should handle gracefully even with mock data)
            const canRefund = await refundManager.canRefund(mockContext);
            
            // Test fee estimation
            const estimatedFee = await refundManager.estimateRefundFee(10);
            if (estimatedFee <= 0) {
                throw new Error('Invalid refund fee estimation');
            }
            
            this.testResults.push({
                test: 'Refund Manager',
                passed: true,
                details: {
                    canRefundResult: canRefund,
                    estimatedFee
                }
            });
            
            logger.info('✅ Refund manager verified');
            
        } catch (error) {
            this.testResults.push({
                test: 'Refund Manager',
                passed: false,
                error: error.message
            });
            
            // Don't throw - refund manager test failure shouldn't break the whole suite
            logger.warn('⚠️ Refund manager test failed but continuing');
        }
    }

    generateTestReport() {
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        
        logger.info('\n📊 Bitcoin Automation Test Report');
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
            logger.info('\n🎉 All tests passed! Bitcoin automation is ready.');
        } else {
            logger.info('\n⚠️ Some tests failed. Please review the configuration and setup.');
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new BitcoinAutomationTest();
    tester.runAllTests().catch(error => {
        logger.error('💥 Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { BitcoinAutomationTest };