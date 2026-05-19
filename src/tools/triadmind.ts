import { resolve } from "node:path";
import type { ReasonixConfig, TriadMindMode } from "../config.js";
import type { ToolRegistry } from "../tools.js";
import {
  type TriadMindEngine,
  type TriadMindEngineResult,
  createInternalTriadMindEngine,
} from "./triadmind-engine.js";

export const TRIADMIND_TOOL_NAMES = [
  "triadmind_status",
  "triadmind_sync",
  "triadmind_watch",
  "triadmind_navigate",
  "triadmind_dream",
  "triadmind_dream_daemon",
  "triadmind_govern",
  "triadmind_verify",
  "triadmind_visualize",
  "triadmind_runtime",
  "triadmind_coverage",
  "triadmind_trend",
  "triadmind_view_map",
  "triadmind_renormalize",
  "triadmind_rules",
  "triadmind_memory_sync",
  "triadmind_memory_search",
  "triadmind_memory_recommend",
  "triadmind_memory_actions",
  "triadmind_toolkit_sync",
  "triadmind_toolkit_search",
  "triadmind_toolkit_export",
  "triadmind_toolkit_path",
  "triadmind_toolkit_whitelist",
] as const;

export interface TriadMindSupportOptions {
  rootDir: string;
  config?: ReasonixConfig;
  engine?: TriadMindEngine;
}

export interface TriadMindSupport {
  enabled: boolean;
  mode: TriadMindMode;
  status: () => string;
  registerTools: (registry: ToolRegistry) => ToolRegistry;
  runInternalText: (args: string[]) => Promise<string>;
  runAdvisory: (cause: string) => Promise<string | null>;
}

interface TriadMindEngineSpec {
  label: string;
  rootDir: string;
  source: string;
  advisoryForceSync: boolean;
  engine: TriadMindEngine;
}

interface TriadMindJsonResult {
  data: unknown;
  exitCode: number;
  text: string;
  stderr: string;
}

export function createTriadMindSupport(opts: TriadMindSupportOptions): TriadMindSupport {
  const rootDir = resolve(opts.rootDir);
  const config = opts.config ?? {};
  const mode = normalizeMode(config.triadmind?.mode);
  const triadmind = resolveTriadMindEngine({ rootDir, config, engine: opts.engine });
  let advisoryRunning = false;

  const support: TriadMindSupport = {
    enabled: mode !== "disabled",
    mode,
    status: () =>
      JSON.stringify(
        {
          enabled: mode !== "disabled",
          mode,
          rootDir,
          engine: "internal",
          source: triadmind.source,
          corePath: triadmind.engine.corePath,
          advisoryForceSync: triadmind.advisoryForceSync,
        },
        null,
        2,
      ),
    registerTools: (registry) => {
      if (mode === "disabled") return registry;

      registry.register({
        name: "triadmind_status",
        description:
          "Show the active in-process TriadMind integration status for this workspace: mode, root directory, core source, and advisory settings.",
        readOnly: true,
        fn: async () => support.status(),
      });

      registry.register({
        name: "triadmind_sync",
        description:
          "Refresh TriadMind topology artifacts in-process for the current workspace. Use after source changes or before deeper architecture checks.",
        parameters: {
          type: "object",
          properties: {
            force: { type: "boolean", description: "Force a full topology rebuild." },
            scanMode: {
              type: "string",
              enum: ["leaf", "capability", "module", "domain"],
              description: "Optional temporary scan mode override.",
            },
          },
        },
        fn: async (args: { force?: boolean; scanMode?: string }) => {
          const commandArgs = ["sync"];
          if (args.force) commandArgs.push("--force");
          if (typeof args.scanMode === "string" && args.scanMode.trim()) {
            commandArgs.push("--scan-mode", args.scanMode.trim());
          }
          return runTriadMindText(triadmind, commandArgs);
        },
      });

      registry.register({
        name: "triadmind_watch",
        description:
          "Start, stop, or inspect an in-process TriadMind topology watcher for this workspace.",
        parameters: {
          type: "object",
          properties: { action: { type: "string", enum: ["start", "stop", "status"] } },
        },
        fn: async (args: { action?: string }) => {
          const action = args.action?.trim() || "start";
          return runTriadMindJsonString(triadmind, ["watch", action, "--json"]);
        },
      });
      registry.register({
        name: "triadmind_navigate",
        description:
          "Generate an in-process TriadMind pre-implementation impact plan for a requested feature.",
        parameters: {
          type: "object",
          properties: {
            demand: { type: "string", description: "Feature or architecture change to plan." },
            llm: { type: "string", description: "Optional TriadMind LLM backend descriptor." },
            protocolPath: { type: "string", description: "Optional impact protocol JSON path." },
            view: {
              type: "string",
              enum: ["architecture", "leaf"],
              description: "Preferred visualizer view.",
            },
          },
          required: ["demand"],
        },
        fn: async (args: {
          demand: string;
          llm?: string;
          protocolPath?: string;
          view?: string;
        }) => {
          const commandArgs = ["navigate", "--json", requireNonEmpty(args.demand, "demand")];
          if (typeof args.llm === "string" && args.llm.trim())
            commandArgs.push("--llm", args.llm.trim());
          if (typeof args.protocolPath === "string" && args.protocolPath.trim()) {
            commandArgs.push("--protocol", args.protocolPath.trim());
          }
          if (typeof args.view === "string" && args.view.trim())
            commandArgs.push("--view", args.view.trim());
          return runTriadMindJsonString(triadmind, commandArgs);
        },
      });

      registry.register({
        name: "triadmind_dream",
        description:
          "Run the in-process TriadMind Dream engine. Supports v1.3 impact-chain filtering via impactThreshold and fast mode.",
        parameters: {
          type: "object",
          properties: {
            force: { type: "boolean", description: "Bypass idle gating and run immediately." },
            fast: {
              type: "boolean",
              description: "Run dream fast, equivalent to impactThreshold=3.",
            },
            impactThreshold: {
              type: "integer",
              description: "Only analyze nodes whose impact-chain length is at least this value.",
            },
            maxProposals: { type: "integer", description: "Maximum proposals to keep." },
            minConfidence: {
              type: "number",
              description: "Minimum proposal confidence between 0 and 1.",
            },
            mode: { type: "string", enum: ["manual", "idle"], description: "Dream run mode." },
          },
        },
        fn: async (args: {
          force?: boolean;
          fast?: boolean;
          impactThreshold?: number;
          maxProposals?: number;
          minConfidence?: number;
          mode?: string;
        }) => {
          const commandArgs = args.fast ? ["dream", "fast", "--json"] : ["dream", "run", "--json"];
          if (typeof args.mode === "string" && args.mode.trim())
            commandArgs.push("--mode", args.mode.trim());
          if (args.force) commandArgs.push("--force");
          if (Number.isFinite(args.impactThreshold))
            commandArgs.push("--impact-threshold", String(args.impactThreshold));
          if (Number.isFinite(args.maxProposals))
            commandArgs.push("--max-proposals", String(args.maxProposals));
          if (Number.isFinite(args.minConfidence))
            commandArgs.push("--min-confidence", String(args.minConfidence));
          return runTriadMindJsonString(triadmind, commandArgs);
        },
      });

      registry.register({
        name: "triadmind_dream_daemon",
        description: "Start, stop, or inspect the Reasonix in-process TriadMind Dream daemon.",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["start", "stop", "status"] },
            intervalSeconds: { type: "integer" },
            maxTicks: { type: "integer" },
          },
        },
        fn: async (args: { action?: string; intervalSeconds?: number; maxTicks?: number }) => {
          const action = args.action?.trim() || "status";
          const commandArgs = ["dream", "daemon", action, "--json"];
          if (Number.isFinite(args.intervalSeconds))
            commandArgs.push("--interval-seconds", String(args.intervalSeconds));
          if (Number.isFinite(args.maxTicks))
            commandArgs.push("--max-ticks", String(args.maxTicks));
          return runTriadMindJsonString(triadmind, commandArgs);
        },
      });
      registry.register({
        name: "triadmind_govern",
        description: "Run in-process TriadMind governance checks. Supports v1.3 scope=impact.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["check", "ci", "fix"], description: "Governance mode." },
            scope: { type: "string", enum: ["full", "impact"], description: "Governance scope." },
            policyPath: { type: "string", description: "Optional govern-policy.json path." },
            llm: {
              type: "string",
              description: "Optional LLM backend descriptor for fix planning.",
            },
            maxIterations: { type: "integer", description: "Max fix iterations." },
            dryRun: {
              type: "boolean",
              description: "For govern fix: emit patch without applying.",
            },
          },
        },
        fn: async (args: {
          mode?: string;
          scope?: string;
          policyPath?: string;
          llm?: string;
          maxIterations?: number;
          dryRun?: boolean;
        }) => {
          const modeArg = args.mode === "ci" || args.mode === "fix" ? args.mode : "check";
          const commandArgs = ["govern", modeArg, "--json"];
          if (args.scope === "impact" || args.scope === "full")
            commandArgs.push("--scope", args.scope);
          if (typeof args.policyPath === "string" && args.policyPath.trim())
            commandArgs.push("--policy", args.policyPath.trim());
          if (typeof args.llm === "string" && args.llm.trim())
            commandArgs.push("--llm", args.llm.trim());
          if (Number.isFinite(args.maxIterations))
            commandArgs.push("--max-iterations", String(args.maxIterations));
          if (args.dryRun) commandArgs.push("--dry-run");
          return runTriadMindJsonString(triadmind, commandArgs);
        },
      });

      registry.register({
        name: "triadmind_verify",
        description:
          "Run in-process TriadMind topology verification. Supports verify --focus impact and --full.",
        parameters: {
          type: "object",
          properties: {
            strict: { type: "boolean", description: "Return non-zero metadata when checks fail." },
            focus: { type: "string", enum: ["full", "impact"], description: "Verify scope." },
            full: { type: "boolean", description: "Force full-project verification scope." },
            baselinePath: { type: "string", description: "Optional verify baseline path." },
            updateBaseline: { type: "boolean", description: "Update verify baseline." },
            maxExecuteLikeRatio: { type: "number" },
            maxGhostRatio: { type: "number" },
            maxUnmatchedRoutes: { type: "integer" },
            maxRenderEdges: { type: "integer" },
          },
        },
        fn: async (args: {
          strict?: boolean;
          focus?: string;
          full?: boolean;
          baselinePath?: string;
          updateBaseline?: boolean;
          maxExecuteLikeRatio?: number;
          maxGhostRatio?: number;
          maxUnmatchedRoutes?: number;
          maxRenderEdges?: number;
        }) => {
          const commandArgs = ["verify", "--json"];
          if (args.strict) commandArgs.push("--strict");
          if (args.full) commandArgs.push("--full");
          else if (args.focus === "impact" || args.focus === "full")
            commandArgs.push("--focus", args.focus);
          if (typeof args.baselinePath === "string" && args.baselinePath.trim()) {
            commandArgs.push("--baseline", args.baselinePath.trim());
          }
          if (args.updateBaseline) commandArgs.push("--update-baseline");
          if (Number.isFinite(args.maxExecuteLikeRatio))
            commandArgs.push("--max-execute-like-ratio", String(args.maxExecuteLikeRatio));
          if (Number.isFinite(args.maxGhostRatio))
            commandArgs.push("--max-ghost-ratio", String(args.maxGhostRatio));
          if (Number.isFinite(args.maxUnmatchedRoutes))
            commandArgs.push("--max-unmatched-routes", String(args.maxUnmatchedRoutes));
          if (Number.isFinite(args.maxRenderEdges))
            commandArgs.push("--max-render-edges", String(args.maxRenderEdges));
          return runTriadMindJsonString(triadmind, commandArgs);
        },
      });

      registry.register({
        name: "triadmind_visualize",
        description: "Generate the TriadMind visualizer in-process for the current workspace.",
        parameters: {
          type: "object",
          properties: {
            view: { type: "string", enum: ["architecture", "leaf"] },
            showIsolated: { type: "boolean" },
            fullContractEdges: { type: "boolean" },
          },
        },
        fn: async (args: {
          view?: string;
          showIsolated?: boolean;
          fullContractEdges?: boolean;
        }) => {
          const commandArgs = ["plan", "--no-open"];
          if (args.view) commandArgs.push("--view", args.view);
          if (args.showIsolated) commandArgs.push("--show-isolated");
          if (args.fullContractEdges) commandArgs.push("--full-contract-edges");
          return runTriadMindText(triadmind, commandArgs);
        },
      });

      registerRuntimeGovernanceTools(registry, triadmind);

      registry.register({
        name: "triadmind_rules",
        description: "Inspect and manage in-process TriadMind Dream architecture rules.",
        parameters: {
          type: "object",
          properties: {
            expire: { type: "boolean" },
            deactivate: { type: "string" },
            checkConflicts: { type: "boolean" },
            deduplicate: { type: "boolean" },
            prompt: { type: "boolean" },
          },
        },
        readOnly: true,
        fn: async (args: {
          expire?: boolean;
          deactivate?: string;
          checkConflicts?: boolean;
          deduplicate?: boolean;
          prompt?: boolean;
        }) => {
          const commandArgs = ["rules", "--json"];
          if (args.expire) commandArgs.push("--expire");
          if (typeof args.deactivate === "string" && args.deactivate.trim())
            commandArgs.push("--deactivate", args.deactivate.trim());
          if (args.checkConflicts) commandArgs.push("--check-conflicts");
          if (args.deduplicate) commandArgs.push("--deduplicate");
          if (args.prompt) commandArgs.push("--prompt");
          return args.prompt
            ? runTriadMindText(triadmind, commandArgs)
            : runTriadMindJsonString(triadmind, commandArgs);
        },
      });

      registerMemoryTools(registry, triadmind);
      return registry;
    },
    runInternalText: (args: string[]) => runTriadMindText(triadmind, args),
    runAdvisory: async (cause: string) => {
      if (mode !== "advisory") return null;
      if (advisoryRunning) return null;
      advisoryRunning = true;
      try {
        const syncArgs = ["sync"];
        if (triadmind.advisoryForceSync) syncArgs.push("--force");
        const syncOutput = await runTriadMindText(triadmind, syncArgs);
        const verify = await runTriadMindJson(triadmind, ["verify", "--json", "--strict"]);
        return formatAdvisoryMessage(cause, syncOutput, verify);
      } catch (error) {
        return `TriadMind advisory (${cause}) failed: ${(error as Error).message}`;
      } finally {
        advisoryRunning = false;
      }
    },
  };

  return support;
}

export function registerTriadMindTools(
  registry: ToolRegistry,
  opts: TriadMindSupportOptions,
): TriadMindSupport {
  const support = createTriadMindSupport(opts);
  support.registerTools(registry);
  return support;
}

function registerRuntimeGovernanceTools(
  registry: ToolRegistry,
  triadmind: TriadMindEngineSpec,
): void {
  registry.register({
    name: "triadmind_runtime",
    description:
      "Extract runtime topology internally and optionally generate the runtime visualizer.",
    parameters: {
      type: "object",
      properties: {
        visualize: { type: "boolean" },
        view: { type: "string" },
        includeFrontend: { type: "boolean" },
        includeInfra: { type: "boolean" },
        framework: { type: "string" },
        layout: { type: "string", enum: ["leaf-force", "dagre"] },
        traceDepth: { type: "integer" },
        maxRenderEdges: { type: "integer" },
        hideIsolated: { type: "boolean" },
        theme: { type: "string", enum: ["leaf-like", "runtime-dark"] },
      },
    },
    fn: async (args: {
      visualize?: boolean;
      view?: string;
      includeFrontend?: boolean;
      includeInfra?: boolean;
      framework?: string;
      layout?: string;
      traceDepth?: number;
      maxRenderEdges?: number;
      hideIsolated?: boolean;
      theme?: string;
    }) => {
      const commandArgs = ["runtime", "--json"];
      if (args.visualize) commandArgs.push("--visualize");
      if (typeof args.view === "string" && args.view.trim())
        commandArgs.push("--view", args.view.trim());
      if (args.includeFrontend) commandArgs.push("--include-frontend");
      if (args.includeInfra) commandArgs.push("--include-infra");
      if (typeof args.framework === "string" && args.framework.trim())
        commandArgs.push("--framework", args.framework.trim());
      if (typeof args.layout === "string" && args.layout.trim())
        commandArgs.push("--layout", args.layout.trim());
      if (Number.isFinite(args.traceDepth))
        commandArgs.push("--trace-depth", String(args.traceDepth));
      if (Number.isFinite(args.maxRenderEdges))
        commandArgs.push("--max-render-edges", String(args.maxRenderEdges));
      if (args.hideIsolated) commandArgs.push("--hide-isolated");
      if (typeof args.theme === "string" && args.theme.trim())
        commandArgs.push("--theme", args.theme.trim());
      return runTriadMindJsonString(triadmind, commandArgs);
    },
  });

  registry.register({
    name: "triadmind_coverage",
    description: "Run TriadMind topology coverage checks internally.",
    parameters: { type: "object", properties: {} },
    readOnly: true,
    fn: async () => runTriadMindJsonString(triadmind, ["coverage", "--json"]),
  });

  registry.register({
    name: "triadmind_trend",
    description: "Generate TriadMind architecture drift trend artifacts internally.",
    parameters: {
      type: "object",
      properties: {
        window: { type: "integer" },
        maxEdgeDiff: { type: "integer" },
      },
    },
    fn: async (args: { window?: number; maxEdgeDiff?: number }) => {
      const commandArgs = ["trend", "--json"];
      if (Number.isFinite(args.window)) commandArgs.push("--window", String(args.window));
      if (Number.isFinite(args.maxEdgeDiff))
        commandArgs.push("--max-edge-diff", String(args.maxEdgeDiff));
      return runTriadMindJsonString(triadmind, commandArgs);
    },
  });

  registry.register({
    name: "triadmind_view_map",
    description: "Generate TriadMind cross-view mapping artifacts internally.",
    parameters: {
      type: "object",
      properties: { maxCandidates: { type: "integer" } },
    },
    fn: async (args: { maxCandidates?: number }) => {
      const commandArgs = ["view-map", "--json"];
      if (Number.isFinite(args.maxCandidates))
        commandArgs.push("--max-candidates", String(args.maxCandidates));
      return runTriadMindJsonString(triadmind, commandArgs);
    },
  });

  registry.register({
    name: "triadmind_renormalize",
    description:
      "Detect cyclic dependencies and emit a TriadMind renormalization protocol internally.",
    parameters: {
      type: "object",
      properties: { deep: { type: "boolean" } },
    },
    fn: async (args: { deep?: boolean }) => {
      const commandArgs = ["renormalize", "--json"];
      if (args.deep) commandArgs.push("--deep");
      return runTriadMindJsonString(triadmind, commandArgs);
    },
  });
}
function registerMemoryTools(registry: ToolRegistry, triadmind: TriadMindEngineSpec): void {
  registry.register({
    name: "triadmind_memory_sync",
    description: "Build or refresh in-process TriadMind abstraction memory.",
    parameters: { type: "object", properties: {} },
    fn: async () => runTriadMindJsonString(triadmind, ["memory", "sync", "--json"]),
  });
  registry.register({
    name: "triadmind_memory_search",
    description: "Search TriadMind abstraction memory for reusable patterns.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer" },
        demand: { type: "boolean" },
      },
    },
    fn: async (args: { query?: string; limit?: number; demand?: boolean }) => {
      const commandArgs = ["memory", "search", "--json"];
      if (Number.isFinite(args.limit)) commandArgs.push("--limit", String(args.limit));
      if (args.demand) commandArgs.push("--demand");
      if (typeof args.query === "string" && args.query.trim()) commandArgs.push(args.query.trim());
      return runTriadMindJsonString(triadmind, commandArgs);
    },
  });
  registry.register({
    name: "triadmind_memory_recommend",
    description: "Recommend reusable TriadMind abstractions before creating new architecture.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer" },
        demand: { type: "boolean" },
        focusNode: { type: "string" },
      },
    },
    fn: async (args: { query?: string; limit?: number; demand?: boolean; focusNode?: string }) => {
      const commandArgs = ["memory", "recommend", "--json"];
      if (Number.isFinite(args.limit)) commandArgs.push("--limit", String(args.limit));
      if (args.demand) commandArgs.push("--demand");
      if (typeof args.focusNode === "string" && args.focusNode.trim())
        commandArgs.push("--focus-node", args.focusNode.trim());
      if (typeof args.query === "string" && args.query.trim()) commandArgs.push(args.query.trim());
      return runTriadMindJsonString(triadmind, commandArgs);
    },
  });
  registry.register({
    name: "triadmind_memory_actions",
    description: "Generate TriadMind protocol action candidates from abstraction memory.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer" },
        demand: { type: "boolean" },
        focusNode: { type: "string" },
      },
    },
    fn: async (args: { query?: string; limit?: number; demand?: boolean; focusNode?: string }) => {
      const commandArgs = ["memory", "actions", "--json"];
      if (Number.isFinite(args.limit)) commandArgs.push("--limit", String(args.limit));
      if (args.demand) commandArgs.push("--demand");
      if (typeof args.focusNode === "string" && args.focusNode.trim())
        commandArgs.push("--focus-node", args.focusNode.trim());
      if (typeof args.query === "string" && args.query.trim()) commandArgs.push(args.query.trim());
      return runTriadMindJsonString(triadmind, commandArgs);
    },
  });
  registry.register({
    name: "triadmind_toolkit_sync",
    description:
      "Promote current abstraction memory into the TriadMind project abstraction toolkit.",
    parameters: { type: "object", properties: {} },
    fn: async () => runTriadMindJsonString(triadmind, ["memory", "toolkit", "sync", "--json"]),
  });
  registry.register({
    name: "triadmind_toolkit_search",
    description: "Search the promoted TriadMind project abstraction toolkit.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer" },
        demand: { type: "boolean" },
      },
    },
    fn: async (args: { query?: string; limit?: number; demand?: boolean }) => {
      const commandArgs = ["memory", "toolkit", "search", "--json"];
      if (Number.isFinite(args.limit)) commandArgs.push("--limit", String(args.limit));
      if (args.demand) commandArgs.push("--demand");
      if (typeof args.query === "string" && args.query.trim()) commandArgs.push(args.query.trim());
      return runTriadMindJsonString(triadmind, commandArgs);
    },
  });
  registry.register({
    name: "triadmind_toolkit_export",
    description:
      "Export the TriadMind project abstraction toolkit to markdown and directory artifacts.",
    parameters: { type: "object", properties: {} },
    fn: async () => runTriadMindJsonString(triadmind, ["memory", "toolkit", "export", "--json"]),
  });
  registry.register({
    name: "triadmind_toolkit_path",
    description: "Show TriadMind project abstraction toolkit artifact paths.",
    parameters: { type: "object", properties: {} },
    readOnly: true,
    fn: async () => runTriadMindJsonString(triadmind, ["memory", "toolkit", "path", "--json"]),
  });
  registry.register({
    name: "triadmind_toolkit_whitelist",
    description: "Manage TriadMind project abstraction toolkit taxonomy whitelist.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["show", "path", "add", "remove", "clear"] },
        category: { type: "string" },
        subcategory: { type: "string" },
      },
    },
    fn: async (args: { action?: string; category?: string; subcategory?: string }) => {
      const action = args.action?.trim() || "show";
      const commandArgs = ["memory", "toolkit", "whitelist", action, "--json"];
      if (typeof args.category === "string" && args.category.trim())
        commandArgs.push(args.category.trim());
      if (typeof args.subcategory === "string" && args.subcategory.trim())
        commandArgs.push(args.subcategory.trim());
      return runTriadMindJsonString(triadmind, commandArgs);
    },
  });
}

async function runTriadMindText(
  triadmind: TriadMindEngineSpec,
  toolArgs: string[],
): Promise<string> {
  const result = await triadmind.engine.run(stripJsonFlag(toolArgs), { mode: "text" });
  if (result.exitCode !== 0)
    throw new Error(formatEngineFailure(triadmind.label, toolArgs, result));
  return (
    result.text.trim() ||
    `TriadMind internal operation completed: ${renderInternalOperation(triadmind.label, toolArgs)}`
  );
}

async function runTriadMindJson(
  triadmind: TriadMindEngineSpec,
  toolArgs: string[],
): Promise<TriadMindJsonResult> {
  const result = await triadmind.engine.run(stripJsonFlag(toolArgs), { mode: "json" });
  if (result.data === undefined)
    throw new Error(formatEngineFailure(triadmind.label, toolArgs, result));
  return {
    data: result.data,
    exitCode: result.exitCode,
    text: result.text,
    stderr: result.stderr ?? "",
  };
}

async function runTriadMindJsonString(
  triadmind: TriadMindEngineSpec,
  toolArgs: string[],
): Promise<string> {
  const result = await runTriadMindJson(triadmind, toolArgs);
  return JSON.stringify(envelopeJsonPayload(result), null, 2);
}

function envelopeJsonPayload(result: TriadMindJsonResult): unknown {
  if (isPlainObject(result.data)) {
    const payload: Record<string, unknown> = { ...result.data };
    if (result.exitCode !== 0) payload._triadmindExitCode = result.exitCode;
    if (result.stderr.trim()) payload._triadmindStderr = result.stderr.trim();
    return payload;
  }
  return {
    data: result.data,
    _triadmindExitCode: result.exitCode,
    ...(result.stderr.trim() ? { _triadmindStderr: result.stderr.trim() } : {}),
  };
}

function formatAdvisoryMessage(
  cause: string,
  syncOutput: string,
  verify: TriadMindJsonResult,
): string {
  const report = asObject(verify.data);
  const metrics = asObject(report?.metrics);
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  const failedChecks = checks
    .map((item) => asObject(item))
    .filter((item) => item?.status === "fail")
    .slice(0, 4)
    .map((item) => String(item?.key ?? item?.detail ?? "unknown"));
  const passed = Boolean(report?.passed);
  const nodeCount = numberOrUndefined(
    metrics?.triad_nodes ?? metrics?.totalNodes ?? metrics?.total_nodes,
  );
  const ghostRatio = numberOrUndefined(metrics?.ghost_ratio ?? metrics?.ghostRatio);
  const executeRatio = numberOrUndefined(metrics?.execute_like_ratio ?? metrics?.executeLikeRatio);
  const parts = [
    passed
      ? `TriadMind advisory passed after ${cause}.`
      : `TriadMind advisory found issues after ${cause}.`,
    syncOutput.split(/\r?\n/, 1)[0] ?? syncOutput,
  ];
  if (nodeCount !== undefined) parts.push(`nodes=${nodeCount}`);
  if (ghostRatio !== undefined) parts.push(`ghostRatio=${ghostRatio.toFixed(3)}`);
  if (executeRatio !== undefined) parts.push(`executeLikeRatio=${executeRatio.toFixed(3)}`);
  if (failedChecks.length > 0) parts.push(`failedChecks=${failedChecks.join(", ")}`);
  if (!passed && verify.stderr.trim()) parts.push(`stderr=${verify.stderr.trim()}`);
  return parts.join(" | ");
}

function resolveTriadMindEngine(opts: {
  rootDir: string;
  config: ReasonixConfig;
  engine?: TriadMindEngine;
}): TriadMindEngineSpec {
  const engine =
    opts.engine ?? createInternalTriadMindEngine({ rootDir: opts.rootDir, config: opts.config });
  return {
    label: "reasonix-triadmind",
    rootDir: opts.rootDir,
    source: engine.source,
    advisoryForceSync: engine.advisoryForceSync,
    engine,
  };
}

function normalizeMode(mode: string | undefined): TriadMindMode {
  return mode === "tools_only" || mode === "advisory" ? mode : "disabled";
}

function renderInternalOperation(engineLabel: string, toolArgs: string[]): string {
  return [engineLabel, ...toolArgs].join(" ").trim();
}

function formatEngineFailure(
  engineLabel: string,
  toolArgs: string[],
  result: TriadMindEngineResult,
): string {
  const stderr = (result.stderr ?? "").trim();
  const stdout = result.text.trim();
  const detail = stderr || stdout || `exit ${result.exitCode}`;
  return `${renderInternalOperation(engineLabel, toolArgs)} failed (${result.exitCode}): ${detail}`;
}

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must be a non-empty string`);
  return trimmed;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return isPlainObject(value) ? value : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stripJsonFlag(args: string[]): string[] {
  return args.filter((arg) => arg !== "--json" && arg !== "--no-open");
}
