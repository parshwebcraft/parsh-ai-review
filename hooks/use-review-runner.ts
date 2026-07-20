'use client';

import { useState, useCallback } from 'react';
import { analyzeCode, detectLanguage } from '@/lib/analyzer';
import { computeComplexity } from '@/lib/complexity';
import { requestAIReview, EMPTY_AI_FINDINGS } from '@/lib/ai-review';
import { createReviewWithFindings, type CreateReviewInput } from '@/lib/services';
import type {
  Language, ReviewType, ComplexityMetrics, StaticFinding,
  AIFindings, Review, Verdict, TestCase,
} from '@/types';

export interface RunReviewInput {
  projectId: string;
  reviewType: ReviewType;
  language: Language | 'auto';
  fileName: string;
  sourceCode: string;
}

export interface RunReviewResult {
  review: Review;
  language: Language;
  complexity: ComplexityMetrics;
  staticFindings: StaticFinding[];
  aiFindings: AIFindings;
  overallScore: number;
  summary: string;
  verdict: Verdict;
  confidence: number;
  intent: string;
  assumptions: string;
  deepAnalysis: string;
  suggestedFix: string;
  testCases: TestCase[];
  usedFallback: boolean;
}

export function useReviewRunner() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (input: RunReviewInput): Promise<RunReviewResult> => {
    setRunning(true);
    setError(null);
    setProgress('Detecting language...');
    try {
      const language: Language =
        input.language === 'auto'
          ? detectLanguage(input.fileName, input.sourceCode)
          : input.language;

      setProgress('Running static analysis...');
      const analysis = analyzeCode({
        language,
        fileName: input.fileName,
        source: input.sourceCode,
      });

      setProgress('Computing complexity metrics...');
      const complexity = computeComplexity(input.sourceCode, language);

      setProgress('Running 5-step AI deep review...');
      let aiResponse;
      let usedFallback = false;
      try {
        aiResponse = await requestAIReview({
          language,
          sourceCode: input.sourceCode,
          fileName: input.fileName,
          staticFindings: analysis.findings,
        });
      } catch (e) {
        usedFallback = true;
        const msg = e instanceof Error ? e.message : 'AI review failed';
        // Build a heuristic result if the edge function is unreachable
        aiResponse = {
          verdict: 'INCORRECT' as Verdict,
          confidence: 50,
          overall_score: computeHeuristicScore(analysis.findings),
          intent: `${language} code in "${input.fileName}".`,
          assumptions: 'AI review unavailable — heuristic fallback used.',
          executive_summary: `Static analysis completed. AI review was unavailable (${msg}). Score derived from static findings.`,
          plain_english: `We analyzed your ${language} code and found ${analysis.findings.length} static issue(s). AI review was unavailable.`,
          deep_analysis: `AI service was unreachable (${msg}). Only static analysis results are available.\n\nSTEP 2 — Static Analysis\n${analysis.findings.map((f) => `• L${f.line}: [${f.severity}] ${f.rule} — ${f.message}`).join('\n') || 'No findings.'}`,
          documentation: `# ${input.fileName}\n\nStatic analysis-only review. ${analysis.findings.length} finding(s).\n`,
          suggested_fix: '(AI service unavailable — fix not generated)',
          test_cases: [],
          findings: EMPTY_AI_FINDINGS,
        };
      }

      setProgress('Saving review...');
      const payload: CreateReviewInput = {
        projectId: input.projectId,
        reviewType: input.reviewType,
        language,
        fileName: input.fileName,
        sourceCode: input.sourceCode,
        overallScore: aiResponse.overall_score,
        summary: aiResponse.executive_summary,
        plainEnglish: aiResponse.plain_english,
        documentation: aiResponse.documentation,
        complexity,
        staticFindings: analysis.findings,
        aiFindings: aiResponse.findings,
        verdict: aiResponse.verdict,
        confidence: aiResponse.confidence,
        intent: aiResponse.intent,
        assumptions: aiResponse.assumptions,
        deepAnalysis: aiResponse.deep_analysis,
        suggestedFix: aiResponse.suggested_fix,
        testCases: aiResponse.test_cases,
      };

      const review = await createReviewWithFindings(payload);

      setProgress('Done');
      return {
        review,
        language,
        complexity,
        staticFindings: analysis.findings,
        aiFindings: aiResponse.findings,
        overallScore: aiResponse.overall_score,
        summary: aiResponse.executive_summary,
        verdict: aiResponse.verdict,
        confidence: aiResponse.confidence,
        intent: aiResponse.intent,
        assumptions: aiResponse.assumptions,
        deepAnalysis: aiResponse.deep_analysis,
        suggestedFix: aiResponse.suggested_fix,
        testCases: aiResponse.test_cases,
        usedFallback,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      throw e;
    } finally {
      setRunning(false);
    }
  }, []);

  return { run, running, progress, error, setError };
}

function computeHeuristicScore(findings: StaticFinding[]): number {
  const critical = findings.filter((f) => f.severity === 'critical').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  return Math.max(10, Math.min(100, 100 - critical * 12 - warnings * 5));
}
