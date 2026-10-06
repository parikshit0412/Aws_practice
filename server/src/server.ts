import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import usersRouter from './routes/users';
import ordersRouter from './routes/orders';
import healthRouter from './routes/health';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ─── Security Middleware ───
app.use(helmet());                          // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// ─── Rate Limiting ───
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,               // 15 minutes
  max: 100,                                 // 100 requests per window
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// ─── Body Parsing & Logging ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));                     // HTTP request logging

// ─── API Routes ───
app.use('/api/health', healthRouter);       // Health check (no auth)
app.use('/api/users', usersRouter);         // User management
app.use('/api/orders', ordersRouter);       // Order management

// ─── Error Handling ───
app.use(notFoundHandler);                   // 404 handler
app.use(errorHandler);                      // Global error handler

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   🚀 Node.js BFF Server (TypeScript)        ║
  ║                                              ║
  ║   Port:     ${PORT}                            ║
  ║   Mode:     ${process.env.NODE_ENV || 'development'}                    ║
  ║   Health:   http://localhost:${PORT}/api/health  ║
  ║   Users:    http://localhost:${PORT}/api/users   ║
  ║   Orders:   http://localhost:${PORT}/api/orders  ║
  ╚══════════════════════════════════════════════╝
  `);
});

export default app;
