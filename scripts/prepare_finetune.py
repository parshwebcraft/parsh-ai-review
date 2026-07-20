"""
prepare_finetune.py
====================
Converts code-review JSON examples (ERR-XXXXXX format) into the
OpenAI fine-tuning JSONL format so you can fine-tune gpt-4o-mini
(or gpt-3.5-turbo) on your own labelled bug dataset.

Usage:
    python scripts/prepare_finetune.py --input data/errors.jsonl --output data/finetune.jsonl

Requirements:
    pip install openai
"""

import json
import argparse
import sys
import os
import random

# ─── System prompt (same as Supabase edge function) ──────────────────────────

SYSTEM_PROMPT = """You are a senior software engineer and strict code reviewer.
Your job is to find problems in code, NOT to approve it.

Perform a complete analysis using these exact steps:

STEP 1 — Understand the Intent
STEP 2 — Static Analysis (syntax errors, undefined vars, wrong imports, type errors)
STEP 3 — Logic Analysis (correct output, off-by-one, edge cases, loop correctness)
STEP 4 — Runtime Thinking (normal inputs, empty, boundary, null/negative)
STEP 5 — Security & Quality (injection, XSS, secrets, swallowed exceptions, O(n²), memory leaks)

Decision Rules:
- NEVER say CORRECT just because the code is syntactically valid.
- If there is ANY logic bug, mark it INCORRECT.
- Be specific — reference exact line numbers.

Return ONLY a valid JSON object with this EXACT shape:
{
  "verdict": "CORRECT" | "INCORRECT",
  "confidence": <0-100>,
  "overall_score": <0-100>,
  "intent": "<1-2 sentences>",
  "assumptions": "<bullet-point assumptions>",
  "executive_summary": "<3-5 sentence technical summary>",
  "plain_english": "<3-5 sentence non-technical explanation>",
  "deep_analysis": "<Full STEP 1-5 narrative, min 200 words>",
  "documentation": "<Markdown docs with function signatures>",
  "suggested_fix": "<complete corrected code>",
  "test_cases": [
    {"description": "", "input": "", "expected": "", "actual": "", "passes": false}
  ],
  "findings": {
    "bug_detection": [{"issue":"","explanation":"","suggested_fix":"","line_number":0}],
    "security_issues": [{"issue":"","explanation":"","suggested_fix":"","line_number":0}],
    "code_smells": [],
    "performance_suggestions": [],
    "naming_suggestions": [],
    "best_practices": [],
    "refactoring_suggestions": []
  }
}"""

# ─── Category → findings key mapping ─────────────────────────────────────────

CATEGORY_TO_KEY = {
    "Null/None Reference":             "bug_detection",
    "Off-by-One Error":                "bug_detection",
    "Race Condition":                  "bug_detection",
    "Mutable Default Argument":        "bug_detection",
    "SQL Injection":                   "security_issues",
    "Cross-Site Scripting (XSS)":      "security_issues",
    "Hardcoded Credentials/Secrets":   "security_issues",
    "Bare Except / Swallowed Exception":"best_practices",
    "Unhandled Promise Rejection":     "best_practices",
    "Unclosed File Handle":            "best_practices",
    "Incorrect Type Conversion":       "bug_detection",
    "Inefficient Algorithm (O(n^2)+)": "performance_suggestions",
    "Unnecessary Object Creation in Loop": "performance_suggestions",
}

SEVERITY_SCORE = {
    "Critical": 0,
    "High":     20,
    "Medium":   50,
    "Low":      75,
}


def build_assistant_response(entry: dict) -> dict:
    """Convert one ERR entry into the AIResponse JSON the model should produce."""
    issues = entry.get("issues", [])
    language = entry.get("language", "unknown")
    code = entry.get("code", "")
    expected = entry.get("expected_behavior", "")

    # Determine verdict & score
    severities = [i.get("severity", "Low") for i in issues]
    has_critical = "Critical" in severities
    has_high = "High" in severities
    verdict = "INCORRECT" if issues else "CORRECT"

    base_score = 100
    for sev in severities:
        if sev == "Critical":   base_score -= 30
        elif sev == "High":     base_score -= 20
        elif sev == "Medium":   base_score -= 10
        elif sev == "Low":      base_score -= 5
    overall_score = max(5, base_score)
    confidence = 95 if (has_critical or has_high) else 80

    # Build findings dict
    findings = {
        "bug_detection": [],
        "security_issues": [],
        "code_smells": [],
        "performance_suggestions": [],
        "naming_suggestions": [],
        "best_practices": [],
        "refactoring_suggestions": [],
    }

    for issue in issues:
        key = CATEGORY_TO_KEY.get(issue.get("category", ""), "bug_detection")
        findings[key].append({
            "issue": issue.get("description", ""),
            "explanation": f"{issue.get('root_cause', '')} — Impact: {issue.get('impact', '')}",
            "suggested_fix": issue.get("fix", ""),
            "line_number": issue.get("line", 0),
        })

    # Build test cases from examples
    test_cases = []
    for issue in issues[:3]:
        example = issue.get("example", "")
        if example:
            test_cases.append({
                "description": f"Test for: {issue.get('category', 'issue')} ({issue.get('issue_id', '')})",
                "input": example.split("#")[0].strip(),
                "expected": expected[:120],
                "actual": f"Raises error or produces wrong result — {issue.get('impact', '')[:80]}",
                "passes": False,
            })

    if not test_cases:
        test_cases.append({
            "description": "Basic functionality test",
            "input": "(see code)",
            "expected": expected[:120],
            "actual": "Fails due to identified issues",
            "passes": False,
        })

    # Summaries
    issue_list = "\n".join(
        f"• [Line {i.get('line',0)}] [{i.get('severity')}] {i.get('category')}: {i.get('description','')[:80]}"
        for i in issues
    )
    executive_summary = (
        f"This {language} code has {len(issues)} identified issue(s). "
        f"{'Critical security vulnerabilities were found. ' if has_critical else ''}"
        f"{'High-severity bugs detected that cause runtime failures. ' if has_high else ''}"
        f"Verdict: {verdict} (confidence: {confidence}%).\n{issue_list}"
    )

    plain_english = (
        f"Your {language} code was reviewed and {len(issues)} problem(s) were found. "
        + (
            "These are serious issues that need to be fixed before going to production. "
            if has_critical or has_high
            else "These are moderate issues that should be addressed. "
        )
        + "See the findings and suggested fix below."
    )

    deep_analysis = f"""STEP 1 — Intent
{expected}

STEP 2 — Static Analysis
{len(issues)} issue(s) identified by analysis.

STEP 3 — Logic Analysis
""" + "\n".join(
        f"• Line {i.get('line', 0)}: {i.get('description', '')}"
        for i in issues
    ) + f"""

STEP 4 — Runtime Thinking
""" + "\n".join(
        f"• Example crash/failure: {i.get('example', '')}"
        for i in issues if i.get("example")
    ) + f"""

STEP 5 — Security & Quality
""" + "\n".join(
        f"• [{i.get('severity')}] {i.get('category')}: {i.get('impact', '')}"
        for i in issues
    )

    # Suggested fix: combine all fixes
    fixed_code = code
    fix_comments = "\n".join(
        f"# FIX [{i.get('issue_id')}] Line {i.get('line',0)}: {i.get('category')}\n{i.get('fix', '')}"
        for i in issues
    )

    return {
        "verdict": verdict,
        "confidence": confidence,
        "overall_score": overall_score,
        "intent": expected[:200],
        "assumptions": "Analysis based on provided code and issue labels.",
        "executive_summary": executive_summary,
        "plain_english": plain_english,
        "deep_analysis": deep_analysis,
        "documentation": f"# {entry.get('id', 'ERR')}\n\n**Language:** {language}\n\n**Issues:** {len(issues)}\n\n## Expected Behavior\n{expected}\n",
        "suggested_fix": fix_comments,
        "test_cases": test_cases,
        "findings": findings,
    }


def convert_entry_to_messages(entry: dict) -> dict:
    """Convert one ERR entry into an OpenAI fine-tuning messages object."""
    language = entry.get("language", "unknown")
    code = entry.get("code", "")
    expected = entry.get("expected_behavior", "")

    user_content = f"""File: review_{entry.get('id', 'unknown').lower()}.{('py' if language == 'Python' else 'js')}
Language: {language}

Expected behavior:
{expected}

Source code to review:
```{language.lower()}
{code}
```"""

    assistant_response = build_assistant_response(entry)

    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_content},
            {"role": "assistant", "content": json.dumps(assistant_response, ensure_ascii=False)},
        ]
    }


def load_entries(input_path: str) -> list:
    """Load entries from either a JSONL file or a JSON array file."""
    entries = []
    with open(input_path, "r", encoding="utf-8") as f:
        content = f.read().strip()

    # Try JSON array first
    try:
        data = json.loads(content)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    # Try JSONL (one JSON object per line)
    for line_num, line in enumerate(content.splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            entries.append(obj)
        except json.JSONDecodeError as e:
            print(f"⚠️  Skipping line {line_num}: {e}", file=sys.stderr)

    return entries


def main():
    parser = argparse.ArgumentParser(description="Convert code review dataset to OpenAI fine-tuning JSONL")
    parser.add_argument("--input",   required=True, help="Input file (.json array or .jsonl)")
    parser.add_argument("--output",  required=True, help="Output JSONL file for fine-tuning")
    parser.add_argument("--split",   action="store_true", help="Also create train/validation split (90/10)")
    parser.add_argument("--validate",action="store_true", help="Validate with OpenAI tokenizer estimate")
    args = parser.parse_args()

    print(f"[LOAD] Loading entries from: {args.input}")
    entries = load_entries(args.input)
    print(f"[OK]   Loaded {len(entries)} entries")

    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else ".", exist_ok=True)

    converted = []
    skipped = 0
    for entry in entries:
        if not entry.get("code") or not entry.get("issues"):
            skipped += 1
            continue
        try:
            msg = convert_entry_to_messages(entry)
            converted.append(msg)
        except Exception as e:
            print(f"[WARN] Skipping {entry.get('id', '?')}: {e}", file=sys.stderr)
            skipped += 1

    print(f"[OK]   Converted: {len(converted)} | Skipped: {skipped}")

    # Write main output
    with open(args.output, "w", encoding="utf-8") as f:
        for item in converted:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    print(f"[SAVE] Written to: {args.output}")

    # Train/validation split
    if args.split and len(converted) >= 10:
        random.shuffle(converted)
        split_idx = int(len(converted) * 0.9)
        train_data = converted[:split_idx]
        val_data   = converted[split_idx:]

        base = args.output.replace(".jsonl", "")
        train_path = f"{base}_train.jsonl"
        val_path   = f"{base}_val.jsonl"

        with open(train_path, "w", encoding="utf-8") as f:
            for item in train_data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

        with open(val_path, "w", encoding="utf-8") as f:
            for item in val_data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

        print(f"[TRAIN] Train: {len(train_data)} examples -> {train_path}")
        print(f"[VAL]   Val:   {len(val_data)} examples -> {val_path}")
    elif args.split:
        print("[INFO]  Split skipped (need at least 10 examples)")

    # Token estimate
    if args.validate:
        total_chars = sum(len(json.dumps(item)) for item in converted)
        estimated_tokens = total_chars // 4
        estimated_cost_usd = (estimated_tokens / 1_000_000) * 25
        print(f"\n[STATS] Token Estimate:")
        print(f"        Characters  : {total_chars:,}")
        print(f"        ~Tokens     : {estimated_tokens:,}")
        print(f"        ~Cost (1 epoch, gpt-4o-mini): ${estimated_cost_usd:.4f}")

    print("\n[NEXT] Next Steps:")
    print("       1. pip install openai")
    print("       2. openai api fine_tuning.jobs.create --training-file scripts/data/finetune.jsonl --model gpt-4o-mini")
    print("       3. Wait for job (~15-30 min for small datasets)")
    print("       4. Copy model ID: ft:gpt-4o-mini:your-org::XXXXXXXX")
    print("       5. Set FINE_TUNED_MODEL env in Supabase secrets")


if __name__ == "__main__":
    main()
