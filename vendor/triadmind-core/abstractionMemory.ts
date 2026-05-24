import * as fs from 'fs';
import * as path from 'path';
import {
    calculateAbstractionSummaryBySourcePath,
    detectAbstractionDeficitHotspots,
    detectFlatVariantClusters,
    type AbstractionSourceSummary
} from './analyzer';
import { readJsonObjectArtifactResult, readTriadNodesArtifact } from './artifactReaders';
import { loadTriadConfig, type TriadConfig } from './config';
import type { ModifyAction, ReuseAction, TriadNodeDefinition } from './protocolRightBranch';
import { resolveEffectiveStableAnchorsFromSources } from './stableArchitectureAnchorSupport';
import type { TopologyQualityNodeLike } from './topologyQuality';
import { normalizePath, type WorkspacePaths } from './workspace';

export type AbstractionMemoryEntryKind =
    | 'interface_or_contract'
    | 'abstract_class'
    | 'abstract_function'
    | 'contract_dependency'
    | 'abstraction_module';

export interface AbstractionMemoryEntry {
    id: string;
    name: string;
    kind: AbstractionMemoryEntryKind;
    primarySourcePath: string;
    sourcePaths: string[];
    nodeIds: string[];
    providerNodeIds: string[];
    consumerNodeIds: string[];
    variantClusters: string[];
    relatedAbstractions: string[];
    signatures: string[];
    tags: string[];
    abstractionRatio: number;
    reusabilityScore: number;
    whyReusable: string;
}

export interface AbstractionMemoryArtifact {
    schemaVersion: '1.0';
    generatedAt: string;
    project: string;
    sourceMapFile: string;
    summary: {
        scannedSourceCount: number;
        excludedStableSourceCount: number;
        excludedConfiguredSourceCount: number;
        rememberedEntryCount: number;
        contractEntryCount: number;
        abstractFunctionEntryCount: number;
        moduleEntryCount: number;
        hotspotCount: number;
        variantClusterCount: number;
    };
    entries: AbstractionMemoryEntry[];
}

export interface AbstractionMemorySearchResult {
    entry: AbstractionMemoryEntry;
    score: number;
    matchedTerms: string[];
}

export interface AbstractionMemoryRecommendation {
    entry: AbstractionMemoryEntry;
    score: number;
    matchedTerms: string[];
    rationale: string[];
    suggestedUsage: 'reuse_first' | 'adapt_before_create';
}

export interface AbstractionProtocolActionCandidate {
    kind: 'reuse_seed' | 'modify_seed';
    action: ReuseAction | ModifyAction;
    score: number;
    basedOnEntry: {
        id: string;
        name: string;
        kind: AbstractionMemoryEntryKind;
    };
    rationale: string[];
}

interface ContractMemoryAccumulator {
    name: string;
    sourcePaths: Set<string>;
    providerNodeIds: Set<string>;
    consumerNodeIds: Set<string>;
    variantClusters: Set<string>;
    relatedAbstractions: Set<string>;
    tags: Set<string>;
    abstractionRatios: number[];
    kindHints: Set<'provider' | 'consumer' | 'abstract_class'>;
}

interface FunctionMemoryAccumulator {
    signature: string;
    sourcePaths: Set<string>;
    nodeIds: Set<string>;
    variantClusters: Set<string>;
    relatedAbstractions: Set<string>;
    tags: Set<string>;
    abstractionRatios: number[];
}

interface PromptMemoryContext {
    summaryLines: string[];
    matches: AbstractionMemoryEntry[];
    recommendations: AbstractionMemoryRecommendation[];
    protocolActionCandidates: AbstractionProtocolActionCandidate[];
}

export function syncAbstractionMemory(paths: WorkspacePaths) {
    const config = loadTriadConfig(paths);
    const artifact = buildAbstractionMemory(paths, config);
    fs.mkdirSync(paths.triadDir, { recursive: true });
    fs.writeFileSync(paths.abstractionMemoryFile, JSON.stringify(artifact, null, 2), 'utf-8');
    return artifact;
}

export function loadAbstractionMemory(filePath: string) {
    const result = readJsonObjectArtifactResult<AbstractionMemoryArtifact>(filePath);
    if (result.status !== 'ok' || !Array.isArray(result.value?.entries)) {
        return undefined;
    }
    return result.value;
}

export function ensureAbstractionMemory(paths: WorkspacePaths, options: { force?: boolean; autoSync?: boolean } = {}) {
    const config = loadTriadConfig(paths);
    if (!config.abstractionMemory.enabled) {
        return buildEmptyAbstractionMemory(paths);
    }

    const existing = loadAbstractionMemory(paths.abstractionMemoryFile);
    const shouldAutoSync = options.autoSync ?? config.abstractionMemory.autoSyncOnPrompt;
    if (options.force || !existing) {
        return syncAbstractionMemory(paths);
    }

    if (shouldAutoSync && isAbstractionMemoryStale(paths)) {
        return syncAbstractionMemory(paths);
    }

    return existing;
}

export function searchAbstractionMemory(
    artifact: AbstractionMemoryArtifact,
    query: string,
    limit = 10
): AbstractionMemorySearchResult[] {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const terms = tokenize(query);
    if (artifact.entries.length === 0) {
        return [];
    }

    const scored = artifact.entries
        .map((entry) => {
            const haystack = buildSearchHaystack(entry);
            const matchedTerms = terms.filter((term) => haystack.includes(term));
            const fuzzyMatches = terms.filter((term) => !matchedTerms.includes(term) && fuzzyContains(haystack, term));
            const score =
                matchedTerms.length * 8 +
                fuzzyMatches.length * 3 +
                entry.reusabilityScore +
                (entry.kind === 'abstract_class' ? 2 : 0) +
                (entry.kind === 'abstract_function' ? 2 : 0) +
                (entry.kind === 'abstraction_module' ? 1 : 0);
            return {
                entry,
                score,
                matchedTerms: Array.from(new Set([...matchedTerms, ...fuzzyMatches])).sort()
            };
        })
        .filter((result) => terms.length === 0 || result.matchedTerms.length > 0)
        .sort(
            (left, right) =>
                right.score - left.score ||
                right.entry.reusabilityScore - left.entry.reusabilityScore ||
                left.entry.name.localeCompare(right.entry.name)
        );

    return scored.slice(0, normalizedLimit);
}

export function recommendAbstractionMemory(
    artifact: AbstractionMemoryArtifact,
    options: {
        query: string;
        focusNodeId?: string;
        focusSourcePath?: string;
        limit?: number;
    }
) {
    const normalizedLimit = Math.max(1, Math.floor(options.limit ?? 6));
    const focusNodeId = normalizeText(options.focusNodeId);
    const focusSourcePath = normalizeSourcePath(options.focusSourcePath);
    const focusTokens = new Set([
        ...tokenize(focusNodeId),
        ...tokenize(focusSourcePath),
        ...tokenize(options.query)
    ]);

    const baseResults = searchAbstractionMemory(artifact, options.query, Math.max(normalizedLimit * 3, 12));
    const recommendations = baseResults
        .map((result) => {
            const rationale: string[] = [];
            let score = result.score;

            if (result.matchedTerms.length > 0) {
                rationale.push(`Matched demand terms: ${result.matchedTerms.join(', ')}`);
            }

            const pathBonus = calculateFocusPathBonus(result.entry, focusSourcePath);
            if (pathBonus > 0) {
                score += pathBonus;
                rationale.push(
                    pathBonus >= 6
                        ? `Lives near the current mount path ${focusSourcePath}`
                        : `Shares source-path neighborhood with ${focusSourcePath}`
                );
            }

            const nodeBonus = calculateFocusNodeBonus(result.entry, focusNodeId, focusTokens);
            if (nodeBonus > 0) {
                score += nodeBonus;
                rationale.push(
                    focusNodeId
                        ? `Aligns with the current focus node ${focusNodeId}`
                        : 'Aligns with the current focus vocabulary'
                );
            }

            if (result.entry.kind === 'interface_or_contract') {
                score += 2;
                rationale.push('Existing contract already has implementations, so it is a strong reuse anchor.');
            } else if (result.entry.kind === 'abstract_function') {
                score += 2;
                rationale.push('Abstract function signature can often be reused before adding a new branch.');
            } else if (result.entry.kind === 'abstract_class') {
                score += 1;
                rationale.push('Abstract base can be extended or adapted before inventing a fresh hierarchy.');
            }

            const suggestedUsage =
                result.entry.kind === 'abstraction_module' || result.entry.kind === 'contract_dependency'
                    ? 'adapt_before_create'
                    : 'reuse_first';

            return {
                entry: result.entry,
                score,
                matchedTerms: result.matchedTerms,
                rationale: rationale.slice(0, 4),
                suggestedUsage
            } satisfies AbstractionMemoryRecommendation;
        })
        .sort(
            (left, right) =>
                right.score - left.score ||
                usageRank(right.suggestedUsage) - usageRank(left.suggestedUsage) ||
                left.entry.name.localeCompare(right.entry.name)
        );

    return recommendations.slice(0, normalizedLimit);
}

export function buildAbstractionProtocolActionCandidates(
    paths: WorkspacePaths,
    input: {
        demand: string;
        focusNodeId?: string;
        limit?: number;
    }
) {
    const artifact = ensureAbstractionMemory(paths, { autoSync: true });
    const triadNodes = readTriadNodesArtifact(paths.mapFile);
    const nodeById = new Map(
        triadNodes
            .map((node) => {
                const nodeId = normalizeText(node.nodeId);
                return nodeId ? [nodeId, node] : undefined;
            })
            .filter(Boolean) as Array<[string, TopologyQualityNodeLike]>
    );
    const focusNodeId = normalizeText(input.focusNodeId);
    const focusSourcePath = focusNodeId ? resolveFocusSourcePath(paths, focusNodeId) : '';
    const recommendations = recommendAbstractionMemory(artifact, {
        query: input.demand,
        focusNodeId,
        focusSourcePath,
        limit: Math.max(2, Math.floor(input.limit ?? 4))
    });

    const candidates: AbstractionProtocolActionCandidate[] = [];
    for (const recommendation of recommendations) {
        const reuseCandidate = buildReuseSeedCandidate(recommendation, nodeById, focusNodeId);
        if (reuseCandidate) {
            candidates.push(reuseCandidate);
        }

        const modifyCandidate = buildModifySeedCandidate(recommendation, nodeById, focusNodeId, input.demand);
        if (modifyCandidate) {
            candidates.push(modifyCandidate);
        }
    }

    return dedupeProtocolActionCandidates(candidates).slice(0, Math.max(1, Math.floor(input.limit ?? 4)));
}

export function buildAbstractionMemoryPromptContext(paths: WorkspacePaths, demand: string): PromptMemoryContext {
    return buildAbstractionMemoryPromptContextWithFocus(paths, {
        demand
    });
}

export function buildAbstractionMemoryPromptContextWithFocus(
    paths: WorkspacePaths,
    input: {
        demand: string;
        focusNodeId?: string;
    }
): PromptMemoryContext {
    const artifact = ensureAbstractionMemory(paths, { autoSync: true });
    if (artifact.entries.length === 0) {
        return {
            summaryLines: [
                'No abstraction memory entries were recorded yet.',
                'Proceed with mount-point and impact analysis, then create reusable abstractions only if no existing tool fits.'
            ],
            matches: [],
            recommendations: [],
            protocolActionCandidates: []
        };
    }

    const config = loadTriadConfig(paths);
    const maxPromptEntries = Math.max(1, config.abstractionMemory.maxPromptEntries);
    const focusNodeId = normalizeText(input.focusNodeId);
    const focusSourcePath = focusNodeId ? resolveFocusSourcePath(paths, focusNodeId) : '';
    const searched = searchAbstractionMemory(artifact, input.demand, maxPromptEntries);
    const recommendations = recommendAbstractionMemory(artifact, {
        query: input.demand,
        focusNodeId,
        focusSourcePath,
        limit: maxPromptEntries
    });
    const protocolActionCandidates = buildAbstractionProtocolActionCandidates(paths, {
        demand: input.demand,
        focusNodeId,
        limit: maxPromptEntries
    });
    const matches = searched.length > 0 ? searched.map((item) => item.entry) : artifact.entries.slice(0, maxPromptEntries);
    const summaryLines = [
        `Abstraction memory entries: ${artifact.summary.rememberedEntryCount} (${artifact.summary.contractEntryCount} contract, ${artifact.summary.abstractFunctionEntryCount} abstract function, ${artifact.summary.moduleEntryCount} module).`,
        `Before implementation: mount the feature, simulate impact, then search these reusable abstractions first.`,
        focusNodeId
            ? `Current focus anchor: ${focusNodeId}${focusSourcePath ? ` @ ${focusSourcePath}` : ''}.`
            : 'No explicit focus anchor was supplied, so recommendations rely on demand semantics only.',
        searched.length > 0
            ? `Relevant memory hits for current demand: ${searched.map((item) => item.entry.name).join(', ')}`
            : 'No direct demand hit was found, so the highest-reuse abstractions are shown as fallback candidates.',
        recommendations.length > 0
            ? `Recommended reuse candidates: ${recommendations.map((item) => item.entry.name).join(', ')}`
            : 'No strong recommendation could be formed from current demand and focus.',
        protocolActionCandidates.length > 0
            ? `Protocol seed candidates: ${protocolActionCandidates
                  .map((item) => `${item.action.op}:${'nodeId' in item.action ? item.action.nodeId : ''}`)
                  .join(', ')}`
            : 'No protocol seed candidate could be formed from current abstraction memory.'
    ];

    return {
        summaryLines,
        matches,
        recommendations,
        protocolActionCandidates
    };
}

export function formatAbstractionMemoryPromptJson(entries: AbstractionMemoryEntry[]) {
    return JSON.stringify(
        entries.map((entry) => ({
            kind: entry.kind,
            name: entry.name,
            primarySourcePath: entry.primarySourcePath,
            nodeIds: entry.nodeIds.slice(0, 8),
            relatedAbstractions: entry.relatedAbstractions.slice(0, 8),
            signatures: entry.signatures.slice(0, 4),
            reusabilityScore: entry.reusabilityScore,
            whyReusable: entry.whyReusable
        })),
        null,
        2
    );
}

export function formatAbstractionMemoryRecommendationsJson(recommendations: AbstractionMemoryRecommendation[]) {
    return JSON.stringify(
        recommendations.map((item) => ({
            kind: item.entry.kind,
            name: item.entry.name,
            primarySourcePath: item.entry.primarySourcePath,
            suggestedUsage: item.suggestedUsage,
            score: item.score,
            signatures: item.entry.signatures.slice(0, 4),
            rationale: item.rationale
        })),
        null,
        2
    );
}

export function formatAbstractionProtocolActionCandidatesJson(candidates: AbstractionProtocolActionCandidate[]) {
    return JSON.stringify(
        candidates.map((item) => ({
            kind: item.kind,
            score: item.score,
            basedOnEntry: item.basedOnEntry,
            action: item.action,
            rationale: item.rationale
        })),
        null,
        2
    );
}

function buildAbstractionMemory(paths: WorkspacePaths, config: TriadConfig): AbstractionMemoryArtifact {
    const triadNodes = readTriadNodesArtifact(paths.mapFile);
    const sourceSummaries = calculateAbstractionSummaryBySourcePath(triadNodes);
    const stableAnchors = resolveEffectiveStableAnchorsFromSources({
        configTopologyRisk: config.topologyRisk
    });
    const excludedStablePaths = new Set<string>();
    const excludedConfiguredPaths = new Set<string>();
    const includedPaths = new Set<string>();
    const summaryBySourcePath = new Map<string, AbstractionSourceSummary>();

    for (const summary of sourceSummaries) {
        const decision = decideSourceInclusion(summary.sourcePath, config, stableAnchors);
        if (decision === 'stable') {
            excludedStablePaths.add(summary.sourcePath);
            continue;
        }
        if (decision === 'configured') {
            excludedConfiguredPaths.add(summary.sourcePath);
            continue;
        }
        includedPaths.add(summary.sourcePath);
        summaryBySourcePath.set(summary.sourcePath, summary);
    }

    const filteredNodes = triadNodes.filter((node) => includedPaths.has(normalizeSourcePath(node.sourcePath)));
    const filteredSummaries = sourceSummaries.filter((summary) => includedPaths.has(summary.sourcePath));
    const filteredVariantClusters = detectFlatVariantClusters(filteredNodes);
    const filteredHotspots = detectAbstractionDeficitHotspots(filteredNodes);
    const contractAccumulators = collectContractMemory(filteredNodes, summaryBySourcePath);
    const contractEntries = buildContractEntries(contractAccumulators, summaryBySourcePath);
    const abstractFunctionAccumulators = collectAbstractFunctionMemory(filteredNodes, summaryBySourcePath);
    const abstractFunctionEntries = buildAbstractFunctionEntries(abstractFunctionAccumulators, summaryBySourcePath);
    const moduleEntries = buildModuleEntries(filteredSummaries, [...contractEntries, ...abstractFunctionEntries], config);
    const entries = [...contractEntries, ...abstractFunctionEntries, ...moduleEntries].sort(
        (left, right) =>
            right.reusabilityScore - left.reusabilityScore ||
            right.abstractionRatio - left.abstractionRatio ||
            left.name.localeCompare(right.name)
    );

    return {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        project: path.basename(paths.projectRoot),
        sourceMapFile: normalizePath(path.relative(paths.projectRoot, paths.mapFile)),
        summary: {
            scannedSourceCount: includedPaths.size,
            excludedStableSourceCount: excludedStablePaths.size,
            excludedConfiguredSourceCount: excludedConfiguredPaths.size,
            rememberedEntryCount: entries.length,
            contractEntryCount: contractEntries.length,
            abstractFunctionEntryCount: abstractFunctionEntries.length,
            moduleEntryCount: moduleEntries.length,
            hotspotCount: filteredHotspots.length,
            variantClusterCount: filteredVariantClusters.length
        },
        entries
    };
}

function buildEmptyAbstractionMemory(paths: WorkspacePaths): AbstractionMemoryArtifact {
    return {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        project: path.basename(paths.projectRoot),
        sourceMapFile: normalizePath(path.relative(paths.projectRoot, paths.mapFile)),
        summary: {
            scannedSourceCount: 0,
            excludedStableSourceCount: 0,
            excludedConfiguredSourceCount: 0,
            rememberedEntryCount: 0,
            contractEntryCount: 0,
            abstractFunctionEntryCount: 0,
            moduleEntryCount: 0,
            hotspotCount: 0,
            variantClusterCount: 0
        },
        entries: []
    };
}

function collectContractMemory(
    triadNodes: TopologyQualityNodeLike[],
    summaryBySourcePath: Map<string, AbstractionSourceSummary>
) {
    const accumulators = new Map<string, ContractMemoryAccumulator>();

    for (const node of triadNodes) {
        const nodeId = normalizeText(node.nodeId);
        const sourcePath = normalizeSourcePath(node.sourcePath);
        const abstraction = readAbstractionEvidence(node);
        const variantCluster = normalizeText(abstraction?.variantCluster);
        const sourceSummary = summaryBySourcePath.get(sourcePath);
        const abstractionRatio = sourceSummary?.abstractionRatio ?? 0;
        const implementsContracts = readStringList(abstraction?.implements);
        const extendsAbstract = readStringList(abstraction?.extendsAbstract);
        const dependsOnAbstractions = readStringList(abstraction?.dependsOnAbstractions);
        const relatedNames = Array.from(
            new Set([...implementsContracts, ...extendsAbstract, ...dependsOnAbstractions].filter(Boolean))
        );

        for (const contractName of implementsContracts) {
            const accumulator = ensureContractAccumulator(accumulators, contractName);
            accumulator.kindHints.add('provider');
            addNodeEvidence(accumulator, nodeId, sourcePath, variantCluster, abstractionRatio, relatedNames, ['implements']);
            if (nodeId) {
                accumulator.providerNodeIds.add(nodeId);
            }
        }

        for (const contractName of extendsAbstract) {
            const accumulator = ensureContractAccumulator(accumulators, contractName);
            accumulator.kindHints.add('provider');
            accumulator.kindHints.add('abstract_class');
            addNodeEvidence(
                accumulator,
                nodeId,
                sourcePath,
                variantCluster,
                abstractionRatio,
                relatedNames,
                ['extends_abstract']
            );
            if (nodeId) {
                accumulator.providerNodeIds.add(nodeId);
            }
        }

        for (const contractName of dependsOnAbstractions) {
            const accumulator = ensureContractAccumulator(accumulators, contractName);
            accumulator.kindHints.add('consumer');
            addNodeEvidence(
                accumulator,
                nodeId,
                sourcePath,
                variantCluster,
                abstractionRatio,
                relatedNames,
                ['depends_on_contract']
            );
            if (nodeId) {
                accumulator.consumerNodeIds.add(nodeId);
            }
        }
    }

    return accumulators;
}

function collectAbstractFunctionMemory(
    triadNodes: TopologyQualityNodeLike[],
    summaryBySourcePath: Map<string, AbstractionSourceSummary>
) {
    const accumulators = new Map<string, FunctionMemoryAccumulator>();

    for (const node of triadNodes) {
        const nodeId = normalizeText(node.nodeId);
        const sourcePath = normalizeSourcePath(node.sourcePath);
        const abstraction = readAbstractionEvidence(node);
        const variantCluster = normalizeText(abstraction?.variantCluster);
        const abstractFunctions = readStringList(abstraction?.abstractFunctions);
        const relatedNames = Array.from(
            new Set(
                [
                    ...readStringList(abstraction?.implements),
                    ...readStringList(abstraction?.extendsAbstract),
                    ...readStringList(abstraction?.dependsOnAbstractions)
                ].filter(Boolean)
            )
        );
        const abstractionRatio = summaryBySourcePath.get(sourcePath)?.abstractionRatio ?? 0;

        for (const signature of abstractFunctions) {
            const accumulator = ensureFunctionAccumulator(accumulators, signature);
            if (sourcePath) {
                accumulator.sourcePaths.add(sourcePath);
            }
            if (nodeId) {
                accumulator.nodeIds.add(nodeId);
                accumulator.tags.add(nodeId.toLowerCase());
            }
            if (variantCluster) {
                accumulator.variantClusters.add(variantCluster);
            }
            for (const relatedName of relatedNames) {
                const normalized = normalizeText(relatedName);
                if (normalized) {
                    accumulator.relatedAbstractions.add(normalized);
                }
            }
            for (const token of tokenize(signature)) {
                accumulator.tags.add(token);
            }
            if (abstractionRatio > 0) {
                accumulator.abstractionRatios.push(abstractionRatio);
            }
        }
    }

    return accumulators;
}

function buildContractEntries(
    accumulators: Map<string, ContractMemoryAccumulator>,
    summaryBySourcePath: Map<string, AbstractionSourceSummary>
) {
    return Array.from(accumulators.values())
        .map((accumulator) => {
            const sourcePaths = Array.from(accumulator.sourcePaths).sort();
            const providerNodeIds = Array.from(accumulator.providerNodeIds).sort();
            const consumerNodeIds = Array.from(accumulator.consumerNodeIds).sort();
            const nodeIds = Array.from(new Set([...providerNodeIds, ...consumerNodeIds])).sort();
            const primarySourcePath = choosePrimarySourcePath(sourcePaths, summaryBySourcePath);
            const abstractionRatio = average(accumulator.abstractionRatios);
            const relatedAbstractions = Array.from(accumulator.relatedAbstractions)
                .filter((entry) => entry !== accumulator.name)
                .sort();
            const variantClusters = Array.from(accumulator.variantClusters).sort();
            const kind = resolveContractEntryKind(accumulator);
            const reusabilityScore = calculateContractReusabilityScore({
                kind,
                sourcePathCount: sourcePaths.length,
                providerCount: providerNodeIds.length,
                consumerCount: consumerNodeIds.length,
                abstractionRatio,
                variantClusterCount: variantClusters.length
            });

            return {
                id: `memory:${sanitizeId(accumulator.name)}`,
                name: accumulator.name,
                kind,
                primarySourcePath,
                sourcePaths,
                nodeIds,
                providerNodeIds,
                consumerNodeIds,
                variantClusters,
                relatedAbstractions,
                signatures: [],
                tags: Array.from(accumulator.tags).sort(),
                abstractionRatio,
                reusabilityScore,
                whyReusable: buildContractWhyReusable({
                    name: accumulator.name,
                    kind,
                    sourcePathCount: sourcePaths.length,
                    providerCount: providerNodeIds.length,
                    consumerCount: consumerNodeIds.length,
                    variantClusters
                })
            } satisfies AbstractionMemoryEntry;
        })
        .filter((entry) => entry.name.length > 0 && entry.nodeIds.length > 0);
}

function buildAbstractFunctionEntries(
    accumulators: Map<string, FunctionMemoryAccumulator>,
    summaryBySourcePath: Map<string, AbstractionSourceSummary>
) {
    return Array.from(accumulators.values())
        .map((accumulator) => {
            const sourcePaths = Array.from(accumulator.sourcePaths).sort();
            const nodeIds = Array.from(accumulator.nodeIds).sort();
            const variantClusters = Array.from(accumulator.variantClusters).sort();
            const relatedAbstractions = Array.from(accumulator.relatedAbstractions).sort();
            const abstractionRatio = average(accumulator.abstractionRatios);
            const primarySourcePath = choosePrimarySourcePath(sourcePaths, summaryBySourcePath);
            const functionName = extractFunctionNameFromSignature(accumulator.signature);
            return {
                id: `memory:function:${sanitizeId(accumulator.signature)}`,
                name: functionName,
                kind: 'abstract_function' as const,
                primarySourcePath,
                sourcePaths,
                nodeIds,
                providerNodeIds: [],
                consumerNodeIds: [...nodeIds],
                variantClusters,
                relatedAbstractions,
                signatures: [accumulator.signature],
                tags: Array.from(accumulator.tags).sort(),
                abstractionRatio,
                reusabilityScore: calculateAbstractFunctionReusabilityScore({
                    sourcePathCount: sourcePaths.length,
                    nodeCount: nodeIds.length,
                    abstractionRatio,
                    variantClusterCount: variantClusters.length
                }),
                whyReusable: buildAbstractFunctionWhyReusable({
                    signature: accumulator.signature,
                    sourcePathCount: sourcePaths.length,
                    nodeCount: nodeIds.length,
                    relatedAbstractions,
                    variantClusters
                })
            } satisfies AbstractionMemoryEntry;
        })
        .filter((entry) => entry.name.length > 0 && entry.signatures.length > 0);
}

function buildModuleEntries(
    summaries: AbstractionSourceSummary[],
    contractEntries: AbstractionMemoryEntry[],
    config: TriadConfig
) {
    const contractsBySourcePath = new Map<string, string[]>();
    for (const entry of contractEntries) {
        for (const sourcePath of entry.sourcePaths) {
            const current = contractsBySourcePath.get(sourcePath) ?? [];
            current.push(entry.name);
            contractsBySourcePath.set(sourcePath, current);
        }
    }

    return summaries
        .filter((summary) => {
            if (summary.abstractionSignalCount <= 0) {
                return false;
            }
            return (
                summary.abstractionRatio >= config.abstractionMemory.minAbstractionRatio ||
                summary.role === 'abstraction_rich' ||
                summary.implementingNodes.length > 0 ||
                summary.dependentNodes.length > 0
            );
        })
        .map((summary) => {
            const relatedAbstractions = Array.from(new Set(contractsBySourcePath.get(summary.sourcePath) ?? []))
                .sort()
                .slice(0, 12);
            const basename = path.posix.basename(summary.sourcePath);
            const reusabilityScore = calculateModuleReusabilityScore(summary, relatedAbstractions.length);
            return {
                id: `memory:module:${sanitizeId(summary.sourcePath)}`,
                name: `module:${basename}`,
                kind: 'abstraction_module' as const,
                primarySourcePath: summary.sourcePath,
                sourcePaths: [summary.sourcePath],
                nodeIds: [...summary.nodeIds],
                providerNodeIds: [...summary.implementingNodes],
                consumerNodeIds: [...summary.dependentNodes],
                variantClusters: [...summary.variantClusters],
                relatedAbstractions,
                signatures: [],
                tags: buildModuleTags(summary),
                abstractionRatio: summary.abstractionRatio,
                reusabilityScore,
                whyReusable: buildModuleWhyReusable(summary, relatedAbstractions)
            } satisfies AbstractionMemoryEntry;
        });
}

function resolveContractEntryKind(accumulator: ContractMemoryAccumulator): AbstractionMemoryEntryKind {
    if (accumulator.kindHints.has('abstract_class')) {
        return 'abstract_class';
    }
    if (accumulator.kindHints.has('provider')) {
        return 'interface_or_contract';
    }
    return 'contract_dependency';
}

function choosePrimarySourcePath(
    sourcePaths: string[],
    summaryBySourcePath: Map<string, AbstractionSourceSummary>
) {
    return [...sourcePaths].sort((left, right) => {
        const leftRatio = summaryBySourcePath.get(left)?.abstractionRatio ?? 0;
        const rightRatio = summaryBySourcePath.get(right)?.abstractionRatio ?? 0;
        return rightRatio - leftRatio || left.localeCompare(right);
    })[0] ?? '';
}

function calculateContractReusabilityScore(input: {
    kind: AbstractionMemoryEntryKind;
    sourcePathCount: number;
    providerCount: number;
    consumerCount: number;
    abstractionRatio: number;
    variantClusterCount: number;
}) {
    const kindBonus =
        input.kind === 'abstract_class' ? 5 : input.kind === 'interface_or_contract' ? 4 : input.kind === 'contract_dependency' ? 2 : 1;
    return Math.round(
        kindBonus +
            input.sourcePathCount * 3 +
            input.providerCount * 5 +
            input.consumerCount * 4 +
            input.variantClusterCount * 2 +
            input.abstractionRatio * 10
    );
}

function calculateAbstractFunctionReusabilityScore(input: {
    sourcePathCount: number;
    nodeCount: number;
    abstractionRatio: number;
    variantClusterCount: number;
}) {
    return Math.round(
        6 +
            input.sourcePathCount * 3 +
            input.nodeCount * 4 +
            input.variantClusterCount * 2 +
            input.abstractionRatio * 10
    );
}

function calculateModuleReusabilityScore(summary: AbstractionSourceSummary, relatedAbstractionCount: number) {
    return Math.round(
        summary.abstractionSignalCount +
            summary.implementingNodes.length * 4 +
            summary.dependentNodes.length * 3 +
            relatedAbstractionCount * 2 +
            summary.abstractionRatio * 10
    );
}

function buildContractWhyReusable(input: {
    name: string;
    kind: AbstractionMemoryEntryKind;
    sourcePathCount: number;
    providerCount: number;
    consumerCount: number;
    variantClusters: string[];
}) {
    const parts = [
        `${input.name} already appears across ${input.sourcePathCount} source file(s).`,
        `${input.providerCount} provider node(s) and ${input.consumerCount} consumer node(s) are already wired to it.`
    ];
    if (input.kind === 'abstract_class') {
        parts.push('This is already acting as an abstract base, so extending it is safer than cloning concrete branches.');
    } else if (input.kind === 'interface_or_contract') {
        parts.push('This contract is already implemented, so it is a strong reuse anchor for new features.');
    } else {
        parts.push('Existing nodes already depend on this contract surface, which makes it a useful lookup target.');
    }
    if (input.variantClusters.length > 0) {
        parts.push(`It also touches variant cluster(s): ${input.variantClusters.join(', ')}.`);
    }
    return parts.join(' ');
}

function buildAbstractFunctionWhyReusable(input: {
    signature: string;
    sourcePathCount: number;
    nodeCount: number;
    relatedAbstractions: string[];
    variantClusters: string[];
}) {
    const parts = [
        `Abstract function signature ${input.signature} is already discoverable across ${input.sourcePathCount} source file(s).`,
        `${input.nodeCount} mapped node(s) already live in files that expose this contract shape.`
    ];
    if (input.relatedAbstractions.length > 0) {
        parts.push(`It is adjacent to reusable abstractions: ${input.relatedAbstractions.slice(0, 6).join(', ')}.`);
    }
    if (input.variantClusters.length > 0) {
        parts.push(`It also appears near variant cluster(s): ${input.variantClusters.join(', ')}.`);
    }
    return parts.join(' ');
}

function buildModuleWhyReusable(summary: AbstractionSourceSummary, relatedAbstractions: string[]) {
    const parts = [
        `${summary.sourcePath} has abstraction_ratio=${summary.abstractionRatio.toFixed(3)} and role=${summary.role}.`,
        `It contains ${summary.abstractionSignalCount} abstraction signal(s) and ${summary.nodeIds.length} mapped node(s).`
    ];
    if (relatedAbstractions.length > 0) {
        parts.push(`Known reusable abstractions here: ${relatedAbstractions.slice(0, 6).join(', ')}.`);
    }
    if (summary.variantClusters.length > 0) {
        parts.push(`Variant clusters seen here: ${summary.variantClusters.join(', ')}.`);
    }
    return parts.join(' ');
}

function buildModuleTags(summary: AbstractionSourceSummary) {
    const tokens = new Set<string>([
        summary.role,
        ...tokenize(summary.sourcePath),
        ...summary.variantClusters.flatMap((entry) => tokenize(entry))
    ]);
    return Array.from(tokens).sort();
}

function ensureContractAccumulator(
    accumulators: Map<string, ContractMemoryAccumulator>,
    contractName: string
): ContractMemoryAccumulator {
    const normalizedName = normalizeText(contractName);
    const existing = accumulators.get(normalizedName);
    if (existing) {
        return existing;
    }
    const created: ContractMemoryAccumulator = {
        name: normalizedName,
        sourcePaths: new Set<string>(),
        providerNodeIds: new Set<string>(),
        consumerNodeIds: new Set<string>(),
        variantClusters: new Set<string>(),
        relatedAbstractions: new Set<string>(),
        tags: new Set<string>(tokenize(normalizedName)),
        abstractionRatios: [],
        kindHints: new Set<'provider' | 'consumer' | 'abstract_class'>()
    };
    accumulators.set(normalizedName, created);
    return created;
}

function ensureFunctionAccumulator(
    accumulators: Map<string, FunctionMemoryAccumulator>,
    signature: string
): FunctionMemoryAccumulator {
    const normalizedSignature = normalizeText(signature);
    const existing = accumulators.get(normalizedSignature);
    if (existing) {
        return existing;
    }
    const created: FunctionMemoryAccumulator = {
        signature: normalizedSignature,
        sourcePaths: new Set<string>(),
        nodeIds: new Set<string>(),
        variantClusters: new Set<string>(),
        relatedAbstractions: new Set<string>(),
        tags: new Set<string>(tokenize(normalizedSignature)),
        abstractionRatios: []
    };
    accumulators.set(normalizedSignature, created);
    return created;
}

function addNodeEvidence(
    accumulator: ContractMemoryAccumulator,
    nodeId: string,
    sourcePath: string,
    variantCluster: string,
    abstractionRatio: number,
    relatedNames: string[],
    tags: string[]
) {
    if (sourcePath) {
        accumulator.sourcePaths.add(sourcePath);
    }
    if (nodeId) {
        accumulator.tags.add(nodeId.toLowerCase());
    }
    if (variantCluster) {
        accumulator.variantClusters.add(variantCluster);
    }
    for (const relatedName of relatedNames) {
        const normalized = normalizeText(relatedName);
        if (normalized) {
            accumulator.relatedAbstractions.add(normalized);
        }
    }
    for (const tag of tags) {
        accumulator.tags.add(tag);
    }
    if (abstractionRatio > 0) {
        accumulator.abstractionRatios.push(abstractionRatio);
    }
}

function buildSearchHaystack(entry: AbstractionMemoryEntry) {
    return [
        entry.name,
        entry.kind,
        entry.primarySourcePath,
        entry.sourcePaths.join(' '),
        entry.nodeIds.join(' '),
        entry.providerNodeIds.join(' '),
        entry.consumerNodeIds.join(' '),
        entry.relatedAbstractions.join(' '),
        entry.signatures.join(' '),
        entry.tags.join(' '),
        entry.whyReusable
    ]
        .join(' ')
        .toLowerCase();
}

function buildReuseSeedCandidate(
    recommendation: AbstractionMemoryRecommendation,
    nodeById: Map<string, TopologyQualityNodeLike>,
    focusNodeId: string
) {
    const targetNodeId = choosePreferredReuseNodeId(recommendation.entry, focusNodeId);
    if (!targetNodeId || !nodeById.has(targetNodeId)) {
        return undefined;
    }

    return {
        kind: 'reuse_seed' as const,
        action: {
            op: 'reuse' as const,
            nodeId: targetNodeId,
            reason: `Reuse candidate seeded from abstraction memory entry ${recommendation.entry.name}.`,
            confidence: normalizeCandidateConfidence(recommendation.score)
        },
        score: recommendation.score + 1,
        basedOnEntry: {
            id: recommendation.entry.id,
            name: recommendation.entry.name,
            kind: recommendation.entry.kind
        },
        rationale: [
            ...recommendation.rationale,
            `Target existing node ${targetNodeId} before proposing a fresh child.`
        ].slice(0, 4)
    } satisfies AbstractionProtocolActionCandidate;
}

function buildModifySeedCandidate(
    recommendation: AbstractionMemoryRecommendation,
    nodeById: Map<string, TopologyQualityNodeLike>,
    focusNodeId: string,
    demand: string
) {
    const targetNodeId =
        (focusNodeId && nodeById.has(focusNodeId) ? focusNodeId : '') ||
        choosePreferredModifyNodeId(recommendation.entry, nodeById);
    if (!targetNodeId) {
        return undefined;
    }

    const node = nodeById.get(targetNodeId);
    if (!node || !isTriadNodeDefinitionLike(node)) {
        return undefined;
    }

    return {
        kind: 'modify_seed' as const,
        action: {
            op: 'modify' as const,
            nodeId: targetNodeId,
            category: normalizeText(node.category) || undefined,
            sourcePath: normalizeSourcePath(node.sourcePath) || undefined,
            fission: {
                problem: normalizeDemandProblemHint(demand, node.fission.problem),
                demand: [...node.fission.demand],
                answer: [...node.fission.answer],
                evidence: node.fission.evidence
            },
            reuse: [recommendation.entry.name, ...recommendation.entry.signatures].filter(Boolean).slice(0, 4),
            reason: `Modify seed: extend ${targetNodeId} behind reusable abstraction ${recommendation.entry.name} before creating new topology.`,
            confidence: normalizeCandidateConfidence(recommendation.score - 1)
        },
        score: recommendation.score,
        basedOnEntry: {
            id: recommendation.entry.id,
            name: recommendation.entry.name,
            kind: recommendation.entry.kind
        },
        rationale: [
            ...recommendation.rationale,
            `Current focus can likely absorb the demand through ${recommendation.entry.name}.`
        ].slice(0, 4)
    } satisfies AbstractionProtocolActionCandidate;
}

function dedupeProtocolActionCandidates(candidates: AbstractionProtocolActionCandidate[]) {
    const seen = new Set<string>();
    return candidates
        .filter((candidate) => {
            const nodeId = 'nodeId' in candidate.action ? candidate.action.nodeId : '';
            const key = `${candidate.kind}:${candidate.action.op}:${nodeId}:${candidate.basedOnEntry.id}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        })
        .sort(
            (left, right) =>
                right.score - left.score ||
                usageRank(
                    left.kind === 'reuse_seed' ? 'reuse_first' : 'adapt_before_create'
                ) -
                    usageRank(right.kind === 'reuse_seed' ? 'reuse_first' : 'adapt_before_create') ||
                left.basedOnEntry.name.localeCompare(right.basedOnEntry.name)
        );
}

function calculateFocusPathBonus(entry: AbstractionMemoryEntry, focusSourcePath: string) {
    if (!focusSourcePath) {
        return 0;
    }

    if (entry.primarySourcePath === focusSourcePath || entry.sourcePaths.includes(focusSourcePath)) {
        return 6;
    }

    const focusSegments = focusSourcePath.split('/').filter(Boolean);
    const entrySegments = entry.primarySourcePath.split('/').filter(Boolean);
    const sharedPrefix = countSharedPrefix(focusSegments, entrySegments);
    return sharedPrefix >= 2 ? 3 : sharedPrefix >= 1 ? 1 : 0;
}

function calculateFocusNodeBonus(
    entry: AbstractionMemoryEntry,
    focusNodeId: string,
    focusTokens: Set<string>
) {
    let bonus = 0;
    if (focusNodeId && entry.nodeIds.includes(focusNodeId)) {
        bonus += 5;
    }

    const overlap = entry.tags.filter((tag) => focusTokens.has(tag)).length;
    if (overlap > 0) {
        bonus += Math.min(4, overlap);
    }
    return bonus;
}

function decideSourceInclusion(
    sourcePath: string,
    config: TriadConfig,
    stableAnchors: ReturnType<typeof resolveEffectiveStableAnchorsFromSources>
) {
    const normalizedPath = normalizeSourcePath(sourcePath);
    if (!normalizedPath) {
        return 'configured' as const;
    }

    if (config.abstractionMemory.excludeMatureStableSources) {
        const stableMatch =
            stableAnchors.matureStableSourcePaths.some((entry) => normalizeSourcePath(entry) === normalizedPath) ||
            stableAnchors.matureStableSourcePathPatterns.some((pattern) => matchesSourcePathPattern(normalizedPath, pattern));
        if (stableMatch) {
            return 'stable' as const;
        }
    }

    const configuredMatch =
        config.abstractionMemory.excludeSourcePaths.some((entry) => normalizeSourcePath(entry) === normalizedPath) ||
        config.abstractionMemory.excludeSourcePathPatterns.some((pattern) => matchesSourcePathPattern(normalizedPath, pattern));
    if (configuredMatch) {
        return 'configured' as const;
    }

    return 'include' as const;
}

function isAbstractionMemoryStale(paths: WorkspacePaths) {
    if (!fs.existsSync(paths.abstractionMemoryFile)) {
        return true;
    }

    const memoryMtime = fs.statSync(paths.abstractionMemoryFile).mtimeMs;
    const candidateFiles = [paths.mapFile, paths.configFile, paths.profileFile].filter((filePath) => fs.existsSync(filePath));
    return candidateFiles.some((filePath) => fs.statSync(filePath).mtimeMs > memoryMtime);
}

function readAbstractionEvidence(node: TopologyQualityNodeLike) {
    return (node.fission as { evidence?: { abstraction?: Record<string, unknown> } } | undefined)?.evidence?.abstraction;
}

function readStringList(value: unknown) {
    if (!Array.isArray(value)) {
        return [] as string[];
    }
    return Array.from(
        new Set(
            value
                .map((entry) => normalizeText(entry))
                .filter(Boolean)
        )
    ).sort();
}

function matchesSourcePathPattern(normalizedPath: string, pattern: string) {
    const normalizedPattern = normalizeSourcePath(pattern).toLowerCase();
    if (!normalizedPattern) {
        return false;
    }

    if (isRegexLikePattern(normalizedPattern)) {
        try {
            return new RegExp(normalizedPattern, 'i').test(normalizedPath);
        } catch {
            return false;
        }
    }

    return normalizedPath === normalizedPattern || normalizedPath.includes(normalizedPattern);
}

function isRegexLikePattern(value: string) {
    return value.startsWith('^') || value.endsWith('$') || value.includes('.*') || value.includes('\\');
}

function normalizeText(value: unknown) {
    return String(value ?? '').trim();
}

function normalizeSourcePath(value: unknown) {
    return normalizePath(normalizeText(value)).replace(/^\.?\//, '').replace(/\/{2,}/g, '/');
}

function resolveFocusSourcePath(paths: WorkspacePaths, focusNodeId: string) {
    const node = readTriadNodesArtifact(paths.mapFile).find((entry) => normalizeText(entry.nodeId) === focusNodeId);
    return normalizeSourcePath(node?.sourcePath);
}

function choosePreferredReuseNodeId(entry: AbstractionMemoryEntry, focusNodeId: string) {
    if (focusNodeId && entry.nodeIds.includes(focusNodeId)) {
        return focusNodeId;
    }
    return entry.providerNodeIds[0] ?? entry.nodeIds[0] ?? '';
}

function choosePreferredModifyNodeId(
    entry: AbstractionMemoryEntry,
    nodeById: Map<string, TopologyQualityNodeLike>
) {
    for (const nodeId of [...entry.consumerNodeIds, ...entry.providerNodeIds, ...entry.nodeIds]) {
        if (nodeById.has(nodeId)) {
            return nodeId;
        }
    }
    return '';
}

function normalizeCandidateConfidence(score: number) {
    const normalized = Math.max(0.35, Math.min(0.92, score / 40));
    return Number(normalized.toFixed(2));
}

function normalizeDemandProblemHint(demand: string, fallbackProblem: string) {
    const normalizedDemand = normalizeText(demand);
    if (!normalizedDemand) {
        return fallbackProblem;
    }
    return `${fallbackProblem} | absorb demand: ${normalizedDemand}`;
}

function extractFunctionNameFromSignature(signature: string) {
    const normalized = normalizeText(signature);
    const match = normalized.match(/^(.+?)\s*\(/);
    return match?.[1]?.trim() || normalized;
}

function tokenize(value: string) {
    return Array.from(
        new Set(
            normalizeText(value)
                .toLowerCase()
                .split(/[^a-z0-9_]+/i)
                .map((entry) => entry.trim())
                .filter((entry) => entry.length >= 2)
        )
    );
}

function fuzzyContains(haystack: string, term: string) {
    return haystack.includes(term.replace(/_/g, '')) || haystack.includes(term.replace(/-/g, ''));
}

function countSharedPrefix(left: string[], right: string[]) {
    let count = 0;
    while (count < left.length && count < right.length && left[count] === right[count]) {
        count += 1;
    }
    return count;
}

function average(values: number[]) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sanitizeId(value: string) {
    return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'memory';
}

function usageRank(value: AbstractionMemoryRecommendation['suggestedUsage']) {
    return value === 'reuse_first' ? 2 : 1;
}

function isTriadNodeDefinitionLike(node: TopologyQualityNodeLike): node is TriadNodeDefinition {
    return (
        typeof node?.nodeId === 'string' &&
        typeof node?.fission?.problem === 'string' &&
        Array.isArray(node?.fission?.demand) &&
        Array.isArray(node?.fission?.answer)
    );
}
