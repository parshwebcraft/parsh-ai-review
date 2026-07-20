'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Code2, Upload, Loader2, Play, FileCode, CheckCircle2, AlertCircle, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchProjects, getOrCreateDefaultProject } from '@/lib/services';
import { useReviewRunner } from '@/hooks/use-review-runner';
import { LANGUAGES } from '@/lib/constants';
import type { Language, ReviewType, Project } from '@/types';
import { CodeEditor } from '@/components/dashboard/code-editor';
import { FileUpload } from '@/components/dashboard/file-upload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

const SAMPLE_CODE = `// Try reviewing this code
function processUsers(users) {
  var result = [];
  for (var i = 0; i < users.length; i++) {
    if (users[i].age >= 18) {
      var name = users[i].name;
      result.push({
        name: name,
        greeting: "Hello " + name,
        data: eval(users[i].data)
      });
    }
  }
  return result;
}

export default processUsers;`;

interface UploadedFile {
  name: string;
  content: string;
  language: Language;
  size: number;
}

function NewReviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { run, running, progress, error } = useReviewRunner();

  const [tab, setTab] = useState<'monaco' | 'upload'>('monaco');
  const [code, setCode] = useState(SAMPLE_CODE);
  const [fileName, setFileName] = useState('example.js');
  const [language, setLanguage] = useState<Language | 'auto'>('auto');
  const [projectId, setProjectId] = useState<string>('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [successOpen, setSuccessOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
  const projectList: Project[] = (projects as Project[] | undefined) ?? [];

  useEffect(() => {
    const preset = params.get('project');
    if (preset) {
      setProjectId(preset);
    } else if (projectList.length > 0 && !projectId) {
      setProjectId(projectList[0].id);
    }
  }, [params, projectList, projectId]);

  const onFilesLoaded = (newFiles: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    if (newFiles.length > 0) {
      setSelectedFileIdx(files.length);
      setFileName(newFiles[0].name);
    }
  };

  const onRemoveFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setSelectedFileIdx(0);
  };

  const handleRun = async () => {
    // If no project is selected yet, auto-create/use a default one so Run Review
    // works immediately without blocking the user.
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      try {
        const defaultProject = await getOrCreateDefaultProject();
        resolvedProjectId = defaultProject.id;
        setProjectId(defaultProject.id);
      } catch (e) {
        toast.error('Could not create a default project. Please sign in and try again.');
        return;
      }
    }

    if (tab === 'monaco' && !code.trim()) {
      toast.error('Add some code to review');
      return;
    }
    if (tab === 'upload' && files.length === 0) {
      toast.error('Upload at least one file');
      return;
    }

    try {
      if (tab === 'upload') {
        const file = files[selectedFileIdx] ?? files[0];
        const result = await run({
          projectId: resolvedProjectId,
          reviewType: 'upload',
          language: file.language,
          fileName: file.name,
          sourceCode: file.content,
        });
        setCreatedId(result.review.id);
        setSuccessOpen(true);
        if (result.usedFallback) {
          toast.warning('AI service unavailable — used static-only review');
        } else {
          toast.success('Review complete!');
        }
      } else {
        const result = await run({
          projectId: resolvedProjectId,
          reviewType: 'monaco',
          language,
          fileName: fileName || 'untitled.js',
          sourceCode: code,
        });
        setCreatedId(result.review.id);
        setSuccessOpen(true);
        if (result.usedFallback) {
          toast.warning('AI service unavailable — used static-only review');
        } else {
          toast.success('Review complete!');
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Review failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Review</h1>
          <p className="mt-1 text-sm text-muted-foreground">Paste code or upload files for instant AI analysis.</p>
        </div>
        <Button onClick={handleRun} disabled={running} size="lg" className="group">
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Analyzing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1.5" /> Run Review
              <Sparkles className="ml-1.5 h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>

      {running && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">{progress || 'Working...'}</p>
                  <p className="text-xs text-muted-foreground">This usually takes 5-15 seconds.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {error && !running && (
        <Card className="bg-destructive/5 border-destructive/30">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Review failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Config */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>Where to save this review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder={projectsLoading ? 'Loading...' : 'Select project'} />
                </SelectTrigger>
                <SelectContent>
                  {projectList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projectList.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  <a href="/dashboard/projects" className="text-primary hover:underline">Create a project</a> first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language | 'auto')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tab === 'monaco' && (
              <div className="space-y-2">
                <Label>File name</Label>
                <input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="example.js"
                />
              </div>
            )}

            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
              Reviews are saved to your project and can be found in History.
            </div>
          </CardContent>
        </Card>

        {/* Submission */}
        <Card>
          <CardContent className="p-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'monaco' | 'upload')}>
              <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="monaco"><Code2 className="h-3.5 w-3.5 mr-1.5" /> Editor</TabsTrigger>
                <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-1.5" /> Upload</TabsTrigger>
              </TabsList>

              <TabsContent value="monaco" className="mt-4">
                <CodeEditor value={code} onChange={setCode} language={language === 'auto' ? 'javascript' : language} height={480} />
              </TabsContent>

              <TabsContent value="upload" className="mt-4">
                <FileUpload onFilesLoaded={onFilesLoaded} currentFiles={files} onRemoveFile={onRemoveFile} />
                {files.length > 0 && (
                  <div className="mt-4">
                    <Label className="mb-2 block">Select file to review</Label>
                    <div className="flex flex-wrap gap-2">
                      {files.map((f, i) => (
                        <button
                          key={`${f.name}-${i}`}
                          onClick={() => setSelectedFileIdx(i)}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                            selectedFileIdx === i ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent/10'
                          }`}
                        >
                          <FileCode className="h-3 w-3" /> {f.name}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4">
                      <CodeEditor
                        value={files[selectedFileIdx]?.content ?? ''}
                        onChange={(v) => {
                          setFiles((prev) => prev.map((f, i) => i === selectedFileIdx ? { ...f, content: v } : f));
                        }}
                        language={files[selectedFileIdx]?.language ?? 'javascript'}
                        height={360}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={successOpen} onOpenChange={(o) => {
        setSuccessOpen(o);
        if (!o && createdId) router.push(`/dashboard/reviews/${createdId}`);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogTitle className="text-center">Review complete</DialogTitle>
            <DialogDescription className="text-center">
              Your code has been analyzed. View the full report with findings, complexity, and AI insights.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => createdId && router.push(`/dashboard/reviews/${createdId}`)} className="w-full">
            View review report
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NewReviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <NewReviewContent />
    </Suspense>
  );
}
