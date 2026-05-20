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
exports.loadImpactTierSummary = loadImpactTierSummary;
exports.classifyImpactTier = classifyImpactTier;
exports.filterNodesForImpactThreshold = filterNodesForImpactThreshold;
exports.filterNodesToImpactScope = filterNodesToImpactScope;
exports.findImpactEntryForNode = findImpactEntryForNode;
exports.hasImpactTierAtLeast = hasImpactTierAtLeast;
const fs = __importStar(require("fs"));
const stableArchitectureAnchorSupport_1 = require("./stableArchitectureAnchorSupport");
const topologyRiskSupport_1 = require("./topologyRiskSupport");
const workspace_1 = require("./workspace");
const TIER_RANK = {
    exempt: 0,
    advisory: 1,
    strict: 2
};
function loadImpactTierSummary(paths, triadNodes, config, stableAnchors) {
    const notes = [];
    const configuredAnchors = stableAnchors ??
        (0, stableArchitectureAnchorSupport_1.resolveEffectiveStableAnchorsFromSources)({
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
    const nodeById = new Map(triadNodes
        .map((node) => [normalizeText(node.nodeId), node])
        .filter(([nodeId]) => Boolean(nodeId)));
    const entriesByNodeId = new Map();
    const entriesBySourcePath = new Map();
    for (const raw of rawEntries) {
        const nodeId = normalizeText(raw.nodeId);
        const sourcePath = normalizeSourcePath(raw.sourcePath);
        if (!nodeId && !sourcePath) {
            continue;
        }
        const node = nodeById.get(nodeId);
        const stableAnchor = node ? (0, topologyRiskSupport_1.isMatureStableArchitectureNode)(node, configuredAnchors) : false;
        const forcedTier = resolveForcedTier(config.impactTiers.forceTier, nodeId, sourcePath);
        const tier = stableAnchor ? 'exempt' : forcedTier ?? classifyImpactTier(raw.chainLength, config.impactTiers);
        const entry = {
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
function classifyImpactTier(chainLength, config) {
    const length = Number.isFinite(chainLength) ? Math.max(0, Math.floor(chainLength)) : config.mediumChainMax + 1;
    if (length <= config.shortChainMax) {
        return 'exempt';
    }
    if (length <= config.mediumChainMax) {
        return 'advisory';
    }
    return 'strict';
}
function filterNodesForImpactThreshold(nodes, summary, threshold, options = {}) {
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
function filterNodesToImpactScope(nodes, summary, options = {}) {
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
function findImpactEntryForNode(summary, node) {
    const nodeId = normalizeText(node.nodeId);
    const sourcePath = normalizeSourcePath(node.sourcePath);
    return (summary.entries.find((entry) => entry.nodeId && entry.nodeId === nodeId) ??
        summary.entries.find((entry) => entry.sourcePath && normalizeSourcePath(entry.sourcePath) === sourcePath));
}
function hasImpactTierAtLeast(tier, minimum) {
    return TIER_RANK[tier] >= TIER_RANK[minimum];
}
function createEmptySummary(protocolFile, config, notes) {
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
function extractImpactEntries(protocol) {
    const fromImpactedNodes = Array.isArray(protocol.impactedNodes)
        ? protocol.impactedNodes.map((entry) => extractImpactEntry(entry)).filter(Boolean)
        : [];
    if (fromImpactedNodes.length > 0) {
        return fromImpactedNodes;
    }
    const actions = Array.isArray(protocol.actions) ? protocol.actions : [];
    const fallback = [];
    for (const rawAction of actions) {
        if (!rawAction || typeof rawAction !== 'object') {
            continue;
        }
        const action = rawAction;
        const directNodeId = normalizeText(action.nodeId);
        const parentNodeId = normalizeText(action.parentNodeId);
        const nestedNode = action.node && typeof action.node === 'object' ? action.node : undefined;
        const nestedNodeId = normalizeText(nestedNode?.nodeId);
        for (const nodeId of [directNodeId, parentNodeId, nestedNodeId].filter(Boolean)) {
            fallback.push({ nodeId, chainLength: 0 });
        }
    }
    return fallback;
}
function extractImpactEntry(raw) {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const entry = raw;
    const nestedNode = entry.node && typeof entry.node === 'object' ? entry.node : undefined;
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
function deriveChainLength(entry) {
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
function mergeImpactEntries(existing, next) {
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
function resolveForcedTier(forceTier, nodeId, sourcePath) {
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
            }
            catch {
                continue;
            }
        }
    }
    return undefined;
}
function readJsonObject(filePath) {
    if (!fs.existsSync(filePath)) {
        return undefined;
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function firstText(...values) {
    for (const value of values) {
        const text = normalizeText(value);
        if (text) {
            return text;
        }
    }
    return '';
}
function normalizeThreshold(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return undefined;
}
function normalizeText(value) {
    return String(value ?? '').trim();
}
function normalizeSourcePath(value) {
    return (0, workspace_1.normalizePath)(String(value ?? ''))
        .replace(/^\.?\//, '')
        .replace(/\/{2,}/g, '/')
        .trim();
}
//# sourceMappingURL=impactTierSupport.js.map