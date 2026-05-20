import { UpgradeProtocol } from './protocol';
import { TriadLifecycle } from './protocolRightBranch';
export type NodeStatus = 'existing' | 'new' | 'modified' | 'reused' | 'protocol' | 'left_branch' | 'right_branch' | 'macro';
export type EdgeType = 'create_child' | 'reuse' | 'modify' | 'protocol_target' | 'triad_left' | 'triad_right' | 'renormalize_absorb' | 'renormalize_contract' | 'producer_consumer';
export type TriadNodeKind = 'vertex' | 'left_branch' | 'right_branch' | 'protocol' | 'macro';
export type VisualizerMode = 'review' | 'impact';
export interface TriadMapNode {
    nodeId: string;
    category?: string;
    sourcePath?: string;
    lifecycle?: TriadLifecycle;
    fission?: {
        problem?: string;
        demand?: string[];
        answer?: string[];
    };
}
export interface DashboardOptions {
    defaultView?: 'architecture' | 'leaf';
    showIsolatedCapabilities?: boolean;
    fullContractEdges?: boolean;
    fastMode?: boolean;
    strictFingerprint?: boolean;
}
export interface KnowledgeNode {
    id: string;
    label: string;
    status: NodeStatus;
    lifecycle: TriadLifecycle;
    kind: TriadNodeKind;
    category: string;
    sourcePath: string;
    problem: string;
    demand: string[];
    answer: string[];
    community: string;
    communityName: string;
    triadOwner: string;
    branchTitle: string;
    absorbedNodes: string[];
    rationale: string;
}
export interface KnowledgeEdge {
    from: string;
    to: string;
    type: EdgeType;
    label: string;
    title: string;
    highlighted: boolean;
    lifecycle: TriadLifecycle;
    hidden?: boolean;
}
export interface VisualizerGraph {
    nodes: Array<KnowledgeNode & {
        degree: number;
        hidden: boolean;
    }>;
    edges: Array<KnowledgeEdge>;
    legend: Array<{
        cid: string;
        label: string;
        color: string;
        count: number;
    }>;
    stats: {
        nodes: number;
        edges: number;
        vertices: number;
        macroNodes: number;
        branchNodes: number;
        newNodes: number;
        modifiedNodes: number;
        reusedNodes: number;
        cappedContractEdges: number;
        branchCompression: boolean;
    };
}
export interface ImpactDashboardRenderResult {
    graph: VisualizerGraph;
    previewMap: TriadMapNode[];
    outputPath: string;
}
export declare function generateDashboard(mapPath: string, protocolPath: string, outputPath: string, dashboardOptions?: DashboardOptions): void;
export declare function generateImpactDashboard(mapPath: string, protocol: UpgradeProtocol, outputPath: string, dashboardOptions?: DashboardOptions): ImpactDashboardRenderResult;
