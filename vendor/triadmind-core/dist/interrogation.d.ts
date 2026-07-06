import { DashboardOptions } from './visualizer';
import { WorkspacePaths } from './workspace';
import type { UpgradeProtocol } from './protocol';
export type InterrogationWorkflowStage = 'create' | 'modify' | 'unknown';
export type InterrogationStatus = 'questioning' | 'ready_for_impact' | 'impact_review' | 'approved_for_development';
export interface InterrogationQuestion {
    id: string;
    question: string;
    rationale: string;
    required: boolean;
}
export interface InterrogationAnswer {
    questionId: string;
    answer: string;
}
export interface ClarifiedRequirement {
    summary: string;
    inScope: string[];
    constraints: string[];
    nonGoals: string[];
    successSignals: string[];
    topologyNotes: string[];
}
export interface InterrogationStateArtifact {
    schemaVersion: '1.0';
    generatedAt: string;
    updatedAt: string;
    project: string;
    userDemand: string;
    workflowStage: InterrogationWorkflowStage;
    status: InterrogationStatus;
    topologyFeedback: {
        summaryLines: string[];
        abstractionMatchesJson: string;
        recommendationsJson: string;
        protocolSeedActionsJson: string;
    };
    questionPlan: InterrogationQuestion[];
    answers: InterrogationAnswer[];
    clarifiedRequirement?: ClarifiedRequirement;
    impactDemand?: string;
    impactFiles?: {
        impactMapFile: string;
        impactVisualizerFile: string;
    };
    approvedAt?: string;
}
export interface InterrogationRunOptions {
    answersFile?: string;
    llm?: string;
    dashboardOptions?: DashboardOptions;
}
export interface InterrogationRunResult {
    status: 'pending_answers' | 'pending_impact_protocol' | 'impact_ready';
    demand: string;
    promptFile: string;
    stateFile: string;
    impactMapFile?: string;
    impactVisualizerFile?: string;
    summary: string[];
    state: InterrogationStateArtifact;
}
export interface InterrogationGateAssessment {
    hasExplicitGate: boolean;
    requiresApproval: boolean;
    bypassedForSmallImpact: boolean;
    maxImpactEdgeCount?: number;
    autoApproveMaxEdgeCount: number;
}
export declare function runInterrogation(paths: WorkspacePaths, demand: string, options?: InterrogationRunOptions): Promise<InterrogationRunResult>;
export declare function loadInterrogationState(paths: WorkspacePaths): InterrogationStateArtifact | undefined;
export declare function reviewInterrogation(paths: WorkspacePaths): InterrogationStateArtifact | undefined;
export declare function approveInterrogation(paths: WorkspacePaths): InterrogationStateArtifact;
export declare function assertInterrogationApproval(paths: WorkspacePaths, protocol: UpgradeProtocol): void;
export declare function assessInterrogationRequirement(protocol: UpgradeProtocol, autoApproveMaxEdgeCount?: number): InterrogationGateAssessment;
