"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeProtocolSchema = exports.triadActionSchema = exports.createChildActionSchema = exports.modifyActionSchema = exports.reuseActionSchema = exports.microSplitSchema = exports.microClassBlueprintSchema = exports.microMethodBlueprintSchema = exports.microPropertyBlueprintSchema = exports.mesoSplitSchema = exports.mesoPipelineSchema = exports.mesoClassBlueprintSchema = exports.macroSplitSchema = exports.triadizationFocusReferenceSchema = exports.triadNodeDefinitionSchema = exports.triadFissionSchema = exports.triadNodeEvidenceSchema = exports.triadAbstractionEvidenceSchema = exports.triadGhostReadEvidenceSchema = exports.PREFIX_CATEGORY_MAP = void 0;
exports.getPrefixCategoryMap = getPrefixCategoryMap;
exports.getUpgradeProtocolSchema = getUpgradeProtocolSchema;
exports.getTriadNodeDefinitionSchema = getTriadNodeDefinitionSchema;
const zod_1 = require("zod");
const triadizationSplitBlueprintSupport_1 = require("./triadizationSplitBlueprintSupport");
exports.PREFIX_CATEGORY_MAP = {
    core: 'core'
};
const nonEmptyStringSchema = zod_1.z.string().trim().min(1);
const triadCategorySchema = nonEmptyStringSchema;
const triadOpSchema = zod_1.z.enum(['reuse', 'modify', 'create_child']);
const triadizationRecommendedOperationSchema = zod_1.z.enum(['aggregate', 'split', 'renormalize']);
exports.triadGhostReadEvidenceSchema = zod_1.z
    .object({
    raw: zod_1.z.string().optional(),
    mode: zod_1.z.string().optional(),
    target: zod_1.z.string().optional(),
    valueType: zod_1.z.string().optional(),
    retainedInDemand: zod_1.z.boolean().optional(),
    score: zod_1.z.number().finite().optional()
})
    .passthrough();
exports.triadAbstractionEvidenceSchema = zod_1.z
    .object({
    role: zod_1.z.string().optional(),
    signals: zod_1.z.array(nonEmptyStringSchema).optional(),
    implements: zod_1.z.array(nonEmptyStringSchema).optional(),
    extendsAbstract: zod_1.z.array(nonEmptyStringSchema).optional(),
    dependsOnAbstractions: zod_1.z.array(nonEmptyStringSchema).optional(),
    peerConcreteCalls: zod_1.z.array(nonEmptyStringSchema).optional(),
    variantCluster: zod_1.z.string().optional(),
    abstractionSignalCount: zod_1.z.number().int().nonnegative().optional(),
    concreteSignalCount: zod_1.z.number().int().nonnegative().optional(),
    interfaceCount: zod_1.z.number().int().nonnegative().optional(),
    abstractClassCount: zod_1.z.number().int().nonnegative().optional(),
    typeAliasCount: zod_1.z.number().int().nonnegative().optional(),
    concreteClassCount: zod_1.z.number().int().nonnegative().optional(),
    publicMethodCount: zod_1.z.number().int().nonnegative().optional(),
    topLevelExecutableCount: zod_1.z.number().int().nonnegative().optional()
})
    .passthrough();
exports.triadNodeEvidenceSchema = zod_1.z
    .object({
    ghostReads: zod_1.z.array(exports.triadGhostReadEvidenceSchema).optional(),
    promotionReasons: zod_1.z.array(nonEmptyStringSchema).optional(),
    abstraction: exports.triadAbstractionEvidenceSchema.optional()
})
    .passthrough();
exports.triadFissionSchema = zod_1.z.object({
    problem: nonEmptyStringSchema,
    demand: zod_1.z.array(nonEmptyStringSchema),
    answer: zod_1.z.array(nonEmptyStringSchema),
    evidence: exports.triadNodeEvidenceSchema.optional()
}).passthrough();
exports.triadNodeDefinitionSchema = zod_1.z.object({
    nodeId: nonEmptyStringSchema,
    category: triadCategorySchema.optional(),
    sourcePath: nonEmptyStringSchema.optional(),
    lifecycle: zod_1.z.enum(['existing', 'proposed']).optional(),
    fission: exports.triadFissionSchema
}).passthrough();
exports.triadizationFocusReferenceSchema = zod_1.z.object({
    triadizationFocus: nonEmptyStringSchema,
    recommendedOperation: triadizationRecommendedOperationSchema
});
exports.macroSplitSchema = (0, triadizationSplitBlueprintSupport_1.createMacroSplitSchema)(exports.triadizationFocusReferenceSchema, nonEmptyStringSchema);
exports.mesoClassBlueprintSchema = (0, triadizationSplitBlueprintSupport_1.createMesoClassBlueprintSchema)(nonEmptyStringSchema);
exports.mesoPipelineSchema = (0, triadizationSplitBlueprintSupport_1.createMesoPipelineSchema)(nonEmptyStringSchema);
exports.mesoSplitSchema = (0, triadizationSplitBlueprintSupport_1.createMesoSplitSchema)(exports.triadizationFocusReferenceSchema, exports.mesoClassBlueprintSchema, exports.mesoPipelineSchema);
exports.microPropertyBlueprintSchema = (0, triadizationSplitBlueprintSupport_1.createMicroPropertyBlueprintSchema)(nonEmptyStringSchema);
exports.microMethodBlueprintSchema = (0, triadizationSplitBlueprintSupport_1.createMicroMethodBlueprintSchema)(nonEmptyStringSchema);
exports.microClassBlueprintSchema = (0, triadizationSplitBlueprintSupport_1.createMicroClassBlueprintSchema)(nonEmptyStringSchema, exports.microPropertyBlueprintSchema, exports.microMethodBlueprintSchema);
exports.microSplitSchema = (0, triadizationSplitBlueprintSupport_1.createMicroSplitSchema)(exports.triadizationFocusReferenceSchema, exports.microClassBlueprintSchema);
exports.reuseActionSchema = zod_1.z.object({
    op: zod_1.z.literal('reuse'),
    nodeId: nonEmptyStringSchema,
    reason: zod_1.z.string().optional(),
    confidence: zod_1.z.number().min(0).max(1).optional()
});
exports.modifyActionSchema = zod_1.z.object({
    op: zod_1.z.literal('modify'),
    nodeId: nonEmptyStringSchema,
    category: triadCategorySchema.optional(),
    sourcePath: nonEmptyStringSchema.optional(),
    fission: exports.triadFissionSchema,
    reason: zod_1.z.string().optional(),
    reuse: zod_1.z.array(nonEmptyStringSchema).optional(),
    confidence: zod_1.z.number().min(0).max(1).optional()
});
exports.createChildActionSchema = zod_1.z.object({
    op: zod_1.z.literal('create_child'),
    parentNodeId: nonEmptyStringSchema,
    node: exports.triadNodeDefinitionSchema,
    reason: zod_1.z.string().optional(),
    reuse: zod_1.z.array(nonEmptyStringSchema).optional(),
    confidence: zod_1.z.number().min(0).max(1).optional()
});
exports.triadActionSchema = zod_1.z.discriminatedUnion('op', [
    exports.reuseActionSchema,
    exports.modifyActionSchema,
    exports.createChildActionSchema
]);
exports.upgradeProtocolSchema = zod_1.z.object({
    protocolVersion: zod_1.z.string().optional(),
    project: zod_1.z.string().optional(),
    mapSource: zod_1.z.string().optional(),
    userDemand: zod_1.z.string().optional(),
    upgradePolicy: zod_1.z
        .object({
        allowedOps: zod_1.z.array(triadOpSchema).optional(),
        principle: zod_1.z.string().optional()
    })
        .optional(),
    macroSplit: exports.macroSplitSchema.optional(),
    mesoSplit: exports.mesoSplitSchema.optional(),
    microSplit: exports.microSplitSchema.optional(),
    impactedNodes: zod_1.z.array(zod_1.z.unknown()).optional(),
    actions: zod_1.z.array(exports.triadActionSchema).min(1, 'actions must contain at least one reuse/modify/create_child operation'),
    resultTopology: zod_1.z.array(exports.triadNodeDefinitionSchema).optional()
});
/**
 * @RightBranch
 */
function getPrefixCategoryMap() {
    return exports.PREFIX_CATEGORY_MAP;
}
/**
 * @RightBranch
 */
function getUpgradeProtocolSchema() {
    return exports.upgradeProtocolSchema;
}
/**
 * @RightBranch
 */
function getTriadNodeDefinitionSchema() {
    return exports.triadNodeDefinitionSchema;
}
//# sourceMappingURL=protocolRightBranch.js.map