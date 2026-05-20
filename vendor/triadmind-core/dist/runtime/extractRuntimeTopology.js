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
exports.extractRuntimeTopology = extractRuntimeTopology;
exports.getBuiltInRuntimeExtractors = getBuiltInRuntimeExtractors;
const path = __importStar(require("path"));
const config_1 = require("../config");
const workspace_1 = require("../workspace");
const filterRuntimeMapByView_1 = require("./filterRuntimeMapByView");
const runtimeUtils_1 = require("./runtimeUtils");
const httpRouteExtractor_1 = require("./extractors/httpRouteExtractor");
const frontendApiCallExtractor_1 = require("./extractors/frontendApiCallExtractor");
const taskQueueExtractor_1 = require("./extractors/taskQueueExtractor");
const workflowRegistryExtractor_1 = require("./extractors/workflowRegistryExtractor");
const resourceAccessExtractor_1 = require("./extractors/resourceAccessExtractor");
const configInfraExtractor_1 = require("./extractors/configInfraExtractor");
const collectRuntimeSourceFiles_1 = require("./collectRuntimeSourceFiles");
const runtimeDiagnostics_1 = require("./runtimeDiagnostics");
async function extractRuntimeTopology(projectRoot, options = {}) {
    const resolvedProjectRoot = path.resolve(projectRoot);
    const paths = (0, workspace_1.getWorkspacePaths)(resolvedProjectRoot);
    const config = (0, config_1.loadTriadConfig)(paths);
    const view = options.view ?? config.runtime.defaultView;
    const frameworkHint = options.frameworkHint ?? config.runtime.frameworkHints[0];
    const includeFrontend = options.includeFrontend ?? config.runtime.includeFrontend;
    const includeInfra = options.includeInfra ?? config.runtime.includeInfra;
    const diagnostics = [];
    const context = {
        projectRoot: resolvedProjectRoot,
        config,
        view,
        includeFrontend,
        includeInfra,
        frameworkHint,
        files: (0, collectRuntimeSourceFiles_1.collectRuntimeSourceFiles)(resolvedProjectRoot, config, diagnostics)
    };
    const extractors = options.extractors ?? getBuiltInRuntimeExtractors();
    const nodes = [];
    const edges = [];
    let detectedExtractorCount = 0;
    for (const extractor of extractors) {
        try {
            const detected = await extractor.detect(context);
            if (!detected) {
                continue;
            }
            detectedExtractorCount += 1;
            const patch = await extractor.extract(context);
            nodes.push(...(patch.nodes ?? []));
            edges.push(...(patch.edges ?? []));
            diagnostics.push(...(0, runtimeDiagnostics_1.normalizeRuntimeDiagnostics)(patch.diagnostics ?? [], extractor.name));
        }
        catch (error) {
            const diagnostic = {
                level: 'error',
                code: 'RUNTIME_EXTRACTOR_FAILED',
                extractor: extractor.name,
                message: error?.message ? String(error.message) : String(error)
            };
            diagnostics.push(diagnostic);
            if (config.runtime.failOnExtractorError) {
                throw new Error(`${extractor.name}: ${diagnostic.message}`);
            }
        }
    }
    if (frameworkHint && detectedExtractorCount === 0) {
        diagnostics.push({
            level: 'info',
            code: 'RUNTIME_FRAMEWORK_HINT_UNUSED',
            extractor: 'RuntimeOrchestrator',
            message: `Framework hint "${frameworkHint}" did not activate any runtime extractor`
        });
    }
    const fullMap = {
        schemaVersion: '1.0',
        project: path.basename(resolvedProjectRoot),
        generatedAt: new Date().toISOString(),
        view,
        nodes: (0, runtimeUtils_1.mergeRuntimeNodes)(nodes),
        edges: (0, runtimeUtils_1.mergeRuntimeEdges)(edges),
        diagnostics: (0, runtimeDiagnostics_1.normalizeRuntimeDiagnostics)(diagnostics, 'RuntimeOrchestrator')
    };
    return (0, filterRuntimeMapByView_1.filterRuntimeMapByView)(fullMap, view);
}
function getBuiltInRuntimeExtractors() {
    return [
        httpRouteExtractor_1.httpRouteExtractor,
        frontendApiCallExtractor_1.frontendApiCallExtractor,
        taskQueueExtractor_1.taskQueueExtractor,
        workflowRegistryExtractor_1.workflowRegistryExtractor,
        resourceAccessExtractor_1.resourceAccessExtractor,
        configInfraExtractor_1.configInfraExtractor
    ];
}
//# sourceMappingURL=extractRuntimeTopology.js.map