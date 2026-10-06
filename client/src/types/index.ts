// ─── User Types ───
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'manager';
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// ─── Order Types ───
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  user_id: string;
  user_name?: string;
  items: OrderItem[];
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

// ─── API Response Types ───
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ─── Auth Types ───
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ─── Health Check ───
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  services: {
    database: 'connected' | 'disconnected';
    cache: 'connected' | 'disconnected';
  };
}
