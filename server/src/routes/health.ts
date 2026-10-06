import { Router, Request, Response } from 'express';
import { testConnection } from '../config/database';

const router = Router();

const startTime = Date.now();

/**
 * GET /api/health
 *
 * Health check endpoint — used by:
 * - Kubernetes readinessProbe & livenessProbe
 * - ALB target group health checks
 * - CloudWatch Synthetics
 */
router.get('/', async (_req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const dbConnected = await testConnection();

  const status = dbConnected ? 'healthy' : 'degraded';
  const statusCode = dbConnected ? 200 : 503;

  res.status(statusCode).json({
    success: true,
    message: 'Health check completed',
    data: {
      status,
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
        cache: 'disconnected', // Would check Redis/ElastiCache here
      },
    },
  });
});

export default router;
