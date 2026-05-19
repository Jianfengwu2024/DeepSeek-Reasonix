import { ImplementationHandoffInput, WorkspacePaths } from './workspace';
export declare function buildProtocolPrompt(paths: WorkspacePaths, userDemand: string): string;
export declare function buildImplementationPrompt(paths: WorkspacePaths, userDemand: string): string;
export declare function buildPipelinePrompt(paths: WorkspacePaths, userDemand: string): string;
export declare function buildMasterPrompt(paths: WorkspacePaths): string;
export declare function buildImplementationHandoffPrompt(paths: WorkspacePaths, triadSpec: string, input: ImplementationHandoffInput): string;
export declare function buildMacroPrompt(paths: WorkspacePaths, userDemand: string): string;
export declare function buildMesoPrompt(paths: WorkspacePaths, userDemand: string): string;
export declare function buildMicroPrompt(paths: WorkspacePaths, userDemand: string): string;
