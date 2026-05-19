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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareHealingArtifacts = prepareHealingArtifacts;
exports.diagnoseRuntimeFailure = diagnoseRuntimeFailure;
exports.buildHealingPrompt = buildHealingPrompt;
const fs = __importStar(require("fs"));
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const healingRightBranch_1 = require("./healingRightBranch");
const protocol_1 = require("./protocol");
const workspace_1 = require("./workspace");
__exportStar(require("./healingRightBranch"), exports);
/**
 * @LeftBranch
 */
function prepareHealingArtifacts(paths, errorText, retryCount = 0) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const nodes = (0, protocol_1.readTriadMap)(paths.mapFile);
    const diagnosis = diagnoseRuntimeFailure(paths, errorText, retryCount, nodes);
    const requiresHumanApproval = diagnosis.blastRadius.risk === 'high' ||
        (diagnosis.diagnosis === 'contract' && config.runtimeHealing.requireHumanApprovalForContractChanges);
    const finalDiagnosis = {
        ...diagnosis,
        requiresHumanApproval
    };
    const prompt = buildHealingPrompt(paths, errorText, finalDiagnosis);
    fs.writeFileSync(paths.runtimeErrorFile, errorText.trim(), 'utf-8');
    fs.writeFileSync(paths.healingReportFile, JSON.stringify(finalDiagnosis, null, 2), 'utf-8');
    fs.writeFileSync(paths.healingPromptFile, prompt, 'utf-8');
    return {
        diagnosis: finalDiagnosis,
        prompt
    };
}
/**
 * @LeftBranch
 */
function diagnoseRuntimeFailure(paths, errorText, retryCount, nodes) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const traceFrames = extractTraceFrames(errorText, paths.projectRoot);
    const match = locateBestNodeMatch(traceFrames, nodes);
    const diagnosis = (0, healingRightBranch_1.classifyDiagnosis)(errorText);
    const blastRadius = (0, healingRightBranch_1.estimateBlastRadius)(match?.node ?? null, nodes, diagnosis === 'contract');
    const suggestedAction = (0, healingRightBranch_1.chooseSuggestedAction)(diagnosis, retryCount, config.runtimeHealing.maxAutoRetries);
    const evidence = (0, healingRightBranch_1.buildEvidence)(errorText, traceFrames, match?.node ?? null, diagnosis, blastRadius);
    return {
        projectRoot: (0, workspace_1.normalizePath)(paths.projectRoot),
        adapterLanguage: config.architecture.language,
        retryCount,
        matchedNodeId: match?.node.nodeId ?? null,
        matchedSourcePath: match?.node.sourcePath ?? null,
        diagnosis,
        suggestedAction,
        summary: (0, healingRightBranch_1.buildSummary)(match?.node ?? null, diagnosis, suggestedAction, blastRadius),
        blastRadius,
        traceFrames,
        evidence,
        requiresHumanApproval: false
    };
}
/**
 * @LeftBranch
 */
function buildHealingPrompt(paths, errorText, diagnosis) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const triadMapJson = (0, artifactReaders_1.readTextIfExists)(paths.mapFile, { trim: true }) || '[]';
    const triadSpec = (0, artifactReaders_1.readTextIfExists)(paths.triadSpecFile, { trim: true });
    const latestDemand = (0, artifactReaders_1.readTextIfExists)(paths.demandFile, { trim: true });
    const contractGuard = (0, healingRightBranch_1.getContractGuardLine)(config.runtimeHealing.requireHumanApprovalForContractChanges);
    return [
        '[System]',
        '你是 TriadMind 的 Runtime Self-Healing 架构师。',
        '你的任务不是直接输出补丁代码，而是先根据运行时错误回溯到拓扑节点，再输出严格 JSON 升级协议。',
        '优先使用 `modify` 修复当前节点；只有当重试预算耗尽或职责明显过载时，才允许 `create_child`。',
        contractGuard,
        '',
        '[Triad Spec]',
        triadSpec,
        '',
        '[Project Root]',
        (0, workspace_1.normalizePath)(paths.projectRoot),
        '',
        '[Runtime Healing Config]',
        '```json',
        JSON.stringify(config.runtimeHealing, null, 2),
        '```',
        '',
        '[Latest User Demand]',
        latestDemand ? JSON.stringify(latestDemand) : '""',
        '',
        '[Triad Map JSON]',
        '```json',
        triadMapJson,
        '```',
        '',
        '[Runtime Error]',
        '```text',
        errorText.trim(),
        '```',
        '',
        '[Healing Diagnosis]',
        '```json',
        JSON.stringify(diagnosis, null, 2),
        '```',
        '',
        '[Output Rules]',
        ...(0, healingRightBranch_1.getHealingOutputRuleLines)(),
        '',
        '[Output Target]',
        (0, workspace_1.normalizePath)(paths.draftFile)
    ].join('\n');
}
function extractTraceFrames(errorText, projectRoot) {
    const frames = [];
    const projectRootNormalized = (0, workspace_1.normalizePath)(projectRoot).toLowerCase();
    for (const rawLine of errorText.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        const frame = (0, healingRightBranch_1.parseTraceLine)(line, projectRootNormalized, projectRoot);
        if (frame) {
            frames.push(frame);
        }
    }
    return frames;
}
function locateBestNodeMatch(frames, nodes) {
    let bestMatch;
    for (const frame of frames) {
        for (const node of nodes) {
            const score = (0, healingRightBranch_1.scoreNodeMatch)(frame, node);
            if (score <= 0) {
                continue;
            }
            if (!bestMatch || score > bestMatch.score) {
                bestMatch = {
                    node,
                    score
                };
            }
        }
    }
    return bestMatch;
}
//# sourceMappingURL=healing.js.map