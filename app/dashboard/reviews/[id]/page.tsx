'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, FileCode, AlertTriangle, ShieldAlert, Info,
  Lightbulb, BookOpen, Code2, BarChart3, FileText, Zap, Copy, Check,
  CheckCircle2, XCircle, Target, FlaskConical, Wrench, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { fetchReview, fetchFindings } from '@/lib/services';
import { CodeEditor } from '@/components/dashboard/code-editor';
import { ScoreGauge, SeverityBadge } from '@/components/dashboard/score-gauge';
import { FindingCard, EmptyFindings } from '@/components/dashboard/finding-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { LANGUAGES } from '@/lib/constants';
import { scoreToGrade } from '@/lib/complexity';
import type { Severity, Review, ReviewFinding, TestCase } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar,
  PolarAngleAxis, Cell,
} from 'recharts';

const AI_CATEGORY_LABELS: Record<string, string> = {
  bug_detection: 'Bug Detection',
  security_issues: 'Security Issues',
  code_smells: 'Code Smells',
  performance_suggestions: 'Performance',
  naming_suggestions: 'Naming',
  best_practices: 'Best Practices',
  refactoring_suggestions: 'Refactoring',
};

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [highlightLines, setHighlightLines] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);

  const { data: review, isLoading } = useQuery<Review | null>({
    queryKey: ['review', params.id],
    queryFn: () => fetchReview(params.id),
    enabled: !!params.id,
  });
  const { data: findings } = useQuery<ReviewFinding[]>({
    queryKey: ['findings', params.id],
    queryFn: () => fetchFindings(params.id),
    enabled: !!params.id,
  });

  const reviewData: Review | null = (review as Review | null | undefined) ?? null;
  const findingsList: ReviewFinding[] = (findings as ReviewFinding[] | undefined) ?? [];

  const grouped = useMemo<Record<Severity, ReviewFinding[]>>(() => {
    const groups: Record<Severity, ReviewFinding[]> = { critical: [], warning: [], info: [] };
    findingsList.forEach((f: ReviewFinding) => groups[f.severity].push(f));
    return groups;
  }, [findingsList]);

  const aiFindingsList = useMemo(() => {
    if (!reviewData?.ai_findings) return [];
    return Object.entries(reviewData.ai_findings).flatMap(([cat, items]) =>
      (items as Array<Record<string, unknown>>).map((item) => ({ ...item, category: cat }))
    );
  }, [reviewData]);

  const complexityData = useMemo(() => {
    if (!reviewData?.complexity) return null;
    const c = reviewData.complexity;
    return {
      radial: [
        { name: 'Maintainability', value: c.maintainability_index, fill: 'hsl(var(--success))' },
        { name: 'Score', value: reviewData.overall_score, fill: 'hsl(var(--primary))' },
      ],
      bars: c.per_function.slice(0, 8).map((f) => ({ name: f.name.slice(0, 16), complexity: f.complexity, lines: f.lines })),
      metrics: c,
    };
  }, [reviewData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!reviewData) {
    return (
      <Card className="py-16 text-center">
        <CardContent>
          <h2 className="font-semibold">Review not found</h2>
          <p className="text-sm text-muted-foreground mt-1">It may have been deleted.</p>
          <Link href="/dashboard/history"><Button variant="outline" className="mt-4">Back to history</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const lang = LANGUAGES.find((l) => l.value === reviewData.language);
  const isCorrect = reviewData.verdict === 'CORRECT';
  const testCases: TestCase[] = (reviewData.test_cases as TestCase[] | undefined) ?? [];
  const passCount = testCases.filter((t) => t.passes).length;

  const jumpToLine = (line: number) => {
    setHighlightLines([line]);
    const el = document.getElementById('code-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const copyDoc = () => {
    navigator.clipboard.writeText(reviewData.documentation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyFix = () => {
    navigator.clipboard.writeText(reviewData.suggested_fix || '');
    setCopiedFix(true);
    setTimeout(() => setCopiedFix(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" /> {reviewData.file_name}
            </h1>
            <p className="text-sm text-muted-foreground">{lang?.label} · {reviewData.review_type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Verdict badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold border ${
              isCorrect
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
            }`}
          >
            {isCorrect
              ? <CheckCircle2 className="h-4 w-4" />
              : <XCircle className="h-4 w-4" />}
            {reviewData.verdict ?? 'INCORRECT'}
          </motion.div>
          <Badge variant="outline" className={
            reviewData.overall_score >= 80 ? 'border-success/30 text-success' :
            reviewData.overall_score >= 60 ? 'border-warning/30 text-warning' :
            'border-destructive/30 text-destructive'
          }>
            Grade {scoreToGrade(reviewData.overall_score)}
          </Badge>
        </div>
      </div>

      {/* Top: Score + Summary */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center p-6">
          <ScoreGauge score={reviewData.overall_score} size={180} />
          <p className="mt-3 text-xs text-muted-foreground uppercase tracking-widest">Overall Score</p>
          {/* Confidence bar */}
          {typeof reviewData.confidence === 'number' && (
            <div className="w-full mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Confidence</span>
                <span className="font-mono font-semibold">{reviewData.confidence}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${reviewData.confidence}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    reviewData.confidence >= 80 ? 'bg-emerald-500' :
                    reviewData.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                />
              </div>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{reviewData.summary}</p>
            <div className="rounded-lg bg-muted/40 p-4 border border-border/60">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Plain English</p>
              <p className="text-sm leading-relaxed text-foreground/90">{reviewData.plain_english}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Critical" value={grouped.critical.length} icon={ShieldAlert} color="text-destructive" />
              <StatBox label="Warnings" value={grouped.warning.length} icon={AlertTriangle} color="text-warning" />
              <StatBox label="Info" value={grouped.info.length} icon={Info} color="text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Verdict / Findings / Complexity / Documentation / Code */}
      <Tabs defaultValue="verdict">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 max-w-3xl">
          <TabsTrigger value="verdict">
            {isCorrect
              ? <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              : <XCircle className="h-3.5 w-3.5 mr-1.5 text-red-500" />}
            Verdict
          </TabsTrigger>
          <TabsTrigger value="findings"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Findings</TabsTrigger>
          <TabsTrigger value="complexity"><BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Complexity</TabsTrigger>
          <TabsTrigger value="docs"><BookOpen className="h-3.5 w-3.5 mr-1.5" /> Docs</TabsTrigger>
          <TabsTrigger value="code"><Code2 className="h-3.5 w-3.5 mr-1.5" /> Code</TabsTrigger>
        </TabsList>

        {/* ── VERDICT TAB ─────────────────────────────────────────────────── */}
        <TabsContent value="verdict" className="mt-4 space-y-4">

          {/* Intent card */}
          {reviewData.intent && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> Inferred Intent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm leading-relaxed">{reviewData.intent}</p>
                {reviewData.assumptions && reviewData.assumptions !== 'None stated.' && (
                  <div className="rounded-md bg-muted/40 border border-border/60 p-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Assumptions: </span>
                    {reviewData.assumptions}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Deep Analysis (collapsible) */}
          {reviewData.deep_analysis && (
            <Card>
              <button
                onClick={() => setDeepOpen((o) => !o)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="text-base font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> 5-Step Deep Analysis
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${deepOpen ? 'rotate-180' : ''}`} />
              </button>
              {deepOpen && (
                <CardContent className="pt-0">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono bg-muted/30 rounded-lg p-4 border border-border/60 max-h-[500px] overflow-auto">
                    {reviewData.deep_analysis}
                  </pre>
                </CardContent>
              )}
            </Card>
          )}

          {/* Suggested Fix */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" /> Suggested Fix
              </CardTitle>
              {reviewData.suggested_fix && (
                <Button variant="outline" size="sm" onClick={copyFix}>
                  {copiedFix ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copiedFix ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!reviewData.suggested_fix || reviewData.suggested_fix.startsWith('(') ? (
                <div className="rounded-lg bg-muted/30 border border-border/60 p-6 text-center text-sm text-muted-foreground">
                  {isCorrect
                    ? '✅ No fix needed — the code is correct.'
                    : reviewData.suggested_fix || 'No suggested fix available.'}
                </div>
              ) : (
                <CodeEditor
                  value={reviewData.suggested_fix}
                  onChange={() => {}}
                  language={reviewData.language}
                  height={380}
                  readOnly
                />
              )}
            </CardContent>
          </Card>

          {/* Test Cases */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" /> Test Cases
                {testCases.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {passCount}/{testCases.length} passing
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Generated test cases to prove or disprove correctness</CardDescription>
            </CardHeader>
            <CardContent>
              {testCases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No test cases generated. Configure OpenAI API key for AI-generated test cases.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Test</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Input</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expected</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actual</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pass</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testCases.map((tc, i) => (
                        <tr key={i} className={`border-b border-border/40 transition-colors ${tc.passes ? 'hover:bg-emerald-500/5' : 'hover:bg-red-500/5'}`}>
                          <td className="py-2.5 px-3 font-medium max-w-[160px]">
                            <span className="line-clamp-2">{tc.description}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground max-w-[140px]">
                            <span className="line-clamp-2">{tc.input}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground max-w-[140px]">
                            <span className="line-clamp-2">{tc.expected}</span>
                          </td>
                          <td className={`py-2.5 px-3 font-mono text-xs max-w-[140px] ${tc.passes ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            <span className="line-clamp-2">{tc.actual}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {tc.passes
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              : <XCircle className="h-4 w-4 text-red-500 mx-auto" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FINDINGS TAB ────────────────────────────────────────────────── */}
        <TabsContent value="findings" className="mt-4 space-y-6">
          <FindingsGroup title="Critical Issues" icon={ShieldAlert} color="text-destructive" findings={grouped.critical} onJump={jumpToLine} />
          <FindingsGroup title="Warnings" icon={AlertTriangle} color="text-warning" findings={grouped.warning} onJump={jumpToLine} />
          <FindingsGroup title="Information" icon={Info} color="text-primary" findings={grouped.info} onJump={jumpToLine} />

          {/* AI findings by category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> AI Findings</CardTitle>
              <CardDescription>Generated by AI across {Object.keys(AI_CATEGORY_LABELS).length} categories</CardDescription>
            </CardHeader>
            <CardContent>
              {aiFindingsList.length === 0 ? (
                <EmptyFindings title="No AI findings" description="The AI did not flag any issues in this code." />
              ) : (
                <div className="space-y-5">
                  {Object.entries(reviewData.ai_findings).map(([cat, items]) => {
                    const list = items as Array<Record<string, unknown> & { issue: string; explanation: string; suggested_fix: string; line_number?: number }>;
                    if (!list || list.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-semibold">{AI_CATEGORY_LABELS[cat] ?? cat}</h4>
                          <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
                        </div>
                        <div className="space-y-2">
                          {list.map((item, i) => (
                            <div key={i} className="rounded-lg border border-border/60 p-3 hover:border-primary/40 transition-colors">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{String(item.issue)}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{String(item.explanation)}</p>
                                  {item.suggested_fix && (
                                    <p className="text-xs font-mono mt-2 rounded bg-success/5 border border-success/20 p-2 text-foreground/80">
                                      Fix: {String(item.suggested_fix)}
                                    </p>
                                  )}
                                  {typeof item.line_number === 'number' && item.line_number > 0 && (
                                    <button onClick={() => jumpToLine(item.line_number as number)} className="text-[10px] font-mono text-primary hover:underline mt-1.5">
                                      Line {item.line_number}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Static findings summary */}
          {reviewData.static_findings && reviewData.static_findings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Static Analysis ({reviewData.static_findings.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {reviewData.static_findings.slice(0, 50).map((f, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-md border border-border/40 p-2 text-sm hover:bg-accent/5">
                      <SeverityBadge severity={f.severity} />
                      <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">L{f.line}</span>
                      <span className="font-mono text-xs text-primary w-24 shrink-0 truncate">{f.rule}</span>
                      <span className="text-sm truncate flex-1">{f.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── COMPLEXITY TAB ──────────────────────────────────────────────── */}
        <TabsContent value="complexity" className="mt-4">
          {complexityData && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Cyclomatic" value={complexityData.metrics.cyclomatic_complexity} />
                <MetricCard label="Functions" value={complexityData.metrics.number_of_functions} />
                <MetricCard label="Classes" value={complexityData.metrics.number_of_classes} />
                <MetricCard label="Lines" value={complexityData.metrics.lines_of_code} />
                <MetricCard label="Function Avg" value={complexityData.metrics.function_complexity} />
                <MetricCard label="File Complexity" value={complexityData.metrics.file_complexity} />
                <MetricCard label="Maintainability" value={complexityData.metrics.maintainability_index} suffix="/100" highlight />
                <MetricCard label="Avg Score" value={reviewData.overall_score} suffix="/100" highlight />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quality Scores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <RadialBarChart innerRadius="30%" outerRadius="100%" data={complexityData.radial} startAngle={90} endAngle={-270}>
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar dataKey="value" cornerRadius={8} background>
                          {complexityData.radial.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </RadialBar>
                        <Tooltip />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-2">
                      {complexityData.radial.map((r) => (
                        <div key={r.name} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: r.fill }} />
                          <span className="text-xs text-muted-foreground">{r.name}: {r.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Per-Function Complexity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {complexityData.bars.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-10">No functions detected.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={complexityData.bars}>
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                          <Bar dataKey="complexity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── DOCS TAB ────────────────────────────────────────────────────── */}
        <TabsContent value="docs" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Generated Documentation</CardTitle>
              <Button variant="outline" size="sm" onClick={copyDoc}>
                {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed bg-muted/30 rounded-lg p-4 border border-border/60 max-h-[600px] overflow-auto">
                {reviewData.documentation}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CODE TAB ────────────────────────────────────────────────────── */}
        <TabsContent value="code" className="mt-4" id="code-section">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{reviewData.file_name}</CardTitle>
              <CardDescription>
                Click line numbers in findings to highlight lines here.
                {highlightLines.length > 0 && <span className="ml-1 text-primary">Highlighting line {highlightLines[0]}.</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeEditor
                value={reviewData.source_code}
                onChange={() => {}}
                language={reviewData.language}
                height={520}
                readOnly
                highlightLines={highlightLines}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-3 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</p>
    </div>
  );
}

function MetricCard({ label, value, suffix, highlight }: { label: string; value: number; suffix?: string; highlight?: boolean }) {
  return (
    <Card className={`p-4 ${highlight ? 'border-primary/30 bg-primary/5' : ''}`}>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? 'text-primary' : ''}`}>{value}<span className="text-sm text-muted-foreground font-normal">{suffix}</span></p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </Card>
  );
}

function FindingsGroup({ title, icon: Icon, color, findings, onJump }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  findings?: ReviewFinding[];
  onJump: (line: number) => void;
}) {
  const list: ReviewFinding[] = findings ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} /> {title}
          <Badge variant="secondary" className="ml-auto">{list.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">None detected.</p>
        ) : (
          <div className="space-y-2.5">
            {list.map((f, i) => (
              <FindingCard key={f.id ?? i} finding={f} index={i} onJump={onJump} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
