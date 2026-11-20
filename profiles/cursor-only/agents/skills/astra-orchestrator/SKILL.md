---
name: astra-orchestrator
description: Coordinate complex Codex work and delegate bounded tasks to Grok 4.7 or Composer 2.5 through the Cursor SDK. Use for multi-component work or when the user requests delegation.
---

# Cursor worker orchestration

The current Codex chat owns planning, integration, and final verification. It can delegate exploration, research, implementation, testing, and independent review to Grok 4.7 or Composer 2.5. Include a clear task, file ownership, and expected evidence in each assignment. Give parallel workers disjoint write scopes and wait for their results before integrating changes.

Use Composer 2.5 for bounded implementation and tests, and Grok 4.7 for complex reasoning and investigations. Pass the model explicitly. If the requested model or Cursor SDK is unavailable, report the failure and continue in the current chat where possible. Before retrying an interrupted write task, check the workspace for partial edits.

Use the runner from this skill's installed directory. Resolve the options before launching, then pass the same options with the role and a temporary UTF-8 prompt file. Remove the prompt file when the worker exits.

```sh
runner="$HOME/.agents/skills/astra-orchestrator/scripts/cursor-worker/run.mjs"
node "$runner" --workspace "$PWD" --resolve --model grok-4.7 --fast false --context 256k --effort high
node "$runner" --workspace "$PWD" --role reviewer --prompt-file "$worker_prompt" --model grok-4.7 --fast false --context 256k --effort high
```

If the runner says Cursor login is required, wait for the running process while the user completes SSO in the browser. The runner uses the new key for the pending work.

Roles are explorer, researcher, worker, tester, and reviewer. The runner restricts explorer, researcher, and reviewer to read-only tools. Grok supports context values `256k` and `500k` and effort values `low`, `medium`, `high`, and `xhigh`. Both models support `--fast true|false`.
