"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeWorkspaceStage = analyzeWorkspaceStage;
const triadizationFocus_1 = require("./triadizationFocus");
const artifactReaders_1 = require("./artifactReaders");
const triadizationStateSupport_1 = require("./triadizationStateSupport");
function analyzeWorkspaceStage(input) {
    const parsedArtifacts = parseStageArtifacts(input);
    const progress = resolveStageProgress(parsedArtifacts);
    const focusGate = (0, triadizationFocus_1.evaluateTriadizationFocusGateArtifacts)(parsedArtifacts.draftProtocolJson, parsedArtifacts.microSplitJson);
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
    const triadizationStage = progress.triadizationState && !progress.hasRelevantApprovedProtocol
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
function parseStageArtifacts(input) {
    return {
        latestDemand: normalizeDemandText(input.latestDemand),
        draftProtocolJson: (0, artifactReaders_1.parseJsonText)(input.draftProtocol),
        macroSplitJson: (0, artifactReaders_1.parseJsonText)(input.macroSplit),
        mesoSplitJson: (0, artifactReaders_1.parseJsonText)(input.mesoSplit),
        microSplitJson: (0, artifactReaders_1.parseJsonText)(input.microSplit),
        approvedProtocolJson: (0, artifactReaders_1.parseJsonText)(input.approvedProtocol),
        triadizationReportJson: (0, artifactReaders_1.parseJsonText)(input.triadizationReport ?? ''),
        triadizationSessionJson: (0, artifactReaders_1.parseJsonText)(input.triadizationSession ?? '')
    };
}
function resolveStageProgress(parsedArtifacts) {
    const hasApprovedProtocol = hasProtocolActions(parsedArtifacts.approvedProtocolJson);
    const hasDraftProtocol = hasProtocolActions(parsedArtifacts.draftProtocolJson);
    return {
        hasRelevantApprovedProtocol: hasApprovedProtocol && isProtocolForDemand(parsedArtifacts.approvedProtocolJson, parsedArtifacts.latestDemand),
        hasRelevantDraftProtocol: hasDraftProtocol && isProtocolForDemand(parsedArtifacts.draftProtocolJson, parsedArtifacts.latestDemand),
        hasMacroSplit: hasMacroSplitContent(parsedArtifacts.macroSplitJson),
        hasMesoSplit: hasMesoSplitContent(parsedArtifacts.mesoSplitJson),
        hasMicroSplit: hasMicroSplitContent(parsedArtifacts.microSplitJson),
        triadizationState: getTriadizationState(parsedArtifacts.triadizationSessionJson, parsedArtifacts.triadizationReportJson)
    };
}
function resolveBaseStage(input) {
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
function buildTriadizationStageMessage(state) {
    const exactFocus = (0, triadizationStateSupport_1.formatTriadizationFocusState)(state);
    if (state.confirmed) {
        return `Stage 0 - triadization session confirmed: continue evolving around ${exactFocus}.`;
    }
    return `Stage 0 - triadization diagnosis: confirm ${exactFocus} before continuing protocol evolution.`;
}
function buildFocusGateStageMessage(focusGate) {
    const failureKind = focusGate.failureKind ?? 'triadization_focus_gate';
    const repairSuffix = focusGate.repairTarget ? ` Repair target: ${focusGate.repairTarget}.` : '';
    return `Current blocker: ${failureKind}. ${focusGate.summary}${repairSuffix}`;
}
function formatTriadizationFocus(state) {
    return (0, triadizationStateSupport_1.formatTriadizationFocusState)(state);
}
function hasProtocolActions(value) {
    return Array.isArray(value?.actions) && value.actions.length > 0;
}
function isProtocolForDemand(value, latestDemand) {
    if (!latestDemand) {
        return true;
    }
    return normalizeDemandText(value?.userDemand) === latestDemand;
}
function hasMacroSplitContent(value) {
    return Boolean(value &&
        (hasNonEmptyString(value.anchorNodeId) ||
            hasNonEmptyArray(value.leftBranch) ||
            hasNonEmptyArray(value.rightBranch)));
}
function hasMesoSplitContent(value) {
    return Boolean(value && (hasNonEmptyArray(value.classes) || hasNonEmptyArray(value.pipelines)));
}
function hasMicroSplitContent(value) {
    if (!value || !Array.isArray(value.classes) || value.classes.length === 0) {
        return false;
    }
    return value.classes.some((item) => hasNonEmptyArray(item?.staticRightBranch) ||
        hasNonEmptyArray(item?.dynamicLeftBranch) ||
        hasNonEmptyArray(item?.properties) ||
        hasNonEmptyArray(item?.methods));
}
function hasNonEmptyArray(value) {
    return Array.isArray(value) && value.length > 0;
}
function hasNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function normalizeDemandText(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function getTriadizationState(sessionValue, reportValue) {
    return (0, triadizationStateSupport_1.resolveTriadizationFocusState)({
        session: sessionValue,
        report: reportValue
    });
}
//# sourceMappingURL=stage.js.map