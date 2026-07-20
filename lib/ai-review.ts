'use client';

import { supabase } from '@/lib/supabase';
import type { AIFindings, AIReviewResponse, Language, StaticFinding } from '@/types';

export interface AIReviewRequest {
  language: Language;
  sourceCode: string;
  fileName: string;
  staticFindings: StaticFinding[];
}

export async function requestAIReview(req: AIReviewRequest): Promise<AIReviewResponse> {
  const { data: session } = await supabase.auth.getSession();
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-review`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.session?.access_token ?? ''}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI review failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (!data || typeof data.overall_score !== 'number') {
    throw new Error('AI review returned an unexpected response shape');
  }
  return data as AIReviewResponse;
}

export const EMPTY_AI_FINDINGS: AIFindings = {
  bug_detection: [],
  security_issues: [],
  code_smells: [],
  performance_suggestions: [],
  naming_suggestions: [],
  best_practices: [],
  refactoring_suggestions: [],
};
