'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Code2, Zap, ShieldCheck, GitCompare, BarChart3, FileSearch,
  ArrowRight, Check, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const FEATURES = [
  { icon: Zap, title: 'Static analysis', text: 'Instant detection of syntax errors, unused vars, missing imports, and style violations for JS, TS, and Python.' },
  { icon: ShieldCheck, title: 'AI security review', text: 'GPT-powered detection of bugs, security issues, code smells, and best-practice violations.' },
  { icon: BarChart3, title: 'Complexity metrics', text: 'Cyclomatic complexity, maintainability index, and per-function charts powered by Recharts.' },
  { icon: FileSearch, title: 'Monaco editor', text: 'Paste code into a full Monaco editor or upload .js/.ts/.py files with auto language detection.' },
  { icon: GitCompare, title: 'Review history', text: 'Every review is saved with searchable, filterable history and detailed findings.' },
  { icon: Code2, title: 'Generated docs', text: 'Auto-generated markdown documentation and plain-English explanations for any file.' },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.15]" />
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-primary/10 blur-[120px]" />

      {/* Nav */}
      <header className="relative z-10 flex h-16 items-center justify-between px-6 lg:px-10 border-b border-border/40 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30">
            <Code2 className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">CodeLens</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link href="/signup">
            <Button size="sm" className="h-9">Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 backdrop-blur px-3 py-1 mb-6"
        >
          <Star className="h-3.5 w-3.5 text-warning fill-warning" />
          <span className="text-xs font-medium">AI-powered code review for modern teams</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance leading-[1.05]"
        >
          Review code
          <br />
          <span className="gradient-text">the way AI does.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance leading-relaxed"
        >
          Paste your code or upload files. Get instant static analysis, AI-powered security review, and complexity metrics — with actionable fixes and generated documentation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link href="/signup">
            <Button size="lg" className="h-12 px-8 group">
              Start reviewing free
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="h-12 px-8">Sign in</Button>
          </Link>
        </motion.div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> No credit card</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> JS · TS · Python</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Unlimited reviews</span>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card className="h-full p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all group">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="h-5.5 w-5.5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <Card className="relative overflow-hidden p-10 text-center gradient-border">
            <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
                Ship cleaner code today.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Join developers using CodeLens to catch issues before they reach production.
              </p>
              <Link href="/signup" className="inline-block mt-6">
                <Button size="lg" className="h-12 px-8 group">
                  Create your free account
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        CodeLens — AI Code Review Assistant. Built with Next.js, Supabase, and OpenAI.
      </footer>
    </div>
  );
}
