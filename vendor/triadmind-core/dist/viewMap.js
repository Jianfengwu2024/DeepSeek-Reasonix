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
exports.generateViewMap = generateViewMap;
exports.writeViewMapArtifacts = writeViewMapArtifacts;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
function generateViewMap(paths, options = {}) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const diagnostics = [];
    const capabilityNodes = canonicalizeViewTriadNodes(readTriadNodes(paths.mapFile, diagnostics, 'VIEW_MAP_MISSING_TRIAD_MAP'), 'capability', config, diagnostics);
    const leafNodes = canonicalizeViewTriadNodes(readTriadNodes(paths.leafMapFile, diagnostics, 'VIEW_MAP_MISSING_LEAF_MAP'), 'leaf', config, diagnostics);
    const runtimeMap = readRuntimeMap(paths.runtimeMapFile, diagnostics);
    const runtimeNodes = canonicalizeRuntimeNodes(runtimeMap?.nodes ?? [], config, diagnostics);
    const maxCandidatesPerRuntimeNode = normalizePositiveInteger(options.maxCandidatesPerRuntimeNode, 3);
    const linksByKey = new Map();
    const capabilityById = new Map();
    const leafById = new Map();
    const capabilityToLeaf = new Map();
    const leafToCapability = new Map();
    const runtimeMatchedIds = new Set();
    for (const node of capabilityNodes) {
        capabilityById.set(node.nodeId, node);
    }
    for (const node of leafNodes) {
        leafById.set(node.nodeId, node);
    }
    for (const [capabilityId, capabilityNode] of capabilityById.entries()) {
        const linkedLeafIds = new Set();
        if (leafById.has(capabilityId)) {
            linkedLeafIds.add(capabilityId);
            addBidirectionalLink(linksByKey, {
                fromView: 'capability',
                fromId: capabilityId,
                toView: 'leaf',
                toId: capabilityId,
                relation: 'exact',
                confidence: 0.99,
                reason: 'capability nodeId exactly matches leaf nodeId',
                sourcePath: capabilityNode.sourcePath
            });
        }
        const foldedLeaves = Array.isArray(capabilityNode.topology?.foldedLeaves)
            ? capabilityNode.topology?.foldedLeaves ?? []
            : [];
        for (const foldedLeafId of foldedLeaves) {
            if (!foldedLeafId || !leafById.has(foldedLeafId)) {
                continue;
            }
            linkedLeafIds.add(foldedLeafId);
            addBidirectionalLink(linksByKey, {
                fromView: 'capability',
                fromId: capabilityId,
                toView: 'leaf',
                toId: foldedLeafId,
                relation: 'folded_leaf',
                confidence: 0.96,
                reason: 'capability topology.foldedLeaves references this leaf node',
                sourcePath: capabilityNode.sourcePath
            });
        }
        const owner = extractOwner(capabilityId);
        const sourcePath = capabilityNode.sourcePath;
        if (owner) {
            const ownerCandidates = leafNodes
                .filter((leafNode) => leafNode.sourcePath === sourcePath)
                .map((leafNode) => leafNode.nodeId)
                .filter((leafId) => extractOwner(leafId) === owner)
                .slice(0, 12);
            for (const leafId of ownerCandidates) {
                if (linkedLeafIds.has(leafId)) {
                    continue;
                }
                linkedLeafIds.add(leafId);
                addBidirectionalLink(linksByKey, {
                    fromView: 'capability',
                    fromId: capabilityId,
                    toView: 'leaf',
                    toId: leafId,
                    relation: 'owner_match',
                    confidence: 0.78,
                    reason: 'capability and leaf share sourcePath plus owner name',
                    sourcePath
                });
            }
        }
        capabilityToLeaf.set(capabilityId, linkedLeafIds);
        for (const leafId of linkedLeafIds) {
            const capabilities = leafToCapability.get(leafId) ?? new Set();
            capabilities.add(capabilityId);
            leafToCapability.set(leafId, capabilities);
        }
    }
    let runtimeUnmatchedCount = 0;
    const unmatchedSamples = [];
    for (const runtimeNode of runtimeNodes) {
        const runtimeId = runtimeNode.id;
        const candidates = collectRuntimeCapabilityCandidates(runtimeNode, capabilityById);
        if (candidates.length === 0) {
            runtimeUnmatchedCount += 1;
            if (unmatchedSamples.length < 10) {
                unmatchedSamples.push(runtimeId);
            }
            continue;
        }
        runtimeMatchedIds.add(runtimeId);
        for (const candidate of candidates.slice(0, maxCandidatesPerRuntimeNode)) {
            addBidirectionalLink(linksByKey, {
                fromView: 'runtime',
                fromId: runtimeId,
                toView: 'capability',
                toId: candidate.capabilityId,
                relation: 'runtime_capability',
                confidence: normalizeConfidence(candidate.score / 100),
                reason: candidate.reason,
                sourcePath: candidate.sourcePath
            });
            const linkedLeafIds = capabilityToLeaf.get(candidate.capabilityId) ?? new Set();
            for (const leafId of Array.from(linkedLeafIds).slice(0, 8)) {
                addBidirectionalLink(linksByKey, {
                    fromView: 'runtime',
                    fromId: runtimeId,
                    toView: 'leaf',
                    toId: leafId,
                    relation: 'runtime_leaf_derived',
                    confidence: normalizeConfidence(candidate.score / 120),
                    reason: 'runtime node matched capability; leaf link derived from capability-to-leaf mapping',
                    sourcePath: candidate.sourcePath
                });
            }
        }
    }
    if (runtimeUnmatchedCount > 0) {
        diagnostics.push({
            level: 'info',
            code: 'VIEW_MAP_RUNTIME_NODE_UNMATCHED_SUMMARY',
            message: `Runtime nodes without cross-view match: ${runtimeUnmatchedCount}${unmatchedSamples.length > 0 ? ` [${unmatchedSamples.join(', ')}]` : ''}`
        });
    }
    const links = Array.from(linksByKey.values()).sort((left, right) => left.id.localeCompare(right.id));
    const runtimeToCapabilityLinkCount = links.filter((link) => link.fromView === 'runtime' && link.toView === 'capability' && link.relation === 'runtime_capability').length;
    const capabilityToLeafLinkCount = links.filter((link) => link.fromView === 'capability' &&
        link.toView === 'leaf' &&
        (link.relation === 'exact' || link.relation === 'folded_leaf' || link.relation === 'owner_match')).length;
    const runtimeToLeafLinkCount = links.filter((link) => link.fromView === 'runtime' && link.toView === 'leaf' && link.relation === 'runtime_leaf_derived').length;
    const capabilityMatchedNodes = Array.from(capabilityToLeaf.values()).filter((linkedLeafIds) => linkedLeafIds.size > 0).length;
    const leafMatchedNodes = leafToCapability.size;
    const endToEndTraceableRuntimeNodes = new Set(links
        .filter((link) => link.fromView === 'runtime' && link.toView === 'leaf' && link.relation === 'runtime_leaf_derived')
        .map((link) => link.fromId)).size;
    diagnostics.push({
        level: 'info',
        code: 'VIEW_MAP_RUNTIME_MATCH_SUMMARY',
        message: `Runtime match rate: ${runtimeMatchedIds.size}/${runtimeNodes.length} (${safeRatio(runtimeMatchedIds.size, runtimeNodes.length).toFixed(3)})`
    });
    diagnostics.push({
        level: 'info',
        code: 'VIEW_MAP_CAPABILITY_LEAF_SUMMARY',
        message: `Capability-to-leaf traceability: ${capabilityMatchedNodes}/${capabilityById.size} (${safeRatio(capabilityMatchedNodes, capabilityById.size).toFixed(3)})`
    });
    diagnostics.push({
        level: 'info',
        code: 'VIEW_MAP_END_TO_END_SUMMARY',
        message: `Runtime-to-capability-to-leaf traceability: ${endToEndTraceableRuntimeNodes}/${runtimeNodes.length} (${safeRatio(endToEndTraceableRuntimeNodes, runtimeNodes.length).toFixed(3)})`
    });
    const stats = {
        runtimeNodes: runtimeNodes.length,
        capabilityNodes: capabilityById.size,
        leafNodes: leafById.size,
        linkCount: links.length,
        runtimeMatchedNodes: runtimeMatchedIds.size,
        runtimeUnmatchedNodes: runtimeUnmatchedCount,
        runtimeMatchRate: safeRatio(runtimeMatchedIds.size, runtimeNodes.length),
        capabilityMatchedNodes,
        capabilityUnmatchedNodes: Math.max(0, capabilityById.size - capabilityMatchedNodes),
        capabilityLeafMatchRate: safeRatio(capabilityMatchedNodes, capabilityById.size),
        leafMatchedNodes,
        leafUnmatchedNodes: Math.max(0, leafById.size - leafMatchedNodes),
        leafCapabilityMatchRate: safeRatio(leafMatchedNodes, leafById.size),
        runtimeToCapabilityLinkCount,
        capabilityToLeafLinkCount,
        runtimeToLeafLinkCount,
        endToEndTraceableRuntimeNodes,
        endToEndTraceabilityRate: safeRatio(endToEndTraceableRuntimeNodes, runtimeNodes.length)
    };
    return {
        schemaVersion: '1.0',
        project: path.basename(paths.projectRoot),
        generatedAt: new Date().toISOString(),
        stats,
        links,
        diagnostics
    };
}
function writeViewMapArtifacts(paths, options = {}) {
    const viewMap = generateViewMap(paths, options);
    fs.mkdirSync(path.dirname(paths.viewMapFile), { recursive: true });
    fs.writeFileSync(paths.viewMapFile, JSON.stringify(viewMap, null, 2), 'utf-8');
    fs.writeFileSync(paths.viewMapDiagnosticsFile, JSON.stringify(viewMap.diagnostics, null, 2), 'utf-8');
    return viewMap;
}
function collectRuntimeCapabilityCandidates(runtimeNode, capabilityById) {
    const runtimeSourcePaths = runtimeNode.__sourcePaths;
    const runtimeTokens = tokenize(`${runtimeNode.id} ${runtimeNode.label} ${runtimeSourcePaths.join(' ')}`);
    const handlerToken = normalizeText(typeof runtimeNode.metadata?.handler === 'string' ? String(runtimeNode.metadata?.handler) : '');
    const serviceMethod = parseServiceRuntimeId(runtimeNode.id);
    const runtimeCategory = normalizeCategoryKey(runtimeNode.__resolvedCategory);
    const candidates = [];
    for (const [capabilityId, capabilityNode] of capabilityById.entries()) {
        let score = 0;
        const reasons = [];
        const capabilitySourcePath = capabilityNode.sourcePath;
        const capabilityCategory = normalizeCategoryKey(capabilityNode.category);
        const capabilityTokens = tokenize(`${capabilityId} ${capabilitySourcePath}`);
        const sourcePathScore = scoreRuntimeSourcePathMatch(runtimeSourcePaths, capabilitySourcePath);
        if (sourcePathScore > 0) {
            score += sourcePathScore >= 60 ? 65 : sourcePathScore;
            reasons.push(sourcePathScore >= 60 ? 'source_path_exact' : 'source_path_partial');
        }
        if (runtimeCategory && capabilityCategory && runtimeCategory === capabilityCategory) {
            score += 18;
            reasons.push('category_match');
        }
        else if (runtimeCategory && capabilityCategory && runtimeCategory !== capabilityCategory) {
            score -= 8;
        }
        if (handlerToken) {
            const capabilityMethod = normalizeText(extractMethod(capabilityId));
            if (capabilityMethod && (capabilityMethod === handlerToken || capabilityId.toLowerCase().includes(handlerToken))) {
                score += 34;
                reasons.push('handler_match');
            }
        }
        if (serviceMethod) {
            const capabilityLower = capabilityId.toLowerCase();
            if (capabilityLower.includes(serviceMethod.service.toLowerCase()) &&
                capabilityLower.includes(serviceMethod.method.toLowerCase())) {
                score += 40;
                reasons.push('service_method_match');
            }
        }
        const overlap = countTokenOverlap(runtimeTokens, capabilityTokens);
        if (overlap > 0) {
            score += Math.min(24, overlap * 6);
            reasons.push(`token_overlap_${overlap}`);
        }
        if (score < 35) {
            continue;
        }
        candidates.push({
            capabilityId,
            score,
            reason: reasons.join('+'),
            sourcePath: capabilityNode.sourcePath
        });
    }
    return candidates
        .sort((left, right) => right.score - left.score || left.capabilityId.localeCompare(right.capabilityId))
        .slice(0, 6);
}
function collectRuntimeSourcePathCandidates(runtimeNode) {
    const sourcePaths = new Set();
    const direct = normalizeSourcePath(runtimeNode.sourcePath);
    if (direct) {
        sourcePaths.add(direct);
    }
    for (const evidence of Array.isArray(runtimeNode.evidence) ? runtimeNode.evidence : []) {
        const evidencePath = normalizeSourcePath(evidence?.sourcePath);
        if (evidencePath) {
            sourcePaths.add(evidencePath);
        }
    }
    return Array.from(sourcePaths);
}
function scoreRuntimeSourcePathMatch(runtimeSourcePaths, capabilitySourcePath) {
    if (!capabilitySourcePath) {
        return 0;
    }
    for (const runtimeSourcePath of runtimeSourcePaths) {
        if (!runtimeSourcePath) {
            continue;
        }
        if (runtimeSourcePath === capabilitySourcePath) {
            return 65;
        }
        if (runtimeSourcePath.endsWith(capabilitySourcePath) ||
            capabilitySourcePath.endsWith(runtimeSourcePath) ||
            shareSourcePathTail(runtimeSourcePath, capabilitySourcePath)) {
            return 32;
        }
    }
    return 0;
}
function shareSourcePathTail(left, right) {
    const leftParts = left.split('/').filter(Boolean);
    const rightParts = right.split('/').filter(Boolean);
    if (leftParts.length < 2 || rightParts.length < 2) {
        return false;
    }
    return leftParts.slice(-2).join('/') === rightParts.slice(-2).join('/');
}
function parseServiceRuntimeId(runtimeId) {
    const parts = String(runtimeId ?? '').split('.').filter(Boolean);
    if (parts.length < 3 || parts[0] !== 'Service') {
        return undefined;
    }
    return {
        service: parts[1],
        method: parts.slice(2).join('.')
    };
}
function countTokenOverlap(leftTokens, rightTokens) {
    let overlap = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) {
            overlap += 1;
        }
    }
    return overlap;
}
function tokenize(value) {
    return new Set(String(value ?? '')
        .toLowerCase()
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^a-z0-9]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length >= 3)
        .filter((entry) => !GENERIC_TOKENS.has(entry)));
}
function extractOwner(nodeId) {
    const parts = String(nodeId ?? '').split('.').filter(Boolean);
    if (parts.length <= 1) {
        return '';
    }
    return parts.slice(0, -1).join('.');
}
function extractMethod(nodeId) {
    const parts = String(nodeId ?? '').split('.').filter(Boolean);
    return parts[parts.length - 1] ?? '';
}
function addBidirectionalLink(linksByKey, link) {
    addLink(linksByKey, link);
    if (link.fromView === link.toView && link.fromId === link.toId) {
        return;
    }
    addLink(linksByKey, {
        ...link,
        fromView: link.toView,
        fromId: link.toId,
        toView: link.fromView,
        toId: link.fromId
    });
}
function addLink(linksByKey, link) {
    const normalizedLink = {
        ...link,
        confidence: normalizeConfidence(link.confidence)
    };
    const linkId = buildLinkId(normalizedLink);
    const existing = linksByKey.get(linkId);
    if (!existing) {
        linksByKey.set(linkId, {
            id: linkId,
            ...normalizedLink
        });
        return;
    }
    linksByKey.set(linkId, {
        ...existing,
        confidence: Math.max(existing.confidence, normalizedLink.confidence),
        reason: existing.reason === normalizedLink.reason ? existing.reason : `${existing.reason}|${normalizedLink.reason}`,
        sourcePath: existing.sourcePath ?? normalizedLink.sourcePath
    });
}
function buildLinkId(link) {
    return [
        link.fromView,
        normalizeNodeId(link.fromId),
        link.relation,
        link.toView,
        normalizeNodeId(link.toId)
    ].join('::');
}
function readTriadNodes(filePath, diagnostics, missingCode) {
    const result = (0, artifactReaders_1.readJsonArrayArtifactResult)(filePath);
    if (result.status === 'missing') {
        diagnostics.push({
            level: 'warning',
            code: missingCode,
            message: `Missing topology file: ${filePath}`
        });
        return [];
    }
    if (result.status === 'parse_failed') {
        diagnostics.push({
            level: 'error',
            code: 'VIEW_MAP_PARSE_FAILED',
            message: `Failed to parse topology file: ${filePath}`
        });
        return [];
    }
    return result.value ?? [];
}
function readRuntimeMap(filePath, diagnostics) {
    const result = (0, artifactReaders_1.readRuntimeMapArtifactResult)(filePath);
    if (result.status === 'missing') {
        diagnostics.push({
            level: 'warning',
            code: 'VIEW_MAP_MISSING_RUNTIME_MAP',
            message: `Missing runtime topology file: ${filePath}`
        });
        return undefined;
    }
    if (result.status === 'shape_invalid') {
        diagnostics.push({
            level: 'error',
            code: 'VIEW_MAP_RUNTIME_MAP_INVALID',
            message: `Invalid runtime map shape: ${filePath}`
        });
        return undefined;
    }
    if (result.status === 'parse_failed') {
        diagnostics.push({
            level: 'error',
            code: 'VIEW_MAP_RUNTIME_MAP_PARSE_FAILED',
            message: `Failed to parse runtime map: ${filePath}`
        });
        return undefined;
    }
    return result.value;
}
function normalizeNodeId(value) {
    return normalizeText(value).replace(/\\/g, '/');
}
function normalizeSourcePath(value) {
    return normalizeText(value).replace(/\\/g, '/').toLowerCase();
}
function normalizeCategoryLabel(value) {
    return normalizeText(value) || 'unknown';
}
function normalizeCategoryKey(value) {
    return normalizeCategoryLabel(value).toLowerCase();
}
function normalizeText(value) {
    return String(value ?? '').trim();
}
function canonicalizeViewTriadNodes(nodes, view, config, diagnostics) {
    const canonicalized = [];
    for (const node of nodes) {
        const normalized = canonicalizeViewTriadNode(node, view, config, diagnostics);
        if (normalized) {
            canonicalized.push(normalized);
        }
    }
    return canonicalized;
}
function canonicalizeViewTriadNode(node, view, config, diagnostics) {
    const nodeId = normalizeNodeId(node.nodeId);
    if (!nodeId) {
        return undefined;
    }
    const sourcePath = normalizeSourcePath(node.sourcePath);
    const declaredCategory = normalizeCategoryLabel(node.category);
    const resolvedCategory = sourcePath ? (0, config_1.resolveCategoryFromConfig)(sourcePath, config) : 'unknown';
    let category = declaredCategory;
    if (sourcePath) {
        if (resolvedCategory !== 'unknown') {
            if (declaredCategory !== 'unknown' &&
                normalizeCategoryKey(declaredCategory) !== normalizeCategoryKey(resolvedCategory)) {
                diagnostics.push({
                    level: 'warning',
                    code: `VIEW_MAP_${view.toUpperCase()}_CATEGORY_MISMATCH_AUTO_FIXED`,
                    message: `${view} category/sourcePath mismatch auto-fixed by category resolver`,
                    sourcePath
                });
            }
            category = resolvedCategory;
        }
        else {
            if (declaredCategory !== 'unknown') {
                diagnostics.push({
                    level: 'warning',
                    code: `VIEW_MAP_${view.toUpperCase()}_CATEGORY_UNRESOLVED`,
                    message: `${view} sourcePath could not be resolved to a configured category; downgraded to unknown`,
                    sourcePath
                });
            }
            category = 'unknown';
        }
    }
    return {
        nodeId,
        category,
        sourcePath,
        topology: {
            foldedLeaves: normalizeFoldedLeaves(node.topology?.foldedLeaves)
        }
    };
}
function canonicalizeRuntimeNodes(nodes, config, diagnostics) {
    const canonicalized = [];
    for (const node of nodes) {
        const normalized = canonicalizeRuntimeNode(node, config, diagnostics);
        if (normalized) {
            canonicalized.push(normalized);
        }
    }
    return canonicalized;
}
function canonicalizeRuntimeNode(node, config, diagnostics) {
    const runtimeId = normalizeNodeId(node.id);
    if (!runtimeId) {
        return undefined;
    }
    const sourcePaths = collectRuntimeSourcePathCandidates(node);
    const directSourcePath = normalizeSourcePath(node.sourcePath);
    const primarySourcePath = sourcePaths[0] ?? (directSourcePath || undefined);
    const declaredCategory = normalizeCategoryLabel(node.category);
    const resolvedCategory = resolveFirstMappedCategory(sourcePaths, config);
    let category = declaredCategory;
    if (sourcePaths.length > 0) {
        if (resolvedCategory !== 'unknown') {
            if (declaredCategory !== 'unknown' &&
                normalizeCategoryKey(declaredCategory) !== normalizeCategoryKey(resolvedCategory)) {
                diagnostics.push({
                    level: 'warning',
                    code: 'VIEW_MAP_RUNTIME_CATEGORY_MISMATCH_AUTO_FIXED',
                    message: 'runtime category/sourcePath mismatch auto-fixed by category resolver',
                    sourcePath: primarySourcePath
                });
            }
            category = resolvedCategory;
        }
        else {
            if (declaredCategory !== 'unknown') {
                diagnostics.push({
                    level: 'warning',
                    code: 'VIEW_MAP_RUNTIME_CATEGORY_UNRESOLVED',
                    message: 'runtime sourcePath could not be resolved to a configured category; downgraded to unknown',
                    sourcePath: primarySourcePath
                });
            }
            category = 'unknown';
        }
    }
    return {
        ...node,
        id: runtimeId,
        sourcePath: primarySourcePath ?? node.sourcePath,
        __sourcePaths: sourcePaths,
        __resolvedCategory: category,
        __resolvedSourcePath: primarySourcePath
    };
}
function resolveFirstMappedCategory(sourcePaths, config) {
    for (const sourcePath of sourcePaths) {
        const resolved = (0, config_1.resolveCategoryFromConfig)(sourcePath, config);
        if (resolved !== 'unknown') {
            return resolved;
        }
    }
    return 'unknown';
}
function normalizeFoldedLeaves(values) {
    return Array.isArray(values)
        ? values.map((value) => normalizeNodeId(value)).filter((value) => Boolean(value))
        : [];
}
function normalizeConfidence(value) {
    if (!Number.isFinite(value)) {
        return 0.5;
    }
    return Math.max(0.01, Math.min(0.99, Number(value.toFixed(4))));
}
function normalizePositiveInteger(value, fallback) {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
function safeRatio(part, total) {
    if (!total) {
        return 0;
    }
    return Number((part / total).toFixed(6));
}
const GENERIC_TOKENS = new Set([
    'service',
    'workflow',
    'runtime',
    'node',
    'task',
    'worker',
    'method',
    'class',
    'module',
    'file',
    'api',
    'route',
    'capability',
    'leaf'
]);
//# sourceMappingURL=viewMap.js.map