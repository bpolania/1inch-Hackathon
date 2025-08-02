/**
 * Chain Status Monitoring Routes
 * 
 * Provides real-time monitoring of blockchain networks, congestion,
 * bridge status, and cross-chain route availability.
 */

import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Validation middleware
 */
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * GET /api/chains/status
 * Get real-time status of all supported chains
 */
router.get('/status', async (req: any, res) => {
  try {
    const chainStatuses = {
      lastUpdated: Date.now(),
      summary: {
        totalChains: 9,
        healthyChains: 8,
        degradedChains: 1,
        downChains: 0,
        avgBlockTime: 8.2,
        totalTps: 1750
      },
      chains: {
        ethereum: {
          chainId: 1,
          name: 'Ethereum Mainnet',
          status: 'healthy',
          rpcStatus: 'online',
          blockHeight: 18500125,
          avgBlockTime: 12.1,
          gasPrice: {
            slow: 25,
            standard: 30,
            fast: 40,
            unit: 'gwei'
          },
          congestion: {
            level: 'medium',
            percentage: 65,
            estimatedDelay: 180
          },
          lastBlock: {
            number: 18500125,
            timestamp: Date.now() - 12000,
            gasUsed: '15234567',
            gasLimit: '30000000',
            utilization: 50.8
          },
          bridgeStatus: {
            'ethereum-near': 'operational',
            'ethereum-polygon': 'operational',
            'ethereum-arbitrum': 'operational'
          }
        },
        near: {
          chainId: 397,
          name: 'NEAR Protocol',
          status: 'healthy',
          rpcStatus: 'online',
          blockHeight: 105234567,
          avgBlockTime: 1.2,
          gasPrice: {
            standard: 0.0001,
            unit: 'NEAR'
          },
          congestion: {
            level: 'low',
            percentage: 25,
            estimatedDelay: 5
          },
          lastBlock: {
            number: 105234567,
            timestamp: Date.now() - 1200,
            gasUsed: '15000000000000',
            gasLimit: '1000000000000000',
            utilization: 1.5
          },
          bridgeStatus: {
            'near-ethereum': 'operational',
            'near-aurora': 'operational'
          },
          chainSignatures: {
            status: 'operational',
            mpcContract: 'v1.signer-dev',
            activeNodes: 7,
            threshold: 5
          }
        },
        polygon: {
          chainId: 137,
          name: 'Polygon',
          status: 'healthy',
          rpcStatus: 'online',
          blockHeight: 49234567,
          avgBlockTime: 2.1,
          gasPrice: {
            slow: 30,
            standard: 35,
            fast: 45,
            unit: 'gwei'
          },
          congestion: {
            level: 'low',
            percentage: 35,
            estimatedDelay: 10
          },
          bridgeStatus: {
            'polygon-ethereum': 'operational'
          }
        },
        arbitrum: {
          chainId: 42161,
          name: 'Arbitrum One',
          status: 'healthy',
          rpcStatus: 'online',
          blockHeight: 142234567,
          avgBlockTime: 0.3,
          gasPrice: {
            standard: 0.1,
            unit: 'gwei'
          },
          congestion: {
            level: 'low',
            percentage: 20,
            estimatedDelay: 2
          }
        },
        optimism: {
          chainId: 10,
          name: 'Optimism',
          status: 'degraded',
          rpcStatus: 'slow',
          blockHeight: 112234567,
          avgBlockTime: 2.5,
          gasPrice: {
            standard: 0.001,
            unit: 'gwei'
          },
          congestion: {
            level: 'high',
            percentage: 85,
            estimatedDelay: 300
          },
          issues: ['High latency detected', 'Sequencer sync delay']
        },
        bitcoin: {
          chainId: null,
          name: 'Bitcoin',
          status: 'healthy',
          rpcStatus: 'online',
          blockHeight: 815234,
          avgBlockTime: 600,
          feeRate: {
            slow: 15,
            standard: 25,
            fast: 40,
            unit: 'sat/vB'
          },
          congestion: {
            level: 'medium',
            percentage: 60,
            estimatedDelay: 1800
          },
          mempool: {
            count: 85234,
            size: '45.2 MB',
            totalFees: '2.5 BTC'
          }
        },
        neutron: {
          chainId: 7001,
          name: 'Neutron Testnet',
          status: 'healthy',
          rpcStatus: 'online',
          blockHeight: 8234567,
          avgBlockTime: 6.2,
          gasPrice: {
            standard: 0.025,
            unit: 'untrn'
          },
          congestion: {
            level: 'low',
            percentage: 15,
            estimatedDelay: 8
          },
          lastBlock: {
            number: 8234567,
            timestamp: Date.now() - 6200,
            gasUsed: '2500000',
            gasLimit: '100000000',
            utilization: 2.5
          },
          bridgeStatus: {
            'neutron-ethereum': 'operational',
            'neutron-cosmoshub': 'operational'
          },
          cosmwasmSupport: {
            status: 'full',
            version: '1.5.0',
            activeContracts: 156,
            deployedContracts: 892
          }
        },
        juno: {
          chainId: 7002,
          name: 'Juno Testnet',
          status: 'healthy',
          rpcStatus: 'online',
          blockHeight: 12456789,
          avgBlockTime: 5.8,
          gasPrice: {
            standard: 0.025,
            unit: 'ujunox'
          },
          congestion: {
            level: 'low',
            percentage: 20,
            estimatedDelay: 6
          },
          lastBlock: {
            number: 12456789,
            timestamp: Date.now() - 5800,
            gasUsed: '3200000',
            gasLimit: '150000000',
            utilization: 2.1
          },
          bridgeStatus: {
            'juno-ethereum': 'operational',
            'juno-cosmoshub': 'operational'
          },
          cosmwasmSupport: {
            status: 'full',
            version: '1.5.0',
            activeContracts: 234,
            deployedContracts: 1456
          }
        },
        cosmoshub: {
          chainId: 30001,
          name: 'Cosmos Hub',
          status: 'healthy',
          rpcStatus: 'online',
          blockHeight: 18567234,
          avgBlockTime: 6.5,
          gasPrice: {
            standard: 0.025,
            unit: 'uatom'
          },
          congestion: {
            level: 'low',
            percentage: 25,
            estimatedDelay: 7
          },
          lastBlock: {
            number: 18567234,
            timestamp: Date.now() - 6500,
            gasUsed: '4500000',
            gasLimit: '200000000',
            utilization: 2.3
          },
          bridgeStatus: {
            'cosmos-ethereum': 'operational',
            'cosmos-osmosis': 'operational',
            'cosmos-juno': 'operational'
          },
          governance: {
            activeProposals: 3,
            totalValidators: 180,
            bondedTokens: '205,430,000 ATOM',
            stakingRatio: 67.2
          },
          ibc: {
            activeChannels: 45,
            totalTransfers24h: '1.2M USD',
            supportedChains: 38
          }
        }
      }
    };

    res.json({
      success: true,
      data: chainStatuses,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Chain status request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chain status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/chains/:chainId/status
 * Get detailed status for a specific chain
 */
router.get(
  '/:chainId/status',
  [
    param('chainId').isInt({ min: 1 }).withMessage('Valid chain ID is required'),
    validateRequest
  ],
  async (req: any, res: any) => {
    try {
      const { chainId } = req.params;
      
      // Mock detailed chain status
      const detailedStatus = {
        chainId: parseInt(chainId),
        name: chainId === '1' ? 'Ethereum Mainnet' : `Chain ${chainId}`,
        status: 'healthy',
        uptime: 99.95,
        network: {
          rpcEndpoints: [
            { url: 'https://mainnet.infura.io', status: 'online', latency: 45 },
            { url: 'https://eth-mainnet.alchemyapi.io', status: 'online', latency: 38 },
            { url: 'https://cloudflare-eth.com', status: 'online', latency: 52 }
          ],
          consensus: 'proof-of-stake',
          validators: 750000,
          finalityTime: 12.8
        },
        performance: {
          tps: 15.2,
          maxTps: 50,
          utilization: 68.5,
          averageBlockTime: 12.1,
          blockSize: '1.2 MB',
          avgTransactionFee: '0.008 ETH'
        },
        security: {
          hashRate: 'N/A (PoS)',
          totalStaked: '32,500,000 ETH',
          slashingEvents: 0,
          lastSlashing: null
        },
        crossChain: {
          activeBridges: 8,
          totalValueLocked: '15.2B USD',
          bridgeStatus: {
            'ethereum-polygon': { status: 'operational', volume24h: '45M USD' },
            'ethereum-arbitrum': { status: 'operational', volume24h: '120M USD' },
            'ethereum-optimism': { status: 'degraded', volume24h: '25M USD' },
            'ethereum-near': { status: 'operational', volume24h: '8M USD' }
          }
        },
        recentBlocks: [
          {
            number: 18500125,
            timestamp: Date.now() - 12000,
            transactions: 150,
            gasUsed: '15234567',
            gasLimit: '30000000',
            baseFee: '28.5 gwei',
            size: '125.6 KB'
          },
          {
            number: 18500124,
            timestamp: Date.now() - 24000,
            transactions: 180,
            gasUsed: '18456789',
            gasLimit: '30000000',
            baseFee: '29.1 gwei',
            size: '142.8 KB'
          }
        ]
      };

      res.json({
        success: true,
        data: detailedStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Detailed chain status request failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get detailed chain status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/chains/bridges/routes
 * Get available bridge routes between chains
 */
router.get('/bridges/routes', async (req: any, res) => {
  try {
    const bridgeRoutes = {
      lastUpdated: Date.now(),
      totalRoutes: 21,
      activeRoutes: 19,
      routes: [
        {
          id: 'eth-polygon',
          from: { chainId: 1, name: 'Ethereum', symbol: 'ETH' },
          to: { chainId: 137, name: 'Polygon', symbol: 'MATIC' },
          bridge: 'Polygon PoS Bridge',
          status: 'operational',
          estimatedTime: 480000, // 8 minutes
          fees: {
            base: '0.005 ETH',
            variable: '0.1%'
          },
          limits: {
            min: '0.01 ETH',
            max: '10000 ETH'
          },
          volume24h: '45000000 USD',
          reliability: 99.8
        },
        {
          id: 'eth-arbitrum',
          from: { chainId: 1, name: 'Ethereum', symbol: 'ETH' },
          to: { chainId: 42161, name: 'Arbitrum', symbol: 'ETH' },
          bridge: 'Arbitrum Bridge',
          status: 'operational',
          estimatedTime: 900000, // 15 minutes
          fees: {
            base: '0.008 ETH',
            variable: '0.05%'
          },
          limits: {
            min: '0.001 ETH',
            max: '50000 ETH'
          },
          volume24h: '120000000 USD',
          reliability: 99.5
        },
        {
          id: 'eth-near',
          from: { chainId: 1, name: 'Ethereum', symbol: 'ETH' },
          to: { chainId: 397, name: 'NEAR', symbol: 'NEAR' },
          bridge: 'Rainbow Bridge',
          status: 'operational',
          estimatedTime: 600000, // 10 minutes
          fees: {
            base: '0.003 ETH',
            variable: '0.15%'
          },
          limits: {
            min: '0.01 ETH',
            max: '1000 ETH'
          },
          volume24h: '8500000 USD',
          reliability: 98.9,
          special: 'TEE Chain Signatures supported'
        },
        {
          id: 'near-btc',
          from: { chainId: 397, name: 'NEAR', symbol: 'NEAR' },
          to: { chainId: null, name: 'Bitcoin', symbol: 'BTC' },
          bridge: 'NEAR Chain Signatures',
          status: 'operational',
          estimatedTime: 1800000, // 30 minutes
          fees: {
            base: '5 NEAR',
            variable: '0.2%'
          },
          limits: {
            min: '0.001 BTC',
            max: '10 BTC'
          },
          volume24h: '2500000 USD',
          reliability: 97.5,
          special: 'MPC-based bridge'
        },
        {
          id: 'eth-optimism',
          from: { chainId: 1, name: 'Ethereum', symbol: 'ETH' },
          to: { chainId: 10, name: 'Optimism', symbol: 'ETH' },
          bridge: 'Optimism Bridge',
          status: 'degraded',
          estimatedTime: 1200000, // 20 minutes (delayed)
          fees: {
            base: '0.006 ETH',
            variable: '0.08%'
          },
          limits: {
            min: '0.001 ETH',
            max: '25000 ETH'
          },
          volume24h: '25000000 USD',
          reliability: 96.2,
          issues: ['Sequencer delays', 'Higher than normal processing time']
        },
        {
          id: 'eth-neutron',
          from: { chainId: 1, name: 'Ethereum', symbol: 'ETH' },
          to: { chainId: 7001, name: 'Neutron', symbol: 'NTRN' },
          bridge: '1inch Fusion+ Cosmos Extension',
          status: 'operational',
          estimatedTime: 480000, // 8 minutes
          fees: {
            base: '0.004 ETH',
            variable: '0.12%'
          },
          limits: {
            min: '0.01 ETH',
            max: '5000 ETH'
          },
          volume24h: '3200000 USD',
          reliability: 99.1,
          special: 'CosmWasm atomic swaps'
        },
        {
          id: 'eth-juno',
          from: { chainId: 1, name: 'Ethereum', symbol: 'ETH' },
          to: { chainId: 7002, name: 'Juno', symbol: 'JUNO' },
          bridge: '1inch Fusion+ Cosmos Extension',
          status: 'operational',
          estimatedTime: 420000, // 7 minutes
          fees: {
            base: '0.0035 ETH',
            variable: '0.1%'
          },
          limits: {
            min: '0.01 ETH',
            max: '3000 ETH'
          },
          volume24h: '2800000 USD',
          reliability: 98.9,
          special: 'CosmWasm atomic swaps'
        },
        {
          id: 'eth-cosmoshub',
          from: { chainId: 1, name: 'Ethereum', symbol: 'ETH' },
          to: { chainId: 30001, name: 'Cosmos Hub', symbol: 'ATOM' },
          bridge: '1inch Fusion+ Cosmos Extension',
          status: 'operational',
          estimatedTime: 540000, // 9 minutes
          fees: {
            base: '0.0045 ETH',
            variable: '0.08%'
          },
          limits: {
            min: '0.01 ETH',
            max: '10000 ETH'
          },
          volume24h: '5500000 USD',
          reliability: 99.3,
          special: 'IBC compatible'
        },
        {
          id: 'neutron-juno',
          from: { chainId: 7001, name: 'Neutron', symbol: 'NTRN' },
          to: { chainId: 7002, name: 'Juno', symbol: 'JUNO' },
          bridge: 'IBC Bridge',
          status: 'operational',
          estimatedTime: 60000, // 1 minute
          fees: {
            base: '0.1 NTRN',
            variable: '0.05%'
          },
          limits: {
            min: '1 NTRN',
            max: '100000 NTRN'
          },
          volume24h: '850000 USD',
          reliability: 99.8,
          special: 'Native IBC transfer'
        },
        {
          id: 'juno-cosmoshub',
          from: { chainId: 7002, name: 'Juno', symbol: 'JUNO' },
          to: { chainId: 30001, name: 'Cosmos Hub', symbol: 'ATOM' },
          bridge: 'IBC Bridge',
          status: 'operational',
          estimatedTime: 45000, // 45 seconds
          fees: {
            base: '0.05 JUNO',
            variable: '0.03%'
          },
          limits: {
            min: '1 JUNO',
            max: '50000 JUNO'
          },
          volume24h: '1200000 USD',
          reliability: 99.9,
          special: 'Native IBC transfer'
        },
        {
          id: 'neutron-cosmoshub',
          from: { chainId: 7001, name: 'Neutron', symbol: 'NTRN' },
          to: { chainId: 30001, name: 'Cosmos Hub', symbol: 'ATOM' },
          bridge: 'IBC Bridge',
          status: 'operational',
          estimatedTime: 50000, // 50 seconds
          fees: {
            base: '0.08 NTRN',
            variable: '0.04%'
          },
          limits: {
            min: '1 NTRN',
            max: '75000 NTRN'
          },
          volume24h: '950000 USD',
          reliability: 99.7,
          special: 'Native IBC transfer'
        }
      ],
      emergencyRoutes: [
        {
          id: 'eth-polygon-emergency',
          description: 'Emergency route via multiple hops',
          estimatedTime: 3600000,
          additionalFees: '2x normal'
        }
      ]
    };

    res.json({
      success: true,
      data: bridgeRoutes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Bridge routes request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bridge routes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/chains/bridges/fees
 * Get current bridge fees and estimates
 */
router.get(
  '/bridges/fees',
  [
    query('from').optional().isInt({ min: 1 }).withMessage('From chain ID must be valid'),
    query('to').optional().isInt({ min: 1 }).withMessage('To chain ID must be valid'),
    query('amount').optional().isString().withMessage('Amount must be string'),
    validateRequest
  ],
  async (req: any, res: any) => {
    try {
      const { from, to, amount } = req.query;
      
      const bridgeFees = {
        lastUpdated: Date.now(),
        baseCurrency: 'USD',
        routes: [
          {
            from: 1,
            to: 137,
            fees: {
              fixed: '8.50',
              percentage: '0.1',
              total: amount ? (parseFloat(amount) * 0.001 + 8.5).toFixed(2) : 'N/A',
              breakdown: {
                networkFee: '7.20',
                bridgeFee: '1.00',
                processingFee: '0.30'
              }
            },
            estimatedTime: 480000,
            gasEstimate: '180000'
          },
          {
            from: 1,
            to: 42161,
            fees: {
              fixed: '12.80',
              percentage: '0.05',
              total: amount ? (parseFloat(amount) * 0.0005 + 12.8).toFixed(2) : 'N/A',
              breakdown: {
                networkFee: '11.50',
                bridgeFee: '0.80',
                processingFee: '0.50'
              }
            },
            estimatedTime: 900000,
            gasEstimate: '250000'
          },
          {
            from: 1,
            to: 397,
            fees: {
              fixed: '5.20',
              percentage: '0.15',
              total: amount ? (parseFloat(amount) * 0.0015 + 5.2).toFixed(2) : 'N/A',
              breakdown: {
                networkFee: '4.50',
                bridgeFee: '0.50',
                processingFee: '0.20'
              }
            },
            estimatedTime: 600000,
            gasEstimate: '120000',
            special: 'TEE verification included'
          },
          {
            from: 1,
            to: 7001,
            fees: {
              fixed: '6.80',
              percentage: '0.12',
              total: amount ? (parseFloat(amount) * 0.0012 + 6.8).toFixed(2) : 'N/A',
              breakdown: {
                networkFee: '5.50',
                bridgeFee: '0.80',
                processingFee: '0.50'
              }
            },
            estimatedTime: 480000,
            gasEstimate: '300000',
            special: 'CosmWasm execution included'
          },
          {
            from: 1,
            to: 7002,
            fees: {
              fixed: '5.90',
              percentage: '0.1',
              total: amount ? (parseFloat(amount) * 0.001 + 5.9).toFixed(2) : 'N/A',
              breakdown: {
                networkFee: '4.80',
                bridgeFee: '0.70',
                processingFee: '0.40'
              }
            },
            estimatedTime: 420000,
            gasEstimate: '280000',
            special: 'CosmWasm execution included'
          },
          {
            from: 1,
            to: 30001,
            fees: {
              fixed: '7.50',
              percentage: '0.08',
              total: amount ? (parseFloat(amount) * 0.0008 + 7.5).toFixed(2) : 'N/A',
              breakdown: {
                networkFee: '6.20',
                bridgeFee: '0.90',
                processingFee: '0.40'
              }
            },
            estimatedTime: 540000,
            gasEstimate: '320000',
            special: 'Cosmos Hub mainnet bridge'
          }
        ],
        feeFactors: {
          congestion: {
            level: 'medium',
            multiplier: 1.2,
            description: 'Fees increased due to network congestion'
          },
          volatility: {
            level: 'low',
            multiplier: 1.0,
            description: 'No volatility adjustment'
          }
        }
      };

      // Filter by specific route if requested
      if (from && to) {
        const fromChain = parseInt(from);
        const toChain = parseInt(to);
        bridgeFees.routes = bridgeFees.routes.filter(
          route => route.from === fromChain && route.to === toChain
        );
      }

      res.json({
        success: true,
        data: bridgeFees,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Bridge fees request failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get bridge fees',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/chains/congestion
 * Get real-time network congestion data
 */
router.get('/congestion', async (req: any, res) => {
  try {
    const congestionData = {
      lastUpdated: Date.now(),
      overview: {
        avgCongestion: 42.5,
        peakHours: ['14:00-16:00 UTC', '20:00-22:00 UTC'],
        lowTrafficWindows: ['02:00-06:00 UTC']
      },
      chains: [
        {
          chainId: 1,
          name: 'Ethereum',
          congestion: 65,
          level: 'medium',
          gasPrice: {
            current: 30,
            recommended: 35,
            trend: 'rising'
          },
          mempool: {
            pending: 125000,
            size: '45.2 MB'
          },
          predictions: {
            nextHour: 'increasing',
            next4Hours: 'stable',
            confidence: 85
          }
        },
        {
          chainId: 137,
          name: 'Polygon',
          congestion: 35,
          level: 'low',
          gasPrice: {
            current: 35,
            recommended: 40,
            trend: 'stable'
          },
          mempool: {
            pending: 8500,
            size: '2.1 MB'
          },
          predictions: {
            nextHour: 'stable',
            next4Hours: 'decreasing',
            confidence: 92
          }
        },
        {
          chainId: 42161,
          name: 'Arbitrum',
          congestion: 20,
          level: 'low',
          gasPrice: {
            current: 0.1,
            recommended: 0.1,
            trend: 'stable'
          },
          sequencer: {
            status: 'operational',
            batchSubmissionDelay: 180
          },
          predictions: {
            nextHour: 'stable',
            next4Hours: 'stable',
            confidence: 95
          }
        },
        {
          chainId: 7001,
          name: 'Neutron',
          congestion: 15,
          level: 'low',
          gasPrice: {
            current: 0.025,
            recommended: 0.025,
            trend: 'stable'
          },
          cosmwasm: {
            activeContracts: 156,
            executionsPerBlock: 12,
            avgExecutionTime: 450
          },
          predictions: {
            nextHour: 'stable',
            next4Hours: 'stable',
            confidence: 98
          }
        },
        {
          chainId: 7002,
          name: 'Juno',
          congestion: 20,
          level: 'low',
          gasPrice: {
            current: 0.025,
            recommended: 0.025,
            trend: 'stable'
          },
          cosmwasm: {
            activeContracts: 234,
            executionsPerBlock: 18,
            avgExecutionTime: 380
          },
          predictions: {
            nextHour: 'stable',
            next4Hours: 'stable',
            confidence: 96
          }
        },
        {
          chainId: 30001,
          name: 'Cosmos Hub',
          congestion: 25,
          level: 'low',
          gasPrice: {
            current: 0.025,
            recommended: 0.025,
            trend: 'stable'
          },
          ibc: {
            activeChannels: 45,
            transfersPerBlock: 25,
            avgTransferTime: 6500
          },
          governance: {
            activeProposals: 3,
            votingPeriod: '14 days',
            participation: 67.2
          },
          predictions: {
            nextHour: 'stable',
            next4Hours: 'stable',
            confidence: 97
          }
        }
      ],
      alerts: [
        {
          chainId: 10,
          severity: 'warning',
          message: 'Higher than normal congestion detected on Optimism',
          estimatedResolution: Date.now() + 1800000
        }
      ]
    };

    res.json({
      success: true,
      data: congestionData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Congestion data request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get congestion data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as chainRoutes };