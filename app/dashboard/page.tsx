'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileSearch, FolderGit2, TrendingUp, ShieldAlert, ArrowRight,
  Plus, Activity, Clock,
} from 'lucide-react';
import { fetchReviews, fetchProjects, fetchReviewStats } from '@/lib/services';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScoreGauge } from '@/components/dashboard/score-gauge';
import { LANGUAGES } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import type { Review } from '@/types';

export default function DashboardHome() {
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchReviewStats,
  });
  const { data: reviews, isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: ['reviews', 'recent'],
    queryFn: async (): Promise<Review[]> => (await fetchReviews()).slice(0, 5),
  });
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const firstName = profile?.name?.split(' ')[0] ?? 'there';
  const recentReviews: Review[] = (reviews as Review[] | undefined) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {mounted && firstName ? <span className="gradient-text">{firstName}</span> : '—'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your code reviews.
          </p>
        </div>
        <Link href="/dashboard/reviews/new">
          <Button className="group">
            <Plus className="h-4 w-4 mr-1.5" /> New Review
            <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileSearch}
          label="Total Reviews"
          value={stats?.totalReviews}
          loading={statsLoading}
          accent="primary"
        />
        <StatCard
          icon={FolderGit2}
          label="Projects"
          value={stats?.totalProjects}
          loading={statsLoading}
          accent="accent"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg. Score"
          value={stats?.avgScore}
          suffix="/100"
          loading={statsLoading}
          accent="success"
        />
        <StatCard
          icon={ShieldAlert}
          label="Critical Issues"
          value={stats?.criticalCount}
          loading={statsLoading}
          accent="destructive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent reviews */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent Reviews</CardTitle>
              <CardDescription>Your latest code analyses</CardDescription>
            </div>
            <Link href="/dashboard/history">
              <Button variant="ghost" size="sm" className="text-primary">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {reviewsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentReviews.length === 0 ? (
              <div className="text-center py-10">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">No reviews yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Run your first code review to see it here.</p>
                <Link href="/dashboard/reviews/new" className="inline-block mt-4">
                  <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> New Review</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentReviews.map((r: Review, i: number) => {
                  const lang = LANGUAGES.find((l) => l.value === r.language);
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link href={`/dashboard/reviews/${r.id}`}>
                        <div className="group flex items-center gap-4 rounded-lg border border-border/60 p-3 hover:border-primary/40 hover:bg-accent/5 transition-all">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/40 font-mono text-xs uppercase font-semibold">
                            {lang?.extension ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{r.file_name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {mounted ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : '—'}
                            </p>
                          </div>
                          <Badge variant="outline" className={
                            r.overall_score >= 80 ? 'border-success/30 text-success' :
                            r.overall_score >= 60 ? 'border-warning/30 text-warning' :
                            'border-destructive/30 text-destructive'
                          }>
                            {r.overall_score}/100
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick stats card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Health</CardTitle>
            <CardDescription>Your codebase quality</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ScoreGauge score={stats?.avgScore ?? 0} size={160} label="Avg Score" />
            <div className="mt-6 w-full space-y-2.5">
              <HealthRow label="Projects" value={projects?.length ?? 0} max={10} />
              <HealthRow label="Reviews" value={stats?.totalReviews ?? 0} max={50} />
              <HealthRow label="Critical" value={stats?.criticalCount ?? 0} max={20} danger />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, suffix, loading, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  suffix?: string;
  loading?: boolean;
  accent: 'primary' | 'accent' | 'success' | 'destructive';
}) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/10 text-success',
    destructive: 'bg-destructive/10 text-destructive',
  };
  return (
    <Card className="p-5 hover:border-border transition-colors">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-bold tabular-nums">
            {value ?? 0}<span className="text-base text-muted-foreground font-normal">{suffix}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </Card>
  );
}

function HealthRow({ label, value, max, danger }: { label: string; value: number; max: number; danger?: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${danger ? 'bg-destructive' : 'bg-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
