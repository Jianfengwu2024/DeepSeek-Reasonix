#!/usr/bin/env node
"use strict";
// @ts-nocheck -- MCP stdio server; property access on module return types is safe at runtime
/**
 * TriadMind MCP Server
 *
 * Model Context Protocol (MCP) server that exposes TriadMind architecture
 * analysis tools to MCP-compatible clients (e.g. DeepSeek-TUI).
 *
 * Protocol: JSON-RPC 2.0 over stdio
 *
 * Exposed tools:
 *   - triadmind_sync        Scan source code, update triad-map.json
 *   - triadmind_navigate    Generate architecture impact map for a feature
 *   - triadmind_dream       Run dream engine (topology health analysis)
 *   - triadmind_govern      Run governance policy checks
 *   - triadmind_verify      Verify topology quality metrics
 *   - triadmind_analyze     Analyze topology for abstraction deficits
 *   - triadmind_visualize   Generate HTML topology visualization
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const workspace_1 = require("../workspace");
const workflow_1 = require("../workflow");
const sync_1 = require("../sync");
const interrogation_1 = require("../interrogation");
const navigator_1 = require("../navigator");
const dream_1 = require("../dream");
const govern_1 = require("../govern");
const verify_1 = require("../verify");
const visualizer_1 = require("../visualizer");
// ─── Tool Definitions ────────────────────────────────────────────────
const TOOLS = [
    {
        name: 'triadmind_sync',
        description: 'Scan project source code and rebuild the TriadMind topology map (triad-map.json). ' +
            'Use this when source files have changed and the topology is stale, or before running analysis tools.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: {
                    type: 'string',
                    description: 'Absolute path to the project root directory.',
                },
                force: {
                    type: 'boolean',
                    description: 'Force a full rebuild even if no file changes detected (default: false).',
                },
            },
            required: ['projectRoot'],
        },
    },
    {
        name: 'triadmind_navigate',
        description: 'Generate a pre-implementation architecture impact map for a requested feature. ' +
            'Produces an HTML visualizer showing existing topology (solid lines) and proposed changes (red dashed lines). ' +
            'Use this BEFORE writing code to preview how a new feature should integrate with the existing architecture.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: {
                    type: 'string',
                    description: 'Absolute path to the project root directory.',
                },
                demand: {
                    type: 'string',
                    description: 'Natural language description of the feature or change to analyze.',
                },
            },
            required: ['projectRoot', 'demand'],
        },
    },
    {
        name: 'triadmind_interrogate',
        description: 'Run requirement interrogation before implementation. ' +
            'Seeds follow-up questions, merges answered state when provided, and renders an impact map once the request is precise enough.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: {
                    type: 'string',
                    description: 'Absolute path to the project root directory.',
                },
                demand: {
                    type: 'string',
                    description: 'Natural language description of the requested project creation or modification work.',
                },
                answersFile: {
                    type: 'string',
                    description: 'Optional path to a JSON answers file to merge into interrogation-state.json.',
                },
                llm: {
                    type: 'string',
                    description: 'Optional navigator provider:model descriptor used when generating the impact protocol.',
                },
            },
            required: ['projectRoot', 'demand'],
        },
    },
    {
        name: 'triadmind_dream',
        description: 'Run the TriadMind Dream Engine to analyze the codebase topology for architecture smells, ' +
            'abstraction deficits, high fan-out modules, ghost nodes, and other quality issues. ' +
            'Generates refactoring proposals with confidence scores. Use this to get architecture health insights.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: {
                    type: 'string',
                    description: 'Absolute path to the project root directory.',
                },
                force: {
                    type: 'boolean',
                    description: 'Bypass idle gate and run immediately (default: false).',
                },
                maxProposals: {
                    type: 'number',
                    description: 'Maximum number of dream proposals to generate (default: from config).',
                },
            },
            required: ['projectRoot'],
        },
    },
    {
        name: 'triadmind_govern',
        description: 'Run TriadMind governance policy checks against the current topology. ' +
            'Validates coverage gates, ghost node ratios, forbidden mutations, contract completeness, ' +
            'and other architecture rules defined in govern-policy.json. Returns pass/fail for each check.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: {
                    type: 'string',
                    description: 'Absolute path to the project root directory.',
                },
                mode: {
                    type: 'string',
                    enum: ['check', 'ci', 'fix'],
                    description: 'Governance mode: check (report only), ci (fail on violations), fix (auto-repair). Default: check.',
                },
            },
            required: ['projectRoot'],
        },
    },
    {
        name: 'triadmind_verify',
        description: 'Verify the topological quality of the current triad-map. Computes metrics including ' +
            'ghost node ratio, execute-like method ratio, contract completeness, edge consistency, ' +
            'and abstraction deficit hotspots. Returns a structured quality report.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: {
                    type: 'string',
                    description: 'Absolute path to the project root directory.',
                },
            },
            required: ['projectRoot'],
        },
    },
    {
        name: 'triadmind_visualize',
        description: 'Generate an interactive HTML topology visualization from the current triad-map and ' +
            'draft protocol (if any). The visualizer shows capability nodes, edges, communities, ' +
            'and Maya fingerprints in a browser-renderable graph. Use this to explore the architecture visually.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: {
                    type: 'string',
                    description: 'Absolute path to the project root directory.',
                },
            },
            required: ['projectRoot'],
        },
    },
];
// ─── Tool Handlers ───────────────────────────────────────────────────
function handleSync(params) {
    const projectRoot = String(params.projectRoot || process.cwd());
    const force = Boolean(params.force);
    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    (0, workflow_1.ensureTriadSpec)(paths);
    const result = (0, sync_1.syncTriadMap)(paths, force);
    const mapExists = fs.existsSync(paths.mapFile);
    const mapStats = mapExists ? fs.statSync(paths.mapFile) : null;
    return {
        changed: result.changed,
        fileCount: result.fileCount,
        mapFile: paths.mapFile,
        mapExists,
        mapSizeBytes: mapStats?.size ?? 0,
        mapUpdatedAt: mapStats?.mtime?.toISOString() ?? null,
    };
}
async function handleNavigate(params) {
    const projectRoot = String(params.projectRoot || process.cwd());
    const demand = String(params.demand || '').trim();
    if (!demand) {
        throw new Error('demand parameter is required for navigate');
    }
    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    (0, workflow_1.ensureTriadSpec)(paths);
    // Ensure triad-map exists before navigating
    if (!fs.existsSync(paths.mapFile)) {
        (0, sync_1.syncTriadMap)(paths, true);
    }
    const result = await (0, navigator_1.runNavigator)(paths, demand, {
        dashboardOptions: { defaultView: 'architecture' },
    });
    return {
        status: result.status,
        demand: result.demand,
        impactMapFile: result.impactMapFile,
        impactProtocolFile: result.impactProtocolFile,
        impactVisualizerFile: result.impactVisualizerFile,
        summary: result.summary,
    };
}
async function handleInterrogate(params) {
    const projectRoot = String(params.projectRoot || process.cwd());
    const demand = String(params.demand || '').trim();
    const answersFile = params.answersFile != null ? String(params.answersFile).trim() : undefined;
    const llm = params.llm != null ? String(params.llm).trim() : undefined;
    if (!demand) {
        throw new Error('demand parameter is required for interrogate');
    }
    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    (0, workflow_1.ensureTriadSpec)(paths);
    if (!fs.existsSync(paths.mapFile)) {
        (0, sync_1.syncTriadMap)(paths, true);
    }
    const result = await (0, interrogation_1.runInterrogation)(paths, demand, {
        answersFile,
        llm,
        dashboardOptions: { defaultView: 'architecture' },
    });
    return {
        status: result.status,
        demand: result.demand,
        promptFile: result.promptFile,
        stateFile: result.stateFile,
        impactMapFile: result.impactMapFile ?? null,
        impactVisualizerFile: result.impactVisualizerFile ?? null,
        summary: result.summary,
        state: result.state,
    };
}
async function handleDream(params) {
    const projectRoot = String(params.projectRoot || process.cwd());
    const force = Boolean(params.force);
    const maxProposals = params.maxProposals != null ? Number(params.maxProposals) : undefined;
    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    (0, workflow_1.ensureTriadSpec)(paths);
    // Ensure triad-map exists
    if (!fs.existsSync(paths.mapFile)) {
        (0, sync_1.syncTriadMap)(paths, true);
    }
    const result = await (0, dream_1.runDreamAnalysis)(paths, {
        mode: 'manual',
        force,
        maxProposals,
    });
    return {
        project: result.report.project,
        generatedAt: result.report.generatedAt,
        mode: result.report.mode,
        skipped: result.report.skipped,
        skipReason: result.report.skipReason ?? null,
        findingCount: result.report.findings.length,
        proposalCount: result.report.proposals.length,
        topFindings: result.report.findings.slice(0, 10).map((f) => ({
            title: f.title,
            severity: f.severity,
            confidence: f.confidence,
        })),
        topProposals: result.report.proposals.slice(0, 5).map((p) => ({
            title: p.title,
            priority: p.priority,
            confidence: p.confidence,
            objective: p.objective,
        })),
        summary: result.report.summary,
        reportFile: paths.dreamReportFile,
        proposalsFile: paths.dreamProposalsFile,
    };
}
function handleGovern(params) {
    const projectRoot = String(params.projectRoot || process.cwd());
    const mode = (String(params.mode || 'check'));
    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    (0, workflow_1.ensureTriadSpec)(paths);
    // Ensure triad-map exists
    if (!fs.existsSync(paths.mapFile)) {
        (0, sync_1.syncTriadMap)(paths, true);
    }
    const result = (0, govern_1.runGovern)(paths, { mode });
    return {
        passed: result.report.passed,
        exitCode: result.report.exitCode,
        mode: result.report.mode,
        checkCount: result.report.checks.length,
        passCount: result.report.checks.filter((c) => c.status === 'pass').length,
        failCount: result.report.checks.filter((c) => c.status === 'fail').length,
        errorCount: result.report.checks.filter((c) => c.status === 'error').length,
        failures: result.report.checks
            .filter((c) => c.status !== 'pass')
            .map((c) => ({
            key: c.key,
            status: c.status,
            expected: c.expected,
            actual: c.actual,
            detail: c.detail,
        })),
        violations: result.report.policyViolations,
        reportFile: paths.governReportFile,
    };
}
function handleVerify(params) {
    const projectRoot = String(params.projectRoot || process.cwd());
    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    (0, workflow_1.ensureTriadSpec)(paths);
    // Ensure triad-map exists
    if (!fs.existsSync(paths.mapFile)) {
        (0, sync_1.syncTriadMap)(paths, true);
    }
    const report = (0, verify_1.runTopologyVerify)(paths);
    return {
        projectRoot: report.projectRoot,
        generatedAt: report.generatedAt,
        passed: report.passed,
        strict: report.strict,
        metrics: {
            totalNodes: report.metrics.triad_nodes,
            ghostNodes: report.metrics.ghost_nodes,
            ghostRatio: report.metrics.ghost_ratio,
            executeLikeCount: report.metrics.execute_like_count,
            executeLikeRatio: report.metrics.execute_like_ratio,
            triadCompletenessViolations: report.metrics.triad_completeness_violations,
            renderedEdgesConsistency: report.metrics.rendered_edges_consistency,
            protocolFocusAlignmentViolations: report.metrics.protocol_focus_alignment_violations,
            focusClosureViolations: report.metrics.focus_closure_violations,
            abstractionDeficitIndex: report.metrics.abstraction_deficit_index,
            abstractionHotspotCount: report.metrics.abstraction_hotspot_count,
            diagnosticsTotal: report.metrics.diagnostics_total,
            diagnosticsNoCode: report.metrics.diagnostics_no_code,
        },
        checks: report.checks.map((c) => ({
            key: c.key,
            status: c.status,
            expected: c.expected,
            actual: c.actual,
            detail: c.detail,
        })),
    };
}
function handleVisualize(params) {
    const projectRoot = String(params.projectRoot || process.cwd());
    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    (0, workflow_1.ensureTriadSpec)(paths);
    if (!fs.existsSync(paths.mapFile))
        (0, sync_1.syncTriadMap)(paths, true);
    const draftExists = fs.existsSync(paths.draftFile);
    (0, visualizer_1.generateDashboard)(paths.mapFile, draftExists ? paths.draftFile : paths.mapFile, paths.visualizerFile, { defaultView: 'architecture' });
    const vizExists = fs.existsSync(paths.visualizerFile);
    const vizStats = vizExists ? fs.statSync(paths.visualizerFile) : null;
    return {
        outputPath: paths.visualizerFile,
        visualizerGenerated: vizExists,
        fileSizeBytes: vizStats?.size ?? 0,
        generatedAt: vizStats?.mtime?.toISOString() ?? null,
        draftProtocolUsed: draftExists,
    };
}
const TOOL_HANDLERS = {
    triadmind_sync: handleSync,
    triadmind_navigate: handleNavigate,
    triadmind_interrogate: handleInterrogate,
    triadmind_dream: handleDream,
    triadmind_govern: handleGovern,
    triadmind_verify: handleVerify,
    triadmind_visualize: handleVisualize,
};
// ─── JSON-RPC Server ──────────────────────────────────────────────────
let buffer = '';
function sendResponse(response) {
    process.stdout.write(JSON.stringify(response) + '\n');
}
function sendError(id, code, message, data) {
    sendResponse({
        jsonrpc: '2.0',
        id,
        error: { code, message, data },
    });
}
function handleRequest(request) {
    const { id, method, params } = request;
    switch (method) {
        case 'initialize': {
            sendResponse({
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: '0.1.0',
                    serverInfo: {
                        name: 'triadmind-mcp',
                        version: '1.2.0',
                    },
                    capabilities: {
                        tools: {},
                    },
                },
            });
            break;
        }
        case 'tools/list': {
            sendResponse({
                jsonrpc: '2.0',
                id,
                result: { tools: TOOLS },
            });
            break;
        }
        case 'tools/call': {
            const toolName = params?.name;
            const toolArgs = (params?.arguments ?? {});
            if (!toolName) {
                sendError(id, -32602, 'Missing tool name');
                return;
            }
            const handler = TOOL_HANDLERS[toolName];
            if (!handler) {
                sendError(id, -32601, `Unknown tool: ${toolName}`);
                return;
            }
            try {
                Promise.resolve(runToolHandlerSilently(handler, toolArgs))
                    .then((result) => {
                    sendResponse({
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        },
                    });
                })
                    .catch((err) => {
                    const message = err instanceof Error ? err.message : String(err);
                    sendError(id, -32000, `Tool execution failed: ${message}`);
                });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                sendError(id, -32000, `Tool execution failed: ${message}`);
            }
            break;
        }
        case 'notifications/initialized': {
            // No response needed for notifications
            break;
        }
        default: {
            sendError(id, -32601, `Method not found: ${method}`);
            break;
        }
    }
}
async function runToolHandlerSilently(handler, toolArgs) {
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    console.log = () => { };
    console.info = () => { };
    console.warn = () => { };
    try {
        return await handler(toolArgs);
    }
    finally {
        console.log = originalLog;
        console.info = originalInfo;
        console.warn = originalWarn;
    }
}
function processBuffer() {
    // Process complete lines from the buffer
    while (true) {
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) {
            break;
        }
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) {
            continue;
        }
        try {
            const request = JSON.parse(line);
            handleRequest(request);
        }
        catch {
            // If the line isn't valid JSON, try to accumulate more data
            // (handles multi-line messages, though MCP uses newline-delimited JSON)
            sendError(undefined, -32700, `Parse error: invalid JSON`);
        }
    }
}
// ─── Main ─────────────────────────────────────────────────────────────
function main() {
    // Ensure stdout is not buffered
    if (process.stdout.isTTY) {
        // We're being run interactively; print a message and exit
        console.error('TriadMind MCP Server — This is a stdio-based MCP server.');
        console.error('Run it from an MCP client (e.g. DeepSeek-TUI) or pipe JSON-RPC requests to stdin.');
        process.exit(1);
    }
    // Disable stderr logging to avoid contaminating the JSON-RPC stream
    // All diagnostic output should go to a file or be suppressed
    const logFile = process.env.TRIADMIND_MCP_LOG;
    if (logFile) {
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });
        const originalError = console.error;
        console.error = (...args) => {
            logStream.write(`[${new Date().toISOString()}] ${args.join(' ')}\n`);
            originalError.apply(console, args);
        };
    }
    process.stdin.setEncoding('utf-8');
    process.stdin.resume();
    process.stdin.on('data', (chunk) => {
        buffer += chunk;
        processBuffer();
    });
    process.stdin.on('end', () => {
        // Process any remaining data
        processBuffer();
    });
    process.on('uncaughtException', (err) => {
        sendError(undefined, -32603, `Internal error: ${err.message}`);
    });
    process.on('unhandledRejection', (reason) => {
        const message = reason instanceof Error ? reason.message : String(reason);
        sendError(undefined, -32603, `Internal error: ${message}`);
    });
}
main();
//# sourceMappingURL=mcp-server.js.map