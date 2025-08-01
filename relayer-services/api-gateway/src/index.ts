/**
 * API Gateway for 1inch Cross-Chain Integration
 * 
 * Provides REST API endpoints that connect the UI to our sophisticated
 * TEE Solver and Relayer backend services for real cross-chain execution.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';

// Import route handlers
import { teeRoutes } from './routes/tee';
import { relayerRoutes } from './routes/relayer';
import { healthRoutes } from './routes/health';
import { oneInchRoutes } from './routes/oneinch';
import { transactionRoutes } from './routes/transactions';
import { userRoutes } from './routes/users';
import { chainRoutes } from './routes/chains';

// Import services
import { TEESolverService } from './services/TEESolverService';
import { RelayerService } from './services/RelayerService';
import { WebSocketService } from './services/WebSocketService';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Global services
let teeService: TEESolverService;
let relayerService: RelayerService;
let wsService: WebSocketService;

/**
 * Initialize services
 */
async function initializeServices() {
  logger.info('🔧 Initializing API Gateway services...');

  try {
    // Initialize TEE Solver Service
    teeService = new TEESolverService({
      nearNetwork: process.env.NEAR_NETWORK as 'mainnet' | 'testnet' || 'testnet',
      nearAccountId: process.env.NEAR_ACCOUNT_ID || 'tee-solver.testnet',
      nearPrivateKey: process.env.NEAR_PRIVATE_KEY || '',
      enableChainSignatures: process.env.ENABLE_CHAIN_SIGNATURES === 'true',
      teeMode: process.env.TEE_MODE === 'true'
    });

    await teeService.initialize();

    // Initialize Relayer Service
    relayerService = new RelayerService({
      ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/PROJECT_ID',
      ethereumPrivateKey: process.env.ETHEREUM_PRIVATE_KEY || '',
      bitcoinNetwork: process.env.BITCOIN_NETWORK as 'mainnet' | 'testnet' || 'testnet',
      bitcoinPrivateKey: process.env.BITCOIN_PRIVATE_KEY || '',
      contractAddresses: {
        factory: process.env.FACTORY_CONTRACT_ADDRESS || '',
        registry: process.env.REGISTRY_CONTRACT_ADDRESS || '',
        token: process.env.TOKEN_CONTRACT_ADDRESS || ''
      }
    });

    await relayerService.initialize();

    // Initialize WebSocket service for real-time updates
    const wss = new WebSocketServer({ server });
    wsService = new WebSocketService(wss, teeService, relayerService);
    
    logger.info('✅ All services initialized successfully');

  } catch (error) {
    logger.error('💥 Failed to initialize services:', error);
    process.exit(1);
  }
}

/**
 * Configure middleware
 */
function configureMiddleware() {
  // Security middleware
  app.use(helmet({
    crossOriginEmbedderPolicy: false // Allow cross-origin for dev
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    next();
  });
}

/**
 * Configure routes
 */
function configureRoutes() {
  // Inject services into routes
  app.use((req, res, next) => {
    req.teeService = teeService;
    req.relayerService = relayerService;
    req.wsService = wsService;
    next();
  });

  // API routes
  app.use('/api/health', healthRoutes);
  app.use('/api/tee', teeRoutes);
  app.use('/api/relayer', relayerRoutes);
  app.use('/api/1inch', oneInchRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/chains', chainRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: '1inch Cross-Chain API Gateway',
      version: '1.0.0',
      status: 'operational',
      services: {
        tee: teeService?.getStatus() || 'not initialized',
        relayer: relayerService?.getStatus() || 'not initialized'
      },
      endpoints: {
        health: '/api/health',
        tee: '/api/tee',
        relayer: '/api/relayer',
        oneInch: '/api/1inch',
        transactions: '/api/transactions',
        users: '/api/users',
        chains: '/api/chains',
        websocket: '/ws'
      }
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      path: req.originalUrl,
      available: ['/api/health', '/api/tee', '/api/relayer', '/api/1inch', '/api/transactions', '/api/users', '/api/chains']
    });
  });

  // Error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('API Error:', error);
    
    res.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });
}

/**
 * Start the server
 */
async function startServer() {
  await initializeServices();
  configureMiddleware();
  configureRoutes();

  server.listen(PORT, () => {
    logger.info(`🚀 API Gateway running on port ${PORT}`);
    logger.info(`📍 Health check: http://localhost:${PORT}/api/health`);
    logger.info(`🔗 WebSocket: ws://localhost:${PORT}/ws`);
    logger.info(`📖 API docs: http://localhost:${PORT}/`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('🛑 Shutting down API Gateway...');
    
    try {
      await teeService?.stop();
      await relayerService?.stop();
      wsService?.stop();
      
      server.close(() => {
        logger.info('✅ API Gateway stopped gracefully');
        process.exit(0);
      });
    } catch (error) {
      logger.error('💥 Error during shutdown:', error);
      process.exit(1);
    }
  });
}

// Start the application
startServer().catch((error) => {
  logger.error('💥 Failed to start API Gateway:', error);
  process.exit(1);
});

// Export app for testing
export { app };

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      teeService: TEESolverService;
      relayerService: RelayerService;
      wsService: WebSocketService;
    }
  }
}