/*
# AI Code Review Assistant — Core Schema

## Purpose
Multi-user SaaS app: authenticated users create projects, submit code (via Monaco
editor paste or file upload), receive static analysis + AI review + complexity
metrics, and browse a searchable history of past reviews.

## New Tables

### profiles
- `id` (uuid, PK, matches auth.users.id) — one row per auth user.
- `name` (text) — display name.
- `avatar_url` (text) — optional avatar.
- `updated_at` (timestamptz) — last profile update.

### projects
- `id` (uuid, PK)
- `user_id` (uuid, FK auth.users, DEFAULT auth.uid()) — owner.
- `name` (text) — project name.
- `description` (text) — optional description.
- `language` (text) — primary language (javascript|typescript|python).
- `created_at` (timestamptz)

### reviews
- `id` (uuid, PK)
- `project_id` (uuid, FK projects, ON DELETE CASCADE)
- `user_id` (uuid, FK auth.users, DEFAULT auth.uid()) — owner (denormalized for direct ownership checks).
- `review_type` (text) — 'monaco' | 'upload'
- `language` (text) — detected/submitted language
- `file_name` (text) — primary file name
- `source_code` (text) — reviewed source
- `overall_score` (int) — 0..100
- `summary` (text) — AI executive summary
- `plain_english` (text) — plain-English explanation
- `documentation` (text) — generated docs
- `complexity` (jsonb) — complexity metrics
- `static_findings` (jsonb) — static analyzer results
- `ai_findings` (jsonb) — AI findings grouped by category
- `status` (text) — 'completed' | 'failed'
- `created_at` (timestamptz)

### review_findings
- `id` (uuid, PK)
- `review_id` (uuid, FK reviews, ON DELETE CASCADE)
- `severity` (text) — critical|warning|info
- `category` (text) — bug|security|smell|performance|naming|best_practice|refactor|static
- `issue` (text)
- `explanation` (text)
- `suggested_fix` (text)
- `file_name` (text)
- `line_number` (int)

## Security
- RLS enabled on all tables.
- profiles: owner read/update only.
- projects, reviews: full owner CRUD scoped by user_id.
- review_findings: scoped through parent review ownership via EXISTS subquery.
*/

-- Profiles: extends auth.users with app-specific fields
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  language text NOT NULL DEFAULT 'javascript',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_own" ON projects;
CREATE POLICY "projects_select_own" ON projects FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_insert_own" ON projects;
CREATE POLICY "projects_insert_own" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_update_own" ON projects;
CREATE POLICY "projects_update_own" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_delete_own" ON projects;
CREATE POLICY "projects_delete_own" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  review_type text NOT NULL DEFAULT 'monaco',
  language text NOT NULL DEFAULT 'javascript',
  file_name text NOT NULL DEFAULT 'untitled',
  source_code text NOT NULL DEFAULT '',
  overall_score int NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  plain_english text NOT NULL DEFAULT '',
  documentation text NOT NULL DEFAULT '',
  complexity jsonb NOT NULL DEFAULT '{}'::jsonb,
  static_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_own" ON reviews;
CREATE POLICY "reviews_select_own" ON reviews FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
CREATE POLICY "reviews_update_own" ON reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_delete_own" ON reviews;
CREATE POLICY "reviews_delete_own" ON reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Review findings (child of reviews)
CREATE TABLE IF NOT EXISTS review_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'static',
  issue text NOT NULL DEFAULT '',
  explanation text NOT NULL DEFAULT '',
  suggested_fix text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  line_number int NOT NULL DEFAULT 0
);

ALTER TABLE review_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "findings_select_own" ON review_findings;
CREATE POLICY "findings_select_own" ON review_findings FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_findings.review_id AND reviews.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "findings_insert_own" ON review_findings;
CREATE POLICY "findings_insert_own" ON review_findings FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_findings.review_id AND reviews.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "findings_delete_own" ON review_findings;
CREATE POLICY "findings_delete_own" ON review_findings FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_findings.review_id AND reviews.user_id = auth.uid())
  );

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_project_id ON reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_review_id ON review_findings(review_id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-update profiles.updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
