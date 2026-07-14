import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToolRegistry } from "../src/tools.js";
import {
  type TriadMindEngine,
  type TriadMindEngineResult,
  createInternalTriadMindEngine,
} from "../src/tools/triadmind-engine.js";
import { createTriadMindSupport, registerTriadMindTools } from "../src/tools/triadmind.js";

function fakeEngine(
  handler: (args: string[]) => TriadMindEngineResult | Promise<TriadMindEngineResult>,
  calls: string[][] = [],
): TriadMindEngine {
  return {
    rootDir: "",
    source: "test-internal",
    corePath: "test-core/dist",
    advisoryForceSync: true,
    status: () => ({ engine: "internal", source: "test-internal", corePath: "test-core/dist" }),
    run: async (args) => {
      calls.push(args);
      return handler(args);
    },
  };
}

function jsonResult(data: unknown, exitCode = 0, stderr = ""): TriadMindEngineResult {
  return { data, text: JSON.stringify(data), exitCode, stderr };
}

describe("TriadMind tools", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "reasonix-triadmind-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("stays disabled by default", async () => {
    const registry = new ToolRegistry();
    const support = registerTriadMindTools(registry, { rootDir: root, config: {} });
    expect(support.enabled).toBe(false);
    expect(support.mode).toBe("disabled");
    expect(registry.has("triadmind_status")).toBe(false);
  });

  it("reports in-process internal engine status", async () => {
    const registry = new ToolRegistry();
    registerTriadMindTools(registry, {
      rootDir: root,
      config: { triadmind: { mode: "tools_only" } },
      engine: fakeEngine((args) => jsonResult({ args })),
    });

    const raw = await registry.dispatch("triadmind_status", {});
    const status = JSON.parse(raw);
    expect(status.mode).toBe("tools_only");
    expect(status.engine).toBe("internal");
    expect(status.source).toBe("test-internal");
    expect(status.corePath).toBe("test-core/dist");
    expect(status.command).toBeUndefined();
  });

  it("routes navigate requests to the internal engine", async () => {
    const calls: string[][] = [];
    const registry = new ToolRegistry();
    registerTriadMindTools(registry, {
      rootDir: root,
      config: { triadmind: { mode: "tools_only", command: "ignored-cli" } },
      engine: fakeEngine(
        (args) => jsonResult({ status: "ready", demand: args.at(-1), summary: ["ok"] }),
        calls,
      ),
    });

    const raw = await registry.dispatch("triadmind_navigate", { demand: "add auth" });
    const payload = JSON.parse(raw);
    expect(payload.status).toBe("ready");
    expect(payload.demand).toBe("add auth");
    expect(calls).toEqual([["navigate", "add auth"]]);
  });

  it("routes interrogation requests and review controls to the internal engine", async () => {
    const calls: string[][] = [];
    const registry = new ToolRegistry();
    registerTriadMindTools(registry, {
      rootDir: root,
      config: { triadmind: { mode: "tools_only" } },
      engine: fakeEngine((args) => jsonResult({ status: "ok", args }), calls),
    });

    expect(registry.has("triadmind_interrogate")).toBe(true);
    expect(registry.has("triadmind_interrogate_review")).toBe(true);
    expect(registry.has("triadmind_interrogate_approve")).toBe(true);

    const interrogateRaw = await registry.dispatch("triadmind_interrogate", {
      demand: "add requirement interrogation before topology apply",
      answersFile: "docs/interrogation-answers.sample.json",
      llm: "openai:gpt-5",
      view: "leaf",
      showIsolated: true,
      fullContractEdges: true,
    });
    const interrogatePayload = JSON.parse(interrogateRaw);
    expect(interrogatePayload.status).toBe("ok");

    await registry.dispatch("triadmind_interrogate_review", {});
    await registry.dispatch("triadmind_interrogate_approve", {});

    expect(calls).toEqual([
      [
        "interrogate",
        "add requirement interrogation before topology apply",
        "--answers-file",
        "docs/interrogation-answers.sample.json",
        "--llm",
        "openai:gpt-5",
        "--view",
        "leaf",
        "--show-isolated",
        "--full-contract-edges",
      ],
      ["interrogate-review"],
      ["interrogate-approve"],
    ]);
  });

  it("preserves non-zero verify exits when JSON was still produced", async () => {
    const registry = new ToolRegistry();
    registerTriadMindTools(registry, {
      rootDir: root,
      config: { triadmind: { mode: "tools_only" } },
      engine: fakeEngine(() =>
        jsonResult(
          {
            passed: false,
            checks: [{ key: "ghost_ratio", status: "fail" }],
            metrics: { ghost_ratio: 0.42 },
          },
          1,
          "strict verify failed",
        ),
      ),
    });

    const raw = await registry.dispatch("triadmind_verify", { strict: true, focus: "impact" });
    const payload = JSON.parse(raw);
    expect(payload.passed).toBe(false);
    expect(payload._triadmindExitCode).toBe(1);
    expect(payload._triadmindStderr).toContain("strict verify failed");
  });

  it("registers visualize and toolkit management commands", async () => {
    const calls: string[][] = [];
    const registry = new ToolRegistry();
    registerTriadMindTools(registry, {
      rootDir: root,
      config: { triadmind: { mode: "tools_only" } },
      engine: fakeEngine(() => ({ exitCode: 0, text: "ok" }), calls),
    });

    expect(registry.has("triadmind_visualize")).toBe(true);
    expect(registry.has("triadmind_memory_sync")).toBe(true);
    expect(registry.has("triadmind_toolkit_sync")).toBe(true);
    expect(registry.has("triadmind_toolkit_export")).toBe(true);

    await registry.dispatch("triadmind_visualize", { view: "leaf", showIsolated: true });
    await registry.dispatch("triadmind_toolkit_export", {});

    expect(calls).toEqual([
      ["plan", "--view", "leaf", "--show-isolated"],
      ["memory", "toolkit", "export"],
    ]);
  });

  it("creates a missing draft template before generating the internal visualizer", async () => {
    const triadDir = join(root, ".triadmind");
    mkdirSync(triadDir, { recursive: true });
    writeFileSync(
      join(triadDir, "triad-map.json"),
      JSON.stringify([
        {
          nodeId: "Sample.module_pipeline",
          category: "core",
          sourcePath: "src/sample.ts",
          fission: {
            problem: "Workflow Capability: sample",
            demand: ["input"],
            answer: ["output"],
            evidence: { promotionReasons: ["business_semantic"] },
          },
        },
      ]),
      "utf8",
    );

    const engine = createInternalTriadMindEngine({
      rootDir: root,
      config: { triadmind: { mode: "tools_only" } },
    });
    const result = await engine.run(["plan", "--view", "leaf"]);

    expect(result.exitCode).toBe(0);
    expect(result.text).toContain("draft template created");
    expect(existsSync(join(triadDir, "draft-protocol.json"))).toBe(true);
    expect(existsSync(join(triadDir, "visualizer.html"))).toBe(true);
  });

  it("reports the correct command name when interrogate demand is missing", async () => {
    const engine = createInternalTriadMindEngine({
      rootDir: root,
      config: { triadmind: { mode: "tools_only" } },
    });

    await expect(engine.run(["interrogate"])).rejects.toThrow(
      "TriadMind interrogate demand is required.",
    );
  });

  it("registers internal runtime governance and rule management tools", async () => {
    const calls: string[][] = [];
    const registry = new ToolRegistry();
    registerTriadMindTools(registry, {
      rootDir: root,
      config: { triadmind: { mode: "tools_only" } },
      engine: fakeEngine((args) => jsonResult({ args, status: "ok" }), calls),
    });

    expect(registry.has("triadmind_watch")).toBe(true);
    expect(registry.has("triadmind_runtime")).toBe(true);
    expect(registry.has("triadmind_coverage")).toBe(true);
    expect(registry.has("triadmind_trend")).toBe(true);
    expect(registry.has("triadmind_view_map")).toBe(true);
    expect(registry.has("triadmind_renormalize")).toBe(true);
    expect(registry.has("triadmind_rules")).toBe(true);
    expect(registry.has("triadmind_dream_daemon")).toBe(true);
    expect(registry.has("triadmind_toolkit_path")).toBe(true);
    expect(registry.has("triadmind_toolkit_whitelist")).toBe(true);

    await registry.dispatch("triadmind_watch", { action: "status" });
    await registry.dispatch("triadmind_runtime", { visualize: true, view: "full" });
    await registry.dispatch("triadmind_coverage", {});
    await registry.dispatch("triadmind_trend", { window: 4, maxEdgeDiff: 9 });
    await registry.dispatch("triadmind_view_map", { maxCandidates: 2 });
    await registry.dispatch("triadmind_renormalize", { deep: true });
    await registry.dispatch("triadmind_rules", { checkConflicts: true });
    await registry.dispatch("triadmind_dream_daemon", { action: "status" });
    await registry.dispatch("triadmind_toolkit_path", {});
    await registry.dispatch("triadmind_toolkit_whitelist", {
      action: "add",
      category: "core",
      subcategory: "protocol",
    });

    expect(calls).toEqual([
      ["watch", "status"],
      ["runtime", "--visualize", "--view", "full"],
      ["coverage"],
      ["trend", "--window", "4", "--max-edge-diff", "9"],
      ["view-map", "--max-candidates", "2"],
      ["renormalize", "--deep"],
      ["rules", "--check-conflicts"],
      ["dream", "daemon", "status"],
      ["memory", "toolkit", "path"],
      ["memory", "toolkit", "whitelist", "add", "core", "protocol"],
    ]);
  });

  it("keeps explicit memory/toolkit queries ahead of demand fallback", async () => {
    const calls: string[][] = [];
    const registry = new ToolRegistry();
    registerTriadMindTools(registry, {
      rootDir: root,
      config: { triadmind: { mode: "tools_only" } },
      engine: fakeEngine((args) => jsonResult({ args }), calls),
    });

    await registry.dispatch("triadmind_memory_search", { query: "auth cache", demand: true });
    await registry.dispatch("triadmind_memory_recommend", {
      query: "billing pipeline",
      demand: true,
      focusNode: "Billing.Node",
    });
    await registry.dispatch("triadmind_memory_actions", { query: "checkout", demand: true });
    await registry.dispatch("triadmind_toolkit_search", { query: "ingestion", demand: true });
    await registry.dispatch("triadmind_memory_search", { demand: true });

    expect(calls).toEqual([
      ["memory", "search", "auth cache"],
      ["memory", "recommend", "--focus-node", "Billing.Node", "billing pipeline"],
      ["memory", "actions", "checkout"],
      ["memory", "toolkit", "search", "ingestion"],
      ["memory", "search", "--demand"],
    ]);
  });

  it("marks mutating TriadMind rules and coverage calls accurately", async () => {
    const registry = new ToolRegistry();
    registerTriadMindTools(registry, {
      rootDir: root,
      config: { triadmind: { mode: "tools_only" } },
      engine: fakeEngine((args) => jsonResult({ args })),
    });

    const rules = registry.get("triadmind_rules");
    expect(rules?.readOnly).toBeUndefined();
    expect(rules?.readOnlyCheck?.({ checkConflicts: true })).toBe(true);
    expect(rules?.readOnlyCheck?.({ expire: true })).toBe(false);
    expect(rules?.readOnlyCheck?.({ deactivate: "rule-1" })).toBe(false);
    expect(rules?.readOnlyCheck?.({ deduplicate: true })).toBe(false);
    expect(registry.get("triadmind_coverage")?.readOnly).toBeUndefined();
  });

  it("applies triadmind.timeoutMs to tool invocations", async () => {
    const registry = new ToolRegistry();
    registerTriadMindTools(registry, {
      rootDir: root,
      config: { triadmind: { mode: "tools_only", timeoutMs: 5 } },
      engine: fakeEngine(() => new Promise<TriadMindEngineResult>(() => {})),
    });

    const raw = await registry.dispatch("triadmind_verify", {});
    expect(JSON.parse(raw).error).toContain("timed out after 5ms");
  });

  it("runs advisory sync + verify in advisory mode", async () => {
    const calls: string[][] = [];
    const support = createTriadMindSupport({
      rootDir: root,
      config: { triadmind: { mode: "advisory", advisoryForceSync: true } },
      engine: fakeEngine((args) => {
        if (args.includes("verify")) {
          return jsonResult(
            {
              passed: false,
              metrics: { triad_nodes: 12, ghost_ratio: 0.25, execute_like_ratio: 0.08 },
              checks: [
                { key: "ghost_ratio", status: "fail" },
                { key: "execute_like_ratio", status: "pass" },
              ],
            },
            1,
            "strict verify failed",
          );
        }
        return { exitCode: 0, text: "TriadMind sync completed internally." };
      }, calls),
    });

    const message = await support.runAdvisory("review-apply");
    expect(message).toContain("TriadMind advisory found issues after review-apply.");
    expect(message).toContain("ghostRatio=0.250");
    expect(message).toContain("failedChecks=ghost_ratio");
    expect(calls).toEqual([
      ["sync", "--force"],
      ["verify", "--strict"],
    ]);
  });

  it("silently skips advisory when the workspace is not a valid TriadMind project root", async () => {
    const calls: string[][] = [];
    const support = createTriadMindSupport({
      rootDir: root,
      config: { triadmind: { mode: "advisory" } },
      engine: fakeEngine(() => {
        throw new Error("目标目录下缺少 tsconfig.json：D:\\TraidMind\\tsconfig.json");
      }, calls),
    });

    const message = await support.runAdvisory("tool-auto");
    expect(message).toBeNull();
    expect(calls).toEqual([["sync", "--force"]]);
  });
});
