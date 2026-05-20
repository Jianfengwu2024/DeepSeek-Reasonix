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
exports.getContractGuardLine = getContractGuardLine;
exports.getHealingOutputRuleLines = getHealingOutputRuleLines;
exports.parseTraceLine = parseTraceLine;
exports.scoreNodeMatch = scoreNodeMatch;
exports.classifyDiagnosis = classifyDiagnosis;
exports.chooseSuggestedAction = chooseSuggestedAction;
exports.estimateBlastRadius = estimateBlastRadius;
exports.buildEvidence = buildEvidence;
exports.buildSummary = buildSummary;
const path = __importStar(require("path"));
const analyzer_1 = require("./analyzer");
const protocol_1 = require("./protocol");
const workspace_1 = require("./workspace");
/**
 * @RightBranch
 */
function getContractGuardLine(requireHumanApprovalForContractChanges) {
    return requireHumanApprovalForContractChanges
        ? '如果判断为 Demand / Answer 契约变更，请只输出待审阅协议，不要假定可直接自动落盘。'
        : '契约变更允许自动生成待执行协议。';
}
/**
 * @RightBranch
 */
function getHealingOutputRuleLines() {
    return [
        '1. 先明确错误属于 left_branch / right_branch / contract / topology 哪一类。',
        '2. 如果当前节点可修复，输出以 `modify` 为主的严格 JSON 协议。',
        '3. 如果 retryCount 已达到上限，且节点职责过载，可提出 `create_child`。',
        '4. 输出必须兼容 `.triadmind/draft-protocol.json`。',
        '5. 只返回严格 JSON，不要返回 Markdown 解释。'
    ];
}
/**
 * @RightBranch
 */
function parseTraceLine(line, projectRootNormalized, projectRoot) {
    const pathMatch = line.match(/((?:[A-Za-z]:)?[^():\n\r]+?\.[A-Za-z0-9]+):(\d+):(\d+)/);
    if (!pathMatch) {
        return null;
    }
    const absoluteCandidate = path.isAbsolute(pathMatch[1]) ? pathMatch[1] : path.resolve(projectRoot, pathMatch[1]);
    const normalizedPath = (0, workspace_1.normalizePath)(absoluteCandidate).toLowerCase();
    if (!normalizedPath.includes(projectRootNormalized)) {
        return null;
    }
    const symbolMatch = line.match(/at\s+(.+?)\s+\(/);
    return {
        raw: line,
        sourcePath: (0, workspace_1.normalizePath)(path.relative(projectRoot, absoluteCandidate)),
        line: Number(pathMatch[2]),
        column: Number(pathMatch[3]),
        symbol: symbolMatch?.[1]?.trim()
    };
}
/**
 * @RightBranch
 */
function scoreNodeMatch(frame, node) {
    const nodeSourcePath = (0, workspace_1.normalizePath)(node.sourcePath ?? '').toLowerCase();
    const frameSourcePath = (0, workspace_1.normalizePath)(frame.sourcePath).toLowerCase();
    if (!nodeSourcePath || nodeSourcePath !== frameSourcePath) {
        return 0;
    }
    const ref = (0, protocol_1.parseNodeRef)(node.nodeId, node.category);
    let score = 10;
    if (frame.symbol) {
        const symbol = frame.symbol.toLowerCase();
        if (symbol.includes(ref.methodName.toLowerCase())) {
            score += 8;
        }
        if (symbol.includes(ref.className.toLowerCase())) {
            score += 5;
        }
    }
    return score;
}
/**
 * @RightBranch
 */
function classifyDiagnosis(errorText) {
    const text = errorText.toLowerCase();
    if (/(validation|schema|contract|argument mismatch|expected .* received|assignable|zod)/.test(text)) {
        return 'contract';
    }
    if (/(config|state|env|undefined.*config|missing.*config|option|settings)/.test(text)) {
        return 'right_branch';
    }
    if (/(import|dependency|module not found|circular|topology|parentnode|childnode|reuse)/.test(text)) {
        return 'topology';
    }
    if (/(exception|error|failed|cannot read|undefined|null reference|stack overflow)/.test(text)) {
        return 'left_branch';
    }
    return 'unknown';
}
/**
 * @RightBranch
 */
function chooseSuggestedAction(diagnosis, retryCount, maxAutoRetries) {
    if (diagnosis === 'topology') {
        return 'manual_review';
    }
    if (retryCount >= maxAutoRetries) {
        return 'create_child';
    }
    return 'modify';
}
/**
 * @RightBranch
 */
function estimateBlastRadius(rootNode, nodes, isContractChange) {
    if (!rootNode) {
        return {
            impactedNodeIds: [],
            risk: 'low'
        };
    }
    const impactedNodeIds = (0, analyzer_1.calculateBlastRadius)(nodes, rootNode.nodeId, isContractChange);
    const risk = impactedNodeIds.length >= 5 ? 'high' : impactedNodeIds.length >= 2 ? 'medium' : 'low';
    return {
        impactedNodeIds,
        risk
    };
}
/**
 * @RightBranch
 */
function buildEvidence(errorText, traceFrames, matchedNode, diagnosis, blastRadius) {
    const evidence = [`diagnosis=${diagnosis}`, `traceFrames=${traceFrames.length}`, `blastRadius=${blastRadius.risk}`];
    if (matchedNode) {
        evidence.push(`matchedNode=${matchedNode.nodeId}`);
    }
    if (blastRadius.impactedNodeIds.length > 0) {
        evidence.push(`impacted=${blastRadius.impactedNodeIds.join(', ')}`);
    }
    const firstLine = errorText.split(/\r?\n/).find((textLine) => textLine.trim());
    if (firstLine) {
        evidence.push(`error=${firstLine.trim()}`);
    }
    return evidence;
}
/**
 * @RightBranch
 */
function buildSummary(matchedNode, diagnosis, suggestedAction, blastRadius) {
    const target = matchedNode?.nodeId ?? 'unknown node';
    return `${target} is classified as ${diagnosis}; suggested action is ${suggestedAction}; blast radius is ${blastRadius.risk}.`;
}
//# sourceMappingURL=healingRightBranch.js.map