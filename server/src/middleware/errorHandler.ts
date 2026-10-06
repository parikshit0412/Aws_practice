import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global Error Handler Middleware
 *
 * Express requires exactly 4 parameters for error-handling middleware.
 * In production, stack traces are hidden from the client.
 *
 * This integrates with CloudWatch Logs when deployed on EKS/ECS.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Log error details (goes to CloudWatch Logs in production)
  console.error('🔴 Error:', {
    message: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    ...((!isProduction) && { stack: err.stack }),
  });

  res.status(statusCode).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message,
    ...((!isProduction) && { stack: err.stack }),
  });
}

/**
 * 404 Not Found Handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
}

/**
 * Async route wrapper — catches Promise rejections
 * and forwards them to the error handler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
