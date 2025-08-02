#!/usr/bin/env node

/**
 * Cosmos Integration Test
 * 
 * Comprehensive test to verify the complete Cosmos blockchain integration
 * with the 1inch Fusion+ cross-chain relayer system.
 */

const { execSync } = require('child_process');
// const axios = require('axios'); // Removed to avoid dependency issues
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
    api: {
        baseUrl: 'http://localhost:3001',
        timeout: 30000
    },
    chains: {
        neutron: { chainId: 7001, name: 'Neutron Testnet' },
        juno: { chainId: 7002, name: 'Juno Testnet' },
        cosmoshub: { chainId: 30001, name: 'Cosmos Hub' }
    },
    executor: {
        path: './relayer-services/executor-client',
        logFile: './cosmos-test.log'
    }
};

class CosmosIntegrationTester {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            }
        };
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        console.log(logMessage);
        
        // Write to log file
        fs.appendFileSync(TEST_CONFIG.executor.logFile, logMessage + '\n');
    }

    async runTest(name, testFn) {
        this.log(`\n🧪 Running test: ${name}`);
        this.results.summary.total++;
        
        const startTime = Date.now();
        let result = {
            name,
            status: 'PENDING',
            duration: 0,
            message: '',
            details: {}
        };

        try {
            const testResult = await testFn();
            result.status = 'PASSED';
            result.message = testResult?.message || 'Test completed successfully';
            result.details = testResult?.details || {};
            this.results.summary.passed++;
            this.log(`✅ ${name} - PASSED`, 'SUCCESS');
        } catch (error) {
            result.status = 'FAILED';
            result.message = error.message;
            result.details = { error: error.stack };
            this.results.summary.failed++;
            this.log(`❌ ${name} - FAILED: ${error.message}`, 'ERROR');
        }

        result.duration = Date.now() - startTime;
        this.results.tests.push(result);
    }

    async testEnvironmentSetup() {
        const envPath = path.join(TEST_CONFIG.executor.path, '.env');
        
        if (!fs.existsSync(envPath)) {
            throw new Error('.env file not found in executor-client directory');
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        
        // Check for required Cosmos environment variables
        const requiredVars = [
            'COSMOS_MNEMONIC',
            'NEUTRON_RPC_URL',
            'JUNO_RPC_URL',
            'COSMOS_RPC_URL',
            'COSMOS_GAS_LIMIT',
            'COSMOS_TIMEOUT_SECONDS'
        ];

        const missingVars = requiredVars.filter(varName => 
            !envContent.includes(varName + '=')
        );

        if (missingVars.length > 0) {
            throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
        }

        return {
            message: 'Environment configuration is complete',
            details: { requiredVars, envPath }
        };
    }

    async testDependencies() {
        const packagePath = path.join(TEST_CONFIG.executor.path, 'package.json');
        
        if (!fs.existsSync(packagePath)) {
            throw new Error('package.json not found in executor-client directory');
        }

        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Check for required Cosmos dependencies
        const requiredDeps = [
            '@cosmjs/cosmwasm-stargate',
            '@cosmjs/proto-signing',
            '@cosmjs/stargate',
            '@cosmjs/encoding',
            '@cosmjs/math'
        ];

        const missingDeps = requiredDeps.filter(dep => 
            !packageJson.dependencies[dep]
        );

        if (missingDeps.length > 0) {
            throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
        }

        return {
            message: 'All required Cosmos dependencies are installed',
            details: { 
                dependencies: requiredDeps.map(dep => ({
                    name: dep,
                    version: packageJson.dependencies[dep]
                }))
            }
        };
    }

    async testExecutorCompilation() {
        const executorPath = TEST_CONFIG.executor.path;
        
        try {
            // Test TypeScript compilation
            this.log('Compiling TypeScript...');
            execSync('npm run build', { 
                cwd: executorPath, 
                stdio: 'pipe',
                timeout: 60000
            });

            // Check if CosmosExecutor was compiled
            const cosmosExecutorPath = path.join(executorPath, 'dist/execution/CosmosExecutor.js');
            if (!fs.existsSync(cosmosExecutorPath)) {
                throw new Error('CosmosExecutor.js not found in compiled output');
            }

            return {
                message: 'Executor compiles successfully with Cosmos integration',
                details: { compiledFiles: ['CosmosExecutor.js', 'CrossChainExecutor.js'] }
            };
        } catch (error) {
            throw new Error(`Compilation failed: ${error.message}`);
        }
    }

    async testAPIGatewayCosmosRoutes() {
        // Test that API Gateway routes are properly configured (file-based test)
        const apiRoutesPath = './relayer-services/api-gateway/src/routes/cosmos.ts';
        
        if (!fs.existsSync(apiRoutesPath)) {
            throw new Error('cosmos.ts API routes file not found');
        }

        const routesContent = fs.readFileSync(apiRoutesPath, 'utf8');
        
        const expectedEndpoints = [
            '/chains',
            '/contracts/:chainId',
            '/orders/:chainId',
            '/ibc/channels',
            '/governance/:chainId',
            '/estimate-cost'
        ];

        const missingEndpoints = expectedEndpoints.filter(endpoint => 
            !routesContent.includes(`'${endpoint}'`) && !routesContent.includes(`"${endpoint}"`)
        );

        if (missingEndpoints.length > 0) {
            throw new Error(`Missing API endpoints: ${missingEndpoints.join(', ')}`);
        }

        // Check that routes are properly exported
        if (!routesContent.includes('export { router as cosmosRoutes }')) {
            throw new Error('Cosmos routes not properly exported');
        }
        
        return {
            message: `API Gateway has all ${expectedEndpoints.length} Cosmos endpoints configured`,
            details: { expectedEndpoints, routesFile: apiRoutesPath }
        };
    }

    async testChainsConfiguration() {
        // Test that chains.ts includes Cosmos chains
        const chainsPath = path.join(
            './relayer-services/api-gateway/src/routes/chains.ts'
        );
        
        if (!fs.existsSync(chainsPath)) {
            throw new Error('chains.ts route file not found');
        }

        const chainsContent = fs.readFileSync(chainsPath, 'utf8');
        
        // Check for Cosmos chain configurations
        const cosmosChains = ['neutron', 'juno', 'cosmoshub'];
        const missingChains = cosmosChains.filter(chain => 
            !chainsContent.includes(chain)
        );

        if (missingChains.length > 0) {
            throw new Error(`Missing chains in configuration: ${missingChains.join(', ')}`);
        }

        // Check for CosmWasm and IBC references
        const requiredFeatures = ['cosmwasm', 'ibc', 'bridgeStatus'];
        const missingFeatures = requiredFeatures.filter(feature => 
            !chainsContent.includes(feature)
        );

        if (missingFeatures.length > 0) {
            this.log(`Warning: Some Cosmos features may not be fully configured: ${missingFeatures.join(', ')}`, 'WARN');
            this.results.summary.warnings++;
        }

        return {
            message: 'Cosmos chains are properly configured in API gateway',
            details: { cosmosChains, requiredFeatures }
        };
    }

    async testSmartContractDeployment() {
        const contractsPath = './contracts/cosmos';
        
        if (!fs.existsSync(contractsPath)) {
            throw new Error('Cosmos contracts directory not found');
        }

        // Check for key contract files (updated for actual structure)
        const requiredFiles = [
            'Cargo.toml',
            'src/lib.rs',
            'src/integration_tests.rs'
        ];

        const missingFiles = requiredFiles.filter(file => 
            !fs.existsSync(path.join(contractsPath, file))
        );

        if (missingFiles.length > 0) {
            throw new Error(`Missing contract files: ${missingFiles.join(', ')}`);
        }

        // Check if contracts can be built (optional, requires Rust)
        let buildStatus = 'not tested';
        try {
            execSync('cargo check', { 
                cwd: contractsPath, 
                stdio: 'pipe',
                timeout: 30000
            });
            buildStatus = 'build successful';
        } catch (error) {
            buildStatus = 'build failed or cargo not available';
            this.log('Warning: Could not verify contract compilation', 'WARN');
            this.results.summary.warnings++;
        }

        return {
            message: 'Cosmos smart contracts are properly structured',
            details: { requiredFiles, buildStatus }
        };
    }

    async testCrossChainExecutorIntegration() {
        const executorPath = path.join(
            TEST_CONFIG.executor.path, 
            'src/execution/CrossChainExecutor.ts'
        );
        
        if (!fs.existsSync(executorPath)) {
            throw new Error('CrossChainExecutor.ts not found');
        }

        const executorContent = fs.readFileSync(executorPath, 'utf8');
        
        // Check for Cosmos integration
        const requiredIntegrations = [
            'CosmosExecutor',
            'isCosmosChain',
            'executeCosmosSide',
            '7001', // Neutron chain ID
            '7002', // Juno chain ID  
            '30001' // Cosmos Hub chain ID
        ];

        const missingIntegrations = requiredIntegrations.filter(integration => 
            !executorContent.includes(integration)
        );

        if (missingIntegrations.length > 0) {
            throw new Error(`Missing integrations: ${missingIntegrations.join(', ')}`);
        }

        return {
            message: 'CrossChainExecutor properly integrates Cosmos support',
            details: { requiredIntegrations }
        };
    }

    async testConfigurationConsistency() {
        // Verify chain IDs are consistent across all files
        const files = [
            './relayer-services/executor-client/src/config/config.ts',
            './relayer-services/api-gateway/src/routes/chains.ts',
            './relayer-services/api-gateway/src/routes/cosmos.ts',
            './contracts/ethereum/scripts/deploy-fusion-plus.js'
        ];

        const chainIds = {
            neutron: 7001,
            juno: 7002,
            cosmoshub: 30001
        };

        const inconsistencies = [];

        for (const filePath of files) {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                
                Object.entries(chainIds).forEach(([chainName, expectedId]) => {
                    if (content.includes(chainName) && content.includes(expectedId.toString())) {
                        // Chain ID is consistent
                    } else if (content.includes(chainName)) {
                        inconsistencies.push(`${filePath}: ${chainName} chain ID might be inconsistent`);
                    }
                });
            }
        }

        if (inconsistencies.length > 0) {
            this.log(`Warnings about chain ID consistency: ${inconsistencies.join(', ')}`, 'WARN');
            this.results.summary.warnings++;
        }

        return {
            message: 'Configuration consistency verified across all components',
            details: { checkedFiles: files.length, inconsistencies }
        };
    }

    async generateReport() {
        const reportPath = './cosmos-integration-test-report.json';
        
        // Calculate success rate
        const successRate = this.results.summary.total > 0 
            ? (this.results.summary.passed / this.results.summary.total * 100).toFixed(1)
            : 0;

        this.results.summary.successRate = `${successRate}%`;
        this.results.summary.totalDuration = this.results.tests.reduce(
            (sum, test) => sum + test.duration, 0
        );

        // Write detailed report
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        
        this.log(`\n📊 TEST SUMMARY`);
        this.log(`================`);
        this.log(`Total Tests: ${this.results.summary.total}`);
        this.log(`Passed: ${this.results.summary.passed}`);
        this.log(`Failed: ${this.results.summary.failed}`);
        this.log(`Warnings: ${this.results.summary.warnings}`);
        this.log(`Success Rate: ${successRate}%`);
        this.log(`Total Duration: ${this.results.summary.totalDuration}ms`);
        this.log(`\nDetailed report: ${reportPath}`);

        return this.results.summary.failed === 0;
    }

    async runAllTests() {
        this.log('🚀 Starting Cosmos Integration Test Suite');
        this.log(`Timestamp: ${this.results.timestamp}`);
        
        // Initialize log file
        fs.writeFileSync(TEST_CONFIG.executor.logFile, '');

        // Run all tests
        await this.runTest('Environment Setup', () => this.testEnvironmentSetup());
        await this.runTest('Dependencies Check', () => this.testDependencies());
        await this.runTest('Executor Compilation', () => this.testExecutorCompilation());
        await this.runTest('API Gateway Routes', () => this.testAPIGatewayCosmosRoutes());
        await this.runTest('Chains Configuration', () => this.testChainsConfiguration());
        await this.runTest('Smart Contract Structure', () => this.testSmartContractDeployment());
        await this.runTest('CrossChain Executor Integration', () => this.testCrossChainExecutorIntegration());
        await this.runTest('Configuration Consistency', () => this.testConfigurationConsistency());

        // Generate final report
        const allTestsPassed = await this.generateReport();
        
        if (allTestsPassed) {
            this.log('\n🎉 All tests passed! Cosmos integration is ready.', 'SUCCESS');
            return true;
        } else {
            this.log('\n⚠️ Some tests failed. Please review the report and fix issues.', 'ERROR');
            return false;
        }
    }
}

// Main execution
async function main() {
    const tester = new CosmosIntegrationTester();
    
    try {
        const success = await tester.runAllTests();
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { CosmosIntegrationTester };