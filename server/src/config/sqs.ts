import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * =========================================================================================
 * 🎓 DISTRIBUTED SYSTEMS INTERVIEW POINT: PRODUCER CLIENT (AWS SDK v3)
 * =========================================================================================
 * In distributed event-driven systems:
 * - The BFF is the PRODUCER (publishes state change intent to SQS).
 * - AWS Lambda is the CONSUMER (processes background tasks asynchronously).
 * - SQS provides "Load Leveling": If 5,000 users checkout in 1 second,
 *   the BFF doesn't crash downstream databases. SQS buffers all 5,000 messages.
 * =========================================================================================
 */

const region = process.env.AWS_REGION || 'us-east-1';

export const sqsClient = new SQSClient({
  region,
  // If running locally with LocalStack:
  ...(process.env.LOCALSTACK_ENDPOINT && {
    endpoint: process.env.LOCALSTACK_ENDPOINT,
  }),
});

/**
 * Publishes an event to Amazon SQS with mock fallback for local development
 */
export async function publishOrderEvent(orderPayload: Record<string, unknown>): Promise<string> {
  const queueUrl = process.env.ORDER_QUEUE_URL;

  // In production (or when AWS credentials + queue are configured)
  if (queueUrl) {
    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(orderPayload),
        MessageAttributes: {
          EventType: {
            DataType: 'String',
            StringValue: 'ORDER_CREATED',
          },
          CorrelationId: {
            DataType: 'String',
            StringValue: (orderPayload.id as string) || 'unknown',
          },
        },
      });

      const response = await sqsClient.send(command);
      console.log(`[Distributed Event] Published to SQS MessageId: ${response.MessageId}`);
      return response.MessageId || 'sent';
    } catch (error) {
      console.error('[Distributed Event Error] Failed to publish message to SQS:', error);
      throw error;
    }
  }

  // Graceful local development simulation:
  console.log(`[Distributed Event Simulation] SQS_QUEUE_URL not set. Order ${orderPayload.id} simulated async offload.`);
  return 'simulated-sqs-message-id';
}
