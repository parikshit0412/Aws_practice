import { useState, useEffect, useCallback } from 'react';
import { ordersApi } from '../services/api';
import type { Order, OrderStatus } from '../types';

interface UseOrdersReturn {
  orders: Order[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  fetchOrders: (page?: number) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
}

export function useOrders(initialPage = 1, limit = 10): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  const fetchOrders = useCallback(async (page = currentPage): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await ordersApi.getAll(page, limit);
      setOrders(response.data);
      setTotalPages(response.total_pages);
      setCurrentPage(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit]);

  const updateOrderStatus = useCallback(async (id: string, status: OrderStatus): Promise<void> => {
    try {
      const updated = await ordersApi.updateStatus(id, status);
      setOrders((prev) =>
        prev.map((order) => (order.id === id ? updated : order))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update order';
      setError(message);
    }
  }, []);

  useEffect(() => {
    fetchOrders(initialPage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { orders, loading, error, totalPages, currentPage, fetchOrders, updateOrderStatus };
}
