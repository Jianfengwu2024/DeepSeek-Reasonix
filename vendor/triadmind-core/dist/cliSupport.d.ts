import { TriadLanguage, TriadScanMode } from './config';
import { UpgradeProtocol } from './protocol';
import { DashboardOptions } from './visualizer';
import { WorkspacePaths } from './workspace';
export { resolveExpectedTriadizationFocus } from './triadizationFocusSupport';
export interface DashboardCliOptions {
    view?: string;
    showIsolated?: boolean;
    fullContractEdges?: boolean;
}
export declare function syncProjectTopology(paths: WorkspacePaths, force?: boolean, scanMode?: TriadScanMode): {
    changed: boolean;
    fileCount: number;
};
export declare function readCurrentTriadMap(paths: WorkspacePaths): import("./protocolRightBranch").TriadNodeDefinition[] | {
    [x: string]: unknown;
    nodeId: string;
    fission: {
        [x: string]: unknown;
        problem: string;
        demand: string[];
        answer: string[];
        evidence?: {
            [x: string]: unknown;
            ghostReads?: {
                [x: string]: unknown;
                raw?: string | undefined;
                mode?: string | undefined;
                target?: string | undefined;
                valueType?: string | undefined;
                retainedInDemand?: boolean | undefined;
                score?: number | undefined;
            }[] | undefined;
            promotionReasons?: string[] | undefined;
            abstraction?: {
                [x: string]: unknown;
                role?: string | undefined;
                signals?: string[] | undefined;
                implements?: string[] | undefined;
                extendsAbstract?: string[] | undefined;
                dependsOnAbstractions?: string[] | undefined;
                peerConcreteCalls?: string[] | undefined;
                variantCluster?: string | undefined;
                abstractionSignalCount?: number | undefined;
                concreteSignalCount?: number | undefined;
                interfaceCount?: number | undefined;
                abstractClassCount?: number | undefined;
                typeAliasCount?: number | undefined;
                concreteClassCount?: number | undefined;
                publicMethodCount?: number | undefined;
                topLevelExecutableCount?: number | undefined;
            } | undefined;
        } | undefined;
    };
    category?: string | undefined;
    sourcePath?: string | undefined;
    lifecycle?: "existing" | "proposed" | undefined;
}[];
export declare function prepareWorkspace(paths: WorkspacePaths, demand: string): void;
export declare function resolveDemand(demandParts: string[], optionDemand?: string, paths?: WorkspacePaths): string;
export declare function normalizeInvokeDemand(value: string): string;
export declare function openFile(filePath: string): Promise<void>;
export declare function dispatchProtocolApply(projectRoot: string, protocol: UpgradeProtocol): {
    language: TriadLanguage;
    displayName: string;
    changedFiles: string[];
};
export declare function assertNoTopologicalDegradation(paths: WorkspacePaths, previousMap: any[], lifecycle: 'init' | 'apply'): void;
export declare function warnBlastRadiusIfNeeded(paths: WorkspacePaths, protocol: UpgradeProtocol): void;
export declare function validateDraftProtocol(paths: WorkspacePaths): UpgradeProtocol;
export declare function assertTriadizationFocusGate(paths: WorkspacePaths): void;
export declare function writeHandoffPrompt(projectRoot: string, changedFiles?: string[], approvedProtocolJson?: string): void;
export declare function toDashboardOptions(options: DashboardCliOptions): DashboardOptions;
