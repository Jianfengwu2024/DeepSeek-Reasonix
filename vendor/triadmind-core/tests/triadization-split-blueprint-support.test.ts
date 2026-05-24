import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
    createMacroSplitSchema,
    createMacroSplitBlueprintSeed,
    createMesoSplitBlueprintSeed,
    createMesoClassBlueprintSchema,
    createMesoPipelineSchema,
    createMesoSplitSchema,
    createMicroSplitBlueprintSeed,
    createMicroPropertyBlueprintSchema,
    createMicroMethodBlueprintSchema,
    createMicroClassBlueprintSchema,
    createMicroSplitSchema
} from '../triadizationSplitBlueprintSupport';

test('split blueprint seed builders expose canonical blank branch structures', () => {
    assert.deepEqual(createMacroSplitBlueprintSeed('Refine workflow triadization'), {
        anchorNodeId: '',
        vertexGoal: 'Refine workflow triadization',
        leftBranch: [],
        rightBranch: []
    });
    assert.deepEqual(createMesoSplitBlueprintSeed(), {
        classes: [],
        pipelines: []
    });
    assert.deepEqual(createMicroSplitBlueprintSeed(), {
        classes: []
    });
});

test('split blueprint schema builders stay aligned with focus-bearing protocol shapes', () => {
    const nonEmptyStringSchema = z.string().trim().min(1);
    const focusReferenceSchema = z.object({
        triadizationFocus: nonEmptyStringSchema,
        recommendedOperation: z.enum(['aggregate', 'split', 'renormalize'])
    });
    const mesoClassBlueprintSchema = createMesoClassBlueprintSchema(nonEmptyStringSchema);
    const mesoPipelineSchema = createMesoPipelineSchema(nonEmptyStringSchema);
    const mesoSplitSchema = createMesoSplitSchema(
        focusReferenceSchema,
        mesoClassBlueprintSchema,
        mesoPipelineSchema
    );
    const microPropertyBlueprintSchema = createMicroPropertyBlueprintSchema(nonEmptyStringSchema);
    const microMethodBlueprintSchema = createMicroMethodBlueprintSchema(nonEmptyStringSchema);
    const microClassBlueprintSchema = createMicroClassBlueprintSchema(
        nonEmptyStringSchema,
        microPropertyBlueprintSchema,
        microMethodBlueprintSchema
    );
    const microSplitSchema = createMicroSplitSchema(focusReferenceSchema, microClassBlueprintSchema);
    const macroSplitSchema = createMacroSplitSchema(focusReferenceSchema, nonEmptyStringSchema);

    assert.equal(
        macroSplitSchema.parse({
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
            anchorNodeId: 'Workflow.execute',
            vertexGoal: 'Refine workflow triadization',
            leftBranch: ['Consumer.handle'],
            rightBranch: ['WorkflowConfig']
        }).anchorNodeId,
        'Workflow.execute'
    );
    assert.equal(
        mesoSplitSchema.parse({
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
            classes: [
                {
                    className: 'Workflow',
                    category: 'core',
                    responsibility: 'Coordinate workflow execution',
                    upstreams: ['RunCommand'],
                    downstreams: ['Consumer.handle']
                }
            ],
            pipelines: [
                {
                    pipelineId: 'Workflow.Main',
                    purpose: 'Coordinate workflow execution',
                    steps: ['Workflow.execute', 'Consumer.handle']
                }
            ]
        }).classes[0]?.className,
        'Workflow'
    );
    assert.equal(
        microSplitSchema.parse({
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
            classes: [
                {
                    className: 'Workflow',
                    staticRightBranch: [{ name: 'config', type: 'WorkflowConfig', role: 'orchestration constraints' }],
                    dynamicLeftBranch: [
                        {
                            name: 'execute',
                            demand: ['RunCommand'],
                            answer: ['WorkflowResult'],
                            responsibility: 'Run workflow execution'
                        }
                    ]
                }
            ]
        }).classes[0]?.className,
        'Workflow'
    );
});
