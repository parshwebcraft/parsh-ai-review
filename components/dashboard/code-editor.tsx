'use client';

import { useRef, useEffect } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { Language } from '@/types';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: Language;
  height?: string | number;
  readOnly?: boolean;
  onLineClick?: (line: number) => void;
  highlightLines?: number[];
}

const MONACO_LANG: Record<Language, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
};

export function CodeEditor({
  value, onChange, language = 'javascript', height = 460, readOnly, onLineClick, highlightLines = [],
}: CodeEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const decorationsRef = useRef<string[] | undefined>(undefined);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('codelens-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'string', foreground: 'a3e635' },
        { token: 'keyword', foreground: '60a5fa' },
        { token: 'number', foreground: 'fbbf24' },
      ],
      colors: {
        'editor.background': '#00000000',
        'editor.lineHighlightBackground': '#ffffff08',
        'editorLineNumber.foreground': '#6b7280',
        'editorLineNumber.activeForeground': '#e5e7eb',
        'editor.selectionBackground': '#3b82f680',
      },
    });
    monaco.editor.defineTheme('codelens-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editor.lineHighlightBackground': '#0000000a',
      },
    });
    const isDark = document.documentElement.classList.contains('dark');
    monaco.editor.setTheme(isDark ? 'codelens-dark' : 'codelens-light');

    if (onLineClick) {
      editor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBER) {
          const line = e.target.position?.lineNumber;
          if (line) onLineClick(line);
        }
      });
    }
  };

  const handleBeforeMount: BeforeMount = () => {};

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      editorRef.current?.updateOptions({ theme: isDark ? 'codelens-dark' : 'codelens-light' });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current ?? [],
      highlightLines.map((line) => ({
        range: { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: 1 },
        options: {
          isWholeLine: true,
          className: 'bg-warning/20',
          glyphMarginClassName: 'ml-2',
        },
      }))
    );
  }, [highlightLines]);

  return (
    <div className="monaco-container rounded-lg overflow-hidden border border-border/60 bg-card/40">
      <Editor
        height={height}
        language={MONACO_LANG[language]}
        value={value}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        beforeMount={handleBeforeMount}
        theme="codelens-dark"
        options={{
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          lineNumbers: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 14, bottom: 14 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          tabSize: 2,
          readOnly,
          automaticLayout: true,
          glyphMargin: true,
          renderLineHighlight: 'all',
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
      />
    </div>
  );
}
