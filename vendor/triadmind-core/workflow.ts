import * as fs from 'fs';
import * as path from 'path';
import { readRequiredTextFile } from './artifactReaders';
import { ensureTriadConfig } from './config';
import { ensureGovernPolicyFile } from './governPolicy';
import { writeTriadizationArtifacts } from './triadization';
import { getWorkspacePaths, ImplementationHandoffInput, WorkspacePaths } from './workspace';
import {
    buildImplementationHandoffPrompt,
    buildImplementationPrompt,
    buildMacroPrompt,
    buildMasterPrompt,
    buildMesoPrompt,
    buildMicroPrompt,
    buildPipelinePrompt,
    buildProtocolPrompt
} from './workflowPromptBuilders';
import {
    getTriadizationFocusSeed,
    getTriadizationFocusSeedFromContext,
    resolveTriadizationFocusContext,
    safeRead
} from './workflowPromptSupport';
import {
    buildTriadSpecDocument,
    createDraftProtocolTemplate,
    createMacroSplitSeed,
    createMesoSplitSeed,
    createMicroSplitSeed,
    TriadizationFocusSeed
} from './workflowRightBranch';

export { getWorkspacePaths, type WorkspacePaths, type WorkflowPaths, type ImplementationHandoffInput } from './workspace';
export {
    buildImplementationHandoffPrompt,
    buildImplementationPrompt,
    buildMacroPrompt,
    buildMasterPrompt,
    buildMesoPrompt,
    buildMicroPrompt,
    buildPipelinePrompt,
    buildProtocolPrompt
} from './workflowPromptBuilders';

/**
 * @LeftBranch
 */
export function ensureTriadSpec(paths: WorkspacePaths, force = false) {
    fs.mkdirSync(paths.triadDir, { recursive: true });
    ensureTriadConfig(paths);
    ensureGovernPolicyFile(paths);

    if (force || !fs.existsSync(paths.triadSpecFile)) {
        fs.writeFileSync(paths.triadSpecFile, buildTriadSpec(paths.projectRoot), 'utf-8');
    }
}

/**
 * @LeftBranch
 */
export function createDraftTemplate(paths: WorkspacePaths, userDemand = '', force = false) {
    fs.mkdirSync(paths.triadDir, { recursive: true });

    if (!force && fs.existsSync(paths.draftFile)) {
        return;
    }

    fs.writeFileSync(
        paths.draftFile,
        JSON.stringify(createDraftProtocolTemplate(paths.projectRoot, paths.mapFile, userDemand), null, 2),
        'utf-8'
    );
}

/**
 * @LeftBranch
 */
export function writePromptPacket(paths: WorkspacePaths, userDemand: string) {
    ensureTriadSpec(paths, true);

    if (!fs.existsSync(paths.mapFile)) {
        throw new Error(`Cannot find triad-map.json: ${paths.mapFile}`);
    }

    const normalizedDemand = userDemand.trim();
    const previousDemand = safeRead(paths.demandFile);
    const shouldResetArtifacts = previousDemand.length > 0 && previousDemand !== normalizedDemand;

    createDraftTemplate(paths, userDemand, shouldResetArtifacts);
    const triadizationReport = writeTriadizationArtifacts(paths);
    ensureMultiPassTemplates(paths, userDemand, {
        resetArtifacts: shouldResetArtifacts,
        triadizationFocus: getTriadizationFocusSeed(triadizationReport)
    });

    const protocolPrompt = buildProtocolPrompt(paths, userDemand);
    const implementationPrompt = buildImplementationPrompt(paths, userDemand);
    const pipelinePrompt = buildPipelinePrompt(paths, userDemand);

    fs.writeFileSync(paths.promptFile, protocolPrompt, 'utf-8');
    fs.writeFileSync(paths.protocolTaskFile, protocolPrompt, 'utf-8');
    fs.writeFileSync(paths.pipelinePromptFile, pipelinePrompt, 'utf-8');
    fs.writeFileSync(paths.implementationPromptFile, implementationPrompt, 'utf-8');
    fs.writeFileSync(paths.demandFile, normalizedDemand, 'utf-8');

    writeMasterPrompt(paths);
}

/**
 * @LeftBranch
 */
export function resetPipelineArtifacts(paths: WorkspacePaths, userDemand: string) {
    resetPipelineArtifactsWithFocus(
        paths,
        userDemand,
        getTriadizationFocusSeedFromContext(resolveTriadizationFocusContext(paths))
    );
}

/**
 * @LeftBranch
 */
export function ensurePipelineArtifactSeeds(paths: WorkspacePaths, userDemand: string) {
    ensurePipelineArtifactSeedsWithFocus(
        paths,
        userDemand,
        getTriadizationFocusSeedFromContext(resolveTriadizationFocusContext(paths))
    );
}

/**
 * @LeftBranch
 */
export function writeImplementationHandoff(paths: WorkspacePaths, input: ImplementationHandoffInput) {
    const triadSpec = readRequiredTextFile(paths.triadSpecFile, { trim: true });
    const prompt = buildImplementationHandoffPrompt(paths, triadSpec, input);

    fs.writeFileSync(paths.handoffPromptFile, prompt, 'utf-8');
    fs.writeFileSync(
        paths.lastApplyFilesFile,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                files: input.changedFiles.map((file) => file.path)
            },
            null,
            2
        ),
        'utf-8'
    );

    writeMasterPrompt(paths);
}

/**
 * @LeftBranch
 */
export function writeMasterPrompt(paths: WorkspacePaths) {
    ensureTriadSpec(paths, true);
    fs.writeFileSync(paths.masterPromptFile, buildMasterPrompt(paths), 'utf-8');
}

/**
 * @LeftBranch
 */
export function ensureMultiPassTemplates(
    paths: WorkspacePaths,
    userDemand: string,
    options: { resetArtifacts?: boolean; triadizationFocus?: TriadizationFocusSeed } = {}
) {
    const triadizationFocus =
        options.triadizationFocus ?? getTriadizationFocusSeedFromContext(resolveTriadizationFocusContext(paths));

    if (options.resetArtifacts) {
        resetPipelineArtifactsWithFocus(paths, userDemand, triadizationFocus);
    } else {
        ensurePipelineArtifactSeedsWithFocus(paths, userDemand, triadizationFocus);
    }

    fs.writeFileSync(paths.macroPromptFile, buildMacroPrompt(paths, userDemand), 'utf-8');
    fs.writeFileSync(paths.mesoPromptFile, buildMesoPrompt(paths, userDemand), 'utf-8');
    fs.writeFileSync(paths.microPromptFile, buildMicroPrompt(paths, userDemand), 'utf-8');
}

function buildTriadSpec(projectRoot: string) {
    return buildTriadSpecDocument(path.basename(projectRoot));
}

function resetPipelineArtifactsWithFocus(
    paths: WorkspacePaths,
    userDemand: string,
    triadizationFocus?: TriadizationFocusSeed
) {
    fs.writeFileSync(
        paths.macroSplitFile,
        JSON.stringify(createMacroSplitSeed(userDemand, triadizationFocus), null, 2),
        'utf-8'
    );
    fs.writeFileSync(
        paths.mesoSplitFile,
        JSON.stringify(createMesoSplitSeed(triadizationFocus), null, 2),
        'utf-8'
    );
    fs.writeFileSync(
        paths.microSplitFile,
        JSON.stringify(createMicroSplitSeed(triadizationFocus), null, 2),
        'utf-8'
    );
}

function ensurePipelineArtifactSeedsWithFocus(
    paths: WorkspacePaths,
    userDemand: string,
    triadizationFocus?: TriadizationFocusSeed
) {
    writeJsonSeedIfMissing(paths.macroSplitFile, createMacroSplitSeed(userDemand, triadizationFocus));
    writeJsonSeedIfMissing(paths.mesoSplitFile, createMesoSplitSeed(triadizationFocus));
    writeJsonSeedIfMissing(paths.microSplitFile, createMicroSplitSeed(triadizationFocus));
}

function writeJsonSeedIfMissing(filePath: string, seed: unknown) {
    if (fs.existsSync(filePath)) {
        return;
    }

    fs.writeFileSync(filePath, JSON.stringify(seed, null, 2), 'utf-8');
}
