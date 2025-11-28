'use client';

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type {
  AdminStats,
  AdminUser,
  RodinBalanceResponse,
  AdminStatsResponse,
  ListUsersResponse,
} from '@/types';

interface UseAdminReturn {
  // Rodin balance
  rodinBalance: number | null;
  loadingBalance: boolean;
  fetchRodinBalance: () => Promise<void>;

  // Admin stats
  stats: AdminStats | null;
  loadingStats: boolean;
  fetchStats: () => Promise<void>;

  // User management
  users: AdminUser[];
  usersLoading: boolean;
  usersPagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null;
  fetchUsers: (limit?: number, offset?: number) => Promise<void>;

  // Credit management
  addingCredits: boolean;
  addCredits: (targetUserId: string, amount: number, reason?: string) => Promise<boolean>;

  // Error state
  error: string | null;
  clearError: () => void;
}

/**
 * Custom hook for admin dashboard functionality
 * Provides access to admin-only Cloud Functions
 */
export function useAdmin(): UseAdminReturn {
  const [rodinBalance, setRodinBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPagination, setUsersPagination] = useState<{
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null>(null);

  const [addingCredits, setAddingCredits] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRodinBalance = useCallback(async () => {
    if (!functions) {
      setError('Firebase not initialized');
      return;
    }

    setLoadingBalance(true);
    setError(null);

    try {
      const checkBalance = httpsCallable<void, RodinBalanceResponse>(
        functions,
        'checkRodinBalance'
      );
      const result = await checkBalance();
      setRodinBalance(result.data.balance);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch Rodin balance';
      setError(message);
      console.error('Error fetching Rodin balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!functions) {
      setError('Firebase not initialized');
      return;
    }

    setLoadingStats(true);
    setError(null);

    try {
      const getStats = httpsCallable<void, AdminStatsResponse>(
        functions,
        'getAdminStats'
      );
      const result = await getStats();
      setStats(result.data.stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch admin stats';
      setError(message);
      console.error('Error fetching admin stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchUsers = useCallback(async (limit = 50, offset = 0) => {
    if (!functions) {
      setError('Firebase not initialized');
      return;
    }

    setUsersLoading(true);
    setError(null);

    try {
      const listUsersFunc = httpsCallable<
        { limit: number; offset: number },
        ListUsersResponse
      >(functions, 'listUsers');

      const result = await listUsersFunc({ limit, offset });
      setUsers(result.data.users);
      setUsersPagination(result.data.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(message);
      console.error('Error fetching users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const addCredits = useCallback(async (
    targetUserId: string,
    amount: number,
    reason?: string
  ): Promise<boolean> => {
    if (!functions) {
      setError('Firebase not initialized');
      return false;
    }

    setAddingCredits(true);
    setError(null);

    try {
      const addCreditsFunc = httpsCallable<
        { targetUserId: string; amount: number; reason?: string },
        { success: boolean; newBalance: number }
      >(functions, 'addCredits');

      await addCreditsFunc({ targetUserId, amount, reason });

      // Refresh users list after adding credits
      await fetchUsers();

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add credits';
      setError(message);
      console.error('Error adding credits:', err);
      return false;
    } finally {
      setAddingCredits(false);
    }
  }, [fetchUsers]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    rodinBalance,
    loadingBalance,
    fetchRodinBalance,
    stats,
    loadingStats,
    fetchStats,
    users,
    usersLoading,
    usersPagination,
    fetchUsers,
    addingCredits,
    addCredits,
    error,
    clearError,
  };
}
