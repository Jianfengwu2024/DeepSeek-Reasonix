import { z } from 'zod';

export interface MacroSplitBlueprint {
    anchorNodeId: string;
    vertexGoal: string;
    leftBranch: string[];
    rightBranch: string[];
}

export interface MesoClassBlueprint {
    className: string;
    category: string;
    responsibility: string;
    upstreams: string[];
    downstreams: string[];
}

export interface MesoPipeline {
    pipelineId: string;
    purpose: string;
    steps: string[];
}

export interface MicroPropertyBlueprint {
    name: string;
    type: string;
    role: string;
}

export interface MicroMethodBlueprint {
    name: string;
    demand: string[];
    answer: string[];
    responsibility: string;
}

export interface MicroClassBlueprint {
    className: string;
    staticRightBranch: MicroPropertyBlueprint[];
    dynamicLeftBranch: MicroMethodBlueprint[];
}

export interface MesoSplitBlueprint {
    classes: MesoClassBlueprint[];
    pipelines: MesoPipeline[];
}

export interface MicroSplitBlueprint {
    classes: MicroClassBlueprint[];
}

export type MacroSplitShape<TFocus extends object = object> = TFocus & MacroSplitBlueprint;
export type MesoSplitShape<TFocus extends object = object> = TFocus & MesoSplitBlueprint;
export type MicroSplitShape<TFocus extends object = object> = TFocus & MicroSplitBlueprint;

export type MicroClassArtifactLike = {
    className?: unknown;
    staticRightBranch?: unknown[];
    dynamicLeftBranch?: unknown[];
    properties?: unknown[];
    methods?: unknown[];
};

export type MicroSplitArtifactLike<TFocus extends object = object> = TFocus & {
    classes?: MicroClassArtifactLike[];
};

export function createMacroSplitBlueprintSeed(vertexGoal = ''): MacroSplitBlueprint {
    return {
        anchorNodeId: '',
        vertexGoal,
        leftBranch: [],
        rightBranch: []
    };
}

export function createMesoSplitBlueprintSeed(): MesoSplitBlueprint {
    return {
        classes: [],
        pipelines: []
    };
}

export function createMicroSplitBlueprintSeed(): MicroSplitBlueprint {
    return {
        classes: []
    };
}

export function createMacroSplitSchema<TShape extends z.ZodRawShape>(
    focusReferenceSchema: z.ZodObject<TShape>,
    nonEmptyStringSchema: z.ZodString
) {
    return focusReferenceSchema.extend({
        anchorNodeId: z.string().trim(),
        vertexGoal: z.string().trim(),
        leftBranch: z.array(nonEmptyStringSchema),
        rightBranch: z.array(nonEmptyStringSchema)
    });
}

export function createMesoClassBlueprintSchema(nonEmptyStringSchema: z.ZodString) {
    return z.object({
        className: nonEmptyStringSchema,
        category: nonEmptyStringSchema,
        responsibility: nonEmptyStringSchema,
        upstreams: z.array(nonEmptyStringSchema),
        downstreams: z.array(nonEmptyStringSchema)
    });
}

export function createMesoPipelineSchema(nonEmptyStringSchema: z.ZodString) {
    return z.object({
        pipelineId: nonEmptyStringSchema,
        purpose: nonEmptyStringSchema,
        steps: z.array(nonEmptyStringSchema)
    });
}

export function createMesoSplitSchema<TShape extends z.ZodRawShape>(
    focusReferenceSchema: z.ZodObject<TShape>,
    mesoClassBlueprintSchema: z.ZodType<MesoClassBlueprint>,
    mesoPipelineSchema: z.ZodType<MesoPipeline>
) {
    return focusReferenceSchema.extend({
        classes: z.array(mesoClassBlueprintSchema),
        pipelines: z.array(mesoPipelineSchema)
    });
}

export function createMicroPropertyBlueprintSchema(nonEmptyStringSchema: z.ZodString) {
    return z.object({
        name: nonEmptyStringSchema,
        type: nonEmptyStringSchema,
        role: nonEmptyStringSchema
    });
}

export function createMicroMethodBlueprintSchema(nonEmptyStringSchema: z.ZodString) {
    return z.object({
        name: nonEmptyStringSchema,
        demand: z.array(nonEmptyStringSchema),
        answer: z.array(nonEmptyStringSchema),
        responsibility: nonEmptyStringSchema
    });
}

export function createMicroClassBlueprintSchema(
    nonEmptyStringSchema: z.ZodString,
    microPropertyBlueprintSchema: z.ZodType<MicroPropertyBlueprint>,
    microMethodBlueprintSchema: z.ZodType<MicroMethodBlueprint>
) {
    return z.object({
        className: nonEmptyStringSchema,
        staticRightBranch: z.array(microPropertyBlueprintSchema),
        dynamicLeftBranch: z.array(microMethodBlueprintSchema)
    });
}

export function createMicroSplitSchema<TShape extends z.ZodRawShape>(
    focusReferenceSchema: z.ZodObject<TShape>,
    microClassBlueprintSchema: z.ZodType<MicroClassBlueprint>
) {
    return focusReferenceSchema.extend({
        classes: z.array(microClassBlueprintSchema)
    });
}
