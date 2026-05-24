import * as fs from 'fs';
import { TriadConfig } from './config';
import { resolveEffectiveStableAnchorsFromSources } from './stableArchitectureAnchorSupport';
import { isMatureStableArchitectureNode, MatureStableArchitectureOptions, TopologyRiskNodeLike } from './topologyRiskSupport';
import { WorkspacePaths, normalizePath } from './workspace';

export type ImpactTier = 'exempt' | 'advisory' | 'strict';

export interface ImpactTierEntry {
    nodeId: string;
    sourcePath?: string;
    chainLength: number;
    tier: ImpactTier;
    forced: boolean;
    stableAnchor: boolean;
}

export interface ImpactTierSummary {
    available: boolean;
    protocolFile: string;
    shortChainMax: number;
    mediumChainMax: number;
    entries: ImpactTierEntry[];
    impactedNodeIds: Set<string>;
    impactedSourcePaths: Set<string>;
    notes: string[];
}

type ImpactNodeLike = TopologyRiskNodeLike & { sourcePath?: string; nodeId?: string };

const TIER_RANK: Record<ImpactTier, number> = {
    exempt: 0,
    advisory: 1,
    strict: 2
};

export function loadImpactTierSummary(
    paths: Pick<WorkspacePaths, 'impactProtocolFile' | 'dreamFeedbackFile'>,
    triadNodes: ImpactNodeLike[],
    config: Pick<TriadConfig, 'impactTiers' | 'topologyRisk'>,
    stableAnchors?: MatureStableArchitectureOptions
): ImpactTierSummary {
    const notes: string[] = [];
    const configuredAnchors =
        stableAnchors ??
        resolveEffectiveStableAnchorsFromSources({
            configTopologyRisk: config.topologyRisk
        });
    const protocol = readJsonObject(paths.impactProtocolFile);
    if (!protocol) {
        return createEmptySummary(paths.impactProtocolFile, config, ['impact protocol not found']);
    }

    const rawEntries = extractImpactEntries(protocol);
    if (rawEntries.length === 0) {
        notes.push('impact protocol contains no impactedNodes/actions entries; full-scope fallback is recommended');
    }

    const nodeById = new Map(
        triadNodes
            .map((node) => [normalizeText(node.nodeId), node] as const)
            .filter(([nodeId]) => Boolean(nodeId))
    );
    const entriesByNodeId = new Map<string, ImpactTierEntry>();
    const entriesBySourcePath = new Map<string, ImpactTierEntry>();

    for (const raw of rawEntries) {
        const nodeId = normalizeText(raw.nodeId);
        const sourcePath = normalizeSourcePath(raw.sourcePath);
        if (!nodeId && !sourcePath) {
            continue;
        }
        const node = nodeById.get(nodeId);
        const stableAnchor = node ? isMatureStableArchitectureNode(node, configuredAnchors) : false;
        const forcedTier = resolveForcedTier(config.impactTiers.forceTier, nodeId, sourcePath);
        const tier = stableAnchor ? 'exempt' : forcedTier ?? classifyImpactTier(raw.chainLength, config.impactTiers);
        const entry: ImpactTierEntry = {
            nodeId,
            sourcePath,
            chainLength: raw.chainLength,
            tier,
            forced: Boolean(forcedTier),
            stableAnchor
        };
        if (nodeId) {
            entriesByNodeId.set(nodeId, mergeImpactEntries(entriesByNodeId.get(nodeId), entry));
        }
        if (sourcePath) {
            entriesBySourcePath.set(sourcePath, mergeImpactEntries(entriesBySourcePath.get(sourcePath), entry));
        }
    }

    const entries = Array.from(entriesByNodeId.values());
    for (const sourceEntry of entriesBySourcePath.values()) {
        if (!sourceEntry.nodeId || !entriesByNodeId.has(sourceEntry.nodeId)) {
            entries.push(sourceEntry);
        }
    }

    return {
        available: entries.length > 0,
        protocolFile: paths.impactProtocolFile,
        shortChainMax: config.impactTiers.shortChainMax,
        mediumChainMax: config.impactTiers.mediumChainMax,
        entries,
        impactedNodeIds: new Set(entries.map((entry) => entry.nodeId).filter(Boolean)),
        impactedSourcePaths: new Set(entries.map((entry) => normalizeSourcePath(entry.sourcePath)).filter(Boolean)),
        notes
    };
}

export function classifyImpactTier(
    chainLength: number | undefined,
    config: Pick<TriadConfig['impactTiers'], 'shortChainMax' | 'mediumChainMax'>
): ImpactTier {
    const length = Number.isFinite(chainLength) ? Math.max(0, Math.floor(chainLength as number)) : config.mediumChainMax + 1;
    if (length <= config.shortChainMax) {
        return 'exempt';
    }
    if (length <= config.mediumChainMax) {
        return 'advisory';
    }
    return 'strict';
}

export function filterNodesForImpactThreshold<T extends ImpactNodeLike>(
    nodes: T[],
    summary: ImpactTierSummary,
    threshold: number | undefined,
    options: { keepWhenUnavailable?: boolean } = {}
): T[] {
    const minLength = normalizeThreshold(threshold);
    if (typeof minLength !== 'number') {
        return nodes;
    }
    if (!summary.available) {
        return options.keepWhenUnavailable === false ? [] : nodes;
    }
    return nodes.filter((node) => {
        const entry = findImpactEntryForNode(summary, node);
        if (!entry) {
            return false;
        }
        if (entry.stableAnchor || entry.tier === 'exempt') {
            return false;
        }
        return entry.chainLength >= minLength;
    });
}

export function filterNodesToImpactScope<T extends ImpactNodeLike>(
    nodes: T[],
    summary: ImpactTierSummary,
    options: { includeAdvisory?: boolean; includeStrict?: boolean } = {}
): T[] {
    if (!summary.available) {
        return nodes;
    }
    const includeAdvisory = options.includeAdvisory !== false;
    const includeStrict = options.includeStrict !== false;
    return nodes.filter((node) => {
        const entry = findImpactEntryForNode(summary, node);
        if (!entry || entry.stableAnchor || entry.tier === 'exempt') {
            return false;
        }
        if (entry.tier === 'advisory') {
            return includeAdvisory;
        }
        return includeStrict;
    });
}

export function findImpactEntryForNode(summary: ImpactTierSummary, node: ImpactNodeLike) {
    const nodeId = normalizeText(node.nodeId);
    const sourcePath = normalizeSourcePath(node.sourcePath);
    return (
        summary.entries.find((entry) => entry.nodeId && entry.nodeId === nodeId) ??
        summary.entries.find((entry) => entry.sourcePath && normalizeSourcePath(entry.sourcePath) === sourcePath)
    );
}

export function hasImpactTierAtLeast(tier: ImpactTier, minimum: ImpactTier) {
    return TIER_RANK[tier] >= TIER_RANK[minimum];
}

function createEmptySummary(
    protocolFile: string,
    config: Pick<TriadConfig, 'impactTiers'>,
    notes: string[]
): ImpactTierSummary {
    return {
        available: false,
        protocolFile,
        shortChainMax: config.impactTiers.shortChainMax,
        mediumChainMax: config.impactTiers.mediumChainMax,
        entries: [],
        impactedNodeIds: new Set(),
        impactedSourcePaths: new Set(),
        notes
    };
}

function extractImpactEntries(protocol: Record<string, unknown>) {
    const fromImpactedNodes = Array.isArray(protocol.impactedNodes)
        ? protocol.impactedNodes.map((entry) => extractImpactEntry(entry)).filter(Boolean)
        : [];
    if (fromImpactedNodes.length > 0) {
        return fromImpactedNodes as Array<{ nodeId: string; sourcePath?: string; chainLength: number }>;
    }

    const actions = Array.isArray(protocol.actions) ? protocol.actions : [];
    const fallback: Array<{ nodeId: string; sourcePath?: string; chainLength: number }> = [];
    for (const rawAction of actions) {
        if (!rawAction || typeof rawAction !== 'object') {
            continue;
        }
        const action = rawAction as Record<string, unknown>;
        const directNodeId = normalizeText(action.nodeId);
        const parentNodeId = normalizeText(action.parentNodeId);
        const nestedNode = action.node && typeof action.node === 'object' ? (action.node as Record<string, unknown>) : undefined;
        const nestedNodeId = normalizeText(nestedNode?.nodeId);
        for (const nodeId of [directNodeId, parentNodeId, nestedNodeId].filter(Boolean)) {
            fallback.push({ nodeId, chainLength: 0 });
        }
    }
    return fallback;
}

function extractImpactEntry(raw: unknown) {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const entry = raw as Record<string, unknown>;
    const nestedNode = entry.node && typeof entry.node === 'object' ? (entry.node as Record<string, unknown>) : undefined;
    const nodeId = firstText(entry.nodeId, entry.id, entry.targetNodeId, entry.leafNodeId, nestedNode?.nodeId);
    const sourcePath = firstText(entry.sourcePath, entry.path, entry.file, nestedNode?.sourcePath);
    const chainLength = deriveChainLength(entry);
    if (!nodeId && !sourcePath) {
        return undefined;
    }
    return {
        nodeId,
        sourcePath,
        chainLength
    };
}

function deriveChainLength(entry: Record<string, unknown>) {
    for (const key of ['pathEdges', 'edgeCount', 'hops', 'chainLength', 'impactChainLength', 'distance']) {
        const value = entry[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return Math.max(0, Math.floor(value));
        }
        if (Array.isArray(value)) {
            return Math.max(0, value.length);
        }
    }
    const pathValue = entry.path;
    if (Array.isArray(pathValue)) {
        return Math.max(0, pathValue.length - 1);
    }
    const edges = entry.edges;
    if (Array.isArray(edges)) {
        return Math.max(0, edges.length);
    }
    return 0;
}

function mergeImpactEntries(existing: ImpactTierEntry | undefined, next: ImpactTierEntry): ImpactTierEntry {
    if (!existing) {
        return next;
    }
    if (TIER_RANK[next.tier] > TIER_RANK[existing.tier]) {
        return next;
    }
    if (TIER_RANK[next.tier] === TIER_RANK[existing.tier] && next.chainLength > existing.chainLength) {
        return next;
    }
    return existing;
}

function resolveForcedTier(forceTier: Record<string, ImpactTier> | undefined, nodeId: string, sourcePath: string) {
    for (const [rawKey, tier] of Object.entries(forceTier ?? {})) {
        const key = normalizeText(rawKey);
        if (!key) {
            continue;
        }
        if (key === nodeId || normalizeSourcePath(key) === sourcePath) {
            return tier;
        }
        if (key.startsWith('/') && key.endsWith('/')) {
            try {
                const pattern = new RegExp(key.slice(1, -1));
                if (pattern.test(nodeId) || pattern.test(sourcePath)) {
                    return tier;
                }
            } catch {
                continue;
            }
        }
    }
    return undefined;
}

function readJsonObject(filePath: string) {
    if (!fs.existsSync(filePath)) {
        return undefined;
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
    } catch {
        return undefined;
    }
}

function firstText(...values: unknown[]) {
    for (const value of values) {
        const text = normalizeText(value);
        if (text) {
            return text;
        }
    }
    return '';
}

function normalizeThreshold(value: number | undefined) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return undefined;
}

function normalizeText(value: unknown) {
    return String(value ?? '').trim();
}

function normalizeSourcePath(value: unknown) {
    return normalizePath(String(value ?? ''))
        .replace(/^\.?\//, '')
        .replace(/\/{2,}/g, '/')
        .trim();
}
