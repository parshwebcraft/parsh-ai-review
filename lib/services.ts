'use client';

import { supabase } from '@/lib/supabase';
import type {
  Project, Review, ReviewFinding, Language, ReviewType,
  ComplexityMetrics, StaticFinding, AIFindings, Verdict, TestCase,
} from '@/types';

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

/**
 * Returns the user's first project, or creates a default "Quick Review"
 * project if they don't have one yet. This allows Run Review to work
 * immediately without forcing the user to create a project first.
 */
export async function getOrCreateDefaultProject(): Promise<Project> {
  const existing = await fetchProjects();
  if (existing.length > 0) return existing[0];
  return createProject({ name: 'Quick Review', description: 'Auto-created default project', language: 'javascript' });
}

export async function createProject(input: {
  name: string;
  description?: string;
  language: Language;
}): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Review[];
}

export async function fetchReviewsByProject(projectId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Review[];
}

export async function fetchReview(id: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Review | null;
}

export async function fetchFindings(reviewId: string): Promise<ReviewFinding[]> {
  const { data, error } = await supabase
    .from('review_findings')
    .select('*')
    .eq('review_id', reviewId)
    .order('line_number', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReviewFinding[];
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export interface CreateReviewInput {
  projectId: string;
  reviewType: ReviewType;
  language: Language;
  fileName: string;
  sourceCode: string;
  overallScore: number;
  summary: string;
  plainEnglish: string;
  documentation: string;
  complexity: ComplexityMetrics;
  staticFindings: StaticFinding[];
  aiFindings: AIFindings;
  // 5-step pipeline fields
  verdict: Verdict;
  confidence: number;
  intent: string;
  assumptions: string;
  deepAnalysis: string;
  suggestedFix: string;
  testCases: TestCase[];
}

export async function createReviewWithFindings(input: CreateReviewInput): Promise<Review> {
  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .insert({
      project_id: input.projectId,
      review_type: input.reviewType,
      language: input.language,
      file_name: input.fileName,
      source_code: input.sourceCode,
      overall_score: input.overallScore,
      summary: input.summary,
      plain_english: input.plainEnglish,
      documentation: input.documentation,
      complexity: input.complexity,
      static_findings: input.staticFindings,
      ai_findings: input.aiFindings,
      status: 'completed',
      // 5-step pipeline fields
      verdict: input.verdict,
      confidence: input.confidence,
      intent: input.intent,
      assumptions: input.assumptions,
      deep_analysis: input.deepAnalysis,
      suggested_fix: input.suggestedFix,
      test_cases: input.testCases,
    })
    .select()
    .single();
  if (reviewError) throw new Error(reviewError.message);
  const savedReview = review as Review;

  const allFindings = collectFindings(input.staticFindings, input.aiFindings, input.fileName);
  if (allFindings.length > 0) {
    const rows = allFindings.map((f) => ({
      review_id: savedReview.id,
      severity: f.severity,
      category: f.category,
      issue: f.issue,
      explanation: f.explanation,
      suggested_fix: f.suggested_fix,
      file_name: f.file_name,
      line_number: f.line_number,
    }));
    const { error: findErr } = await supabase.from('review_findings').insert(rows);
    if (findErr) throw new Error(findErr.message);
  }

  return savedReview;
}

function collectFindings(
  staticFindings: StaticFinding[],
  aiFindings: AIFindings,
  fileName: string
): Array<{ severity: 'critical' | 'warning' | 'info'; category: string; issue: string; explanation: string; suggested_fix: string; file_name: string; line_number: number }> {
  const out: Array<{ severity: 'critical' | 'warning' | 'info'; category: string; issue: string; explanation: string; suggested_fix: string; file_name: string; line_number: number }> = [];

  for (const sf of staticFindings) {
    out.push({
      severity: sf.severity,
      category: 'static',
      issue: `${sf.rule}: ${sf.message}`,
      explanation: `Static analysis finding (${sf.rule}).`,
      suggested_fix: 'See the rule documentation for remediation.',
      file_name: fileName,
      line_number: sf.line,
    });
  }

  const categoryMap: Array<{ key: keyof AIFindings; cat: string }> = [
    { key: 'bug_detection', cat: 'bug' },
    { key: 'security_issues', cat: 'security' },
    { key: 'code_smells', cat: 'smell' },
    { key: 'performance_suggestions', cat: 'performance' },
    { key: 'naming_suggestions', cat: 'naming' },
    { key: 'best_practices', cat: 'best_practice' },
    { key: 'refactoring_suggestions', cat: 'refactor' },
  ];

  for (const { key, cat } of categoryMap) {
    for (const af of aiFindings[key] ?? []) {
      out.push({
        severity: inferSeverity(cat),
        category: cat,
        issue: af.issue,
        explanation: af.explanation,
        suggested_fix: af.suggested_fix,
        file_name: fileName,
        line_number: af.line_number ?? 0,
      });
    }
  }

  return out;
}

function inferSeverity(cat: string): 'critical' | 'warning' | 'info' {
  if (cat === 'bug' || cat === 'security') return 'critical';
  if (cat === 'smell' || cat === 'performance' || cat === 'refactor') return 'warning';
  return 'info';
}

export async function fetchReviewStats(): Promise<{
  totalReviews: number;
  avgScore: number;
  totalProjects: number;
  criticalCount: number;
}> {
  const [reviews, projects, findings] = await Promise.all([
    supabase.from('reviews').select('overall_score'),
    supabase.from('projects').select('id'),
    supabase.from('review_findings').select('severity').eq('severity', 'critical'),
  ]);

  if (reviews.error) throw new Error(reviews.error.message);
  if (projects.error) throw new Error(projects.error.message);

  const totalReviews = reviews.data?.length ?? 0;
  const avgScore = totalReviews > 0
    ? Math.round((reviews.data ?? []).reduce((a, r) => a + r.overall_score, 0) / totalReviews)
    : 0;

  return {
    totalReviews,
    avgScore,
    totalProjects: projects.data?.length ?? 0,
    criticalCount: findings.data?.length ?? 0,
  };
}
