import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

/**
 * Database Migration & Seeding Script for AWS RDS PostgreSQL
 * 
 * Tables created:
 * 1. users: Application accounts, roles, auth metadata
 * 2. orders: E-commerce order records with JSONB items and status tracking
 * 3. audit_logs: Distributed transaction and Lambda audit trail
 */

async function runMigration() {
  const host = process.env.RDS_HOST || process.env.DB_HOST;
  const port = parseInt(process.env.RDS_PORT || process.env.DB_PORT || '5432', 10);
  const database = process.env.RDS_DB || process.env.DB_NAME || 'aws_fullstack_db';
  const user = process.env.RDS_USER || process.env.DB_USER || 'postgres';
  const password = process.env.RDS_PASS || process.env.DB_PASS;

  console.log('------------------------------------------------------------');
  console.log(`🔌 Attempting connection to AWS RDS PostgreSQL:`);
  console.log(`   Host:     ${host}`);
  console.log(`   Port:     ${port}`);
  console.log(`   Database: ${database}`);
  console.log(`   User:     ${user}`);
  console.log('------------------------------------------------------------');

  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: {
      rejectUnauthorized: false, // Required for Amazon RDS SSL connection
    },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('✅ Successfully connected to AWS RDS PostgreSQL!');

    console.log('🚀 Running Schema Migrations (Creating Tables)...');

    // Enable uuid-ossp extension for UUID generation if needed
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(160) UNIQUE NOT NULL,
        role VARCHAR(32) DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('  ✓ Table created: users');

    // 2. Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        items JSONB NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('  ✓ Table created: orders');

    // 3. Audit Logs Table (Used by Lambda workers & distributed transactions)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        entity_id VARCHAR(64) NOT NULL,
        action VARCHAR(64) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('  ✓ Table created: audit_logs');

    // -------------------------------------------------------------------------
    // SEEDING INITIAL MOCK DATA
    // -------------------------------------------------------------------------
    console.log('\n🌱 Seeding Initial Data into AWS RDS...');

    // Seed Users
    await client.query(`
      INSERT INTO users (id, name, email, role)
      VALUES 
        ('u-001', 'Priya Sharma', 'priya.sharma@example.com', 'admin'),
        ('u-002', 'Rahul Patel', 'rahul.patel@example.com', 'manager'),
        ('u-003', 'Anita Desai', 'anita.desai@example.com', 'user'),
        ('u-004', 'Vikram Singh', 'vikram.singh@example.com', 'user'),
        ('u-005', 'Kavitha Nair', 'kavitha.nair@example.com', 'user')
      ON CONFLICT (id) DO UPDATE 
        SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role;
    `);
    console.log('  ✓ Seeded 5 Users');

    // Seed Orders
    await client.query(`
      INSERT INTO orders (id, user_id, items, total_amount, status)
      VALUES 
        (
          'ord-101', 
          'u-001', 
          '[{"product_id":"p-1","product_name":"AWS Certified Solutions Architect Guide","quantity":1,"price":49.99},{"product_id":"p-2","product_name":"Kubernetes in Action","quantity":2,"price":34.99}]'::jsonb,
          119.97,
          'PROCESSING'
        ),
        (
          'ord-102', 
          'u-002', 
          '[{"product_id":"p-3","product_name":"Docker Deep Dive","quantity":1,"price":39.99}]'::jsonb,
          39.99,
          'SHIPPED'
        ),
        (
          'ord-103', 
          'u-003', 
          '[{"product_id":"p-4","product_name":"Full Stack React TypeScript Masterclass","quantity":1,"price":89.99},{"product_id":"p-5","product_name":"Designing Distributed Systems","quantity":1,"price":45.00}]'::jsonb,
          134.99,
          'DELIVERED'
        ),
        (
          'ord-104', 
          'u-004', 
          '[{"product_id":"p-6","product_name":"PostgreSQL High Performance","quantity":1,"price":54.99}]'::jsonb,
          54.99,
          'PENDING'
        )
      ON CONFLICT (id) DO UPDATE 
        SET status = EXCLUDED.status, items = EXCLUDED.items, total_amount = EXCLUDED.total_amount;
    `);
    console.log('  ✓ Seeded 4 Orders');

    // Seed Audit Log
    await client.query(`
      INSERT INTO audit_logs (entity_id, action, metadata)
      VALUES 
        ('ord-101', 'INITIAL_SEED', '{"description":"Initial system migration and seed"}'::jsonb);
    `);
    console.log('  ✓ Seeded Audit Log');

    // Verification Query
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const orderCount = await client.query('SELECT COUNT(*) FROM orders');

    console.log('\n============================================================');
    console.log(`🎉 AWS RDS PostgreSQL Migration & Seed Complete!`);
    console.log(`   Total Users in RDS:  ${userCount.rows[0].count}`);
    console.log(`   Total Orders in RDS: ${orderCount.rows[0].count}`);
    console.log('============================================================');

  } catch (error) {
    console.error('\n❌ RDS Connection / Migration Failed:');
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      if ('code' in error) {
        console.error(`   Error code:    ${(error as { code: string }).code}`);
      }
    } else {
      console.error(error);
    }
    console.log('\n💡 Common reasons for timeout / connection failure:');
    console.log('   1. RDS Security Group: Does not have inbound rule for Port 5432 from your current IP.');
    console.log('   2. RDS Publicly Accessible: Set to "No" (cannot be reached from outside the AWS VPC).');
    console.log('   3. Database name: Ensure "aws_fullstack_db" was specified as the initial database.');
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
