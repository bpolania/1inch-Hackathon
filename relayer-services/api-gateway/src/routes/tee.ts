/**
 * TEE Solver API Routes
 * 
 * Provides REST endpoints for TEE autonomous solver integration
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
 * GET /api/tee/status
 * Get TEE solver status and health
 */
router.get('/status', (req, res) => {
  try {
    const status = req.teeService.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('TEE status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get TEE status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/tee/analyze
 * Analyze intent for autonomous execution
 */
router.post('/analyze', [
  body('id').isString().notEmpty().withMessage('Intent ID is required'),
  body('fromToken').isObject().withMessage('From token is required'),
  body('toToken').isObject().withMessage('To token is required'),
  body('fromAmount').isString().notEmpty().withMessage('From amount is required'),
  body('user').isString().notEmpty().withMessage('User address is required')
], validateRequest, async (req: any, res: any) => {
  try {
    const intent = req.body;
    
    logger.info('TEE analysis requested', { intentId: intent.id });
    
    const analysis = await req.teeService.analyzeIntent(intent);
    
    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('TEE analysis failed:', error);
    res.status(500).json({
      success: false,
      error: 'TEE analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/tee/submit
 * Submit intent to TEE for autonomous execution
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
], validateRequest, async (req: any, res: any) => {
  try {
    const intent = req.body;
    
    logger.info('TEE execution requested', { intentId: intent.id });
    
    const result = await req.teeService.submitToTEE(intent);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('TEE submission failed:', error);
    res.status(500).json({
      success: false,
      error: 'TEE submission failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/tee/execution/:requestId
 * Get execution status for a TEE request
 */
router.get('/execution/:requestId', [
  param('requestId').isString().notEmpty().withMessage('Request ID is required')
], validateRequest, (req: any, res: any) => {
  try {
    const { requestId } = req.params;
    
    const status = req.teeService.getExecutionStatus(requestId);
    
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
    logger.error('Failed to get TEE execution status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get execution status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/tee/routes
 * Get supported cross-chain routes
 */
router.get('/routes', (req, res) => {
  try {
    const routes = req.teeService.getSupportedRoutes();
    
    res.json({
      success: true,
      data: routes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get supported routes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get supported routes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/tee/execution/:requestId
 * Cancel a TEE execution request
 */
router.delete('/execution/:requestId', [
  param('requestId').isString().notEmpty().withMessage('Request ID is required')
], validateRequest, async (req: any, res: any) => {
  try {
    const { requestId } = req.params;
    
    // For now, just return success - cancellation logic would be implemented here
    res.json({
      success: true,
      data: {
        requestId,
        status: 'cancelled'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to cancel TEE execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel execution',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as teeRoutes };