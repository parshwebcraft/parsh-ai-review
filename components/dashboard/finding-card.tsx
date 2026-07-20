'use client';

import { motion } from 'framer-motion';
import { Lightbulb, AlertTriangle, ShieldAlert, Info, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { SeverityBadge, CategoryBadge } from '@/components/dashboard/score-gauge';
import type { ReviewFinding } from '@/types';
import { cn } from '@/lib/utils';

interface FindingCardProps {
  finding: ReviewFinding;
  index: number;
  onJump?: (line: number) => void;
}

export function FindingCard({ finding, index, onJump }: FindingCardProps) {
  const icon = finding.severity === 'critical' ? ShieldAlert : finding.severity === 'warning' ? AlertTriangle : Info;
  const Icon = icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
    >
      <Card className="p-4 hover:border-primary/40 transition-colors group">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            finding.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
            finding.severity === 'warning' ? 'bg-warning/10 text-warning' :
            'bg-primary/10 text-primary')}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <SeverityBadge severity={finding.severity} />
              <CategoryBadge category={finding.category} />
              {finding.line_number > 0 && (
                <button
                  onClick={() => onJump?.(finding.line_number)}
                  className="text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors"
                >
                  {finding.file_name}:{finding.line_number}
                </button>
              )}
            </div>
            <p className="text-sm font-medium leading-snug mb-1.5">{finding.issue}</p>
            {finding.explanation && (
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">{finding.explanation}</p>
            )}
            {finding.suggested_fix && (
              <div className="flex items-start gap-1.5 rounded-md bg-success/5 border border-success/20 p-2">
                <Wrench className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80 leading-relaxed font-mono">
                  {finding.suggested_fix}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

interface EmptyFindingsProps {
  title?: string;
  description?: string;
}

export function EmptyFindings({ title = 'No issues found', description = 'This code passed all checks.' }: EmptyFindingsProps) {
  return (
    <Card className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success mb-3">
        <Lightbulb className="h-6 w-6" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </Card>
  );
}
