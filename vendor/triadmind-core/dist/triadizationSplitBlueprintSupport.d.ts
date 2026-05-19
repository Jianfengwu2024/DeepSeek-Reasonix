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
export declare function createMacroSplitBlueprintSeed(vertexGoal?: string): MacroSplitBlueprint;
export declare function createMesoSplitBlueprintSeed(): MesoSplitBlueprint;
export declare function createMicroSplitBlueprintSeed(): MicroSplitBlueprint;
export declare function createMacroSplitSchema<TShape extends z.ZodRawShape>(focusReferenceSchema: z.ZodObject<TShape>, nonEmptyStringSchema: z.ZodString): z.ZodObject<(keyof TShape & ("anchorNodeId" | "vertexGoal" | "leftBranch" | "rightBranch") extends never ? TShape & {
    anchorNodeId: z.ZodString;
    vertexGoal: z.ZodString;
    leftBranch: z.ZodArray<z.ZodString>;
    rightBranch: z.ZodArray<z.ZodString>;
} : { [K in keyof TShape as K extends "anchorNodeId" | "vertexGoal" | "leftBranch" | "rightBranch" ? never : K]: TShape[K]; } & {
    anchorNodeId: z.ZodString;
    vertexGoal: z.ZodString;
    leftBranch: z.ZodArray<z.ZodString>;
    rightBranch: z.ZodArray<z.ZodString>;
}) extends infer T ? { [k in keyof T]: T[k]; } : never, z.core.$strip>;
export declare function createMesoClassBlueprintSchema(nonEmptyStringSchema: z.ZodString): z.ZodObject<{
    className: z.ZodString;
    category: z.ZodString;
    responsibility: z.ZodString;
    upstreams: z.ZodArray<z.ZodString>;
    downstreams: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare function createMesoPipelineSchema(nonEmptyStringSchema: z.ZodString): z.ZodObject<{
    pipelineId: z.ZodString;
    purpose: z.ZodString;
    steps: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare function createMesoSplitSchema<TShape extends z.ZodRawShape>(focusReferenceSchema: z.ZodObject<TShape>, mesoClassBlueprintSchema: z.ZodType<MesoClassBlueprint>, mesoPipelineSchema: z.ZodType<MesoPipeline>): z.ZodObject<(keyof TShape & ("classes" | "pipelines") extends never ? TShape & {
    classes: z.ZodArray<z.ZodType<MesoClassBlueprint, unknown, z.core.$ZodTypeInternals<MesoClassBlueprint, unknown>>>;
    pipelines: z.ZodArray<z.ZodType<MesoPipeline, unknown, z.core.$ZodTypeInternals<MesoPipeline, unknown>>>;
} : { [K in keyof TShape as K extends "classes" | "pipelines" ? never : K]: TShape[K]; } & {
    classes: z.ZodArray<z.ZodType<MesoClassBlueprint, unknown, z.core.$ZodTypeInternals<MesoClassBlueprint, unknown>>>;
    pipelines: z.ZodArray<z.ZodType<MesoPipeline, unknown, z.core.$ZodTypeInternals<MesoPipeline, unknown>>>;
}) extends infer T ? { [k in keyof T]: T[k]; } : never, z.core.$strip>;
export declare function createMicroPropertyBlueprintSchema(nonEmptyStringSchema: z.ZodString): z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    role: z.ZodString;
}, z.core.$strip>;
export declare function createMicroMethodBlueprintSchema(nonEmptyStringSchema: z.ZodString): z.ZodObject<{
    name: z.ZodString;
    demand: z.ZodArray<z.ZodString>;
    answer: z.ZodArray<z.ZodString>;
    responsibility: z.ZodString;
}, z.core.$strip>;
export declare function createMicroClassBlueprintSchema(nonEmptyStringSchema: z.ZodString, microPropertyBlueprintSchema: z.ZodType<MicroPropertyBlueprint>, microMethodBlueprintSchema: z.ZodType<MicroMethodBlueprint>): z.ZodObject<{
    className: z.ZodString;
    staticRightBranch: z.ZodArray<z.ZodType<MicroPropertyBlueprint, unknown, z.core.$ZodTypeInternals<MicroPropertyBlueprint, unknown>>>;
    dynamicLeftBranch: z.ZodArray<z.ZodType<MicroMethodBlueprint, unknown, z.core.$ZodTypeInternals<MicroMethodBlueprint, unknown>>>;
}, z.core.$strip>;
export declare function createMicroSplitSchema<TShape extends z.ZodRawShape>(focusReferenceSchema: z.ZodObject<TShape>, microClassBlueprintSchema: z.ZodType<MicroClassBlueprint>): z.ZodObject<(keyof TShape & "classes" extends never ? TShape & {
    classes: z.ZodArray<z.ZodType<MicroClassBlueprint, unknown, z.core.$ZodTypeInternals<MicroClassBlueprint, unknown>>>;
} : { [K in keyof TShape as K extends "classes" ? never : K]: TShape[K]; } & {
    classes: z.ZodArray<z.ZodType<MicroClassBlueprint, unknown, z.core.$ZodTypeInternals<MicroClassBlueprint, unknown>>>;
}) extends infer T ? { [k in keyof T]: T[k]; } : never, z.core.$strip>;
