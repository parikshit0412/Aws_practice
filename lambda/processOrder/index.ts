import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { Pool } from 'pg';

/**
 * =========================================================================================
 * 🎓 DISTRIBUTED SYSTEMS INTERVIEW TALKING POINTS (LAMBDA & QUEUES)
 * =========================================================================================
 * 
 * 1. TEMPORAL DECOUPLING (Load Leveling Pattern):
 *    - The upstream Node.js BFF does not wait for database updates or external payments.
 *    - It pushes an event to SQS and immediately returns HTTP 201 to the user.
 *    - SQS buffers the traffic; Lambda scales up/down automatically to match consumer throughput.
 *
 * 2. CONNECTION MULTIPLEXING VIA RDS PROXY:
 *    - In distributed serverless computing, 500 Lambda microVMs would exhaust PostgreSQL's
 *      `max_connections` (500 direct connections would crash Postgres).
 *    - We connect through RDS Proxy (`RDS_PROXY_HOST`), which multiplexes thousands of incoming
 *      Lambda sockets onto a small warm pool of persistent PostgreSQL connections.
 *
 * 3. EXECUTION CONTEXT REUSE (Cold Start Optimization):
 *    - Notice that `new Pool(...)` is instantiated OUTSIDE the `handler` function.
 *    - In AWS Lambda, global scope variables persist across "warm invocations" inside the same
 *      Firecracker microVM container, eliminating connection negotiation overhead on subsequent calls.
 *
 * 4. AT-LEAST-ONCE DELIVERY & PARTIAL BATCH FAILURES:
 *    - Distributed message brokers like SQS provide "At-Least-Once" delivery guarantees.
 *    - If 1 out of 10 messages fails, returning a standard error would cause all 10 messages
 *      to be re-sent to the queue, creating duplicate work.
 *    - We implement `SQSBatchItemFailure` so ONLY the failed messageId is retried or sent to DLQ.
 * =========================================================================================
 */

// ⚡ TEACHING POINT: Connection pool outside handler = Reused across warm invocations
const pool = new Pool({
  host: process.env.RDS_PROXY_HOST || 'mydb-proxy.proxy-xxxx.us-east-1.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'ecommerce',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 2, // Keep connection count per Lambda microVM low (1-2 is best practice)
  connectionTimeoutMillis: 3000,
});

interface OrderPayload {
  id: string;
  user_id: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log(`Processing SQS batch of ${event.Records.length} records in distributed worker.`);
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const order: OrderPayload = JSON.parse(record.body);
      console.log(`Processing Order ID: ${order.id}`);

      // ⚡ TEACHING POINT: Distributed Idempotency & ACID Database Transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Step 1: Idempotency check / status update
        // In distributed systems, this ensures duplicate message deliveries don't double-charge
        await client.query(
          'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3',
          ['PROCESSING', order.id, 'PENDING']
        );

        // Step 2: Audit log
        await client.query(
          'INSERT INTO audit_logs (entity_id, action, metadata) VALUES ($1, $2, $3)',
          [order.id, 'ORDER_PROCESSED', JSON.stringify({ itemCount: order.items.length })]
        );

        await client.query('COMMIT');
        console.log(`Order ${order.id} processed successfully.`);
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Failed to process message ID: ${record.messageId}`, err);
      // ⚡ TEACHING POINT: Partial batch failure reporting
      // Only the specific failed message will stay in SQS or move to Dead Letter Queue (DLQ)
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
