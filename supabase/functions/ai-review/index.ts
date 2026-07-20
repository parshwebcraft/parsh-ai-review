import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StaticFinding {
  rule: string;
  severity: "critical" | "warning" | "info";
  message: string;
  line: number;
  column: number;
  category: string;
}

interface RequestBody {
  language: string;
  sourceCode: string;
  fileName: string;
  staticFindings: StaticFinding[];
}

interface AIFinding {
  issue: string;
  explanation: string;
  suggested_fix: string;
  line_number?: number;
}

interface AIFindings {
  bug_detection: AIFinding[];
  security_issues: AIFinding[];
  code_smells: AIFinding[];
  performance_suggestions: AIFinding[];
  naming_suggestions: AIFinding[];
  best_practices: AIFinding[];
  refactoring_suggestions: AIFinding[];
}

interface TestCase {
  description: string;
  input: string;
  expected: string;
  actual: string;
  passes: boolean;
}

interface AIResponse {
  verdict: "CORRECT" | "INCORRECT";
  confidence: number;
  overall_score: number;
  intent: string;
  assumptions: string;
  executive_summary: string;
  plain_english: string;
  documentation: string;
  deep_analysis: string;
  suggested_fix: string;
  test_cases: TestCase[];
  findings: AIFindings;
}

const FINDING_CATEGORIES = [
  "bug_detection",
  "security_issues",
  "code_smells",
  "performance_suggestions",
  "naming_suggestions",
  "best_practices",
  "refactoring_suggestions",
] as const;

const openAiKey        = Deno.env.get("OPENAI_API_KEY");
// If you have fine-tuned a model, set FINE_TUNED_MODEL in Supabase secrets.
// e.g.  ft:gpt-4o-mini:your-org::XXXXXXXX
// Falls back to gpt-4o-mini if not set.
const fineTunedModel   = Deno.env.get("FINE_TUNED_MODEL");
const MODEL_TO_USE     = fineTunedModel ?? "gpt-4o-mini";

function verifyJwt(token: string | null): boolean {
  if (!token) return false;
  return token.split(".").length === 3;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!verifyJwt(token)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.sourceCode || body.sourceCode.length > 200_000) {
      return new Response(JSON.stringify({ error: "Invalid or oversized source code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = openAiKey
      ? await reviewWithOpenAI(body)
      : heuristicReview(body);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Fall back to heuristic if OpenAI fails
    try {
      const body = (await req.clone().json()) as RequestBody;
      const result = heuristicReview(body);
      return new Response(
        JSON.stringify({ ...result, _fallback: true, _warning: message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
});

// ─── OpenAI-powered 5-step deep review ───────────────────────────────────────

async function reviewWithOpenAI(body: RequestBody): Promise<AIResponse> {
  const staticSummary = body.staticFindings
    .slice(0, 20)
    .map((f) => `L${f.line}: [${f.severity}] ${f.rule} — ${f.message}`)
    .join("\n");

  const systemPrompt = `You are a senior software engineer and strict code reviewer.
Your job is to find problems in code, NOT to approve it.

Perform a complete analysis using these exact steps:

STEP 1 — Understand the Intent
- Identify what the code is supposed to do.
- If the requirement is missing, infer the purpose from variable names, comments, and structure.
- List any assumptions you are making.

STEP 2 — Static Analysis
Check for:
- Syntax errors
- Undefined variables
- Wrong imports
- Incorrect function usage
- Type errors
- Incorrect API usage
- Bad assumptions

STEP 3 — Logic Analysis
Do NOT only check whether the code runs. Verify:
- Does it produce the expected output?
- Are calculations correct?
- Are conditions logically correct?
- Are loops handling all cases?
- Are edge cases handled?
- Are there off-by-one errors?
- Are there incorrect variable updates?

STEP 4 — Runtime Thinking
Mentally execute the code with:
- Normal inputs
- Empty inputs
- Boundary cases
- Unexpected inputs (null, negative numbers, empty strings, etc.)

STEP 5 — Security & Quality Review
Check:
- Security vulnerabilities (injection, XSS, hardcoded secrets, unsafe eval)
- Bad error handling (swallowed exceptions, missing try/catch)
- Performance issues (O(n²) loops, memory leaks, unnecessary re-renders)
- Maintainability problems (magic numbers, duplicated logic, god functions)

Decision Rules:
- NEVER say CORRECT just because the code is syntactically valid.
- NEVER assume the programmer's intention is correct.
- If there is ANY logic bug, mark it INCORRECT.
- Be specific — reference exact line numbers.

Return ONLY a valid JSON object (no markdown, no prose outside JSON) with this EXACT shape:
{
  "verdict": "CORRECT" | "INCORRECT",
  "confidence": <0-100 integer — how confident you are in the verdict>,
  "overall_score": <0-100 integer — code quality score>,
  "intent": "<1-2 sentences: what the code is supposed to do>",
  "assumptions": "<bullet-point assumptions made, or 'None'>",
  "executive_summary": "<3-5 sentence technical summary>",
  "plain_english": "<3-5 sentence non-technical explanation for a junior dev>",
  "deep_analysis": "<Full STEP 1–5 narrative. Be thorough. Min 200 words.>",
  "documentation": "<Markdown documentation for the code, including function signatures>",
  "suggested_fix": "<The complete corrected code if INCORRECT, or the original code if CORRECT>",
  "test_cases": [
    {
      "description": "<what is being tested>",
      "input": "<concrete input value(s)>",
      "expected": "<expected output>",
      "actual": "<what the buggy code actually produces>",
      "passes": <true if the current code produces the expected output, false otherwise>
    }
  ],
  "findings": {
    "bug_detection": [{"issue":"","explanation":"","suggested_fix":"","line_number":0}],
    "security_issues": [{"issue":"","explanation":"","suggested_fix":"","line_number":0}],
    "code_smells": [{"issue":"","explanation":"","suggested_fix":"","line_number":0}],
    "performance_suggestions": [{"issue":"","explanation":"","suggested_fix":"","line_number":0}],
    "naming_suggestions": [{"issue":"","explanation":"","suggested_fix":"","line_number":0}],
    "best_practices": [{"issue":"","explanation":"","suggested_fix":"","line_number":0}],
    "refactoring_suggestions": [{"issue":"","explanation":"","suggested_fix":"","line_number":0}]
  }
}
Rules: line numbers must be within the file. If a category has no findings, return []. Generate 3-5 test_cases minimum.`;

  const userPrompt = `File: ${body.fileName}
Language: ${body.language}

Pre-computed static analysis findings:
${staticSummary || "(none — static analyzer found nothing)"}

Source code to review:
\`\`\`${body.language}
${body.sourceCode.slice(0, 18000)}
\`\`\``;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_TO_USE,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  const parsed = JSON.parse(content) as Partial<AIResponse>;
  return normalizeResponse(parsed, body);
}

// ─── Heuristic fallback (no OpenAI key) ──────────────────────────────────────

function heuristicReview(body: RequestBody): AIResponse {
  const findings: AIFindings = {
    bug_detection: [],
    security_issues: [],
    code_smells: [],
    performance_suggestions: [],
    naming_suggestions: [],
    best_practices: [],
    refactoring_suggestions: [],
  };

  const lines = body.sourceCode.split("\n");
  const isPy = body.language === "python";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (/eval\(|exec\(/.test(line)) {
      findings.security_issues.push({
        issue: "Use of eval/exec",
        explanation: "Dynamic code execution allows arbitrary code injection and is a serious security risk.",
        suggested_fix: "Replace with a safe parser or structured evaluation.",
        line_number: lineNum,
      });
    }
    if (!isPy && /\.innerHTML\s*=/.test(line)) {
      findings.security_issues.push({
        issue: "XSS risk via innerHTML",
        explanation: "Assigning untrusted content to innerHTML can execute injected scripts.",
        suggested_fix: "Use textContent or sanitize input with DOMPurify.",
        line_number: lineNum,
      });
    }
    if (!isPy && /\bvar\b/.test(line)) {
      findings.best_practices.push({
        issue: "'var' declaration",
        explanation: "var is function-scoped and can cause subtle hoisting bugs.",
        suggested_fix: "Use let/const for block scoping.",
        line_number: lineNum,
      });
    }
    if (isPy && /^except\s*:/.test(line.trim())) {
      findings.best_practices.push({
        issue: "Bare except clause",
        explanation: "Catches every exception including KeyboardInterrupt and SystemExit.",
        suggested_fix: "Catch specific exceptions, e.g. `except Exception:`.",
        line_number: lineNum,
      });
    }
    if (/(==|!=)\s*(None|True|False)/.test(line) || /(None|True|False)\s*(==|!=)/.test(line)) {
      findings.best_practices.push({
        issue: isPy ? "Equality comparison with singleton" : "Loose equality",
        explanation: isPy ? "Use identity comparison for singletons." : "Use strict equality to avoid type coercion bugs.",
        suggested_fix: isPy ? "Use 'is' / 'is not'." : "Use === / !==.",
        line_number: lineNum,
      });
    }
    if (/\.forEach\s*\(/.test(line)) {
      findings.performance_suggestions.push({
        issue: "forEach used with side effects",
        explanation: "forEach cannot be short-circuited and often hides intent vs. a for-of loop.",
        suggested_fix: "Use a for-of loop when you need to break or return.",
        line_number: lineNum,
      });
    }
    if (/const\s+[a-z]\b/.test(line) || /def\s+[a-z]\b\s*\(/.test(line)) {
      findings.naming_suggestions.push({
        issue: "Single-letter identifier",
        explanation: "Single-letter names are unclear outside short loops.",
        suggested_fix: "Use a descriptive name.",
        line_number: lineNum,
      });
    }
    if (line.length > 120) {
      findings.code_smells.push({
        issue: "Very long line",
        explanation: `Line is ${line.length} characters, reducing readability.`,
        suggested_fix: "Break into multiple lines or extract a helper.",
        line_number: lineNum,
      });
    }
    if (/(TODO|FIXME|HACK)/.test(line)) {
      findings.code_smells.push({
        issue: "Unresolved TODO",
        explanation: "TODO comments signal incomplete work.",
        suggested_fix: "Track in an issue tracker and resolve before release.",
        line_number: lineNum,
      });
    }
    if (!isPy && /catch\s*\(\s*\w+\s*\)\s*{\s*}/.test(line + lines.slice(i + 1, i + 4).join(" "))) {
      findings.bug_detection.push({
        issue: "Swallowed exception",
        explanation: "An empty catch block hides errors silently.",
        suggested_fix: "At minimum log the error; usually rethrow or handle it.",
        line_number: lineNum,
      });
    }
    if (isPy && /def\s+\w+\([^)]*=\s*(\[\]|\{\}|set\(\))/.test(line)) {
      findings.bug_detection.push({
        issue: "Mutable default argument",
        explanation: "The default is created once and shared across all calls.",
        suggested_fix: "Use None and set the default inside the function body.",
        line_number: lineNum,
      });
    }
  }

  if (lines.length > 300) {
    findings.refactoring_suggestions.push({
      issue: "File exceeds 300 lines",
      explanation: "Large files are harder to maintain and test.",
      suggested_fix: "Split into focused modules by responsibility.",
      line_number: 1,
    });
  }

  const critical = body.staticFindings.filter((f) => f.severity === "critical").length;
  const warnings = body.staticFindings.filter((f) => f.severity === "warning").length;
  const hasCriticalBug = findings.bug_detection.length > 0 || findings.security_issues.length > 0 || critical > 0;
  const score = Math.max(10, Math.min(100,
    100 - critical * 12 - warnings * 5
      - findings.bug_detection.length * 6
      - findings.security_issues.length * 8
      - findings.code_smells.length * 2
  ));

  const verdict: "CORRECT" | "INCORRECT" = hasCriticalBug ? "INCORRECT" : score >= 70 ? "CORRECT" : "INCORRECT";
  const confidence = hasCriticalBug ? 82 : score >= 80 ? 75 : 60;

  // Generate heuristic intent
  const fnNames: string[] = [];
  const fnRegex = isPy
    ? /def\s+([A-Za-z_]\w*)\s*\(/g
    : /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;
  let m: RegExpExecArray | null;
  while ((m = fnRegex.exec(body.sourceCode)) !== null) {
    const name = m[1] ?? m[2];
    if (name) fnNames.push(name);
  }

  const intent = fnNames.length > 0
    ? `This ${body.language} file defines ${fnNames.length} function(s): ${fnNames.slice(0, 4).join(", ")}. It appears to perform data processing or utility operations.`
    : `This ${body.language} file (${lines.length} lines) appears to be a script or module performing sequential operations.`;

  const deepAnalysis = `STEP 1 — Intent\n${intent}\n\nAssumptions: Analysis performed without a formal requirement specification. Purpose inferred from code structure.\n\nSTEP 2 — Static Analysis\n${body.staticFindings.length} static finding(s) detected by the pre-pass analyzer: ${critical} critical, ${warnings} warnings.\n${body.staticFindings.slice(0, 5).map((f) => `• L${f.line}: [${f.severity}] ${f.rule} — ${f.message}`).join("\n") || "No findings."}\n\nSTEP 3 — Logic Analysis\n${findings.bug_detection.length > 0 ? findings.bug_detection.map((b) => `• L${b.line_number}: ${b.issue} — ${b.explanation}`).join("\n") : "No logic bugs detected by heuristic rules."}\n\nSTEP 4 — Runtime Thinking\nHeuristic analysis does not perform full mental execution. Use the AI-powered review (configure OPENAI_API_KEY in Supabase secrets) for deep runtime analysis with concrete test cases.\n\nSTEP 5 — Security & Quality\n${findings.security_issues.length > 0 ? findings.security_issues.map((s) => `• L${s.line_number}: ${s.issue} — ${s.explanation}`).join("\n") : "No security issues detected by heuristic rules."}`;

  const executiveSummary = `This ${body.language} file "${body.fileName}" scored ${score}/100 (heuristic review — AI unavailable). ` +
    (critical > 0 ? `It contains ${critical} critical static issue(s). ` : "") +
    (findings.security_issues.length > 0 ? `${findings.security_issues.length} security concern(s) were identified. ` : "") +
    `Verdict: ${verdict} (confidence: ${confidence}%). Configure OPENAI_API_KEY for full 5-step AI analysis.`;

  const plainEnglish = `We analyzed your ${body.language} code using static rules and gave it ${score}/100. ` +
    (verdict === "INCORRECT"
      ? "The code has issues that could cause bugs or security problems — see the findings below."
      : "The code looks generally acceptable but may have room for improvement.") +
    " For a deeper AI-powered review with test cases and a suggested fix, set up the OpenAI API key.";

  // Basic test cases based on function signatures
  const testCases: TestCase[] = fnNames.slice(0, 3).map((name) => ({
    description: `Call ${name}() with typical input`,
    input: "(heuristic — actual inputs not computed)",
    expected: "(heuristic — expected output not computed)",
    actual: "(heuristic — actual output not computed)",
    passes: !hasCriticalBug,
  }));

  if (testCases.length === 0) {
    testCases.push({
      description: "Run the code with typical input",
      input: "(heuristic — no function signatures detected)",
      expected: "(heuristic — expected output not computed)",
      actual: "(heuristic — actual output not computed)",
      passes: !hasCriticalBug,
    });
  }

  const documentation = generateDocumentation(body);

  return {
    verdict,
    confidence,
    overall_score: score,
    intent,
    assumptions: "No formal requirement provided. Analysis is heuristic-based. OpenAI API key not configured — using static rules only.",
    executive_summary: executiveSummary,
    plain_english: plainEnglish,
    deep_analysis: deepAnalysis,
    documentation,
    suggested_fix: hasCriticalBug ? "(Configure OPENAI_API_KEY for AI-generated fix)" : body.sourceCode,
    test_cases: testCases,
    findings,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateDocumentation(body: RequestBody): string {
  const lines = body.sourceCode.split("\n");
  const isPy = body.language === "python";
  const functions: { name: string; line: number }[] = [];

  const fnRegex = isPy
    ? /def\s+([A-Za-z_]\w*)\s*\(/g
    : /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;
  let m: RegExpExecArray | null;
  while ((m = fnRegex.exec(body.sourceCode)) !== null) {
    const name = m[1] ?? m[2];
    const line = body.sourceCode.slice(0, m.index).split("\n").length;
    if (name) functions.push({ name, line });
  }

  let doc = `# Documentation — \`${body.fileName}\`\n\n`;
  doc += `**Language:** ${body.language}\n`;
  doc += `**Lines:** ${lines.length}\n`;
  doc += `**Functions:** ${functions.length}\n\n`;
  doc += `## Overview\n\nThis file contains ${functions.length} function(s) across ${lines.length} lines of ${body.language} code.\n\n`;
  if (functions.length > 0) {
    doc += `## Functions\n\n`;
    for (const f of functions) {
      doc += `### \`${f.name}()\`\n- **Defined at:** line ${f.line}\n\n`;
    }
  }
  return doc;
}

function normalizeResponse(parsed: Partial<AIResponse>, body: RequestBody): AIResponse {
  const findings: AIFindings = {
    bug_detection: [],
    security_issues: [],
    code_smells: [],
    performance_suggestions: [],
    naming_suggestions: [],
    best_practices: [],
    refactoring_suggestions: [],
  };
  const rawFindings = (parsed.findings ?? {}) as Record<string, AIFinding[]>;
  for (const cat of FINDING_CATEGORIES) {
    const list = rawFindings[cat];
    if (Array.isArray(list)) {
      findings[cat] = list.map((f) => ({
        issue: String(f.issue ?? ""),
        explanation: String(f.explanation ?? ""),
        suggested_fix: String(f.suggested_fix ?? ""),
        line_number: typeof f.line_number === "number" ? f.line_number : undefined,
      }));
    }
  }

  const testCases: TestCase[] = Array.isArray(parsed.test_cases)
    ? parsed.test_cases.map((tc) => ({
        description: String(tc.description ?? ""),
        input: String(tc.input ?? ""),
        expected: String(tc.expected ?? ""),
        actual: String(tc.actual ?? ""),
        passes: Boolean(tc.passes),
      }))
    : [];

  const verdict: "CORRECT" | "INCORRECT" =
    parsed.verdict === "CORRECT" ? "CORRECT" : "INCORRECT";

  return {
    verdict,
    confidence: typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : 50,
    overall_score: typeof parsed.overall_score === "number"
      ? Math.max(0, Math.min(100, Math.round(parsed.overall_score))) : 50,
    intent: String(parsed.intent ?? "Intent not determined."),
    assumptions: String(parsed.assumptions ?? "None stated."),
    executive_summary: String(parsed.executive_summary ?? "No summary available."),
    plain_english: String(parsed.plain_english ?? "No explanation available."),
    deep_analysis: String(parsed.deep_analysis ?? "No deep analysis available."),
    documentation: String(parsed.documentation ?? generateDocumentation(body)),
    suggested_fix: String(parsed.suggested_fix ?? body.sourceCode),
    test_cases: testCases,
    findings,
  };
}
