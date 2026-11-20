import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import * as http from "node:http";
import { tmpdir } from "node:os";
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

function resolveSelection({ model, fast, context, effort }) {
  if (!["composer-2.5", "grok-4.7"].includes(model)) {
    throw new Error("Select composer-2.5 or grok-4.7.");
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

async function authenticate({ AuthenticationError, Cursor, FileCredentialStore }) {
  const isAuthenticationError = (error) =>
    error instanceof AuthenticationError || error.status === 401;
  const apiKey = process.env.CURSOR_API_KEY;
  if (apiKey) {
    try {
      await Cursor.me({ apiKey });
      return apiKey;
    } catch (error) {
      if (!isAuthenticationError(error)) throw error;
    }
  }

  const store = new FileCredentialStore();
  const status = await Cursor.auth.status({ store });
  if (status.status === "logged-in") {
    const saved = await store.load();
    if (saved?.apiKey) {
      try {
        await Cursor.me({ apiKey: saved.apiKey });
        return saved.apiKey;
      } catch (error) {
        if (!isAuthenticationError(error)) throw error;
      }
    }
  }

  console.error("Cursor login required. Complete SSO in the browser to continue.");
  const login = await Cursor.auth.login({
    openBrowser: true,
    signal: AbortSignal.timeout(300_000),
    store: {
      load: () => store.load(),
      clear: () => store.clear(),
      async save(credentials) {
        try {
          await store.save(credentials);
        } catch (error) {
          if (!["EACCES", "EPERM", "EROFS"].includes(error.code)) throw error;
          console.error("Cursor login succeeded. This session can use the key, but the sandbox prevented saving it.");
        }
      },
    },
  });
  return login.apiKey;
}

async function main() {
  const workspace = await realpath(args.workspace ?? process.cwd());
  if (!(await stat(workspace)).isDirectory()) throw new Error("Workspace must be a directory.");
  const route = resolveSelection(await loadSelection(workspace));
  if (args.resolve) {
    console.log(JSON.stringify(route));
    return;
  }
  const role = args.role;
  if (!["explorer", "researcher", "worker", "tester", "reviewer"].includes(role) || !args["prompt-file"]) {
    throw new Error("Provide --role explorer|researcher|worker|tester|reviewer and --prompt-file PATH.");
  }
  const prompt = await readFile(args["prompt-file"], "utf8");
  if (!prompt.trim()) throw new Error("The delegation prompt is empty.");

  http.setGlobalProxyFromEnv?.();
  const sdk = await import("@cursor/sdk").catch((error) => {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    throw new Error("Cursor SDK is unavailable. Run npm ci in the cursor-worker directory.");
  });

  const { Agent, JsonlLocalAgentStore } = sdk;
  const apiKey = await authenticate(sdk);

  const readOnly = ["explorer", "researcher", "reviewer"].includes(role);
  const tools = readOnly ? ["read", "grep", "glob", "ls"] : undefined;
  if (role === "researcher") tools.push("webSearch");
  const stateDirectory = await mkdtemp(join(tmpdir(), "cursor-worker-"));
  let agent;
  try {
    agent = await Agent.create({
      apiKey,
      model: route.model,
      tools,
      disallowedTools: ["task", "mcp"],
      local: {
        cwd: workspace,
        sandboxOptions: { enabled: true },
        store: new JsonlLocalAgentStore(stateDirectory),
      },
    });
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
    try {
      await agent?.[Symbol.asyncDispose]();
    } finally {
      await rm(stateDirectory, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(`Cursor worker: ${error.message}`);
  process.exitCode = 1;
});
