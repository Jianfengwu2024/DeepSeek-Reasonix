import {
    collectTriadizationFocusReference,
    resolvePrimaryTriadizationFocusReference
} from './triadizationFocusSupport';
import type {
    NormalizedTriadizationFocusReference,
    TriadizationFocusReferenceLike
} from './triadizationFocusSupport';
import type {
    MicroClassArtifactLike,
    MicroSplitArtifactLike
} from './triadizationSplitBlueprintSupport';

export {
    normalizeTriadizationFocusReference,
    resolveExpectedTriadizationFocus
} from './triadizationFocusSupport';
export type {
    NormalizedTriadizationFocusReference,
    TriadizationFocusReferenceLike
} from './triadizationFocusSupport';

export type TriadizationFocusGateFailureKind = 'protocol_focus_alignment' | 'triad_focus_closure' | 'mixed';

export interface TriadizationFocusGateReport {
    status: 'pass' | 'fail' | 'skip';
    failureKind?: TriadizationFocusGateFailureKind;
    canonicalFocus?: string;
    recommendedOperation?: string;
    summary: string;
    repairTarget?: string;
    details: string[];
    alignmentViolations: string[];
    closureViolations: string[];
}

export type MicroClassLike = MicroClassArtifactLike;

export type MicroSplitLike = MicroSplitArtifactLike<TriadizationFocusReferenceLike>;

export type DraftProtocolLike = {
    macroSplit?: TriadizationFocusReferenceLike;
    mesoSplit?: TriadizationFocusReferenceLike;
    microSplit?: MicroSplitLike;
};

export type TriadizationFocusAlignmentAnalysis = {
    artifactsInspected: string[];
    focusReferences: NormalizedTriadizationFocusReference[];
    alignmentViolations: string[];
};

export type TriadizationFocusClosureAnalysis = {
    focusReference?: NormalizedTriadizationFocusReference;
    closureViolations: string[];
};

export interface TriadizationFocusGateArtifactsAnalysis {
    draftProtocol?: DraftProtocolLike;
    microSplit?: MicroSplitLike;
    alignment: TriadizationFocusAlignmentAnalysis;
    closure: TriadizationFocusClosureAnalysis;
    canonicalReference?: NormalizedTriadizationFocusReference;
    failureKind?: TriadizationFocusGateFailureKind;
}

type ParsedFocusTarget = {
    raw: string;
    owner: string;
    method?: string;
    sourcePath?: string;
};

export function analyzeTriadizationFocusGateArtifacts(
    draftProtocol: unknown,
    microSplit: unknown
): TriadizationFocusGateArtifactsAnalysis {
    const normalizedDraftProtocol =
        draftProtocol && typeof draftProtocol === 'object' ? (draftProtocol as DraftProtocolLike) : undefined;
    const normalizedMicroSplit =
        microSplit && typeof microSplit === 'object' ? (microSplit as MicroSplitLike) : undefined;
    const alignment = analyzeTriadizationFocusAlignment(normalizedDraftProtocol, normalizedMicroSplit);
    const closure = analyzeTriadFocusClosure(
        normalizedDraftProtocol,
        normalizedMicroSplit,
        alignment.focusReferences
    );
    const canonicalReference = closure.focusReference ?? resolvePrimaryTriadizationFocusReference(alignment.focusReferences);

    return {
        draftProtocol: normalizedDraftProtocol,
        microSplit: normalizedMicroSplit,
        alignment,
        closure,
        canonicalReference,
        failureKind: resolveFocusGateFailureKind(
            alignment.alignmentViolations.length,
            closure.closureViolations.length
        )
    };
}

export function evaluateTriadizationFocusGateArtifacts(
    draftProtocol: unknown,
    microSplit: unknown
): TriadizationFocusGateReport {
    const analysis = analyzeTriadizationFocusGateArtifacts(draftProtocol, microSplit);
    const alignmentViolations = analysis.alignment.alignmentViolations;
    const closureViolations = analysis.closure.closureViolations;
    const canonicalReference = analysis.canonicalReference;
    const failureKind = analysis.failureKind;
    const canonicalFocus = canonicalReference?.triadizationFocus;
    const recommendedOperation = canonicalReference?.recommendedOperation;

    if (!canonicalReference && analysis.alignment.artifactsInspected.length === 0) {
        return {
            status: 'skip',
            summary: 'No triadization focus artifacts were found.',
            details: [],
            alignmentViolations,
            closureViolations
        };
    }

    if (!failureKind) {
        return {
            status: canonicalReference ? 'pass' : 'skip',
            canonicalFocus,
            recommendedOperation,
            summary: canonicalReference
                ? `Triadization focus aligned and closed: ${canonicalReference.triadizationFocus} -> ${canonicalReference.recommendedOperation}`
                : 'No canonical triadization focus was resolved, but no explicit focus drift was detected.',
            repairTarget: canonicalReference
                ? `${canonicalReference.triadizationFocus} -> ${canonicalReference.recommendedOperation}`
                : undefined,
            details: canonicalReference
                ? [`canonicalFocus: ${canonicalReference.triadizationFocus} -> ${canonicalReference.recommendedOperation}`]
                : [],
            alignmentViolations,
            closureViolations
        };
    }

    return {
        status: 'fail',
        failureKind,
        canonicalFocus,
        recommendedOperation,
        summary: buildTriadizationFocusGateSummary(failureKind, canonicalReference),
        repairTarget: buildTriadizationFocusGateRepairTarget(failureKind, canonicalReference),
        details: dedupeStrings([...alignmentViolations, ...closureViolations]),
        alignmentViolations,
        closureViolations
    };
}

export function analyzeTriadizationFocusAlignment(
    draftProtocol: DraftProtocolLike | undefined,
    microSplit: MicroSplitLike | undefined
): TriadizationFocusAlignmentAnalysis {
    const artifactsInspected: string[] = [];
    const focusReferences: NormalizedTriadizationFocusReference[] = [];
    const alignmentViolations: string[] = [];

    if (draftProtocol) {
        artifactsInspected.push('draft-protocol.json');
        collectTriadizationFocusReference('draft-protocol.json macroSplit', draftProtocol.macroSplit, focusReferences, alignmentViolations);
        collectTriadizationFocusReference('draft-protocol.json mesoSplit', draftProtocol.mesoSplit, focusReferences, alignmentViolations);
        collectTriadizationFocusReference('draft-protocol.json microSplit', draftProtocol.microSplit, focusReferences, alignmentViolations);
    }

    if (microSplit) {
        artifactsInspected.push('micro-split.json');
        collectTriadizationFocusReference('micro-split.json', microSplit, focusReferences, alignmentViolations);
    }

    const canonicalReference = resolvePrimaryTriadizationFocusReference(focusReferences);
    if (!canonicalReference) {
        return {
            artifactsInspected,
            focusReferences,
            alignmentViolations: dedupeStrings(alignmentViolations)
        };
    }

    for (const reference of focusReferences) {
        if (
            reference.triadizationFocus !== canonicalReference.triadizationFocus ||
            reference.recommendedOperation !== canonicalReference.recommendedOperation
        ) {
            alignmentViolations.push(
                `${reference.source} drifts from ${canonicalReference.source}: ${reference.triadizationFocus} -> ${reference.recommendedOperation}`
            );
        }
    }

    return {
        artifactsInspected,
        focusReferences,
        alignmentViolations: dedupeStrings(alignmentViolations)
    };
}

export function analyzeTriadFocusClosure(
    draftProtocol: DraftProtocolLike | undefined,
    microSplit: MicroSplitLike | undefined,
    focusReferences: NormalizedTriadizationFocusReference[]
): TriadizationFocusClosureAnalysis {
    const focusReference = resolvePrimaryTriadizationFocusReference(focusReferences);
    if (!focusReference) {
        return {
            closureViolations: []
        };
    }

    const focusTarget = parseFocusTarget(focusReference.triadizationFocus);
    if (!focusTarget) {
        return {
            focusReference,
            closureViolations: [`Unable to parse triadization focus ${focusReference.triadizationFocus}`]
        };
    }

    const closureViolations: string[] = [];
    closureViolations.push(
        ...evaluateFocusedClassClosure('micro-split.json', readMicroClasses(microSplit?.classes), focusTarget)
    );

    if (draftProtocol?.microSplit) {
        closureViolations.push(
            ...evaluateFocusedClassClosure(
                'draft-protocol.json microSplit',
                readMicroClasses(draftProtocol.microSplit.classes),
                focusTarget
            )
        );
    }

    return {
        focusReference,
        closureViolations: dedupeStrings(closureViolations)
    };
}

function resolveFocusGateFailureKind(
    alignmentViolationCount: number,
    closureViolationCount: number
) {
    if (alignmentViolationCount > 0 && closureViolationCount > 0) {
        return 'mixed' as const;
    }
    if (alignmentViolationCount > 0) {
        return 'protocol_focus_alignment' as const;
    }
    if (closureViolationCount > 0) {
        return 'triad_focus_closure' as const;
    }
    return undefined;
}

function buildTriadizationFocusGateSummary(
    failureKind: TriadizationFocusGateFailureKind,
    focusReference: NormalizedTriadizationFocusReference | undefined
) {
    if (failureKind === 'protocol_focus_alignment') {
        return focusReference
            ? `Focus drift detected: draft-protocol.json and micro-split.json should align to ${focusReference.triadizationFocus} -> ${focusReference.recommendedOperation}.`
            : 'Focus drift detected: draft-protocol.json and micro-split.json do not share the same triadization focus.';
    }

    if (failureKind === 'triad_focus_closure') {
        return focusReference
            ? `Focus closure is incomplete: ${focusReference.triadizationFocus} is not yet closed inside one class-level triad.`
            : 'Focus closure is incomplete: the current triadization focus has not yet closed inside one class-level triad.';
    }

    return focusReference
        ? `Focus drift and closure gaps coexist. Align every artifact to ${focusReference.triadizationFocus} -> ${focusReference.recommendedOperation}, then close the class-level triad around that focus.`
        : 'Focus drift and closure gaps coexist. Align the triadization focus first, then close the class-level triad around it.';
}

function buildTriadizationFocusGateRepairTarget(
    failureKind: TriadizationFocusGateFailureKind,
    focusReference: NormalizedTriadizationFocusReference | undefined
) {
    if (!focusReference) {
        return failureKind === 'protocol_focus_alignment'
            ? 'align triadizationFocus / recommendedOperation'
            : undefined;
    }

    if (failureKind === 'protocol_focus_alignment') {
        return `${focusReference.triadizationFocus} -> ${focusReference.recommendedOperation}`;
    }

    const focusTarget = parseFocusTarget(focusReference.triadizationFocus);
    if (!focusTarget) {
        return `${focusReference.triadizationFocus} -> ${focusReference.recommendedOperation}`;
    }

    if (!focusTarget.method) {
        return `${focusTarget.raw} (class ${focusTarget.owner})`;
    }

    return `${focusTarget.raw} (class ${focusTarget.owner}, method ${focusTarget.method})`;
}

function parseFocusTarget(triadizationFocus: string): ParsedFocusTarget | undefined {
    const raw = String(triadizationFocus ?? '').trim();
    if (!raw) {
        return undefined;
    }

    const atIndex = raw.indexOf('@');
    const nodePart = atIndex >= 0 ? raw.slice(0, atIndex).trim() : raw;
    const sourcePath = atIndex >= 0 ? raw.slice(atIndex + 1).trim() : undefined;
    const parts = nodePart.split('.').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
        return undefined;
    }

    if (parts.length === 1) {
        return {
            raw,
            owner: parts[0],
            sourcePath
        };
    }

    return {
        raw,
        owner: parts[parts.length - 2],
        method: parts[parts.length - 1],
        sourcePath
    };
}

function evaluateFocusedClassClosure(
    label: string,
    classes: MicroClassLike[],
    focusTarget: ParsedFocusTarget
) {
    if (classes.length === 0) {
        return [`${label} has no classes for focus ${focusTarget.raw}`];
    }

    const blueprint = classes.find(
        (candidate) => String(candidate?.className ?? '').trim() === focusTarget.owner
    );
    if (!blueprint) {
        return [`${label} is missing focused class ${focusTarget.owner}`];
    }

    const closureViolations: string[] = [];
    const staticRightBranch = readBranchArray(blueprint.staticRightBranch, blueprint.properties);
    const dynamicLeftBranch = readBranchArray(blueprint.dynamicLeftBranch, blueprint.methods);

    if (staticRightBranch.length === 0) {
        closureViolations.push(`${label} class ${focusTarget.owner} has no staticRightBranch`);
    }
    if (dynamicLeftBranch.length === 0) {
        closureViolations.push(`${label} class ${focusTarget.owner} has no dynamicLeftBranch`);
    }

    if (focusTarget.method) {
        const hasFocusedMethod = dynamicLeftBranch.some(
            (entry) => String((entry as { name?: unknown })?.name ?? '').trim() === focusTarget.method
        );
        if (!hasFocusedMethod) {
            closureViolations.push(`${label} class ${focusTarget.owner} is missing focus method ${focusTarget.method}`);
        }
    }

    return closureViolations;
}

function readMicroClasses(classes: unknown[] | undefined) {
    return Array.isArray(classes) ? (classes as MicroClassLike[]) : [];
}

function readBranchArray(primary: unknown[] | undefined, fallback: unknown[] | undefined) {
    if (Array.isArray(primary)) {
        return primary;
    }
    return Array.isArray(fallback) ? fallback : [];
}

function dedupeStrings(values: string[]) {
    return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}
