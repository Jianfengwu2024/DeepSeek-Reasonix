import { TriadConfig } from './config';
import { TriadNodeDefinition, UpgradeProtocol } from './protocol';
import { WorkspacePaths } from './workspace';
interface NavigatorLlmGenerationOptions {
    paths: WorkspacePaths;
    demand: string;
    prompt: string;
    config: TriadConfig;
    existingNodes: TriadNodeDefinition[];
    llm?: string;
}
export interface NavigatorLlmGenerationResult {
    status: 'generated' | 'skipped';
    protocol?: UpgradeProtocol;
    note?: string;
}
export declare function tryGenerateNavigatorProtocol(options: NavigatorLlmGenerationOptions): Promise<NavigatorLlmGenerationResult>;
export {};
