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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCategory = normalizeCategory;
exports.parseNodeRef = parseNodeRef;
exports.parseDemandEntry = parseDemandEntry;
exports.parseReturnType = parseReturnType;
exports.readTriadMap = readTriadMap;
exports.readJsonFile = readJsonFile;
exports.assertProtocolShape = assertProtocolShape;
const artifactReaders_1 = require("./artifactReaders");
const protocolRightBranch_1 = require("./protocolRightBranch");
const triadizationFocusSupport_1 = require("./triadizationFocusSupport");
__exportStar(require("./protocolRightBranch"), exports);
/**
 * @LeftBranch
 */
function normalizeCategory(category, fallback = 'core') {
    if (!category) {
        return fallback;
    }
    const normalized = category.trim().toLowerCase();
    return (0, protocolRightBranch_1.getPrefixCategoryMap)()[normalized] ?? normalized;
}
/**
 * @LeftBranch
 */
function parseNodeRef(nodeId, category) {
    const trimmed = nodeId.trim();
    const rawParts = trimmed.split('.').filter(Boolean);
    if (rawParts.length === 0) {
        throw new Error('节点 nodeId 不能为空');
    }
    let resolvedCategory = normalizeCategory(category);
    let parts = rawParts;
    const firstPart = rawParts[0].toLowerCase();
    const prefixCategoryMap = (0, protocolRightBranch_1.getPrefixCategoryMap)();
    if (firstPart in prefixCategoryMap) {
        resolvedCategory = prefixCategoryMap[firstPart];
        parts = rawParts.slice(1);
    }
    if (parts.length === 0) {
        throw new Error(`节点 ${nodeId} 缺少类名`);
    }
    const methodName = parts.length >= 2 ? parts[parts.length - 1] : 'execute';
    const className = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return {
        rawNodeId: nodeId,
        normalizedNodeId: `${className}.${methodName}`,
        category: resolvedCategory,
        className,
        methodName
    };
}
/**
 * @LeftBranch
 */
function parseDemandEntry(entry, index) {
    const text = entry.trim();
    if (!text || text.toLowerCase().startsWith('none')) {
        return null;
    }
    const match = text.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (match) {
        return {
            type: match[1].trim(),
            name: match[2].trim()
        };
    }
    return {
        type: text,
        name: `input${index + 1}`
    };
}
/**
 * @LeftBranch
 */
function parseReturnType(answer) {
    const text = answer.trim();
    if (!text) {
        return 'void';
    }
    const match = text.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    return match ? match[1].trim() : text;
}
/**
 * @LeftBranch
 */
function readTriadMap(mapPath) {
    const result = (0, artifactReaders_1.readJsonArrayArtifactResult)(mapPath);
    if (result.status !== 'ok' || !result.value) {
        return [];
    }
    try {
        return (0, protocolRightBranch_1.getTriadNodeDefinitionSchema)().array().parse(result.value);
    }
    catch {
        return [];
    }
}
/**
 * @LeftBranch
 */
function readJsonFile(filePath) {
    return (0, artifactReaders_1.readJsonFileStrict)(filePath);
}
/**
 * @LeftBranch
 */
function assertProtocolShape(protocol, context = {}) {
    const parsed = (0, protocolRightBranch_1.getUpgradeProtocolSchema)().parse(protocol);
    validateConfidenceRules(parsed, context);
    validateTriadizationFocusRules(parsed, context);
    validateTopologyRules(parsed, context.existingNodes ?? []);
    return parsed;
}
function validateConfidenceRules(protocol, context) {
    const minConfidence = context.minConfidence ?? 0;
    const requireConfidence = context.requireConfidence ?? false;
    protocol.actions.forEach((action, index) => {
        if (requireConfidence && typeof action.confidence !== 'number') {
            throw new Error(`actions[${index}] 缺少 confidence；当前配置要求所有协议动作必须提供置信度`);
        }
        if (typeof action.confidence === 'number' && action.confidence < minConfidence) {
            throw new Error(`actions[${index}] confidence=${action.confidence} 低于最小阈值 ${minConfidence}，请人工审核或重新推演`);
        }
    });
}
function validateTriadizationFocusRules(protocol, context) {
    const splitStages = [
        ['macroSplit', protocol.macroSplit],
        ['mesoSplit', protocol.mesoSplit],
        ['microSplit', protocol.microSplit]
    ];
    const presentStages = splitStages.filter((entry) => Boolean(entry[1]));
    if (presentStages.length === 0) {
        return;
    }
    if (presentStages.length !== splitStages.length) {
        throw new Error('协议必须同时包含 macroSplit、mesoSplit、microSplit，才能验证 triadization focus 是否稳定。');
    }
    const canonicalStageName = presentStages[0][0];
    const canonicalReference = presentStages[0][1];
    const normalizedCanonical = (0, triadizationFocusSupport_1.normalizeTriadizationFocusReference)(canonicalReference);
    presentStages.slice(1).forEach(([stageName, reference]) => {
        const normalizedReference = (0, triadizationFocusSupport_1.normalizeTriadizationFocusReference)(reference);
        if (normalizedReference.triadizationFocus !== normalizedCanonical.triadizationFocus ||
            normalizedReference.recommendedOperation !== normalizedCanonical.recommendedOperation) {
            throw new Error(`${stageName} 的 triadization focus 漂移：期望与 ${canonicalStageName} 保持一致（${canonicalReference.triadizationFocus} -> ${canonicalReference.recommendedOperation}），实际为 ${normalizedReference.triadizationFocus} -> ${normalizedReference.recommendedOperation}`);
        }
    });
    if (!context.expectedTriadizationFocus) {
        return;
    }
    const expected = (0, triadizationFocusSupport_1.normalizeTriadizationFocusReference)(context.expectedTriadizationFocus);
    if (normalizedCanonical.triadizationFocus !== expected.triadizationFocus ||
        normalizedCanonical.recommendedOperation !== expected.recommendedOperation) {
        throw new Error(`draft-protocol 的 triadization focus 与当前提案不一致：期望 ${context.expectedTriadizationFocus.triadizationFocus} -> ${context.expectedTriadizationFocus.recommendedOperation}，实际为 ${canonicalReference.triadizationFocus} -> ${canonicalReference.recommendedOperation}`);
    }
}
function validateTopologyRules(protocol, existingNodes) {
    const existingNodeMap = new Map(existingNodes.map((node) => [node.nodeId, node]));
    const actionTargetIds = new Set();
    protocol.actions.forEach((action, index) => {
        if (action.op === 'reuse') {
            ensureExistingNode(existingNodeMap, action.nodeId, `actions[${index}].nodeId`);
            ensureUniqueActionTarget(actionTargetIds, action.nodeId, index);
            return;
        }
        if (action.op === 'modify') {
            const existingNode = ensureExistingNode(existingNodeMap, action.nodeId, `actions[${index}].nodeId`);
            ensureUniqueActionTarget(actionTargetIds, action.nodeId, index);
            if (normalizeText(existingNode.fission.problem) !== normalizeText(action.fission.problem)) {
                throw new Error(`actions[${index}] 违反三元法：modify 只能升级输入/输出，不能改变核心职责 problem`);
            }
            return;
        }
        ensureExistingNode(existingNodeMap, action.parentNodeId, `actions[${index}].parentNodeId`);
        if (existingNodeMap.has(action.node.nodeId)) {
            throw new Error(`actions[${index}] 违反三元法：create_child 不能复用已存在的 nodeId ${action.node.nodeId}`);
        }
        ensureUniqueActionTarget(actionTargetIds, action.node.nodeId, index);
    });
}
function ensureExistingNode(existingNodeMap, nodeId, field) {
    const existingNode = existingNodeMap.get(nodeId);
    if (!existingNode) {
        throw new Error(`${field} 指向不存在的拓扑节点：${nodeId}`);
    }
    return existingNode;
}
function ensureUniqueActionTarget(actionTargetIds, nodeId, index) {
    if (actionTargetIds.has(nodeId)) {
        throw new Error(`actions[${index}] 重复操作同一节点：${nodeId}`);
    }
    actionTargetIds.add(nodeId);
}
function normalizeText(value) {
    return value.trim().replace(/\s+/g, ' ');
}
//# sourceMappingURL=protocol.js.map