import { z } from 'zod';
import type { MacroSplitBlueprint, MesoClassBlueprint, MesoPipeline, MesoSplitBlueprint, MicroClassBlueprint, MicroMethodBlueprint, MicroPropertyBlueprint, MicroSplitBlueprint } from './triadizationSplitBlueprintSupport';
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
export declare const PREFIX_CATEGORY_MAP: Record<string, TriadCategory>;
export declare const triadGhostReadEvidenceSchema: z.ZodObject<{
    raw: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodString>;
    target: z.ZodOptional<z.ZodString>;
    valueType: z.ZodOptional<z.ZodString>;
    retainedInDemand: z.ZodOptional<z.ZodBoolean>;
    score: z.ZodOptional<z.ZodNumber>;
}, z.core.$loose>;
export declare const triadAbstractionEvidenceSchema: z.ZodObject<{
    role: z.ZodOptional<z.ZodString>;
    signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
    implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
    extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
    dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
    variantCluster: z.ZodOptional<z.ZodString>;
    abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
    concreteSignalCount: z.ZodOptional<z.ZodNumber>;
    interfaceCount: z.ZodOptional<z.ZodNumber>;
    abstractClassCount: z.ZodOptional<z.ZodNumber>;
    typeAliasCount: z.ZodOptional<z.ZodNumber>;
    concreteClassCount: z.ZodOptional<z.ZodNumber>;
    publicMethodCount: z.ZodOptional<z.ZodNumber>;
    topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
}, z.core.$loose>;
export declare const triadNodeEvidenceSchema: z.ZodObject<{
    ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
        raw: z.ZodOptional<z.ZodString>;
        mode: z.ZodOptional<z.ZodString>;
        target: z.ZodOptional<z.ZodString>;
        valueType: z.ZodOptional<z.ZodString>;
        retainedInDemand: z.ZodOptional<z.ZodBoolean>;
        score: z.ZodOptional<z.ZodNumber>;
    }, z.core.$loose>>>;
    promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
    abstraction: z.ZodOptional<z.ZodObject<{
        role: z.ZodOptional<z.ZodString>;
        signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
        implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
        extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
        dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
        variantCluster: z.ZodOptional<z.ZodString>;
        abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
        concreteSignalCount: z.ZodOptional<z.ZodNumber>;
        interfaceCount: z.ZodOptional<z.ZodNumber>;
        abstractClassCount: z.ZodOptional<z.ZodNumber>;
        typeAliasCount: z.ZodOptional<z.ZodNumber>;
        concreteClassCount: z.ZodOptional<z.ZodNumber>;
        publicMethodCount: z.ZodOptional<z.ZodNumber>;
        topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
    }, z.core.$loose>>;
}, z.core.$loose>;
export declare const triadFissionSchema: z.ZodObject<{
    problem: z.ZodString;
    demand: z.ZodArray<z.ZodString>;
    answer: z.ZodArray<z.ZodString>;
    evidence: z.ZodOptional<z.ZodObject<{
        ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
            raw: z.ZodOptional<z.ZodString>;
            mode: z.ZodOptional<z.ZodString>;
            target: z.ZodOptional<z.ZodString>;
            valueType: z.ZodOptional<z.ZodString>;
            retainedInDemand: z.ZodOptional<z.ZodBoolean>;
            score: z.ZodOptional<z.ZodNumber>;
        }, z.core.$loose>>>;
        promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
        abstraction: z.ZodOptional<z.ZodObject<{
            role: z.ZodOptional<z.ZodString>;
            signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
            implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
            extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
            dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
            variantCluster: z.ZodOptional<z.ZodString>;
            abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
            concreteSignalCount: z.ZodOptional<z.ZodNumber>;
            interfaceCount: z.ZodOptional<z.ZodNumber>;
            abstractClassCount: z.ZodOptional<z.ZodNumber>;
            typeAliasCount: z.ZodOptional<z.ZodNumber>;
            concreteClassCount: z.ZodOptional<z.ZodNumber>;
            publicMethodCount: z.ZodOptional<z.ZodNumber>;
            topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
        }, z.core.$loose>>;
    }, z.core.$loose>>;
}, z.core.$loose>;
export declare const triadNodeDefinitionSchema: z.ZodObject<{
    nodeId: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
    lifecycle: z.ZodOptional<z.ZodEnum<{
        existing: "existing";
        proposed: "proposed";
    }>>;
    fission: z.ZodObject<{
        problem: z.ZodString;
        demand: z.ZodArray<z.ZodString>;
        answer: z.ZodArray<z.ZodString>;
        evidence: z.ZodOptional<z.ZodObject<{
            ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                raw: z.ZodOptional<z.ZodString>;
                mode: z.ZodOptional<z.ZodString>;
                target: z.ZodOptional<z.ZodString>;
                valueType: z.ZodOptional<z.ZodString>;
                retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                score: z.ZodOptional<z.ZodNumber>;
            }, z.core.$loose>>>;
            promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
            abstraction: z.ZodOptional<z.ZodObject<{
                role: z.ZodOptional<z.ZodString>;
                signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                variantCluster: z.ZodOptional<z.ZodString>;
                abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                interfaceCount: z.ZodOptional<z.ZodNumber>;
                abstractClassCount: z.ZodOptional<z.ZodNumber>;
                typeAliasCount: z.ZodOptional<z.ZodNumber>;
                concreteClassCount: z.ZodOptional<z.ZodNumber>;
                publicMethodCount: z.ZodOptional<z.ZodNumber>;
                topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
            }, z.core.$loose>>;
        }, z.core.$loose>>;
    }, z.core.$loose>;
}, z.core.$loose>;
export declare const triadizationFocusReferenceSchema: z.ZodObject<{
    triadizationFocus: z.ZodString;
    recommendedOperation: z.ZodEnum<{
        aggregate: "aggregate";
        split: "split";
        renormalize: "renormalize";
    }>;
}, z.core.$strip>;
export declare const macroSplitSchema: z.ZodObject<{
    triadizationFocus: z.ZodString;
    recommendedOperation: z.ZodEnum<{
        aggregate: "aggregate";
        split: "split";
        renormalize: "renormalize";
    }>;
    anchorNodeId: z.ZodString;
    vertexGoal: z.ZodString;
    leftBranch: z.ZodArray<z.ZodString>;
    rightBranch: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const mesoClassBlueprintSchema: z.ZodObject<{
    className: z.ZodString;
    category: z.ZodString;
    responsibility: z.ZodString;
    upstreams: z.ZodArray<z.ZodString>;
    downstreams: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const mesoPipelineSchema: z.ZodObject<{
    pipelineId: z.ZodString;
    purpose: z.ZodString;
    steps: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const mesoSplitSchema: z.ZodObject<{
    triadizationFocus: z.ZodString;
    recommendedOperation: z.ZodEnum<{
        aggregate: "aggregate";
        split: "split";
        renormalize: "renormalize";
    }>;
    classes: z.ZodArray<z.ZodType<MesoClassBlueprint, unknown, z.core.$ZodTypeInternals<MesoClassBlueprint, unknown>>>;
    pipelines: z.ZodArray<z.ZodType<MesoPipeline, unknown, z.core.$ZodTypeInternals<MesoPipeline, unknown>>>;
}, z.core.$strip>;
export declare const microPropertyBlueprintSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    role: z.ZodString;
}, z.core.$strip>;
export declare const microMethodBlueprintSchema: z.ZodObject<{
    name: z.ZodString;
    demand: z.ZodArray<z.ZodString>;
    answer: z.ZodArray<z.ZodString>;
    responsibility: z.ZodString;
}, z.core.$strip>;
export declare const microClassBlueprintSchema: z.ZodObject<{
    className: z.ZodString;
    staticRightBranch: z.ZodArray<z.ZodType<MicroPropertyBlueprint, unknown, z.core.$ZodTypeInternals<MicroPropertyBlueprint, unknown>>>;
    dynamicLeftBranch: z.ZodArray<z.ZodType<MicroMethodBlueprint, unknown, z.core.$ZodTypeInternals<MicroMethodBlueprint, unknown>>>;
}, z.core.$strip>;
export declare const microSplitSchema: z.ZodObject<{
    triadizationFocus: z.ZodString;
    recommendedOperation: z.ZodEnum<{
        aggregate: "aggregate";
        split: "split";
        renormalize: "renormalize";
    }>;
    classes: z.ZodArray<z.ZodType<MicroClassBlueprint, unknown, z.core.$ZodTypeInternals<MicroClassBlueprint, unknown>>>;
}, z.core.$strip>;
export declare const reuseActionSchema: z.ZodObject<{
    op: z.ZodLiteral<"reuse">;
    nodeId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const modifyActionSchema: z.ZodObject<{
    op: z.ZodLiteral<"modify">;
    nodeId: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
    fission: z.ZodObject<{
        problem: z.ZodString;
        demand: z.ZodArray<z.ZodString>;
        answer: z.ZodArray<z.ZodString>;
        evidence: z.ZodOptional<z.ZodObject<{
            ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                raw: z.ZodOptional<z.ZodString>;
                mode: z.ZodOptional<z.ZodString>;
                target: z.ZodOptional<z.ZodString>;
                valueType: z.ZodOptional<z.ZodString>;
                retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                score: z.ZodOptional<z.ZodNumber>;
            }, z.core.$loose>>>;
            promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
            abstraction: z.ZodOptional<z.ZodObject<{
                role: z.ZodOptional<z.ZodString>;
                signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                variantCluster: z.ZodOptional<z.ZodString>;
                abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                interfaceCount: z.ZodOptional<z.ZodNumber>;
                abstractClassCount: z.ZodOptional<z.ZodNumber>;
                typeAliasCount: z.ZodOptional<z.ZodNumber>;
                concreteClassCount: z.ZodOptional<z.ZodNumber>;
                publicMethodCount: z.ZodOptional<z.ZodNumber>;
                topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
            }, z.core.$loose>>;
        }, z.core.$loose>>;
    }, z.core.$loose>;
    reason: z.ZodOptional<z.ZodString>;
    reuse: z.ZodOptional<z.ZodArray<z.ZodString>>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const createChildActionSchema: z.ZodObject<{
    op: z.ZodLiteral<"create_child">;
    parentNodeId: z.ZodString;
    node: z.ZodObject<{
        nodeId: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
        lifecycle: z.ZodOptional<z.ZodEnum<{
            existing: "existing";
            proposed: "proposed";
        }>>;
        fission: z.ZodObject<{
            problem: z.ZodString;
            demand: z.ZodArray<z.ZodString>;
            answer: z.ZodArray<z.ZodString>;
            evidence: z.ZodOptional<z.ZodObject<{
                ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    raw: z.ZodOptional<z.ZodString>;
                    mode: z.ZodOptional<z.ZodString>;
                    target: z.ZodOptional<z.ZodString>;
                    valueType: z.ZodOptional<z.ZodString>;
                    retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                    score: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>>;
                promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
                abstraction: z.ZodOptional<z.ZodObject<{
                    role: z.ZodOptional<z.ZodString>;
                    signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    variantCluster: z.ZodOptional<z.ZodString>;
                    abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                    concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                    interfaceCount: z.ZodOptional<z.ZodNumber>;
                    abstractClassCount: z.ZodOptional<z.ZodNumber>;
                    typeAliasCount: z.ZodOptional<z.ZodNumber>;
                    concreteClassCount: z.ZodOptional<z.ZodNumber>;
                    publicMethodCount: z.ZodOptional<z.ZodNumber>;
                    topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>;
            }, z.core.$loose>>;
        }, z.core.$loose>;
    }, z.core.$loose>;
    reason: z.ZodOptional<z.ZodString>;
    reuse: z.ZodOptional<z.ZodArray<z.ZodString>>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const triadActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    op: z.ZodLiteral<"reuse">;
    nodeId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    op: z.ZodLiteral<"modify">;
    nodeId: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
    fission: z.ZodObject<{
        problem: z.ZodString;
        demand: z.ZodArray<z.ZodString>;
        answer: z.ZodArray<z.ZodString>;
        evidence: z.ZodOptional<z.ZodObject<{
            ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                raw: z.ZodOptional<z.ZodString>;
                mode: z.ZodOptional<z.ZodString>;
                target: z.ZodOptional<z.ZodString>;
                valueType: z.ZodOptional<z.ZodString>;
                retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                score: z.ZodOptional<z.ZodNumber>;
            }, z.core.$loose>>>;
            promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
            abstraction: z.ZodOptional<z.ZodObject<{
                role: z.ZodOptional<z.ZodString>;
                signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                variantCluster: z.ZodOptional<z.ZodString>;
                abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                interfaceCount: z.ZodOptional<z.ZodNumber>;
                abstractClassCount: z.ZodOptional<z.ZodNumber>;
                typeAliasCount: z.ZodOptional<z.ZodNumber>;
                concreteClassCount: z.ZodOptional<z.ZodNumber>;
                publicMethodCount: z.ZodOptional<z.ZodNumber>;
                topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
            }, z.core.$loose>>;
        }, z.core.$loose>>;
    }, z.core.$loose>;
    reason: z.ZodOptional<z.ZodString>;
    reuse: z.ZodOptional<z.ZodArray<z.ZodString>>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    op: z.ZodLiteral<"create_child">;
    parentNodeId: z.ZodString;
    node: z.ZodObject<{
        nodeId: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
        lifecycle: z.ZodOptional<z.ZodEnum<{
            existing: "existing";
            proposed: "proposed";
        }>>;
        fission: z.ZodObject<{
            problem: z.ZodString;
            demand: z.ZodArray<z.ZodString>;
            answer: z.ZodArray<z.ZodString>;
            evidence: z.ZodOptional<z.ZodObject<{
                ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    raw: z.ZodOptional<z.ZodString>;
                    mode: z.ZodOptional<z.ZodString>;
                    target: z.ZodOptional<z.ZodString>;
                    valueType: z.ZodOptional<z.ZodString>;
                    retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                    score: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>>;
                promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
                abstraction: z.ZodOptional<z.ZodObject<{
                    role: z.ZodOptional<z.ZodString>;
                    signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    variantCluster: z.ZodOptional<z.ZodString>;
                    abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                    concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                    interfaceCount: z.ZodOptional<z.ZodNumber>;
                    abstractClassCount: z.ZodOptional<z.ZodNumber>;
                    typeAliasCount: z.ZodOptional<z.ZodNumber>;
                    concreteClassCount: z.ZodOptional<z.ZodNumber>;
                    publicMethodCount: z.ZodOptional<z.ZodNumber>;
                    topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>;
            }, z.core.$loose>>;
        }, z.core.$loose>;
    }, z.core.$loose>;
    reason: z.ZodOptional<z.ZodString>;
    reuse: z.ZodOptional<z.ZodArray<z.ZodString>>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>], "op">;
export declare const upgradeProtocolSchema: z.ZodObject<{
    protocolVersion: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
    mapSource: z.ZodOptional<z.ZodString>;
    userDemand: z.ZodOptional<z.ZodString>;
    upgradePolicy: z.ZodOptional<z.ZodObject<{
        allowedOps: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            reuse: "reuse";
            modify: "modify";
            create_child: "create_child";
        }>>>;
        principle: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    macroSplit: z.ZodOptional<z.ZodObject<{
        triadizationFocus: z.ZodString;
        recommendedOperation: z.ZodEnum<{
            aggregate: "aggregate";
            split: "split";
            renormalize: "renormalize";
        }>;
        anchorNodeId: z.ZodString;
        vertexGoal: z.ZodString;
        leftBranch: z.ZodArray<z.ZodString>;
        rightBranch: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    mesoSplit: z.ZodOptional<z.ZodObject<{
        triadizationFocus: z.ZodString;
        recommendedOperation: z.ZodEnum<{
            aggregate: "aggregate";
            split: "split";
            renormalize: "renormalize";
        }>;
        classes: z.ZodArray<z.ZodType<MesoClassBlueprint, unknown, z.core.$ZodTypeInternals<MesoClassBlueprint, unknown>>>;
        pipelines: z.ZodArray<z.ZodType<MesoPipeline, unknown, z.core.$ZodTypeInternals<MesoPipeline, unknown>>>;
    }, z.core.$strip>>;
    microSplit: z.ZodOptional<z.ZodObject<{
        triadizationFocus: z.ZodString;
        recommendedOperation: z.ZodEnum<{
            aggregate: "aggregate";
            split: "split";
            renormalize: "renormalize";
        }>;
        classes: z.ZodArray<z.ZodType<MicroClassBlueprint, unknown, z.core.$ZodTypeInternals<MicroClassBlueprint, unknown>>>;
    }, z.core.$strip>>;
    impactedNodes: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    actions: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        op: z.ZodLiteral<"reuse">;
        nodeId: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        op: z.ZodLiteral<"modify">;
        nodeId: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
        fission: z.ZodObject<{
            problem: z.ZodString;
            demand: z.ZodArray<z.ZodString>;
            answer: z.ZodArray<z.ZodString>;
            evidence: z.ZodOptional<z.ZodObject<{
                ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    raw: z.ZodOptional<z.ZodString>;
                    mode: z.ZodOptional<z.ZodString>;
                    target: z.ZodOptional<z.ZodString>;
                    valueType: z.ZodOptional<z.ZodString>;
                    retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                    score: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>>;
                promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
                abstraction: z.ZodOptional<z.ZodObject<{
                    role: z.ZodOptional<z.ZodString>;
                    signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    variantCluster: z.ZodOptional<z.ZodString>;
                    abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                    concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                    interfaceCount: z.ZodOptional<z.ZodNumber>;
                    abstractClassCount: z.ZodOptional<z.ZodNumber>;
                    typeAliasCount: z.ZodOptional<z.ZodNumber>;
                    concreteClassCount: z.ZodOptional<z.ZodNumber>;
                    publicMethodCount: z.ZodOptional<z.ZodNumber>;
                    topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>;
            }, z.core.$loose>>;
        }, z.core.$loose>;
        reason: z.ZodOptional<z.ZodString>;
        reuse: z.ZodOptional<z.ZodArray<z.ZodString>>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        op: z.ZodLiteral<"create_child">;
        parentNodeId: z.ZodString;
        node: z.ZodObject<{
            nodeId: z.ZodString;
            category: z.ZodOptional<z.ZodString>;
            sourcePath: z.ZodOptional<z.ZodString>;
            lifecycle: z.ZodOptional<z.ZodEnum<{
                existing: "existing";
                proposed: "proposed";
            }>>;
            fission: z.ZodObject<{
                problem: z.ZodString;
                demand: z.ZodArray<z.ZodString>;
                answer: z.ZodArray<z.ZodString>;
                evidence: z.ZodOptional<z.ZodObject<{
                    ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        raw: z.ZodOptional<z.ZodString>;
                        mode: z.ZodOptional<z.ZodString>;
                        target: z.ZodOptional<z.ZodString>;
                        valueType: z.ZodOptional<z.ZodString>;
                        retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                        score: z.ZodOptional<z.ZodNumber>;
                    }, z.core.$loose>>>;
                    promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    abstraction: z.ZodOptional<z.ZodObject<{
                        role: z.ZodOptional<z.ZodString>;
                        signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        variantCluster: z.ZodOptional<z.ZodString>;
                        abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                        concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                        interfaceCount: z.ZodOptional<z.ZodNumber>;
                        abstractClassCount: z.ZodOptional<z.ZodNumber>;
                        typeAliasCount: z.ZodOptional<z.ZodNumber>;
                        concreteClassCount: z.ZodOptional<z.ZodNumber>;
                        publicMethodCount: z.ZodOptional<z.ZodNumber>;
                        topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
                    }, z.core.$loose>>;
                }, z.core.$loose>>;
            }, z.core.$loose>;
        }, z.core.$loose>;
        reason: z.ZodOptional<z.ZodString>;
        reuse: z.ZodOptional<z.ZodArray<z.ZodString>>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>], "op">>;
    resultTopology: z.ZodOptional<z.ZodArray<z.ZodObject<{
        nodeId: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
        lifecycle: z.ZodOptional<z.ZodEnum<{
            existing: "existing";
            proposed: "proposed";
        }>>;
        fission: z.ZodObject<{
            problem: z.ZodString;
            demand: z.ZodArray<z.ZodString>;
            answer: z.ZodArray<z.ZodString>;
            evidence: z.ZodOptional<z.ZodObject<{
                ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    raw: z.ZodOptional<z.ZodString>;
                    mode: z.ZodOptional<z.ZodString>;
                    target: z.ZodOptional<z.ZodString>;
                    valueType: z.ZodOptional<z.ZodString>;
                    retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                    score: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>>;
                promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
                abstraction: z.ZodOptional<z.ZodObject<{
                    role: z.ZodOptional<z.ZodString>;
                    signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    variantCluster: z.ZodOptional<z.ZodString>;
                    abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                    concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                    interfaceCount: z.ZodOptional<z.ZodNumber>;
                    abstractClassCount: z.ZodOptional<z.ZodNumber>;
                    typeAliasCount: z.ZodOptional<z.ZodNumber>;
                    concreteClassCount: z.ZodOptional<z.ZodNumber>;
                    publicMethodCount: z.ZodOptional<z.ZodNumber>;
                    topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>;
            }, z.core.$loose>>;
        }, z.core.$loose>;
    }, z.core.$loose>>>;
}, z.core.$strip>;
/**
 * @RightBranch
 */
export declare function getPrefixCategoryMap(): Record<string, string>;
/**
 * @RightBranch
 */
export declare function getUpgradeProtocolSchema(): z.ZodObject<{
    protocolVersion: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
    mapSource: z.ZodOptional<z.ZodString>;
    userDemand: z.ZodOptional<z.ZodString>;
    upgradePolicy: z.ZodOptional<z.ZodObject<{
        allowedOps: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            reuse: "reuse";
            modify: "modify";
            create_child: "create_child";
        }>>>;
        principle: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    macroSplit: z.ZodOptional<z.ZodObject<{
        triadizationFocus: z.ZodString;
        recommendedOperation: z.ZodEnum<{
            aggregate: "aggregate";
            split: "split";
            renormalize: "renormalize";
        }>;
        anchorNodeId: z.ZodString;
        vertexGoal: z.ZodString;
        leftBranch: z.ZodArray<z.ZodString>;
        rightBranch: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    mesoSplit: z.ZodOptional<z.ZodObject<{
        triadizationFocus: z.ZodString;
        recommendedOperation: z.ZodEnum<{
            aggregate: "aggregate";
            split: "split";
            renormalize: "renormalize";
        }>;
        classes: z.ZodArray<z.ZodType<MesoClassBlueprint, unknown, z.core.$ZodTypeInternals<MesoClassBlueprint, unknown>>>;
        pipelines: z.ZodArray<z.ZodType<MesoPipeline, unknown, z.core.$ZodTypeInternals<MesoPipeline, unknown>>>;
    }, z.core.$strip>>;
    microSplit: z.ZodOptional<z.ZodObject<{
        triadizationFocus: z.ZodString;
        recommendedOperation: z.ZodEnum<{
            aggregate: "aggregate";
            split: "split";
            renormalize: "renormalize";
        }>;
        classes: z.ZodArray<z.ZodType<MicroClassBlueprint, unknown, z.core.$ZodTypeInternals<MicroClassBlueprint, unknown>>>;
    }, z.core.$strip>>;
    impactedNodes: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    actions: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        op: z.ZodLiteral<"reuse">;
        nodeId: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        op: z.ZodLiteral<"modify">;
        nodeId: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
        fission: z.ZodObject<{
            problem: z.ZodString;
            demand: z.ZodArray<z.ZodString>;
            answer: z.ZodArray<z.ZodString>;
            evidence: z.ZodOptional<z.ZodObject<{
                ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    raw: z.ZodOptional<z.ZodString>;
                    mode: z.ZodOptional<z.ZodString>;
                    target: z.ZodOptional<z.ZodString>;
                    valueType: z.ZodOptional<z.ZodString>;
                    retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                    score: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>>;
                promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
                abstraction: z.ZodOptional<z.ZodObject<{
                    role: z.ZodOptional<z.ZodString>;
                    signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    variantCluster: z.ZodOptional<z.ZodString>;
                    abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                    concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                    interfaceCount: z.ZodOptional<z.ZodNumber>;
                    abstractClassCount: z.ZodOptional<z.ZodNumber>;
                    typeAliasCount: z.ZodOptional<z.ZodNumber>;
                    concreteClassCount: z.ZodOptional<z.ZodNumber>;
                    publicMethodCount: z.ZodOptional<z.ZodNumber>;
                    topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>;
            }, z.core.$loose>>;
        }, z.core.$loose>;
        reason: z.ZodOptional<z.ZodString>;
        reuse: z.ZodOptional<z.ZodArray<z.ZodString>>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        op: z.ZodLiteral<"create_child">;
        parentNodeId: z.ZodString;
        node: z.ZodObject<{
            nodeId: z.ZodString;
            category: z.ZodOptional<z.ZodString>;
            sourcePath: z.ZodOptional<z.ZodString>;
            lifecycle: z.ZodOptional<z.ZodEnum<{
                existing: "existing";
                proposed: "proposed";
            }>>;
            fission: z.ZodObject<{
                problem: z.ZodString;
                demand: z.ZodArray<z.ZodString>;
                answer: z.ZodArray<z.ZodString>;
                evidence: z.ZodOptional<z.ZodObject<{
                    ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        raw: z.ZodOptional<z.ZodString>;
                        mode: z.ZodOptional<z.ZodString>;
                        target: z.ZodOptional<z.ZodString>;
                        valueType: z.ZodOptional<z.ZodString>;
                        retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                        score: z.ZodOptional<z.ZodNumber>;
                    }, z.core.$loose>>>;
                    promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    abstraction: z.ZodOptional<z.ZodObject<{
                        role: z.ZodOptional<z.ZodString>;
                        signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        variantCluster: z.ZodOptional<z.ZodString>;
                        abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                        concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                        interfaceCount: z.ZodOptional<z.ZodNumber>;
                        abstractClassCount: z.ZodOptional<z.ZodNumber>;
                        typeAliasCount: z.ZodOptional<z.ZodNumber>;
                        concreteClassCount: z.ZodOptional<z.ZodNumber>;
                        publicMethodCount: z.ZodOptional<z.ZodNumber>;
                        topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
                    }, z.core.$loose>>;
                }, z.core.$loose>>;
            }, z.core.$loose>;
        }, z.core.$loose>;
        reason: z.ZodOptional<z.ZodString>;
        reuse: z.ZodOptional<z.ZodArray<z.ZodString>>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>], "op">>;
    resultTopology: z.ZodOptional<z.ZodArray<z.ZodObject<{
        nodeId: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
        lifecycle: z.ZodOptional<z.ZodEnum<{
            existing: "existing";
            proposed: "proposed";
        }>>;
        fission: z.ZodObject<{
            problem: z.ZodString;
            demand: z.ZodArray<z.ZodString>;
            answer: z.ZodArray<z.ZodString>;
            evidence: z.ZodOptional<z.ZodObject<{
                ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    raw: z.ZodOptional<z.ZodString>;
                    mode: z.ZodOptional<z.ZodString>;
                    target: z.ZodOptional<z.ZodString>;
                    valueType: z.ZodOptional<z.ZodString>;
                    retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                    score: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>>;
                promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
                abstraction: z.ZodOptional<z.ZodObject<{
                    role: z.ZodOptional<z.ZodString>;
                    signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    variantCluster: z.ZodOptional<z.ZodString>;
                    abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                    concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                    interfaceCount: z.ZodOptional<z.ZodNumber>;
                    abstractClassCount: z.ZodOptional<z.ZodNumber>;
                    typeAliasCount: z.ZodOptional<z.ZodNumber>;
                    concreteClassCount: z.ZodOptional<z.ZodNumber>;
                    publicMethodCount: z.ZodOptional<z.ZodNumber>;
                    topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
                }, z.core.$loose>>;
            }, z.core.$loose>>;
        }, z.core.$loose>;
    }, z.core.$loose>>>;
}, z.core.$strip>;
/**
 * @RightBranch
 */
export declare function getTriadNodeDefinitionSchema(): z.ZodObject<{
    nodeId: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
    lifecycle: z.ZodOptional<z.ZodEnum<{
        existing: "existing";
        proposed: "proposed";
    }>>;
    fission: z.ZodObject<{
        problem: z.ZodString;
        demand: z.ZodArray<z.ZodString>;
        answer: z.ZodArray<z.ZodString>;
        evidence: z.ZodOptional<z.ZodObject<{
            ghostReads: z.ZodOptional<z.ZodArray<z.ZodObject<{
                raw: z.ZodOptional<z.ZodString>;
                mode: z.ZodOptional<z.ZodString>;
                target: z.ZodOptional<z.ZodString>;
                valueType: z.ZodOptional<z.ZodString>;
                retainedInDemand: z.ZodOptional<z.ZodBoolean>;
                score: z.ZodOptional<z.ZodNumber>;
            }, z.core.$loose>>>;
            promotionReasons: z.ZodOptional<z.ZodArray<z.ZodString>>;
            abstraction: z.ZodOptional<z.ZodObject<{
                role: z.ZodOptional<z.ZodString>;
                signals: z.ZodOptional<z.ZodArray<z.ZodString>>;
                implements: z.ZodOptional<z.ZodArray<z.ZodString>>;
                extendsAbstract: z.ZodOptional<z.ZodArray<z.ZodString>>;
                dependsOnAbstractions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                peerConcreteCalls: z.ZodOptional<z.ZodArray<z.ZodString>>;
                variantCluster: z.ZodOptional<z.ZodString>;
                abstractionSignalCount: z.ZodOptional<z.ZodNumber>;
                concreteSignalCount: z.ZodOptional<z.ZodNumber>;
                interfaceCount: z.ZodOptional<z.ZodNumber>;
                abstractClassCount: z.ZodOptional<z.ZodNumber>;
                typeAliasCount: z.ZodOptional<z.ZodNumber>;
                concreteClassCount: z.ZodOptional<z.ZodNumber>;
                publicMethodCount: z.ZodOptional<z.ZodNumber>;
                topLevelExecutableCount: z.ZodOptional<z.ZodNumber>;
            }, z.core.$loose>>;
        }, z.core.$loose>>;
    }, z.core.$loose>;
}, z.core.$loose>;
