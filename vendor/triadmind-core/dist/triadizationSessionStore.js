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
exports.buildTriadizationTaskMarkdown = buildTriadizationTaskMarkdown;
exports.writeTriadizationArtifacts = writeTriadizationArtifacts;
exports.readTriadizationSession = readTriadizationSession;
exports.readTriadizationConfirmation = readTriadizationConfirmation;
exports.hasConfirmedTriadization = hasConfirmedTriadization;
exports.writeTriadizationConfirmation = writeTriadizationConfirmation;
exports.resolveTriadizationSession = resolveTriadizationSession;
const fs = __importStar(require("fs"));
const analyzerOptionsSupport_1 = require("./analyzerOptionsSupport");
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const stableArchitectureAnchorSupport_1 = require("./stableArchitectureAnchorSupport");
const protocol_1 = require("./protocol");
const triadizationAnalysis_1 = require("./triadizationAnalysis");
/**
 * @LeftBranch
 */
function buildTriadizationTaskMarkdown(report) {
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
function writeTriadizationArtifacts(paths) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const map = (0, protocol_1.readTriadMap)(paths.mapFile);
    const stableAnchorResolution = (0, stableArchitectureAnchorSupport_1.resolveEffectiveStableAnchors)(paths, config.topologyRisk);
    const report = (0, triadizationAnalysis_1.analyzeTriadizationOpportunities)(paths.projectRoot, map, (0, analyzerOptionsSupport_1.resolveAnalyzerOptionsFromConfig)(config, stableAnchorResolution.stableAnchors));
    const existingSession = readTriadizationSession(paths);
    const session = buildTriadizationSession(report, existingSession);
    fs.writeFileSync(paths.triadizationReportFile, JSON.stringify(report, null, 2), 'utf-8');
    fs.writeFileSync(paths.triadizationTaskFile, buildTriadizationTaskMarkdown(report), 'utf-8');
    if (session) {
        fs.writeFileSync(paths.triadizationSessionFile, JSON.stringify(session, null, 2), 'utf-8');
        if (session.status === 'confirmed') {
            fs.writeFileSync(paths.triadizationConfirmationFile, JSON.stringify(toTriadizationConfirmation(session), null, 2), 'utf-8');
        }
        else {
            safeUnlink(paths.triadizationConfirmationFile);
        }
    }
    else {
        safeUnlink(paths.triadizationSessionFile);
        safeUnlink(paths.triadizationConfirmationFile);
    }
    return report;
}
/**
 * @LeftBranch
 */
function readTriadizationSession(paths) {
    const parsed = readJsonFileIfExists(paths.triadizationSessionFile);
    if (!parsed ||
        typeof parsed.proposalId !== 'string' ||
        typeof parsed.triadizationFocus !== 'string' ||
        typeof parsed.recommendedOperation !== 'string' ||
        typeof parsed.status !== 'string') {
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
        sessionId: typeof parsed.sessionId === 'string' && parsed.sessionId.trim().length > 0
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
            impactedNodeCount: typeof parsed.blastRadius?.impactedNodeCount === 'number'
                ? parsed.blastRadius.impactedNodeCount
                : impactedNodeIds.length,
            impactedNodeIds
        },
        taskBundle,
        reportGeneratedAt: typeof parsed.reportGeneratedAt === 'string' ? parsed.reportGeneratedAt : '',
        status,
        confirmation: status === 'confirmed' ? confirmation : undefined
    };
}
/**
 * @LeftBranch
 */
function readTriadizationConfirmation(paths) {
    const session = readTriadizationSession(paths);
    if (session?.status === 'confirmed' && session.confirmation) {
        return toTriadizationConfirmation(session);
    }
    if (session?.status === 'proposed' || !fs.existsSync(paths.triadizationConfirmationFile)) {
        return undefined;
    }
    const parsed = (0, artifactReaders_1.readJsonIfExists)(paths.triadizationConfirmationFile);
    if (typeof parsed?.proposalId !== 'string' ||
        typeof parsed?.targetNodeId !== 'string' ||
        typeof parsed?.recommendedOperation !== 'string') {
        return undefined;
    }
    return parsed;
}
/**
 * @LeftBranch
 */
function hasConfirmedTriadization(paths, report) {
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
function writeTriadizationConfirmation(paths, report, source) {
    const session = resolveTriadizationSession(paths, report);
    if (!session) {
        return undefined;
    }
    const confirmation = {
        confirmedAt: new Date().toISOString(),
        source
    };
    const nextSession = {
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
function resolveTriadizationSession(paths, report) {
    const existingSession = readTriadizationSession(paths);
    if (report) {
        return buildTriadizationSession(report, existingSession);
    }
    if (existingSession) {
        return existingSession;
    }
    const parsed = readJsonFileIfExists(paths.triadizationReportFile);
    if (!parsed) {
        return undefined;
    }
    return buildTriadizationSession(parsed);
}
function buildTriadizationSession(report, existingSession) {
    const proposal = report.primaryProposal;
    if (!proposal) {
        return undefined;
    }
    const now = new Date().toISOString();
    const preservedConfirmation = existingSession?.proposalId === proposal.proposalId && existingSession.status === 'confirmed'
        ? existingSession.confirmation
        : undefined;
    return {
        schemaVersion: '1.0',
        sessionId: createTriadizationSessionId(proposal.proposalId),
        project: report.project,
        generatedAt: existingSession?.proposalId === proposal.proposalId && existingSession.generatedAt
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
    };
}
function toTriadizationConfirmation(session) {
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
function readJsonFileIfExists(filePath) {
    return (0, artifactReaders_1.readJsonIfExists)(filePath);
}
function readStringList(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : [];
}
function readDiagnosisList(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string')
        : [];
}
function isTriadizationTask(value) {
    return (typeof value?.phase === 'string' &&
        typeof value?.title === 'string' &&
        typeof value?.objective === 'string');
}
function isTriadizationSessionConfirmation(value) {
    return (typeof value?.confirmedAt === 'string' &&
        typeof value?.source === 'string');
}
function createTriadizationSessionId(proposalId) {
    const sanitized = String(proposalId ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return sanitized ? `triadization-${sanitized}` : 'triadization-session';
}
function normalizeTriadizationOperation(value) {
    return value === 'aggregate' || value === 'renormalize' ? value : 'split';
}
function normalizeTriadizationScale(value) {
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
function safeUnlink(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}
//# sourceMappingURL=triadizationSessionStore.js.map