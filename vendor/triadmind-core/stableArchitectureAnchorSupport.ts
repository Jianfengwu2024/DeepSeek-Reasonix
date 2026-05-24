import type { TriadConfig } from './config';
import {
    isStableAnchorRejectionRecord,
    loadDreamFeedbackLedger,
    type DreamFeedbackLedger,
    type DreamProposalRejectionRecord
} from './dreamFeedbackSupport';
import type { WorkspacePaths } from './workspace';

export type StableArchitectureAnchorOptions = {
    matureStableNodeIds: string[];
    matureStableNodePatterns: string[];
    matureStableSourcePaths: string[];
    matureStableSourcePathPatterns: string[];
};

export interface StableArchitectureAnchorEntry {
    source: 'config' | 'feedback';
    matchKind: 'node_id' | 'node_pattern' | 'source_path' | 'source_path_pattern';
    value: string;
    proposalId?: string;
    reasonCode?: string;
    recordedAt?: string;
}

export interface EffectiveStableArchitectureAnchors extends StableArchitectureAnchorOptions {
    entries: StableArchitectureAnchorEntry[];
}

export function resolveEffectiveStableAnchors(
    paths: Pick<WorkspacePaths, 'projectRoot' | 'dreamFeedbackFile'>,
    configTopologyRisk?: Partial<StableArchitectureAnchorOptions>
) {
    const feedbackLoad = loadDreamFeedbackLedger(paths);
    return {
        loadStatus: feedbackLoad.status,
        stableAnchors: resolveEffectiveStableAnchorsFromSources({
            configTopologyRisk,
            feedbackLedger: feedbackLoad.ledger
        })
    };
}

export function resolveEffectiveStableAnchorsFromSources(input: {
    configTopologyRisk?: Partial<StableArchitectureAnchorOptions> | TriadConfig['topologyRisk'];
    feedbackLedger?: DreamFeedbackLedger;
}) {
    const matureStableNodeIds: string[] = [];
    const matureStableNodePatterns: string[] = [];
    const matureStableSourcePaths: string[] = [];
    const matureStableSourcePathPatterns: string[] = [];
    const entries: StableArchitectureAnchorEntry[] = [];

    const nodeIdSeen = new Set<string>();
    const nodePatternSeen = new Set<string>();
    const sourcePathSeen = new Set<string>();
    const sourcePathPatternSeen = new Set<string>();

    const configTopologyRisk = input.configTopologyRisk;
    addConfigEntries(configTopologyRisk?.matureStableNodeIds, 'node_id', matureStableNodeIds, nodeIdSeen, entries);
    addConfigEntries(configTopologyRisk?.matureStableNodePatterns, 'node_pattern', matureStableNodePatterns, nodePatternSeen, entries);
    addConfigEntries(configTopologyRisk?.matureStableSourcePaths, 'source_path', matureStableSourcePaths, sourcePathSeen, entries, true);
    addConfigEntries(
        configTopologyRisk?.matureStableSourcePathPatterns,
        'source_path_pattern',
        matureStableSourcePathPatterns,
        sourcePathPatternSeen,
        entries,
        true
    );

    for (const record of input.feedbackLedger?.rejections ?? []) {
        if (!isStableAnchorRejectionRecord(record)) {
            continue;
        }

        const stableAnchorNodeId = normalizeText(record.stableAnchorNodeId);
        const stableAnchorSourcePath = normalizeSourcePath(record.stableAnchorSourcePath);
        const fallbackSourcePath = normalizeSourcePath(record.sourcePath);
        const fallbackTargetNodeId = deriveFallbackStableAnchorNodeId(record);

        addFeedbackEntry(
            stableAnchorNodeId || fallbackTargetNodeId,
            'node_id',
            matureStableNodeIds,
            nodeIdSeen,
            entries,
            record
        );
        addFeedbackEntry(
            stableAnchorSourcePath || fallbackSourcePath,
            'source_path',
            matureStableSourcePaths,
            sourcePathSeen,
            entries,
            record
        );
    }

    return {
        matureStableNodeIds,
        matureStableNodePatterns,
        matureStableSourcePaths,
        matureStableSourcePathPatterns,
        entries
    } satisfies EffectiveStableArchitectureAnchors;
}

function addConfigEntries(
    values: string[] | undefined,
    matchKind: StableArchitectureAnchorEntry['matchKind'],
    target: string[],
    seen: Set<string>,
    entries: StableArchitectureAnchorEntry[],
    normalizeAsPath = false
) {
    for (const rawValue of values ?? []) {
        const value = normalizeAsPath ? normalizeSourcePath(rawValue) : normalizeText(rawValue);
        if (!value || seen.has(value)) {
            continue;
        }
        seen.add(value);
        target.push(value);
        entries.push({
            source: 'config',
            matchKind,
            value
        });
    }
}

function addFeedbackEntry(
    rawValue: string,
    matchKind: StableArchitectureAnchorEntry['matchKind'],
    target: string[],
    seen: Set<string>,
    entries: StableArchitectureAnchorEntry[],
    record: DreamProposalRejectionRecord
) {
    const value = matchKind === 'source_path' || matchKind === 'source_path_pattern' ? normalizeSourcePath(rawValue) : normalizeText(rawValue);
    if (!value) {
        return;
    }
    if (!seen.has(value)) {
        seen.add(value);
        target.push(value);
    }
    entries.push({
        source: 'feedback',
        matchKind,
        value,
        proposalId: normalizeText(record.proposalId) || undefined,
        reasonCode: normalizeText(record.reasonCode) || undefined,
        recordedAt: normalizeText(record.recordedAt) || undefined
    });
}

function deriveFallbackStableAnchorNodeId(record: DreamProposalRejectionRecord) {
    const targetNodeIds = Array.isArray(record.targetNodeIds)
        ? record.targetNodeIds.map((entry) => normalizeText(entry)).filter(Boolean)
        : [];
    if (targetNodeIds.length === 1) {
        return targetNodeIds[0];
    }
    return '';
}

function normalizeText(value: unknown) {
    return String(value ?? '').trim();
}

function normalizeSourcePath(value: unknown) {
    return normalizeText(value)
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '')
        .replace(/\/{2,}/g, '/');
}
