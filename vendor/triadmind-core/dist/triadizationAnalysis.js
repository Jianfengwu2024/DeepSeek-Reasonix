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
exports.analyzeTriadizationOpportunities = analyzeTriadizationOpportunities;
const path = __importStar(require("path"));
const analyzer_1 = require("./analyzer");
const topologyRiskSupport_1 = require("./topologyRiskSupport");
const DEFAULT_SPLIT_FANOUT_THRESHOLD = 6;
const DEFAULT_AGGREGATE_GROUP_SIZE = 3;
const ORCHESTRATION_NODE_PATTERN = /(workflow|orchestrate|dispatch|pipeline|plan|apply|bootstrap|sync)/i;
const FRAGMENT_METHOD_PATTERN = /^(build|parse|format|normalize|sanitize|validate|resolve|collect|load|save|get|set)/i;
function analyzeTriadizationOpportunities(projectRoot, map, options) {
    const normalizedMap = Array.isArray(map) ? map : [];
    const nodes = normalizedMap.filter((node) => getNodeId(node).length > 0);
    const downstreamEntries = detectHighFanoutNodes(nodes, options);
    const downstreamByNode = new Map(downstreamEntries.map((entry) => [entry.nodeId, entry]));
    const candidates = [
        ...buildRenormalizeCandidates(nodes, options),
        ...buildSplitCandidates(nodes, downstreamEntries, options),
        ...buildAggregateCandidates(nodes, downstreamByNode)
    ].sort((left, right) => right.score - left.score || left.targetNodeId.localeCompare(right.targetNodeId));
    if (candidates.length === 0 && nodes.length > 0) {
        candidates.push(buildFallbackCandidate(nodes, downstreamEntries, options));
    }
    const primaryProposal = candidates[0];
    const summary = primaryProposal === undefined
        ? ['No triadization proposal generated because the current map has no analyzable nodes.']
        : [
            `Primary proposal: ${primaryProposal.recommendedOperation} ${primaryProposal.targetNodeId} (${primaryProposal.diagnosis.join(', ')}).`,
            `Confirmation required before evolution: ${primaryProposal.confirmationPrompt}`
        ];
    return {
        schemaVersion: '1.0',
        project: path.basename(projectRoot),
        generatedAt: new Date().toISOString(),
        summary,
        primaryProposal,
        candidates
    };
}
function buildRenormalizeCandidates(nodes, options) {
    return (0, analyzer_1.detectCycles)(nodes, options)
        .filter((cycle) => cycle.length >= 2)
        .map((cycle) => {
        const targetNodeIds = cycle.slice().sort();
        const targetNodeId = cycle[0];
        const impactedNodeIds = Array.from(new Set(cycle.flatMap((nodeId) => (0, analyzer_1.calculateBlastRadius)(nodes, nodeId, true, options).filter((candidate) => !cycle.includes(candidate))))).sort();
        return {
            proposalId: `renormalize:${targetNodeIds.join('|')}`,
            targetNodeId,
            targetNodeIds,
            triadScale: 'cluster',
            diagnosis: ['cyclic_cluster'],
            recommendedOperation: 'renormalize',
            rationale: `节点簇 ${targetNodeIds.join(', ')} 形成强连通环。此时继续对单点做 split 或 aggregate 都不能先消除回环，应该先对整个环做 renormalize。`,
            rejectedAlternatives: [
                {
                    operation: 'split',
                    reason: '环内单点切分不会先消除强连通依赖，问题仍会回流。'
                },
                {
                    operation: 'aggregate',
                    reason: '只做聚合不会重建环外边界，也不能解释整个环的整体职责。'
                }
            ],
            evidence: [
                `Cycle nodes: ${targetNodeIds.join(' -> ')}`,
                `External blast radius after renormalization candidate: ${impactedNodeIds.length}`
            ],
            blastRadius: {
                impactedNodeCount: impactedNodeIds.length,
                impactedNodeIds
            },
            taskBundle: [
                createTriadizationTask('renormalize', '重整化当前环拓扑', `先把 ${targetNodeIds.join(', ')} 提升为同一宏观顶点，再重建其外部 demand / answer 边界。`),
                createTriadizationTask('macro', '确认新挂载点与左右分支', '在环被提升后，重新确认这个宏观顶点的挂载点、左分支能力和右分支约束。'),
                createTriadizationTask('protocol', '生成环重整化协议', '把新宏观顶点、被吸收节点和新的边界写入 draft-protocol.json。'),
                createTriadizationTask('verify', '验证环是否被解开', '刷新 triad-map 并确认没有新的 broken contract 或残留回环。')
            ],
            confirmationPrompt: `确认先对环簇 ${targetNodeIds.join(', ')} 执行 renormalize，再继续后续协议演进吗？`,
            confirmationNeeded: true,
            score: 1000 + targetNodeIds.length * 20 + impactedNodeIds.length
        };
    });
}
function buildSplitCandidates(nodes, downstreamEntries, options) {
    const nodeMap = new Map(nodes.map((node) => [getNodeId(node), node]));
    return downstreamEntries
        .filter((entry) => entry.downstreamCount >= DEFAULT_SPLIT_FANOUT_THRESHOLD)
        .map((entry) => {
        const node = nodeMap.get(entry.nodeId);
        const diagnosis = ['overloaded_vertex'];
        if (looksLikeOrchestrationNode(node)) {
            diagnosis.push('left_right_mixing');
        }
        const impactedNodeIds = (0, analyzer_1.calculateBlastRadius)(nodes, entry.nodeId, true, options).sort();
        const rationale = diagnosis.includes('left_right_mixing')
            ? `节点 ${entry.nodeId} 同时呈现编排语义和高扇出下游（${entry.downstreamCount} 个），很可能把顶点、左分支执行和右分支约束混在了一起，应该先做 split。`
            : `节点 ${entry.nodeId} 影响 ${entry.downstreamCount} 个下游能力，已经接近胖顶点，应先显式拆成左右分支以降低 blast radius。`;
        return {
            proposalId: `split:${entry.nodeId}`,
            targetNodeId: entry.nodeId,
            targetNodeIds: [entry.nodeId],
            triadScale: 'capability',
            diagnosis,
            recommendedOperation: 'split',
            rationale,
            rejectedAlternatives: [
                {
                    operation: 'aggregate',
                    reason: '当前问题不是能力过碎，而是单点职责过载。'
                },
                {
                    operation: 'renormalize',
                    reason: '当前没有必须优先收缩的强连通环，直接 split 更贴近问题中心。'
                }
            ],
            evidence: [
                `Downstream fanout: ${entry.downstreamCount}`,
                `Top downstreams: ${entry.downstreamNodeIds.slice(0, 6).join(', ') || 'none'}`
            ],
            blastRadius: {
                impactedNodeCount: impactedNodeIds.length,
                impactedNodeIds
            },
            taskBundle: [
                createTriadizationTask('macro', '确认当前挂载点', `确认 ${entry.nodeId} 是否仍是本轮挂载点，并切出左分支子功能与右分支约束。`),
                createTriadizationTask('meso', '拆出子能力与编排件', '把执行动作、策略编排和配置状态拆成更清晰的能力节点与数据管道。'),
                createTriadizationTask('micro', '标注静态右支与动态左支', '为核心类补齐属性 / 状态与方法 / 动作的显式分支边界。'),
                createTriadizationTask('protocol', '写入最小演进协议', '优先生成可审阅的最小 split 协议，而不是一次性扩题。'),
                createTriadizationTask('verify', '检查扇出是否下降', '刷新 triad-map 并确认切分后没有新增 drift。')
            ],
            confirmationPrompt: `确认先对节点 ${entry.nodeId} 执行 split，并据此继续 Macro / Meso / Micro 吗？`,
            confirmationNeeded: true,
            score: 500 + entry.downstreamCount * 10 + (diagnosis.includes('left_right_mixing') ? 25 : 0)
        };
    });
}
function buildAggregateCandidates(nodes, downstreamByNode) {
    const groups = new Map();
    for (const node of nodes) {
        const groupKey = getFragmentGroupKey(node);
        if (!groupKey) {
            continue;
        }
        const current = groups.get(groupKey) ?? [];
        current.push(node);
        groups.set(groupKey, current);
    }
    return Array.from(groups.entries())
        .map(([groupKey, groupNodes]) => toAggregateGroup(groupKey, groupNodes, downstreamByNode))
        .filter((group) => group.targetNodeIds.length >= DEFAULT_AGGREGATE_GROUP_SIZE &&
        (group.helperLikeCount > 0 || (group.uniqueSourcePaths.size <= 1 && group.averageDownstream <= 1.5)))
        .map((group) => {
        const sourcePath = getCommonSourcePath(nodes, group.targetNodeIds);
        return {
            proposalId: `aggregate:${group.targetNodeIds.join('|')}`,
            targetNodeId: group.groupKey,
            targetNodeIds: group.targetNodeIds,
            triadScale: 'module',
            diagnosis: ['capability_fragmented'],
            recommendedOperation: 'aggregate',
            rationale: sourcePath
                ? `节点组 ${group.targetNodeIds.join(', ')} 长期散落在同一源码文件 ${sourcePath}，但架构价值被碎片化能力切散，适合先做 aggregate。`
                : `节点组 ${group.targetNodeIds.join(', ')} 语义相近且平均下游仅 ${group.averageDownstream.toFixed(1)}，适合先收束成一个稳定顶点。`,
            rejectedAlternatives: [
                {
                    operation: 'split',
                    reason: '当前问题不是单点过载，而是碎叶没有被收束成可理解顶点。'
                },
                {
                    operation: 'renormalize',
                    reason: '当前没有需要优先收缩的环结构，直接 aggregate 更贴近现状。'
                }
            ],
            evidence: [
                `Grouped nodes: ${group.targetNodeIds.join(', ')}`,
                `Average downstream fanout: ${group.averageDownstream.toFixed(1)}`
            ],
            blastRadius: {
                impactedNodeCount: 0,
                impactedNodeIds: []
            },
            taskBundle: [
                createTriadizationTask('macro', '确认聚合挂载点', `为 ${group.groupKey} 指定统一挂载点，并重新定义聚合后顶点的外部职责。`),
                createTriadizationTask('meso', '收束离散子节点', '把同源碎叶收束为一个主顶点，再决定哪些子叶保留为左分支。'),
                createTriadizationTask('protocol', '生成聚合协议', '优先使用 reuse / modify，必要时再 create_child，避免横向扩散。'),
                createTriadizationTask('verify', '验证主图可读性', '确认聚合后主图顶点更少、语义更清晰，且没有丢失关键输入输出。')
            ],
            confirmationPrompt: `确认先对节点组 ${group.targetNodeIds.join(', ')} 执行 aggregate，再继续后续演进吗？`,
            confirmationNeeded: true,
            score: 200 +
                group.targetNodeIds.length * 10 +
                group.helperLikeCount * 6 +
                Math.max(0, 5 - Math.round(group.averageDownstream))
        };
    });
}
function buildFallbackCandidate(nodes, downstreamEntries, options) {
    const bestNodeId = downstreamEntries[0]?.nodeId ??
        nodes
            .map((node) => getNodeId(node))
            .filter(Boolean)
            .sort()[0] ??
        '';
    const impactedNodeIds = bestNodeId ? (0, analyzer_1.calculateBlastRadius)(nodes, bestNodeId, true, options).sort() : [];
    return {
        proposalId: `split:${bestNodeId}`,
        targetNodeId: bestNodeId,
        targetNodeIds: [bestNodeId],
        triadScale: 'capability',
        diagnosis: ['triadization_candidate'],
        recommendedOperation: 'split',
        rationale: `当前没有明显的环簇或碎片簇，先从节点 ${bestNodeId} 开始做顶点三元化，可以为后续 Macro / Meso / Micro 建立明确起点。`,
        rejectedAlternatives: [
            {
                operation: 'aggregate',
                reason: '没有检测到足够密集的离散碎片簇。'
            },
            {
                operation: 'renormalize',
                reason: '当前没有检测到强连通环。'
            }
        ],
        evidence: ['Fallback candidate selected from current topology frontier.'],
        blastRadius: {
            impactedNodeCount: impactedNodeIds.length,
            impactedNodeIds
        },
        taskBundle: [
            createTriadizationTask('macro', '先确认起点节点', `确认 ${bestNodeId} 作为当前对话的三元化起点。`),
            createTriadizationTask('micro', '补齐左右分支', '先把该节点的静态右支与动态左支明确出来，再决定是否继续裂变。'),
            createTriadizationTask('protocol', '形成第一版协议', '把这次确认后的最小演进动作写入 draft-protocol.json。')
        ],
        confirmationPrompt: `确认先从节点 ${bestNodeId} 开始执行 split 型三元化，再继续协议演进吗？`,
        confirmationNeeded: true,
        score: 100
    };
}
function toAggregateGroup(groupKey, groupNodes, downstreamByNode) {
    const targetNodeIds = groupNodes.map((node) => getNodeId(node)).sort();
    const helperLikeCount = targetNodeIds.filter((nodeId) => FRAGMENT_METHOD_PATTERN.test(getMethodName(nodeId))).length;
    const uniqueSourcePaths = new Set(groupNodes.map((node) => getSourcePath(node)).filter(Boolean));
    const downstreamCounts = targetNodeIds.map((nodeId) => downstreamByNode.get(nodeId)?.downstreamCount ?? 0);
    const averageDownstream = downstreamCounts.length === 0
        ? 0
        : downstreamCounts.reduce((sum, value) => sum + value, 0) / downstreamCounts.length;
    return {
        groupKey,
        targetNodeIds,
        helperLikeCount,
        uniqueSourcePaths,
        averageDownstream
    };
}
function detectHighFanoutNodes(map, options) {
    const nodeById = new Map(map.map((node) => [getNodeId(node), node]));
    return (0, analyzer_1.calculateDownstreamFanoutNodes)(map, 1, options).filter((entry) => {
        const node = nodeById.get(entry.nodeId);
        return node ? !(0, topologyRiskSupport_1.isMatureStableArchitectureNode)(node, options) : true;
    });
}
function looksLikeOrchestrationNode(node) {
    const nodeId = getNodeId(node);
    const problem = getProblem(node);
    return ORCHESTRATION_NODE_PATTERN.test(nodeId) || ORCHESTRATION_NODE_PATTERN.test(problem);
}
function getFragmentGroupKey(node) {
    const nodeId = getNodeId(node);
    const sourcePath = getSourcePath(node);
    if (!nodeId) {
        return sourcePath;
    }
    const parts = nodeId.split('.').filter(Boolean);
    const owner = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return sourcePath ? `${owner}@${sourcePath}` : owner;
}
function getCommonSourcePath(nodes, targetNodeIds) {
    const targetSet = new Set(targetNodeIds);
    const matching = nodes
        .filter((node) => targetSet.has(getNodeId(node)))
        .map((node) => getSourcePath(node))
        .filter(Boolean);
    const unique = Array.from(new Set(matching));
    return unique.length === 1 ? unique[0] : '';
}
function getNodeId(node) {
    return typeof node?.nodeId === 'string' ? node.nodeId.trim() : '';
}
function getSourcePath(node) {
    return typeof node?.sourcePath === 'string' ? node.sourcePath.trim() : '';
}
function getProblem(node) {
    return typeof node?.fission?.problem === 'string' ? node.fission.problem.trim() : '';
}
function getMethodName(nodeId) {
    const parts = nodeId.split('.').filter(Boolean);
    return parts.length === 0 ? nodeId : parts[parts.length - 1];
}
function createTriadizationTask(phase, title, objective) {
    return {
        phase,
        title,
        objective
    };
}
//# sourceMappingURL=triadizationAnalysis.js.map