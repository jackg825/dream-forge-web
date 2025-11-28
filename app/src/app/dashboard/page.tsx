'use client';

import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Header } from '@/components/layout/Header';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useJobs } from '@/hooks/useJobs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Coins,
  Box,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { Job } from '@/types';
import { JOB_STATUS_MESSAGES } from '@/types';

function DashboardContent() {
  const { user } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);
  const { jobs, loading: jobsLoading } = useJobs(user?.uid);

  // Get recent jobs (last 3)
  const recentJobs = jobs.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Main content */}
      <main className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.displayName || 'User'}
          </h1>
          <p className="text-muted-foreground">
            Transform your photos into stunning 3D models
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Credits card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available Credits</p>
                  <p className="text-3xl font-bold">
                    {creditsLoading ? (
                      <span className="animate-pulse">--</span>
                    ) : (
                      credits
                    )}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                1 credit = 1 generation
              </p>
            </CardContent>
          </Card>

          {/* Total generations card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Generations</p>
                  <p className="text-3xl font-bold">
                    {user?.totalGenerated || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Box className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                3D models created
              </p>
            </CardContent>
          </Card>

          {/* Quick action card */}
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Create New Model</h3>
              <p className="text-sm text-indigo-100 mb-4">
                Upload a photo and transform it into a 3D model
              </p>
              <Button asChild variant="secondary">
                <Link href="/" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Generation
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent generations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Generations</CardTitle>
              <CardDescription>Your latest 3D model creations</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/history" className="gap-1">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {jobsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : recentJobs.length === 0 ? (
              <div className="text-center py-8">
                <Box className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-2">No generations yet</p>
                <Button asChild variant="link">
                  <Link href="/">Create your first 3D model</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentJobs.map((job) => (
                  <JobListItem key={job.id} job={job} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function JobListItem({ job }: { job: Job }) {
  // Status icon and variant
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle2,
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-500 border-green-500/20',
        };
      case 'failed':
        return {
          icon: XCircle,
          variant: 'destructive' as const,
          className: '',
        };
      case 'pending':
        return {
          icon: Clock,
          variant: 'secondary' as const,
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        };
      default:
        return {
          icon: Loader2,
          variant: 'secondary' as const,
          className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        };
    }
  };

  const statusConfig = getStatusConfig(job.status);
  const StatusIcon = statusConfig.icon;
  const isProcessing = !['completed', 'failed', 'pending'].includes(job.status);

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
    <Link
      href={`/viewer?id=${job.id}`}
      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      {/* Thumbnail */}
      <img
        src={job.inputImageUrl}
        alt="Input"
        className="w-12 h-12 rounded-md object-cover ring-1 ring-border"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {job.settings.quality} quality
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDate(job.createdAt)}
        </p>
      </div>

      {/* Status */}
      <Badge
        variant={statusConfig.variant}
        className={statusConfig.className}
      >
        <StatusIcon className={`mr-1 h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} />
        {JOB_STATUS_MESSAGES[job.status] || job.status}
      </Badge>

      {/* Arrow */}
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
