---
name: astra-orchestrator
description: Orchestrate complex Codex coding work for the Plus profile with GPT-6 Luna at max reasoning as planner/integrator, optional Luna, Composer 2.5, or Grok 4.7 workers for exploration, implementation, testing, and research, and an Astra reviewer. Use for multi-file features, debugging across components, repo-wide changes, parallelizable workstreams, or whenever the user asks to delegate or use subagents. Do not use for trivial one-file edits or simple questions.
---

# Astra Orchestrator — Plus Profile

The user's explicit instructions take precedence over this skill.

## Goal

Use the root agent as the high-quality orchestrator.

Delegate bounded execution work to specialized subagents, then have the root integrate, verify, and present the final result.

The expected default topology is:

- root: GPT-6 Luna at max reasoning
- explorer: GPT-6 Luna at medium reasoning
- worker: GPT-6 Luna at medium reasoning
- tester: GPT-6 Luna at medium reasoning
- reviewer: GPT-6 Astra at low reasoning
- researcher: GPT-6 Luna at medium reasoning

---

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

---

## Delegation gate

Before doing substantive repository work, classify the task as either:

- root-only
- delegated

Use root-only only when the task is genuinely small, localized, and does not materially benefit from independent exploration, implementation, testing, research, or review.

The task MUST be delegated when at least one of the following is true:

- the task spans multiple files, modules, services, or components
- there are two or more independent workstreams
- repository exploration is needed before implementation
- implementation and verification benefit from separate context
- debugging requires tracing across components
- multiple modules or services need inspection
- external or version-specific facts need verification
- an independent post-change review is materially useful
- the user explicitly asks for delegation, parallelism, agents, or subagents

When a task qualifies for delegation, the root must launch the selected backend before performing the delegated work itself.

Do not merely describe, simulate, or internally reason about delegation.

Delegation requires a native subagent or a running Cursor worker.

If the selected backend is unavailable or fails, explicitly report that failure.

Disclose when delegated work must move back to the root thread.

For every delegated task, launch at least one agent through the selected backend.

Do not create subagents solely to satisfy this rule when the task is genuinely root-only.

---

## Root-agent responsibilities

The root agent owns:

1. understanding the user's actual goal
2. choosing the architecture and implementation direction
3. decomposing the task
4. deciding which tasks can run in parallel
5. launching the appropriate agents
6. giving each subagent a bounded contract
7. resolving conflicting subagent findings
8. integrating changes
9. reviewing the final diff
10. running or coordinating final verification
11. presenting the final result to the user

Subagents provide evidence and bounded execution.

They do not own the overall direction.

The root must not offload architectural ownership to a subagent.

---

## Spawn policy

When spawning native agents, use these models by default:

- explorer: `gpt-6-luna` at `medium` reasoning
- worker: `gpt-6-luna` at `medium` reasoning
- tester: `gpt-6-luna` at `medium` reasoning
- researcher: `gpt-6-luna` at `medium` reasoning
- reviewer: `gpt-6-astra` at `low` reasoning

The root keeps the Plus profile configuration from `.codex/config.toml`: GPT-6 Luna at max reasoning. The role files in `.codex/agents/` explicitly set Luna reasoning to `medium` and reviewer reasoning to `low`. Preserve those efforts when spawning agents unless the user requests a change. Do not change the root model from within a session.

For every native delegated task:

1. call `spawn_agent`
2. give the agent a descriptive task name using underscores
3. explicitly specify the intended model
4. give the subagent a bounded delegation contract
5. retain the returned task name or identifier
6. wait for required agents before final synthesis

Do not silently substitute the root agent for a delegated worker.

Do not spawn Astra workers except for the `reviewer` role unless:

- the user explicitly requests Astra
- the selected worker reports a genuinely difficult reasoning blocker
- the root determines that a high-risk architectural or security review needs Astra

---

## Delegation contract

Every delegated task should include:

- Objective: one concrete outcome
- Scope: exact files, module, subsystem, or question when known
- Context: only the information needed to succeed
- Constraints: what must not change
- Deliverable: what the subagent must return or implement
- Acceptance criteria: how success will be checked

Prefer narrow tasks that can finish independently.

Bad:

> Fix the backend.

Good:

> Trace where POST /invoices validates currency. Return the responsible files, validation path, and existing tests. Do not edit files.

For implementation tasks, explicitly state file ownership when possible.

For exploration tasks, tell the agent not to edit files.

For review tasks, tell the agent to report findings rather than silently modify unrelated code.

---

## Role selection

Use `explorer` for:

- repository mapping
- tracing execution or data flow
- locating symbols and tests
- dependency inspection
- configuration inspection
- identifying implementation boundaries

Use `worker` for:

- bounded implementation
- small refactors with explicit scope
- targeted fixes
- adding requested code
- modifying clearly owned files

Use `tester` for:

- reproduction
- targeted test execution
- validation
- regression checks
- adding tests when requested or clearly required by the task

Use `reviewer` for:

- independent post-change review
- correctness checks
- security review
- regression analysis
- missing-test analysis
- architectural consistency checks

Use `researcher` for:

- current API or framework behavior
- dependency or version questions
- primary documentation verification
- external compatibility questions

---

## Parallelism

Run independent tasks in parallel.

When two or more delegated tasks are independent, launch all of them before waiting for any one of them.

Good parallel set:

1. spawn backend explorer
2. spawn frontend explorer
3. spawn API researcher
4. wait for all three
5. synthesize findings

Do not do this:

1. spawn backend explorer
2. wait
3. spawn frontend explorer
4. wait
5. spawn researcher
6. wait

unless later tasks genuinely depend on earlier results.

Good parallel examples:

- explorer maps backend path
- explorer maps frontend path
- researcher verifies external API behavior

Serialize dependent work:

1. explore
2. decide architecture
3. implement
4. test
5. review
6. fix material findings
7. final verification

Do not send multiple workers to edit the same files unless the root explicitly coordinates ownership.

Prefer one writer per file or subsystem.

---

## Default coding workflow

For non-trivial implementation tasks, prefer this sequence:

1. launch one or more explorers if repository understanding is needed
2. wait for exploration results
3. root decides implementation direction
4. launch one or more workers with bounded ownership
5. wait for implementation
6. launch a tester
7. wait for validation
8. spawn Astra reviewer when an independent review is materially useful
9. resolve material findings
10. run final verification
11. present the result

Launch only the roles the work requires.

Use only the roles that materially improve the task.

However, once the delegation gate is satisfied, at least one agent must be launched.

---

## Debugging workflow

For cross-component bugs:

1. spawn explorers for independent suspected areas
2. reproduce the issue when possible
3. collect evidence before selecting a fix
4. root determines the likely root cause
5. assign a bounded worker to implement the fix
6. assign a tester to reproduce the original failure and validate the fix
7. use Astra reviewer for high-risk or non-obvious fixes

Do not let multiple workers independently attempt competing fixes unless the root intentionally requests alternative approaches.

---

## Research workflow

When current or version-specific external information matters:

1. launch a researcher
2. require primary or authoritative sources when possible
3. return concise findings and compatibility implications
4. let the root decide how those findings affect implementation

Do not mix speculative external claims into implementation decisions without verification.

---

## Cost and context discipline

Use the selected backend for routine subagent execution.

Keep the root context focused on:

- architectural decisions
- summarized evidence
- important diffs
- test results
- reviewer findings
- unresolved risks

Do not paste large raw logs or entire files back into the root when a concise evidence summary is enough.

Subagents should return:

- conclusions
- relevant file paths
- important line or symbol references
- commands run
- test results
- risks or blockers

Avoid returning large amounts of irrelevant raw output.

---

## Escalation behavior

A subagent should report back instead of expanding scope when it encounters:

- an architectural decision
- a breaking API or schema change
- a new dependency
- a security-sensitive design choice
- unclear requirements with materially different outcomes
- unexpected changes outside its assigned scope
- changes that affect another worker's ownership
- a blocker that requires substantially broader reasoning

The root decides what to do next.

A delegated agent should report when a task needs a different model.

The root owns model escalation decisions.

---

## Failure handling

If a subagent fails:

1. inspect the failure reason
2. decide whether the task should be retried, narrowed, reassigned, or handled by the root
3. do not silently ignore the failed delegation
4. do not claim the delegated work completed successfully

If the selected backend fails to launch, explicitly note the failure.

If a required worker fails repeatedly, the root may continue directly when reasonable, but should record that the fallback occurred.

---

## Delegated-task completion gate

Before producing the final answer for a delegated task, confirm that:

- every required agent was launched
- every required subagent either completed or explicitly failed
- material findings were integrated
- conflicting findings were resolved
- required verification was performed
- no required agent is still running

Do not finish while required subagents are still running.

Report the backend actually used for delegated work.

---

## Final verification

Before claiming completion, the root should:

1. inspect the final diff
2. confirm the requested behavior is actually implemented
3. check material reviewer findings
4. run or confirm the highest-value tests
5. verify that delegated results were integrated correctly
6. state any validation that could not be performed

For implementation tasks, prefer checking:

- syntax or type checks
- targeted unit tests
- integration tests where relevant
- build success where relevant
- the original reproduction path
- final diff for unintended changes

---

## User-facing behavior

Do not narrate every subagent action unless the user asks for detailed orchestration visibility.

The final answer should focus on:

- what changed
- what was verified
- important findings
- remaining risks or limitations

When useful, briefly mention which agents contributed.

If the user explicitly asks to see delegation, report:

- subagent name
- model
- assigned task
- completion status

Do not claim a Luna agent was used unless the trace contains a successful `spawn_agent` call using `gpt-6-luna`.
