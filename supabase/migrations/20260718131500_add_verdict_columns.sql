/*
# Migration: Add 5-step AI pipeline columns to reviews

Adds the structured verdict fields produced by the upgraded AI reviewer:
- verdict       — CORRECT | INCORRECT
- confidence    — 0-100 integer
- intent        — inferred purpose of the code
- assumptions   — assumptions made during analysis
- deep_analysis — full STEP 1–5 narrative from the AI
- suggested_fix — corrected code provided by the AI
- test_cases    — JSON array of {description, input, expected, actual, passes}
*/

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verdict text NOT NULL DEFAULT 'INCORRECT';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS confidence int NOT NULL DEFAULT 50;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS intent text NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS assumptions text NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS deep_analysis text NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS suggested_fix text NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS test_cases jsonb NOT NULL DEFAULT '[]'::jsonb;
