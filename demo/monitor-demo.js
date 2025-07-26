#!/usr/bin/env node

/**
 * Production Monitoring Demo for 1inch Fusion+ Cosmos Extension
 * 
 * Demonstrates comprehensive monitoring capabilities including:
 * - Real-time order tracking
 * - Network health monitoring  
 * - Performance metrics
 * - Alert system
 * - Error handling
 * 
 * Usage: node monitor-demo.js [network]
 */

const { CosmosFusionMonitor } = require('../shared/src/monitoring/cosmos-monitor');
const { NEUTRON_TESTNET, JUNO_TESTNET } = require('../shared/src/utils/fusion-plus');

// Demo configuration
const MONITOR_CONFIG = {
  networks: {
    'neutron-testnet': {
      ethereum: {
        rpcUrl: 'https://sepolia.infura.io/v3/demo',
        adapterAddress: '0x1234567890123456789012345678901234567890',
        abi: [] // Contract ABI would go here
      },
      cosmos: {
        rpcUrl: 'https://rpc-palvus.pion-1.ntrn.tech:443',
        chainId: 'pion-1',
        contractAddress: 'neutron1fusion-plus-contract-address',
        denom: 'untrn'
      }
    },
    'juno-testnet': {
      ethereum: {
        rpcUrl: 'https://sepolia.infura.io/v3/demo',
        adapterAddress: '0x2345678901234567890123456789012345678901',
        abi: []
      },
      cosmos: {
        rpcUrl: 'https://rpc.uni.junonetwork.io:443',
        chainId: 'uni-6',
        contractAddress: 'juno1fusion-plus-contract-address',
        denom: 'ujunox'
      }
    }
  },
  alerting: {
    enabled: true,
    webhook: 'https://hooks.slack.com/services/demo/webhook'
  },
  metrics: {
    thresholds: {
      maxExecutionTime: 30000, // 30 seconds
      maxErrorRate: 5, // 5 errors per minute
    },
    sla: {
      maxTotalTime: 60000 // 1 minute total time
    }
  },
  errorHandling: {
    maxRetries: 3,
    retryDelay: 5000
  }
};

class MonitorDemo {
  constructor(network = 'neutron-testnet') {
    this.network = network;
    this.monitor = new CosmosFusionMonitor(MONITOR_CONFIG);
    this.setupEventListeners();
    this.demoData = {
      ordersCreated: 0,
      alertsSent: 0,
      errorsHandled: 0
    };
  }

  setupEventListeners() {
    // Monitor startup/shutdown
    this.monitor.on('monitorStarted', () => {
      this.log('🚀 Monitor started successfully', 'green');
    });

    this.monitor.on('monitorStopped', () => {
      this.log('🛑 Monitor stopped', 'yellow');
    });

    // Order events
    this.monitor.on('orderValidated', (event) => {
      this.log(`✅ Order validated: ${event.orderHash.substring(0, 16)}...`, 'green');
      this.log(`   Network: ${event.networkName || 'unknown'}`);
      this.log(`   Estimated cost: ${event.estimatedCost || 'unknown'}`);
    });

    this.monitor.on('orderExecuted', (event) => {
      this.log(`⚡ Order executed: ${event.orderHash.substring(0, 16)}...`, 'blue');
      this.log(`   Network: ${event.networkName || 'unknown'}`);
    });

    this.monitor.on('orderClaimed', (event) => {
      this.log(`🔓 Order claimed: ${event.orderHash.substring(0, 16)}...`, 'green');
      this.log(`   Network: ${event.networkName || 'unknown'}`);
      this.log(`   Preimage: ${event.preimage?.substring(0, 16) || 'unknown'}...`);
    });

    this.monitor.on('orderRefunded', (event) => {
      this.log(`🔄 Order refunded: ${event.orderHash.substring(0, 16)}...`, 'yellow');
      this.log(`   Network: ${event.networkName || 'unknown'}`);
    });

    this.monitor.on('orderTimeout', (event) => {
      this.log(`⏰ Order timeout: ${event.orderHash.substring(0, 16)}...`, 'red');
      this.log(`   Network: ${event.networkName}`);
      this.log(`   Age: ${Math.floor(event.age / 1000)}s`);
    });

    // Error handling
    this.monitor.on('networkError', (error) => {
      this.log(`❌ Network error on ${error.networkName}: ${error.message}`, 'red');
      this.demoData.errorsHandled++;
    });

    this.monitor.on('criticalError', (error) => {
      this.log(`🚨 CRITICAL ERROR: ${error.message}`, 'red');
      this.demoData.errorsHandled++;
    });

    // Alerts
    this.monitor.on('alert', (alert) => {
      this.handleAlert(alert);
    });
  }

  async run() {
    this.log('\n🔍 1inch Fusion+ Cosmos Extension - Monitoring Demo', 'bright');
    this.log(`🌐 Network: ${this.network}`, 'blue');
    this.log('', 'reset');

    try {
      // Start monitoring
      await this.monitor.start();
      
      // Run demo scenarios
      await this.runDemoScenarios();
      
      // Show final metrics
      this.showMetrics();
      
    } catch (error) {
      this.log(`❌ Demo failed: ${error.message}`, 'red');
      console.error(error);
    } finally {
      // Cleanup
      setTimeout(async () => {
        await this.monitor.stop();
        process.exit(0);
      }, 2000);
    }
  }

  async runDemoScenarios() {
    this.log('🎭 Running demo scenarios...', 'cyan');
    
    // Scenario 1: Successful order flow
    await this.scenarioSuccessfulOrder();
    
    await this.delay(2000);
    
    // Scenario 2: Order timeout
    await this.scenarioOrderTimeout();
    
    await this.delay(2000);
    
    // Scenario 3: Network error
    await this.scenarioNetworkError();
    
    await this.delay(2000);
    
    // Scenario 4: Performance degradation
    await this.scenarioPerformanceDegradation();
    
    await this.delay(2000);
    
    // Scenario 5: High error rate
    await this.scenarioHighErrorRate();
  }

  async scenarioSuccessfulOrder() {
    this.log('\n📋 Scenario 1: Successful order flow', 'cyan');
    
    const orderHash = this.generateOrderHash();
    
    // Step 1: Order validation
    this.monitor.handleOrderValidated(this.network, {
      orderHash,
      valid: true,
      estimatedCost: 15000,
      timestamp: Date.now()
    });
    
    await this.delay(1000);
    
    // Step 2: Order execution  
    this.monitor.handleOrderExecuted(this.network, {
      orderHash,
      timestamp: Date.now()
    });
    
    await this.delay(2000);
    
    // Step 3: Order claim
    this.monitor.handleOrderClaimed(this.network, {
      orderHash,
      preimage: 'demo-secret-' + Date.now(),
      timestamp: Date.now()
    });
    
    this.demoData.ordersCreated++;
    this.log('✅ Successful order flow completed', 'green');
  }

  async scenarioOrderTimeout() {
    this.log('\n⏰ Scenario 2: Order timeout', 'cyan');
    
    const orderHash = this.generateOrderHash();
    
    // Create an order that will timeout
    this.monitor.handleOrderValidated(this.network, {
      orderHash,
      valid: true,
      estimatedCost: 12000,
      timestamp: Date.now() - 3700000 // 1 hour and 1 minute ago
    });
    
    this.monitor.handleOrderExecuted(this.network, {
      orderHash,
      timestamp: Date.now() - 3600000 // 1 hour ago
    });
    
    // Trigger timeout check
    this.monitor.checkOrderTimeouts();
    
    this.log('⚠️  Order timeout scenario completed', 'yellow');
  }

  async scenarioNetworkError() {
    this.log('\n❌ Scenario 3: Network error handling', 'cyan');
    
    // Simulate network error
    const error = new Error('Connection timeout to Cosmos RPC');
    error.code = 'NETWORK_ERROR';
    
    this.monitor.handleNetworkError(this.network, 'RPC connection failed', error);
    
    this.log('⚠️  Network error scenario completed', 'yellow');
  }

  async scenarioPerformanceDegradation() {
    this.log('\n📉 Scenario 4: Performance degradation', 'cyan');
    
    // Create slow orders to trigger performance alert
    for (let i = 0; i < 3; i++) {
      const orderHash = this.generateOrderHash();
      const now = Date.now();
      
      this.monitor.handleOrderValidated(this.network, {
        orderHash,
        valid: true,
        estimatedCost: 20000,
        timestamp: now - 45000 // 45 seconds ago
      });
      
      this.monitor.handleOrderExecuted(this.network, {
        orderHash,
        timestamp: now - 40000 // 40 seconds ago  
      });
      
      this.monitor.handleOrderClaimed(this.network, {
        orderHash,
        preimage: 'slow-demo-' + i,
        timestamp: now // Just now (40 second execution)
      });
      
      await this.delay(500);
    }
    
    // Trigger performance calculation
    this.monitor.calculatePerformanceMetrics();
    this.monitor.checkPerformanceThresholds();
    
    this.log('⚠️  Performance degradation scenario completed', 'yellow');
  }

  async scenarioHighErrorRate() {
    this.log('\n🚨 Scenario 5: High error rate', 'cyan');
    
    // Generate multiple errors quickly
    for (let i = 0; i < 8; i++) {
      const error = new Error(`Demo error ${i + 1}`);
      error.code = 'DEMO_ERROR';
      
      this.monitor.handleNetworkError(this.network, `Demo error ${i + 1}`, error);
      await this.delay(100);
    }
    
    // Trigger error rate check
    this.monitor.checkPerformanceThresholds();
    
    this.log('⚠️  High error rate scenario completed', 'yellow');
  }

  handleAlert(alert) {
    const icons = {
      critical: '🚨',
      error: '❌', 
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const icon = icons[alert.severity] || 'ℹ️';
    
    this.log(`\n${icon} ALERT [${alert.severity.toUpperCase()}]: ${alert.type}`, 'red');
    this.log(`   Timestamp: ${new Date(alert.timestamp).toISOString()}`);
    
    if (alert.data) {
      Object.entries(alert.data).forEach(([key, value]) => {
        if (typeof value === 'object') {
          this.log(`   ${key}: ${JSON.stringify(value)}`);
        } else {
          this.log(`   ${key}: ${value}`);
        }
      });
    }
    
    this.demoData.alertsSent++;
  }

  showMetrics() {
    this.log('\n📊 Final Monitoring Metrics', 'bright');
    
    const metrics = this.monitor.getMetrics();
    
    this.log('\n📈 Order Statistics:', 'cyan');
    this.log(`   Total Orders: ${metrics.orders.total}`);
    this.log(`   Successful: ${metrics.orders.successful}`);
    this.log(`   Failed: ${metrics.orders.failed}`);
    this.log(`   Pending: ${metrics.orders.pending}`);
    this.log(`   Expired: ${metrics.orders.expired}`);
    
    this.log('\n⚡ Performance Metrics:', 'cyan');
    this.log(`   Avg Execution Time: ${Math.round(metrics.performance.avgExecutionTime)}ms`);
    this.log(`   Avg Claim Time: ${Math.round(metrics.performance.avgClaimTime)}ms`);
    this.log(`   Recent Errors: ${metrics.performance.errors.length}`);
    
    this.log('\n🌐 Network Status:', 'cyan');
    Object.entries(metrics.chains).forEach(([name, chain]) => {
      const status = chain.status === 'healthy' ? '✅' : '❌';
      this.log(`   ${name}: ${status} ${chain.status}`);
      this.log(`     Orders: ${chain.orders || 0}`);
      this.log(`     Errors: ${chain.errors || 0}`);
      this.log(`     Last Check: ${new Date(chain.lastCheck).toISOString()}`);
    });
    
    this.log('\n🎯 Demo Statistics:', 'cyan');
    this.log(`   Orders Created: ${this.demoData.ordersCreated}`);
    this.log(`   Alerts Sent: ${this.demoData.alertsSent}`);
    this.log(`   Errors Handled: ${this.demoData.errorsHandled}`);
    this.log(`   Demo Duration: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
    
    this.log('\n🚀 Production Features Demonstrated:', 'green');
    this.log('   ✅ Real-time order monitoring');
    this.log('   ✅ Network health checks');
    this.log('   ✅ Performance metric tracking');
    this.log('   ✅ Automated alerting system');
    this.log('   ✅ Error handling and recovery');
    this.log('   ✅ SLA compliance monitoring');
    this.log('   ✅ Timeout detection');
    this.log('   ✅ Cross-chain coordination tracking');
  }

  // Helper methods

  generateOrderHash() {
    return '0x' + Math.random().toString(16).substr(2, 64).padStart(64, '0');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(message, color = 'reset') {
    const colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
    
    console.log(`${colors[color]}${message}${colors.reset}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const network = args[0] || 'neutron-testnet';
  
  // Set demo mode
  process.env.NODE_ENV = 'demo';
  
  const demo = new MonitorDemo(network);
  demo.startTime = Date.now();
  
  await demo.run();
}

// Handle CLI execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MonitorDemo };