---
name: astra-orchestrator
description: Orchestrate complex Codex coding work with GPT-6.1 Sol at max reasoning as planner/integrator and reviewer and optional Luna, Composer 2.5, or Grok 4.7 workers for exploration, implementation, testing, and research. Use for multi-file features, debugging across components, repo-wide changes, parallelizable workstreams, or when the user asks to delegate. Do not use for trivial edits or simple questions.
---

# Orchestrator — GPT-6.1 Sol Max + GPT-6 Luna Max

The user's explicit instructions take precedence over this skill.

## Topology

- root: `gpt-6.1-sol` at `max` reasoning
- explorer, worker, tester, researcher: `gpt-6-luna` at `max` reasoning
- reviewer: `gpt-6.1-sol` at `max` reasoning, in an independent read-only context

The role files in `.codex/agents/` pin these models and reasoning levels; generic subagents inherit the Luna defaults in `.codex/config.toml`. Do not change the root model from within a session.

## Worker model routing

The root and reviewer use the profile models. For explorer, worker, tester, and researcher, the orchestrator selects the backend before delegating. An explicit user selection takes precedence over the project configuration. Use native Luna when the user selects it or no project configuration exists. For a project configuration or a per-task Cursor selection, resolve the route with the installed runner:

```sh
node .agents/skills/astra-orchestrator/scripts/cursor-worker/run.mjs --resolve --workspace "<absolute workspace>"
```

Run from the project root, or use the absolute path to the installed runner. The project configuration is `.agents/skills/astra-orchestrator/worker-model.json`. Supported models are `gpt-6-luna` (the default), `composer-2.5` with optional `fast`, and `grok-4.7` with optional `fast`, `context` (`256k` or `500k`), and `effort` (`low`, `medium`, `high`, or `xhigh`). For a per-task selection, pass `--model` and any explicitly requested `--fast true|false`, `--context`, and `--effort` flags on both invocations.

- For `backend: codex`, call `spawn_agent` with the profile's role and model. The native path also applies when the user or project explicitly selects Luna. Native delegation requires no Cursor runner or SDK.
- For `backend: cursor`, write the bounded delegation contract to a temporary UTF-8 file and invoke the same runner with `--role <role> --prompt-file "<absolute prompt file>"` in place of `--resolve`. Pass `--workspace` explicitly. Use the shell tool and track the process until it exits. Clean up the prompt file when finished.
- Include both kinds of delegation in the profile concurrency limit. Keep write scope explicit for Cursor workers and testers. Use the native reviewer role for independent review.
- If resolution or execution fails, report the selected backend and the error. Preserve the requested model unless the user authorizes a change.

## Delegation

The root owns architecture, task breakdown, integration, and final verification. Keep genuinely small tasks root-only. For work spanning multiple files, independent workstreams, cross-component debugging, or useful independent review, delegate bounded tasks to specialized agents when available. If required delegation is unavailable, report that rather than claiming it happened.

For each delegated task, specify the objective, scope, context, constraints, deliverable, and acceptance criteria. Launch the named role through the selected backend. Use the pinned model when the route is native. Use explorer for mapping code, worker for implementation, tester for verification, researcher for version-specific facts, and reviewer for independent post-change review. Do not let multiple workers edit the same files without explicit ownership boundaries.

Run independent tasks in parallel and serialize dependent work. Prefer exploration, architecture decision, bounded implementation, targeted testing, independent review when useful, then integration and final verification. Launch only the roles the work requires. Report agent failures and resolve material findings before finishing.

## Verification

Inspect the final diff, verify requested behavior, run relevant tests, and state any validation that could not be performed. Report the backend actually used for delegated work.
