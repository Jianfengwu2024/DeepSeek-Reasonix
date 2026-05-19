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
exports.normalizeDreamFeedbackReviewerRole = normalizeDreamFeedbackReviewerRole;
exports.deriveDreamProposalFamily = deriveDreamProposalFamily;
exports.buildDreamProposalFeedbackSignature = buildDreamProposalFeedbackSignature;
exports.loadDreamFeedbackLedger = loadDreamFeedbackLedger;
exports.isStableAnchorRejectionRecord = isStableAnchorRejectionRecord;
exports.recordDreamProposalRejection = recordDreamProposalRejection;
exports.indexLatestDreamRejectionsBySignature = indexLatestDreamRejectionsBySignature;
exports.formatDreamFeedbackRules = formatDreamFeedbackRules;
exports.formatDreamFeedbackLedger = formatDreamFeedbackLedger;
exports.deriveStableArchitectureAnchorFromProposal = deriveStableArchitectureAnchorFromProposal;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const DREAM_FEEDBACK_REVIEWER_ROLES = new Set(['maintainer', 'ai', 'operator']);
function normalizeDreamFeedbackReviewerRole(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'maintainer' || normalized === 'ai' || normalized === 'operator') {
        return normalized;
    }
    return undefined;
}
function deriveDreamProposalFamily(proposalId) {
    const normalizedProposalId = normalizeText(proposalId);
    if (normalizedProposalId.startsWith('DREAM_SPLIT_HIGH_FANOUT_')) {
        return 'DREAM_SPLIT_HIGH_FANOUT';
    }
    return normalizedProposalId || 'DREAM_UNKNOWN';
}
function buildDreamProposalFeedbackSignature(proposal) {
    return JSON.stringify({
        family: deriveDreamProposalFamily(proposal.id),
        sourcePath: normalizeSourcePath(proposal.sourcePath) ||
            extractSourcePathFromProtocolDraft(proposal.protocolDraft) ||
            extractSourcePathFromEvidence(proposal),
        targetNodeIds: collectTargetNodeIds(proposal.protocolDraft),
        linkedFindings: normalizeStringArray(proposal.linkedFindings)
    });
}
function loadDreamFeedbackLedger(paths) {
    const project = path.basename(paths.projectRoot);
    const readResult = (0, artifactReaders_1.readJsonObjectArtifactResult)(paths.dreamFeedbackFile);
    if (readResult.status !== 'ok' || !readResult.value) {
        return {
            status: readResult.status,
            ledger: createEmptyDreamFeedbackLedger(project)
        };
    }
    const value = readResult.value;
    const rejectionsRaw = value.rejections;
    if (value.schemaVersion && value.schemaVersion !== '1.0') {
        return {
            status: 'shape_invalid',
            ledger: createEmptyDreamFeedbackLedger(project)
        };
    }
    if (rejectionsRaw !== undefined && !Array.isArray(rejectionsRaw)) {
        return {
            status: 'shape_invalid',
            ledger: createEmptyDreamFeedbackLedger(project)
        };
    }
    const rejections = Array.isArray(rejectionsRaw)
        ? rejectionsRaw
            .map((entry) => normalizeDreamProposalRejectionRecord(entry))
            .filter(isDefined)
            .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
        : [];
    return {
        status: 'ok',
        ledger: {
            schemaVersion: '1.0',
            project: normalizeText(value.project) || project,
            updatedAt: normalizeText(value.updatedAt) || rejections[rejections.length - 1]?.recordedAt,
            rejections
        }
    };
}
function isStableAnchorRejectionRecord(record) {
    if (record.isStableAnchor === true || record.stableAnchorRecorded === true) {
        return true;
    }
    return normalizeText(record.reasonCode).toLowerCase() === 'stable_core_module';
}
function recordDreamProposalRejection(paths, input) {
    const loadResult = loadDreamFeedbackLedger(paths);
    const recordedAt = normalizeText(input.recordedAt) || new Date().toISOString();
    const reviewerRole = input.reviewerRole ?? 'maintainer';
    const isStableAnchor = input.isStableAnchor === true ||
        input.stableAnchorRecorded === true ||
        normalizeText(input.reasonCode).toLowerCase() === 'stable_core_module';
    const record = {
        decisionId: buildDreamFeedbackDecisionId(input.proposal.id, recordedAt),
        decision: 'reject',
        proposalId: normalizeText(input.proposal.id) || 'DREAM_UNKNOWN',
        proposalFamily: deriveDreamProposalFamily(input.proposal.id),
        proposalSignature: buildDreamProposalFeedbackSignature(input.proposal),
        proposalTitle: normalizeText(input.proposal.title) || normalizeText(input.proposal.id) || 'Untitled dream proposal',
        category: normalizeDreamProposalCategory(input.proposal.category),
        sourcePath: normalizeSourcePath(input.proposal.sourcePath) ||
            extractSourcePathFromProtocolDraft(input.proposal.protocolDraft) ||
            extractSourcePathFromEvidence(input.proposal) ||
            undefined,
        targetNodeIds: collectTargetNodeIds(input.proposal.protocolDraft),
        linkedFindings: normalizeStringArray(input.proposal.linkedFindings),
        reason: normalizeText(input.reason) || 'Rejected by project reviewer',
        reasonCode: normalizeText(input.reasonCode) || undefined,
        extractedRule: normalizeText(input.extractedRule) || undefined,
        reviewer: normalizeText(input.reviewer) || defaultReviewerName(reviewerRole),
        reviewerRole,
        recordedAt,
        isStableAnchor: isStableAnchor ? true : undefined,
        stableAnchorNodeId: normalizeText(input.stableAnchorNodeId) || undefined,
        stableAnchorSourcePath: normalizeSourcePath(input.stableAnchorSourcePath) || undefined
    };
    const ledger = {
        schemaVersion: '1.0',
        project: loadResult.ledger.project || path.basename(paths.projectRoot),
        updatedAt: recordedAt,
        rejections: [...loadResult.ledger.rejections, record].sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
    };
    fs.mkdirSync(path.dirname(paths.dreamFeedbackFile), { recursive: true });
    fs.writeFileSync(paths.dreamFeedbackFile, JSON.stringify(ledger, null, 2), 'utf-8');
    return {
        record,
        ledger,
        loadStatus: loadResult.status
    };
}
function indexLatestDreamRejectionsBySignature(ledger) {
    const latestBySignature = new Map();
    for (const record of ledger.rejections) {
        const previous = latestBySignature.get(record.proposalSignature);
        if (!previous || previous.recordedAt.localeCompare(record.recordedAt) <= 0) {
            latestBySignature.set(record.proposalSignature, record);
        }
    }
    return latestBySignature;
}
function formatDreamFeedbackRules(ledger, additionalFormattedRules) {
    const rejectionRules = ledger.rejections
        .filter((record) => record.extractedRule && record.extractedRule.trim().length > 0)
        .map((record) => `- ${record.extractedRule} (from rejected proposal: ${record.proposalTitle})`);
    const allLines = [];
    if (rejectionRules.length > 0) {
        allLines.push('CRITICAL_CONSTRAINTS_FROM_PAST_MISTAKES:');
        allLines.push(...rejectionRules);
    }
    if (additionalFormattedRules && additionalFormattedRules.trim().length > 0) {
        if (allLines.length === 0) {
            allLines.push('CRITICAL_CONSTRAINTS_FROM_PAST_MISTAKES:');
        }
        // Strip the header if the additional rules already have one
        const body = additionalFormattedRules.trim().startsWith('CRITICAL_CONSTRAINTS_FROM_PAST_MISTAKES:')
            ? additionalFormattedRules.trim().split('\n').slice(1).join('\n').trim()
            : additionalFormattedRules.trim();
        if (body) {
            allLines.push(...body.split('\n').map((l) => l.trim()).filter(Boolean));
        }
    }
    if (allLines.length <= 1) {
        return '';
    }
    return allLines.join('\n');
}
function formatDreamFeedbackLedger(ledger) {
    const lines = ['TriadMind Dream Feedback'];
    lines.push(`project=${ledger.project}`);
    lines.push(`rejections=${ledger.rejections.length}`);
    if (ledger.updatedAt) {
        lines.push(`updatedAt=${ledger.updatedAt}`);
    }
    if (ledger.rejections.length === 0) {
        lines.push('- No recorded dream proposal rejections.');
        return lines.join('\n');
    }
    ledger.rejections
        .slice()
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
        .slice(0, 10)
        .forEach((record) => {
        lines.push(`* ${record.proposalId} [${record.reviewerRole}] ${record.recordedAt} :: ${record.reason}${isStableAnchorRejectionRecord(record) ? ' [stable-anchor]' : ''}`);
    });
    return lines.join('\n');
}
function deriveStableArchitectureAnchorFromProposal(proposal) {
    const targetNodeIds = collectTargetNodeIds(proposal.protocolDraft).filter(Boolean);
    const sourcePath = normalizeSourcePath(proposal.sourcePath) ||
        extractSourcePathFromProtocolDraft(proposal.protocolDraft) ||
        extractSourcePathFromEvidence(proposal);
    const targetNodeId = targetNodeIds[0] ?? '';
    if (!targetNodeId && !sourcePath) {
        return undefined;
    }
    return {
        nodeId: targetNodeId || undefined,
        sourcePath: sourcePath || undefined
    };
}
function createEmptyDreamFeedbackLedger(project) {
    return {
        schemaVersion: '1.0',
        project,
        rejections: []
    };
}
function normalizeDreamProposalRejectionRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const record = value;
    const proposalId = normalizeText(record.proposalId);
    const proposalSignature = normalizeText(record.proposalSignature);
    const proposalTitle = normalizeText(record.proposalTitle);
    const reason = normalizeText(record.reason);
    const recordedAt = normalizeText(record.recordedAt);
    if (!proposalId || !proposalSignature || !proposalTitle || !reason || !recordedAt) {
        return undefined;
    }
    const reviewerRole = normalizeDreamFeedbackReviewerRole(normalizeText(record.reviewerRole)) ?? 'maintainer';
    return {
        decisionId: normalizeText(record.decisionId) || buildDreamFeedbackDecisionId(proposalId, recordedAt),
        decision: 'reject',
        proposalId,
        proposalFamily: normalizeText(record.proposalFamily) || deriveDreamProposalFamily(proposalId),
        proposalSignature,
        proposalTitle,
        category: normalizeDreamProposalCategory(record.category),
        sourcePath: normalizeSourcePath(record.sourcePath) || undefined,
        targetNodeIds: normalizeStringArray(record.targetNodeIds),
        linkedFindings: normalizeStringArray(record.linkedFindings),
        reason,
        reasonCode: normalizeText(record.reasonCode) || undefined,
        extractedRule: normalizeText(record.extractedRule) || undefined,
        reviewer: normalizeText(record.reviewer) || defaultReviewerName(reviewerRole),
        reviewerRole,
        recordedAt,
        isStableAnchor: record.isStableAnchor === true ||
            record.stableAnchorRecorded === true ||
            normalizeText(record.reasonCode).toLowerCase() === 'stable_core_module'
            ? true
            : undefined,
        stableAnchorRecorded: record.stableAnchorRecorded === true ? true : undefined,
        stableAnchorNodeId: normalizeText(record.stableAnchorNodeId) || undefined,
        stableAnchorSourcePath: normalizeSourcePath(record.stableAnchorSourcePath) || undefined
    };
}
function isDefined(value) {
    return value !== undefined;
}
function collectTargetNodeIds(protocolDraft) {
    const targetNodeIds = new Set();
    const actions = Array.isArray(protocolDraft?.actions) ? protocolDraft.actions : [];
    for (const action of actions) {
        const nodeId = normalizeText(action.nodeId);
        if (nodeId) {
            targetNodeIds.add(nodeId);
        }
        const parentNodeId = normalizeText(action.parentNodeId);
        if (parentNodeId) {
            targetNodeIds.add(parentNodeId);
        }
        const childNodeId = normalizeText(action.node?.nodeId);
        if (childNodeId) {
            targetNodeIds.add(childNodeId);
        }
    }
    return [...targetNodeIds].sort((left, right) => left.localeCompare(right));
}
function extractSourcePathFromProtocolDraft(protocolDraft) {
    const actions = Array.isArray(protocolDraft?.actions) ? protocolDraft.actions : [];
    for (const action of actions) {
        const childSourcePath = normalizeSourcePath(action.node?.sourcePath);
        if (childSourcePath) {
            return childSourcePath;
        }
        const actionSourcePath = normalizeSourcePath(action.sourcePath);
        if (actionSourcePath) {
            return actionSourcePath;
        }
    }
    return '';
}
function extractSourcePathFromEvidence(proposal) {
    const evidence = Array.isArray(proposal.evidence) ? proposal.evidence : [];
    for (const item of evidence) {
        const sourcePath = normalizeSourcePath(item?.sourcePath);
        if (sourcePath) {
            return sourcePath;
        }
    }
    return '';
}
function normalizeDreamProposalCategory(value) {
    if (value === 'frontend' || value === 'backend' || value === 'core' || value === 'unknown') {
        return value;
    }
    return undefined;
}
function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return [...new Set(value.map((entry) => normalizeText(entry)).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
function normalizeSourcePath(value) {
    return normalizeText(value).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/{2,}/g, '/');
}
function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function buildDreamFeedbackDecisionId(proposalId, recordedAt) {
    return `dream_reject_${recordedAt.replace(/[^0-9]/g, '').slice(0, 14)}_${sanitizeDecisionToken(proposalId)}`;
}
function sanitizeDecisionToken(value) {
    return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 48) || 'proposal';
}
function defaultReviewerName(role) {
    if (!DREAM_FEEDBACK_REVIEWER_ROLES.has(role)) {
        return 'project-reviewer';
    }
    if (role === 'ai') {
        return 'ai-assistant';
    }
    if (role === 'operator') {
        return 'project-operator';
    }
    return 'project-maintainer';
}
//# sourceMappingURL=dreamFeedbackSupport.js.map