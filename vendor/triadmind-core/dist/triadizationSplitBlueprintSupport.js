"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMacroSplitBlueprintSeed = createMacroSplitBlueprintSeed;
exports.createMesoSplitBlueprintSeed = createMesoSplitBlueprintSeed;
exports.createMicroSplitBlueprintSeed = createMicroSplitBlueprintSeed;
exports.createMacroSplitSchema = createMacroSplitSchema;
exports.createMesoClassBlueprintSchema = createMesoClassBlueprintSchema;
exports.createMesoPipelineSchema = createMesoPipelineSchema;
exports.createMesoSplitSchema = createMesoSplitSchema;
exports.createMicroPropertyBlueprintSchema = createMicroPropertyBlueprintSchema;
exports.createMicroMethodBlueprintSchema = createMicroMethodBlueprintSchema;
exports.createMicroClassBlueprintSchema = createMicroClassBlueprintSchema;
exports.createMicroSplitSchema = createMicroSplitSchema;
const zod_1 = require("zod");
function createMacroSplitBlueprintSeed(vertexGoal = '') {
    return {
        anchorNodeId: '',
        vertexGoal,
        leftBranch: [],
        rightBranch: []
    };
}
function createMesoSplitBlueprintSeed() {
    return {
        classes: [],
        pipelines: []
    };
}
function createMicroSplitBlueprintSeed() {
    return {
        classes: []
    };
}
function createMacroSplitSchema(focusReferenceSchema, nonEmptyStringSchema) {
    return focusReferenceSchema.extend({
        anchorNodeId: zod_1.z.string().trim(),
        vertexGoal: zod_1.z.string().trim(),
        leftBranch: zod_1.z.array(nonEmptyStringSchema),
        rightBranch: zod_1.z.array(nonEmptyStringSchema)
    });
}
function createMesoClassBlueprintSchema(nonEmptyStringSchema) {
    return zod_1.z.object({
        className: nonEmptyStringSchema,
        category: nonEmptyStringSchema,
        responsibility: nonEmptyStringSchema,
        upstreams: zod_1.z.array(nonEmptyStringSchema),
        downstreams: zod_1.z.array(nonEmptyStringSchema)
    });
}
function createMesoPipelineSchema(nonEmptyStringSchema) {
    return zod_1.z.object({
        pipelineId: nonEmptyStringSchema,
        purpose: nonEmptyStringSchema,
        steps: zod_1.z.array(nonEmptyStringSchema)
    });
}
function createMesoSplitSchema(focusReferenceSchema, mesoClassBlueprintSchema, mesoPipelineSchema) {
    return focusReferenceSchema.extend({
        classes: zod_1.z.array(mesoClassBlueprintSchema),
        pipelines: zod_1.z.array(mesoPipelineSchema)
    });
}
function createMicroPropertyBlueprintSchema(nonEmptyStringSchema) {
    return zod_1.z.object({
        name: nonEmptyStringSchema,
        type: nonEmptyStringSchema,
        role: nonEmptyStringSchema
    });
}
function createMicroMethodBlueprintSchema(nonEmptyStringSchema) {
    return zod_1.z.object({
        name: nonEmptyStringSchema,
        demand: zod_1.z.array(nonEmptyStringSchema),
        answer: zod_1.z.array(nonEmptyStringSchema),
        responsibility: nonEmptyStringSchema
    });
}
function createMicroClassBlueprintSchema(nonEmptyStringSchema, microPropertyBlueprintSchema, microMethodBlueprintSchema) {
    return zod_1.z.object({
        className: nonEmptyStringSchema,
        staticRightBranch: zod_1.z.array(microPropertyBlueprintSchema),
        dynamicLeftBranch: zod_1.z.array(microMethodBlueprintSchema)
    });
}
function createMicroSplitSchema(focusReferenceSchema, microClassBlueprintSchema) {
    return focusReferenceSchema.extend({
        classes: zod_1.z.array(microClassBlueprintSchema)
    });
}
//# sourceMappingURL=triadizationSplitBlueprintSupport.js.map