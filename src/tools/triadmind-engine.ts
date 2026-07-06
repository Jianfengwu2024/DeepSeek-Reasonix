import {
  type FSWatcher,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  watch,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReasonixConfig } from "../config.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

export type TriadMindRunMode = "text" | "json";

export interface TriadMindEngineRunOptions {
  mode?: TriadMindRunMode;
}

export interface TriadMindEngineResult {
  data?: unknown;
  text: string;
  exitCode: number;
  stderr?: string;
}

export interface TriadMindEngine {
  rootDir: string;
  source: string;
  corePath: string;
  advisoryForceSync: boolean;
  status: () => Record<string, unknown>;
  run: (args: string[], options?: TriadMindEngineRunOptions) => Promise<TriadMindEngineResult>;
}

interface InternalTriadMindTask {
  key: string;
  type: "watch" | "dream-daemon";
  rootDir: string;
  startedAt: string;
  ticks: number;
  lastStatus?: string;
  lastReason?: string;
  lastError?: string;
  stop: () => void;
}

const internalTasks = new Map<string, InternalTriadMindTask>();

interface CoreModules {
  workspace: any;
  workflow: any;
  cliSupport: any;
  triadization: any;
  interrogation: any;
  runtimeExtract: any;
  runtimeWriter: any;
  viewMap: any;
  config: any;
  analyzer: any;
  analyzerOptionsSupport: any;
  artifactReaders: any;
  runtimeFilter: any;
  runtimeVisualizer: any;
  coverage: any;
  trend: any;
  dreamScheduler: any;
  dreamDaemon: any;
  dreamFeedbackSupport: any;
  dreamFeedbackValidator: any;
  dreamRuleLedger: any;
  stableArchitectureAnchorSupport: any;
  navigator: any;
  dream: any;
  dreamVisualizer: any;
  verify: any;
  govern: any;
  visualizer: any;
  abstractionMemory: any;
  projectAbsToolkit: any;
}

export function createInternalTriadMindEngine(opts: {
  rootDir: string;
  config?: ReasonixConfig;
}): TriadMindEngine {
  const rootDir = resolve(opts.rootDir);
  const resolved = resolveCorePath(rootDir, opts.config?.triadmind?.corePath);
  const modules = loadCoreModules(resolved.corePath);
  const paths = modules.workspace.getWorkspacePaths(rootDir);
  const advisoryForceSync = opts.config?.triadmind?.advisoryForceSync === true;

  return {
    rootDir,
    source: resolved.source,
    corePath: resolved.corePath,
    advisoryForceSync,
    status: () => ({
      engine: "internal",
      source: resolved.source,
      corePath: resolved.corePath,
      rootDir,
      advisoryForceSync,
    }),
    run: async (args, options = {}) => {
      const result = await runInternalCommand(modules, paths, rootDir, args);
      if (options.mode === "json" && result.data === undefined) {
        return { ...result, data: parseJsonIfPossible(result.text) };
      }
      return result;
    },
  };
}

async function runInternalCommand(
  core: CoreModules,
  paths: any,
  rootDir: string,
  args: string[],
): Promise<TriadMindEngineResult> {
  const command = String(args[0] ?? "status").toLowerCase();
  const rest = args.slice(1);
  switch (command) {
    case "status":
      return jsonResult({ status: "ready", rootDir, triadDir: paths.triadDir });
    case "sync":
      return runSync(core, paths, rest);
    case "check":
      return runCheck(core, paths, rest);
    case "ci":
      return runCi(core, paths, rest);
    case "watch":
      return runWatch(core, paths, rest);
    case "runtime":
      return runRuntime(core, paths, rest);
    case "coverage":
      return runCoverage(core, paths);
    case "trend":
      return runTrend(core, paths, rest);
    case "view-map":
      return runViewMap(core, paths, rest);
    case "renormalize":
      return runRenormalize(core, paths, rest);
    case "converge":
      return runConverge(paths);
    case "navigate":
      return runNavigate(core, paths, rest);
    case "interrogate":
      return runInterrogate(core, paths, rest);
    case "interrogate-review":
      return runInterrogateReview(core, paths);
    case "interrogate-approve":
      return runInterrogateApprove(core, paths);
    case "dream":
      return runDream(core, paths, rest);
    case "verify":
      return runVerify(core, paths, rest);
    case "govern":
      return runGovern(core, paths, rest);
    case "plan":
    case "visualize":
      return runVisualize(core, paths, rest);
    case "memory":
      return runMemory(core, paths, rest);
    case "rules":
      return runRules(core, paths, rest);
    default:
      throw new Error(
        `Unsupported internal TriadMind command: ${command}. Reasonix no longer shells out to external triadmind CLI.`,
      );
  }
}

async function runSync(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  const force = hasFlag(args, "--force");
  const scanMode = readOption(args, "--scan-mode");
  const sync = core.cliSupport.syncProjectTopology(paths, force, scanMode);
  core.triadization.writeTriadizationArtifacts(paths);
  const runtimeMap = await core.runtimeExtract.extractRuntimeTopology(paths.projectRoot, {});
  core.runtimeWriter.writeRuntimeMapArtifacts(
    runtimeMap,
    paths.runtimeMapFile,
    paths.runtimeDiagnosticsFile,
  );
  core.viewMap.writeViewMapArtifacts(paths);
  return textResult(
    [
      "TriadMind sync completed internally.",
      `changed=${sync.changed}, files=${sync.fileCount}`,
      `triadMap=${paths.mapFile}`,
      `runtimeMap=${paths.runtimeMapFile}`,
    ].join("\n"),
  );
}

async function runCheck(core: CoreModules, paths: any, args: string[]) {
  await runSync(core, paths, ["--force"]);
  const report = core.verify.runTopologyVerify(paths, {
    strict: true,
    focus: readScope(args, "--focus") ?? "full",
  });
  return jsonResult(report, report.passed ? 0 : 1);
}

async function runCi(core: CoreModules, paths: any, args: string[]) {
  await runSync(core, paths, ["--force"]);
  const scope = readScope(args, "--scope");
  const verify = core.verify.runTopologyVerify(paths, { strict: true, focus: scope ?? "full" });
  const govern = core.govern.runGovern(paths, { mode: "ci", scope });
  const exitCode = !verify.passed || govern.exitCode !== 0 ? govern.exitCode || 1 : 0;
  return jsonResult({ verify, govern: govern.report }, exitCode);
}

function runWatch(core: CoreModules, paths: any, args: string[]) {
  const sub = args[0] && !args[0].startsWith("--") ? args[0] : "start";
  const key = taskKey(paths, "watch");
  if (sub === "status") return jsonResult(getInternalTaskStatus(key, "watch", paths));
  if (sub === "stop") return jsonResult(stopInternalTask(key, "watch", paths));
  if (sub !== "start") throw new Error(`Unsupported internal TriadMind watch subcommand: ${sub}`);
  const existing = internalTasks.get(key);
  if (existing) return jsonResult({ status: "already_running", task: serializeTask(existing) });

  core.workflow.ensureTriadSpec(paths);
  let debounce: NodeJS.Timeout | undefined;
  const task: InternalTriadMindTask = {
    key,
    type: "watch",
    rootDir: paths.projectRoot,
    startedAt: new Date().toISOString(),
    ticks: 0,
    stop: () => {
      if (debounce) clearTimeout(debounce);
      watcher.close();
      internalTasks.delete(key);
    },
  };
  const runOnce = () => {
    try {
      const sync = core.cliSupport.syncProjectTopology(paths, false);
      core.triadization.writeTriadizationArtifacts(paths);
      core.viewMap.writeViewMapArtifacts(paths);
      task.ticks += 1;
      task.lastStatus = sync.changed ? "synced" : "unchanged";
      task.lastReason = `files=${sync.fileCount}`;
      task.lastError = undefined;
    } catch (error) {
      task.ticks += 1;
      task.lastStatus = "error";
      task.lastError = (error as Error).message;
    }
  };
  const watcher: FSWatcher = watch(paths.projectRoot, { recursive: true }, (_event, filename) => {
    if (!filename || !isLikelySourcePath(String(filename))) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(runOnce, 250);
  });
  runOnce();
  internalTasks.set(key, task);
  return jsonResult({ status: "started", task: serializeTask(task) });
}
async function runRuntime(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  const config = core.config.loadTriadConfig(paths);
  if (config.runtime && config.runtime.enabled === false) {
    return jsonResult(
      { status: "disabled", message: "Runtime topology extraction is disabled." },
      1,
    );
  }
  const runtimeMap = await core.runtimeExtract.extractRuntimeTopology(paths.projectRoot, {
    view: core.runtimeFilter.normalizeRuntimeView(
      readOption(args, "--view"),
      config.runtime?.defaultView,
    ),
    includeFrontend: hasFlag(args, "--include-frontend") || config.runtime?.includeFrontend,
    includeInfra: hasFlag(args, "--include-infra") || config.runtime?.includeInfra,
    frameworkHint: readOption(args, "--framework"),
  });
  core.runtimeWriter.writeRuntimeMapArtifacts(
    runtimeMap,
    paths.runtimeMapFile,
    paths.runtimeDiagnosticsFile,
  );
  const viewMap = core.viewMap.writeViewMapArtifacts(paths);
  if (hasFlag(args, "--visualize")) {
    core.runtimeVisualizer.generateRuntimeDashboard(
      paths.runtimeMapFile,
      paths.runtimeVisualizerFile,
      {
        interactive: !hasFlag(args, "--no-interactive"),
        layout: readOption(args, "--layout") === "dagre" ? "dagre" : "leaf-force",
        traceDepth: readNumberOption(args, "--trace-depth") ?? 2,
        maxRenderEdges: readNumberOption(args, "--max-render-edges"),
        hideIsolated: hasFlag(args, "--hide-isolated"),
        theme: readOption(args, "--theme") === "runtime-dark" ? "runtime-dark" : "leaf-like",
      },
    );
  }
  return jsonResult({
    status: "ok",
    runtimeMapFile: paths.runtimeMapFile,
    runtimeDiagnosticsFile: paths.runtimeDiagnosticsFile,
    runtimeVisualizerFile: hasFlag(args, "--visualize") ? paths.runtimeVisualizerFile : undefined,
    runtimeMap,
    viewMap,
  });
}

function runCoverage(core: CoreModules, paths: any) {
  core.workflow.ensureTriadSpec(paths);
  return jsonResult(core.coverage.runCoverage(paths));
}

function runTrend(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  const result = core.trend.generateTrendArtifacts(paths, {
    historyWindow: readNumberOption(args, "--window") ?? 26,
    maxEdgeDiff: readNumberOption(args, "--max-edge-diff") ?? 50,
  });
  return jsonResult({
    trendFile: paths.trendFile,
    trendReportFile: paths.trendReportFile,
    report: result.report,
  });
}

function runViewMap(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  const viewMap = core.viewMap.writeViewMapArtifacts(paths, {
    maxCandidatesPerRuntimeNode: readNumberOption(args, "--max-candidates") ?? 3,
  });
  return jsonResult(viewMap);
}

function runRenormalize(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  if (hasFlag(args, "--deep")) return runConverge(paths);
  if (!existsSync(paths.mapFile)) core.cliSupport.syncProjectTopology(paths, true);
  const config = core.config.loadTriadConfig(paths);
  const map = core.cliSupport.readCurrentTriadMap(paths);
  const analyzerOptions = core.analyzerOptionsSupport.resolveAnalyzerOptionsFromConfig(config);
  const cycles = core.analyzer.detectCycles(map, analyzerOptions);
  const protocolFile = join(paths.triadDir, "renormalize-protocol.json");
  if (cycles.length === 0) {
    if (existsSync(protocolFile)) unlinkSync(protocolFile);
    return jsonResult({ status: "ok", cycles: [], protocolFile: undefined });
  }
  const protocol = core.analyzer.generateRenormalizeProtocol(map, cycles, analyzerOptions);
  writeJson(protocolFile, protocol);
  return jsonResult({ status: "cycles_detected", cycles, protocolFile, protocol }, 1);
}

function runConverge(paths: any) {
  const todoFile = join(paths.triadDir, "converge-todo.md");
  mkdirSync(paths.triadDir, { recursive: true });
  writeFileSync(
    todoFile,
    [
      "# TriadMind Converge TODO",
      "",
      "Status: reserved capability. Recursive high-fanout convergence is intentionally not executed inside Reasonix.",
      "",
      `Project root: ${paths.projectRoot}`,
    ].join("\n"),
    "utf8",
  );
  return jsonResult({ status: "reserved", todoFile });
}
async function runNavigate(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  const demand = readDemand(args);
  const result = await core.navigator.runNavigator(paths, demand, {
    protocolPath: readOption(args, "--protocol"),
    llm: readOption(args, "--llm"),
    dashboardOptions: {
      defaultView: readOption(args, "--view") === "leaf" ? "leaf" : "architecture",
      showIsolatedCapabilities: hasFlag(args, "--show-isolated"),
    },
  });
  return jsonResult(result);
}

async function runInterrogate(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  if (!existsSync(paths.mapFile)) core.cliSupport.syncProjectTopology(paths, false);
  const demand = readDemand(args);
  const result = await core.interrogation.runInterrogation(paths, demand, {
    answersFile: readOption(args, "--answers-file"),
    llm: readOption(args, "--llm"),
    dashboardOptions: {
      defaultView: readOption(args, "--view") === "leaf" ? "leaf" : "architecture",
      showIsolatedCapabilities: hasFlag(args, "--show-isolated"),
      fullContractEdges: hasFlag(args, "--full-contract-edges"),
    },
  });
  return jsonResult(result);
}

function runInterrogateReview(core: CoreModules, paths: any) {
  core.workflow.ensureTriadSpec(paths);
  const state = core.interrogation.reviewInterrogation(paths);
  if (!state) {
    return jsonResult(
      {
        status: "missing",
        message: "No interrogation state found.",
        stateFile: paths.interrogationStateFile,
      },
      1,
    );
  }
  return jsonResult(state);
}

function runInterrogateApprove(core: CoreModules, paths: any) {
  core.workflow.ensureTriadSpec(paths);
  return jsonResult(core.interrogation.approveInterrogation(paths));
}

async function runDream(core: CoreModules, paths: any, args: string[]) {
  const sub = args[0] && !args[0].startsWith("--") ? args[0] : "run";
  const rest = args.slice(args[0] && !args[0].startsWith("--") ? 1 : 0);
  if (sub === "review") {
    return jsonResult(core.dream.loadLatestDreamReport(paths) ?? { status: "missing" });
  }
  if (sub === "auto") {
    return jsonResult(
      await core.dreamScheduler.tickDreamAutoRun(paths, {
        trigger: readOption(rest, "--trigger") ?? "manual",
        force: hasFlag(rest, "--force"),
        impactThreshold: readNumberOption(rest, "--impact-threshold"),
      }),
    );
  }
  if (sub === "feedback") return runDreamFeedback(core, paths, rest);
  if (sub === "rules") return runRules(core, paths, rest);
  if (sub === "stable-anchor") return runStableAnchor(core, paths, rest);
  if (sub === "visualize") {
    const report = core.dream.loadLatestDreamReport(paths);
    if (!report) return jsonResult({ status: "missing" }, 1);
    core.dreamVisualizer.generateDreamDashboard(report, paths.dreamVisualizerFile, {
      theme: readOption(rest, "--theme") === "runtime-dark" ? "runtime-dark" : "leaf-like",
    });
    return jsonResult({ status: "ok", dreamVisualizerFile: paths.dreamVisualizerFile, report });
  }
  if (sub === "daemon") return runDreamDaemon(core, paths, rest);
  if (sub !== "run" && sub !== "fast") {
    throw new Error(`Unsupported internal TriadMind dream subcommand: ${sub}`);
  }
  const result = await core.dream.runDreamAnalysis(paths, {
    mode: readOption(rest, "--mode") === "idle" ? "idle" : "manual",
    force: hasFlag(rest, "--force") || sub === "fast",
    maxProposals: readNumberOption(rest, "--max-proposals"),
    minConfidence: readNumberOption(rest, "--min-confidence"),
    impactThreshold: sub === "fast" ? 3 : readNumberOption(rest, "--impact-threshold"),
  });
  if (hasFlag(rest, "--visualize")) {
    core.dreamVisualizer.generateDreamDashboard(result.report, paths.dreamVisualizerFile, {
      theme: readOption(rest, "--theme") === "runtime-dark" ? "runtime-dark" : "leaf-like",
    });
  }
  return jsonResult(result.report);
}

function runDreamFeedback(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  const sub = args[0] && !args[0].startsWith("--") ? args[0] : "review";
  const rest = args.slice(args[0] && !args[0].startsWith("--") ? 1 : 0);
  if (sub === "review") {
    return jsonResult(core.dreamFeedbackSupport.loadDreamFeedbackLedger(paths).ledger);
  }
  if (sub === "rules") return runRules(core, paths, rest);
  if (sub === "reject") {
    const proposalId = readOption(rest, "--proposal");
    const reason = readOption(rest, "--reason");
    if (!proposalId || !reason)
      throw new Error("dream feedback reject requires --proposal and --reason.");
    const latest = core.dream.loadLatestDreamReport(paths);
    const proposals = Array.isArray(latest?.proposals) ? latest.proposals : [];
    const proposal = proposals.find(
      (item: any) => item?.id === proposalId || item?.proposalId === proposalId,
    );
    if (!proposal) throw new Error(`Dream proposal not found: ${proposalId}`);
    const result = core.dreamFeedbackSupport.recordDreamProposalRejection(paths, {
      proposal,
      reason,
      reasonCode: readOption(rest, "--reason-code"),
      reviewer: readOption(rest, "--reviewer") ?? "reasonix",
      reviewerRole:
        core.dreamFeedbackSupport.normalizeDreamFeedbackReviewerRole(
          readOption(rest, "--reviewer-role"),
        ) ?? "operator",
      isStableAnchor: hasFlag(rest, "--stable-anchor"),
    });
    if (hasFlag(rest, "--stable-anchor")) {
      const anchor = core.dreamFeedbackSupport.deriveStableArchitectureAnchorFromProposal(proposal);
      if (anchor) core.config.registerMatureStableArchitectureAnchor(paths, anchor);
    }
    return jsonResult(result);
  }
  throw new Error(`Unsupported internal TriadMind dream feedback subcommand: ${sub}`);
}

function runRules(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  if (hasFlag(args, "--expire")) {
    return jsonResult({ expiredCount: core.dreamRuleLedger.expireStaleRules(paths) });
  }
  const deactivate = readOption(args, "--deactivate");
  if (deactivate) {
    return jsonResult({
      deactivated: core.dreamRuleLedger.deactivateDreamRule(paths, deactivate),
      ruleId: deactivate,
    });
  }
  if (hasFlag(args, "--deduplicate")) {
    return jsonResult(core.dreamRuleLedger.deduplicateRules(paths));
  }
  if (hasFlag(args, "--check-conflicts")) {
    const loaded = core.dreamRuleLedger.loadDreamRuleLedger(paths);
    return jsonResult(core.dreamRuleLedger.findConflictingRules(loaded.ledger));
  }
  if (hasFlag(args, "--prompt")) {
    const loaded = core.dreamRuleLedger.loadDreamRuleLedger(paths);
    return textResult(core.dreamRuleLedger.formatActiveRulesPrompt(loaded.ledger));
  }
  return jsonResult(core.dreamRuleLedger.loadDreamRuleLedger(paths).ledger);
}

function runStableAnchor(core: CoreModules, paths: any, args: string[]) {
  core.workflow.ensureTriadSpec(paths);
  const sub = args[0] && !args[0].startsWith("--") ? args[0] : "review";
  const rest = args.slice(args[0] && !args[0].startsWith("--") ? 1 : 0);
  if (sub === "add") {
    const nodeId = readOption(rest, "--node");
    const sourcePath = readOption(rest, "--source-path");
    if (!nodeId && !sourcePath)
      throw new Error("dream stable-anchor add requires --node or --source-path.");
    return jsonResult(
      core.config.registerMatureStableArchitectureAnchor(paths, { nodeId, sourcePath }),
    );
  }
  if (sub === "review") {
    const config = core.config.loadTriadConfig(paths);
    return jsonResult(
      core.stableArchitectureAnchorSupport.resolveEffectiveStableAnchors(
        paths,
        config.topologyRisk,
      ),
    );
  }
  throw new Error(`Unsupported internal TriadMind stable-anchor subcommand: ${sub}`);
}

function runDreamDaemon(core: CoreModules, paths: any, args: string[]) {
  const sub = args[0] ?? "status";
  const rest = args.slice(args[0] && !args[0].startsWith("--") ? 1 : 0);
  const key = taskKey(paths, "dream-daemon");
  if (sub === "status") {
    return jsonResult({
      internal: getInternalTaskStatus(key, "dream-daemon", paths),
      artifact: core.dreamDaemon.getDreamDaemonStatus(paths),
    });
  }
  if (sub === "stop") return jsonResult(stopInternalTask(key, "dream-daemon", paths));
  if (sub === "daemon-loop") {
    return jsonResult(
      { status: "unsupported", message: "daemon-loop is internal to the Reasonix task runner." },
      1,
    );
  }
  if (sub !== "start")
    throw new Error(`Unsupported internal TriadMind dream daemon subcommand: ${sub}`);
  const existing = internalTasks.get(key);
  if (existing) return jsonResult({ status: "already_running", task: serializeTask(existing) });

  core.workflow.ensureTriadSpec(paths);
  const intervalSeconds = Math.max(1, readNumberOption(rest, "--interval-seconds") ?? 180);
  const maxTicks = Math.max(0, readNumberOption(rest, "--max-ticks") ?? 0);
  const task: InternalTriadMindTask = {
    key,
    type: "dream-daemon",
    rootDir: paths.projectRoot,
    startedAt: new Date().toISOString(),
    ticks: 0,
    stop: () => {
      clearInterval(timer);
      internalTasks.delete(key);
      writeDreamDaemonTaskState(paths, task, false);
    },
  };
  const tick = () => {
    void core.dreamScheduler
      .tickDreamAutoRun(paths, { trigger: "daemon" })
      .then((result: any) => {
        task.ticks += 1;
        task.lastStatus = result.status;
        task.lastReason = result.reason;
        task.lastError = result.error;
        writeDreamDaemonTaskState(paths, task, true);
        if (maxTicks > 0 && task.ticks >= maxTicks) task.stop();
      })
      .catch((error: Error) => {
        task.ticks += 1;
        task.lastStatus = "error";
        task.lastError = error.message;
        writeDreamDaemonTaskState(paths, task, true);
        if (maxTicks > 0 && task.ticks >= maxTicks) task.stop();
      });
  };
  const timer = setInterval(tick, intervalSeconds * 1000);
  timer.unref?.();
  internalTasks.set(key, task);
  writeDreamDaemonTaskState(paths, task, true);
  tick();
  return jsonResult({ status: "started", intervalSeconds, maxTicks, task: serializeTask(task) });
}
function runVerify(core: CoreModules, paths: any, args: string[]) {
  const report = core.verify.runTopologyVerify(paths, {
    strict: hasFlag(args, "--strict"),
    focus: hasFlag(args, "--full") ? "full" : (readScope(args, "--focus") ?? "full"),
    baselinePath: readOption(args, "--baseline"),
    updateBaseline: hasFlag(args, "--update-baseline"),
    maxExecuteLikeRatio: readNumberOption(args, "--max-execute-like-ratio"),
    maxGhostRatio: readNumberOption(args, "--max-ghost-ratio"),
    maxUnmatchedRouteCount: readNumberOption(args, "--max-unmatched-routes"),
    maxRenderEdges: readNumberOption(args, "--max-render-edges"),
  });
  return jsonResult(report, report.passed || !hasFlag(args, "--strict") ? 0 : 1);
}

function runGovern(core: CoreModules, paths: any, args: string[]) {
  const sub = args[0] && !args[0].startsWith("--") ? args[0] : "check";
  if (sub !== "check" && sub !== "ci" && sub !== "fix") {
    throw new Error(`Unsupported internal TriadMind govern subcommand: ${sub}`);
  }
  const rest = args.slice(args[0] && !args[0].startsWith("--") ? 1 : 0);
  const result = core.govern.runGovern(paths, {
    mode: sub,
    policyPath: readOption(rest, "--policy"),
    llm: readOption(rest, "--llm"),
    maxIterations: readNumberOption(rest, "--max-iterations"),
    dryRun: hasFlag(rest, "--dry-run"),
    scope: readScope(rest, "--scope"),
  });
  return jsonResult(result.report, result.exitCode);
}

function runVisualize(core: CoreModules, paths: any, args: string[]) {
  core.visualizer.generateDashboard(paths.mapFile, paths.draftFile, paths.visualizerFile, {
    defaultView: readOption(args, "--view") === "leaf" ? "leaf" : "architecture",
    showIsolatedCapabilities: hasFlag(args, "--show-isolated"),
    fullContractEdges: hasFlag(args, "--full-contract-edges"),
  });
  return textResult(`TriadMind visualizer written internally: ${paths.visualizerFile}`);
}

function runMemory(core: CoreModules, paths: any, args: string[]) {
  const sub = args[0] ?? "sync";
  if (sub === "sync") {
    return jsonResult(core.abstractionMemory.syncAbstractionMemory(paths));
  }
  if (sub === "search") {
    const query = readQuery(args.slice(1), paths);
    const artifact = core.abstractionMemory.ensureAbstractionMemory(paths, { autoSync: true });
    return jsonResult({
      query,
      results: core.abstractionMemory.searchAbstractionMemory(
        artifact,
        query,
        readNumberOption(args, "--limit"),
      ),
    });
  }
  if (sub === "recommend") {
    const query = readQuery(args.slice(1), paths);
    const artifact = core.abstractionMemory.ensureAbstractionMemory(paths, { autoSync: true });
    return jsonResult({
      query,
      recommendations: core.abstractionMemory.recommendAbstractionMemory(artifact, {
        query,
        focusNodeId: readOption(args, "--focus-node"),
        limit: readNumberOption(args, "--limit"),
      }),
    });
  }
  if (sub === "actions") {
    const query = readQuery(args.slice(1), paths);
    return jsonResult({
      query,
      candidates: core.abstractionMemory.buildAbstractionProtocolActionCandidates(paths, {
        demand: query,
        focusNodeId: readOption(args, "--focus-node"),
        limit: readNumberOption(args, "--limit"),
      }),
    });
  }
  if (sub === "toolkit") return runToolkit(core, paths, args.slice(1));
  throw new Error(`Unsupported internal TriadMind memory subcommand: ${sub}`);
}

function runToolkit(core: CoreModules, paths: any, args: string[]) {
  const sub = args[0] ?? "sync";
  if (sub === "show") {
    return jsonResult(core.projectAbsToolkit.ensureProjectAbsToolkit(paths, { force: false }));
  }
  if (sub === "sync") {
    const artifact = core.projectAbsToolkit.syncProjectAbsToolkitFromMemory(paths);
    core.projectAbsToolkit.persistProjectAbsToolkit(paths, artifact);
    return jsonResult(artifact);
  }
  if (sub === "search") {
    const query = readQuery(args.slice(1), paths);
    const artifact = core.projectAbsToolkit.ensureProjectAbsToolkit(paths, { force: false });
    return jsonResult({
      query,
      results: core.projectAbsToolkit.searchProjectAbsToolkit(
        artifact,
        query,
        readNumberOption(args, "--limit"),
      ),
    });
  }
  if (sub === "export") {
    const artifact = core.projectAbsToolkit.ensureProjectAbsToolkit(paths, { force: false });
    core.projectAbsToolkit.exportProjectAbsToolkitMarkdown(
      artifact,
      paths.projectAbsToolkitMarkdownFile,
    );
    core.projectAbsToolkit.exportProjectAbsToolkitDirectory(artifact, paths.projectAbsToolkitDir);
    return jsonResult({
      status: "ok",
      markdownFile: paths.projectAbsToolkitMarkdownFile,
      directory: paths.projectAbsToolkitDir,
    });
  }
  if (sub === "path") {
    return jsonResult({
      toolkitFile: paths.projectAbsToolkitFile,
      markdownFile: paths.projectAbsToolkitMarkdownFile,
      directory: paths.projectAbsToolkitDir,
      whitelistFile: paths.projectAbsToolkitTaxonomyFile,
    });
  }
  if (sub === "reclassify") {
    const [entryId, category, subcategory] = getPositionals(args.slice(1));
    return reclassifyToolkitEntries(core, paths, [{ entryId, category, subcategory }]);
  }
  if (sub === "reclassify-batch") {
    const values = getPositionals(args.slice(1));
    const ops = [];
    for (let index = 0; index < values.length; index += 3) {
      ops.push({
        entryId: values[index],
        category: values[index + 1],
        subcategory: values[index + 2],
      });
    }
    return reclassifyToolkitEntries(core, paths, ops);
  }
  if (sub === "whitelist") return runToolkitWhitelist(paths, args.slice(1));
  throw new Error(`Unsupported internal TriadMind toolkit subcommand: ${sub}`);
}

function reclassifyToolkitEntries(
  core: CoreModules,
  paths: any,
  ops: Array<Record<string, string | undefined>>,
) {
  const whitelist = loadToolkitWhitelist(paths);
  const artifact = core.projectAbsToolkit.ensureProjectAbsToolkit(paths, { force: false });
  const updated: unknown[] = [];
  for (const op of ops) {
    const entryId = normalizeTaxonomyComponent(op.entryId ?? "");
    const category = normalizeTaxonomyComponent(op.category ?? "");
    const subcategory = normalizeTaxonomyComponent(op.subcategory ?? "");
    if (!entryId || !category || !subcategory)
      throw new Error("toolkit reclassify requires entryId category subcategory.");
    validateToolkitWhitelist({ category, subcategory }, whitelist);
    const entry = artifact.entries.find((item: any) => item.id === entryId);
    if (!entry) throw new Error(`Toolkit entry not found: ${entryId}`);
    entry.category = category;
    entry.subcategory = subcategory;
    entry.lastReviewedAt = new Date().toISOString();
    updated.push({ entryId, category, subcategory });
  }
  artifact.summary = core.projectAbsToolkit.recalculateProjectAbsToolkitSummary(artifact);
  core.projectAbsToolkit.persistProjectAbsToolkit(paths, artifact);
  return jsonResult({ updated, artifact });
}

function runToolkitWhitelist(paths: any, args: string[]) {
  const sub = args[0] ?? "show";
  if (sub === "show") return jsonResult(loadToolkitWhitelist(paths));
  if (sub === "path") return jsonResult({ whitelistFile: paths.projectAbsToolkitTaxonomyFile });
  if (sub === "clear") {
    const whitelist: { schemaVersion: "1.0"; categories: Record<string, string[]> } = {
      schemaVersion: "1.0",
      categories: {},
    };
    saveToolkitWhitelist(paths, whitelist);
    return jsonResult(whitelist);
  }
  if (sub === "add" || sub === "remove") {
    const [categoryRaw, subcategoryRaw] = getPositionals(args.slice(1));
    const category = normalizeTaxonomyComponent(categoryRaw ?? "");
    const subcategory = normalizeTaxonomyComponent(subcategoryRaw ?? "");
    if (!category || !subcategory)
      throw new Error(`toolkit whitelist ${sub} requires category and subcategory.`);
    const whitelist = loadToolkitWhitelist(paths);
    const current = new Set(whitelist.categories[category] ?? []);
    if (sub === "add") current.add(subcategory);
    else current.delete(subcategory);
    if (current.size > 0) whitelist.categories[category] = Array.from(current).sort();
    else delete whitelist.categories[category];
    saveToolkitWhitelist(paths, whitelist);
    return jsonResult(whitelist);
  }
  throw new Error(`Unsupported internal TriadMind toolkit whitelist subcommand: ${sub}`);
}

function resolveCorePath(rootDir: string, configured?: string) {
  const candidates = [
    configured ? resolve(rootDir, configured) : undefined,
    resolve(__dirname, "..", "..", "vendor", "triadmind-core", "dist"),
    resolve(rootDir, "..", "triadmind-core", "dist"),
    resolve(rootDir, "..", "..", "triadmind-core", "dist"),
    resolve(process.cwd(), "..", "triadmind-core", "dist"),
  ].filter((entry): entry is string => Boolean(entry));
  for (const candidate of candidates) {
    const corePath = candidate.endsWith("dist") ? candidate : join(candidate, "dist");
    if (existsSync(join(corePath, "workspace.js"))) {
      return {
        corePath,
        source: configured
          ? "configured-corePath"
          : corePath.includes("vendor")
            ? "bundled-vendor"
            : "adjacent-core-library",
      };
    }
  }
  throw new Error(
    "TriadMind core library not found. Configure triadmind.corePath or bundle vendor/triadmind-core/dist.",
  );
}

function loadCoreModules(corePath: string): CoreModules {
  const load = (name: string) => require(join(corePath, name));
  return {
    workspace: load("workspace.js"),
    workflow: load("workflow.js"),
    cliSupport: load("cliSupport.js"),
    triadization: load("triadization.js"),
    interrogation: load("interrogation.js"),
    runtimeExtract: load("runtime/extractRuntimeTopology.js"),
    runtimeWriter: load("runtime/runtimeMapWriter.js"),
    viewMap: load("viewMap.js"),
    config: load("config.js"),
    analyzer: load("analyzer.js"),
    analyzerOptionsSupport: load("analyzerOptionsSupport.js"),
    artifactReaders: load("artifactReaders.js"),
    runtimeFilter: load("runtime/filterRuntimeMapByView.js"),
    runtimeVisualizer: load("runtime/runtimeVisualizer.js"),
    coverage: load("coverage.js"),
    trend: load("trend.js"),
    dreamScheduler: load("dreamScheduler.js"),
    dreamDaemon: load("dreamDaemon.js"),
    dreamFeedbackSupport: load("dreamFeedbackSupport.js"),
    dreamFeedbackValidator: load("dreamFeedbackValidator.js"),
    dreamRuleLedger: load("dreamRuleLedger.js"),
    stableArchitectureAnchorSupport: load("stableArchitectureAnchorSupport.js"),
    navigator: load("navigator.js"),
    dream: load("dream.js"),
    dreamVisualizer: load("dreamVisualizer.js"),
    verify: load("verify.js"),
    govern: load("govern.js"),
    visualizer: load("visualizer.js"),
    abstractionMemory: load("abstractionMemory.js"),
    projectAbsToolkit: load("projectAbsToolkit.js"),
  };
}

function taskKey(paths: any, type: InternalTriadMindTask["type"]) {
  return `${type}:${paths.projectRoot}`;
}

function serializeTask(task: InternalTriadMindTask) {
  return {
    key: task.key,
    type: task.type,
    rootDir: task.rootDir,
    startedAt: task.startedAt,
    ticks: task.ticks,
    lastStatus: task.lastStatus,
    lastReason: task.lastReason,
    lastError: task.lastError,
  };
}

function getInternalTaskStatus(key: string, type: InternalTriadMindTask["type"], paths: any) {
  const task = internalTasks.get(key);
  return task
    ? { status: "running", running: true, task: serializeTask(task) }
    : { status: "not_running", running: false, type, rootDir: paths.projectRoot };
}

function stopInternalTask(key: string, type: InternalTriadMindTask["type"], paths: any) {
  const task = internalTasks.get(key);
  if (!task) return { status: "not_running", running: false, type, rootDir: paths.projectRoot };
  const snapshot = serializeTask(task);
  task.stop();
  return { status: "stopped", running: false, task: snapshot };
}

function writeDreamDaemonTaskState(paths: any, task: InternalTriadMindTask, running: boolean) {
  writeJson(paths.dreamDaemonStateFile, {
    schemaVersion: "1.0",
    updatedAt: new Date().toISOString(),
    running,
    startedAt: task.startedAt,
    heartbeatAt: new Date().toISOString(),
    ticks: task.ticks,
    lastStatus: task.lastStatus,
    lastReason: task.lastReason,
    lastError: task.lastError,
    reasonixInternal: true,
  });
}

function isLikelySourcePath(value: string) {
  const normalized = value.replace(/\\/g, "/");
  if (
    normalized.includes("/node_modules/") ||
    normalized.includes("/.git/") ||
    normalized.includes("/.triadmind/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith(".git/") ||
    normalized.startsWith(".triadmind/")
  ) {
    return false;
  }
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|cpp|cc|cxx|h|hpp)$/i.test(normalized);
}
function writeJson(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function loadToolkitWhitelist(paths: any): {
  schemaVersion: "1.0";
  categories: Record<string, string[]>;
} {
  const loaded = coreReadJson(paths.projectAbsToolkitTaxonomyFile);
  const categories: Record<string, string[]> = {};
  if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
    const rawCategories = (loaded as Record<string, unknown>).categories;
    if (rawCategories && typeof rawCategories === "object" && !Array.isArray(rawCategories)) {
      for (const [categoryRaw, subcategoriesRaw] of Object.entries(rawCategories)) {
        const category = normalizeTaxonomyComponent(categoryRaw);
        const subcategories = Array.isArray(subcategoriesRaw)
          ? Array.from(
              new Set(
                subcategoriesRaw
                  .map((value) => normalizeTaxonomyComponent(String(value)))
                  .filter(Boolean),
              ),
            ).sort()
          : [];
        if (category && subcategories.length > 0) categories[category] = subcategories;
      }
    }
  }
  return { schemaVersion: "1.0", categories };
}

function saveToolkitWhitelist(
  paths: any,
  whitelist: { schemaVersion: "1.0"; categories: Record<string, string[]> },
) {
  writeJson(paths.projectAbsToolkitTaxonomyFile, whitelist);
}

function validateToolkitWhitelist(
  op: { category: string; subcategory: string },
  whitelist: { categories: Record<string, string[]> },
) {
  const allowed = whitelist.categories[op.category];
  if (!allowed?.includes(op.subcategory)) {
    throw new Error(`Toolkit category is not whitelisted: ${op.category}/${op.subcategory}`);
  }
}

function normalizeTaxonomyComponent(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function coreReadJson(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}
function jsonResult(data: unknown, exitCode = 0, stderr = ""): TriadMindEngineResult {
  return { data, text: JSON.stringify(data, null, 2), exitCode, stderr };
}

function textResult(text: string, exitCode = 0, stderr = ""): TriadMindEngineResult {
  return { text, exitCode, stderr };
}

function hasFlag(args: string[], flag: string) {
  return args.includes(flag);
}

function readOption(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function readNumberOption(args: string[], flag: string): number | undefined {
  const raw = readOption(args, flag);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readScope(args: string[], flag: string): "full" | "impact" | undefined {
  const option = readOption(args, flag);
  return option === "impact" || option === "full" ? option : undefined;
}

function readDemand(args: string[]) {
  const positional = getPositionals(args);
  const demand = positional.at(-1)?.trim();
  if (!demand) throw new Error("TriadMind navigate demand is required.");
  return demand;
}

function readQuery(args: string[], paths: any) {
  const explicit = getPositionals(args).join(" ").trim();
  if (explicit) return explicit;
  if (hasFlag(args, "--demand")) {
    try {
      return readFileSync(paths.demandFile, "utf8").trim();
    } catch {
      return "";
    }
  }
  return "";
}

function getPositionals(args: string[]) {
  const result: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const next = args[index + 1];
      if (next && !next.startsWith("--")) index++;
      continue;
    }
    result.push(arg);
  }
  return result;
}

function parseJsonIfPossible(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
