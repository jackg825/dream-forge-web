'use client';

import { useState, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { omitUndefinedFields } from '@/lib/callable-payload';
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
  const latestRequest = useRef(0);
  const activeFilterKey = useRef('');

  const fetchPipelines = useCallback(async (
    limit = 20,
    offset = 0,
    newFilters?: PipelineFilters
  ) => {
    if (!functions) {
      setError('Firebase not initialized');
      return;
    }

    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);

    const activeFilters = newFilters ?? filters;
    const filterKey = JSON.stringify([activeFilters.status, activeFilters.userId]);
    if (filterKey !== activeFilterKey.current) {
      activeFilterKey.current = filterKey;
      setPipelines([]);
      setPagination(null);
    }

    try {
      const listAllPipelinesFunc = httpsCallable<
        { limit: number; offset: number; status?: string; userId?: string },
        ListAllPipelinesResponse
      >(functions, 'listAllPipelines');

      // The API caps each response at 50; refresh every loaded row, including
      // the pipeline currently open in the detail dialog.
      const loaded: AdminPipeline[] = [];
      let lastPagination: ListAllPipelinesResponse['pagination'] | null = null;
      while (loaded.length < limit) {
        const result = await listAllPipelinesFunc(omitUndefinedFields({
          limit: Math.min(50, limit - loaded.length),
          offset: offset + loaded.length,
          status: activeFilters.status,
          userId: activeFilters.userId,
        }));
        if (requestId !== latestRequest.current) return;
        loaded.push(...result.data.pipelines);
        lastPagination = result.data.pagination;
        if (!lastPagination.hasMore || result.data.pipelines.length === 0) break;
      }

      setPipelines((current) => {
        if (offset === 0) return loaded;
        const byId = new Map(current.map((pipeline) => [pipeline.id, pipeline]));
        loaded.forEach((pipeline) => byId.set(pipeline.id, pipeline));
        return [...byId.values()];
      });
      setPagination(lastPagination);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      const message = err instanceof Error ? err.message : 'Failed to fetch pipelines';
      setError(message);
      console.error('Error fetching pipelines:', err);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
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
