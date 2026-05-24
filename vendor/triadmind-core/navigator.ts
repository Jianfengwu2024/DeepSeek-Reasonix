import * as fs from 'fs';
import * as path from 'path';
import { readJsonFileStrict, readRequiredTextFile, readTextIfExists } from './artifactReaders';
import { loadTriadConfig, TriadConfig } from './config';
import { assertProtocolShape, readTriadMap, TriadNodeDefinition, UpgradeProtocol } from './protocol';
import { tryGenerateNavigatorProtocol } from './navigatorLlm';
import { loadDreamFeedbackLedger, DreamFeedbackLedger, formatDreamFeedbackRules } from './dreamFeedbackSupport';
import { expireStaleRules, formatActiveRulesPrompt, loadDreamRuleLedger } from './dreamRuleLedger';
import { createDraftProtocolTemplate } from './workflowRightBranch';
import { createJsonSection, createPromptSection, renderPromptBlocks } from './workflowPromptRenderSupport';
import { DashboardOptions, generateImpactDashboard } from './visualizer';
import { normalizePath, WorkspacePaths } from './workspace';
import {
    buildAbstractionMemoryPromptContext,
    formatAbstractionProtocolActionCandidatesJson,
    formatAbstractionMemoryRecommendationsJson,
    formatAbstractionMemoryPromptJson
} from './abstractionMemory';

export interface NavigatorRunOptions {
    protocolPath?: string;
    dashboardOptions?: DashboardOptions;
    llm?: string;
}

export interface NavigatorRunResult {
    status: 'pending_protocol' | 'ready';
    demand: string;
    impactMapFile: string;
    impactProtocolFile: string;
    impactPromptFile: string;
    impactVisualizerFile: string;
    summary: string[];
}

interface ImpactMapArtifact {
    schemaVersion: '1.0';
    generatedAt: string;
    project: string;
    feature: string;
    protocolFile: string;
    visualizerFile: string;
    protocol: UpgradeProtocol;
    previewTopology: ReturnType<typeof generateImpactDashboard>['previewMap'];
    graph: ReturnType<typeof generateImpactDashboard>['graph'];
    summary: {
        proposedNodeCount: number;
        proposedEdgeCount: number;
        totalVisibleNodes: number;
        totalVisibleEdges: number;
    };
}

interface NavigatorProtocolLoadResult {
    protocol?: UpgradeProtocol;
    notes: string[];
}

export async function runNavigator(
    paths: WorkspacePaths,
    demand: string,
    options: NavigatorRunOptions = {}
): Promise<NavigatorRunResult> {
    const normalizedDemand = demand.trim();
    if (!normalizedDemand) {
        throw new Error('Navigator demand cannot be empty.');
    }

    fs.mkdirSync(paths.triadDir, { recursive: true });
    const feedbackLoad = loadDreamFeedbackLedger(paths);
    const ruleLoad = loadDreamRuleLedger(paths);
    expireStaleRules(paths); // clean expired TTL rules before injecting
    const rulesPrompt = formatActiveRulesPrompt(ruleLoad.ledger);
    const prompt = buildNavigatorPrompt(paths, normalizedDemand, feedbackLoad.ledger, rulesPrompt);
    fs.writeFileSync(paths.impactPromptFile, prompt, 'utf-8');
    fs.writeFileSync(paths.demandFile, normalizedDemand, 'utf-8');

    const protocolPath = resolveProtocolPath(paths, options.protocolPath);
    const config = loadTriadConfig(paths);
    const existingNodes = readTriadMap(paths.mapFile);
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
    const dashboard = generateImpactDashboard(paths.mapFile, protocol, paths.impactVisualizerFile, options.dashboardOptions);
    const proposedNodeCount = dashboard.graph.nodes.filter((node) => node.lifecycle === 'proposed' && !node.hidden).length;
    const proposedEdgeCount = dashboard.graph.edges.filter((edge) => edge.lifecycle === 'proposed' && !edge.hidden).length;

    const artifact: ImpactMapArtifact = {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        project: path.basename(paths.projectRoot),
        feature: normalizedDemand,
        protocolFile: normalizePath(path.relative(paths.projectRoot, paths.impactProtocolFile)),
        visualizerFile: normalizePath(path.relative(paths.projectRoot, paths.impactVisualizerFile)),
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

async function loadNavigatorProtocol(
    paths: WorkspacePaths,
    demand: string,
    protocolPath: string,
    context: {
        prompt: string;
        llm?: string;
        config: TriadConfig;
        existingNodes: TriadNodeDefinition[];
    }
): Promise<NavigatorProtocolLoadResult> {
    const candidatePath = path.resolve(protocolPath);
    const usesDefaultImpactProtocol = normalizePath(candidatePath) === normalizePath(paths.impactProtocolFile);
    if (!fs.existsSync(candidatePath)) {
        if (usesDefaultImpactProtocol) {
            const generated = await tryGenerateNavigatorProtocol({
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

    const protocol = readJsonFileStrict<UpgradeProtocol>(candidatePath);
    if (!Array.isArray(protocol.actions) || protocol.actions.length === 0) {
        if (usesDefaultImpactProtocol) {
            const currentDemand = normalizeDemand(protocol.userDemand);
            if (currentDemand && currentDemand !== demand) {
                const generated = await tryGenerateNavigatorProtocol({
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

            const generated = await tryGenerateNavigatorProtocol({
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
            const generated = await tryGenerateNavigatorProtocol({
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

    const parsed = assertProtocolShape(protocol, {
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

function seedNavigatorProtocolTemplate(paths: WorkspacePaths, demand: string, overwrite = false) {
    if (!overwrite && fs.existsSync(paths.impactProtocolFile)) {
        return;
    }

    fs.writeFileSync(
        paths.impactProtocolFile,
        JSON.stringify(createDraftProtocolTemplate(paths.projectRoot, paths.mapFile, demand), null, 2),
        'utf-8'
    );
}

function resolveProtocolPath(paths: WorkspacePaths, protocolPath?: string) {
    if (!protocolPath?.trim()) {
        return paths.impactProtocolFile;
    }

    return path.isAbsolute(protocolPath) ? protocolPath : path.join(paths.projectRoot, protocolPath);
}

function normalizeDemand(value: string | undefined) {
    return String(value ?? '').trim();
}

function clearImpactArtifacts(paths: WorkspacePaths) {
    for (const artifactPath of [paths.impactMapFile, paths.impactVisualizerFile]) {
        if (fs.existsSync(artifactPath)) {
            fs.unlinkSync(artifactPath);
        }
    }
}

function buildNavigatorPrompt(paths: WorkspacePaths, demand: string, feedbackLedger?: DreamFeedbackLedger, rulesPrompt?: string) {
    const triadSpec = readRequiredTextFile(paths.triadSpecFile, { trim: true });
    const configJson = readTextIfExists(paths.configFile);
    const mapJson = readTextIfExists(paths.mapFile);
    const previousDemand = readTextIfExists(paths.demandFile, { trim: true });
    const abstractionMemory = buildAbstractionMemoryPromptContext(paths, demand);

    const blocks = [
        createPromptSection('System', [
            'You are TriadMind Navigator, a pre-implementation architecture copilot.',
            'Your task is to infer the architecture impact of a requested feature before any code is written.',
            'Return only strict JSON compatible with UpgradeProtocol. Do not include prose outside the JSON payload.'
        ]),
        createPromptSection('Context: Project Root', normalizePath(paths.projectRoot)),
        createPromptSection('Context: Triad Map Path', normalizePath(paths.mapFile)),
        createPromptSection('Context: Impact Protocol Output Path', normalizePath(paths.impactProtocolFile)),
        createPromptSection('Context: Impact Map Artifact Path', normalizePath(paths.impactMapFile)),
        createPromptSection('Triad Spec', triadSpec),
        createJsonSection('Triad Config JSON', configJson, '{}'),
        createJsonSection('Triad Map JSON', mapJson, '[]'),
        createPromptSection('Abstraction Memory Workflow', abstractionMemory.summaryLines),
        createJsonSection(
            'Abstraction Memory Matches JSON',
            formatAbstractionMemoryPromptJson(abstractionMemory.matches),
            '[]'
        ),
        createJsonSection(
            'Abstraction Memory Recommendations JSON',
            formatAbstractionMemoryRecommendationsJson(abstractionMemory.recommendations),
            '[]'
        ),
        createJsonSection(
            'Protocol Seed Action Candidates JSON',
            formatAbstractionProtocolActionCandidatesJson(abstractionMemory.protocolActionCandidates),
            '[]'
        ),
        createPromptSection('Previous Demand', previousDemand ? JSON.stringify(previousDemand) : '""'),
        createPromptSection('User Demand', JSON.stringify(demand))
    ];

    const shouldInjectRules =
        (feedbackLedger && feedbackLedger.rejections.length > 0) ||
        (rulesPrompt && rulesPrompt.trim().length > 0);
    if (shouldInjectRules) {
        const rules = formatDreamFeedbackRules(
            feedbackLedger ?? { schemaVersion: '1.0', project: '', rejections: [] },
            rulesPrompt
        );
        if (rules) {
            blocks.push(createPromptSection('Dream Feedback Rules', rules));
        } else if (feedbackLedger && feedbackLedger.rejections.length > 0) {
            const rejections = feedbackLedger.rejections
                .slice(-10)
                .map((r) => `- Proposal: ${r.proposalTitle}\n  Reason: ${r.reason}\n  Reviewer: ${r.reviewerRole}`)
                .join('\n\n');

            blocks.push(
                createPromptSection('Project Architecture Lore (Feedback History)', [
                    'The following proposals were previously rejected by the project maintainers or AI assistants.',
                    'Learn from these rejections and avoid making similar proposals.',
                    'If a proposal was rejected because it is a stable core module, respect that architectural boundary.',
                    '',
                    rejections
                ])
            );
        }
    }

    blocks.push(
        createPromptSection('Navigator Rules', [
            'This is a dry-run architecture preview, not an apply step.',
            'Favor reuse of mature existing nodes before inventing new capability hubs.',
            'Search abstraction memory before proposing new children, and prefer contract-aware reuse when a candidate exists.',
            'If protocol seed action candidates are provided, prefer refining those reuse/modify seeds before emitting create_child.',
            'Use only reuse / modify / create_child actions.',
            'Keep changes minimal and topology-aware: only introduce nodes and edges required for this feature.',
            'Newly introduced nodes may omit lifecycle. TriadMind will mark them as proposed during impact-map rendering.',
            'Do not emit markdown fences or explanation text. Output strict UpgradeProtocol JSON only.'
        ]),
        createPromptSection('Output Contract', [
            `Write the final JSON payload into ${normalizePath(paths.impactProtocolFile)}.`,
            'protocolVersion should remain "1.0".',
            'actions must contain at least one concrete reuse/modify/create_child operation.'
        ])
    );

    return renderPromptBlocks(blocks);
}
