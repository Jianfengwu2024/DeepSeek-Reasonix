import { TriadLanguage } from './config';
import { TriadLifecycle, TriadNodeDefinition } from './protocol';
export interface TriadOperationIR {
    nodeId: string;
    name: string;
    demand: string[];
    answer: string[];
    responsibility: string;
    lifecycle?: TriadLifecycle;
}
export interface TriadVertexIR {
    nodeId: string;
    category?: string;
    sourcePath?: string;
    lifecycle?: TriadLifecycle;
    container: {
        kind: 'class' | 'module';
        name: string;
    };
    staticRightBranch: string[];
    dynamicLeftBranch: TriadOperationIR[];
}
export interface TriadTopologyIR {
    language: TriadLanguage;
    vertices: TriadVertexIR[];
}
export declare function buildTopologyIR(nodes: TriadNodeDefinition[], language: TriadLanguage): TriadTopologyIR;
