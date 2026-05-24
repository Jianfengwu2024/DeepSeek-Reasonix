import * as path from 'path';

export interface WorkspacePaths {
    projectRoot: string;
    triadDir: string;
    agentsFile: string;
    skillsFile: string;
    cacheDir: string;
    syncCacheFile: string;
    snapshotDir: string;
    snapshotIndexFile: string;
    agentRulesFile: string;
    selfBootstrapFile: string;
    selfBootstrapProtocolFile: string;
    cursorRulesDir: string;
    cursorRuleFile: string;
    configFile: string;
    profileFile: string;
    mapFile: string;
    leafMapFile: string;
    triadDiagnosticsFile: string;
    runtimeMapFile: string;
    runtimeVisualizerFile: string;
    runtimeDiagnosticsFile: string;
    sessionBootstrapShellFile: string;
    sessionBootstrapPs1File: string;
    sessionBootstrapCmdFile: string;
    bootstrapVerifyFile: string;
    governPolicyFile: string;
    governReportFile: string;
    governAuditFile: string;
    governFixesFile: string;
    coverageReportFile: string;
    viewMapFile: string;
    viewMapDiagnosticsFile: string;
    verifyBaselineFile: string;
    trendFile: string;
    trendReportFile: string;
    dreamReportFile: string;
    dreamDiagnosticsFile: string;
    dreamProposalsFile: string;
    dreamFeedbackFile: string;
    dreamStateFile: string;
    dreamAutoStateFile: string;
    dreamLockFile: string;
    dreamDaemonPidFile: string;
    dreamDaemonLogFile: string;
    dreamDaemonStateFile: string;
    dreamVisualizerFile: string;
    abstractionMemoryFile: string;
    projectAbsToolkitFile: string;
    projectAbsToolkitMarkdownFile: string;
    projectAbsToolkitDir: string;
    projectAbsToolkitTaxonomyFile: string;
    impactMapFile: string;
    impactProtocolFile: string;
    impactPromptFile: string;
    impactVisualizerFile: string;
    draftFile: string;
    macroSplitFile: string;
    mesoSplitFile: string;
    microSplitFile: string;
    approvedProtocolFile: string;
    visualizerFile: string;
    triadizationReportFile: string;
    triadizationTaskFile: string;
    triadizationSessionFile: string;
    triadizationConfirmationFile: string;
    triadSpecFile: string;
    promptFile: string;
    protocolTaskFile: string;
    macroPromptFile: string;
    mesoPromptFile: string;
    microPromptFile: string;
    pipelinePromptFile: string;
    implementationPromptFile: string;
    handoffPromptFile: string;
    masterPromptFile: string;
    runtimeErrorFile: string;
    healingReportFile: string;
    healingPromptFile: string;
    renormalizeProtocolFile: string;
    renormalizeReportFile: string;
    renormalizeTaskFile: string;
    renormalizePreviewProtocolFile: string;
    renormalizeVisualizerFile: string;
    convergeTaskFile: string;
    lastApplyFilesFile: string;
    demandFile: string;
}

export type TriadConfigPaths = Pick<WorkspacePaths, 'projectRoot' | 'triadDir' | 'configFile' | 'profileFile'>;
export type BootstrapPaths = Pick<
    WorkspacePaths,
    'projectRoot' | 'triadDir' | 'mapFile' | 'draftFile' | 'selfBootstrapFile' | 'selfBootstrapProtocolFile'
>;
export type WorkflowPaths = Pick<
    WorkspacePaths,
    | 'projectRoot'
    | 'triadDir'
    | 'configFile'
    | 'governPolicyFile'
    | 'mapFile'
    | 'triadizationReportFile'
    | 'triadSpecFile'
    | 'draftFile'
    | 'macroSplitFile'
    | 'mesoSplitFile'
    | 'microSplitFile'
    | 'promptFile'
    | 'protocolTaskFile'
    | 'macroPromptFile'
    | 'mesoPromptFile'
    | 'microPromptFile'
    | 'pipelinePromptFile'
    | 'implementationPromptFile'
    | 'handoffPromptFile'
    | 'masterPromptFile'
    | 'lastApplyFilesFile'
    | 'demandFile'
>;
export type TriadizationPaths = Pick<
    WorkspacePaths,
    | 'projectRoot'
    | 'triadDir'
    | 'configFile'
    | 'profileFile'
    | 'mapFile'
    | 'dreamFeedbackFile'
    | 'triadizationReportFile'
    | 'triadizationTaskFile'
    | 'triadizationSessionFile'
    | 'triadizationConfirmationFile'
>;
export type CoveragePaths = Pick<
    WorkspacePaths,
    'projectRoot' | 'triadDir' | 'configFile' | 'profileFile' | 'mapFile' | 'runtimeMapFile' | 'coverageReportFile'
>;
export type ViewMapPaths = Pick<
    WorkspacePaths,
    | 'projectRoot'
    | 'triadDir'
    | 'configFile'
    | 'profileFile'
    | 'mapFile'
    | 'leafMapFile'
    | 'runtimeMapFile'
    | 'viewMapFile'
    | 'viewMapDiagnosticsFile'
>;
export type VerifyPaths = Pick<
    WorkspacePaths,
    | 'projectRoot'
    | 'triadDir'
    | 'configFile'
    | 'profileFile'
    | 'mapFile'
    | 'runtimeMapFile'
    | 'runtimeDiagnosticsFile'
    | 'draftFile'
    | 'microSplitFile'
    | 'verifyBaselineFile'
>;
export type GovernPaths = Pick<
    WorkspacePaths,
    | 'projectRoot'
    | 'triadDir'
    | 'configFile'
    | 'profileFile'
    | 'governPolicyFile'
    | 'governReportFile'
    | 'governAuditFile'
    | 'governFixesFile'
    | 'coverageReportFile'
    | 'viewMapFile'
    | 'runtimeMapFile'
    | 'runtimeDiagnosticsFile'
    | 'mapFile'
    | 'verifyBaselineFile'
>;
export type RuntimeArtifactPaths = Pick<
    WorkspacePaths,
    | 'projectRoot'
    | 'triadDir'
    | 'configFile'
    | 'profileFile'
    | 'governPolicyFile'
    | 'runtimeMapFile'
    | 'runtimeDiagnosticsFile'
    | 'viewMapFile'
    | 'viewMapDiagnosticsFile'
    | 'convergeTaskFile'
    | 'mapFile'
    | 'triadSpecFile'
>;
export type DreamPaths = Pick<
    WorkspacePaths,
    | 'projectRoot'
    | 'dreamReportFile'
    | 'dreamDiagnosticsFile'
    | 'dreamProposalsFile'
    | 'dreamFeedbackFile'
    | 'dreamStateFile'
    | 'dreamAutoStateFile'
    | 'dreamLockFile'
    | 'dreamDaemonPidFile'
    | 'dreamDaemonLogFile'
    | 'dreamDaemonStateFile'
    | 'dreamVisualizerFile'
    | 'impactMapFile'
    | 'impactProtocolFile'
    | 'impactPromptFile'
    | 'impactVisualizerFile'
>;

export interface ImplementationHandoffInput {
    userDemand: string;
    approvedProtocolJson: string;
    triadMapJson: string;
    changedFiles: Array<{
        path: string;
        content: string;
    }>;
}

const PROJECT_ROOT_FILE_MAP = {
    agentsFile: 'AGENTS.md',
    skillsFile: 'skills.md'
} as const;

const PROJECT_ROOT_DIR_MAP = {
    cursorRulesDir: ['.cursor', 'rules']
} as const;

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
} as const;

export function getWorkspacePaths(projectRoot: string): WorkspacePaths {
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

export function normalizePath(input: string) {
    return input.replace(/\\/g, '/');
}

function resolveRelativePathMap<T extends Record<string, string | readonly string[]>>(baseDir: string, mapping: T) {
    return Object.fromEntries(
        Object.entries(mapping).map(([key, value]) => {
            const resolvedValue = Array.isArray(value)
                ? path.join(baseDir, ...[...value])
                : path.join(baseDir, value as string);
            return [key, resolvedValue];
        })
    ) as { [K in keyof T]: string };
}
