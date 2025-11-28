'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Job } from '@/types';
import { useRetryJob } from '@/hooks/useJobs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface JobCardProps {
  job: Job;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle2,
        className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
        label: 'Completed',
      };
    case 'failed':
      return {
        icon: XCircle,
        className: 'bg-destructive/10 text-destructive border-destructive/30',
        label: 'Failed',
      };
    case 'pending':
      return {
        icon: Clock,
        className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
        label: 'Pending',
      };
    default:
      return {
        icon: Loader2,
        className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
        label: 'Processing',
      };
  }
};

export function JobCard({ job }: JobCardProps) {
  const statusConfig = getStatusConfig(job.status);
  const StatusIcon = statusConfig.icon;
  const isProcessing = !['completed', 'failed', 'pending'].includes(job.status);

  const { retry, retrying } = useRetryJob();
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = async (e: React.MouseEvent) => {
    e.preventDefault();
    setRetryError(null);
    const result = await retry(job.id);
    if (!result) {
      setRetryError('Retry failed');
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      <div className="relative aspect-square bg-muted">
        <img
          src={job.inputImageUrl}
          alt="Input image"
          className="w-full h-full object-cover"
        />

        {/* Status badge */}
        <Badge variant="outline" className={`absolute top-2 right-2 ${statusConfig.className}`}>
          <StatusIcon className={`mr-1 h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} />
          {statusConfig.label}
        </Badge>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        {/* Settings */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="capitalize">{job.settings.quality}</span>
          <span className="text-muted-foreground/50">•</span>
          <span className="uppercase">{job.settings.format}</span>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mb-3">
          {formatDate(job.createdAt)}
        </p>

        {/* Error message if failed */}
        {job.status === 'failed' && job.error && (
          <p className="text-xs text-destructive mb-3 truncate" title={job.error}>
            {job.error}
          </p>
        )}

        {/* Retry error message */}
        {retryError && (
          <p className="text-xs text-destructive mb-3">{retryError}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {/* Retry button for failed jobs */}
          {job.status === 'failed' && (
            <Button
              onClick={handleRetry}
              disabled={retrying}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              {retrying ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Retry
                </>
              )}
            </Button>
          )}

          <Button asChild variant={job.status === 'completed' ? 'default' : 'secondary'} size="sm" className="flex-1">
            <Link href={`/viewer?id=${job.id}`}>
              <Eye className="mr-1 h-3 w-3" />
              {job.status === 'completed' ? 'View' : 'Details'}
            </Link>
          </Button>

          {job.status === 'completed' && job.outputModelUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
            >
              <a
                href={job.outputModelUrl}
                download={`model_${job.id}.${job.settings.format}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
