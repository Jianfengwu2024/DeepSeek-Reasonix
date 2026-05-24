import * as fs from 'fs';
import * as path from 'path';
import { ArtifactReadStatus, readJsonObjectArtifactResult } from './artifactReaders';
import type { DreamProposal } from './dream';
import type { TriadCategory, UpgradeProtocol } from './protocol';
import type { WorkspacePaths } from './workspace';

export type DreamFeedbackReviewerRole = 'maintainer' | 'ai' | 'operator';

export interface DreamProposalRejectionRecord {
    decisionId: string;
    decision: 'reject';
    proposalId: string;
    proposalFamily: string;
    proposalSignature: string;
    proposalTitle: string;
    category?: TriadCategory | 'unknown';
    sourcePath?: string;
    targetNodeIds: string[];
    linkedFindings: string[];
    reason: string;
    reasonCode?: string;
    extractedRule?: string;
    reviewer: string;
    reviewerRole: DreamFeedbackReviewerRole;
    recordedAt: string;
    isStableAnchor?: boolean;
    stableAnchorRecorded?: boolean;
    stableAnchorNodeId?: string;
    stableAnchorSourcePath?: string;
}

export interface DreamFeedbackLedger {
    schemaVersion: '1.0';
    project: string;
    updatedAt?: string;
    rejections: DreamProposalRejectionRecord[];
}

export interface DreamFeedbackLoadResult {
    status: ArtifactReadStatus;
    ledger: DreamFeedbackLedger;
}

export interface RecordDreamProposalRejectionInput {
    proposal: DreamProposal;
    reason: string;
    reasonCode?: string;
    extractedRule?: string;
    reviewer?: string;
    reviewerRole?: DreamFeedbackReviewerRole;
    recordedAt?: string;
    isStableAnchor?: boolean;
    stableAnchorRecorded?: boolean;
    stableAnchorNodeId?: string;
    stableAnchorSourcePath?: string;
}

export interface RecordDreamProposalRejectionResult {
    record: DreamProposalRejectionRecord;
    ledger: DreamFeedbackLedger;
    loadStatus: ArtifactReadStatus;
}

const DREAM_FEEDBACK_REVIEWER_ROLES = new Set<DreamFeedbackReviewerRole>(['maintainer', 'ai', 'operator']);

export function normalizeDreamFeedbackReviewerRole(value: string | undefined) {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'maintainer' || normalized === 'ai' || normalized === 'operator') {
        return normalized as DreamFeedbackReviewerRole;
    }
    return undefined;
}

export function deriveDreamProposalFamily(proposalId: string) {
    const normalizedProposalId = normalizeText(proposalId);
    if (normalizedProposalId.startsWith('DREAM_SPLIT_HIGH_FANOUT_')) {
        return 'DREAM_SPLIT_HIGH_FANOUT';
    }
    return normalizedProposalId || 'DREAM_UNKNOWN';
}

export function buildDreamProposalFeedbackSignature(proposal: DreamProposal) {
    return JSON.stringify({
        family: deriveDreamProposalFamily(proposal.id),
        sourcePath:
            normalizeSourcePath(proposal.sourcePath) ||
            extractSourcePathFromProtocolDraft(proposal.protocolDraft) ||
            extractSourcePathFromEvidence(proposal),
        targetNodeIds: collectTargetNodeIds(proposal.protocolDraft),
        linkedFindings: normalizeStringArray(proposal.linkedFindings)
    });
}

export function loadDreamFeedbackLedger(paths: Pick<WorkspacePaths, 'projectRoot' | 'dreamFeedbackFile'>): DreamFeedbackLoadResult {
    const project = path.basename(paths.projectRoot);
    const readResult = readJsonObjectArtifactResult<Record<string, unknown>>(paths.dreamFeedbackFile);
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

export function isStableAnchorRejectionRecord(
    record: Pick<DreamProposalRejectionRecord, 'isStableAnchor' | 'stableAnchorRecorded' | 'reasonCode'>
) {
    if (record.isStableAnchor === true || record.stableAnchorRecorded === true) {
        return true;
    }
    return normalizeText(record.reasonCode).toLowerCase() === 'stable_core_module';
}

export function recordDreamProposalRejection(
    paths: Pick<WorkspacePaths, 'projectRoot' | 'dreamFeedbackFile'>,
    input: RecordDreamProposalRejectionInput
): RecordDreamProposalRejectionResult {
    const loadResult = loadDreamFeedbackLedger(paths);
    const recordedAt = normalizeText(input.recordedAt) || new Date().toISOString();
    const reviewerRole = input.reviewerRole ?? 'maintainer';
    const isStableAnchor =
        input.isStableAnchor === true ||
        input.stableAnchorRecorded === true ||
        normalizeText(input.reasonCode).toLowerCase() === 'stable_core_module';
    const record: DreamProposalRejectionRecord = {
        decisionId: buildDreamFeedbackDecisionId(input.proposal.id, recordedAt),
        decision: 'reject',
        proposalId: normalizeText(input.proposal.id) || 'DREAM_UNKNOWN',
        proposalFamily: deriveDreamProposalFamily(input.proposal.id),
        proposalSignature: buildDreamProposalFeedbackSignature(input.proposal),
        proposalTitle: normalizeText(input.proposal.title) || normalizeText(input.proposal.id) || 'Untitled dream proposal',
        category: normalizeDreamProposalCategory(input.proposal.category),
        sourcePath:
            normalizeSourcePath(input.proposal.sourcePath) ||
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

    const ledger: DreamFeedbackLedger = {
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

export function indexLatestDreamRejectionsBySignature(ledger: DreamFeedbackLedger) {
    const latestBySignature = new Map<string, DreamProposalRejectionRecord>();
    for (const record of ledger.rejections) {
        const previous = latestBySignature.get(record.proposalSignature);
        if (!previous || previous.recordedAt.localeCompare(record.recordedAt) <= 0) {
            latestBySignature.set(record.proposalSignature, record);
        }
    }
    return latestBySignature;
}

export function formatDreamFeedbackRules(
    ledger: DreamFeedbackLedger,
    additionalFormattedRules?: string
) {
    const rejectionRules = ledger.rejections
        .filter((record) => record.extractedRule && record.extractedRule.trim().length > 0)
        .map((record) => `- ${record.extractedRule} (from rejected proposal: ${record.proposalTitle})`);

    const allLines: string[] = [];

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

export function formatDreamFeedbackLedger(ledger: DreamFeedbackLedger) {
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
            lines.push(
                `* ${record.proposalId} [${record.reviewerRole}] ${record.recordedAt} :: ${record.reason}${
                    isStableAnchorRejectionRecord(record) ? ' [stable-anchor]' : ''
                }`
            );
        });
    return lines.join('\n');
}

export function deriveStableArchitectureAnchorFromProposal(proposal: DreamProposal) {
    const targetNodeIds = collectTargetNodeIds(proposal.protocolDraft).filter(Boolean);
    const sourcePath =
        normalizeSourcePath(proposal.sourcePath) ||
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

function createEmptyDreamFeedbackLedger(project: string): DreamFeedbackLedger {
    return {
        schemaVersion: '1.0',
        project,
        rejections: []
    };
}

function normalizeDreamProposalRejectionRecord(value: unknown): DreamProposalRejectionRecord | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const record = value as Record<string, unknown>;
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
        isStableAnchor:
            record.isStableAnchor === true ||
            record.stableAnchorRecorded === true ||
            normalizeText(record.reasonCode).toLowerCase() === 'stable_core_module'
                ? true
                : undefined,
        stableAnchorRecorded: record.stableAnchorRecorded === true ? true : undefined,
        stableAnchorNodeId: normalizeText(record.stableAnchorNodeId) || undefined,
        stableAnchorSourcePath: normalizeSourcePath(record.stableAnchorSourcePath) || undefined
    } satisfies DreamProposalRejectionRecord;
}

function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

function collectTargetNodeIds(protocolDraft: UpgradeProtocol | undefined) {
    const targetNodeIds = new Set<string>();
    const actions = Array.isArray(protocolDraft?.actions) ? protocolDraft.actions : [];
    for (const action of actions) {
        const nodeId = normalizeText((action as { nodeId?: string }).nodeId);
        if (nodeId) {
            targetNodeIds.add(nodeId);
        }

        const parentNodeId = normalizeText((action as { parentNodeId?: string }).parentNodeId);
        if (parentNodeId) {
            targetNodeIds.add(parentNodeId);
        }

        const childNodeId = normalizeText((action as { node?: { nodeId?: string } }).node?.nodeId);
        if (childNodeId) {
            targetNodeIds.add(childNodeId);
        }
    }
    return [...targetNodeIds].sort((left, right) => left.localeCompare(right));
}

function extractSourcePathFromProtocolDraft(protocolDraft: UpgradeProtocol | undefined) {
    const actions = Array.isArray(protocolDraft?.actions) ? protocolDraft.actions : [];
    for (const action of actions) {
        const childSourcePath = normalizeSourcePath((action as { node?: { sourcePath?: string } }).node?.sourcePath);
        if (childSourcePath) {
            return childSourcePath;
        }

        const actionSourcePath = normalizeSourcePath((action as { sourcePath?: string }).sourcePath);
        if (actionSourcePath) {
            return actionSourcePath;
        }
    }
    return '';
}

function extractSourcePathFromEvidence(proposal: Pick<DreamProposal, 'evidence'>) {
    const evidence = Array.isArray(proposal.evidence) ? proposal.evidence : [];
    for (const item of evidence) {
        const sourcePath = normalizeSourcePath(item?.sourcePath);
        if (sourcePath) {
            return sourcePath;
        }
    }
    return '';
}

function normalizeDreamProposalCategory(value: unknown) {
    if (value === 'frontend' || value === 'backend' || value === 'core' || value === 'unknown') {
        return value as TriadCategory | 'unknown';
    }
    return undefined;
}

function normalizeStringArray(value: unknown) {
    if (!Array.isArray(value)) {
        return [] as string[];
    }
    return [...new Set(value.map((entry) => normalizeText(entry)).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function normalizeSourcePath(value: unknown) {
    return normalizeText(value).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/{2,}/g, '/');
}

function normalizeText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function buildDreamFeedbackDecisionId(proposalId: string, recordedAt: string) {
    return `dream_reject_${recordedAt.replace(/[^0-9]/g, '').slice(0, 14)}_${sanitizeDecisionToken(proposalId)}`;
}

function sanitizeDecisionToken(value: string) {
    return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 48) || 'proposal';
}

function defaultReviewerName(role: DreamFeedbackReviewerRole) {
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
