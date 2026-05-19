import { StageAnalysisResult } from './stage';
import { WorkspacePaths } from './workspace';
import { PromptTriadizationFocusContext } from './workflowPromptSupport';
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
export declare function createTriadPlanningPromptContext(paths: WorkspacePaths, userDemand: string): TriadPlanningPromptContext;
export declare function createMasterPromptContext(paths: WorkspacePaths): MasterPromptContext;
