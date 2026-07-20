'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Code2, ShieldCheck, Zap, GitCompare } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-2">
      {/* Form side */}
      <div className="relative flex min-h-screen flex-col">
        <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.12]" />
        <header className="relative z-10 flex h-16 items-center px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30">
              <Code2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-semibold tracking-tight">CodeLens</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">AI Review</span>
            </div>
          </Link>
        </header>
        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full max-w-sm"
          >
            {children}
          </motion.div>
        </div>
      </div>

      {/* Hero side */}
      <div className="relative hidden lg:flex flex-col justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-background border-l border-border/60">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-pulse-glow" />
        <div className="relative z-10 max-w-md px-12 xl:px-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl xl:text-5xl font-bold tracking-tight text-balance leading-tight"
          >
            Catch bugs before
            <span className="gradient-text"> they ship.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-5 text-muted-foreground text-lg leading-relaxed"
          >
            Paste your code or upload files. Get instant static analysis, AI-powered review, and complexity metrics in seconds.
          </motion.p>
          <div className="mt-10 space-y-4">
            {[
              { icon: Zap, title: 'Instant analysis', text: 'Static + AI review in under 10 seconds.' },
              { icon: ShieldCheck, title: 'Security-first', text: 'Catch vulnerabilities, smells, and bad patterns.' },
              { icon: GitCompare, title: 'Track history', text: 'Every review is saved, searchable, and filterable.' },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/80 backdrop-blur border border-border/60">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
