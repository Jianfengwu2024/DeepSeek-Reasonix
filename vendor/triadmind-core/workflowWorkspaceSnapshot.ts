import * as fs from 'fs';
import * as path from 'path';
import { readRequiredTextFile, readTextIfExists } from './artifactReaders';
import { analyzeWorkspaceStage, StageAnalysisResult } from './stage';
import { loadDreamFeedbackLedger, formatDreamFeedbackRules } from './dreamFeedbackSupport';
import { normalizePath, WorkspacePaths } from './workspace';
import {
    PromptTriadizationFocusContext,
    readChangedFiles,
    resolveTriadizationFocusContext,
    safeRead
} from './workflowPromptSupport';

export interface TriadPlanningPromptContext {
    triadSpec: string;
    configJson: string;
    mapJson: string;
    triadizationReportJson: string;
    triadizationSessionJson: string;
    triadizationTask: string;
    triadizationFocus?: PromptTriadizationFocusContext;
    stage: StageAnalysisResult;
    userDemand: string;
    macroJson: string;
    mesoJson: string;
    microJson: string;
}

export interface MasterPromptContext {
    triadSpec: string;
    triadConfig: string;
    triadMap: string;
    latestDemand: string;
    draftProtocol: string;
    macroSplit: string;
    mesoSplit: string;
    microSplit: string;
    triadizationReport: string;
    triadizationSession: string;
    triadizationTask: string;
    pipelinePrompt: string;
    approvedProtocol: string;
    handoffPrompt: string;
    applyFilesManifest: string;
    triadizationFocus?: PromptTriadizationFocusContext;
    stage: StageAnalysisResult;
    changedFilesSection: string;
    dreamFeedbackRules: string;
}

export function createTriadPlanningPromptContext(
    paths: WorkspacePaths,
    userDemand: string
): TriadPlanningPromptContext {
    const triadizationReportJson = safeRead(paths.triadizationReportFile);
    const triadizationSessionJson = safeRead(paths.triadizationSessionFile);

    return {
        triadSpec: readRequiredFile(paths.triadSpecFile),
        configJson: safeRead(paths.configFile),
        mapJson: readRequiredFile(paths.mapFile),
        triadizationReportJson,
        triadizationSessionJson,
        triadizationTask: safeRead(paths.triadizationTaskFile),
        triadizationFocus: resolveTriadizationFocusContext(paths, triadizationReportJson),
        stage: createStageAnalysis(paths, userDemand.trim(), triadizationReportJson, triadizationSessionJson),
        userDemand: userDemand.trim(),
        macroJson: safeRead(paths.macroSplitFile),
        mesoJson: safeRead(paths.mesoSplitFile),
        microJson: safeRead(paths.microSplitFile)
    };
}

export function createMasterPromptContext(paths: WorkspacePaths): MasterPromptContext {
    const latestDemand = safeRead(paths.demandFile);
    const triadizationReport = safeRead(paths.triadizationReportFile);
    const triadizationSession = safeRead(paths.triadizationSessionFile);
    const changedFiles = readChangedFiles(paths);

    return {
        triadSpec: safeRead(paths.triadSpecFile),
        triadConfig: safeRead(paths.configFile),
        triadMap: safeRead(paths.mapFile),
        latestDemand,
        draftProtocol: safeRead(paths.draftFile),
        macroSplit: safeRead(paths.macroSplitFile),
        mesoSplit: safeRead(paths.mesoSplitFile),
        microSplit: safeRead(paths.microSplitFile),
        triadizationReport,
        triadizationSession,
        triadizationTask: safeRead(paths.triadizationTaskFile),
        pipelinePrompt: safeRead(paths.pipelinePromptFile),
        approvedProtocol: safeRead(paths.approvedProtocolFile),
        handoffPrompt: safeRead(paths.handoffPromptFile),
        applyFilesManifest: safeRead(paths.lastApplyFilesFile),
        triadizationFocus: resolveTriadizationFocusContext(paths, triadizationReport),
        stage: createStageAnalysis(paths, latestDemand, triadizationReport, triadizationSession),
        dreamFeedbackRules: formatDreamFeedbackRules(loadDreamFeedbackLedger(paths).ledger),
        changedFilesSection: renderFileSnippetSections(
            changedFiles.map((file: string) => {
                const fullPath = path.join(paths.projectRoot, file);
                return {
                    label: 'Changed File',
                    path: normalizePath(file),
                    content: readTextIfExists(fullPath, { trim: true })
                };
            }),
            '当前没有记录到最近一次 apply 直接涉及的骨架文件。'
        )
    };
}

function createStageAnalysis(
    paths: WorkspacePaths,
    latestDemand: string,
    triadizationReport: string,
    triadizationSession: string
) {
    return analyzeWorkspaceStage({
        latestDemand,
        draftProtocol: safeRead(paths.draftFile),
        macroSplit: safeRead(paths.macroSplitFile),
        mesoSplit: safeRead(paths.mesoSplitFile),
        microSplit: safeRead(paths.microSplitFile),
        approvedProtocol: safeRead(paths.approvedProtocolFile),
        triadizationReport,
        triadizationSession
    });
}

function renderFileSnippetSections(
    entries: Array<{ label: string; path: string; content: string }>,
    emptyMessage: string
) {
    if (entries.length === 0) {
        return emptyMessage;
    }

    return entries
        .map((entry) => [`[${entry.label}] ${entry.path}`, '```ts', entry.content.trim(), '```'].join('\n'))
        .join('\n\n');
}

function readRequiredFile(filePath: string) {
    return readRequiredTextFile(filePath, { trim: true });
}
