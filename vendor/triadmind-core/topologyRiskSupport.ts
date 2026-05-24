import { isSupportAbstractionSourcePath } from './supportAbstraction';
import type { TriadFission, TriadNodeDefinition } from './protocolRightBranch';

const GHOST_DEMAND_PATTERN = /^\[Ghost:[^\]]+\]/i;
const EXECUTE_LIKE_NODE_PATTERN = /(?:^|\.)(execute|run|handle|process|dispatch|apply|invoke|orchestrate|schedule|plan|do)(?:$|[_A-Z])/i;
const ADMINISTRATIVE_GHOST_NOISE_PREFIXES = ['apply', 'bootstrap', 'ensure', 'execute', 'init', 'install', 'register', 'reset', 'run', 'write'];
const ADMINISTRATIVE_GHOST_NOISE_SOURCE_HINTS = ['workflow', 'command', 'bootstrap', 'support'];
const ADMINISTRATIVE_AGGREGATE_SOURCE_HINTS = ['bootstrap', 'command', 'workflow', 'lifecycle', 'scaffold', 'support', 'helper', 'store', 'parser', 'extractor', 'catalog', 'config'];
const HELPER_PRIMITIVE_PREFIXES = [
    'build',
    'check',
    'collect',
    'convert',
    'create',
    'dedupe',
    'ensure',
    'extract',
    'filter',
    'find',
    'format',
    'get',
    'guess',
    'infer',
    'list',
    'load',
    'map',
    'match',
    'merge',
    'normalize',
    'parse',
    'prepare',
    'read',
    'resolve',
    'sanitize',
    'save',
    'set',
    'sync',
    'unwrap',
    'validate',
    'write'
];
const SURFACE_PROMOTION_REASONS = new Set(['runtime_signal', 'frontend_surface', 'agent_flow', 'cli_entrypoint']);

export type TopologyRiskNodeLike = Omit<Partial<TriadNodeDefinition>, 'fission'> & {
    fission?: Partial<TriadFission>;
};

export type MatureStableArchitectureOptions = {
    matureStableNodeIds?: string[];
    matureStableNodePatterns?: string[];
    matureStableSourcePaths?: string[];
    matureStableSourcePathPatterns?: string[];
};

export function hasGhostDemand(node: TopologyRiskNodeLike) {
    const demand = Array.isArray(node?.fission?.demand) ? node.fission!.demand! : [];
    return demand.some((entry) => GHOST_DEMAND_PATTERN.test(String(entry ?? '').trim()));
}

export function isGhostNoiseNode(node: TopologyRiskNodeLike, degree: number, executeLike = false) {
    if (!hasGhostDemand(node)) {
        return false;
    }

    if (degree === 0 && !executeLike) {
        return true;
    }

    return isAdministrativeGhostNoiseNode(node, degree, executeLike);
}

export function isSupportLayerAggregateNode(node: TopologyRiskNodeLike) {
    const nodeId = String(node?.nodeId ?? '').trim();
    if (!/\.module_pipeline$/i.test(nodeId)) {
        return false;
    }

    return isSupportAbstractionSourcePath(String(node?.sourcePath ?? ''));
}

export function isHelperPrimitiveNode(node: TopologyRiskNodeLike) {
    if (isSupportLayerAggregateNode(node)) {
        return false;
    }

    if (isAdministrativeAggregateNode(node)) {
        return false;
    }

    const nodeId = String(node?.nodeId ?? '').trim();
    const leafName = getNodeLeafName(nodeId);
    if (!leafName || EXECUTE_LIKE_NODE_PATTERN.test(nodeId)) {
        return false;
    }

    const supportSource = isSupportAbstractionSourcePath(String(node?.sourcePath ?? ''));
    const helperLike = HELPER_PRIMITIVE_PREFIXES.some((prefix) => hasCapabilityNamePrefix(leafName, prefix));
    if (!supportSource && !helperLike) {
        return false;
    }

    return !getPromotionReasons(node).some((reason) => SURFACE_PROMOTION_REASONS.has(reason));
}

export function isStructuralRiskCandidate(node: TopologyRiskNodeLike) {
    return !isSupportLayerAggregateNode(node) && !isHelperPrimitiveNode(node) && !isAdministrativeAggregateNode(node);
}

export function isMatureStableArchitectureNode(node: TopologyRiskNodeLike, options?: MatureStableArchitectureOptions) {
    const nodeId = String(node?.nodeId ?? '').trim();
    const sourcePath = normalizeRiskSourcePath(String(node?.sourcePath ?? ''));
    if (!nodeId && !sourcePath) {
        return false;
    }

    const matureStableNodeIds = new Set(
        (options?.matureStableNodeIds ?? []).map((entry) => String(entry ?? '').trim()).filter(Boolean)
    );
    if (nodeId && matureStableNodeIds.has(nodeId)) {
        return true;
    }

    const matureStableSourcePaths = new Set(
        (options?.matureStableSourcePaths ?? [])
            .map((entry) => normalizeRiskSourcePath(String(entry ?? '')))
            .filter(Boolean)
    );
    if (sourcePath && matureStableSourcePaths.has(sourcePath)) {
        return true;
    }

    if ((options?.matureStableNodePatterns ?? []).some((pattern) => matchesRegexPattern(nodeId, pattern))) {
        return true;
    }

    return (options?.matureStableSourcePathPatterns ?? []).some((pattern) => matchesSourcePathPattern(sourcePath, pattern));
}

export function getPromotionReasons(node: TopologyRiskNodeLike) {
    const reasons = Array.isArray(node?.fission?.evidence?.promotionReasons) ? node.fission!.evidence!.promotionReasons! : [];
    return Array.from(
        new Set(
            reasons
                .map((entry) => String(entry ?? '').trim())
                .filter(Boolean)
        )
    );
}

function getNodeLeafName(nodeId: string) {
    return nodeId.split('.').filter(Boolean).pop() ?? '';
}

function isAdministrativeGhostNoiseNode(node: TopologyRiskNodeLike, degree: number, executeLike = false) {
    if (degree > 1) {
        return false;
    }

    const nodeId = String(node?.nodeId ?? '').trim();
    const leafName = getNodeLeafName(nodeId);
    if (!leafName) {
        return false;
    }

    const sourcePath = normalizeRiskSourcePath(String(node?.sourcePath ?? ''));
    if (!ADMINISTRATIVE_GHOST_NOISE_SOURCE_HINTS.some((hint) => sourcePath.toLowerCase().includes(hint))) {
        return false;
    }

    const promotionReasons = getPromotionReasons(node);
    if (promotionReasons.some((reason) => reason === 'frontend_surface' || reason === 'agent_flow')) {
        return false;
    }

    if (executeLike) {
        return true;
    }

    return ADMINISTRATIVE_GHOST_NOISE_PREFIXES.some((prefix) => hasCapabilityNamePrefix(leafName, prefix));
}

function isAdministrativeAggregateNode(node: TopologyRiskNodeLike) {
    const nodeId = String(node?.nodeId ?? '').trim();
    if (!/\.capability$/i.test(nodeId)) {
        return false;
    }

    const sourcePath = normalizeRiskSourcePath(String(node?.sourcePath ?? ''));
    return ADMINISTRATIVE_AGGREGATE_SOURCE_HINTS.some((hint) => sourcePath.includes(hint));
}

function hasCapabilityNamePrefix(name: string, prefix: string) {
    const normalizedName = String(name ?? '').trim();
    if (!normalizedName) {
        return false;
    }

    if (normalizedName.toLowerCase() === prefix.toLowerCase()) {
        return true;
    }

    return new RegExp(`^${prefix}(?:$|_|[A-Z0-9])`, 'i').test(normalizedName);
}

function normalizeRiskSourcePath(value: string) {
    return String(value ?? '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '')
        .replace(/\/{2,}/g, '/');
}

function matchesRegexPattern(value: string, pattern: string) {
    if (!value.trim() || !String(pattern ?? '').trim()) {
        return false;
    }

    try {
        return new RegExp(pattern, 'i').test(value);
    } catch {
        return false;
    }
}

function matchesSourcePathPattern(sourcePath: string, pattern: string) {
    const normalizedPattern = String(pattern ?? '').trim();
    if (!sourcePath || !normalizedPattern) {
        return false;
    }

    const escaped = normalizedPattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '::DOUBLE_STAR::')
        .replace(/\*/g, '[^/]*')
        .replace(/::DOUBLE_STAR::/g, '.*')
        .replace(/\?/g, '.');
    try {
        return new RegExp(`^${escaped}$`, 'i').test(sourcePath);
    } catch {
        return false;
    }
}
