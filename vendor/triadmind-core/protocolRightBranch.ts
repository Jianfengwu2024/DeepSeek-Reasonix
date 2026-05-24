import { z } from 'zod';
import {
    createMacroSplitSchema,
    createMesoClassBlueprintSchema,
    createMesoPipelineSchema,
    createMesoSplitSchema,
    createMicroClassBlueprintSchema,
    createMicroMethodBlueprintSchema,
    createMicroPropertyBlueprintSchema,
    createMicroSplitSchema
} from './triadizationSplitBlueprintSupport';
import type {
    MacroSplitBlueprint,
    MesoClassBlueprint,
    MesoPipeline,
    MesoSplitBlueprint,
    MicroClassBlueprint,
    MicroMethodBlueprint,
    MicroPropertyBlueprint,
    MicroSplitBlueprint
} from './triadizationSplitBlueprintSupport';

export type TriadCategory = string;
export type TriadOp = 'reuse' | 'modify' | 'create_child';
export type TriadizationRecommendedOperation = 'aggregate' | 'split' | 'renormalize';
export type TriadLifecycle = 'existing' | 'proposed';

export interface TriadGhostReadEvidence {
    raw?: string;
    mode?: string;
    target?: string;
    valueType?: string;
    retainedInDemand?: boolean;
    score?: number;
    [key: string]: unknown;
}

export interface TriadAbstractionEvidence {
    role?: string;
    signals?: string[];
    implements?: string[];
    extendsAbstract?: string[];
    dependsOnAbstractions?: string[];
    abstractFunctions?: string[];
    peerConcreteCalls?: string[];
    variantCluster?: string;
    abstractionSignalCount?: number;
    functionContractCount?: number;
    concreteSignalCount?: number;
    interfaceCount?: number;
    abstractClassCount?: number;
    typeAliasCount?: number;
    concreteClassCount?: number;
    publicMethodCount?: number;
    topLevelExecutableCount?: number;
    [key: string]: unknown;
}

export interface TriadNodeEvidence {
    ghostReads?: TriadGhostReadEvidence[];
    promotionReasons?: string[];
    abstraction?: TriadAbstractionEvidence;
    [key: string]: unknown;
}

export interface TriadFission {
    problem: string;
    demand: string[];
    answer: string[];
    evidence?: TriadNodeEvidence;
}

export interface TriadNodeDefinition {
    nodeId: string;
    category?: string;
    sourcePath?: string;
    lifecycle?: TriadLifecycle;
    fission: TriadFission;
}

export interface TriadizationFocusReference {
    triadizationFocus: string;
    recommendedOperation: TriadizationRecommendedOperation;
}

export type { MesoClassBlueprint, MesoPipeline, MicroPropertyBlueprint, MicroMethodBlueprint, MicroClassBlueprint };

export type MacroSplit = TriadizationFocusReference & MacroSplitBlueprint;
export type MesoSplit = TriadizationFocusReference & MesoSplitBlueprint;
export type MicroSplit = TriadizationFocusReference & MicroSplitBlueprint;

export interface ReuseAction {
    op: 'reuse';
    nodeId: string;
    reason?: string;
    confidence?: number;
}

export interface ModifyAction {
    op: 'modify';
    nodeId: string;
    category?: string;
    sourcePath?: string;
    fission: TriadFission;
    reason?: string;
    reuse?: string[];
    confidence?: number;
}

export interface CreateChildAction {
    op: 'create_child';
    parentNodeId: string;
    node: TriadNodeDefinition;
    reason?: string;
    reuse?: string[];
    confidence?: number;
}

export type TriadAction = ReuseAction | ModifyAction | CreateChildAction;

export interface UpgradeProtocol {
    protocolVersion?: string;
    project?: string;
    mapSource?: string;
    userDemand?: string;
    upgradePolicy?: {
        allowedOps?: TriadOp[];
        principle?: string;
    };
    macroSplit?: MacroSplit;
    mesoSplit?: MesoSplit;
    microSplit?: MicroSplit;
    impactedNodes?: unknown[];
    actions: TriadAction[];
    resultTopology?: TriadNodeDefinition[];
}

export interface ParsedNodeRef {
    rawNodeId: string;
    normalizedNodeId: string;
    category: TriadCategory;
    className: string;
    methodName: string;
}

export interface ParsedDemand {
    type: string;
    name: string;
}

export interface ProtocolValidationContext {
    existingNodes?: TriadNodeDefinition[];
    minConfidence?: number;
    requireConfidence?: boolean;
    expectedTriadizationFocus?: TriadizationFocusReference;
}

export const PREFIX_CATEGORY_MAP: Record<string, TriadCategory> = {
    core: 'core'
};

const nonEmptyStringSchema = z.string().trim().min(1);
const triadCategorySchema = nonEmptyStringSchema;
const triadOpSchema = z.enum(['reuse', 'modify', 'create_child']);
const triadizationRecommendedOperationSchema = z.enum(['aggregate', 'split', 'renormalize']);

export const triadGhostReadEvidenceSchema = z
    .object({
        raw: z.string().optional(),
        mode: z.string().optional(),
        target: z.string().optional(),
        valueType: z.string().optional(),
        retainedInDemand: z.boolean().optional(),
        score: z.number().finite().optional()
    })
    .passthrough();

export const triadAbstractionEvidenceSchema = z
    .object({
        role: z.string().optional(),
        signals: z.array(nonEmptyStringSchema).optional(),
        implements: z.array(nonEmptyStringSchema).optional(),
        extendsAbstract: z.array(nonEmptyStringSchema).optional(),
        dependsOnAbstractions: z.array(nonEmptyStringSchema).optional(),
        peerConcreteCalls: z.array(nonEmptyStringSchema).optional(),
        variantCluster: z.string().optional(),
        abstractionSignalCount: z.number().int().nonnegative().optional(),
        concreteSignalCount: z.number().int().nonnegative().optional(),
        interfaceCount: z.number().int().nonnegative().optional(),
        abstractClassCount: z.number().int().nonnegative().optional(),
        typeAliasCount: z.number().int().nonnegative().optional(),
        concreteClassCount: z.number().int().nonnegative().optional(),
        publicMethodCount: z.number().int().nonnegative().optional(),
        topLevelExecutableCount: z.number().int().nonnegative().optional()
    })
    .passthrough();

export const triadNodeEvidenceSchema = z
    .object({
        ghostReads: z.array(triadGhostReadEvidenceSchema).optional(),
        promotionReasons: z.array(nonEmptyStringSchema).optional(),
        abstraction: triadAbstractionEvidenceSchema.optional()
    })
    .passthrough();

export const triadFissionSchema = z.object({
    problem: nonEmptyStringSchema,
    demand: z.array(nonEmptyStringSchema),
    answer: z.array(nonEmptyStringSchema),
    evidence: triadNodeEvidenceSchema.optional()
}).passthrough();

export const triadNodeDefinitionSchema = z.object({
    nodeId: nonEmptyStringSchema,
    category: triadCategorySchema.optional(),
    sourcePath: nonEmptyStringSchema.optional(),
    lifecycle: z.enum(['existing', 'proposed']).optional(),
    fission: triadFissionSchema
}).passthrough();

export const triadizationFocusReferenceSchema = z.object({
    triadizationFocus: nonEmptyStringSchema,
    recommendedOperation: triadizationRecommendedOperationSchema
});

export const macroSplitSchema = createMacroSplitSchema(triadizationFocusReferenceSchema, nonEmptyStringSchema);

export const mesoClassBlueprintSchema = createMesoClassBlueprintSchema(nonEmptyStringSchema);

export const mesoPipelineSchema = createMesoPipelineSchema(nonEmptyStringSchema);

export const mesoSplitSchema = createMesoSplitSchema(
    triadizationFocusReferenceSchema,
    mesoClassBlueprintSchema,
    mesoPipelineSchema
);

export const microPropertyBlueprintSchema = createMicroPropertyBlueprintSchema(nonEmptyStringSchema);

export const microMethodBlueprintSchema = createMicroMethodBlueprintSchema(nonEmptyStringSchema);

export const microClassBlueprintSchema = createMicroClassBlueprintSchema(
    nonEmptyStringSchema,
    microPropertyBlueprintSchema,
    microMethodBlueprintSchema
);

export const microSplitSchema = createMicroSplitSchema(triadizationFocusReferenceSchema, microClassBlueprintSchema);

export const reuseActionSchema = z.object({
    op: z.literal('reuse'),
    nodeId: nonEmptyStringSchema,
    reason: z.string().optional(),
    confidence: z.number().min(0).max(1).optional()
});

export const modifyActionSchema = z.object({
    op: z.literal('modify'),
    nodeId: nonEmptyStringSchema,
    category: triadCategorySchema.optional(),
    sourcePath: nonEmptyStringSchema.optional(),
    fission: triadFissionSchema,
    reason: z.string().optional(),
    reuse: z.array(nonEmptyStringSchema).optional(),
    confidence: z.number().min(0).max(1).optional()
});

export const createChildActionSchema = z.object({
    op: z.literal('create_child'),
    parentNodeId: nonEmptyStringSchema,
    node: triadNodeDefinitionSchema,
    reason: z.string().optional(),
    reuse: z.array(nonEmptyStringSchema).optional(),
    confidence: z.number().min(0).max(1).optional()
});

export const triadActionSchema = z.discriminatedUnion('op', [
    reuseActionSchema,
    modifyActionSchema,
    createChildActionSchema
]);

export const upgradeProtocolSchema = z.object({
    protocolVersion: z.string().optional(),
    project: z.string().optional(),
    mapSource: z.string().optional(),
    userDemand: z.string().optional(),
    upgradePolicy: z
        .object({
            allowedOps: z.array(triadOpSchema).optional(),
            principle: z.string().optional()
        })
        .optional(),
    macroSplit: macroSplitSchema.optional(),
    mesoSplit: mesoSplitSchema.optional(),
    microSplit: microSplitSchema.optional(),
    impactedNodes: z.array(z.unknown()).optional(),
    actions: z.array(triadActionSchema).min(1, 'actions must contain at least one reuse/modify/create_child operation'),
    resultTopology: z.array(triadNodeDefinitionSchema).optional()
});

/**
 * @RightBranch
 */
export function getPrefixCategoryMap() {
    return PREFIX_CATEGORY_MAP;
}

/**
 * @RightBranch
 */
export function getUpgradeProtocolSchema() {
    return upgradeProtocolSchema;
}

/**
 * @RightBranch
 */
export function getTriadNodeDefinitionSchema() {
    return triadNodeDefinitionSchema;
}
