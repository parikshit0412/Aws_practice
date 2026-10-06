import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateJWT } from '../middleware/auth';
import { publishOrderEvent } from '../config/sqs';
import type { Order, OrderStatus, PaginatedResponse, ApiResponse } from '../types';

const router = Router();

// ─── Mock Data ───
const mockOrders: Order[] = [
  {
    id: uuidv4(), user_id: 'u1', user_name: 'Priya Sharma',
    items: [
      { product_id: 'p1', product_name: 'AWS Certification Guide', quantity: 1, price: 49.99 },
      { product_id: 'p2', product_name: 'Kubernetes Handbook', quantity: 2, price: 34.99 },
    ],
    total_amount: 119.97, status: 'PENDING',
    created_at: '2024-09-01T10:00:00Z', updated_at: '2024-09-01T10:00:00Z',
  },
  {
    id: uuidv4(), user_id: 'u2', user_name: 'Rahul Patel',
    items: [
      { product_id: 'p3', product_name: 'Docker Mastery Course', quantity: 1, price: 89.99 },
    ],
    total_amount: 89.99, status: 'PROCESSING',
    created_at: '2024-09-05T14:30:00Z', updated_at: '2024-09-06T09:00:00Z',
  },
  {
    id: uuidv4(), user_id: 'u3', user_name: 'Anita Desai',
    items: [
      { product_id: 'p4', product_name: 'React TypeScript Masterclass', quantity: 1, price: 79.99 },
      { product_id: 'p5', product_name: 'Node.js Performance Guide', quantity: 1, price: 44.99 },
    ],
    total_amount: 124.98, status: 'SHIPPED',
    created_at: '2024-08-20T08:00:00Z', updated_at: '2024-08-25T16:00:00Z',
  },
  {
    id: uuidv4(), user_id: 'u4', user_name: 'Vikram Singh',
    items: [
      { product_id: 'p6', product_name: 'Terraform on AWS', quantity: 1, price: 59.99 },
    ],
    total_amount: 59.99, status: 'DELIVERED',
    created_at: '2024-08-10T12:00:00Z', updated_at: '2024-08-18T11:00:00Z',
  },
];

/**
 * GET /api/orders
 * Fetch paginated orders
 *
 * In production, triggered via API Gateway → BFF on EKS.
 * Order processing happens asynchronously via Lambda.
 */
router.get('/', authenticateJWT, asyncHandler(async (req, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const start = (page - 1) * limit;

  const paginatedOrders = mockOrders.slice(start, start + limit);
  const total = mockOrders.length;

  const response: PaginatedResponse<Order> = {
    success: true,
    message: 'Orders fetched successfully',
    data: paginatedOrders,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };

  res.json(response);
}));

/**
 * GET /api/orders/:id
 */
router.get('/:id', authenticateJWT, asyncHandler(async (req, res: Response) => {
  const order = mockOrders.find((o) => o.id === req.params.id);

  if (!order) {
    res.status(404).json({ success: false, message: 'Order not found' });
    return;
  }

  const response: ApiResponse<Order> = {
    success: true,
    message: 'Order fetched successfully',
    data: order,
  };

  res.json(response);
}));

/**
 * POST /api/orders
 * Create a new order
 *
 * In production, this would:
 * 1. Save to RDS via BFF
 * 2. Publish to SQS queue
 * 3. Lambda picks up from SQS for async processing (cost-efficient!)
 */
router.post('/', authenticateJWT, asyncHandler(async (req, res: Response) => {
  const { user_id, items } = req.body as Pick<Order, 'user_id' | 'items'>;

  const totalAmount = items.reduce(
    (sum: number, item: { quantity: number; price: number }) => sum + item.quantity * item.price,
    0
  );

  const newOrder: Order = {
    id: uuidv4(),
    user_id,
    items,
    total_amount: totalAmount,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockOrders.push(newOrder);

  // ⚡ DISTRIBUTED EVENT-DRIVEN PATTERN:
  // Offload to Amazon SQS for background Lambda processing
  const messageId = await publishOrderEvent(newOrder as unknown as Record<string, unknown>);

  const response: ApiResponse<Order & { messageId: string }> = {
    success: true,
    message: 'Order accepted asynchronously and queued for distributed processing.',
    data: {
      ...newOrder,
      messageId,
    },
  };

  res.status(202).json(response); // HTTP 202 Accepted (Standard for distributed async acceptance)
}));

/**
 * PATCH /api/orders/:id/status
 * Update order status
 */
router.patch('/:id/status', authenticateJWT, asyncHandler(async (req, res: Response) => {
  const { status } = req.body as { status: OrderStatus };
  const order = mockOrders.find((o) => o.id === req.params.id);

  if (!order) {
    res.status(404).json({ success: false, message: 'Order not found' });
    return;
  }

  order.status = status;
  order.updated_at = new Date().toISOString();

  const response: ApiResponse<Order> = {
    success: true,
    message: `Order status updated to ${status}`,
    data: order,
  };

  res.json(response);
}));

export default router;
