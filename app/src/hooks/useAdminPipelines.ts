'use client';

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type {
  AdminPipeline,
  ListAllPipelinesResponse,
  PipelineStatus,
} from '@/types';

interface PipelineFilters {
  status?: PipelineStatus;
  userId?: string;
}

interface UseAdminPipelinesReturn {
  pipelines: AdminPipeline[];
  loading: boolean;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null;
  filters: PipelineFilters;
  error: string | null;
  fetchPipelines: (limit?: number, offset?: number, filters?: PipelineFilters) => Promise<void>;
  setFilters: (filters: PipelineFilters) => void;
  clearError: () => void;
}

export function useAdminPipelines(): UseAdminPipelinesReturn {
  const [pipelines, setPipelines] = useState<AdminPipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<{
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null>(null);
  const [filters, setFiltersState] = useState<PipelineFilters>({});
  const [error, setError] = useState<string | null>(null);

  const fetchPipelines = useCallback(async (
    limit = 20,
    offset = 0,
    newFilters?: PipelineFilters
  ) => {
    if (!functions) {
      setError('Firebase not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    const activeFilters = newFilters ?? filters;

    try {
      const listAllPipelinesFunc = httpsCallable<
        { limit: number; offset: number; status?: string; userId?: string },
        ListAllPipelinesResponse
      >(functions, 'listAllPipelines');

      const result = await listAllPipelinesFunc({
        limit,
        offset,
        status: activeFilters.status,
        userId: activeFilters.userId,
      });

      setPipelines(result.data.pipelines);
      setPagination(result.data.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pipelines';
      setError(message);
      console.error('Error fetching pipelines:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const setFilters = useCallback((newFilters: PipelineFilters) => {
    setFiltersState(newFilters);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    pipelines,
    loading,
    pagination,
    filters,
    error,
    fetchPipelines,
    setFilters,
    clearError,
  };
}
