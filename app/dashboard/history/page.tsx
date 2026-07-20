'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History as HistoryIcon, Search, Trash2, ArrowRight, Loader2,
  FileCode, ChevronLeft, ChevronRight, ArrowUpDown, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchReviews, deleteReview } from '@/lib/services';
import { LANGUAGES, REVIEW_HISTORY_PAGE_SIZE } from '@/lib/constants';
import type { Severity, Review } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SeverityBadge, CategoryBadge } from '@/components/dashboard/score-gauge';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

type SortKey = 'created_at' | 'overall_score' | 'file_name';
type SeverityFilter = 'all' | Severity;

function HistoryContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [language, setLanguage] = useState<string>('all');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [sort, setSort] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ['reviews'],
    queryFn: fetchReviews,
  });

  const deleteMut = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Review deleted');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo<Review[]>(() => {
    if (!reviews) return [];
    let list: Review[] = reviews;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((r) =>
        r.file_name.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.language.toLowerCase().includes(q)
      );
    }
    if (language !== 'all') list = list.filter((r) => r.language === language);
    if (severity !== 'all') {
      list = list.filter((r) => {
        const findings = (r.static_findings ?? []) as Array<{ severity: string }>;
        const ai = r.ai_findings ?? {};
        const hasCat = Object.entries(ai).some(([cat, items]) => {
          const sev: Severity = cat === 'bug_detection' || cat === 'security_issues' ? 'critical'
            : cat === 'code_smells' || cat === 'performance_suggestions' || cat === 'refactoring_suggestions' ? 'warning' : 'info';
          return sev === severity && (items as Array<unknown>).length > 0;
        });
        return hasCat || findings.some((f) => f.severity === severity);
      });
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sort === 'overall_score') cmp = a.overall_score - b.overall_score;
      else cmp = a.file_name.localeCompare(b.file_name);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [reviews, query, language, severity, sort, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / REVIEW_HISTORY_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * REVIEW_HISTORY_PAGE_SIZE, current * REVIEW_HISTORY_PAGE_SIZE);

  useEffect(() => { setPage(1); }, [query, language, severity, sort, sortDir]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search, filter, and review past analyses.</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search file names, summaries..."
              className="pl-9"
            />
          </div>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full lg:w-40"><Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue placeholder="Language" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityFilter)}>
            <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-full lg:w-40"><ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Date</SelectItem>
              <SelectItem value="overall_score">Score</SelectItem>
              <SelectItem value="file_name">File name</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')} title="Toggle sort direction">
            <ArrowUpDown className={`h-4 w-4 ${sortDir === 'asc' ? 'rotate-180' : ''} transition-transform`} />
          </Button>
        </div>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : pageItems.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <HistoryIcon className="h-7 w-7" />
            </div>
            <h3 className="font-semibold">No reviews found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered.length === 0 && reviews && reviews.length > 0 ? 'Try adjusting your filters.' : 'Run your first review to see it here.'}
            </p>
            <Link href="/dashboard/reviews/new"><Button className="mt-4">New Review</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence>
            {pageItems.map((r, i) => {
              const lang = LANGUAGES.find((l) => l.value === r.language);
              const critical = ((r.static_findings ?? []) as Array<{ severity: string }>).filter((f) => f.severity === 'critical').length;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={`/dashboard/reviews/${r.id}`}>
                    <Card className="group hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted/40 font-mono text-xs uppercase font-semibold">
                            {lang?.extension ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{r.file_name}</p>
                              {critical > 0 && <SeverityBadge severity="critical" />}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{r.summary}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {format(new Date(r.created_at), 'MMM d, yyyy')} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="hidden md:flex items-center gap-3">
                            <div className="text-center">
                              <p className={`text-2xl font-bold tabular-nums ${
                                r.overall_score >= 80 ? 'text-success' : r.overall_score >= 60 ? 'text-warning' : 'text-destructive'
                              }`}>{r.overall_score}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">score</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(r.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(current - 1) * REVIEW_HISTORY_PAGE_SIZE + 1}-{Math.min(current * REVIEW_HISTORY_PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={current === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums">{current} / {totalPages}</span>
            <Button variant="outline" size="icon" disabled={current === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete review?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the review and all its findings. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <HistoryContent />
    </Suspense>
  );
}
