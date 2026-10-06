import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Database Configuration
 *
 * In production, this connects to AWS RDS PostgreSQL via RDS Proxy.
 * RDS Proxy is essential for:
 * - Connection pooling (prevents max_connections exhaustion)
 * - IAM authentication
 * - Automatic failover for Multi-AZ deployments
 *
 * For local development, falls back to a local PostgreSQL or
 * returns a mock pool if no DB is configured.
 */
const dbConfig: PoolConfig = {
  host: process.env.RDS_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.RDS_PORT || process.env.DB_PORT || '5432', 10),
  database: process.env.RDS_DB || process.env.DB_NAME || 'aws_fullstack_db',
  user: process.env.RDS_USER || process.env.DB_USER || 'postgres',
  password: process.env.RDS_PASS || process.env.DB_PASS || 'postgres',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Enable SSL for RDS connections
  ...(process.env.NODE_ENV === 'production' && {
    ssl: { rejectUnauthorized: false },
  }),
};

export const pool = new Pool(dbConfig);

// Log pool errors
pool.on('error', (err: Error) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Test the database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('⚠️  Database not available:', message);
    console.warn('   Server will use mock data instead.');
    return false;
  }
}

export default pool;
