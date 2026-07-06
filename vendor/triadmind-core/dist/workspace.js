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
exports.getWorkspacePaths = getWorkspacePaths;
exports.normalizePath = normalizePath;
const path = __importStar(require("path"));
const PROJECT_ROOT_FILE_MAP = {
    agentsFile: 'AGENTS.md',
    skillsFile: 'skills.md'
};
const PROJECT_ROOT_DIR_MAP = {
    cursorRulesDir: ['.cursor', 'rules']
};
const TRIAD_FILE_MAP = {
    cacheDir: 'cache',
    syncCacheFile: ['cache', 'sync-manifest.json'],
    snapshotDir: 'snapshots',
    snapshotIndexFile: ['snapshots', 'index.json'],
    agentRulesFile: 'agent-rules.md',
    selfBootstrapFile: 'self-bootstrap.md',
    selfBootstrapProtocolFile: 'self-bootstrap-protocol.json',
    configFile: 'config.json',
    profileFile: 'profile.json',
    mapFile: 'triad-map.json',
    leafMapFile: 'leaf-map.json',
    triadDiagnosticsFile: 'triad-diagnostics.json',
    runtimeMapFile: 'runtime-map.json',
    runtimeVisualizerFile: 'runtime-visualizer.html',
    runtimeDiagnosticsFile: 'runtime-diagnostics.json',
    sessionBootstrapShellFile: 'session-bootstrap.sh',
    sessionBootstrapPs1File: 'session-bootstrap.ps1',
    sessionBootstrapCmdFile: 'session-bootstrap.cmd',
    bootstrapVerifyFile: 'bootstrap-verify.json',
    governPolicyFile: 'govern-policy.json',
    governReportFile: 'govern-report.json',
    governAuditFile: 'govern-audit.log',
    governFixesFile: 'govern-fixes.patch',
    coverageReportFile: 'coverage-report.json',
    viewMapFile: 'view-map.json',
    viewMapDiagnosticsFile: 'view-map-diagnostics.json',
    verifyBaselineFile: 'verify-baseline.json',
    trendFile: 'trend.json',
    trendReportFile: 'trend-report.md',
    dreamReportFile: 'dream-report.json',
    dreamDiagnosticsFile: 'dream-diagnostics.json',
    dreamProposalsFile: 'dream-proposals.json',
    dreamFeedbackFile: 'dream-feedback.json',
    dreamStateFile: 'dream-state.json',
    dreamAutoStateFile: 'dream-auto-state.json',
    dreamLockFile: 'dream.lock',
    dreamDaemonPidFile: 'dream-daemon.pid.json',
    dreamDaemonLogFile: 'dream-daemon.log',
    dreamDaemonStateFile: 'dream-daemon-state.json',
    dreamVisualizerFile: 'dream-visualizer.html',
    abstractionMemoryFile: 'abstraction-memory.json',
    projectAbsToolkitFile: 'project-abs-toolkit.json',
    projectAbsToolkitMarkdownFile: 'project-abs-toolkit.md',
    projectAbsToolkitDir: 'project-abs-toolkit',
    projectAbsToolkitTaxonomyFile: 'project-abs-toolkit-taxonomy.json',
    impactMapFile: 'impact-map.json',
    impactProtocolFile: 'impact-protocol.json',
    impactPromptFile: 'impact-prompt.md',
    impactVisualizerFile: 'impact-visualizer.html',
    interrogationPromptFile: 'interrogation-prompt.md',
    interrogationStateFile: 'interrogation-state.json',
    draftFile: 'draft-protocol.json',
    macroSplitFile: 'macro-split.json',
    mesoSplitFile: 'meso-split.json',
    microSplitFile: 'micro-split.json',
    approvedProtocolFile: 'last-approved-protocol.json',
    visualizerFile: 'visualizer.html',
    triadizationReportFile: 'triadization-report.json',
    triadizationTaskFile: 'triadization-task.md',
    triadizationSessionFile: 'triadization-session.json',
    triadizationConfirmationFile: 'triadization-confirmation.json',
    triadSpecFile: 'triad.md',
    promptFile: 'upgrade-prompt.md',
    protocolTaskFile: 'protocol-task.md',
    macroPromptFile: 'macro-split.md',
    mesoPromptFile: 'meso-split.md',
    microPromptFile: 'micro-split.md',
    pipelinePromptFile: 'multi-pass-pipeline.md',
    implementationPromptFile: 'implementation-prompt.md',
    handoffPromptFile: 'implementation-handoff.md',
    masterPromptFile: 'master-prompt.md',
    runtimeErrorFile: 'runtime-error.log',
    healingReportFile: 'healing-report.json',
    healingPromptFile: 'healing-prompt.md',
    renormalizeProtocolFile: 'renormalize-protocol.json',
    renormalizeReportFile: 'renormalize-report.md',
    renormalizeTaskFile: 'renormalize-task.md',
    renormalizePreviewProtocolFile: 'renormalize-preview-protocol.json',
    renormalizeVisualizerFile: 'renormalize-visualizer.html',
    convergeTaskFile: 'converge-task.md',
    lastApplyFilesFile: 'last-apply-files.json',
    demandFile: 'latest-demand.txt'
};
function getWorkspacePaths(projectRoot) {
    const triadDir = path.join(projectRoot, '.triadmind');
    const projectRootFiles = resolveRelativePathMap(projectRoot, PROJECT_ROOT_FILE_MAP);
    const projectRootDirs = resolveRelativePathMap(projectRoot, PROJECT_ROOT_DIR_MAP);
    const triadFiles = resolveRelativePathMap(triadDir, TRIAD_FILE_MAP);
    return {
        projectRoot,
        triadDir,
        ...projectRootFiles,
        ...triadFiles,
        ...projectRootDirs,
        cursorRuleFile: path.join(projectRoot, '.cursor', 'rules', 'triadmind.mdc'),
    };
}
function normalizePath(input) {
    return input.replace(/\\/g, '/');
}
function resolveRelativePathMap(baseDir, mapping) {
    return Object.fromEntries(Object.entries(mapping).map(([key, value]) => {
        const resolvedValue = Array.isArray(value)
            ? path.join(baseDir, ...[...value])
            : path.join(baseDir, value);
        return [key, resolvedValue];
    }));
}
//# sourceMappingURL=workspace.js.map