'use client';

import { useState, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { omitUndefinedFields } from '@/lib/callable-payload';
import type {
  AdminStats,
  AdminUser,
  AdminTransaction,
  RodinBalanceResponse,
  AdminStatsResponse,
  ListUsersResponse,
  GetUserTransactionsResponse,
  AllProviderBalancesResponse,
  ProviderBalances,
  UserTier,
} from '@/types';

interface UseAdminReturn {
  // Rodin balance (legacy - kept for backward compatibility)
  rodinBalance: number | null;
  loadingBalance: boolean;
  fetchRodinBalance: () => Promise<void>;

  // All provider balances
  providerBalances: ProviderBalances | null;
  loadingProviderBalances: boolean;
  fetchAllProviderBalances: () => Promise<void>;

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
  deductingCredits: boolean;
  deductCredits: (targetUserId: string, amount: number, reason: string) => Promise<boolean>;

  // Tier management
  updatingTier: boolean;
  updateUserTier: (targetUserId: string, tier: UserTier) => Promise<boolean>;

  // Transaction history
  transactions: AdminTransaction[];
  transactionsLoading: boolean;
  transactionsPagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null;
  fetchUserTransactions: (targetUserId: string, limit?: number, offset?: number) => Promise<void>;
  resetUserTransactions: () => void;

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

  const [providerBalances, setProviderBalances] = useState<ProviderBalances | null>(null);
  const [loadingProviderBalances, setLoadingProviderBalances] = useState(false);

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
  const [deductingCredits, setDeductingCredits] = useState(false);
  const [updatingTier, setUpdatingTier] = useState(false);

  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsPagination, setTransactionsPagination] = useState<{
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const usersRequest = useRef(0);
  const transactionsRequest = useRef(0);
  const mutationInFlight = useRef(false);

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

  const fetchAllProviderBalances = useCallback(async () => {
    if (!functions) {
      setError('Firebase not initialized');
      return;
    }

    setLoadingProviderBalances(true);
    setError(null);

    try {
      const checkAllBalances = httpsCallable<void, AllProviderBalancesResponse>(
        functions,
        'checkAllProviderBalances'
      );
      const result = await checkAllBalances();
      setProviderBalances(result.data.balances);

      // Also update rodinBalance for backward compatibility
      if (result.data.balances.rodin.balance !== null) {
        setRodinBalance(result.data.balances.rodin.balance);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch provider balances';
      setError(message);
      console.error('Error fetching provider balances:', err);
    } finally {
      setLoadingProviderBalances(false);
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

    const requestId = ++usersRequest.current;
    setUsersLoading(true);
    setError(null);

    try {
      const listUsersFunc = httpsCallable<
        { limit: number; offset: number },
        ListUsersResponse
      >(functions, 'listUsers');

      const result = await listUsersFunc({ limit, offset });
      if (requestId !== usersRequest.current) return;
      setUsers((current) => {
        if (offset === 0) return result.data.users;
        const byId = new Map(current.map((user) => [user.uid, user]));
        result.data.users.forEach((user) => byId.set(user.uid, user));
        return [...byId.values()];
      });
      setUsersPagination(result.data.pagination);
    } catch (err) {
      if (requestId !== usersRequest.current) return;
      const message = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(message);
      console.error('Error fetching users:', err);
    } finally {
      if (requestId === usersRequest.current) setUsersLoading(false);
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

    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setAddingCredits(true);
    setError(null);

    try {
      const addCreditsFunc = httpsCallable<
        { targetUserId: string; amount: number; reason?: string },
        { success: boolean; newBalance: number }
      >(functions, 'addCredits');

      const result = await addCreditsFunc(omitUndefinedFields({ targetUserId, amount, reason }));
      setUsers((current) => current.map((user) => user.uid === targetUserId
        ? { ...user, credits: result.data.newBalance } : user));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add credits';
      setError(message);
      console.error('Error adding credits:', err);
      return false;
    } finally {
      mutationInFlight.current = false;
      setAddingCredits(false);
    }
  }, []);

  const deductCredits = useCallback(async (
    targetUserId: string,
    amount: number,
    reason: string
  ): Promise<boolean> => {
    if (!functions) {
      setError('Firebase not initialized');
      return false;
    }

    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setDeductingCredits(true);
    setError(null);

    try {
      const deductCreditsFunc = httpsCallable<
        { targetUserId: string; amount: number; reason: string },
        { success: boolean; newBalance: number }
      >(functions, 'deductCredits');

      const result = await deductCreditsFunc({ targetUserId, amount, reason });
      setUsers((current) => current.map((user) => user.uid === targetUserId
        ? { ...user, credits: result.data.newBalance } : user));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to deduct credits';
      setError(message);
      console.error('Error deducting credits:', err);
      return false;
    } finally {
      mutationInFlight.current = false;
      setDeductingCredits(false);
    }
  }, []);

  const updateUserTier = useCallback(async (
    targetUserId: string,
    tier: UserTier
  ): Promise<boolean> => {
    if (!functions) {
      setError('Firebase not initialized');
      return false;
    }

    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setUpdatingTier(true);
    setError(null);

    try {
      const updateTierFunc = httpsCallable<
        { targetUserId: string; tier: UserTier },
        { success: boolean; newTier: UserTier }
      >(functions, 'updateUserTier');

      const result = await updateTierFunc({ targetUserId, tier });
      setUsers((current) => current.map((user) => user.uid === targetUserId
        ? { ...user, tier: result.data.newTier } : user));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update tier';
      setError(message);
      console.error('Error updating tier:', err);
      return false;
    } finally {
      mutationInFlight.current = false;
      setUpdatingTier(false);
    }
  }, []);

  const fetchUserTransactions = useCallback(async (
    targetUserId: string,
    limit = 50,
    offset = 0
  ) => {
    if (!functions) {
      setError('Firebase not initialized');
      return;
    }

    const requestId = ++transactionsRequest.current;
    if (offset === 0) {
      setTransactions([]);
      setTransactionsPagination(null);
    }
    setTransactionsLoading(true);
    setError(null);

    try {
      const getUserTransactionsFunc = httpsCallable<
        { targetUserId: string; limit: number; offset: number },
        GetUserTransactionsResponse
      >(functions, 'getUserTransactions');

      const result = await getUserTransactionsFunc({ targetUserId, limit, offset });
      if (requestId !== transactionsRequest.current) return;
      setTransactions((current) => {
        if (offset === 0) return result.data.transactions;
        const byId = new Map(current.map((transaction) => [transaction.id, transaction]));
        result.data.transactions.forEach((transaction) => byId.set(transaction.id, transaction));
        return [...byId.values()];
      });
      setTransactionsPagination(result.data.pagination);
    } catch (err) {
      if (requestId !== transactionsRequest.current) return;
      const message = err instanceof Error ? err.message : 'Failed to fetch transactions';
      setError(message);
      console.error('Error fetching transactions:', err);
    } finally {
      if (requestId === transactionsRequest.current) setTransactionsLoading(false);
    }
  }, []);

  const resetUserTransactions = useCallback(() => {
    ++transactionsRequest.current;
    setTransactions([]);
    setTransactionsPagination(null);
    setTransactionsLoading(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    rodinBalance,
    loadingBalance,
    fetchRodinBalance,
    providerBalances,
    loadingProviderBalances,
    fetchAllProviderBalances,
    stats,
    loadingStats,
    fetchStats,
    users,
    usersLoading,
    usersPagination,
    fetchUsers,
    addingCredits,
    addCredits,
    deductingCredits,
    deductCredits,
    updatingTier,
    updateUserTier,
    transactions,
    transactionsLoading,
    transactionsPagination,
    fetchUserTransactions,
    resetUserTransactions,
    error,
    clearError,
  };
}
