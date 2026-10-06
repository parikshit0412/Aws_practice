import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * JWT Authentication Middleware
 *
 * Verifies the Bearer token from the Authorization header.
 * In production, this would validate tokens issued by AWS Cognito
 * or your own auth service.
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    // In development, allow unauthenticated access with a mock user
    if (process.env.NODE_ENV !== 'production') {
      req.user = {
        userId: 'dev-user-001',
        email: 'dev@example.com',
        role: 'admin',
      };
      next();
      return;
    }

    res.status(401).json({ success: false, message: 'Missing authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    const message = error instanceof jwt.TokenExpiredError
      ? 'Token expired'
      : 'Invalid token';
    res.status(401).json({ success: false, message });
  }
}

/**
 * Role-based Authorization Middleware
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Generate a JWT token
 */
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
