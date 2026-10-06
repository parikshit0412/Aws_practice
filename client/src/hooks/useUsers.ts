import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../services/api';
import type { User } from '../types';

interface UseUsersReturn {
  users: User[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  fetchUsers: (page?: number) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export function useUsers(initialPage = 1, limit = 10): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  const fetchUsers = useCallback(async (page = currentPage): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await usersApi.getAll(page, limit);
      setUsers(response.data);
      setTotalPages(response.total_pages);
      setCurrentPage(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit]);

  const deleteUser = useCallback(async (id: string): Promise<void> => {
    try {
      await usersApi.delete(id);
      setUsers((prev) => prev.filter((user) => user.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete user';
      setError(message);
    }
  }, []);

  useEffect(() => {
    fetchUsers(initialPage);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return { users, loading, error, totalPages, currentPage, fetchUsers, deleteUser };
}
