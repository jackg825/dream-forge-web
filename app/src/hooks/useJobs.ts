'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { httpsCallable, HttpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import type {
  Job,
  JobStatus,
  JobType,
  QualityLevel,
  OutputFormat,
  GenerateModelRequest,
  GenerateModelResponse,
  CheckJobStatusResponse,
} from '@/types';

/**
 * Hook for managing generation jobs
 */
export function useJobs(userId: string | undefined) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to user's jobs
  useEffect(() => {
    if (!userId || !db) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const jobsQuery = query(
      collection(db, 'jobs'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        const jobsData = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId,
            jobType: data.jobType || 'model',
            status: data.status as JobStatus,
            inputImageUrl: data.inputImageUrl,
            inputImageUrls: data.inputImageUrls,
            viewAngles: data.viewAngles,
            outputModelUrl: data.outputModelUrl,
            settings: data.settings,
            error: data.error,
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            completedAt: (data.completedAt as Timestamp)?.toDate() || null,
          } as Job;
        });
        setJobs(jobsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching jobs:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { jobs, loading };
}

/**
 * Hook for a single job with real-time updates
 */
export function useJob(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || !db) {
      setJob(null);
      setLoading(false);
      return;
    }

    const jobRef = doc(db, 'jobs', jobId);
    const unsubscribe = onSnapshot(
      jobRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setJob({
            id: docSnap.id,
            userId: data.userId,
            jobType: data.jobType || 'model',
            status: data.status as JobStatus,
            inputImageUrl: data.inputImageUrl,
            inputImageUrls: data.inputImageUrls,
            viewAngles: data.viewAngles,
            outputModelUrl: data.outputModelUrl,
            settings: data.settings,
            error: data.error,
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            completedAt: (data.completedAt as Timestamp)?.toDate() || null,
          });
          setError(null);
        } else {
          setJob(null);
          setError('Job not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching job:', err);
        setError('Failed to load job');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [jobId]);

  return { job, loading, error };
}

/**
 * Hook for generating a new model
 * Supports single image, multi-image upload, and AI-generated views
 */
export function useGenerateModel() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create callable function reference only when functions is available
  const generateModelFn = useMemo(() => {
    if (!functions) return null;
    return httpsCallable<GenerateModelRequest, GenerateModelResponse>(
      functions,
      'generateModel'
    );
  }, []);

  const generate = useCallback(
    async (request: GenerateModelRequest): Promise<string | null> => {
      if (!generateModelFn) {
        setError('Firebase is not configured');
        return null;
      }

      setGenerating(true);
      setError(null);

      try {
        // Ensure format defaults to STL
        const requestWithDefaults: GenerateModelRequest = {
          ...request,
          format: request.format || 'stl',
        };

        const result = await generateModelFn(requestWithDefaults);
        return result.data.jobId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start generation';
        setError(message);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [generateModelFn]
  );

  return { generate, generating, error };
}

/**
 * Hook for polling job status
 */
export function useJobStatusPolling(jobId: string | null, enabled: boolean = true) {
  const [status, setStatus] = useState<CheckJobStatusResponse | null>(null);
  const [polling, setPolling] = useState(false);

  // Create callable function reference only when functions is available
  const checkJobStatusFn = useMemo(() => {
    if (!functions) return null;
    return httpsCallable<{ jobId: string }, CheckJobStatusResponse>(
      functions,
      'checkJobStatus'
    );
  }, []);

  useEffect(() => {
    if (!jobId || !enabled || !checkJobStatusFn) {
      return;
    }

    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    let pollCount = 0;

    const poll = async () => {
      if (!mounted) return;

      setPolling(true);

      try {
        const result = await checkJobStatusFn({ jobId });
        if (mounted) {
          setStatus(result.data);

          // Stop polling if completed or failed
          if (result.data.status === 'completed' || result.data.status === 'failed') {
            setPolling(false);
            return;
          }

          // Continue polling with exponential backoff
          pollCount++;
          const delay = pollCount < 20 ? 3000 : 5000; // 3s for first minute, then 5s
          timeoutId = setTimeout(poll, delay);
        }
      } catch (err) {
        console.error('Status poll error:', err);
        if (mounted) {
          // Retry on error
          timeoutId = setTimeout(poll, 5000);
        }
      }
    };

    poll();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [jobId, enabled, checkJobStatusFn]);

  return { status, polling };
}

/**
 * Hook for retrying a failed job
 */
export function useRetryJob() {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create callable function reference only when functions is available
  const retryFailedJobFn = useMemo(() => {
    if (!functions) return null;
    return httpsCallable<{ jobId: string }, CheckJobStatusResponse>(
      functions,
      'retryFailedJob'
    );
  }, []);

  const retry = useCallback(
    async (jobId: string): Promise<CheckJobStatusResponse | null> => {
      if (!retryFailedJobFn) {
        setError('Firebase is not configured');
        return null;
      }

      setRetrying(true);
      setError(null);

      try {
        const result = await retryFailedJobFn({ jobId });
        return result.data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to retry job';
        setError(message);
        return null;
      } finally {
        setRetrying(false);
      }
    },
    [retryFailedJobFn]
  );

  return { retry, retrying, error };
}
