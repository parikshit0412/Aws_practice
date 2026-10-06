import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateJWT } from '../middleware/auth';
import type { User, PaginatedResponse, ApiResponse } from '../types';

const router = Router();

// ─── Mock Data (used when no database is connected) ───
const mockUsers: User[] = [
  { id: uuidv4(), name: 'Priya Sharma', email: 'priya@example.com', role: 'admin', created_at: '2024-01-15T10:00:00Z', updated_at: '2024-06-20T14:30:00Z' },
  { id: uuidv4(), name: 'Rahul Patel', email: 'rahul@example.com', role: 'manager', created_at: '2024-02-20T09:00:00Z', updated_at: '2024-07-10T11:00:00Z' },
  { id: uuidv4(), name: 'Anita Desai', email: 'anita@example.com', role: 'user', created_at: '2024-03-10T08:00:00Z', updated_at: '2024-08-01T16:00:00Z' },
  { id: uuidv4(), name: 'Vikram Singh', email: 'vikram@example.com', role: 'user', created_at: '2024-04-05T12:00:00Z', updated_at: '2024-08-15T09:00:00Z' },
  { id: uuidv4(), name: 'Kavitha Nair', email: 'kavitha@example.com', role: 'manager', created_at: '2024-05-18T11:00:00Z', updated_at: '2024-09-01T13:00:00Z' },
  { id: uuidv4(), name: 'Arjun Mehta', email: 'arjun@example.com', role: 'user', created_at: '2024-06-22T07:00:00Z', updated_at: '2024-09-10T10:00:00Z' },
];

/**
 * GET /api/users
 * Fetch paginated list of users
 */
router.get('/', authenticateJWT, asyncHandler(async (_req, res: Response) => {
  const page = parseInt(_req.query.page as string) || 1;
  const limit = parseInt(_req.query.limit as string) || 10;
  const start = (page - 1) * limit;

  // In production, this would query RDS PostgreSQL:
  // const { rows } = await pool.query(
  //   'SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
  //   [limit, start]
  // );

  const paginatedUsers = mockUsers.slice(start, start + limit);
  const total = mockUsers.length;

  const response: PaginatedResponse<User> = {
    success: true,
    message: 'Users fetched successfully',
    data: paginatedUsers,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };

  res.json(response);
}));

/**
 * GET /api/users/:id
 * Fetch a single user by ID
 */
router.get('/:id', authenticateJWT, asyncHandler(async (req, res: Response) => {
  const user = mockUsers.find((u) => u.id === req.params.id);

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  const response: ApiResponse<User> = {
    success: true,
    message: 'User fetched successfully',
    data: user,
  };

  res.json(response);
}));

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', authenticateJWT, asyncHandler(async (req, res: Response) => {
  const { name, email, role } = req.body as Pick<User, 'name' | 'email' | 'role'>;

  const newUser: User = {
    id: uuidv4(),
    name,
    email,
    role: role || 'user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockUsers.push(newUser);

  const response: ApiResponse<User> = {
    success: true,
    message: 'User created successfully',
    data: newUser,
  };

  res.status(201).json(response);
}));

/**
 * DELETE /api/users/:id
 * Delete a user by ID
 */
router.delete('/:id', authenticateJWT, asyncHandler(async (req, res: Response) => {
  const index = mockUsers.findIndex((u) => u.id === req.params.id);

  if (index === -1) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  mockUsers.splice(index, 1);

  res.json({ success: true, message: 'User deleted successfully' });
}));

export default router;
