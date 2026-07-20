import type { Language, StaticFinding, Severity } from '@/types';

interface AnalysisOptions {
  language: Language;
  fileName: string;
  source: string;
}

interface AnalysisResult {
  findings: StaticFinding[];
  metrics: {
    lines: number;
    nonEmptyLines: number;
    commentLines: number;
    blankLines: number;
  };
}

const KEYWORDS_JS = new Set([
  'var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'class', 'extends', 'super',
  'this', 'new', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof',
  'in', 'of', 'delete', 'void', 'yield', 'await', 'async', 'import', 'export',
  'from', 'default', 'static', 'get', 'set', 'null', 'undefined', 'true', 'false',
]);

const KEYWORDS_PY = new Set([
  'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'break',
  'continue', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise',
  'with', 'yield', 'lambda', 'pass', 'global', 'nonlocal', 'assert', 'del',
  'in', 'is', 'not', 'and', 'or', 'None', 'True', 'False', 'self', 'async', 'await',
]);

function makeSeverity(weight: number): Severity {
  if (weight >= 8) return 'critical';
  if (weight >= 4) return 'warning';
  return 'info';
}

function detectLanguageFromCode(source: string): Language | null {
  const hasPyKeywords = /\b(def|elif|except|raise|yield|lambda|pass|self)\b/.test(source);
  const hasIndentBlocks = /^[ \t]+[^\s]/m.test(source) && !/{\s*$/.test(source);
  if (hasPyKeywords && hasIndentBlocks && !/=>|\bfunction\b|;\s*$/.test(source)) return 'python';
  if (/\binterface\b|\btype\b\s+[A-Z]\w*\s*=|:\s*(string|number|boolean|any|void)\b/.test(source)) return 'typescript';
  return 'javascript';
}

export function detectLanguage(fileName: string, source: string): Language {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, Language> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python',
  };
  if (map[ext]) return map[ext];
  return detectLanguageFromCode(source) ?? 'javascript';
}

// ---- JavaScript / TypeScript analyzer ----
function analyzeJsTs(source: string, language: Language): AnalysisResult {
  const findings: StaticFinding[] = [];
  const lines = source.split('\n');
  let commentLines = 0;
  let blankLines = 0;

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    const lineNum = idx + 1;
    if (line === '') { blankLines++; return; }
    if (/^\/\//.test(line) || /^\/\*/.test(line) || /^#/.test(line) || /^\*/.test(line)) {
      commentLines++;
    }

    // console.log left in code
    if (/\bconsole\.(log|debug|info)\b/.test(line)) {
      findings.push({
        rule: 'no-console', severity: 'warning', line: lineNum, column: line.indexOf('console') + 1,
        message: 'Unexpected console statement', category: 'best_practice',
      });
    }
    // debugger
    if (/\bdebugger\b/.test(line)) {
      findings.push({
        rule: 'no-debugger', severity: 'critical', line: lineNum, column: line.indexOf('debugger') + 1,
        message: 'Debugger statement found', category: 'bug',
      });
    }
    // var usage
    if (/\bvar\b/.test(line)) {
      findings.push({
        rule: 'no-var', severity: 'warning', line: lineNum, column: line.indexOf('var') + 1,
        message: "Use 'let' or 'const' instead of 'var'", category: 'best_practice',
      });
    }
    // == / != instead of === / !==
    const eqMatch = line.match(/[^=!]==[^=]|[^=]!=[^=]/);
    if (eqMatch) {
      findings.push({
        rule: 'eqeqeq', severity: 'warning', line: lineNum, column: eqMatch.index! + 2,
        message: "Expected '===' or '!=='", category: 'best_practice',
      });
    }
    // eval
    if (/\beval\s*\(/.test(line)) {
      findings.push({
        rule: 'no-eval', severity: 'critical', line: lineNum, column: line.indexOf('eval') + 1,
        message: 'eval is dangerous and can lead to code injection', category: 'security',
      });
    }
    // innerHTML assignment
    if (/\.innerHTML\s*=/.test(line)) {
      findings.push({
        rule: 'no-inner-html', severity: 'warning', line: lineNum, column: line.indexOf('innerHTML') + 1,
        message: 'Assigning to innerHTML can lead to XSS', category: 'security',
      });
    }
    // Missing semicolons (very rough) — only flag simple statements
    if (
      line.length > 3 &&
      !line.endsWith('{') && !line.endsWith('(') && !line.endsWith(',') &&
      !line.endsWith(';') && !line.endsWith(':') && !line.endsWith('=>') &&
      !line.endsWith('.') && !line.endsWith('=>') && !line.endsWith('&&') &&
      !line.endsWith('||') && !line.endsWith('|') && !line.endsWith('&') &&
      !/(if|else|for|while|switch|catch|try|finally|function|class|interface|type|import|export|case|default|do)\b/.test(line) &&
      !/^[\(\)\{\}\[\]"]/.test(line) &&
      /^(let|const|var|return|throw|import|export|[A-Za-z_$])/.test(line) &&
      !/^\s*[\/\*]/.test(line)
    ) {
      const last = line[line.length - 1];
      if (last !== '}' && last !== ')' && last !== '{') {
        findings.push({
          rule: 'semi', severity: 'info', line: lineNum, column: line.length,
          message: 'Missing semicolon', category: 'best_practice',
        });
      }
    }
    // Long lines
    if (rawLine.length > 120) {
      findings.push({
        rule: 'max-len', severity: 'info', line: lineNum, column: 121,
        message: `Line exceeds 120 characters (${rawLine.length})`, category: 'best_practice',
      });
    }
    // TODO/FIXME/HACK
    const todoMatch = line.match(/\b(TODO|FIXME|HACK|XXX)\b/);
    if (todoMatch) {
      findings.push({
        rule: 'no-todo', severity: 'info', line: lineNum, column: todoMatch.index! + 1,
        message: `${todoMatch[0]} comment left in code`, category: 'smell',
      });
    }
  });

  // Detect unused variables (simple heuristic: declarations never referenced afterwards)
  const declRegex = /\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = declRegex.exec(source)) !== null) {
    const name = m[1];
    const after = source.slice(m.index + m[0].length);
    const refRegex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    const refs = after.match(refRegex);
    if (!refs) {
      const lineNum = source.slice(0, m.index).split('\n').length;
      findings.push({
        rule: 'no-unused-vars', severity: 'warning', line: lineNum, column: m.index - source.lastIndexOf('\n', m.index),
        message: `'${name}' is declared but never used`, category: 'smell',
      });
    }
  }

  // Detect missing imports — usage of an identifier that's never declared/imported (very rough)
  const declared = new Set<string>();
  const declAll = /\b(?:let|const|var|function|class)\s+([A-Za-z_$][\w$]*)\b/g;
  while ((m = declAll.exec(source)) !== null) declared.add(m[1]);
  const importAll = /\bimport\s+(?:\{([^}]+)\}|([A-Za-z_$][\w$]*))\b/g;
  while ((m = importAll.exec(source)) !== null) {
    if (m[1]) m[1].split(',').forEach((s) => declared.add(s.trim()));
    if (m[2]) declared.add(m[2]);
  }
  const paramAll = /function\s*\w*\s*\(([^)]*)\)/g;
  while ((m = paramAll.exec(source)) !== null) {
    m[1].split(',').forEach((p) => {
      const pm = p.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (pm) declared.add(pm[1]);
    });
  }

  // TypeScript: any type
  if (language === 'typescript') {
    const anyRegex = /:\s*any\b/g;
    while ((m = anyRegex.exec(source)) !== null) {
      const lineNum = source.slice(0, m.index).split('\n').length;
      findings.push({
        rule: 'no-explicit-any', severity: 'warning', line: lineNum, column: m.index + 1,
        message: 'Unexpected any type — specify a type', category: 'best_practice',
      });
    }
  }

  return {
    findings,
    metrics: {
      lines: lines.length,
      nonEmptyLines: lines.filter((l) => l.trim() !== '').length,
      commentLines,
      blankLines,
    },
  };
}

// ---- Python analyzer ----
function analyzePython(source: string): AnalysisResult {
  const findings: StaticFinding[] = [];
  const lines = source.split('\n');
  let commentLines = 0;
  let blankLines = 0;

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    const lineNum = idx + 1;
    if (line === '') { blankLines++; return; }
    if (line.startsWith('#')) commentLines++;

    // bare except
    if (/^except\s*:/.test(line)) {
      findings.push({
        rule: 'bare-except', severity: 'warning', line: lineNum, column: 1,
        message: 'Bare except: catches all exceptions including system exits', category: 'best_practice',
      });
    }
    // eval / exec
    if (/\beval\s*\(|\bexec\s*\(/.test(line)) {
      findings.push({
        rule: 'no-eval', severity: 'critical', line: lineNum, column: line.search(/eval|exec/) + 1,
        message: 'Use of eval/exec is dangerous', category: 'security',
      });
    }
    // mutable default args
    if (/def\s+\w+\([^)]*=\s*(\[\]|\{\}|set\(\))/.test(line)) {
      findings.push({
        rule: 'mutable-default-arg', severity: 'warning', line: lineNum, column: 1,
        message: 'Mutable default argument will be shared across calls', category: 'bug',
      });
    }
    // print left in code
    if (/\bprint\s*\(/.test(line)) {
      findings.push({
        rule: 'no-print', severity: 'info', line: lineNum, column: line.indexOf('print') + 1,
        message: 'Print statement found — use logging in production', category: 'best_practice',
      });
    }
    // wildcard import
    if (/^from\s+\S+\s+import\s+\*/.test(line)) {
      findings.push({
        rule: 'no-wildcard-import', severity: 'warning', line: lineNum, column: 1,
        message: 'Wildcard import pollutes namespace', category: 'best_practice',
      });
    }
    // Long lines (PEP 8: 79)
    if (rawLine.length > 99) {
      findings.push({
        rule: 'line-too-long', severity: 'info', line: lineNum, column: 100,
        message: `Line too long (${rawLine.length} > 99)`, category: 'best_practice',
      });
    }
    // TODO/FIXME
    const todoMatch = line.match(/\b(TODO|FIXME|HACK|XXX)\b/);
    if (todoMatch) {
      findings.push({
        rule: 'no-todo', severity: 'info', line: lineNum, column: todoMatch.index! + 1,
        message: `${todoMatch[0]} comment left in code`, category: 'smell',
      });
    }
    // Tab indentation (mixing)
    if (/^\t+/.test(rawLine) && lines.some((l) => /^ +[^ ]/.test(l) && l.trim() !== '')) {
      findings.push({
        rule: 'mixed-indentation', severity: 'warning', line: lineNum, column: 1,
        message: 'Mixed tabs and spaces for indentation', category: 'best_practice',
      });
    }
    // == / != against None/True/False
    if (/(==|!=)\s*(None|True|False)/.test(line) || /(None|True|False)\s*(==|!=)/.test(line)) {
      findings.push({
        rule: 'eq-is', severity: 'warning', line: lineNum, column: 1,
        message: "Use 'is' or 'is not' to compare with None/True/False", category: 'best_practice',
      });
    }
  });

  // Detect unused imports (very rough)
  const importRegex = /^(?:from\s+\S+\s+import\s+(.+)|import\s+(.+))$/gm;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(source)) !== null) {
    const names = (m[1] ?? m[2])
      .split(',')
      .map((s) => s.trim().replace(/\s+as\s+.+$/, ''))
      .map((s) => s.replace(/^from\s+\S+\s+import\s+/, ''));
    for (const raw of names) {
      const name = raw.trim();
      if (!name) continue;
      const usageRegex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      const usages = source.match(usageRegex) ?? [];
      if (usages.length <= 1) {
        const lineNum = source.slice(0, m.index).split('\n').length;
        findings.push({
          rule: 'unused-import', severity: 'warning', line: lineNum, column: 1,
          message: `Imported name '${name}' is not used`, category: 'smell',
        });
      }
    }
  }

  return {
    findings,
    metrics: {
      lines: lines.length,
      nonEmptyLines: lines.filter((l) => l.trim() !== '').length,
      commentLines,
      blankLines,
    },
  };
}

export function analyzeCode({ language, fileName, source }: AnalysisOptions): AnalysisResult {
  const lang = language === 'python' ? 'python' : language === 'typescript' ? 'typescript' : 'javascript';
  void fileName;
  const result = lang === 'python' ? analyzePython(source) : analyzeJsTs(source, lang as 'javascript' | 'typescript');
  return result;
}

export { KEYWORDS_JS, KEYWORDS_PY };
