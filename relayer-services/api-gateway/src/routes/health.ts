/**
 * Health Check API Routes
 */

import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

/**
 * GET /api/health/detailed
 * Detailed health check including services
 */
router.get('/detailed', async (req, res) => {
  try {
    const teeStatus = req.teeService?.getStatus() || { isHealthy: false, error: 'Service not initialized' };
    const relayerStatus = req.relayerService?.getStatus() || { isHealthy: false, error: 'Service not initialized' };

    const overallHealthy = teeStatus.isHealthy && relayerStatus.isHealthy;

    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      services: {
        tee: teeStatus,
        relayer: relayerStatus
      },
      system: {
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as healthRoutes };