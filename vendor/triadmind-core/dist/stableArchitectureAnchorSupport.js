"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEffectiveStableAnchors = resolveEffectiveStableAnchors;
exports.resolveEffectiveStableAnchorsFromSources = resolveEffectiveStableAnchorsFromSources;
const dreamFeedbackSupport_1 = require("./dreamFeedbackSupport");
function resolveEffectiveStableAnchors(paths, configTopologyRisk) {
    const feedbackLoad = (0, dreamFeedbackSupport_1.loadDreamFeedbackLedger)(paths);
    return {
        loadStatus: feedbackLoad.status,
        stableAnchors: resolveEffectiveStableAnchorsFromSources({
            configTopologyRisk,
            feedbackLedger: feedbackLoad.ledger
        })
    };
}
function resolveEffectiveStableAnchorsFromSources(input) {
    const matureStableNodeIds = [];
    const matureStableNodePatterns = [];
    const matureStableSourcePaths = [];
    const matureStableSourcePathPatterns = [];
    const entries = [];
    const nodeIdSeen = new Set();
    const nodePatternSeen = new Set();
    const sourcePathSeen = new Set();
    const sourcePathPatternSeen = new Set();
    const configTopologyRisk = input.configTopologyRisk;
    addConfigEntries(configTopologyRisk?.matureStableNodeIds, 'node_id', matureStableNodeIds, nodeIdSeen, entries);
    addConfigEntries(configTopologyRisk?.matureStableNodePatterns, 'node_pattern', matureStableNodePatterns, nodePatternSeen, entries);
    addConfigEntries(configTopologyRisk?.matureStableSourcePaths, 'source_path', matureStableSourcePaths, sourcePathSeen, entries, true);
    addConfigEntries(configTopologyRisk?.matureStableSourcePathPatterns, 'source_path_pattern', matureStableSourcePathPatterns, sourcePathPatternSeen, entries, true);
    for (const record of input.feedbackLedger?.rejections ?? []) {
        if (!(0, dreamFeedbackSupport_1.isStableAnchorRejectionRecord)(record)) {
            continue;
        }
        const stableAnchorNodeId = normalizeText(record.stableAnchorNodeId);
        const stableAnchorSourcePath = normalizeSourcePath(record.stableAnchorSourcePath);
        const fallbackSourcePath = normalizeSourcePath(record.sourcePath);
        const fallbackTargetNodeId = deriveFallbackStableAnchorNodeId(record);
        addFeedbackEntry(stableAnchorNodeId || fallbackTargetNodeId, 'node_id', matureStableNodeIds, nodeIdSeen, entries, record);
        addFeedbackEntry(stableAnchorSourcePath || fallbackSourcePath, 'source_path', matureStableSourcePaths, sourcePathSeen, entries, record);
    }
    return {
        matureStableNodeIds,
        matureStableNodePatterns,
        matureStableSourcePaths,
        matureStableSourcePathPatterns,
        entries
    };
}
function addConfigEntries(values, matchKind, target, seen, entries, normalizeAsPath = false) {
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
function addFeedbackEntry(rawValue, matchKind, target, seen, entries, record) {
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
function deriveFallbackStableAnchorNodeId(record) {
    const targetNodeIds = Array.isArray(record.targetNodeIds)
        ? record.targetNodeIds.map((entry) => normalizeText(entry)).filter(Boolean)
        : [];
    if (targetNodeIds.length === 1) {
        return targetNodeIds[0];
    }
    return '';
}
function normalizeText(value) {
    return String(value ?? '').trim();
}
function normalizeSourcePath(value) {
    return normalizeText(value)
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '')
        .replace(/\/{2,}/g, '/');
}
//# sourceMappingURL=stableArchitectureAnchorSupport.js.map