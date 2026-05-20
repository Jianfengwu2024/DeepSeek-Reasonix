"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTriadizationRecommendedOperation = normalizeTriadizationRecommendedOperation;
exports.normalizeTriadizationFocusReference = normalizeTriadizationFocusReference;
exports.createTriadizationFocusSeed = createTriadizationFocusSeed;
exports.collectTriadizationFocusReference = collectTriadizationFocusReference;
exports.resolvePrimaryTriadizationFocusReference = resolvePrimaryTriadizationFocusReference;
exports.resolveExpectedTriadizationFocus = resolveExpectedTriadizationFocus;
const triadizationSessionStore_1 = require("./triadizationSessionStore");
const PREFERRED_TRIADIZATION_FOCUS_SOURCE_ORDER = [
    'draft-protocol.json microSplit',
    'micro-split.json',
    'draft-protocol.json macroSplit',
    'draft-protocol.json mesoSplit',
    'macroSplit',
    'mesoSplit',
    'microSplit'
];
function normalizeTriadizationRecommendedOperation(value) {
    switch (String(value ?? '').trim().toLowerCase()) {
        case 'aggregate':
        case 'split':
        case 'renormalize':
            return String(value).trim().toLowerCase();
        default:
            return undefined;
    }
}
function normalizeTriadizationFocusReference(reference) {
    return {
        triadizationFocus: String(reference.triadizationFocus ?? '').trim(),
        recommendedOperation: String(reference.recommendedOperation ?? '').trim().toLowerCase()
    };
}
function createTriadizationFocusSeed(focus) {
    const normalized = normalizeTriadizationFocusReference({
        triadizationFocus: focus?.triadizationFocus,
        recommendedOperation: focus?.recommendedOperation
    });
    return {
        triadizationFocus: normalized.triadizationFocus,
        recommendedOperation: normalized.recommendedOperation
    };
}
function collectTriadizationFocusReference(source, reference, focusReferences, violations) {
    if (!reference || typeof reference !== 'object') {
        return;
    }
    const normalizedReference = normalizeTriadizationFocusReference({
        triadizationFocus: reference.triadizationFocus,
        recommendedOperation: reference.recommendedOperation
    });
    const { triadizationFocus, recommendedOperation } = normalizedReference;
    const hasOtherStructure = Object.entries(reference).some(([key, value]) => {
        if (key === 'triadizationFocus' || key === 'recommendedOperation') {
            return false;
        }
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        if (typeof value === 'string') {
            return value.trim().length > 0;
        }
        return value !== undefined && value !== null;
    });
    if (!triadizationFocus && !recommendedOperation) {
        if (hasOtherStructure) {
            violations.push(`${source} is missing triadizationFocus and recommendedOperation`);
        }
        return;
    }
    if (!triadizationFocus || !recommendedOperation) {
        violations.push(`${source} is missing triadizationFocus or recommendedOperation`);
        return;
    }
    focusReferences.push({
        source,
        triadizationFocus,
        recommendedOperation
    });
}
function resolvePrimaryTriadizationFocusReference(focusReferences) {
    if (focusReferences.length === 0) {
        return undefined;
    }
    for (const source of PREFERRED_TRIADIZATION_FOCUS_SOURCE_ORDER) {
        const match = focusReferences.find((reference) => reference.source === source);
        if (match) {
            return match;
        }
    }
    return focusReferences[0];
}
function resolveExpectedTriadizationFocus(paths) {
    const confirmation = (0, triadizationSessionStore_1.readTriadizationConfirmation)(paths);
    if (confirmation) {
        return {
            triadizationFocus: confirmation.targetNodeId,
            recommendedOperation: confirmation.recommendedOperation
        };
    }
    const session = (0, triadizationSessionStore_1.readTriadizationSession)(paths);
    if (session?.status === 'confirmed') {
        return {
            triadizationFocus: session.triadizationFocus,
            recommendedOperation: session.recommendedOperation
        };
    }
    return undefined;
}
//# sourceMappingURL=triadizationFocusSupport.js.map