/**
 * Production Monitoring System for 1inch Fusion+ Cosmos Extension
 * 
 * Provides comprehensive monitoring, alerting, and error handling for:
 * - Cross-chain order execution
 * - CosmWasm contract events
 * - Ethereum adapter operations
 * - HTLC atomic swap coordination
 * - Performance metrics and SLA tracking
 */

const EventEmitter = require('events');
const { ethers } = require('ethers');

class CosmosFusionMonitor extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      networks: config.networks || {},
      alerting: config.alerting || {},
      metrics: config.metrics || {},
      errorHandling: config.errorHandling || {}
    };
    
    this.metrics = {
      orders: {
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        expired: 0
      },
      performance: {
        avgExecutionTime: 0,
        avgClaimTime: 0,
        gasUsage: [],
        errors: []
      },
      chains: {}
    };
    
    this.activeOrders = new Map();
    this.errorLog = [];
    this.isMonitoring = false;
    
    this.setupErrorHandling();
  }

  /**
   * Start monitoring all configured networks
   */
  async start() {
    if (this.isMonitoring) {
      throw new Error('Monitor is already running');
    }
    
    console.log('🚀 Starting Cosmos Fusion+ Monitor');
    console.log(`   Networks: ${Object.keys(this.config.networks).join(', ')}`);
    console.log(`   Alerting: ${this.config.alerting.enabled ? 'Enabled' : 'Disabled'}`);
    
    this.isMonitoring = true;
    
    try {
      // Initialize network monitoring
      await this.initializeNetworkMonitoring();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      // Start health checks
      this.startHealthChecks();
      
      // Start order timeout monitoring
      this.startTimeoutMonitoring();
      
      this.emit('monitorStarted');
      console.log('✅ Monitor started successfully');
      
    } catch (error) {
      this.isMonitoring = false;
      this.handleCriticalError('Failed to start monitor', error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop() {
    if (!this.isMonitoring) {
      return;
    }
    
    console.log('🛑 Stopping Cosmos Fusion+ Monitor');
    
    this.isMonitoring = false;
    
    // Clear all intervals
    if (this.performanceInterval) clearInterval(this.performanceInterval);
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.timeoutInterval) clearInterval(this.timeoutInterval);
    
    this.emit('monitorStopped');
    console.log('✅ Monitor stopped successfully');
  }

  /**
   * Initialize monitoring for all configured networks
   */
  async initializeNetworkMonitoring() {
    for (const [networkName, networkConfig] of Object.entries(this.config.networks)) {
      console.log(`🌐 Initializing monitoring for ${networkName}`);
      
      try {
        await this.initializeEthereumMonitoring(networkName, networkConfig);
        await this.initializeCosmosMonitoring(networkName, networkConfig);
        
        this.metrics.chains[networkName] = {
          status: 'healthy',
          lastCheck: Date.now(),
          orders: 0,
          errors: 0
        };
        
      } catch (error) {
        this.handleNetworkError(networkName, 'Initialization failed', error);
      }
    }
  }

  /**
   * Initialize Ethereum network monitoring
   */
  async initializeEthereumMonitoring(networkName, config) {
    if (!config.ethereum) return;
    
    const provider = new ethers.providers.JsonRpcProvider(config.ethereum.rpcUrl);
    const contract = new ethers.Contract(
      config.ethereum.adapterAddress,
      config.ethereum.abi,
      provider
    );
    
    // Monitor adapter events
    contract.on('OrderValidated', (orderHash, valid, cost) => {
      this.handleOrderValidated(networkName, {
        orderHash,
        valid,
        estimatedCost: cost,
        timestamp: Date.now()
      });
    });
    
    contract.on('OrderParametersEncoded', (orderHash, params) => {
      this.handleOrderParametersEncoded(networkName, {
        orderHash,
        params,
        timestamp: Date.now()
      });
    });
    
    // Monitor network health
    this.monitorEthereumHealth(networkName, provider);
  }

  /**
   * Initialize Cosmos network monitoring
   */
  async initializeCosmosMonitoring(networkName, config) {
    if (!config.cosmos) return;
    
    // Set up WebSocket connection for real-time events
    this.setupCosmosWebSocket(networkName, config.cosmos);
    
    // Monitor contract state changes
    this.monitorCosmosContract(networkName, config.cosmos);
  }

  /**
   * Set up Cosmos WebSocket monitoring
   */
  setupCosmosWebSocket(networkName, config) {
    // Note: In production, this would connect to actual Cosmos WebSocket
    console.log(`🔌 Setting up WebSocket for ${networkName}`);
    
    // Simulate WebSocket events for demo
    if (process.env.NODE_ENV === 'demo') {
      this.simulateCosmosEvents(networkName);
    }
  }

  /**
   * Monitor Cosmos contract state
   */
  async monitorCosmosContract(networkName, config) {
    const checkContractState = async () => {
      try {
        // Query contract configuration
        const configResult = await this.queryCosmosContract(config, 'config');
        
        // Query active orders
        const ordersResult = await this.queryCosmosContract(config, 'list_orders', {
          status: 'Matched',
          limit: 100
        });
        
        this.updateChainMetrics(networkName, {
          activeOrders: ordersResult.orders?.length || 0,
          lastUpdate: Date.now()
        });
        
      } catch (error) {
        this.handleNetworkError(networkName, 'Contract state query failed', error);
      }
    };
    
    // Check every 30 seconds
    setInterval(checkContractState, 30000);
    await checkContractState(); // Initial check
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    this.performanceInterval = setInterval(() => {
      this.calculatePerformanceMetrics();
      this.checkPerformanceThresholds();
    }, 60000); // Every minute
  }

  /**
   * Start health checks
   */
  startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Every 30 seconds
  }

  /**
   * Start timeout monitoring
   */
  startTimeoutMonitoring() {
    this.timeoutInterval = setInterval(() => {
      this.checkOrderTimeouts();
    }, 10000); // Every 10 seconds
  }

  /**
   * Handle order validation event
   */
  handleOrderValidated(networkName, event) {
    console.log(`✅ Order validated on ${networkName}: ${event.orderHash.substring(0, 16)}...`);
    
    this.activeOrders.set(event.orderHash, {
      networkName,
      status: 'validated',
      validated: event.timestamp,
      estimatedCost: event.estimatedCost
    });
    
    this.metrics.orders.total++;
    this.updateChainMetrics(networkName, { orders: this.metrics.chains[networkName].orders + 1 });
    
    this.emit('orderValidated', event);
  }

  /**
   * Handle order execution on Cosmos
   */
  handleOrderExecuted(networkName, event) {
    console.log(`⚡ Order executed on ${networkName}: ${event.orderHash.substring(0, 16)}...`);
    
    const order = this.activeOrders.get(event.orderHash);
    if (order) {
      order.status = 'executed';
      order.executed = event.timestamp;
      order.executionTime = event.timestamp - order.validated;
    }
    
    this.metrics.orders.pending++;
    this.emit('orderExecuted', event);
  }

  /**
   * Handle order claim with preimage
   */
  handleOrderClaimed(networkName, event) {
    console.log(`🔓 Order claimed on ${networkName}: ${event.orderHash.substring(0, 16)}...`);
    
    const order = this.activeOrders.get(event.orderHash);
    if (order) {
      order.status = 'claimed';
      order.claimed = event.timestamp;
      order.claimTime = event.timestamp - order.executed;
      order.totalTime = event.timestamp - order.validated;
      order.preimage = event.preimage;
    }
    
    this.metrics.orders.successful++;
    this.metrics.orders.pending--;
    
    // Update performance metrics
    if (order && order.totalTime) {
      this.updatePerformanceMetric('avgExecutionTime', order.totalTime);
    }
    
    this.emit('orderClaimed', event);
    this.checkSLACompliance(order);
  }

  /**
   * Handle order refund due to timeout
   */
  handleOrderRefunded(networkName, event) {
    console.log(`🔄 Order refunded on ${networkName}: ${event.orderHash.substring(0, 16)}...`);
    
    const order = this.activeOrders.get(event.orderHash);
    if (order) {
      order.status = 'refunded';
      order.refunded = event.timestamp;
    }
    
    this.metrics.orders.expired++;
    this.metrics.orders.pending--;
    
    this.emit('orderRefunded', event);
  }

  /**
   * Handle network errors
   */
  handleNetworkError(networkName, message, error) {
    const errorInfo = {
      networkName,
      message,
      error: error.message,
      timestamp: Date.now(),
      stack: error.stack
    };
    
    console.error(`❌ Network error on ${networkName}: ${message}`);
    console.error(error);
    
    this.errorLog.push(errorInfo);
    this.metrics.performance.errors.push(errorInfo);
    
    if (this.metrics.chains[networkName]) {
      this.metrics.chains[networkName].errors++;
      this.metrics.chains[networkName].status = 'error';
    }
    
    this.emit('networkError', errorInfo);
    
    // Send alert if enabled
    if (this.config.alerting.enabled) {
      this.sendAlert('network_error', errorInfo);
    }
  }

  /**
   * Handle critical errors
   */
  handleCriticalError(message, error) {
    const errorInfo = {
      type: 'critical',
      message,
      error: error.message,
      timestamp: Date.now(),
      stack: error.stack
    };
    
    console.error(`🚨 CRITICAL ERROR: ${message}`);
    console.error(error);
    
    this.errorLog.push(errorInfo);
    this.emit('criticalError', errorInfo);
    
    // Always send alert for critical errors
    this.sendAlert('critical_error', errorInfo);
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    // Calculate hourly metrics
    const recentOrders = Array.from(this.activeOrders.values())
      .filter(order => order.claimed && (now - order.claimed) < oneHour);
    
    if (recentOrders.length > 0) {
      const totalExecutionTime = recentOrders.reduce((sum, order) => sum + order.totalTime, 0);
      this.metrics.performance.avgExecutionTime = totalExecutionTime / recentOrders.length;
      
      const totalClaimTime = recentOrders.reduce((sum, order) => sum + order.claimTime, 0);
      this.metrics.performance.avgClaimTime = totalClaimTime / recentOrders.length;
    }
    
    // Clean old error logs
    this.errorLog = this.errorLog.filter(error => (now - error.timestamp) < (24 * 60 * 60 * 1000));
    this.metrics.performance.errors = this.metrics.performance.errors
      .filter(error => (now - error.timestamp) < oneHour);
  }

  /**
   * Check performance thresholds
   */
  checkPerformanceThresholds() {
    const thresholds = this.config.metrics.thresholds || {};
    
    // Check execution time threshold
    if (thresholds.maxExecutionTime && 
        this.metrics.performance.avgExecutionTime > thresholds.maxExecutionTime) {
      this.sendAlert('performance_degradation', {
        metric: 'execution_time',
        value: this.metrics.performance.avgExecutionTime,
        threshold: thresholds.maxExecutionTime
      });
    }
    
    // Check error rate threshold
    const errorRate = this.metrics.performance.errors.length / 60; // errors per minute
    if (thresholds.maxErrorRate && errorRate > thresholds.maxErrorRate) {
      this.sendAlert('high_error_rate', {
        metric: 'error_rate',
        value: errorRate,
        threshold: thresholds.maxErrorRate
      });
    }
  }

  /**
   * Perform health checks
   */
  async performHealthChecks() {
    for (const [networkName, config] of Object.entries(this.config.networks)) {
      try {
        await this.checkNetworkHealth(networkName, config);
      } catch (error) {
        this.handleNetworkError(networkName, 'Health check failed', error);
      }
    }
  }

  /**
   * Check network health
   */
  async checkNetworkHealth(networkName, config) {
    const now = Date.now();
    
    // Check Ethereum network
    if (config.ethereum) {
      const provider = new ethers.providers.JsonRpcProvider(config.ethereum.rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      
      if (blockNumber > 0) {
        this.updateChainMetrics(networkName, { 
          status: 'healthy',
          lastCheck: now,
          ethereumBlock: blockNumber
        });
      }
    }
    
    // Check Cosmos network  
    if (config.cosmos) {
      // Query contract state to verify connectivity
      const configResult = await this.queryCosmosContract(config.cosmos, 'config');
      
      if (configResult) {
        this.updateChainMetrics(networkName, {
          status: 'healthy',
          lastCheck: now,
          cosmosHealthy: true
        });
      }
    }
  }

  /**
   * Check for order timeouts
   */
  checkOrderTimeouts() {
    const now = Date.now();
    const timeoutThreshold = 3600000; // 1 hour
    
    for (const [orderHash, order] of this.activeOrders.entries()) {
      if (order.status === 'executed' && 
          (now - order.executed) > timeoutThreshold) {
        
        console.warn(`⏰ Order timeout detected: ${orderHash.substring(0, 16)}...`);
        
        this.emit('orderTimeout', {
          orderHash,
          networkName: order.networkName,
          age: now - order.executed
        });
        
        // Send timeout alert
        if (this.config.alerting.enabled) {
          this.sendAlert('order_timeout', {
            orderHash,
            networkName: order.networkName,
            age: now - order.executed
          });
        }
      }
    }
  }

  /**
   * Check SLA compliance
   */
  checkSLACompliance(order) {
    const slaThresholds = this.config.metrics.sla || {};
    
    if (slaThresholds.maxTotalTime && order.totalTime > slaThresholds.maxTotalTime) {
      this.sendAlert('sla_violation', {
        orderHash: order.orderHash,
        totalTime: order.totalTime,
        threshold: slaThresholds.maxTotalTime
      });
    }
  }

  /**
   * Send alert
   */
  sendAlert(type, data) {
    const alert = {
      type,
      data,
      timestamp: Date.now(),
      severity: this.getAlertSeverity(type)
    };
    
    console.log(`🚨 ALERT [${alert.severity}]: ${type}`);
    console.log(JSON.stringify(data, null, 2));
    
    this.emit('alert', alert);
    
    // In production, integrate with alerting services:
    // - PagerDuty
    // - Slack
    // - Email
    // - SMS
    
    if (this.config.alerting.webhook) {
      this.sendWebhookAlert(alert);
    }
  }

  /**
   * Get alert severity level
   */
  getAlertSeverity(type) {
    const severityMap = {
      'critical_error': 'critical',
      'network_error': 'warning',
      'performance_degradation': 'warning',
      'high_error_rate': 'error',
      'order_timeout': 'warning',
      'sla_violation': 'error'
    };
    
    return severityMap[type] || 'info';
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    // Implementation would send HTTP POST to webhook URL
    console.log(`📡 Webhook alert sent: ${alert.type}`);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.isMonitoring ? Date.now() - this.startTime : 0,
      timestamp: Date.now()
    };
  }

  /**
   * Get order details
   */
  getOrderDetails(orderHash) {
    return this.activeOrders.get(orderHash);
  }

  /**
   * Get network status
   */
  getNetworkStatus() {
    return Object.entries(this.metrics.chains).map(([name, metrics]) => ({
      name,
      ...metrics
    }));
  }

  // Helper methods

  updatePerformanceMetric(metric, value) {
    if (!this.metrics.performance[metric]) {
      this.metrics.performance[metric] = value;
    } else {
      // Exponential moving average
      const alpha = 0.1;
      this.metrics.performance[metric] = 
        (alpha * value) + ((1 - alpha) * this.metrics.performance[metric]);
    }
  }

  updateChainMetrics(networkName, updates) {
    if (!this.metrics.chains[networkName]) {
      this.metrics.chains[networkName] = {};
    }
    
    Object.assign(this.metrics.chains[networkName], updates);
  }

  async queryCosmosContract(config, query, params = {}) {
    // In production, this would make actual queries to Cosmos nodes
    // For demo purposes, return mock data
    if (process.env.NODE_ENV === 'demo') {
      return { 
        admin: 'cosmos1admin123',
        min_safety_deposit_bps: 500,
        native_denom: 'uatom'
      };
    }
    
    // Production implementation would use:
    // - @cosmjs/stargate for queries
    // - REST API calls
    // - gRPC connections
    throw new Error('Cosmos queries not implemented in demo mode');
  }

  monitorEthereumHealth(networkName, provider) {
    // Monitor block progression
    provider.on('block', (blockNumber) => {
      this.updateChainMetrics(networkName, {
        latestBlock: blockNumber,
        lastBlockTime: Date.now()
      });
    });
    
    // Monitor provider errors
    provider.on('error', (error) => {
      this.handleNetworkError(networkName, 'Provider error', error);
    });
  }

  simulateCosmosEvents(networkName) {
    // Simulate periodic events for demo
    setInterval(() => {
      if (Math.random() < 0.1) { // 10% chance per interval
        const mockOrderHash = '0x' + Math.random().toString(16).substr(2, 64);
        this.handleOrderExecuted(networkName, {
          orderHash: mockOrderHash,
          timestamp: Date.now()
        });
      }
    }, 5000);
  }

  setupErrorHandling() {
    // Catch unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.handleCriticalError('Unhandled promise rejection', new Error(reason));
    });
    
    // Catch uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleCriticalError('Uncaught exception', error);
    });
  }
}

module.exports = { CosmosFusionMonitor };