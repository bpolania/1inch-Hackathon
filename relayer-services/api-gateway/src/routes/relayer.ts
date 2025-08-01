/**
 * Relayer API Routes
 * 
 * Provides REST endpoints for manual relayer execution and monitoring
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
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
 * GET /api/relayer/status
 * Get relayer status and health
 */
router.get('/status', (req, res) => {
  try {
    const status = req.relayerService.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Relayer status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get relayer status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/relayer/analyze
 * Analyze intent profitability
 */
router.post('/analyze', [
  body('id').isString().notEmpty().withMessage('Intent ID is required'),
  body('fromToken').isObject().withMessage('From token is required'),
  body('toToken').isObject().withMessage('To token is required'),
  body('fromAmount').isString().notEmpty().withMessage('From amount is required'),
  body('user').isString().notEmpty().withMessage('User address is required')
], validateRequest, async (req, res) => {
  try {
    const intent = req.body;
    
    logger.info('Relayer profitability analysis requested', { intentId: intent.id });
    
    const analysis = await req.relayerService.analyzeProfitability(intent);
    
    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Relayer analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'Profitability analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/relayer/submit
 * Submit intent to relayer for execution
 */
router.post('/submit', [
  body('id').isString().notEmpty().withMessage('Intent ID is required'),
  body('fromToken').isObject().withMessage('From token is required'),
  body('toToken').isObject().withMessage('To token is required'),
  body('fromAmount').isString().notEmpty().withMessage('From amount is required'),
  body('minToAmount').isString().notEmpty().withMessage('Min to amount is required'),
  body('user').isString().notEmpty().withMessage('User address is required'),
  body('maxSlippage').isNumeric().optional(),
  body('deadline').isNumeric().optional()
], validateRequest, async (req, res) => {
  try {
    const intent = req.body;
    
    logger.info('Relayer execution requested', { intentId: intent.id });
    
    const result = await req.relayerService.submitIntent(intent);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Relayer submission failed:', error);
    res.status(500).json({
      success: false,
      error: 'Relayer submission failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/relayer/execution/:intentId
 * Get execution status for an intent
 */
router.get('/execution/:intentId', [
  param('intentId').isString().notEmpty().withMessage('Intent ID is required')
], validateRequest, (req, res) => {
  try {
    const { intentId } = req.params;
    
    const status = req.relayerService.getExecutionStatus(intentId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Execution request not found'
      });
    }
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get relayer execution status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get execution status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/relayer/metrics
 * Get relayer performance metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = req.relayerService.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get relayer metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/relayer/execution/:intentId/execute
 * Request immediate execution of an order
 */
router.post('/execution/:intentId/execute', [
  param('intentId').isString().notEmpty().withMessage('Intent ID is required')
], validateRequest, async (req, res) => {
  try {
    const { intentId } = req.params;
    
    const result = await req.relayerService.requestExecution(intentId);
    
    res.json({
      success: result.success,
      data: {
        intentId,
        message: result.message
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to request execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request execution',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/relayer/execution/:intentId
 * Cancel an order
 */
router.delete('/execution/:intentId', [
  param('intentId').isString().notEmpty().withMessage('Intent ID is required')
], validateRequest, async (req, res) => {
  try {
    const { intentId } = req.params;
    
    const result = await req.relayerService.cancelOrder(intentId);
    
    res.json({
      success: result.success,
      data: {
        intentId,
        message: result.message
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to cancel order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as relayerRoutes };