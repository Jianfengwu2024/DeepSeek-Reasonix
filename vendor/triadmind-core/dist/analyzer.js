"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBlastRadius = calculateBlastRadius;
exports.detectCycles = detectCycles;
exports.generateRenormalizeProtocol = generateRenormalizeProtocol;
exports.detectTopologicalDrift = detectTopologicalDrift;
exports.calculateProducerConsumerEdges = calculateProducerConsumerEdges;
exports.normalizeSubgraph = normalizeSubgraph;
exports.mapTopologyToYoungPartition = mapTopologyToYoungPartition;
exports.generateMayaSequence = generateMayaSequence;
exports.generateMayaFeatureHash = generateMayaFeatureHash;
exports.generateMayanMatrix = generateMayanMatrix;
exports.generateFeatureHash = generateFeatureHash;
exports.calculateDownstreamFanoutNodes = calculateDownstreamFanoutNodes;
exports.calculateAbstractionSummaryBySourcePath = calculateAbstractionSummaryBySourcePath;
exports.detectFlatVariantClusters = detectFlatVariantClusters;
exports.detectAbstractionDeficitHotspots = detectAbstractionDeficitHotspots;
exports.detectC2cCoupling = detectC2cCoupling;
const node_crypto_1 = require("node:crypto");
const artifactPathContracts_1 = require("./artifactPathContracts");
const NONE_TOKENS = new Set(['', 'none', 'void', 'null', 'undefined']);
const GENERIC_CONTRACT_TOKENS = new Set([
    'str',
    'string',
    'std::string',
    'int',
    'integer',
    'short',
    'byte',
    'long',
    'usize',
    'isize',
    'u8',
    'u16',
    'u32',
    'u64',
    'u128',
    'i8',
    'i16',
    'i32',
    'i64',
    'i128',
    'double',
    'float',
    'number',
    'bool',
    'boolean',
    'bigint',
    'symbol',
    'dict',
    'list',
    'vec',
    'set',
    'tuple',
    'any',
    'unknown',
    'object',
    'json',
    'request',
    'response',
    'path',
    'dict[str,any]',
    'optional[str]',
    'optional[int]',
    'list[str]',
    'list[string]',
    'record<string,any>',
    'record<string,unknown>',
    'mapping[str,any]',
    'list[any]',
    'array<any>',
    'array<unknown>',
    'sequence[any]',
    'map<string,object>',
    'map<string,any>',
    'map<string,unknown>'
]);
const MAX_CANONICAL_PERMUTATIONS = 4096;
const GENERIC_ATOMIC_CONTRACT_PATTERN = '(str|string|std::string|int|integer|short|byte|long|usize|isize|u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|double|float|number|bool|boolean|bigint|symbol|dict|list|vec|set|tuple|any|unknown|object|json|request|response|path)';
/**
 * @LeftBranch
 */
function calculateBlastRadius(map, targetNodeId, isContractChange, options) {
    if (!isContractChange) {
        return [];
    }
    const graph = buildTopologyGraph(map, options);
    if (!graph.adjacency.has(targetNodeId)) {
        return [];
    }
    return _collectBlastRadiusNodeIds(graph, targetNodeId);
}
/**
 * @LeftBranch
 */
function detectCycles(map, options) {
    const graph = buildTopologyGraph(map, options);
    return getCycles(graph);
}
/**
 * @LeftBranch
 */
function generateRenormalizeProtocol(map, cycles, options) {
    const graph = buildTopologyGraph(map, options);
    const nodeMap = buildNodeMap(map);
    const actions = cycles
        .filter((cycle) => cycle.length > 0)
        .map((cycle) => buildRenormalizeAction(cycle, graph, nodeMap, options));
    const summary = actions.length > 0
        ? actions.map((action) => `${action.macro_node_id} absorbs ${action.absorbed_nodes.length} node(s) with ${action.new_demand.length} external demand(s) and ${action.new_answer.length} external answer(s).`)
        : ['No cyclic strongly connected components found; no renormalization action generated.'];
    return {
        protocolVersion: '1.0',
        protocolType: 'triadmind-renormalize',
        actions,
        summary
    };
}
/**
 * @LeftBranch
 */
function detectTopologicalDrift(oldMap, newMap, options) {
    const oldGraph = buildTopologyGraph(oldMap, options);
    const newGraph = buildTopologyGraph(newMap, options);
    const oldCycleSignatures = new Set(getCycleSignatures(oldGraph));
    const newCycles = detectCycles(newMap, options).filter((cycle) => !oldCycleSignatures.has(toCycleSignature(cycle)));
    const brokenContracts = detectBrokenContracts(oldGraph, newGraph);
    const removedEdges = detectRemovedEdges(oldGraph, newGraph);
    const summary = [];
    if (newCycles.length > 0) {
        summary.push(`Detected ${newCycles.length} newly introduced cycle(s).`);
    }
    if (brokenContracts.length > 0) {
        summary.push(`Detected ${brokenContracts.length} broken contract demand(s).`);
    }
    if (removedEdges.length > 0) {
        summary.push(`Detected ${removedEdges.length} removed producer-consumer edge(s).`);
    }
    if (summary.length === 0) {
        summary.push('No topological degradation detected.');
    }
    return {
        isDegraded: newCycles.length > 0 || brokenContracts.length > 0 || removedEdges.length > 0,
        newCycles,
        brokenContracts,
        removedEdges,
        summary
    };
}
/**
 * @LeftBranch
 */
function calculateProducerConsumerEdges(map, options) {
    const graph = buildTopologyGraph(map, options);
    return graph.edges
        .slice()
        .sort((left, right) => left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to) ||
        left.contract.localeCompare(right.contract));
}
/**
 * @LeftBranch
 */
function normalizeSubgraph(subgraph) {
    const nodes = toUniqueTriadNodes(subgraph);
    if (nodes.length <= 1) {
        return nodes.map((node) => cloneJson(node));
    }
    const graph = buildTopologyGraph(nodes);
    const incoming = buildIncomingAdjacency(graph);
    const entries = buildCanonicalEntries(nodes, graph, incoming);
    const orderedEntries = resolveCanonicalOrdering(entries, nodes);
    return orderedEntries.map((entry) => cloneJson(entry.node));
}
/**
 * @LeftBranch
 */
function mapTopologyToYoungPartition(subgraph) {
    const normalizedNodes = normalizeSubgraph(subgraph);
    return buildYoungPartitionFromNormalizedNodes(normalizedNodes);
}
function buildYoungPartitionFromNormalizedNodes(normalizedNodes) {
    if (normalizedNodes.length === 0) {
        return [];
    }
    const graph = buildTopologyGraph(normalizedNodes);
    const componentLevels = buildComponentLevels(graph);
    const nodeWeights = buildNodeWeights(normalizedNodes, graph);
    let maxLevel = 0;
    for (const level of componentLevels.values()) {
        maxLevel = Math.max(maxLevel, level);
    }
    const partition = Array.from({ length: maxLevel + 1 }, (_, level) => {
        let width = 0;
        for (const node of normalizedNodes) {
            const nodeId = typeof node.nodeId === 'string' ? node.nodeId.trim() : '';
            if (!nodeId) {
                continue;
            }
            const nodeLevel = componentLevels.get(nodeId) ?? 0;
            if (nodeLevel >= level) {
                width += nodeWeights.get(nodeId) ?? 1;
            }
        }
        return width;
    }).filter((width) => width > 0);
    return partition;
}
/**
 * @LeftBranch
 */
function generateMayaSequence(partition) {
    const normalizedPartition = Array.isArray(partition)
        ? partition
            .map((value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0))
            .filter((value) => value > 0)
        : [];
    if (normalizedPartition.length === 0) {
        return [];
    }
    const mayaSequence = [];
    const mirroredProfile = normalizedPartition.slice().reverse();
    let currentWidth = 0;
    for (const rowWidth of mirroredProfile) {
        for (let cursor = currentWidth; cursor < rowWidth; cursor += 1) {
            mayaSequence.push(0);
        }
        mayaSequence.push(1);
        currentWidth = rowWidth;
    }
    return mayaSequence;
}
/**
 * @LeftBranch
 */
function generateMayaFeatureHash(mayaSequence) {
    const normalizedSequence = Array.isArray(mayaSequence)
        ? mayaSequence.map((value) => (value ? 1 : 0))
        : [];
    const bitString = normalizedSequence.map((value) => (value ? '1' : '0')).join('');
    const digest = (0, node_crypto_1.createHash)('sha256')
        .update(`maya:${normalizedSequence.length}:${bitString}`, 'utf8')
        .digest('hex')
        .slice(0, 8)
        .toUpperCase();
    return `Maya-ID: 0x${digest}`;
}
/**
 * @deprecated Use `generateMayaSequence(mapTopologyToYoungPartition(nodes))`.
 */
function generateMayanMatrix(normalizedNodes) {
    return [generateMayaSequence(mapTopologyToYoungPartition(normalizedNodes))];
}
/**
 * @deprecated Use `generateMayaFeatureHash(sequence)`.
 */
function generateFeatureHash(matrix) {
    const flattened = Array.isArray(matrix)
        ? matrix.flatMap((row) => (Array.isArray(row) ? row.map((value) => (value ? 1 : 0)) : []))
        : [];
    return generateMayaFeatureHash(flattened);
}
function detectBrokenContracts(oldGraph, newGraph) {
    const brokenContracts = [];
    for (const [consumerNodeId, demandKeys] of newGraph.demandKeysByNode.entries()) {
        for (const demandKey of demandKeys) {
            const newProducers = newGraph.producersByContract.get(demandKey);
            if (newProducers && newProducers.size > 0) {
                continue;
            }
            const previousProducers = oldGraph.producersByContract.get(demandKey);
            if (!previousProducers || previousProducers.size === 0) {
                continue;
            }
            brokenContracts.push({
                consumerNodeId,
                demand: demandKey,
                previousProducers: Array.from(previousProducers).sort()
            });
        }
    }
    return brokenContracts.sort((left, right) => left.consumerNodeId.localeCompare(right.consumerNodeId) || left.demand.localeCompare(right.demand));
}
function detectRemovedEdges(oldGraph, newGraph) {
    const newNodeIds = new Set(newGraph.nodeIds);
    const removedEdges = [];
    for (const edge of oldGraph.edges) {
        if (!newNodeIds.has(edge.from) || !newNodeIds.has(edge.to)) {
            continue;
        }
        const edgeKey = toEdgeKey(edge.from, edge.to, edge.contract);
        if (!newGraph.edgeKeys.has(edgeKey)) {
            removedEdges.push(edge);
        }
    }
    return removedEdges.sort((left, right) => left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to) ||
        left.contract.localeCompare(right.contract));
}
/**
 * @LeftBranch
 */
function calculateDownstreamFanoutNodes(map, threshold = 1, options) {
    const graph = buildTopologyGraph(map, options);
    const normalizedThreshold = Number.isFinite(threshold) ? Math.max(1, Math.floor(threshold)) : 1;
    return Array.from(graph.adjacency.entries())
        .map(([nodeId, downstreams]) => {
        const downstreamNodeIds = Array.from(downstreams)
            .filter((downstreamNodeId) => downstreamNodeId !== nodeId)
            .sort();
        return {
            nodeId,
            downstreamCount: downstreamNodeIds.length,
            downstreamNodeIds
        };
    })
        .filter((entry) => entry.downstreamCount >= normalizedThreshold)
        .sort((left, right) => right.downstreamCount - left.downstreamCount || left.nodeId.localeCompare(right.nodeId));
}
/**
 * @LeftBranch
 */
function calculateAbstractionSummaryBySourcePath(map) {
    const groups = new Map();
    for (const rawNode of Array.isArray(map) ? map : []) {
        const nodeId = normalizeAnalyzerText(rawNode?.nodeId);
        const sourcePath = normalizeAnalyzerSourcePath(rawNode?.sourcePath);
        if (!nodeId || !sourcePath) {
            continue;
        }
        const abstraction = readAbstractionEvidence(rawNode);
        const group = groups.get(sourcePath) ??
            {
                sourcePath,
                nodeIds: new Set(),
                abstractionSignalCount: 0,
                concreteSignalCount: 0,
                interfaceCount: 0,
                abstractClassCount: 0,
                typeAliasCount: 0,
                concreteClassCount: 0,
                publicMethodCount: 0,
                topLevelExecutableCount: 0,
                variantClusters: new Set(),
                implementingNodes: new Set(),
                dependentNodes: new Set()
            };
        group.nodeIds.add(nodeId);
        group.abstractionSignalCount = Math.max(group.abstractionSignalCount, readNonNegativeInteger(abstraction?.abstractionSignalCount));
        group.concreteSignalCount = Math.max(group.concreteSignalCount, readNonNegativeInteger(abstraction?.concreteSignalCount));
        group.interfaceCount = Math.max(group.interfaceCount, readNonNegativeInteger(abstraction?.interfaceCount));
        group.abstractClassCount = Math.max(group.abstractClassCount, readNonNegativeInteger(abstraction?.abstractClassCount));
        group.typeAliasCount = Math.max(group.typeAliasCount, readNonNegativeInteger(abstraction?.typeAliasCount));
        group.concreteClassCount = Math.max(group.concreteClassCount, readNonNegativeInteger(abstraction?.concreteClassCount));
        group.publicMethodCount = Math.max(group.publicMethodCount, readNonNegativeInteger(abstraction?.publicMethodCount));
        group.topLevelExecutableCount = Math.max(group.topLevelExecutableCount, readNonNegativeInteger(abstraction?.topLevelExecutableCount));
        const variantCluster = normalizeAnalyzerText(abstraction?.variantCluster);
        if (variantCluster) {
            group.variantClusters.add(variantCluster);
        }
        if (readStringList(abstraction?.implements).length > 0 || readStringList(abstraction?.extendsAbstract).length > 0) {
            group.implementingNodes.add(nodeId);
        }
        if (readStringList(abstraction?.dependsOnAbstractions).length > 0) {
            group.dependentNodes.add(nodeId);
        }
        groups.set(sourcePath, group);
    }
    return Array.from(groups.values())
        .map((group) => {
        const denominator = group.abstractionSignalCount + group.concreteSignalCount;
        const abstractionRatio = denominator > 0 ? safeRatio(group.abstractionSignalCount, denominator) : 0;
        let role = 'unknown';
        if (group.abstractionSignalCount > 0 && group.concreteSignalCount === 0) {
            role = 'abstraction_rich';
        }
        else if (group.abstractionSignalCount === 0 && group.concreteSignalCount > 0) {
            role = 'concrete_only';
        }
        else if (group.abstractionSignalCount > 0 && group.concreteSignalCount > 0) {
            role = 'mixed';
        }
        return {
            sourcePath: group.sourcePath,
            nodeIds: Array.from(group.nodeIds).sort(),
            nodeCount: group.nodeIds.size,
            abstractionSignalCount: group.abstractionSignalCount,
            concreteSignalCount: group.concreteSignalCount,
            interfaceCount: group.interfaceCount,
            abstractClassCount: group.abstractClassCount,
            typeAliasCount: group.typeAliasCount,
            concreteClassCount: group.concreteClassCount,
            publicMethodCount: group.publicMethodCount,
            topLevelExecutableCount: group.topLevelExecutableCount,
            abstractionRatio,
            role,
            variantClusters: Array.from(group.variantClusters).sort(),
            implementingNodes: Array.from(group.implementingNodes).sort(),
            dependentNodes: Array.from(group.dependentNodes).sort()
        };
    })
        .sort((left, right) => right.concreteSignalCount - left.concreteSignalCount ||
        right.abstractionSignalCount - left.abstractionSignalCount ||
        left.sourcePath.localeCompare(right.sourcePath));
}
/**
 * @LeftBranch
 */
function detectFlatVariantClusters(map, minNodes = 2) {
    const threshold = Math.max(2, Math.floor(minNodes));
    const summaries = calculateAbstractionSummaryBySourcePath(map);
    const summaryByPath = new Map(summaries.map((entry) => [entry.sourcePath, entry]));
    const groups = new Map();
    for (const rawNode of Array.isArray(map) ? map : []) {
        const nodeId = normalizeAnalyzerText(rawNode?.nodeId);
        const sourcePath = normalizeAnalyzerSourcePath(rawNode?.sourcePath);
        const abstraction = readAbstractionEvidence(rawNode);
        const cluster = normalizeAnalyzerText(abstraction?.variantCluster);
        if (!nodeId || !sourcePath || !cluster) {
            continue;
        }
        const key = `${sourcePath}::${cluster}`;
        const group = groups.get(key) ??
            {
                sourcePath,
                cluster,
                nodeIds: new Set(),
                contractCoverage: false
            };
        group.nodeIds.add(nodeId);
        if (readStringList(abstraction?.implements).length > 0 ||
            readStringList(abstraction?.extendsAbstract).length > 0 ||
            readStringList(abstraction?.dependsOnAbstractions).length > 0) {
            group.contractCoverage = true;
        }
        groups.set(key, group);
    }
    return Array.from(groups.values())
        .filter((group) => group.nodeIds.size >= threshold)
        .map((group) => {
        const summary = summaryByPath.get(group.sourcePath);
        return {
            sourcePath: group.sourcePath,
            cluster: group.cluster,
            nodeIds: Array.from(group.nodeIds).sort(),
            abstractionSignalCount: summary?.abstractionSignalCount ?? 0,
            concreteSignalCount: summary?.concreteSignalCount ?? 0,
            contractCoverage: group.contractCoverage || (summary?.abstractionSignalCount ?? 0) > 0
        };
    })
        .sort((left, right) => right.nodeIds.length - left.nodeIds.length ||
        left.sourcePath.localeCompare(right.sourcePath) ||
        left.cluster.localeCompare(right.cluster));
}
/**
 * @LeftBranch
 */
function detectAbstractionDeficitHotspots(map, options = {}) {
    const minConcreteSignals = Math.max(1, Math.floor(options.minConcreteSignals ?? 4));
    const maxAbstractionRatio = clampRatio(options.maxAbstractionRatio ?? 0.2);
    const clustersByPath = new Map();
    for (const cluster of detectFlatVariantClusters(map)) {
        const current = clustersByPath.get(cluster.sourcePath) ?? [];
        current.push(cluster.cluster);
        clustersByPath.set(cluster.sourcePath, current);
    }
    return calculateAbstractionSummaryBySourcePath(map)
        .filter((summary) => {
        if (summary.concreteSignalCount < minConcreteSignals) {
            return false;
        }
        return summary.abstractionSignalCount === 0 || summary.abstractionRatio <= maxAbstractionRatio;
    })
        .map((summary) => ({
        sourcePath: summary.sourcePath,
        nodeIds: summary.nodeIds,
        abstractionSignalCount: summary.abstractionSignalCount,
        concreteSignalCount: summary.concreteSignalCount,
        abstractionRatio: summary.abstractionRatio,
        variantClusters: dedupeSortedStrings(clustersByPath.get(summary.sourcePath) ?? summary.variantClusters),
        reason: summary.abstractionSignalCount === 0
            ? 'no abstraction signals detected in a concrete-heavy module'
            : `abstraction ratio ${summary.abstractionRatio.toFixed(3)} is below threshold ${maxAbstractionRatio.toFixed(3)}`
    }))
        .sort((left, right) => right.concreteSignalCount - left.concreteSignalCount ||
        left.abstractionRatio - right.abstractionRatio ||
        left.sourcePath.localeCompare(right.sourcePath));
}
/**
 * Detect concrete-to-concrete (C2C) coupling risk by analyzing the
 * ratio of concrete classes to interfaces and abstraction coverage
 * per source path.
 *
 * High C2C coupling means concrete classes depend on other concrete
 * classes without an abstraction layer — a DIP violation risk.
 */
function detectC2cCoupling(map, options = {}) {
    const maxRatio = Math.max(1, options.maxConcretePerInterface ?? 5);
    const minConcrete = Math.max(1, options.minConcreteClasses ?? 3);
    const summaries = calculateAbstractionSummaryBySourcePath(map);
    return summaries
        .filter((s) => s.concreteClassCount >= minConcrete)
        .map((s) => {
        const interfaceCount = s.interfaceCount || 0;
        const concretePerInterface = interfaceCount > 0
            ? s.concreteClassCount / interfaceCount
            : Infinity;
        const detail = buildC2cDetail(s, concretePerInterface, maxRatio);
        const confidence = clampRatio(concretePerInterface > maxRatio
            ? 0.5 + Math.min(0.4, (concretePerInterface - maxRatio) / 20)
            : s.interfaceCount === 0
                ? 0.6
                : 0.3);
        return {
            sourcePath: s.sourcePath,
            confidence,
            concretePerInterface: concretePerInterface === Infinity ? -1 : concretePerInterface,
            concreteClassCount: s.concreteClassCount,
            interfaceCount,
            concreteSignalCount: s.concreteSignalCount,
            abstractionSignalCount: s.abstractionSignalCount,
            nodeIds: s.nodeIds,
            detail
        };
    })
        .filter((f) => f.concretePerInterface === -1 || f.concretePerInterface > maxRatio)
        .sort((a, b) => b.concreteClassCount - a.concreteClassCount || a.sourcePath.localeCompare(b.sourcePath));
}
function buildC2cDetail(s, concretePerInterface, maxRatio) {
    const parts = [];
    if (s.interfaceCount === 0) {
        parts.push(`${s.concreteClassCount} concrete classes with zero interfaces`);
    }
    else if (concretePerInterface > maxRatio) {
        parts.push(`${concretePerInterface.toFixed(1)} concrete classes per interface (limit: ${maxRatio})`);
    }
    if (s.concreteSignalCount > 0 && s.abstractionSignalCount === 0) {
        parts.push('concrete-only signals — no abstraction evidence at all');
    }
    if (s.implementingNodes.length === 0 && s.dependentNodes.length === 0) {
        parts.push('no contract relationships (implements/extends/dependsOnAbstractions missing)');
    }
    return parts.join('; ') || `${s.concreteClassCount} concrete classes in ${s.sourcePath}`;
}
function getCycleSignatures(graph) {
    return getCycles(graph).map((cycle) => toCycleSignature(cycle));
}
function toUniqueTriadNodes(subgraph) {
    const nodes = Array.isArray(subgraph) ? subgraph : [];
    const seen = new Set();
    const uniqueNodes = [];
    for (const node of nodes) {
        const nodeId = typeof node?.nodeId === 'string' ? node.nodeId.trim() : '';
        if (!nodeId || seen.has(nodeId)) {
            continue;
        }
        seen.add(nodeId);
        uniqueNodes.push(node);
    }
    return uniqueNodes;
}
function buildIncomingAdjacency(graph) {
    const incoming = new Map();
    for (const nodeId of graph.nodeIds) {
        incoming.set(nodeId, new Set());
    }
    for (const [from, downstreams] of graph.adjacency.entries()) {
        for (const to of downstreams) {
            ensureSet(incoming, to).add(from);
        }
    }
    return incoming;
}
/**
 * Maps a normalized triad topology into a Young partition by:
 * 1. Collapsing cycles into strongly connected components.
 * 2. Using the condensation DAG depth as the partition row index.
 * 3. Using cumulative architectural complexity as the row width.
 *
 * Row `k` contains the sum of weights for every node whose component depth is
 * greater than or equal to `k`, which guarantees a non-increasing integer
 * partition and makes isomorphic topologies converge to the same Young shape.
 */
function buildComponentLevels(graph) {
    const components = tarjan(graph.adjacency, graph.nodeIds)
        .map((component) => component.slice().sort())
        .sort((left, right) => toCycleSignature(left).localeCompare(toCycleSignature(right)));
    const componentIdByNode = new Map();
    const dag = new Map();
    const indegree = new Map();
    for (const component of components) {
        const componentId = toCycleSignature(component);
        dag.set(componentId, new Set());
        indegree.set(componentId, 0);
        for (const nodeId of component) {
            componentIdByNode.set(nodeId, componentId);
        }
    }
    for (const [from, downstreams] of graph.adjacency.entries()) {
        const fromComponentId = componentIdByNode.get(from);
        if (!fromComponentId) {
            continue;
        }
        for (const to of downstreams) {
            const toComponentId = componentIdByNode.get(to);
            if (!toComponentId || toComponentId === fromComponentId) {
                continue;
            }
            const targets = dag.get(fromComponentId);
            if (!targets?.has(toComponentId)) {
                targets?.add(toComponentId);
                indegree.set(toComponentId, (indegree.get(toComponentId) ?? 0) + 1);
            }
        }
    }
    const levelsByComponent = new Map();
    const queue = Array.from(indegree.entries())
        .filter(([, degree]) => degree === 0)
        .map(([componentId]) => componentId)
        .sort();
    let cursor = 0;
    while (cursor < queue.length) {
        const componentId = queue[cursor];
        cursor += 1;
        const currentLevel = levelsByComponent.get(componentId) ?? 0;
        for (const nextComponentId of Array.from(dag.get(componentId) ?? []).sort()) {
            const nextLevel = Math.max(levelsByComponent.get(nextComponentId) ?? 0, currentLevel + 1);
            levelsByComponent.set(nextComponentId, nextLevel);
            const nextIndegree = (indegree.get(nextComponentId) ?? 0) - 1;
            indegree.set(nextComponentId, nextIndegree);
            if (nextIndegree === 0) {
                queue.push(nextComponentId);
            }
        }
    }
    const levelsByNode = new Map();
    for (const [nodeId, componentId] of componentIdByNode.entries()) {
        levelsByNode.set(nodeId, levelsByComponent.get(componentId) ?? 0);
    }
    return levelsByNode;
}
function buildNodeWeights(nodes, graph) {
    const nodeIdSet = new Set(graph.nodeIds);
    const weights = new Map();
    const incomingCounts = new Map();
    for (const edge of graph.edges) {
        incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
    }
    for (const node of nodes) {
        const nodeId = typeof node.nodeId === 'string' ? node.nodeId.trim() : '';
        if (!nodeId) {
            continue;
        }
        const demandKeys = getDemandKeys(node);
        const answerKeys = getAnswerKeys(node);
        const internalDemandCount = demandKeys.filter((demandKey) => Array.from(graph.producersByContract.get(demandKey) ?? []).some((producerNodeId) => nodeIdSet.has(producerNodeId))).length;
        const internalAnswerCount = answerKeys.filter((answerKey) => Array.from(graph.consumersByContract.get(answerKey) ?? []).some((consumerNodeId) => nodeIdSet.has(consumerNodeId))).length;
        const inDegree = incomingCounts.get(nodeId) ?? 0;
        const outDegree = Array.from(graph.adjacency.get(nodeId) ?? []).length;
        weights.set(nodeId, 1 + internalDemandCount + internalAnswerCount + inDegree + outDegree);
    }
    return weights;
}
function _collectBlastRadiusNodeIds(graph, targetNodeId) {
    const impacted = new Set();
    const traversal = _createBlastRadiusTraversal(targetNodeId);
    while (traversal.cursor < traversal.queue.length) {
        const currentNodeId = traversal.queue[traversal.cursor];
        traversal.cursor += 1;
        const downstreams = graph.adjacency.get(currentNodeId);
        if (!downstreams) {
            continue;
        }
        for (const downstreamNodeId of downstreams) {
            if (downstreamNodeId === traversal.targetNodeId ||
                impacted.has(downstreamNodeId)) {
                continue;
            }
            impacted.add(downstreamNodeId);
            traversal.queue.push(downstreamNodeId);
        }
    }
    return Array.from(impacted);
}
function _createBlastRadiusTraversal(targetNodeId) {
    return {
        targetNodeId,
        queue: [targetNodeId],
        cursor: 0
    };
}
function buildCanonicalEntries(nodes, graph, incoming) {
    const nodeIdSet = new Set(graph.nodeIds);
    const answerKeysByNode = new Map();
    const baseEntries = [];
    for (const node of nodes) {
        const nodeId = typeof node.nodeId === 'string' ? node.nodeId.trim() : '';
        if (!nodeId) {
            continue;
        }
        const demandKeys = getDemandKeys(node);
        const answerKeys = getAnswerKeys(node);
        answerKeysByNode.set(nodeId, answerKeys);
        const internalDemand = demandKeys.filter((demandKey) => Array.from(graph.producersByContract.get(demandKey) ?? []).some((producerNodeId) => nodeIdSet.has(producerNodeId)));
        const externalDemand = demandKeys.filter((demandKey) => !internalDemand.includes(demandKey));
        const internalAnswer = answerKeys.filter((answerKey) => Array.from(graph.consumersByContract.get(answerKey) ?? []).some((consumerNodeId) => nodeIdSet.has(consumerNodeId)));
        const externalAnswer = answerKeys.filter((answerKey) => !internalAnswer.includes(answerKey));
        const baseSignature = stableStringify({
            demand: demandKeys,
            answer: answerKeys,
            internalDemand,
            externalDemand,
            internalAnswer,
            externalAnswer,
            inDegree: (incoming.get(nodeId) ?? new Set()).size,
            outDegree: (graph.adjacency.get(nodeId) ?? new Set()).size,
            selfLoop: graph.adjacency.get(nodeId)?.has(nodeId) ?? false
        });
        baseEntries.push({
            node,
            nodeId,
            originalIndex: baseEntries.length,
            baseSignature,
            refinedSignature: baseSignature,
            structuralFingerprint: stableStringify({
                demand: demandKeys,
                answer: answerKeys
            })
        });
    }
    let colors = new Map(baseEntries.map((entry) => [entry.nodeId, entry.baseSignature]));
    for (let iteration = 0; iteration < nodes.length; iteration += 1) {
        let changed = false;
        const nextColors = new Map();
        for (const entry of baseEntries) {
            const outgoingColors = Array.from(graph.adjacency.get(entry.nodeId) ?? [])
                .map((nodeId) => colors.get(nodeId) ?? '')
                .sort();
            const incomingColors = Array.from(incoming.get(entry.nodeId) ?? [])
                .map((nodeId) => colors.get(nodeId) ?? '')
                .sort();
            const refined = stableStringify({
                self: colors.get(entry.nodeId) ?? entry.baseSignature,
                incoming: incomingColors,
                outgoing: outgoingColors,
                contracts: entry.baseSignature
            });
            nextColors.set(entry.nodeId, refined);
            if (refined !== colors.get(entry.nodeId)) {
                changed = true;
            }
        }
        colors = nextColors;
        if (!changed) {
            break;
        }
    }
    return baseEntries.map(({ nodeId, ...entry }) => ({
        ...entry,
        refinedSignature: colors.get(nodeId) ?? entry.baseSignature,
        structuralFingerprint: stableStringify({
            base: entry.baseSignature,
            refined: colors.get(nodeId) ?? entry.baseSignature,
            answers: answerKeysByNode.get(nodeId) ?? []
        })
    }));
}
function resolveCanonicalOrdering(entries, nodes) {
    const groupedEntries = new Map();
    for (const entry of entries) {
        ensureArray(groupedEntries, entry.refinedSignature).push(entry);
    }
    const sortedGroups = Array.from(groupedEntries.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, group]) => group.slice().sort((left, right) => {
        const diff = left.baseSignature.localeCompare(right.baseSignature);
        if (diff !== 0) {
            return diff;
        }
        return left.structuralFingerprint.localeCompare(right.structuralFingerprint);
    }));
    const ambiguousGroupSizes = sortedGroups
        .filter((group) => group.length > 1)
        .map((group) => factorial(group.length));
    const permutationBudget = ambiguousGroupSizes.reduce((product, value) => product * value, 1);
    if (permutationBudget > MAX_CANONICAL_PERMUTATIONS) {
        return sortedGroups
            .flat()
            .sort((left, right) => left.refinedSignature.localeCompare(right.refinedSignature) ||
            left.baseSignature.localeCompare(right.baseSignature) ||
            left.structuralFingerprint.localeCompare(right.structuralFingerprint) ||
            getStableNodeFallback(left.node).localeCompare(getStableNodeFallback(right.node)) ||
            left.originalIndex - right.originalIndex);
    }
    const candidates = sortedGroups.map((group) => (group.length <= 1 ? [group] : permute(group)));
    let bestOrder = null;
    let bestSignature = '';
    const visit = (groupIndex, partial) => {
        if (groupIndex >= candidates.length) {
            const signature = buildCanonicalOrderSignature(partial, nodes);
            if (!bestOrder || signature.localeCompare(bestSignature) < 0) {
                bestOrder = partial.slice();
                bestSignature = signature;
            }
            return;
        }
        for (const candidate of candidates[groupIndex]) {
            partial.push(...candidate);
            visit(groupIndex + 1, partial);
            partial.length -= candidate.length;
        }
    };
    visit(0, []);
    return bestOrder ?? sortedGroups.flat();
}
function buildCanonicalOrderSignature(order, _nodes) {
    const partition = buildYoungPartitionFromNormalizedNodes(order.map((entry) => entry.node));
    const mayaSequence = generateMayaSequence(partition);
    const nodeSignature = order
        .map((entry) => `${entry.refinedSignature}::${entry.baseSignature}::${entry.structuralFingerprint}`)
        .join('||');
    return `${partition.join(',')}##${mayaSequence.join('')}##${nodeSignature}`;
}
function factorial(value) {
    let result = 1;
    for (let cursor = 2; cursor <= value; cursor += 1) {
        result *= cursor;
    }
    return result;
}
function permute(items) {
    if (items.length <= 1) {
        return [items.slice()];
    }
    const result = [];
    const used = Array.from({ length: items.length }, () => false);
    const current = [];
    const visit = () => {
        if (current.length === items.length) {
            result.push(current.slice());
            return;
        }
        for (let index = 0; index < items.length; index += 1) {
            if (used[index]) {
                continue;
            }
            used[index] = true;
            current.push(items[index]);
            visit();
            current.pop();
            used[index] = false;
        }
    };
    visit();
    return result;
}
function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function getStableNodeFallback(node) {
    return stableStringify({
        category: node?.category ?? null,
        sourcePath: node?.sourcePath ?? null,
        fission: node.fission ?? null
    });
}
function ensureArray(map, key) {
    const existing = map.get(key);
    if (existing) {
        return existing;
    }
    const created = [];
    map.set(key, created);
    return created;
}
function getCycles(graph) {
    const stronglyConnectedComponents = tarjan(graph.adjacency, graph.nodeIds);
    const cycles = stronglyConnectedComponents
        .filter((component) => component.length > 1 || hasSelfLoop(component[0], graph.adjacency))
        .map((component) => component.slice().sort());
    cycles.sort((left, right) => toCycleSignature(left).localeCompare(toCycleSignature(right)));
    return cycles;
}
function hasSelfLoop(nodeId, adjacency) {
    if (!nodeId) {
        return false;
    }
    return adjacency.get(nodeId)?.has(nodeId) ?? false;
}
function tarjan(adjacency, nodeIds) {
    let index = 0;
    const indexMap = new Map();
    const lowLinkMap = new Map();
    const stack = [];
    const inStack = new Set();
    const components = [];
    const visit = (nodeId) => {
        indexMap.set(nodeId, index);
        lowLinkMap.set(nodeId, index);
        index += 1;
        stack.push(nodeId);
        inStack.add(nodeId);
        for (const nextNodeId of adjacency.get(nodeId) ?? []) {
            if (!indexMap.has(nextNodeId)) {
                visit(nextNodeId);
                lowLinkMap.set(nodeId, Math.min(lowLinkMap.get(nodeId), lowLinkMap.get(nextNodeId)));
                continue;
            }
            if (inStack.has(nextNodeId)) {
                lowLinkMap.set(nodeId, Math.min(lowLinkMap.get(nodeId), indexMap.get(nextNodeId)));
            }
        }
        if (lowLinkMap.get(nodeId) !== indexMap.get(nodeId)) {
            return;
        }
        const component = [];
        while (stack.length > 0) {
            const stackedNodeId = stack.pop();
            inStack.delete(stackedNodeId);
            component.push(stackedNodeId);
            if (stackedNodeId === nodeId) {
                break;
            }
        }
        components.push(component);
    };
    for (const nodeId of nodeIds) {
        if (!indexMap.has(nodeId)) {
            visit(nodeId);
        }
    }
    return components;
}
function buildTopologyGraph(map, options) {
    const nodeIds = [];
    const adjacency = new Map();
    const edges = [];
    const edgeKeys = new Set();
    const producersByContract = new Map();
    const consumersByContract = new Map();
    const demandKeysByNode = new Map();
    const nodes = Array.isArray(map) ? map : [];
    for (const item of nodes) {
        const nodeId = typeof item?.nodeId === 'string' ? item.nodeId.trim() : '';
        if (!nodeId) {
            continue;
        }
        nodeIds.push(nodeId);
        adjacency.set(nodeId, new Set());
        for (const answerKey of getAnswerKeys(item, options)) {
            ensureSet(producersByContract, answerKey).add(nodeId);
        }
        demandKeysByNode.set(nodeId, getDemandKeys(item, options));
    }
    for (const nodeId of nodeIds) {
        const demandKeys = demandKeysByNode.get(nodeId) ?? [];
        for (const demandKey of demandKeys) {
            for (const producerNodeId of producersByContract.get(demandKey) ?? []) {
                adjacency.get(producerNodeId)?.add(nodeId);
                ensureSet(consumersByContract, demandKey).add(nodeId);
                const edge = {
                    from: producerNodeId,
                    to: nodeId,
                    contract: demandKey
                };
                const edgeKey = toEdgeKey(edge.from, edge.to, edge.contract);
                if (!edgeKeys.has(edgeKey)) {
                    edgeKeys.add(edgeKey);
                    edges.push(edge);
                }
            }
        }
    }
    return {
        nodeIds: Array.from(new Set(nodeIds)).sort(),
        adjacency,
        edges,
        edgeKeys,
        producersByContract,
        consumersByContract,
        demandKeysByNode
    };
}
function buildNodeMap(map) {
    const result = new Map();
    const nodes = Array.isArray(map) ? map : [];
    for (const item of nodes) {
        const nodeId = typeof item?.nodeId === 'string' ? item.nodeId.trim() : '';
        if (nodeId) {
            result.set(nodeId, item);
        }
    }
    return result;
}
function buildRenormalizeAction(cycle, graph, nodeMap, options) {
    const cycleNodeIds = cycle.slice().sort();
    const cycleNodeIdSet = new Set(cycleNodeIds);
    const externalDemand = new Set();
    const externalAnswer = new Set();
    for (const nodeId of cycleNodeIds) {
        const demandKeys = graph.demandKeysByNode.get(nodeId) ?? [];
        for (const demandKey of demandKeys) {
            const producers = graph.producersByContract.get(demandKey) ?? new Set();
            const hasInternalProducer = Array.from(producers).some((producerNodeId) => cycleNodeIdSet.has(producerNodeId));
            if (!hasInternalProducer) {
                externalDemand.add(demandKey);
            }
        }
    }
    for (const nodeId of cycleNodeIds) {
        const answerKeys = getAnswerKeys(nodeMap.get(nodeId) ?? {}, options);
        for (const answerKey of answerKeys) {
            const consumers = getConsumersForContract(answerKey, graph);
            const hasExternalConsumer = consumers.some((consumerNodeId) => !cycleNodeIdSet.has(consumerNodeId));
            const hasNoConsumer = consumers.length === 0;
            if (hasExternalConsumer || hasNoConsumer) {
                externalAnswer.add(answerKey);
            }
        }
    }
    return {
        op: 'create_macro_node',
        macro_node_id: buildMacroNodeId(cycleNodeIds),
        absorbed_nodes: cycleNodeIds,
        new_demand: Array.from(externalDemand).sort(),
        new_answer: Array.from(externalAnswer).sort(),
        rationale: `Collapse the strongly connected component ${cycleNodeIds.join(', ')} into a language-agnostic macro node and expose only its external contract boundary.`
    };
}
function getConsumersForContract(contract, graph) {
    return Array.from(graph.consumersByContract.get(contract) ?? []).sort();
}
function buildMacroNodeId(nodeIds) {
    const signature = nodeIds
        .map((nodeId) => nodeId.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))
        .filter(Boolean)
        .join('__');
    return `MacroNode.${signature || 'Cycle'}`;
}
function getDemandKeys(node, options) {
    return getFissionArray(node, 'demand')
        .map((entry) => normalizeDemandContract(entry, options))
        .filter((entry) => Boolean(entry));
}
function getAnswerKeys(node, options) {
    return getFissionArray(node, 'answer')
        .map((entry) => normalizeAnswerContract(entry, options))
        .filter((entry) => Boolean(entry));
}
function getFissionArray(node, key) {
    const value = node?.fission?.[key];
    return Array.isArray(value) ? value.map((entry) => String(entry ?? '').trim()) : [];
}
function normalizeDemandContract(entry, options) {
    if (!entry || /^\[ghost/i.test(entry)) {
        return null;
    }
    const match = entry.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    const typeText = match ? match[1].trim() : entry.trim();
    return normalizeContractKey(typeText, options);
}
function normalizeAnswerContract(entry, options) {
    return normalizeContractKey(entry, options);
}
function normalizeContractKey(value, options) {
    const compact = value
        .trim()
        .replace(/^\[generic\]\s*/i, '')
        .replace(/^typing\./i, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([<>{}()[\]|,:=&?])\s*/g, '$1');
    if (NONE_TOKENS.has(compact.toLowerCase())) {
        return null;
    }
    if (isGenericContractKey(compact, options)) {
        return null;
    }
    return compact;
}
function isGenericContractKey(value, options) {
    if (options?.ignoreGenericContracts === false) {
        return false;
    }
    const compact = value.toLowerCase().replace(/\s+/g, '');
    const customIgnoreSet = new Set((options?.genericContractIgnoreList ?? [])
        .map((item) => String(item ?? '').toLowerCase().replace(/\s+/g, ''))
        .filter(Boolean));
    return (GENERIC_CONTRACT_TOKENS.has(compact) ||
        customIgnoreSet.has(compact) ||
        (0, artifactPathContracts_1.isArtifactPathContractType)(compact) ||
        /^dict\[(str|string),(any|object)\]$/.test(compact) ||
        /^mapping\[(str|string),(any|object)\]$/.test(compact) ||
        /^record<(str|string),(any|unknown|object)>$/.test(compact) ||
        /^map<(str|string),(any|unknown|object)>$/.test(compact) ||
        /^list\[(any|object)\]$/.test(compact) ||
        /^array<(any|unknown|object)>$/.test(compact) ||
        /^sequence\[(any|object)\]$/.test(compact) ||
        new RegExp(`^optional\\[${GENERIC_ATOMIC_CONTRACT_PATTERN}\\]$`).test(compact) ||
        new RegExp(`^(list|sequence|vec)\\[${GENERIC_ATOMIC_CONTRACT_PATTERN}\\]$`).test(compact) ||
        new RegExp(`^array<${GENERIC_ATOMIC_CONTRACT_PATTERN}>$`).test(compact));
}
function readAbstractionEvidence(node) {
    return node?.fission?.evidence?.abstraction;
}
function readNonNegativeInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return Math.floor(parsed);
}
function readStringList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return dedupeSortedStrings(value.map((entry) => normalizeAnalyzerText(entry)).filter(Boolean));
}
function normalizeAnalyzerText(value) {
    return String(value ?? '').trim();
}
function normalizeAnalyzerSourcePath(value) {
    return normalizeAnalyzerText(value).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/{2,}/g, '/');
}
function dedupeSortedStrings(values) {
    return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))).sort();
}
function safeRatio(part, total) {
    if (!total) {
        return 0;
    }
    return Number((part / total).toFixed(6));
}
function clampRatio(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(1, Number(value)));
}
function ensureSet(map, key) {
    const existing = map.get(key);
    if (existing) {
        return existing;
    }
    const created = new Set();
    map.set(key, created);
    return created;
}
function toEdgeKey(from, to, contract) {
    return `${from}=>${to}::${contract}`;
}
function toCycleSignature(cycle) {
    return cycle.slice().sort().join(' -> ');
}
//# sourceMappingURL=analyzer.js.map