# CodeLens — AI Code Review Assistant

A production-ready full-stack SaaS application that performs AI-powered code review. Submit code via a Monaco editor or file upload, and get instant static analysis, AI review (OpenAI), and complexity metrics with beautiful visualizations.

## Features

- **Authentication** — email/password sign up, sign in, logout, forgot & reset password (Supabase Auth)
- **Dashboard** — stats, recent reviews, quality health gauge
- **Projects** — organize reviews under projects (create, delete)
- **New Review** — paste code into a Monaco editor OR upload `.js/.jsx/.ts/.tsx/.py` files with auto language detection
- **Static Analysis** — custom analyzers for JavaScript, TypeScript, and Python detecting syntax issues, unused vars, missing imports, style violations, security warnings, and more
- **AI Review** — OpenAI-powered detection of bugs, security issues, code smells, performance, naming, best practices, and refactoring suggestions, with executive summary, plain-English explanation, and generated documentation
- **Complexity Analysis** — cyclomatic complexity, function/file complexity, maintainability index, per-function charts (Recharts)
- **Review Detail Page** — overall score gauge, summary, critical/warning/info findings, AI findings by category, static findings, complexity charts, generated docs, syntax-highlighted code with line jumping
- **Review History** — search, filter by language/severity, sort, pagination, delete
- **Analytics** — 14-day trend, language breakdown, score distribution, reviews-per-project
- **Profile & Settings** — update name/avatar, dark/light mode toggle, notifications, sign out
- **Premium UI** — glassmorphism, gradients, Framer Motion animations, loading skeletons, toast notifications, responsive sidebar + navbar, beautiful empty states

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui, React Query, React Hook Form, Zod, Monaco Editor, Framer Motion, Recharts, Lucide icons
- **Backend:** Next.js Route Handlers + Supabase (PostgreSQL, Auth, Row Level Security)
- **AI:** OpenAI API via a Supabase Edge Function (with a deterministic heuristic fallback when no API key is configured)
- **Database:** PostgreSQL (Supabase)

## Architecture

```
app/
  (auth)/            — login, signup, forgot/reset password (route group)
  dashboard/         — protected app shell
    analytics/       — Recharts dashboards
    history/         — searchable review history
    projects/        — project CRUD
    reviews/
      new/           — Monaco editor + file upload
      [id]/          — full review report
    profile/         — profile editor
    settings/        — preferences + theme
  page.tsx           — landing page
components/
  dashboard/         — sidebar, navbar, code editor, file upload, score gauge, finding card
  ui/                — shadcn/ui primitives
contexts/
  auth-context.tsx   — Supabase auth provider
  theme-context.tsx  — dark/light theme
  query-provider.tsx — React Query provider
hooks/
  use-review-runner.ts — orchestrates static + complexity + AI + persistence
  use-toast.ts
lib/
  supabase.ts        — Supabase client
  analyzer.ts        — JS/TS/Python static analysis engine
  complexity.ts      — cyclomatic + maintainability engine
  ai-review.ts       — edge function client
  services.ts        — data-access layer (projects, reviews, findings, stats)
  validations.ts     — Zod schemas
  constants.ts       — languages, file limits, page size
types/
  index.ts           — shared TypeScript types
supabase/
  functions/
    ai-review/       — OpenAI edge function (Deno)
```

### Database Schema

| Table | Purpose |
| --- | --- |
| `profiles` | Extends `auth.users` with name + avatar (auto-created via trigger on signup) |
| `projects` | User-owned project groupings |
| `reviews` | One row per code review, with score, summary, complexity (JSONB), static findings (JSONB), AI findings (JSONB), documentation |
| `review_findings` | Individual findings (critical/warning/info) linked to a review |

All tables have Row Level Security enabled with owner-scoped policies (`auth.uid() = user_id`). Child tables (`review_findings`) scope through the parent review via an `EXISTS` subquery.

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (URL + anon key are pre-populated in `.env`)
- (Optional) An OpenAI API key for real AI reviews — without one, the app uses a built-in heuristic analyzer so reviews still work

### Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll see the landing page. Sign up to access the dashboard.

### Production Build

```bash
npm run build
npm start
```

## Environment Variables

All Supabase variables are pre-populated. Only add an OpenAI key if you want real AI-powered reviews (otherwise a heuristic fallback is used):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=        # optional — enables real GPT-4o-mini reviews via the edge function
```

## How a Review Works

1. User selects a project and pastes code or uploads files on the **New Review** page.
2. The client runs a **static analyzer** (`lib/analyzer.ts`) tuned for the detected language, producing structured findings.
3. The client computes **complexity metrics** (`lib/complexity.ts`) — cyclomatic complexity, function count, maintainability index, etc.
4. The client calls the **AI review edge function** (`/functions/v1/ai-review`) with the source, language, and static findings. The function calls OpenAI (or falls back to a heuristic) and returns a structured JSON report with score, executive summary, plain-English explanation, documentation, and categorized findings.
5. The review is **persisted** to `reviews` + `review_findings` (Supabase with RLS), then the user is redirected to the review report.

## Deployment

### Frontend (Vercel)

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add the environment variables from `.env` (Supabase URL + anon key are required; `OPENAI_API_KEY` is optional).
4. Deploy — Vercel auto-detects Next.js.

### Edge Function (Supabase)

The `ai-review` edge function is already deployed to this project's Supabase instance. To set the OpenAI key for real AI reviews, add `OPENAI_API_KEY` as an edge function secret in the Supabase dashboard (Supabase → Edge Functions → Secrets).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## License

MIT — built as a demonstration of a modern AI-powered SaaS code review tool.
