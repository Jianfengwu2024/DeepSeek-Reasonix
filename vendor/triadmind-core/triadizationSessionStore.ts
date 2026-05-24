import * as fs from 'fs';
import { resolveAnalyzerOptionsFromConfig } from './analyzerOptionsSupport';
import { readJsonIfExists } from './artifactReaders';
import { loadTriadConfig } from './config';
import { resolveEffectiveStableAnchors } from './stableArchitectureAnchorSupport';
import { readTriadMap } from './protocol';
import { analyzeTriadizationOpportunities } from './triadizationAnalysis';
import {
    TriadizationConfirmation,
    TriadizationConfirmationSource,
    TriadizationDiagnosisCode,
    TriadizationOperation,
    TriadizationReport,
    TriadizationScale,
    TriadizationSession,
    TriadizationSessionConfirmation,
    TriadizationTask
} from './triadizationTypes';
import { TriadizationPaths } from './workspace';

/**
 * @LeftBranch
 */
export function buildTriadizationTaskMarkdown(report: TriadizationReport) {
    if (!report.primaryProposal) {
        return ['# Triadization Task', '', '当前没有可执行的顶点三元化提案。'].join('\n');
    }

    const proposal = report.primaryProposal;
    return [
        '# Triadization Task',
        '',
        `- Project: ${report.project}`,
        `- Generated At: ${report.generatedAt}`,
        `- Target Node: ${proposal.targetNodeId}`,
        `- Operation: ${proposal.recommendedOperation}`,
        `- Scale: ${proposal.triadScale}`,
        `- Diagnosis: ${proposal.diagnosis.join(', ')}`,
        `- Blast Radius: ${proposal.blastRadius.impactedNodeCount}`,
        '',
        '## Confirmation',
        proposal.confirmationPrompt,
        '',
        '## Rationale',
        proposal.rationale,
        '',
        '## Evidence',
        ...proposal.evidence.map((item) => `- ${item}`),
        '',
        '## Controlled Evolution',
        ...proposal.taskBundle.map((task, index) => `${index + 1}. [${task.phase}] ${task.title}: ${task.objective}`)
    ].join('\n');
}

/**
 * @LeftBranch
 */
export function writeTriadizationArtifacts(paths: TriadizationPaths) {
    const config = loadTriadConfig(paths);
    const map = readTriadMap(paths.mapFile);
    const stableAnchorResolution = resolveEffectiveStableAnchors(paths, config.topologyRisk);
    const report = analyzeTriadizationOpportunities(
        paths.projectRoot,
        map,
        resolveAnalyzerOptionsFromConfig(config, stableAnchorResolution.stableAnchors)
    );
    const existingSession = readTriadizationSession(paths);
    const session = buildTriadizationSession(report, existingSession);

    fs.writeFileSync(paths.triadizationReportFile, JSON.stringify(report, null, 2), 'utf-8');
    fs.writeFileSync(paths.triadizationTaskFile, buildTriadizationTaskMarkdown(report), 'utf-8');

    if (session) {
        fs.writeFileSync(paths.triadizationSessionFile, JSON.stringify(session, null, 2), 'utf-8');
        if (session.status === 'confirmed') {
            fs.writeFileSync(
                paths.triadizationConfirmationFile,
                JSON.stringify(toTriadizationConfirmation(session), null, 2),
                'utf-8'
            );
        } else {
            safeUnlink(paths.triadizationConfirmationFile);
        }
    } else {
        safeUnlink(paths.triadizationSessionFile);
        safeUnlink(paths.triadizationConfirmationFile);
    }

    return report;
}

/**
 * @LeftBranch
 */
export function readTriadizationSession(paths: TriadizationPaths) {
    const parsed = readJsonFileIfExists<Partial<TriadizationSession>>(paths.triadizationSessionFile);
    if (
        !parsed ||
        typeof parsed.proposalId !== 'string' ||
        typeof parsed.triadizationFocus !== 'string' ||
        typeof parsed.recommendedOperation !== 'string' ||
        typeof parsed.status !== 'string'
    ) {
        return undefined;
    }

    const targetNodeIds = readStringList(parsed.targetNodeIds);
    const diagnosis = readDiagnosisList(parsed.diagnosis);
    const evidence = readStringList(parsed.evidence);
    const taskBundle = Array.isArray(parsed.taskBundle) ? parsed.taskBundle.filter(isTriadizationTask) : [];
    const impactedNodeIds = readStringList(parsed.blastRadius?.impactedNodeIds);
    const status = parsed.status === 'confirmed' ? 'confirmed' : 'proposed';
    const confirmation = isTriadizationSessionConfirmation(parsed.confirmation) ? parsed.confirmation : undefined;

    return {
        schemaVersion: '1.0',
        sessionId:
            typeof parsed.sessionId === 'string' && parsed.sessionId.trim().length > 0
                ? parsed.sessionId
                : createTriadizationSessionId(parsed.proposalId),
        project: typeof parsed.project === 'string' ? parsed.project : '',
        generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
        proposalId: parsed.proposalId,
        triadizationFocus: parsed.triadizationFocus,
        targetNodeIds,
        triadScale: normalizeTriadizationScale(parsed.triadScale),
        recommendedOperation: normalizeTriadizationOperation(parsed.recommendedOperation),
        diagnosis,
        rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
        evidence,
        confirmationPrompt: typeof parsed.confirmationPrompt === 'string' ? parsed.confirmationPrompt : '',
        blastRadius: {
            impactedNodeCount:
                typeof parsed.blastRadius?.impactedNodeCount === 'number'
                    ? parsed.blastRadius.impactedNodeCount
                    : impactedNodeIds.length,
            impactedNodeIds
        },
        taskBundle,
        reportGeneratedAt: typeof parsed.reportGeneratedAt === 'string' ? parsed.reportGeneratedAt : '',
        status,
        confirmation: status === 'confirmed' ? confirmation : undefined
    } satisfies TriadizationSession;
}

/**
 * @LeftBranch
 */
export function readTriadizationConfirmation(paths: TriadizationPaths) {
    const session = readTriadizationSession(paths);
    if (session?.status === 'confirmed' && session.confirmation) {
        return toTriadizationConfirmation(session);
    }

    if (session?.status === 'proposed' || !fs.existsSync(paths.triadizationConfirmationFile)) {
        return undefined;
    }

    const parsed = readJsonIfExists<TriadizationConfirmation>(paths.triadizationConfirmationFile);
    if (
        typeof parsed?.proposalId !== 'string' ||
        typeof parsed?.targetNodeId !== 'string' ||
        typeof parsed?.recommendedOperation !== 'string'
    ) {
        return undefined;
    }

    return parsed;
}

/**
 * @LeftBranch
 */
export function hasConfirmedTriadization(paths: TriadizationPaths, report: TriadizationReport) {
    if (!report.primaryProposal) {
        return true;
    }

    const session = readTriadizationSession(paths);
    if (session) {
        return session.proposalId === report.primaryProposal.proposalId && session.status === 'confirmed';
    }

    const confirmation = readTriadizationConfirmation(paths);
    return confirmation?.proposalId === report.primaryProposal.proposalId;
}

/**
 * @LeftBranch
 */
export function writeTriadizationConfirmation(
    paths: TriadizationPaths,
    report: TriadizationReport,
    source: TriadizationConfirmationSource
) {
    const session = resolveTriadizationSession(paths, report);
    if (!session) {
        return undefined;
    }

    const confirmation: TriadizationSessionConfirmation = {
        confirmedAt: new Date().toISOString(),
        source
    };
    const nextSession: TriadizationSession = {
        ...session,
        updatedAt: confirmation.confirmedAt,
        status: 'confirmed',
        confirmation
    };
    const legacyConfirmation = toTriadizationConfirmation(nextSession);

    fs.writeFileSync(paths.triadizationSessionFile, JSON.stringify(nextSession, null, 2), 'utf-8');
    fs.writeFileSync(paths.triadizationConfirmationFile, JSON.stringify(legacyConfirmation, null, 2), 'utf-8');
    return legacyConfirmation;
}

/**
 * @LeftBranch
 */
export function resolveTriadizationSession(paths: TriadizationPaths, report?: TriadizationReport) {
    const existingSession = readTriadizationSession(paths);
    if (report) {
        return buildTriadizationSession(report, existingSession);
    }

    if (existingSession) {
        return existingSession;
    }

    const parsed = readJsonFileIfExists<TriadizationReport>(paths.triadizationReportFile);
    if (!parsed) {
        return undefined;
    }

    return buildTriadizationSession(parsed);
}

function buildTriadizationSession(report: TriadizationReport, existingSession?: TriadizationSession) {
    const proposal = report.primaryProposal;
    if (!proposal) {
        return undefined;
    }

    const now = new Date().toISOString();
    const preservedConfirmation =
        existingSession?.proposalId === proposal.proposalId && existingSession.status === 'confirmed'
            ? existingSession.confirmation
            : undefined;

    return {
        schemaVersion: '1.0',
        sessionId: createTriadizationSessionId(proposal.proposalId),
        project: report.project,
        generatedAt:
            existingSession?.proposalId === proposal.proposalId && existingSession.generatedAt
                ? existingSession.generatedAt
                : now,
        updatedAt: now,
        proposalId: proposal.proposalId,
        triadizationFocus: proposal.targetNodeId,
        targetNodeIds: proposal.targetNodeIds.slice(),
        triadScale: proposal.triadScale,
        recommendedOperation: proposal.recommendedOperation,
        diagnosis: proposal.diagnosis.slice(),
        rationale: proposal.rationale,
        evidence: proposal.evidence.slice(),
        confirmationPrompt: proposal.confirmationPrompt,
        blastRadius: {
            impactedNodeCount: proposal.blastRadius.impactedNodeCount,
            impactedNodeIds: proposal.blastRadius.impactedNodeIds.slice()
        },
        taskBundle: proposal.taskBundle.map((task) => ({ ...task })),
        reportGeneratedAt: report.generatedAt,
        status: preservedConfirmation ? 'confirmed' : 'proposed',
        confirmation: preservedConfirmation
    } satisfies TriadizationSession;
}

function toTriadizationConfirmation(session: TriadizationSession): TriadizationConfirmation {
    return {
        schemaVersion: '1.0',
        confirmedAt: session.confirmation?.confirmedAt ?? session.updatedAt,
        source: session.confirmation?.source ?? 'triadize',
        proposalId: session.proposalId,
        targetNodeId: session.triadizationFocus,
        recommendedOperation: session.recommendedOperation,
        reportGeneratedAt: session.reportGeneratedAt
    };
}

function readJsonFileIfExists<T = unknown>(filePath: string) {
    return readJsonIfExists<T>(filePath);
}

function readStringList(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}

function readDiagnosisList(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item: unknown): item is TriadizationDiagnosisCode => typeof item === 'string')
        : [];
}

function isTriadizationTask(value: unknown): value is TriadizationTask {
    return (
        typeof (value as TriadizationTask | undefined)?.phase === 'string' &&
        typeof (value as TriadizationTask | undefined)?.title === 'string' &&
        typeof (value as TriadizationTask | undefined)?.objective === 'string'
    );
}

function isTriadizationSessionConfirmation(value: unknown): value is TriadizationSessionConfirmation {
    return (
        typeof (value as TriadizationSessionConfirmation | undefined)?.confirmedAt === 'string' &&
        typeof (value as TriadizationSessionConfirmation | undefined)?.source === 'string'
    );
}

function createTriadizationSessionId(proposalId: string) {
    const sanitized = String(proposalId ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return sanitized ? `triadization-${sanitized}` : 'triadization-session';
}

function normalizeTriadizationOperation(value: unknown): TriadizationOperation {
    return value === 'aggregate' || value === 'renormalize' ? value : 'split';
}

function normalizeTriadizationScale(value: unknown): TriadizationScale {
    switch (value) {
        case 'class':
        case 'capability':
        case 'module':
        case 'workflow':
        case 'cluster':
            return value;
        default:
            return 'capability';
    }
}

function safeUnlink(filePath: string) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}
