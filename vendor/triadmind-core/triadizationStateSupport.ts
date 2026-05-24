import {
    TriadizationConfirmationSource,
    TriadizationDiagnosisCode,
    TriadizationOperation,
    TriadizationProposal
} from './triadizationTypes';

export interface TriadizationFocusState {
    sessionId?: string;
    proposalId: string;
    triadizationFocus: string;
    recommendedOperation: TriadizationOperation;
    diagnosis: TriadizationDiagnosisCode[];
    confirmed: boolean;
    confirmationSource?: TriadizationConfirmationSource;
}

type TriadizationFocusArtifacts = {
    session?: unknown;
    report?: unknown;
    confirmation?: unknown;
};

type TriadizationProposalSummary = Pick<
    TriadizationProposal,
    'proposalId' | 'targetNodeId' | 'recommendedOperation' | 'diagnosis'
>;

export function resolveTriadizationFocusState(input: TriadizationFocusArtifacts): TriadizationFocusState | undefined {
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

export function readPrimaryTriadizationProposalSummary(value: unknown): TriadizationProposalSummary | undefined {
    const container = isRecord(value) ? value : undefined;
    const proposal = isRecord(container?.primaryProposal) ? container.primaryProposal : isRecord(value) ? value : undefined;
    if (
        !proposal ||
        typeof proposal.proposalId !== 'string' ||
        typeof proposal.targetNodeId !== 'string'
    ) {
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

export function formatTriadizationFocusState(
    state?: Pick<TriadizationFocusState, 'triadizationFocus' | 'recommendedOperation'>
) {
    if (!state?.triadizationFocus || !state?.recommendedOperation) {
        return undefined;
    }

    return `${state.triadizationFocus} -> ${state.recommendedOperation}`;
}

export function buildTriadizationConfirmationMessage(proposalLike: unknown) {
    const proposal = readPrimaryTriadizationProposalSummary(proposalLike);
    if (!proposal) {
        return 'No explicit triadization proposal was found. Continue anyway?';
    }

    const diagnosis = proposal.diagnosis.join(', ') || 'none';
    return `Confirm this evolution first: ${proposal.targetNodeId} -> ${proposal.recommendedOperation} (${diagnosis}). Continue after confirmation?`;
}

function readTriadizationSessionState(value: unknown): TriadizationFocusState | undefined {
    const session = isRecord(value) ? value : undefined;
    if (
        !session ||
        typeof session.proposalId !== 'string' ||
        typeof session.triadizationFocus !== 'string'
    ) {
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
        confirmationSource:
            session.status === 'confirmed' ? normalizeConfirmationSource(session.confirmation?.source) : undefined
    };
}

function readTriadizationConfirmationSummary(value: unknown) {
    const confirmation = isRecord(value) ? value : undefined;
    if (!confirmation || typeof confirmation.proposalId !== 'string') {
        return undefined;
    }

    return {
        proposalId: confirmation.proposalId.trim(),
        source: normalizeConfirmationSource(confirmation.source)
    };
}

function normalizeTriadizationOperation(value: unknown): TriadizationOperation | undefined {
    switch (String(value ?? '').trim().toLowerCase()) {
        case 'aggregate':
        case 'split':
        case 'renormalize':
            return String(value).trim().toLowerCase() as TriadizationOperation;
        default:
            return undefined;
    }
}

function normalizeConfirmationSource(value: unknown): TriadizationConfirmationSource | undefined {
    switch (String(value ?? '').trim().toLowerCase()) {
        case 'plan':
        case 'apply':
        case 'invoke':
        case 'triadize':
            return String(value).trim().toLowerCase() as TriadizationConfirmationSource;
        default:
            return undefined;
    }
}

function normalizeDiagnosisList(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is TriadizationDiagnosisCode => typeof item === 'string' && item.trim().length > 0)
        : [];
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
}
