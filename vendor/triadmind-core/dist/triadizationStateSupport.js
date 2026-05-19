"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTriadizationFocusState = resolveTriadizationFocusState;
exports.readPrimaryTriadizationProposalSummary = readPrimaryTriadizationProposalSummary;
exports.formatTriadizationFocusState = formatTriadizationFocusState;
exports.buildTriadizationConfirmationMessage = buildTriadizationConfirmationMessage;
function resolveTriadizationFocusState(input) {
    const sessionState = readTriadizationSessionState(input.session);
    if (sessionState) {
        return sessionState;
    }
    const proposal = readPrimaryTriadizationProposalSummary(input.report);
    if (!proposal) {
        return undefined;
    }
    const confirmation = readTriadizationConfirmationSummary(input.confirmation);
    const confirmed = confirmation?.proposalId === proposal.proposalId;
    return {
        proposalId: proposal.proposalId,
        triadizationFocus: proposal.targetNodeId,
        recommendedOperation: proposal.recommendedOperation,
        diagnosis: proposal.diagnosis,
        confirmed,
        confirmationSource: confirmed ? confirmation?.source : undefined
    };
}
function readPrimaryTriadizationProposalSummary(value) {
    const container = isRecord(value) ? value : undefined;
    const proposal = isRecord(container?.primaryProposal) ? container.primaryProposal : isRecord(value) ? value : undefined;
    if (!proposal ||
        typeof proposal.proposalId !== 'string' ||
        typeof proposal.targetNodeId !== 'string') {
        return undefined;
    }
    const recommendedOperation = normalizeTriadizationOperation(proposal.recommendedOperation);
    if (!recommendedOperation) {
        return undefined;
    }
    return {
        proposalId: proposal.proposalId.trim(),
        targetNodeId: proposal.targetNodeId.trim(),
        recommendedOperation,
        diagnosis: normalizeDiagnosisList(proposal.diagnosis)
    };
}
function formatTriadizationFocusState(state) {
    if (!state?.triadizationFocus || !state?.recommendedOperation) {
        return undefined;
    }
    return `${state.triadizationFocus} -> ${state.recommendedOperation}`;
}
function buildTriadizationConfirmationMessage(proposalLike) {
    const proposal = readPrimaryTriadizationProposalSummary(proposalLike);
    if (!proposal) {
        return 'No explicit triadization proposal was found. Continue anyway?';
    }
    const diagnosis = proposal.diagnosis.join(', ') || 'none';
    return `Confirm this evolution first: ${proposal.targetNodeId} -> ${proposal.recommendedOperation} (${diagnosis}). Continue after confirmation?`;
}
function readTriadizationSessionState(value) {
    const session = isRecord(value) ? value : undefined;
    if (!session ||
        typeof session.proposalId !== 'string' ||
        typeof session.triadizationFocus !== 'string') {
        return undefined;
    }
    const recommendedOperation = normalizeTriadizationOperation(session.recommendedOperation);
    if (!recommendedOperation) {
        return undefined;
    }
    return {
        sessionId: typeof session.sessionId === 'string' ? session.sessionId.trim() : undefined,
        proposalId: session.proposalId.trim(),
        triadizationFocus: session.triadizationFocus.trim(),
        recommendedOperation,
        diagnosis: normalizeDiagnosisList(session.diagnosis),
        confirmed: session.status === 'confirmed',
        confirmationSource: session.status === 'confirmed' ? normalizeConfirmationSource(session.confirmation?.source) : undefined
    };
}
function readTriadizationConfirmationSummary(value) {
    const confirmation = isRecord(value) ? value : undefined;
    if (!confirmation || typeof confirmation.proposalId !== 'string') {
        return undefined;
    }
    return {
        proposalId: confirmation.proposalId.trim(),
        source: normalizeConfirmationSource(confirmation.source)
    };
}
function normalizeTriadizationOperation(value) {
    switch (String(value ?? '').trim().toLowerCase()) {
        case 'aggregate':
        case 'split':
        case 'renormalize':
            return String(value).trim().toLowerCase();
        default:
            return undefined;
    }
}
function normalizeConfirmationSource(value) {
    switch (String(value ?? '').trim().toLowerCase()) {
        case 'plan':
        case 'apply':
        case 'invoke':
        case 'triadize':
            return String(value).trim().toLowerCase();
        default:
            return undefined;
    }
}
function normalizeDiagnosisList(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : [];
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
//# sourceMappingURL=triadizationStateSupport.js.map