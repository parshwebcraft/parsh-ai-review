import type { Language, ComplexityMetrics } from '@/types';

function countFunctions(source: string, language: Language): { count: number; perFunction: { name: string; complexity: number; lines: number }[] } {
  const perFunction: { name: string; complexity: number; lines: number }[] = [];

  if (language === 'python') {
    const regex = /def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?:/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(source)) !== null) {
      const startLine = source.slice(0, m.index).split('\n').length;
      const name = m[1];
      const body = extractPythonBlock(source, m.index);
      const complexity = computeCyclomaticComplexity(body, language);
      perFunction.push({ name, complexity, lines: body.split('\n').length });
    }
  } else {
    const regex = /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|(?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*{)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(source)) !== null) {
      const name = m[1] ?? m[2] ?? m[3] ?? 'anonymous';
      const body = extractJsBlock(source, m.index);
      const complexity = computeCyclomaticComplexity(body, language);
      perFunction.push({ name, complexity, lines: body.split('\n').length });
    }
  }

  return { count: perFunction.length, perFunction };
}

function extractPythonBlock(source: string, defIndex: number): string {
  const lines = source.slice(defIndex).split('\n');
  if (lines.length === 0) return '';
  const defLine = lines[0];
  const indentMatch = defLine.match(/^(\s*)/);
  const baseIndent = indentMatch ? indentMatch[1].length : 0;
  const bodyLines: string[] = [defLine];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') { bodyLines.push(line); continue; }
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= baseIndent && line.trim() !== '') break;
    bodyLines.push(line);
  }
  return bodyLines.join('\n');
}

function extractJsBlock(source: string, startIndex: number): string {
  let i = source.indexOf('{', startIndex);
  if (i === -1) return '';
  let depth = 0;
  const start = i;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

function computeCyclomaticComplexity(source: string, language: Language): number {
  let complexity = 1;
  const patterns = language === 'python'
    ? /\b(if|elif|for|while|except|and|or|with)\b/g
    : /\b(if|else if|for|while|case|catch|&&|\|\|)\b/g;
  const matches = source.match(patterns);
  if (matches) complexity += matches.length;
  // Ternary
  const ternaries = source.match(/\?[^:]*:/g);
  if (ternaries) complexity += ternaries.length;
  return complexity;
}

function countClasses(source: string, language: Language): number {
  if (language === 'python') {
    const m = source.match(/^\s*class\s+[A-Za-z_]\w*/gm);
    return m ? m.length : 0;
  }
  const m = source.match(/\bclass\s+[A-Za-z_$][\w$]*/g);
  return m ? m.length : 0;
}

function computeMaintainabilityIndex(lines: number, cyclomatic: number, nonEmpty: number): number {
  // Simplified MI: 0-100, higher = more maintainable
  if (lines === 0) return 100;
  const avgComplexity = cyclomatic / Math.max(1, nonEmpty / 50);
  const volumeFactor = Math.min(1, 100 / Math.max(20, lines));
  const mi = 171 - 5.2 * Math.log(Math.max(1, avgComplexity)) - 0.23 * avgComplexity - 16.2 * Math.log(Math.max(1, lines));
  const normalized = Math.max(0, Math.min(100, mi));
  return Math.round(normalized);
}

export function computeComplexity(source: string, language: Language): ComplexityMetrics {
  const lines = source.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim() !== '').length;
  const { count: numberOfFunctions, perFunction } = countFunctions(source, language);
  const numberOfClasses = countClasses(source, language);
  const cyclomaticComplexity = Math.max(1, computeCyclomaticComplexity(source, language));
  const avgFunctionComplexity = perFunction.length > 0
    ? Math.round(perFunction.reduce((a, b) => a + b.complexity, 0) / perFunction.length)
    : cyclomaticComplexity;
  const fileComplexity = cyclomaticComplexity + perFunction.reduce((a, b) => a + b.complexity, 0);
  const maintainabilityIndex = computeMaintainabilityIndex(nonEmptyLines, cyclomaticComplexity, nonEmptyLines);

  return {
    cyclomatic_complexity: cyclomaticComplexity,
    function_complexity: avgFunctionComplexity,
    file_complexity: fileComplexity,
    number_of_functions: numberOfFunctions,
    number_of_classes: numberOfClasses,
    lines_of_code: nonEmptyLines,
    maintainability_index: maintainabilityIndex,
    per_function: perFunction.slice(0, 20),
  };
}

export function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
}
