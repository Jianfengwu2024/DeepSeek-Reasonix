import { TriadLanguage } from './config';
import { buildTopologyIR, TriadOperationIR } from './ir';
import type { TriadFission, TriadNodeDefinition } from './protocolRightBranch';
import type { MicroSplitArtifactLike } from './triadizationSplitBlueprintSupport';

const GHOST_DEMAND_PATTERN = /^\[Ghost:[^\]]+\]/i;
const ORCHESTRATION_METHOD_PATTERN = /^(execute|run|handle|process|dispatch|apply|invoke|plan|schedule|orchestrate)$/i;
const HELPER_METHOD_PATTERN = /^(build|parse|format|normalize|sanitize|validate|resolve|collect|load|save|get|set)$/i;
const ORCHESTRATION_RESPONSIBILITY_PATTERN = /(workflow|orchestrat|pipeline|router|dispatch|command|stage|coordinat)/i;
const NONE_TOKENS = new Set(['', 'none', 'void', 'null', 'undefined']);

export type TopologyQualityNodeLike = Omit<Partial<TriadNodeDefinition>, 'fission'> & {
    fission?: Partial<TriadFission>;
};

export interface LanguageGhostPolicy {
    includeInDemand: boolean;
    topK: number;
    minConfidence: number;
}

export interface GhostMetricsByLanguage {
    ghostRatioByLanguage: Record<string, number>;
    ghostInDemandCountByLanguage: Record<string, number>;
}

export interface TriadCompletenessAnalysis {
    triadVertices: number;
    leftOnlyVertices: string[];
    rightOnlyVertices: string[];
    emptyVertices: string[];
    scaleMixingVertices: string[];
}

export interface GhostPolicyViolationOptions {
    violationLimit?: number;
}

export function collectGhostMetricsByLanguage(
    triadNodes: TopologyQualityNodeLike[]
): GhostMetricsByLanguage {
    const totalByLanguage = new Map<string, number>();
    const ghostDemandByLanguage = new Map<string, number>();

    for (const node of triadNodes) {
        const language = inferLanguageFromSourcePath(node.sourcePath);
        totalByLanguage.set(language, (totalByLanguage.get(language) ?? 0) + 1);
        if (hasGhostDemand(node)) {
            ghostDemandByLanguage.set(language, (ghostDemandByLanguage.get(language) ?? 0) + 1);
        }
    }

    const ghostRatioByLanguage: Record<string, number> = {};
    const ghostInDemandCountByLanguage: Record<string, number> = {};
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

export function evaluateGhostPolicyViolations(
    triadNodes: TopologyQualityNodeLike[],
    policyByLanguage: Record<string, LanguageGhostPolicy | undefined>,
    options: GhostPolicyViolationOptions = {}
) {
    const violations: string[] = [];
    for (const node of triadNodes) {
        const language = inferLanguageFromSourcePath(node.sourcePath);
        const policy = resolveLanguageGhostPolicy(language, policyByLanguage);
        const demandEntries = Array.isArray(node.fission?.demand) ? node.fission!.demand! : [];
        const ghostDemandEntries = demandEntries.filter((entry) =>
            GHOST_DEMAND_PATTERN.test(String(entry ?? '').trim())
        );
        if (!policy.includeInDemand && ghostDemandEntries.length > 0) {
            violations.push(`${language}:${node.nodeId ?? 'unknown'} disallows ghost in demand`);
            continue;
        }
        if (policy.includeInDemand && ghostDemandEntries.length > policy.topK) {
            violations.push(
                `${language}:${node.nodeId ?? 'unknown'} ghost demand ${ghostDemandEntries.length} exceeds topK=${policy.topK}`
            );
        }

        const retainedGhostReads = (node.fission?.evidence?.ghostReads ?? []).filter((entry) => entry?.retainedInDemand);
        const lowConfidenceGhost = retainedGhostReads.find(
            (entry) => Number(entry?.score ?? 0) < policy.minConfidence
        );
        if (lowConfidenceGhost) {
            violations.push(
                `${language}:${node.nodeId ?? 'unknown'} retained ghost score ${Number(
                    lowConfidenceGhost.score ?? 0
                )} below minConfidence=${policy.minConfidence}`
            );
        }
    }

    const limit = normalizeViolationLimit(options.violationLimit, 50);
    return dedupeStrings(violations).slice(0, limit);
}

export function analyzeTriadCompleteness(
    triadNodes: TopologyQualityNodeLike[],
    microSplit: MicroSplitArtifactLike | undefined,
    language: TriadLanguage,
    genericContractIgnoreList: string[]
): TriadCompletenessAnalysis {
    const leftOnlyVertices = new Set<string>();
    const rightOnlyVertices = new Set<string>();
    const emptyVertices = new Set<string>();
    const scaleMixingVertices = new Set<string>();
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

    const topology = buildTopologyIR(triadDefinitions, language);
    for (const vertex of topology.vertices) {
        const meaningfulStaticRightBranch = vertex.staticRightBranch.filter((entry) =>
            isMeaningfulRightBranchContract(entry, genericContractIgnoreList)
        );
        const orchestrationCount = vertex.dynamicLeftBranch.filter((operation) => isOrchestrationOperation(operation)).length;
        const label = `ir:${formatVertexLabel(vertex.nodeId, vertex.sourcePath)}`;

        if (
            meaningfulStaticRightBranch.length === 0 &&
            orchestrationCount > 0 &&
            vertex.dynamicLeftBranch.length >= 2
        ) {
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

export function inferLanguageFromSourcePath(sourcePath: string | undefined): TriadLanguage | 'unknown' {
    const normalized = String(sourcePath ?? '').toLowerCase();
    if (/\.(ts|tsx|mts|cts)$/.test(normalized)) return 'typescript';
    if (/\.(js|jsx|mjs|cjs)$/.test(normalized)) return 'javascript';
    if (/\.py$/.test(normalized)) return 'python';
    if (/\.go$/.test(normalized)) return 'go';
    if (/\.rs$/.test(normalized)) return 'rust';
    if (/\.(cc|cpp|cxx|hpp|hh|h)$/.test(normalized)) return 'cpp';
    if (/\.java$/.test(normalized)) return 'java';
    return 'unknown';
}

function hasGhostDemand(node: TopologyQualityNodeLike) {
    const demand = node.fission?.demand ?? [];
    return Array.isArray(demand) && demand.some((entry) => GHOST_DEMAND_PATTERN.test(String(entry ?? '').trim()));
}

function resolveLanguageGhostPolicy(
    language: string,
    policyByLanguage: Record<string, LanguageGhostPolicy | undefined>
): LanguageGhostPolicy {
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

function isTriadNodeDefinition(node: TopologyQualityNodeLike): node is TriadNodeDefinition {
    return (
        typeof node?.nodeId === 'string' &&
        typeof node?.fission?.problem === 'string' &&
        Array.isArray(node?.fission?.demand) &&
        Array.isArray(node?.fission?.answer)
    );
}

function readBranchArray(primary: unknown[] | undefined, fallback: unknown[] | undefined) {
    if (Array.isArray(primary)) {
        return primary;
    }
    return Array.isArray(fallback) ? fallback : [];
}

function hasScaleMixingBranch(branch: unknown[]) {
    if (branch.length < 2) {
        return false;
    }

    let helperCount = 0;
    let orchestrationCount = 0;
    for (const entry of branch) {
        const name = typeof (entry as { name?: unknown })?.name === 'string' ? String((entry as { name?: unknown }).name) : '';
        const responsibility =
            typeof (entry as { responsibility?: unknown })?.responsibility === 'string'
                ? String((entry as { responsibility?: unknown }).responsibility)
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

function hasScaleMixingOperations(operations: TriadOperationIR[]) {
    if (operations.length < 3) {
        return false;
    }

    const helperCount = operations.filter((operation) => isHelperMethodName(operation.name)).length;
    const orchestrationCount = operations.filter((operation) => isOrchestrationOperation(operation)).length;
    return helperCount > 0 && orchestrationCount > 0;
}

function isOrchestrationOperation(operation: Pick<TriadOperationIR, 'name' | 'responsibility'>) {
    return (
        ORCHESTRATION_METHOD_PATTERN.test(String(operation.name ?? '').trim()) ||
        ORCHESTRATION_RESPONSIBILITY_PATTERN.test(String(operation.responsibility ?? '').trim())
    );
}

function isHelperMethodName(name: string) {
    return HELPER_METHOD_PATTERN.test(String(name ?? '').trim());
}

function isMeaningfulRightBranchContract(contract: string, genericContractIgnoreList: string[]) {
    const normalized = normalizeContractKey(contract);
    if (!normalized || NONE_TOKENS.has(normalized) || GHOST_DEMAND_PATTERN.test(String(contract ?? '').trim())) {
        return false;
    }

    return !resolveGenericContractIgnoreSet(genericContractIgnoreList).has(normalized);
}

function resolveGenericContractIgnoreSet(values: string[]) {
    return new Set(
        (Array.isArray(values) ? values : [])
            .map((value) => normalizeContractKey(value))
            .filter((value) => value && !NONE_TOKENS.has(value))
    );
}

function normalizeContractKey(contract: unknown) {
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

function formatVertexLabel(nodeId: string, sourcePath?: string) {
    return sourcePath?.trim() ? `${nodeId}@${sourcePath.trim()}` : nodeId;
}

function dedupeStrings(values: string[]) {
    return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function normalizeViolationLimit(value: number | undefined, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return fallback;
}

function safeRatio(part: number, total: number) {
    if (!total) {
        return 0;
    }
    return Number((part / total).toFixed(6));
}
