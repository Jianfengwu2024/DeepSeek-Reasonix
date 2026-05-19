import { TriadConfig } from './config';
import { TriadTopologyIR } from './ir';
import { LanguageAdapter } from './languageAdapter';
export declare function createTypeScriptAdapter(): LanguageAdapter;
/**
 * TriadMind 自动生成骨架
 * 职责：执行 readTopologyIR 流程
 */
export declare function readTopologyIR(projectRoot: string): TriadTopologyIR;
/**
 * TriadMind 自动生成骨架
 * 职责：执行 parseTopology 流程
 */
export declare function parseTopology(projectRoot: string, outputPath?: string, configOverride?: TriadConfig): void;
/**
 * TriadMind 自动生成骨架
 * 职责：执行 applyUpgradeProtocol 流程
 */
export declare function applyUpgradeProtocol(projectRoot: string, protocolPath?: string): {
    changedFiles: string[];
};
