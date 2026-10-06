import { SNSEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

/**
 * =========================================================================================
 * 🎓 DISTRIBUTED SYSTEMS INTERVIEW TALKING POINTS (FAN-OUT & PUB/SUB)
 * =========================================================================================
 * 
 * 1. PUB/SUB & FAN-OUT PATTERN (SNS -> SQS / Lambda):
 *    - When an order event occurs, the publisher (BFF or processOrder) emits to an SNS Topic.
 *    - In distributed architectures, SNS allows 1-to-many "Fan-Out":
 *      * Subscriber A (this Lambda) sends an email via SES.
 *      * Subscriber B (another SQS Queue) updates an analytics data lake.
 *      * Subscriber C updates real-time WebSocket connections.
 *    - The publisher does NOT know or care who the subscribers are (loose coupling).
 *
 * 2. MODULAR AWS SDK v3 & BUNDLE SIZE OPTIMIZATION:
 *    - Notice: `import { SESClient } from '@aws-sdk/client-ses'`
 *    - Instead of importing the entire monolithic `aws-sdk` (70MB+ uncompressed),
 *      importing modular v3 packages shrinks deployment zip size to < 2MB.
 *    - Direct Distributed Benefit: Faster code download by AWS Lambda during microVM cold boot!
 *
 * 3. FAULT ISOLATION:
 *    - If Amazon SES has an outage or rate-limits emails, order processing is NOT impacted!
 *    - The upstream user checkout flow succeeded seconds ago; failed emails are isolated
 *      and retried independently via Lambda retry policies / Dead Letter Queues (DLQ).
 * =========================================================================================
 */

// ⚡ TEACHING POINT: Initialized outside handler for warm invocation reuse
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

export const handler = async (event: SNSEvent): Promise<void> => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      const recipientEmail = message.email || 'customer@example.com';
      const subject = message.subject || 'Order Status Update';
      const body = message.body || 'Your order has been updated.';

      console.log(`[Distributed Worker] Sending email notification to ${recipientEmail}`);

      const command = new SendEmailCommand({
        Source: process.env.SES_SENDER_EMAIL || 'no-reply@myapp.com',
        Destination: {
          ToAddresses: [recipientEmail],
        },
        Message: {
          Subject: { Data: subject },
          Body: {
            Text: { Data: body },
            Html: { Data: `<p>${body}</p>` },
          },
        },
      });

      await sesClient.send(command);
      console.log(`[Distributed Worker] Notification sent successfully to ${recipientEmail}`);
    } catch (err) {
      console.error('[Distributed Worker] Error sending notification via SES:', err);
      // Throw error so AWS Lambda / SNS can perform exponential backoff retries
      throw err;
    }
  }
};
