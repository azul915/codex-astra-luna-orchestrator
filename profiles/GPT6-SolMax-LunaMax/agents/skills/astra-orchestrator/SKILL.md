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

The root and reviewer use the profile models. For each explorer, worker, tester, and researcher assignment, the orchestrator can choose the worker model and its options from the task alone. A request can give just the task, name a model, or specify individual options.

1. Read `.agents/skills/astra-orchestrator/worker-model.json` if it exists. Apply an explicit per-task model or option first, then compatible project settings. If the request switches models, start with the new model's options. If the request names no model and gives a Grok-only option (Context or Effort), use Grok 4.7. If the request gives only Fast, use the configured Cursor model when compatible or choose a Cursor model for the assignment. Explicitly selecting Luna uses the native backend.
2. When the model is open, choose Composer 2.5 for bounded coding and tests, or Grok 4.7 for difficult reasoning, context-heavy investigation, and complex research. Prefer variants known to be available on the account.
3. Fill in each unspecified Cursor option from the assignment:
   - For Composer 2.5 and Grok 4.7, turn Fast on when latency matters and off otherwise.
   - For Grok 4.7, use Context `256k` by default or `500k` when the necessary working context warrants it. Choose Effort `low` for simple work, `medium` for routine work, `high` for complex work, or `xhigh` for exceptionally difficult work.

Translate the terms into runner values once for each assignment. For Cursor, resolve the route before launching it. Pass the same concrete model and options on both invocations from the project root, or use the absolute path to the installed runner. The runner accepts `--model composer-2.5` or `--model grok-4.7`, `--fast true|false`, and for Grok `--context 256k|500k` and `--effort low|medium|high|xhigh`. For example:

```sh
node .agents/skills/astra-orchestrator/scripts/cursor-worker/run.mjs --workspace "<absolute workspace>" --resolve --model grok-4.7 --fast false --context 256k --effort high
```

- For native Luna, call `spawn_agent` with the profile's role and model. Native delegation requires no Cursor runner or SDK.
- For `backend: cursor`, write the bounded delegation contract to a temporary UTF-8 file and invoke the same runner with `--role <role> --prompt-file "<absolute prompt file>"` in place of `--resolve`. Use the shell tool and track the process until it exits. Clean up the prompt file when finished.
- Include both kinds of delegation in the profile concurrency limit. Keep write scope explicit for Cursor workers and testers. Use the native reviewer role for independent review.
- If an automatically selected Cursor route is unavailable before work starts, use native Luna and report the fallback. If the user or project explicitly selects a model or option and that choice is unavailable, surface the failure and preserve the explicit selection. If work may already have started, check its effects before retrying or changing the route.

## Delegation

The root owns architecture, task breakdown, integration, and final verification. Keep genuinely small tasks root-only. For work spanning multiple files, independent workstreams, cross-component debugging, or useful independent review, delegate bounded tasks to specialized agents when available. If required delegation is unavailable, report that rather than claiming it happened.

For each delegated task, specify the objective, scope, context, constraints, deliverable, and acceptance criteria. Launch the named role through the selected backend. Use the pinned model when the route is native. Use explorer for mapping code, worker for implementation, tester for verification, researcher for version-specific facts, and reviewer for independent post-change review. Do not let multiple workers edit the same files without explicit ownership boundaries.

Run independent tasks in parallel and serialize dependent work. Prefer exploration, architecture decision, bounded implementation, targeted testing, independent review when useful, then integration and final verification. Launch only the roles the work requires. Report agent failures and resolve material findings before finishing.

## Verification

Inspect the final diff, verify requested behavior, run relevant tests, and state any validation that could not be performed. Report the backend actually used for delegated work.
