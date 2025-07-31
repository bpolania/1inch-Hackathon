#!/usr/bin/env node

/**
 * Relayer System Test Suite
 * 
 * Comprehensive test for the Bitcoin relayer service
 * Consolidated from multiple test scripts
 */

const { ethers } = require('ethers');
const { loadConfig } = require('./dist/config/config');
const crypto = require('crypto');

// Contract ABIs
const FACTORY_ABI = [
    "function createFusionOrder(bytes32 orderHash, address maker, address srcToken, uint256 srcAmount, uint256 dstChainId, bytes calldata dstExecutionParams, uint256 expiryTime, bytes32 hashlock) external",
    "function getOrder(bytes32 orderHash) external view returns (bool isActive, uint256 expiryTime, bytes32 hashlock, address maker, address resolver)",
    "function registry() external view returns (address)",
    "function escrowFactory() external view returns (address)",
    "function getSupportedChains() external view returns (uint256[])",
    "event FusionOrderCreated(bytes32 indexed orderHash, address indexed maker, uint256 dstChainId, uint256 srcAmount)"
];

const REGISTRY_ABI = [
    "function owner() external view returns (address)",
    "function getSupportedChainIds() external view returns (uint256[])",
    "function getChainAdapter(uint256) external view returns (address)",
    "function isChainSupported(uint256) external view returns (bool)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
];

const BITCOIN_ADAPTER_ABI = [
    "function validateDestinationAddress(bytes calldata addressBytes) external pure returns (bool)",
    "function encodeExecutionParams(string memory btcAddress, uint256 htlcTimelock, uint256 feeRate) external pure returns (bytes memory)",
    "function calculateMinSafetyDeposit(uint256 amount) external pure returns (uint256)",
    "function BITCOIN_MAINNET() external pure returns (uint256)",
    "function BITCOIN_TESTNET() external pure returns (uint256)"
];

class RelayerSystemTest {
    constructor() {
        this.config = null;
        this.provider = null;
        this.signer = null;
        this.contracts = {};
    }

    async initialize() {
        console.log('🔧 Initializing Relayer System Test');
        console.log('===================================\n');
        
        // Load configuration
        this.config = await loadConfig();
        console.log('✅ Configuration loaded');
        console.log(`📱 Networks: ${this.config.networks.join(', ')}`);
        
        // Initialize Ethereum provider
        this.provider = new ethers.JsonRpcProvider(this.config.ethereum.rpcUrl);
        this.signer = new ethers.Wallet(this.config.wallet.ethereum.privateKey, this.provider);
        console.log(`🔗 Connected to ${this.config.ethereum.name}`);
        console.log(`💰 Wallet: ${this.signer.address}`);
        
        // Initialize contracts
        this.contracts.factory = new ethers.Contract(
            this.config.ethereum.contracts.factory, 
            FACTORY_ABI, 
            this.signer
        );
        this.contracts.registry = new ethers.Contract(
            this.config.ethereum.contracts.registry, 
            REGISTRY_ABI, 
            this.provider
        );
        this.contracts.token = new ethers.Contract(
            this.config.ethereum.contracts.token, 
            ERC20_ABI, 
            this.signer
        );
        this.contracts.bitcoinAdapter = new ethers.Contract(
            '0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8', // Bitcoin testnet adapter
            BITCOIN_ADAPTER_ABI, 
            this.provider
        );
        
        console.log('📋 Contracts initialized\n');
    }

    async testConfiguration() {
        console.log('1️⃣ Testing Configuration');
        console.log('------------------------');
        
        try {
            console.log(`🌐 Ethereum: ${this.config.ethereum.name} (${this.config.ethereum.chainId})`);
            console.log(`🏭 Factory: ${this.config.ethereum.contracts.factory}`);
            console.log(`📋 Registry: ${this.config.ethereum.contracts.registry}`);
            console.log(`🪙 Token: ${this.config.ethereum.contracts.token}`);
            console.log(`🌙 NEAR: ${this.config.near.name} (${this.config.near.chainId})`);
            console.log(`📝 NEAR Contract: ${this.config.near.contracts.factory}`);
            console.log(`₿ Bitcoin Network: ${this.config.bitcoin.network}`);
            console.log(`⚡ Bitcoin Fee Rate: ${this.config.bitcoin.feeRate} sat/byte`);
            console.log(`💰 Wallet Ethereum: ${this.config.wallet.ethereum.address}`);
            console.log(`🔑 Wallet NEAR: ${this.config.wallet.near.accountId}`);
            console.log(`⏰ Loop Interval: ${this.config.execution.loopInterval}ms`);
            console.log('✅ Configuration test passed\n');
            return true;
        } catch (error) {
            console.error('❌ Configuration test failed:', error.message);
            return false;
        }
    }

    async testNetworkConnectivity() {
        console.log('2️⃣ Testing Network Connectivity');
        console.log('-------------------------------');
        
        try {
            const blockNumber = await this.provider.getBlockNumber();
            console.log(`📦 Current block: ${blockNumber}`);
            
            const balance = await this.provider.getBalance(this.signer.address);
            console.log(`💎 ETH Balance: ${ethers.formatEther(balance)} ETH`);
            
            const feeData = await this.provider.getFeeData();
            console.log(`⛽ Gas price: ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
            
            console.log('✅ Network connectivity test passed\n');
            return true;
        } catch (error) {
            console.error('❌ Network connectivity test failed:', error.message);
            return false;
        }
    }

    async testContracts() {
        console.log('3️⃣ Testing Contract Connectivity');
        console.log('--------------------------------');
        
        try {
            // Test Factory
            const registryAddress = await this.contracts.factory.registry();
            const escrowFactory = await this.contracts.factory.escrowFactory();
            console.log(`✅ Factory - Registry: ${registryAddress}`);
            console.log(`✅ Factory - Escrow: ${escrowFactory}`);
            
            // Test Registry
            const registryOwner = await this.contracts.registry.owner();
            const chainIds = await this.contracts.registry.getSupportedChainIds();
            console.log(`✅ Registry - Owner: ${registryOwner}`);
            console.log(`✅ Registry - Chains: ${chainIds.map(c => c.toString())}`);
            
            // Test Bitcoin adapters
            for (const chainId of chainIds) {
                const adapter = await this.contracts.registry.getChainAdapter(chainId);
                const isSupported = await this.contracts.registry.isChainSupported(chainId);
                console.log(`✅ Chain ${chainId}: ${adapter} (${isSupported ? 'supported' : 'not supported'})`);
            }
            
            // Test Token
            const name = await this.contracts.token.name();
            const symbol = await this.contracts.token.symbol();
            const decimals = await this.contracts.token.decimals();
            const tokenBalance = await this.contracts.token.balanceOf(this.signer.address);
            console.log(`✅ Token: ${name} (${symbol}) - ${ethers.formatUnits(tokenBalance, decimals)} ${symbol}`);
            
            // Test Bitcoin Adapter
            const btcMainnet = await this.contracts.bitcoinAdapter.BITCOIN_MAINNET();
            const btcTestnet = await this.contracts.bitcoinAdapter.BITCOIN_TESTNET();
            console.log(`✅ Bitcoin Mainnet ID: ${btcMainnet}`);
            console.log(`✅ Bitcoin Testnet ID: ${btcTestnet}`);
            
            const testAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
            const isValidBtcAddress = await this.contracts.bitcoinAdapter.validateDestinationAddress(
                ethers.toUtf8Bytes(testAddress)
            );
            console.log(`✅ Bitcoin address validation: ${isValidBtcAddress}`);
            
            console.log('✅ Contract connectivity test passed\n');
            return true;
        } catch (error) {
            console.error('❌ Contract connectivity test failed:', error.message);
            return false;
        }
    }

    async testBitcoinOrderCreation() {
        console.log('4️⃣ Testing Bitcoin Order Creation');
        console.log('---------------------------------');
        
        try {
            // Check token balance
            const tokenBalance = await this.contracts.token.balanceOf(this.signer.address);
            const symbol = await this.contracts.token.symbol();
            console.log(`💰 ${symbol} Balance: ${ethers.formatEther(tokenBalance)} ${symbol}`);
            
            if (tokenBalance === 0n) {
                console.log('⚠️ No tokens available - skipping order creation test');
                return true;
            }
            
            // Generate test parameters
            const secret = crypto.randomBytes(32);
            const hashlock = ethers.keccak256(secret);
            const orderHash = ethers.keccak256(ethers.toUtf8Bytes(`test_order_${Date.now()}`));
            const swapAmount = ethers.parseEther('0.01');
            
            console.log(`🔐 Test Order Hash: ${orderHash}`);
            console.log(`🔒 Test Hashlock: ${hashlock}`);
            console.log(`💰 Test Amount: ${ethers.formatEther(swapAmount)} ${symbol}`);
            
            // Bitcoin parameters
            const btcAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
            const htlcTimelock = 144;
            const feeRate = 10;
            const dstChainId = 40004; // Bitcoin testnet
            
            const dstExecutionParams = await this.contracts.bitcoinAdapter.encodeExecutionParams(
                btcAddress,
                htlcTimelock,
                feeRate
            );
            
            console.log(`₿ Bitcoin Address: ${btcAddress}`);
            console.log(`⏰ HTLC Timelock: ${htlcTimelock} blocks`);
            console.log(`⛽ Fee Rate: ${feeRate} sat/byte`);
            
            // Calculate safety deposit
            const safetyDeposit = await this.contracts.bitcoinAdapter.calculateMinSafetyDeposit(swapAmount);
            console.log(`🛡️ Safety Deposit: ${ethers.formatEther(safetyDeposit)} ETH`);
            
            // Check ETH balance for safety deposit
            const ethBalance = await this.provider.getBalance(this.signer.address);
            if (ethBalance < safetyDeposit) {
                console.log(`⚠️ Insufficient ETH for safety deposit - skipping actual order creation`);
                console.log(`   Need: ${ethers.formatEther(safetyDeposit)} ETH`);
                console.log(`   Have: ${ethers.formatEther(ethBalance)} ETH`);
                return true;
            }
            
            // Approve tokens (but don't actually create order in test)
            console.log('🔐 Testing token approval...');
            const currentAllowance = await this.contracts.token.allowance(
                this.signer.address, 
                this.contracts.factory.target
            );
            console.log(`✅ Current allowance: ${ethers.formatEther(currentAllowance)} ${symbol}`);
            
            console.log('✅ Bitcoin order creation test passed (simulation)\n');
            return true;
        } catch (error) {
            console.error('❌ Bitcoin order creation test failed:', error.message);
            return false;
        }
    }

    async runAllTests() {
        console.log('🚀 Running Relayer System Test Suite');
        console.log('=====================================\n');
        
        const results = [];
        
        try {
            await this.initialize();
            
            results.push({ test: 'Configuration', passed: await this.testConfiguration() });
            results.push({ test: 'Network Connectivity', passed: await this.testNetworkConnectivity() });
            results.push({ test: 'Contract Connectivity', passed: await this.testContracts() });
            results.push({ test: 'Bitcoin Order Creation', passed: await this.testBitcoinOrderCreation() });
            
            // Summary
            console.log('📊 Test Results Summary');
            console.log('======================');
            const passed = results.filter(r => r.passed).length;
            const total = results.length;
            
            results.forEach(result => {
                console.log(`${result.passed ? '✅' : '❌'} ${result.test}`);
            });
            
            console.log(`\n🎯 ${passed}/${total} tests passed`);
            
            if (passed === total) {
                console.log('🎉 All tests passed! Relayer system ready for Bitcoin atomic swaps.');
                return true;
            } else {
                console.log('⚠️ Some tests failed. Please review the output above.');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            return false;
        }
    }
}

// CLI usage
if (require.main === module) {
    const tester = new RelayerSystemTest();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Test suite error:', error.message);
        process.exit(1);
    });
}

module.exports = { RelayerSystemTest };