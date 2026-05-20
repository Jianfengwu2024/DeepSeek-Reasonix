"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectGhostMetricsByLanguage = collectGhostMetricsByLanguage;
exports.evaluateGhostPolicyViolations = evaluateGhostPolicyViolations;
exports.analyzeTriadCompleteness = analyzeTriadCompleteness;
exports.inferLanguageFromSourcePath = inferLanguageFromSourcePath;
const ir_1 = require("./ir");
const GHOST_DEMAND_PATTERN = /^\[Ghost:[^\]]+\]/i;
const ORCHESTRATION_METHOD_PATTERN = /^(execute|run|handle|process|dispatch|apply|invoke|plan|schedule|orchestrate)$/i;
const HELPER_METHOD_PATTERN = /^(build|parse|format|normalize|sanitize|validate|resolve|collect|load|save|get|set)$/i;
const ORCHESTRATION_RESPONSIBILITY_PATTERN = /(workflow|orchestrat|pipeline|router|dispatch|command|stage|coordinat)/i;
const NONE_TOKENS = new Set(['', 'none', 'void', 'null', 'undefined']);
function collectGhostMetricsByLanguage(triadNodes) {
    const totalByLanguage = new Map();
    const ghostDemandByLanguage = new Map();
    for (const node of triadNodes) {
        const language = inferLanguageFromSourcePath(node.sourcePath);
        totalByLanguage.set(language, (totalByLanguage.get(language) ?? 0) + 1);
        if (hasGhostDemand(node)) {
            ghostDemandByLanguage.set(language, (ghostDemandByLanguage.get(language) ?? 0) + 1);
        }
    }
    const ghostRatioByLanguage = {};
    const ghostInDemandCountByLanguage = {};
    for (const [language, total] of totalByLanguage.entries()) {
        const ghostCount = ghostDemandByLanguage.get(language) ?? 0;
        ghostRatioByLanguage[language] = safeRatio(ghostCount, total);
        ghostInDemandCountByLanguage[language] = ghostCount;
    }
    return {
        ghostRatioByLanguage,
        ghostInDemandCountByLanguage
    };
}
function evaluateGhostPolicyViolations(triadNodes, policyByLanguage, options = {}) {
    const violations = [];
    for (const node of triadNodes) {
        const language = inferLanguageFromSourcePath(node.sourcePath);
        const policy = resolveLanguageGhostPolicy(language, policyByLanguage);
        const demandEntries = Array.isArray(node.fission?.demand) ? node.fission.demand : [];
        const ghostDemandEntries = demandEntries.filter((entry) => GHOST_DEMAND_PATTERN.test(String(entry ?? '').trim()));
        if (!policy.includeInDemand && ghostDemandEntries.length > 0) {
            violations.push(`${language}:${node.nodeId ?? 'unknown'} disallows ghost in demand`);
            continue;
        }
        if (policy.includeInDemand && ghostDemandEntries.length > policy.topK) {
            violations.push(`${language}:${node.nodeId ?? 'unknown'} ghost demand ${ghostDemandEntries.length} exceeds topK=${policy.topK}`);
        }
        const retainedGhostReads = (node.fission?.evidence?.ghostReads ?? []).filter((entry) => entry?.retainedInDemand);
        const lowConfidenceGhost = retainedGhostReads.find((entry) => Number(entry?.score ?? 0) < policy.minConfidence);
        if (lowConfidenceGhost) {
            violations.push(`${language}:${node.nodeId ?? 'unknown'} retained ghost score ${Number(lowConfidenceGhost.score ?? 0)} below minConfidence=${policy.minConfidence}`);
        }
    }
    const limit = normalizeViolationLimit(options.violationLimit, 50);
    return dedupeStrings(violations).slice(0, limit);
}
function analyzeTriadCompleteness(triadNodes, microSplit, language, genericContractIgnoreList) {
    const leftOnlyVertices = new Set();
    const rightOnlyVertices = new Set();
    const emptyVertices = new Set();
    const scaleMixingVertices = new Set();
    const triadDefinitions = triadNodes.filter(isTriadNodeDefinition);
    for (const blueprint of Array.isArray(microSplit?.classes) ? microSplit.classes : []) {
        const className = String(blueprint?.className ?? '').trim();
        if (!className) {
            continue;
        }
        const staticRightBranch = readBranchArray(blueprint?.staticRightBranch, blueprint?.properties);
        const dynamicLeftBranch = readBranchArray(blueprint?.dynamicLeftBranch, blueprint?.methods);
        const label = `micro:${className}`;
        if (staticRightBranch.length === 0 && dynamicLeftBranch.length > 0) {
            leftOnlyVertices.add(label);
        }
        if (staticRightBranch.length > 0 && dynamicLeftBranch.length === 0) {
            rightOnlyVertices.add(label);
        }
        if (staticRightBranch.length === 0 && dynamicLeftBranch.length === 0) {
            emptyVertices.add(label);
        }
        if (hasScaleMixingBranch(dynamicLeftBranch)) {
            scaleMixingVertices.add(label);
        }
    }
    const topology = (0, ir_1.buildTopologyIR)(triadDefinitions, language);
    for (const vertex of topology.vertices) {
        const meaningfulStaticRightBranch = vertex.staticRightBranch.filter((entry) => isMeaningfulRightBranchContract(entry, genericContractIgnoreList));
        const orchestrationCount = vertex.dynamicLeftBranch.filter((operation) => isOrchestrationOperation(operation)).length;
        const label = `ir:${formatVertexLabel(vertex.nodeId, vertex.sourcePath)}`;
        if (meaningfulStaticRightBranch.length === 0 &&
            orchestrationCount > 0 &&
            vertex.dynamicLeftBranch.length >= 2) {
            leftOnlyVertices.add(label);
        }
        if (hasScaleMixingOperations(vertex.dynamicLeftBranch)) {
            scaleMixingVertices.add(label);
        }
    }
    return {
        triadVertices: topology.vertices.length,
        leftOnlyVertices: Array.from(leftOnlyVertices).sort(),
        rightOnlyVertices: Array.from(rightOnlyVertices).sort(),
        emptyVertices: Array.from(emptyVertices).sort(),
        scaleMixingVertices: Array.from(scaleMixingVertices).sort()
    };
}
function inferLanguageFromSourcePath(sourcePath) {
    const normalized = String(sourcePath ?? '').toLowerCase();
    if (/\.(ts|tsx|mts|cts)$/.test(normalized))
        return 'typescript';
    if (/\.(js|jsx|mjs|cjs)$/.test(normalized))
        return 'javascript';
    if (/\.py$/.test(normalized))
        return 'python';
    if (/\.go$/.test(normalized))
        return 'go';
    if (/\.rs$/.test(normalized))
        return 'rust';
    if (/\.(cc|cpp|cxx|hpp|hh|h)$/.test(normalized))
        return 'cpp';
    if (/\.java$/.test(normalized))
        return 'java';
    return 'unknown';
}
function hasGhostDemand(node) {
    const demand = node.fission?.demand ?? [];
    return Array.isArray(demand) && demand.some((entry) => GHOST_DEMAND_PATTERN.test(String(entry ?? '').trim()));
}
function resolveLanguageGhostPolicy(language, policyByLanguage) {
    const fallback = policyByLanguage.default ?? {
        includeInDemand: true,
        topK: 5,
        minConfidence: 4
    };
    const policy = policyByLanguage[language] ?? fallback;
    return {
        includeInDemand: policy.includeInDemand,
        topK: Math.max(0, Math.floor(policy.topK)),
        minConfidence: Math.max(0, Number(policy.minConfidence))
    };
}
function isTriadNodeDefinition(node) {
    return (typeof node?.nodeId === 'string' &&
        typeof node?.fission?.problem === 'string' &&
        Array.isArray(node?.fission?.demand) &&
        Array.isArray(node?.fission?.answer));
}
function readBranchArray(primary, fallback) {
    if (Array.isArray(primary)) {
        return primary;
    }
    return Array.isArray(fallback) ? fallback : [];
}
function hasScaleMixingBranch(branch) {
    if (branch.length < 2) {
        return false;
    }
    let helperCount = 0;
    let orchestrationCount = 0;
    for (const entry of branch) {
        const name = typeof entry?.name === 'string' ? String(entry.name) : '';
        const responsibility = typeof entry?.responsibility === 'string'
            ? String(entry.responsibility)
            : '';
        if (isHelperMethodName(name)) {
            helperCount += 1;
        }
        if (ORCHESTRATION_METHOD_PATTERN.test(name) || ORCHESTRATION_RESPONSIBILITY_PATTERN.test(responsibility)) {
            orchestrationCount += 1;
        }
    }
    return helperCount > 0 && orchestrationCount > 0;
}
function hasScaleMixingOperations(operations) {
    if (operations.length < 3) {
        return false;
    }
    const helperCount = operations.filter((operation) => isHelperMethodName(operation.name)).length;
    const orchestrationCount = operations.filter((operation) => isOrchestrationOperation(operation)).length;
    return helperCount > 0 && orchestrationCount > 0;
}
function isOrchestrationOperation(operation) {
    return (ORCHESTRATION_METHOD_PATTERN.test(String(operation.name ?? '').trim()) ||
        ORCHESTRATION_RESPONSIBILITY_PATTERN.test(String(operation.responsibility ?? '').trim()));
}
function isHelperMethodName(name) {
    return HELPER_METHOD_PATTERN.test(String(name ?? '').trim());
}
function isMeaningfulRightBranchContract(contract, genericContractIgnoreList) {
    const normalized = normalizeContractKey(contract);
    if (!normalized || NONE_TOKENS.has(normalized) || GHOST_DEMAND_PATTERN.test(String(contract ?? '').trim())) {
        return false;
    }
    return !resolveGenericContractIgnoreSet(genericContractIgnoreList).has(normalized);
}
function resolveGenericContractIgnoreSet(values) {
    return new Set((Array.isArray(values) ? values : [])
        .map((value) => normalizeContractKey(value))
        .filter((value) => value && !NONE_TOKENS.has(value)));
}
function normalizeContractKey(contract) {
    if (typeof contract !== 'string') {
        return '';
    }
    return contract
        .trim()
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^()]*\)/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
function formatVertexLabel(nodeId, sourcePath) {
    return sourcePath?.trim() ? `${nodeId}@${sourcePath.trim()}` : nodeId;
}
function dedupeStrings(values) {
    return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}
function normalizeViolationLimit(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return fallback;
}
function safeRatio(part, total) {
    if (!total) {
        return 0;
    }
    return Number((part / total).toFixed(6));
}
//# sourceMappingURL=topologyQuality.js.map