'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { scoreToGrade } from '@/lib/complexity';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  label?: string;
}

export function ScoreGauge({ score, size = 140, label = 'Score' }: ScoreGaugeProps) {
  const safeScore = Math.max(0, Math.min(100, score));
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;
  const color = safeScore >= 80 ? 'hsl(var(--success))' : safeScore >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';
  const grade = scoreToGrade(safeScore);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="hsl(var(--muted))" strokeWidth="8" opacity="0.4"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{safeScore}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="mt-0.5 text-sm font-semibold" style={{ color }}>{grade}</span>
      </div>
    </div>
  );
}

interface SeverityBadgeProps {
  severity: 'critical' | 'warning' | 'info';
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const styles = {
    critical: 'bg-destructive/10 text-destructive border-destructive/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    info: 'bg-primary/10 text-primary border-primary/30',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', styles[severity], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', severity === 'critical' ? 'bg-destructive' : severity === 'warning' ? 'bg-warning' : 'bg-primary')} />
      {severity}
    </span>
  );
}

interface CategoryBadgeProps {
  category: string;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const labels: Record<string, string> = {
    bug: 'Bug', security: 'Security', smell: 'Code Smell', performance: 'Performance',
    naming: 'Naming', best_practice: 'Best Practice', refactor: 'Refactor', static: 'Static',
  };
  return (
    <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {labels[category] ?? category}
    </span>
  );
}
