---
name: qgisia-orchestrator
description: Use at the start of any QGISIA+ task to route to the right specialist skill — when building a feature, fixing a bug, working on the React dashboard, integrating a Kimi/Devin delivery, exploring the codebase, searching AI models, or finishing a branch.
---

# QGISIA+ Orchestrator

## Overview

QGISIA+ = QGIS plugin (Python/PyQt) + React/Vite frontend + NVIDIA NIM/LiteLLM gateway + geospatial AI (SAM, DeepForest, spectral indices). This skill is a **router**: it maps the situation you're in to the best available skill or MCP, so you don't reinvent the workflow each time.

**Core principle:** Pick the workflow skill BEFORE writing code. Process skills first (brainstorming, debugging), implementation skills second.

## Routing Table

| Situation / Trigger | Invoke |
|---|---|
| New feature, big idea, "let's build X", vague request | `superpowers:brainstorming` → then `superpowers:writing-plans` |
| Implementing a planned/clear feature or bugfix | `superpowers:test-driven-development` |
| Several independent tasks, want parallelism | `superpowers:subagent-driven-development` + `superpowers:using-git-worktrees` |
| Bug, failing test, flaky/weird behavior, "why does X happen" | `superpowers:systematic-debugging` |
| React dashboard / UI / component / styling work | `frontend-design`, then `ui-ux-pro-max:design-system` / `ui-ux-pro-max:ui-styling` |
| Accessibility check on rendered HTML | `accesslint:audit` |
| Before saying "done" / "it works" | `superpowers:verification-before-completion` |
| Merging/closing a feature branch | `superpowers:finishing-a-development-branch` |
| Want a review of changes | `superpowers:requesting-code-review` |
| "Where is X / who calls Y" in the codebase | `Explore` agent or `claude-mem:smart-explore` / `pathfinder` |
| "How did we do/decide X before" | `claude-mem:mem-search` |
| Find/compare an AI model (SAM, Prithvi, DeepForest, Grounding DINO) | Hugging Face MCP (`hub_repo_search`, `paper_search`) |
| Creating/editing a skill | `superpowers:writing-skills` |

## Kimi / Devin Delivery Integration (project-specific)

When code arrives from Kimi or Devin, NEVER merge blind. Follow this exact gate:

1. `python -m pytest tests/ -q` — full suite must stay green
2. If a delivery **rewrote an existing tested module**, diff it against the prior commit. Treat lost pure functions, removed `argv`/dry-run testability, or `sys.exit()` in importable code as a **regression** — revert that file, don't delete its tests.
3. Watch for `test_*`-prefixed functions in non-test modules — pytest will collect them by mistake.
4. Stage in themed commits (data, modules, build, fixes) with `Co-Authored-By: Claude Opus 4.8`.
5. Only then merge to `main` (fast-forward when the branch is strictly ahead) and push.

## Security Invariants (NEVER violate)

- `.env.local` holds the NVIDIA key. It is gitignored. NEVER commit it, NEVER paste the key in chat or commit messages.
- `imagePath` and any file path from the bridge must stay sandboxed (see `geoai_assistant.py`).

## When NOT to use

- Mid-task when the workflow is already chosen — just keep executing that skill.
- Pure one-line edits with no design, test, or integration concern.

## Red Flags — STOP and route first

- About to write feature code with no plan → `brainstorming`/`writing-plans`
- About to debug by guessing/patching symptoms → `systematic-debugging`
- About to merge a Kimi/Devin drop without running pytest → Kimi gate above
- About to say "done" without re-running tests/smoke → `verification-before-completion`
