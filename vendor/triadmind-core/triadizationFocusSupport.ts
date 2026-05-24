import { TriadizationFocusReference, TriadizationRecommendedOperation } from './protocolRightBranch';
import {
    readTriadizationConfirmation,
    readTriadizationSession
} from './triadizationSessionStore';
import { WorkspacePaths } from './workspace';

export type TriadizationFocusReferenceLike = {
    triadizationFocus?: unknown;
    recommendedOperation?: unknown;
};

export type NormalizedTriadizationFocusReference = {
    source: string;
    triadizationFocus: string;
    recommendedOperation: string;
};

export type TriadizationFocusSeed = {
    triadizationFocus: string;
    recommendedOperation: string;
};

const PREFERRED_TRIADIZATION_FOCUS_SOURCE_ORDER = [
    'draft-protocol.json microSplit',
    'micro-split.json',
    'draft-protocol.json macroSplit',
    'draft-protocol.json mesoSplit',
    'macroSplit',
    'mesoSplit',
    'microSplit'
] as const;

export function normalizeTriadizationRecommendedOperation(value: unknown): TriadizationRecommendedOperation | undefined {
    switch (String(value ?? '').trim().toLowerCase()) {
        case 'aggregate':
        case 'split':
        case 'renormalize':
            return String(value).trim().toLowerCase() as TriadizationRecommendedOperation;
        default:
            return undefined;
    }
}

export function normalizeTriadizationFocusReference(reference: {
    triadizationFocus: unknown;
    recommendedOperation: unknown;
}) {
    return {
        triadizationFocus: String(reference.triadizationFocus ?? '').trim(),
        recommendedOperation: String(reference.recommendedOperation ?? '').trim().toLowerCase()
    };
}

export function createTriadizationFocusSeed(
    focus?: Partial<{
        triadizationFocus: unknown;
        recommendedOperation: unknown;
    }>
): TriadizationFocusSeed {
    const normalized = normalizeTriadizationFocusReference({
        triadizationFocus: focus?.triadizationFocus,
        recommendedOperation: focus?.recommendedOperation
    });

    return {
        triadizationFocus: normalized.triadizationFocus,
        recommendedOperation: normalized.recommendedOperation
    };
}

export function collectTriadizationFocusReference(
    source: string,
    reference: TriadizationFocusReferenceLike | undefined,
    focusReferences: NormalizedTriadizationFocusReference[],
    violations: string[]
) {
    if (!reference || typeof reference !== 'object') {
        return;
    }

    const normalizedReference = normalizeTriadizationFocusReference({
        triadizationFocus: reference.triadizationFocus,
        recommendedOperation: reference.recommendedOperation
    });
    const { triadizationFocus, recommendedOperation } = normalizedReference;
    const hasOtherStructure = Object.entries(reference as Record<string, unknown>).some(([key, value]) => {
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

export function resolvePrimaryTriadizationFocusReference(
    focusReferences: NormalizedTriadizationFocusReference[]
) {
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

export function resolveExpectedTriadizationFocus(
    paths: WorkspacePaths
): TriadizationFocusReference | undefined {
    const confirmation = readTriadizationConfirmation(paths);
    if (confirmation) {
        return {
            triadizationFocus: confirmation.targetNodeId,
            recommendedOperation: confirmation.recommendedOperation
        };
    }

    const session = readTriadizationSession(paths);
    if (session?.status === 'confirmed') {
        return {
            triadizationFocus: session.triadizationFocus,
            recommendedOperation: session.recommendedOperation
        };
    }

    return undefined;
}
