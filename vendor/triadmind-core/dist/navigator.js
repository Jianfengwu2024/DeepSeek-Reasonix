"use strict";
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
exports.runNavigator = runNavigator;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const protocol_1 = require("./protocol");
const navigatorLlm_1 = require("./navigatorLlm");
const dreamFeedbackSupport_1 = require("./dreamFeedbackSupport");
const dreamRuleLedger_1 = require("./dreamRuleLedger");
const workflowRightBranch_1 = require("./workflowRightBranch");
const workflowPromptRenderSupport_1 = require("./workflowPromptRenderSupport");
const visualizer_1 = require("./visualizer");
const workspace_1 = require("./workspace");
const abstractionMemory_1 = require("./abstractionMemory");
async function runNavigator(paths, demand, options = {}) {
    const normalizedDemand = demand.trim();
    if (!normalizedDemand) {
        throw new Error('Navigator demand cannot be empty.');
    }
    fs.mkdirSync(paths.triadDir, { recursive: true });
    const feedbackLoad = (0, dreamFeedbackSupport_1.loadDreamFeedbackLedger)(paths);
    const ruleLoad = (0, dreamRuleLedger_1.loadDreamRuleLedger)(paths);
    (0, dreamRuleLedger_1.expireStaleRules)(paths); // clean expired TTL rules before injecting
    const rulesPrompt = (0, dreamRuleLedger_1.formatActiveRulesPrompt)(ruleLoad.ledger);
    const prompt = buildNavigatorPrompt(paths, normalizedDemand, feedbackLoad.ledger, rulesPrompt);
    fs.writeFileSync(paths.impactPromptFile, prompt, 'utf-8');
    fs.writeFileSync(paths.demandFile, normalizedDemand, 'utf-8');
    const protocolPath = resolveProtocolPath(paths, options.protocolPath);
    const config = (0, config_1.loadTriadConfig)(paths);
    const existingNodes = (0, protocol_1.readTriadMap)(paths.mapFile);
    const protocolResult = await loadNavigatorProtocol(paths, normalizedDemand, protocolPath, {
        prompt,
        llm: options.llm,
        config,
        existingNodes
    });
    if (!protocolResult.protocol) {
        clearImpactArtifacts(paths);
        return {
            status: 'pending_protocol',
            demand: normalizedDemand,
            impactMapFile: paths.impactMapFile,
            impactProtocolFile: paths.impactProtocolFile,
            impactPromptFile: paths.impactPromptFile,
            impactVisualizerFile: paths.impactVisualizerFile,
            summary: [
                ...protocolResult.notes,
                `Impact prompt written: ${paths.impactPromptFile}`,
                `Impact protocol template ready: ${paths.impactProtocolFile}`,
                'Populate impact-protocol.json with a valid UpgradeProtocol, then rerun `triadmind navigate`.'
            ]
        };
    }
    const protocol = protocolResult.protocol;
    const dashboard = (0, visualizer_1.generateImpactDashboard)(paths.mapFile, protocol, paths.impactVisualizerFile, options.dashboardOptions);
    const proposedNodeCount = dashboard.graph.nodes.filter((node) => node.lifecycle === 'proposed' && !node.hidden).length;
    const proposedEdgeCount = dashboard.graph.edges.filter((edge) => edge.lifecycle === 'proposed' && !edge.hidden).length;
    const artifact = {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        project: path.basename(paths.projectRoot),
        feature: normalizedDemand,
        protocolFile: (0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.impactProtocolFile)),
        visualizerFile: (0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.impactVisualizerFile)),
        protocol,
        previewTopology: dashboard.previewMap,
        graph: dashboard.graph,
        summary: {
            proposedNodeCount,
            proposedEdgeCount,
            totalVisibleNodes: dashboard.graph.stats.nodes,
            totalVisibleEdges: dashboard.graph.stats.edges
        }
    };
    fs.writeFileSync(paths.impactMapFile, JSON.stringify(artifact, null, 2), 'utf-8');
    return {
        status: 'ready',
        demand: normalizedDemand,
        impactMapFile: paths.impactMapFile,
        impactProtocolFile: paths.impactProtocolFile,
        impactPromptFile: paths.impactPromptFile,
        impactVisualizerFile: paths.impactVisualizerFile,
        summary: [
            ...protocolResult.notes,
            `Impact map written: ${paths.impactMapFile}`,
            `Impact visualizer written: ${paths.impactVisualizerFile}`,
            `Proposed nodes: ${proposedNodeCount}`,
            `Proposed edges: ${proposedEdgeCount}`
        ]
    };
}
async function loadNavigatorProtocol(paths, demand, protocolPath, context) {
    const candidatePath = path.resolve(protocolPath);
    const usesDefaultImpactProtocol = (0, workspace_1.normalizePath)(candidatePath) === (0, workspace_1.normalizePath)(paths.impactProtocolFile);
    if (!fs.existsSync(candidatePath)) {
        if (usesDefaultImpactProtocol) {
            const generated = await (0, navigatorLlm_1.tryGenerateNavigatorProtocol)({
                paths,
                demand,
                prompt: context.prompt,
                llm: context.llm,
                config: context.config,
                existingNodes: context.existingNodes
            });
            if (generated.protocol) {
                fs.writeFileSync(paths.impactProtocolFile, JSON.stringify(generated.protocol, null, 2), 'utf-8');
                return {
                    protocol: generated.protocol,
                    notes: generated.note ? [generated.note] : []
                };
            }
            seedNavigatorProtocolTemplate(paths, demand);
            return {
                notes: generated.note ? [generated.note] : []
            };
        }
        throw new Error(`Navigator protocol file not found: ${candidatePath}`);
    }
    const protocol = (0, artifactReaders_1.readJsonFileStrict)(candidatePath);
    if (!Array.isArray(protocol.actions) || protocol.actions.length === 0) {
        if (usesDefaultImpactProtocol) {
            const currentDemand = normalizeDemand(protocol.userDemand);
            if (currentDemand && currentDemand !== demand) {
                const generated = await (0, navigatorLlm_1.tryGenerateNavigatorProtocol)({
                    paths,
                    demand,
                    prompt: context.prompt,
                    llm: context.llm,
                    config: context.config,
                    existingNodes: context.existingNodes
                });
                if (generated.protocol) {
                    fs.writeFileSync(paths.impactProtocolFile, JSON.stringify(generated.protocol, null, 2), 'utf-8');
                    return {
                        protocol: generated.protocol,
                        notes: generated.note ? [generated.note] : []
                    };
                }
                seedNavigatorProtocolTemplate(paths, demand, true);
                return {
                    notes: [
                        `Existing impact protocol was stale for demand ${JSON.stringify(protocol.userDemand)} and has been reset.`,
                        ...(generated.note ? [generated.note] : [])
                    ]
                };
            }
            const generated = await (0, navigatorLlm_1.tryGenerateNavigatorProtocol)({
                paths,
                demand,
                prompt: context.prompt,
                llm: context.llm,
                config: context.config,
                existingNodes: context.existingNodes
            });
            if (generated.protocol) {
                fs.writeFileSync(paths.impactProtocolFile, JSON.stringify(generated.protocol, null, 2), 'utf-8');
                return {
                    protocol: generated.protocol,
                    notes: generated.note ? [generated.note] : []
                };
            }
            return {
                notes: generated.note ? [generated.note] : []
            };
        }
        throw new Error(`Navigator protocol has no actions: ${candidatePath}`);
    }
    if (usesDefaultImpactProtocol) {
        const currentDemand = normalizeDemand(protocol.userDemand);
        if (currentDemand && currentDemand !== demand) {
            const generated = await (0, navigatorLlm_1.tryGenerateNavigatorProtocol)({
                paths,
                demand,
                prompt: context.prompt,
                llm: context.llm,
                config: context.config,
                existingNodes: context.existingNodes
            });
            if (generated.protocol) {
                fs.writeFileSync(paths.impactProtocolFile, JSON.stringify(generated.protocol, null, 2), 'utf-8');
                return {
                    protocol: generated.protocol,
                    notes: [
                        `Existing impact protocol was stale for demand ${JSON.stringify(protocol.userDemand)} and has been regenerated.`,
                        ...(generated.note ? [generated.note] : [])
                    ]
                };
            }
            seedNavigatorProtocolTemplate(paths, demand, true);
            return {
                notes: [
                    `Existing impact protocol was stale for demand ${JSON.stringify(protocol.userDemand)} and has been reset.`,
                    ...(generated.note ? [generated.note] : [])
                ]
            };
        }
    }
    const parsed = (0, protocol_1.assertProtocolShape)(protocol, {
        existingNodes: context.existingNodes,
        minConfidence: context.config.protocol.minConfidence,
        requireConfidence: context.config.protocol.requireConfidence
    });
    fs.writeFileSync(paths.impactProtocolFile, JSON.stringify(parsed, null, 2), 'utf-8');
    return {
        protocol: parsed,
        notes: []
    };
}
function seedNavigatorProtocolTemplate(paths, demand, overwrite = false) {
    if (!overwrite && fs.existsSync(paths.impactProtocolFile)) {
        return;
    }
    fs.writeFileSync(paths.impactProtocolFile, JSON.stringify((0, workflowRightBranch_1.createDraftProtocolTemplate)(paths.projectRoot, paths.mapFile, demand), null, 2), 'utf-8');
}
function resolveProtocolPath(paths, protocolPath) {
    if (!protocolPath?.trim()) {
        return paths.impactProtocolFile;
    }
    return path.isAbsolute(protocolPath) ? protocolPath : path.join(paths.projectRoot, protocolPath);
}
function normalizeDemand(value) {
    return String(value ?? '').trim();
}
function clearImpactArtifacts(paths) {
    for (const artifactPath of [paths.impactMapFile, paths.impactVisualizerFile]) {
        if (fs.existsSync(artifactPath)) {
            fs.unlinkSync(artifactPath);
        }
    }
}
function buildNavigatorPrompt(paths, demand, feedbackLedger, rulesPrompt) {
    const triadSpec = (0, artifactReaders_1.readRequiredTextFile)(paths.triadSpecFile, { trim: true });
    const configJson = (0, artifactReaders_1.readTextIfExists)(paths.configFile);
    const mapJson = (0, artifactReaders_1.readTextIfExists)(paths.mapFile);
    const previousDemand = (0, artifactReaders_1.readTextIfExists)(paths.demandFile, { trim: true });
    const abstractionMemory = (0, abstractionMemory_1.buildAbstractionMemoryPromptContext)(paths, demand);
    const blocks = [
        (0, workflowPromptRenderSupport_1.createPromptSection)('System', [
            'You are TriadMind Navigator, a pre-implementation architecture copilot.',
            'Your task is to infer the architecture impact of a requested feature before any code is written.',
            'Return only strict JSON compatible with UpgradeProtocol. Do not include prose outside the JSON payload.'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Project Root', (0, workspace_1.normalizePath)(paths.projectRoot)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Triad Map Path', (0, workspace_1.normalizePath)(paths.mapFile)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Impact Protocol Output Path', (0, workspace_1.normalizePath)(paths.impactProtocolFile)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Impact Map Artifact Path', (0, workspace_1.normalizePath)(paths.impactMapFile)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triad Spec', triadSpec),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triad Config JSON', configJson, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triad Map JSON', mapJson, '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Abstraction Memory Workflow', abstractionMemory.summaryLines),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Abstraction Memory Matches JSON', (0, abstractionMemory_1.formatAbstractionMemoryPromptJson)(abstractionMemory.matches), '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Abstraction Memory Recommendations JSON', (0, abstractionMemory_1.formatAbstractionMemoryRecommendationsJson)(abstractionMemory.recommendations), '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Protocol Seed Action Candidates JSON', (0, abstractionMemory_1.formatAbstractionProtocolActionCandidatesJson)(abstractionMemory.protocolActionCandidates), '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Previous Demand', previousDemand ? JSON.stringify(previousDemand) : '""'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('User Demand', JSON.stringify(demand))
    ];
    const shouldInjectRules = (feedbackLedger && feedbackLedger.rejections.length > 0) ||
        (rulesPrompt && rulesPrompt.trim().length > 0);
    if (shouldInjectRules) {
        const rules = (0, dreamFeedbackSupport_1.formatDreamFeedbackRules)(feedbackLedger ?? { schemaVersion: '1.0', project: '', rejections: [] }, rulesPrompt);
        if (rules) {
            blocks.push((0, workflowPromptRenderSupport_1.createPromptSection)('Dream Feedback Rules', rules));
        }
        else if (feedbackLedger && feedbackLedger.rejections.length > 0) {
            const rejections = feedbackLedger.rejections
                .slice(-10)
                .map((r) => `- Proposal: ${r.proposalTitle}\n  Reason: ${r.reason}\n  Reviewer: ${r.reviewerRole}`)
                .join('\n\n');
            blocks.push((0, workflowPromptRenderSupport_1.createPromptSection)('Project Architecture Lore (Feedback History)', [
                'The following proposals were previously rejected by the project maintainers or AI assistants.',
                'Learn from these rejections and avoid making similar proposals.',
                'If a proposal was rejected because it is a stable core module, respect that architectural boundary.',
                '',
                rejections
            ]));
        }
    }
    blocks.push((0, workflowPromptRenderSupport_1.createPromptSection)('Navigator Rules', [
        'This is a dry-run architecture preview, not an apply step.',
        'Favor reuse of mature existing nodes before inventing new capability hubs.',
        'Search abstraction memory before proposing new children, and prefer contract-aware reuse when a candidate exists.',
        'If protocol seed action candidates are provided, prefer refining those reuse/modify seeds before emitting create_child.',
        'Use only reuse / modify / create_child actions.',
        'Keep changes minimal and topology-aware: only introduce nodes and edges required for this feature.',
        'Newly introduced nodes may omit lifecycle. TriadMind will mark them as proposed during impact-map rendering.',
        'Do not emit markdown fences or explanation text. Output strict UpgradeProtocol JSON only.'
    ]), (0, workflowPromptRenderSupport_1.createPromptSection)('Output Contract', [
        `Write the final JSON payload into ${(0, workspace_1.normalizePath)(paths.impactProtocolFile)}.`,
        'protocolVersion should remain "1.0".',
        'actions must contain at least one concrete reuse/modify/create_child operation.'
    ]));
    return (0, workflowPromptRenderSupport_1.renderPromptBlocks)(blocks);
}
//# sourceMappingURL=navigator.js.map