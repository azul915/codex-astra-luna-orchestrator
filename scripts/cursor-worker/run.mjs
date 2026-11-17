import { readFile, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    resolve: { type: "boolean" },
    workspace: { type: "string" },
    role: { type: "string" },
    "prompt-file": { type: "string" },
    config: { type: "string" },
    model: { type: "string" },
    fast: { type: "string" },
    context: { type: "string" },
    effort: { type: "string" },
  },
});

async function loadSelection(workspace) {
  const path = args.config ?? join(workspace, ".agents", "skills", "astra-orchestrator", "worker-model.json");
  let config = {};
  // An explicit model starts a fresh selection, unless --config was also specified.
  if (args.model === undefined || args.config !== undefined) {
    try {
      config = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT" || args.config !== undefined) {
        throw new Error(`Cannot read worker configuration at ${path}: ${error.message}`);
      }
    }
  }

  const keys = ["model", "fast", "context", "effort"];
  if (!config || typeof config !== "object" || Array.isArray(config) ||
      Object.keys(config).some((key) => !keys.includes(key))) {
    throw new Error("Worker configuration must be a JSON object with model, fast, context and effort keys only.");
  }

  for (const key of keys) {
    if (args[key] === undefined) continue;
    if (key === "fast" && !["true", "false"].includes(args.fast)) {
      throw new Error("--fast must be true or false.");
    }
    config[key] = key === "fast" ? args.fast === "true" : args[key];
  }
  return config;
}

function resolveSelection({ model = "gpt-6-luna", fast, context, effort }) {
  if (model === "gpt-6-luna") {
    if ([fast, context, effort].some((value) => value !== undefined)) {
      throw new Error("Fast, Context and Effort options require a Cursor model.");
    }
    return { backend: "codex", model };
  }
  if (!["composer-2.5", "grok-4.7"].includes(model)) {
    throw new Error("Worker model must be gpt-6-luna, composer-2.5 or grok-4.7.");
  }
  if (fast !== undefined && typeof fast !== "boolean") {
    throw new Error("Fast must be a boolean.");
  }
  const params = [];
  if (fast !== undefined) params.push({ id: "fast", value: String(fast) });
  if (model === "composer-2.5" && (context !== undefined || effort !== undefined)) {
    throw new Error("Context and Effort are available only for Grok 4.7.");
  }
  if (context !== undefined) {
    if (!["256k", "500k"].includes(context)) throw new Error("Context must be 256k or 500k.");
    params.push({ id: "context", value: context });
  }
  if (effort !== undefined) {
    if (!["low", "medium", "high", "xhigh"].includes(effort)) {
      throw new Error("Effort must be low, medium, high or xhigh.");
    }
    params.push({ id: "reasoning_effort", value: effort });
  }
  return { backend: "cursor", model: { id: model, params } };
}

async function main() {
  const workspace = await realpath(args.workspace ?? process.cwd());
  if (!(await stat(workspace)).isDirectory()) throw new Error("Workspace must be a directory.");
  const route = resolveSelection(await loadSelection(workspace));
  if (args.resolve) {
    console.log(JSON.stringify(route));
    return;
  }
  if (route.backend === "codex") throw new Error("Use native Codex delegation for GPT-6 Luna.");

  const role = args.role;
  if (!["explorer", "researcher", "worker", "tester"].includes(role) || !args["prompt-file"]) {
    throw new Error("Provide --role explorer|researcher|worker|tester and --prompt-file PATH.");
  }
  const prompt = await readFile(args["prompt-file"], "utf8");
  if (!prompt.trim()) throw new Error("The delegation prompt is empty.");

  const { Agent } = await import("@cursor/sdk").catch((error) => {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    throw new Error("Cursor SDK is unavailable. Run npm ci in the cursor-worker directory.");
  });

  const readOnly = role === "explorer" || role === "researcher";
  const tools = readOnly ? ["read", "grep", "glob", "ls"] : undefined;
  if (role === "researcher") tools.push("webSearch");
  const agent = await Agent.create({
    model: route.model,
    tools,
    disallowedTools: ["task", "mcp"],
    local: { cwd: workspace, sandboxOptions: { enabled: true } },
  });
  try {
    const run = await agent.send(`You are the ${role} delegated by the Codex orchestrator. Stay within the task scope and report results and verification to the orchestrator.\n\n${prompt}`);
    const result = await run.wait();
    if (result.status !== "finished") {
      throw new Error(result.error?.message ?? `Cursor run ${result.status}.`);
    }
    console.log(JSON.stringify({
      role,
      model: result.model ?? route.model,
      result: result.result,
    }));
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

main().catch((error) => {
  console.error(`Cursor worker: ${error.message}`);
  process.exitCode = 1;
});
