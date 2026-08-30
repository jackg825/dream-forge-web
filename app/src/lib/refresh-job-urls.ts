import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Job } from '@/types';

interface JobAccessProjection {
  outputModelUrl: string | null;
}

interface RefreshJobAccessUrlsResponse {
  jobs: Record<string, JobAccessProjection>;
  expiresAt: string;
}

/** Refresh one job's short-lived model URL from its server-owned record. */
export async function refreshJobUrls(job: Job): Promise<Job> {
  const [refreshedJob] = await refreshJobsUrls([job]);
  return refreshedJob;
}

/** Refresh up to 50 job history entries in one authenticated callable. */
export async function refreshJobsUrls(jobs: Job[]): Promise<Job[]> {
  if (!functions || jobs.length === 0) return jobs;

  const refreshAccessUrls = httpsCallable<
    { jobIds: string[] },
    RefreshJobAccessUrlsResponse
  >(functions, 'refreshJobAccessUrls');
  const result = await refreshAccessUrls({
    jobIds: jobs.map((job) => job.id),
  });

  return jobs.map((job) => {
    const outputModelUrl = result.data.jobs[job.id]?.outputModelUrl;
    return outputModelUrl ? { ...job, outputModelUrl } : job;
  });
}
