# Codex Orchestrator with Luna, Composer and Grok

Install a Codex profile with GPT-6 Astra, GPT-6.1 Sol, or GPT-6 Luna as the orchestrator,
an independent reviewer, and your choice of GPT-6 Luna, Composer 2.5, or Grok 4.7 for execution.

The Sol profiles use `gpt-6.1-sol` for both the orchestrator and reviewer.

## Orchestration topology

The diagram shows the Astra (Pro) and Sol orchestrators. Plus uses a Luna
root, as shown in the profile table below. The diagram shows the native GPT-6 Luna execution route;
the reviewer uses Astra for Pro/Plus and Sol for Sol profiles.

```text
           GPT-6 Astra / GPT-6.1 Sol
             root / orchestrator
                      |
      +---------------+---------------+
      |               |               |
   explorer          worker         researcher
  GPT-6 Luna       GPT-6 Luna       GPT-6 Luna
      |               |
      +-------+-------+
              |
           tester
         GPT-6 Luna
              |
          reviewer
      GPT-6 Astra / GPT-6.1 Sol
              |
              v
           root agent
      integrate + verify
```

## Setup

1. Clone this repository and enter it:

   ```sh
   git clone https://github.com/azul915/codex-astra-luna-orchestrator.git
   cd codex-astra-luna-orchestrator
   ```

2. Run the installer for your platform:

   macOS/Linux:

   ```sh
   ./setup.sh
   ```

   Windows PowerShell:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup.ps1
   ```

   PowerShell 7:

   ```powershell
   pwsh -File .\setup.ps1
   ```

3. When prompted, enter an **existing target repository other than this one**,
   choose a profile by number or name (Enter selects Pro), and confirm which
   components to install. For example:

   ```text
   Target repository path: ../my-project
   Select Profile [1-6] (default 1): 5
   ```

The installer copies the selected configuration to `.codex/`, its skill to
`.agents/`, and project instructions to `AGENTS.md`. Existing component files
are updated only after confirmation; existing `AGENTS.md` content is preserved.
Codex loads project-scoped configuration only for trusted projects.

### Installed target project

If you install all three components into `../my-project`, the installer adds
these paths alongside the project's existing files:

```text
my-project/
├── .codex/
│   ├── config.toml
│   └── agents/
│       ├── explorer.toml
│       ├── researcher.toml
│       ├── reviewer.toml
│       ├── tester.toml
│       └── worker.toml
├── .agents/
│   └── skills/
│       └── astra-orchestrator/
│           └── SKILL.md
└── AGENTS.md
```

`profiles/<profile>/codex/` becomes `.codex/`, and
`profiles/<profile>/agents/` becomes `.agents/`. The root `AGENTS.md` is
copied to the target, or its instructions are appended if that file exists.

## How to use the skill

From the target repository, launch Codex CLI. For the example above:

```sh
cd ../my-project
codex
```

For complex work, Codex may select the skill automatically, or you can invoke
it explicitly:

```text
$astra-orchestrator
Implement the invoice export endpoint. Use the explorer to map the path,
a worker to implement it, and the tester and reviewer to verify it.
```

The skill keeps the `astra-orchestrator` name in every profile so the shared
`AGENTS.md` works; the Sol profiles use Sol according to their configuration.

## Let the orchestrator choose the worker

Give the orchestrator the task. It chooses the model and options for each execution role from the work's scope, reasoning difficulty, and latency needs.

```text
$astra-orchestrator
Find why the integration tests fail and fix the cause.
```

To choose only the model, add a sentence such as `Use Grok 4.7 for this task.` The orchestrator still chooses Fast, Context, and Effort. You can also provide any option explicitly.

For Composer and Grok, install the `.agents` component, use Node.js 22.13 or later, and authenticate the Cursor SDK via `CURSOR_API_KEY` or SDK browser login. Install the runner's dependencies from its directory:

```sh
cd .agents/skills/astra-orchestrator/scripts/cursor-worker
npm ci
```

### Cursor-only delegation

The optional `profiles/cursor-only` setup keeps the current Codex model as orchestrator and limits workers, including reviewers, to Grok 4.7 or Composer 2.5.

1. Merge [the feature settings](profiles/cursor-only/codex/config.toml) into the existing `[features]` and `[agents]` tables in `${CODEX_HOME:-$HOME/.codex}/config.toml`. Set `agents.enabled = false` and turn off both multi-agent feature flags. Check any project-level overrides as well.
2. Install [the Cursor-only skill](profiles/cursor-only/agents/skills/astra-orchestrator/SKILL.md) as `~/.agents/skills/astra-orchestrator/SKILL.md`. Copy `scripts/cursor-worker/` under its `scripts/` directory and run `npm ci` in the installed runner directory.
3. Open a fresh Codex chat. Check that the native `spawn_agent` tool is absent and resolve both supported model IDs through the installed runner. The runner rejects every other ID before importing the SDK. If Cursor cannot start a worker, the orchestrator handles the task directly.

The runner validates credentials before sending a task. If the configured key and saved browser login are unavailable or rejected, it opens the Cursor sign-in page, waits up to five minutes for SSO, and uses the newly minted key for the pending task. The SDK stores the key in `~/.cursor/sdk/auth.json` if the sandbox permits it. A network error leaves the login flow untouched. The runner does not resubmit work after a worker has started.

The runner stores SDK state in a temporary directory and removes it when it exits. The Codex shell still needs network access to reach Cursor. If the shell is network-restricted, run the worker with network permission where available.

### Worker routing in the six installer profiles

The orchestrator typically uses Composer 2.5 for bounded implementations and tests, or Grok 4.7 for larger investigations and complex reasoning. For Grok, it chooses 256k by default and 500k when the task needs the extra context. When automatically selected Cursor execution is unavailable, native GPT-6 Luna is the fallback. Each profile defines the root and reviewer models.

For project-wide preferences, create `.agents/skills/astra-orchestrator/worker-model.json`:

```json
{
  "model": "grok-4.7"
}
```

The orchestrator fills in options omitted from this file. You can pin any of the supported fields, and explicit task instructions take precedence.

| Model | Supported options |
| --- | --- |
| `gpt-6-luna` | Native Codex role from the selected profile |
| `composer-2.5` | `fast` boolean |
| `grok-4.7` | `fast` boolean, `context` (`256k` or `500k`), and `effort` (`low`, `medium`, `high`, or `xhigh`) |

Available variants depend on the Cursor account. [Cursor SDK model parameters](https://cursor.com/docs/sdk/typescript#model-parameters) · [Grok 4.7 options](https://cursor.com/docs/models/grok-4-7)

For manual project installs, copy `scripts/cursor-worker/` into the installed skill's `scripts/` directory before running `npm ci`.

## Profiles

| Choice | Profile | Root | Execution roles | Reviewer | Concurrent subagents |
|---|---|---|---|---|---:|
| 1 (default) | `pro` | Astra medium | Luna max | Astra low | 4 |
| 2 | `plus` | Luna max | Luna medium | Astra low | 4 |
| 3 | `pro-max-2-subagents` | Astra medium | Luna max | Astra low | 2 |
| 4 | `plus-max-2-subagents` | Luna max | Luna medium | Astra low | 2 |
| 5 | `GPT6-SolMax-LunaMax` | Sol max | Luna max | Sol max | 4 |
| 6 | `GPT6-SolMedium-LunaMax` | Sol medium | Luna max | Sol medium | 4 |

All models above are GPT-6. Execution roles are explorer, worker, tester,
and researcher; named roles pin their models and reasoning levels independently
of the default subagent settings. Each ready-to-copy profile lives under
`profiles/<profile>/`.

For manual project setup, copy the selected profile's `codex/` and `agents/`
to the target repository as `.codex/` and `.agents/`, and add this repository's
`AGENTS.md`. For personal/global setup, copy its `codex/agents/` into
`~/.codex/agents/`, its `agents/skills/astra-orchestrator/` into
`~/.agents/skills/`, and **merge**, rather than replace, its `codex/config.toml`
settings into `~/.codex/config.toml`. Do not overwrite other existing Codex
settings.

## Key directory structure

```text
.
├── profiles/
│   ├── pro/
│   ├── plus/
│   ├── pro-max-2-subagents/
│   ├── plus-max-2-subagents/
│   ├── GPT6-SolMax-LunaMax/
│   └── GPT6-SolMedium-LunaMax/
├── guides/
├── scripts/
│   └── token_usage.py
├── tests/
│   ├── test_profiles.py
│   └── test_token_usage.py
├── AGENTS.md
├── setup.sh
├── setup.ps1
├── README.md
└── LICENSE
```

Each profile contains `codex/config.toml`, `codex/agents/*.toml`, and
`agents/skills/astra-orchestrator/SKILL.md`.

## Guides

- [Pro orchestration and manual configuration](guides/full-orchestration.md)
- [Plus profile and global setup](guides/plus-plan.md)
- [Fast iteration](guides/fast-iteration.md) and [routine coding](guides/routine-coding.md)
- [Complex repository work](guides/complex-repo-work.md)
- [Token usage and measurement](guides/token-usage.md)

## License

Licensed under the [Apache License 2.0](LICENSE).
