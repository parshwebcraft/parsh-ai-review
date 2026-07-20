'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File as FileIcon, X, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LANGUAGE_MAP, MAX_FILE_SIZE, MAX_FILES } from '@/lib/constants';
import type { Language } from '@/types';

interface UploadedFile {
  name: string;
  content: string;
  language: Language;
  size: number;
}

interface FileUploadProps {
  onFilesLoaded: (files: UploadedFile[]) => void;
  currentFiles: UploadedFile[];
  onRemoveFile: (index: number) => void;
}

export function FileUpload({ onFilesLoaded, currentFiles, onRemoveFile }: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setError(null);
    if (accepted.length === 0) return;

    Promise.all(
      accepted.map(async (file) => {
        const text = await file.text();
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const language = LANGUAGE_MAP[ext] ?? 'javascript';
        return {
          name: file.name,
          content: text,
          language,
          size: file.size,
        } as UploadedFile;
      })
    ).then((files) => onFilesLoaded(files)).catch(() => setError('Failed to read files'));
  }, [onFilesLoaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    accept: {
      'text/javascript': ['.js', '.jsx', '.mjs', '.cjs'],
      'text/typescript': ['.ts', '.tsx'],
      'text/x-python': ['.py'],
      'text/plain': ['.js', '.ts', '.py', '.jsx', '.tsx'],
    },
    onDropRejected: (rejections) => {
      const r = rejections[0];
      if (r?.errors[0]?.code === 'file-too-large') {
        setError(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      } else if (r?.errors[0]?.code === 'too-many-files') {
        setError(`Max ${MAX_FILES} files at a time`);
      } else {
        setError('Only .js, .ts, .jsx, .tsx, .py files are accepted');
      }
    },
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/5'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-full transition-colors',
            isDragActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              .js, .jsx, .ts, .tsx, .py · up to {MAX_FILES} files · {MAX_FILE_SIZE / 1024 / 1024}MB each
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {currentFiles.length > 0 && (
        <div className="space-y-2">
          {currentFiles.map((f, i) => (
            <div key={`${f.name}-${i}`} className="group flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileCode className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.language} · {(f.size / 1024).toFixed(1)} KB · {f.content.split('\n').length} lines
                </p>
              </div>
              <FileIcon className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => onRemoveFile(i)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
