"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProtocolPrompt = exports.buildPipelinePrompt = exports.buildMicroPrompt = exports.buildMesoPrompt = exports.buildMasterPrompt = exports.buildMacroPrompt = exports.buildImplementationPrompt = exports.buildImplementationHandoffPrompt = exports.getWorkspacePaths = void 0;
exports.ensureTriadSpec = ensureTriadSpec;
exports.createDraftTemplate = createDraftTemplate;
exports.writePromptPacket = writePromptPacket;
exports.resetPipelineArtifacts = resetPipelineArtifacts;
exports.ensurePipelineArtifactSeeds = ensurePipelineArtifactSeeds;
exports.writeImplementationHandoff = writeImplementationHandoff;
exports.writeMasterPrompt = writeMasterPrompt;
exports.ensureMultiPassTemplates = ensureMultiPassTemplates;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const governPolicy_1 = require("./governPolicy");
const triadization_1 = require("./triadization");
const workflowPromptBuilders_1 = require("./workflowPromptBuilders");
const workflowPromptSupport_1 = require("./workflowPromptSupport");
const workflowRightBranch_1 = require("./workflowRightBranch");
var workspace_1 = require("./workspace");
Object.defineProperty(exports, "getWorkspacePaths", { enumerable: true, get: function () { return workspace_1.getWorkspacePaths; } });
var workflowPromptBuilders_2 = require("./workflowPromptBuilders");
Object.defineProperty(exports, "buildImplementationHandoffPrompt", { enumerable: true, get: function () { return workflowPromptBuilders_2.buildImplementationHandoffPrompt; } });
Object.defineProperty(exports, "buildImplementationPrompt", { enumerable: true, get: function () { return workflowPromptBuilders_2.buildImplementationPrompt; } });
Object.defineProperty(exports, "buildMacroPrompt", { enumerable: true, get: function () { return workflowPromptBuilders_2.buildMacroPrompt; } });
Object.defineProperty(exports, "buildMasterPrompt", { enumerable: true, get: function () { return workflowPromptBuilders_2.buildMasterPrompt; } });
Object.defineProperty(exports, "buildMesoPrompt", { enumerable: true, get: function () { return workflowPromptBuilders_2.buildMesoPrompt; } });
Object.defineProperty(exports, "buildMicroPrompt", { enumerable: true, get: function () { return workflowPromptBuilders_2.buildMicroPrompt; } });
Object.defineProperty(exports, "buildPipelinePrompt", { enumerable: true, get: function () { return workflowPromptBuilders_2.buildPipelinePrompt; } });
Object.defineProperty(exports, "buildProtocolPrompt", { enumerable: true, get: function () { return workflowPromptBuilders_2.buildProtocolPrompt; } });
/**
 * @LeftBranch
 */
function ensureTriadSpec(paths, force = false) {
    fs.mkdirSync(paths.triadDir, { recursive: true });
    (0, config_1.ensureTriadConfig)(paths);
    (0, governPolicy_1.ensureGovernPolicyFile)(paths);
    if (force || !fs.existsSync(paths.triadSpecFile)) {
        fs.writeFileSync(paths.triadSpecFile, buildTriadSpec(paths.projectRoot), 'utf-8');
    }
}
/**
 * @LeftBranch
 */
function createDraftTemplate(paths, userDemand = '', force = false) {
    fs.mkdirSync(paths.triadDir, { recursive: true });
    if (!force && fs.existsSync(paths.draftFile)) {
        return;
    }
    fs.writeFileSync(paths.draftFile, JSON.stringify((0, workflowRightBranch_1.createDraftProtocolTemplate)(paths.projectRoot, paths.mapFile, userDemand), null, 2), 'utf-8');
}
/**
 * @LeftBranch
 */
function writePromptPacket(paths, userDemand) {
    ensureTriadSpec(paths, true);
    if (!fs.existsSync(paths.mapFile)) {
        throw new Error(`Cannot find triad-map.json: ${paths.mapFile}`);
    }
    const normalizedDemand = userDemand.trim();
    const previousDemand = (0, workflowPromptSupport_1.safeRead)(paths.demandFile);
    const shouldResetArtifacts = previousDemand.length > 0 && previousDemand !== normalizedDemand;
    createDraftTemplate(paths, userDemand, shouldResetArtifacts);
    const triadizationReport = (0, triadization_1.writeTriadizationArtifacts)(paths);
    ensureMultiPassTemplates(paths, userDemand, {
        resetArtifacts: shouldResetArtifacts,
        triadizationFocus: (0, workflowPromptSupport_1.getTriadizationFocusSeed)(triadizationReport)
    });
    const protocolPrompt = (0, workflowPromptBuilders_1.buildProtocolPrompt)(paths, userDemand);
    const implementationPrompt = (0, workflowPromptBuilders_1.buildImplementationPrompt)(paths, userDemand);
    const pipelinePrompt = (0, workflowPromptBuilders_1.buildPipelinePrompt)(paths, userDemand);
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
function resetPipelineArtifacts(paths, userDemand) {
    resetPipelineArtifactsWithFocus(paths, userDemand, (0, workflowPromptSupport_1.getTriadizationFocusSeedFromContext)((0, workflowPromptSupport_1.resolveTriadizationFocusContext)(paths)));
}
/**
 * @LeftBranch
 */
function ensurePipelineArtifactSeeds(paths, userDemand) {
    ensurePipelineArtifactSeedsWithFocus(paths, userDemand, (0, workflowPromptSupport_1.getTriadizationFocusSeedFromContext)((0, workflowPromptSupport_1.resolveTriadizationFocusContext)(paths)));
}
/**
 * @LeftBranch
 */
function writeImplementationHandoff(paths, input) {
    const triadSpec = (0, artifactReaders_1.readRequiredTextFile)(paths.triadSpecFile, { trim: true });
    const prompt = (0, workflowPromptBuilders_1.buildImplementationHandoffPrompt)(paths, triadSpec, input);
    fs.writeFileSync(paths.handoffPromptFile, prompt, 'utf-8');
    fs.writeFileSync(paths.lastApplyFilesFile, JSON.stringify({
        generatedAt: new Date().toISOString(),
        files: input.changedFiles.map((file) => file.path)
    }, null, 2), 'utf-8');
    writeMasterPrompt(paths);
}
/**
 * @LeftBranch
 */
function writeMasterPrompt(paths) {
    ensureTriadSpec(paths, true);
    fs.writeFileSync(paths.masterPromptFile, (0, workflowPromptBuilders_1.buildMasterPrompt)(paths), 'utf-8');
}
/**
 * @LeftBranch
 */
function ensureMultiPassTemplates(paths, userDemand, options = {}) {
    const triadizationFocus = options.triadizationFocus ?? (0, workflowPromptSupport_1.getTriadizationFocusSeedFromContext)((0, workflowPromptSupport_1.resolveTriadizationFocusContext)(paths));
    if (options.resetArtifacts) {
        resetPipelineArtifactsWithFocus(paths, userDemand, triadizationFocus);
    }
    else {
        ensurePipelineArtifactSeedsWithFocus(paths, userDemand, triadizationFocus);
    }
    fs.writeFileSync(paths.macroPromptFile, (0, workflowPromptBuilders_1.buildMacroPrompt)(paths, userDemand), 'utf-8');
    fs.writeFileSync(paths.mesoPromptFile, (0, workflowPromptBuilders_1.buildMesoPrompt)(paths, userDemand), 'utf-8');
    fs.writeFileSync(paths.microPromptFile, (0, workflowPromptBuilders_1.buildMicroPrompt)(paths, userDemand), 'utf-8');
}
function buildTriadSpec(projectRoot) {
    return (0, workflowRightBranch_1.buildTriadSpecDocument)(path.basename(projectRoot));
}
function resetPipelineArtifactsWithFocus(paths, userDemand, triadizationFocus) {
    fs.writeFileSync(paths.macroSplitFile, JSON.stringify((0, workflowRightBranch_1.createMacroSplitSeed)(userDemand, triadizationFocus), null, 2), 'utf-8');
    fs.writeFileSync(paths.mesoSplitFile, JSON.stringify((0, workflowRightBranch_1.createMesoSplitSeed)(triadizationFocus), null, 2), 'utf-8');
    fs.writeFileSync(paths.microSplitFile, JSON.stringify((0, workflowRightBranch_1.createMicroSplitSeed)(triadizationFocus), null, 2), 'utf-8');
}
function ensurePipelineArtifactSeedsWithFocus(paths, userDemand, triadizationFocus) {
    writeJsonSeedIfMissing(paths.macroSplitFile, (0, workflowRightBranch_1.createMacroSplitSeed)(userDemand, triadizationFocus));
    writeJsonSeedIfMissing(paths.mesoSplitFile, (0, workflowRightBranch_1.createMesoSplitSeed)(triadizationFocus));
    writeJsonSeedIfMissing(paths.microSplitFile, (0, workflowRightBranch_1.createMicroSplitSeed)(triadizationFocus));
}
function writeJsonSeedIfMissing(filePath, seed) {
    if (fs.existsSync(filePath)) {
        return;
    }
    fs.writeFileSync(filePath, JSON.stringify(seed, null, 2), 'utf-8');
}
//# sourceMappingURL=workflow.js.map