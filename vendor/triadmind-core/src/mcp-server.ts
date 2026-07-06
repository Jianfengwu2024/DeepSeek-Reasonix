#!/usr/bin/env node
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

import * as fs from 'fs';
import { getWorkspacePaths } from '../workspace';
import { ensureTriadSpec } from '../workflow';
import { syncTriadMap } from '../sync';
import { runInterrogation } from '../interrogation';
import { runNavigator } from '../navigator';
import { runDreamAnalysis } from '../dream';
import { runGovern } from '../govern';
import { runTopologyVerify } from '../verify';
import { generateDashboard } from '../visualizer';

// ─── MCP Protocol Types ─────────────────────────────────────────────

interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: number | string;
    method: string;
    params?: Record<string, unknown>;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id?: number | string;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

// ─── Tool Definitions ────────────────────────────────────────────────

const TOOLS: McpTool[] = [
    {
        name: 'triadmind_sync',
        description:
            'Scan project source code and rebuild the TriadMind topology map (triad-map.json). ' +
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
        description:
            'Generate a pre-implementation architecture impact map for a requested feature. ' +
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
        description:
            'Run requirement interrogation before implementation. ' +
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
        description:
            'Run the TriadMind Dream Engine to analyze the codebase topology for architecture smells, ' +
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
        description:
            'Run TriadMind governance policy checks against the current topology. ' +
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
        description:
            'Verify the topological quality of the current triad-map. Computes metrics including ' +
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
        description:
            'Generate an interactive HTML topology visualization from the current triad-map and ' +
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

function handleSync(params: Record<string, unknown>): Record<string, unknown> {
    const projectRoot = String(params.projectRoot || process.cwd());
    const force = Boolean(params.force);

    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }

    const paths = getWorkspacePaths(projectRoot);
    ensureTriadSpec(paths);

    const result = syncTriadMap(paths, force);

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

async function handleNavigate(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const projectRoot = String(params.projectRoot || process.cwd());
    const demand = String(params.demand || '').trim();

    if (!demand) {
        throw new Error('demand parameter is required for navigate');
    }
    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }

    const paths = getWorkspacePaths(projectRoot);
    ensureTriadSpec(paths);

    // Ensure triad-map exists before navigating
    if (!fs.existsSync(paths.mapFile)) {
        syncTriadMap(paths, true);
    }

    const result = await runNavigator(paths, demand, {
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

async function handleInterrogate(params: Record<string, unknown>): Promise<Record<string, unknown>> {
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

    const paths = getWorkspacePaths(projectRoot);
    ensureTriadSpec(paths);

    if (!fs.existsSync(paths.mapFile)) {
        syncTriadMap(paths, true);
    }

    const result = await runInterrogation(paths, demand, {
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

async function handleDream(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const projectRoot = String(params.projectRoot || process.cwd());
    const force = Boolean(params.force);
    const maxProposals = params.maxProposals != null ? Number(params.maxProposals) : undefined;

    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }

    const paths = getWorkspacePaths(projectRoot);
    ensureTriadSpec(paths);

    // Ensure triad-map exists
    if (!fs.existsSync(paths.mapFile)) {
        syncTriadMap(paths, true);
    }

    const result = await runDreamAnalysis(paths, {
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
        topFindings: result.report.findings.slice(0, 10).map((f: Record<string, unknown>) => ({
            title: f.title,
            severity: f.severity,
            confidence: f.confidence,
        })),
        topProposals: result.report.proposals.slice(0, 5).map((p: Record<string, unknown>) => ({
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

function handleGovern(params: Record<string, unknown>): Record<string, unknown> {
    const projectRoot = String(params.projectRoot || process.cwd());
    const mode = (String(params.mode || 'check')) as 'check' | 'ci' | 'fix';

    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }

    const paths = getWorkspacePaths(projectRoot);
    ensureTriadSpec(paths);

    // Ensure triad-map exists
    if (!fs.existsSync(paths.mapFile)) {
        syncTriadMap(paths, true);
    }

    const result = runGovern(paths, { mode });

    return {
        passed: result.report.passed,
        exitCode: result.report.exitCode,
        mode: result.report.mode,
        checkCount: result.report.checks.length,
        passCount: result.report.checks.filter((c: Record<string, unknown>) => c.status === 'pass').length,
        failCount: result.report.checks.filter((c: Record<string, unknown>) => c.status === 'fail').length,
        errorCount: result.report.checks.filter((c: Record<string, unknown>) => c.status === 'error').length,
        failures: result.report.checks
            .filter((c: Record<string, unknown>) => c.status !== 'pass')
            .map((c: Record<string, unknown>) => ({
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

function handleVerify(params: Record<string, unknown>): Record<string, unknown> {
    const projectRoot = String(params.projectRoot || process.cwd());

    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }

    const paths = getWorkspacePaths(projectRoot);
    ensureTriadSpec(paths);

    // Ensure triad-map exists
    if (!fs.existsSync(paths.mapFile)) {
        syncTriadMap(paths, true);
    }

    const report = runTopologyVerify(paths);

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

function handleVisualize(params: Record<string, unknown>): Record<string, unknown> {
    const projectRoot = String(params.projectRoot || process.cwd());

    if (!fs.existsSync(projectRoot)) {
        throw new Error(`Project root does not exist: ${projectRoot}`);
    }

    const paths = getWorkspacePaths(projectRoot);
    ensureTriadSpec(paths);
    if (!fs.existsSync(paths.mapFile)) syncTriadMap(paths, true);

    const draftExists = fs.existsSync(paths.draftFile);
    generateDashboard(
        paths.mapFile,
        draftExists ? paths.draftFile : paths.mapFile,
        paths.visualizerFile,
        { defaultView: 'architecture' },
    );

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

// ─── Tool Dispatcher ──────────────────────────────────────────────────

type ToolHandler = (params: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
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

function sendResponse(response: JsonRpcResponse) {
    process.stdout.write(JSON.stringify(response) + '\n');
}

function sendError(id: number | string | undefined, code: number, message: string, data?: unknown) {
    sendResponse({
        jsonrpc: '2.0',
        id,
        error: { code, message, data },
    });
}

function handleRequest(request: JsonRpcRequest) {
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
            const toolName = params?.name as string;
            const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;

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
                    .catch((err: unknown) => {
                        const message = err instanceof Error ? err.message : String(err);
                        sendError(id, -32000, `Tool execution failed: ${message}`);
                    });
            } catch (err: unknown) {
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

async function runToolHandlerSilently(
    handler: ToolHandler,
    toolArgs: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;

    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};

    try {
        return await handler(toolArgs);
    } finally {
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
            const request = JSON.parse(line) as JsonRpcRequest;
            handleRequest(request);
        } catch {
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
        console.error = (...args: unknown[]) => {
            logStream.write(`[${new Date().toISOString()}] ${args.join(' ')}\n`);
            originalError.apply(console, args);
        };
    }

    process.stdin.setEncoding('utf-8');
    process.stdin.resume();

    process.stdin.on('data', (chunk: string) => {
        buffer += chunk;
        processBuffer();
    });

    process.stdin.on('end', () => {
        // Process any remaining data
        processBuffer();
    });

    process.on('uncaughtException', (err: Error) => {
        sendError(undefined, -32603, `Internal error: ${err.message}`);
    });

    process.on('unhandledRejection', (reason: unknown) => {
        const message = reason instanceof Error ? reason.message : String(reason);
        sendError(undefined, -32603, `Internal error: ${message}`);
    });
}

main();
