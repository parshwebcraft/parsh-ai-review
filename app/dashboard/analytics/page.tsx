'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart3, PieChart, Activity } from 'lucide-react';
import { fetchReviews, fetchProjects, fetchReviewStats } from '@/lib/services';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Review, Project } from '@/types';
import { LANGUAGES } from '@/lib/constants';
import {
  AreaChart, Area, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadialBarChart,
  RadialBar, PolarAngleAxis,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

export default function AnalyticsPage() {
  const { data: reviews, isLoading } = useQuery<Review[]>({ queryKey: ['reviews'], queryFn: fetchReviews });
  const { data: projects } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: fetchProjects });
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: fetchReviewStats });

  const trendData = buildTrend(reviews ?? []);
  const languageData = buildLanguageBreakdown(reviews ?? []);
  const scoreDistribution = buildScoreDistribution(reviews ?? []);
  const projectData = buildProjectBreakdown(reviews ?? [], projects ?? []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your code quality over time.</p>
        </div>
        <Card className="py-16 text-center">
          <CardContent>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <BarChart3 className="h-7 w-7" />
            </div>
            <h3 className="font-semibold">No data yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Run some reviews to see analytics here.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Code quality insights across all your reviews.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Total Reviews" value={stats?.totalReviews ?? 0} icon={Activity} />
        <KpiCard label="Avg Score" value={`${stats?.avgScore ?? 0}/100`} icon={TrendingUp} />
        <KpiCard label="Projects" value={stats?.totalProjects ?? 0} icon={BarChart3} />
        <KpiCard label="Critical" value={stats?.criticalCount ?? 0} icon={PieChart} danger />
      </div>

      {/* Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review Activity & Score Trend</CardTitle>
          <CardDescription>Last 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => format(new Date(d), 'MMM d')} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
              />
              <Area yAxisId="right" type="monotone" dataKey="avgScore" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorScore)" name="Avg Score" />
              <Area yAxisId="left" type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#colorCount)" name="Reviews" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Language breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Language Breakdown</CardTitle>
            <CardDescription>Reviews by language</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RePieChart>
                <Pie
                  data={languageData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={4}
                >
                  {languageData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
              </RePieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 flex-wrap">
              {languageData.map((l, i) => (
                <div key={l.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">{l.name} ({l.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Score distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Distribution</CardTitle>
            <CardDescription>Reviews grouped by score band</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {scoreDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-project */}
      {projectData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviews per Project</CardTitle>
            <CardDescription>Distribution of reviews across your projects</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={projectData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, danger }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; danger?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className={`mt-4 text-2xl font-bold tabular-nums ${danger ? 'text-destructive' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </Card>
  );
}

function buildTrend(reviews: Review[]) {
  const days: { date: string; count: number; avgScore: number; _scores: number[] }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(subDays(new Date(), i));
    days.push({ date: d.toISOString(), count: 0, avgScore: 0, _scores: [] });
  }
  for (const r of reviews) {
    const d = startOfDay(new Date(r.created_at)).toISOString();
    const bucket = days.find((b) => b.date === d);
    if (bucket) {
      bucket.count++;
      bucket._scores.push(r.overall_score);
    }
  }
  return days.map((b) => ({
    date: b.date,
    count: b.count,
    avgScore: b._scores.length > 0 ? Math.round(b._scores.reduce((a, x) => a + x, 0) / b._scores.length) : 0,
  }));
}

function buildLanguageBreakdown(reviews: Review[]) {
  const counts: Record<string, number> = {};
  for (const r of reviews) counts[r.language] = (counts[r.language] ?? 0) + 1;
  return Object.entries(counts).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v }));
}

function buildScoreDistribution(reviews: Review[]) {
  const bands = [
    { band: '0-39', min: 0, max: 39, count: 0, fill: 'hsl(var(--destructive))' },
    { band: '40-59', min: 40, max: 59, count: 0, fill: 'hsl(var(--warning))' },
    { band: '60-79', min: 60, max: 79, count: 0, fill: 'hsl(var(--chart-4))' },
    { band: '80-100', min: 80, max: 100, count: 0, fill: 'hsl(var(--success))' },
  ];
  for (const r of reviews) {
    const b = bands.find((x) => r.overall_score >= x.min && r.overall_score <= x.max);
    if (b) b.count++;
  }
  return bands;
}

function buildProjectBreakdown(reviews: Review[], projects: Project[]) {
  const counts: Record<string, number> = {};
  for (const r of reviews) counts[r.project_id] = (counts[r.project_id] ?? 0) + 1;
  return Object.entries(counts).map(([pid, count]) => ({
    name: projects.find((p) => p.id === pid)?.name ?? 'Unknown',
    count,
  })).sort((a, b) => b.count - a.count).slice(0, 10);
}
