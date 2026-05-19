import { TriadConfig, TriadLanguage } from './config';
import type { TriadNodeEvidence } from './protocolRightBranch';
export interface TreeSitterTriadNode {
    nodeId: string;
    category: string;
    sourcePath: string;
    fission: {
        problem: string;
        demand: string[];
        answer: string[];
        evidence?: TriadNodeEvidence;
    };
    topology?: {
        foldedLeaves?: string[];
    };
}
type TriadNode = TreeSitterTriadNode;
export interface TreeSitterParseResult {
    language: TriadLanguage;
    leafNodes: TreeSitterTriadNode[];
    capabilityNodes: TreeSitterTriadNode[];
    projectedNodes: TreeSitterTriadNode[];
    diagnostics: TreeSitterParseDiagnostic[];
    fileCount: number;
    scanUnit: string;
}
export interface TreeSitterParseDiagnostic {
    level: 'info' | 'warning';
    code: string;
    message: string;
    sourcePath?: string;
    nodeId?: string;
    originalCategory?: string;
    resolvedCategory?: string;
}
export declare function runTreeSitterParser(language: TriadLanguage, targetDir: string, outputPath: string, config: TriadConfig): void;
export declare function collectTreeSitterParseResult(language: TriadLanguage, targetDir: string, config: TriadConfig): TreeSitterParseResult;
export declare function runTreeSitterTypeScriptParser(targetDir: string, outputPath: string, config: TriadConfig): void;
export declare function applyGhostDemandGovernance(nodeId: string, sourcePath: string, demand: string[], answer: string[], config?: TriadConfig): {
    demand: string[];
    ghostReads: {
        raw: string;
        mode: "read" | "read_write";
        target: string;
        valueType: string;
        retainedInDemand: boolean;
        score: number;
    }[];
};
export declare function canonicalizeTriadNodes(nodes: TriadNode[], config: TriadConfig): {
    nodes: TreeSitterTriadNode[];
    diagnostics: TreeSitterParseDiagnostic[];
};
export {};
