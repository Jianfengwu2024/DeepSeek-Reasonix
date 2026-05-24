import {
    evaluateTriadizationFocusGateArtifacts,
    TriadizationFocusGateFailureKind,
    TriadizationFocusGateReport
} from './triadizationFocus';
import { parseJsonText } from './artifactReaders';
import {
    formatTriadizationFocusState,
    resolveTriadizationFocusState,
    TriadizationFocusState
} from './triadizationStateSupport';

export interface StageAnalysisInput {
    latestDemand: string;
    draftProtocol: string;
    macroSplit: string;
    mesoSplit: string;
    microSplit: string;
    approvedProtocol: string;
    triadizationReport?: string;
    triadizationSession?: string;
}

export interface StageAnalysisResult {
    hasRelevantApprovedProtocol: boolean;
    hasRelevantDraftProtocol: boolean;
    hasMacroSplit: boolean;
    hasMesoSplit: boolean;
    hasMicroSplit: boolean;
    hasTriadizationReport: boolean;
    triadizationFocus?: string;
    triadizationAction?: string;
    hasBlockingTriadizationFocusGate: boolean;
    triadizationFocusGateStatus: TriadizationFocusGateReport['status'];
    triadizationFocusGateKind?: TriadizationFocusGateFailureKind;
    triadizationFocusGateSummary?: string;
    triadizationFocusGateRepairTarget?: string;
    triadizationFocusGateDetails: string[];
    currentStage: string;
}

type ParsedStageArtifacts = {
    latestDemand: string;
    draftProtocolJson: any;
    macroSplitJson: any;
    mesoSplitJson: any;
    microSplitJson: any;
    approvedProtocolJson: any;
    triadizationReportJson: any;
    triadizationSessionJson: any;
};

type StageProgressState = {
    hasRelevantApprovedProtocol: boolean;
    hasRelevantDraftProtocol: boolean;
    hasMacroSplit: boolean;
    hasMesoSplit: boolean;
    hasMicroSplit: boolean;
    triadizationState?: TriadizationFocusState;
};

export function analyzeWorkspaceStage(input: StageAnalysisInput): StageAnalysisResult {
    const parsedArtifacts = parseStageArtifacts(input);
    const progress = resolveStageProgress(parsedArtifacts);
    const focusGate = evaluateTriadizationFocusGateArtifacts(
        parsedArtifacts.draftProtocolJson,
        parsedArtifacts.microSplitJson
    );
    const hasBlockingTriadizationFocusGate = !progress.hasRelevantApprovedProtocol && focusGate.status === 'fail';

    const baseStage = resolveBaseStage({
        hasRelevantDraftProtocol: progress.hasRelevantDraftProtocol,
        hasRelevantApprovedProtocol: progress.hasRelevantApprovedProtocol,
        hasMicroSplit: progress.hasMicroSplit,
        hasMesoSplit: progress.hasMesoSplit,
        hasMacroSplit: progress.hasMacroSplit,
        hasBlockingTriadizationFocusGate
    });
    const focusGateStage = hasBlockingTriadizationFocusGate ? buildFocusGateStageMessage(focusGate) : '';
    const triadizationStage =
        progress.triadizationState && !progress.hasRelevantApprovedProtocol
            ? buildTriadizationStageMessage(progress.triadizationState)
            : '';
    const currentStage = [triadizationStage, focusGateStage, baseStage].filter(Boolean).join(' ');

    return {
        hasRelevantApprovedProtocol: progress.hasRelevantApprovedProtocol,
        hasRelevantDraftProtocol: progress.hasRelevantDraftProtocol,
        hasMacroSplit: progress.hasMacroSplit,
        hasMesoSplit: progress.hasMesoSplit,
        hasMicroSplit: progress.hasMicroSplit,
        hasTriadizationReport: Boolean(progress.triadizationState),
        triadizationFocus: formatTriadizationFocus(progress.triadizationState),
        triadizationAction: progress.triadizationState?.recommendedOperation,
        hasBlockingTriadizationFocusGate,
        triadizationFocusGateStatus: focusGate.status,
        triadizationFocusGateKind: focusGate.failureKind,
        triadizationFocusGateSummary: focusGate.summary,
        triadizationFocusGateRepairTarget: focusGate.repairTarget,
        triadizationFocusGateDetails: focusGate.details,
        currentStage
    };
}

function parseStageArtifacts(input: StageAnalysisInput): ParsedStageArtifacts {
    return {
        latestDemand: normalizeDemandText(input.latestDemand),
        draftProtocolJson: parseJsonText(input.draftProtocol),
        macroSplitJson: parseJsonText(input.macroSplit),
        mesoSplitJson: parseJsonText(input.mesoSplit),
        microSplitJson: parseJsonText(input.microSplit),
        approvedProtocolJson: parseJsonText(input.approvedProtocol),
        triadizationReportJson: parseJsonText(input.triadizationReport ?? ''),
        triadizationSessionJson: parseJsonText(input.triadizationSession ?? '')
    };
}

function resolveStageProgress(parsedArtifacts: ParsedStageArtifacts): StageProgressState {
    const hasApprovedProtocol = hasProtocolActions(parsedArtifacts.approvedProtocolJson);
    const hasDraftProtocol = hasProtocolActions(parsedArtifacts.draftProtocolJson);

    return {
        hasRelevantApprovedProtocol:
            hasApprovedProtocol && isProtocolForDemand(parsedArtifacts.approvedProtocolJson, parsedArtifacts.latestDemand),
        hasRelevantDraftProtocol:
            hasDraftProtocol && isProtocolForDemand(parsedArtifacts.draftProtocolJson, parsedArtifacts.latestDemand),
        hasMacroSplit: hasMacroSplitContent(parsedArtifacts.macroSplitJson),
        hasMesoSplit: hasMesoSplitContent(parsedArtifacts.mesoSplitJson),
        hasMicroSplit: hasMicroSplitContent(parsedArtifacts.microSplitJson),
        triadizationState: getTriadizationState(
            parsedArtifacts.triadizationSessionJson,
            parsedArtifacts.triadizationReportJson
        )
    };
}

function resolveBaseStage(input: {
    hasRelevantDraftProtocol: boolean;
    hasRelevantApprovedProtocol: boolean;
    hasMicroSplit: boolean;
    hasMesoSplit: boolean;
    hasMacroSplit: boolean;
    hasBlockingTriadizationFocusGate: boolean;
}) {
    if (input.hasRelevantDraftProtocol) {
        return input.hasBlockingTriadizationFocusGate
            ? 'Stage 1 - focus gate blocked: draft-protocol.json exists, but the triadization focus is not closed yet. Repair the focus gate before opening the visualizer review.'
            : 'Stage 1 - review: draft-protocol.json is ready and should go through visualizer review first.';
    }

    if (input.hasRelevantApprovedProtocol) {
        return 'Stage 2 - implementation: the protocol is approved, so follow the handoff constraints and continue the code implementation.';
    }

    if (input.hasMicroSplit) {
        return input.hasBlockingTriadizationFocusGate
            ? 'Stage 1 - micro gate blocked: micro-split.json exists, but the triadization focus is not closed yet. Repair the gate before folding everything into draft-protocol.json.'
            : 'Stage 1 - micro: class-level branches are ready; the next step is to fold them into draft-protocol.json.';
    }

    if (input.hasMesoSplit) {
        return 'Stage 1 - meso: class and pipeline decomposition is ready; the next step is Micro-Split.';
    }

    if (input.hasMacroSplit) {
        return 'Stage 1 - macro: the vertex and left/right branch split is ready; the next step is Meso-Split.';
    }

    return 'Stage 1 - planning: no effective split has been completed yet, so start with Macro-Split.';
}

function buildTriadizationStageMessage(state: TriadizationFocusState) {
    const exactFocus = formatTriadizationFocusState(state);
    if (state.confirmed) {
        return `Stage 0 - triadization session confirmed: continue evolving around ${exactFocus}.`;
    }

    return `Stage 0 - triadization diagnosis: confirm ${exactFocus} before continuing protocol evolution.`;
}

function buildFocusGateStageMessage(focusGate: TriadizationFocusGateReport) {
    const failureKind = focusGate.failureKind ?? 'triadization_focus_gate';
    const repairSuffix = focusGate.repairTarget ? ` Repair target: ${focusGate.repairTarget}.` : '';
    return `Current blocker: ${failureKind}. ${focusGate.summary}${repairSuffix}`;
}

function formatTriadizationFocus(state?: TriadizationFocusState) {
    return formatTriadizationFocusState(state);
}

function hasProtocolActions(value: any) {
    return Array.isArray(value?.actions) && value.actions.length > 0;
}

function isProtocolForDemand(value: any, latestDemand: string) {
    if (!latestDemand) {
        return true;
    }

    return normalizeDemandText(value?.userDemand) === latestDemand;
}

function hasMacroSplitContent(value: any) {
    return Boolean(
        value &&
            (hasNonEmptyString(value.anchorNodeId) ||
                hasNonEmptyArray(value.leftBranch) ||
                hasNonEmptyArray(value.rightBranch))
    );
}

function hasMesoSplitContent(value: any) {
    return Boolean(value && (hasNonEmptyArray(value.classes) || hasNonEmptyArray(value.pipelines)));
}

function hasMicroSplitContent(value: any) {
    if (!value || !Array.isArray(value.classes) || value.classes.length === 0) {
        return false;
    }

    return value.classes.some(
        (item: any) =>
            hasNonEmptyArray(item?.staticRightBranch) ||
            hasNonEmptyArray(item?.dynamicLeftBranch) ||
            hasNonEmptyArray(item?.properties) ||
            hasNonEmptyArray(item?.methods)
    );
}

function hasNonEmptyArray(value: unknown) {
    return Array.isArray(value) && value.length > 0;
}

function hasNonEmptyString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeDemandText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function getTriadizationState(sessionValue: any, reportValue: any) {
    return resolveTriadizationFocusState({
        session: sessionValue,
        report: reportValue
    });
}
