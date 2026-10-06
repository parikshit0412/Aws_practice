import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  Order,
  ApiResponse,
  PaginatedResponse,
  HealthStatus,
  LoginCredentials,
  AuthUser,
} from '../types';

// ─── Axios Instance with interceptors ───
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message: string }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ───
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthUser> => {
    const { data } = await api.post<ApiResponse<AuthUser>>('/auth/login', credentials);
    return data.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    localStorage.removeItem('auth_token');
  },
};

// ─── Users API ───
export const usersApi = {
  getAll: async (page = 1, limit = 10): Promise<PaginatedResponse<User>> => {
    const { data } = await api.get<PaginatedResponse<User>>('/users', {
      params: { page, limit },
    });
    return data;
  },

  getById: async (id: string): Promise<User> => {
    const { data } = await api.get<ApiResponse<User>>(`/users/${id}`);
    return data.data;
  },

  create: async (user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> => {
    const { data } = await api.post<ApiResponse<User>>('/users', user);
    return data.data;
  },

  update: async (id: string, updates: Partial<User>): Promise<User> => {
    const { data } = await api.put<ApiResponse<User>>(`/users/${id}`, updates);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

// ─── Orders API ───
export const ordersApi = {
  getAll: async (page = 1, limit = 10): Promise<PaginatedResponse<Order>> => {
    const { data } = await api.get<PaginatedResponse<Order>>('/orders', {
      params: { page, limit },
    });
    return data;
  },

  getById: async (id: string): Promise<Order> => {
    const { data } = await api.get<ApiResponse<Order>>(`/orders/${id}`);
    return data.data;
  },

  create: async (order: Pick<Order, 'user_id' | 'items'>): Promise<Order> => {
    const { data } = await api.post<ApiResponse<Order>>('/orders', order);
    return data.data;
  },

  updateStatus: async (id: string, status: Order['status']): Promise<Order> => {
    const { data } = await api.patch<ApiResponse<Order>>(`/orders/${id}/status`, { status });
    return data.data;
  },
};

// ─── Health API ───
export const healthApi = {
  check: async (): Promise<HealthStatus> => {
    const { data } = await api.get<ApiResponse<HealthStatus>>('/health');
    return data.data;
  },
};

export default api;
