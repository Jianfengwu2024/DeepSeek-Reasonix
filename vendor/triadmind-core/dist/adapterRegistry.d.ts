import { LanguageAdapter } from './languageAdapter';
import { WorkspacePaths } from './workspace';
/**
 * TriadMind 自动生成骨架
 * 职责：执行 registerAdapter 流程
 */
export declare function registerAdapter(adapter: LanguageAdapter): void;
/**
 * TriadMind 自动生成骨架
 * 职责：执行 resolveAdapter 流程
 */
export declare function resolveAdapter(pathsOrProjectRoot: WorkspacePaths | string): LanguageAdapter;
/**
 * TriadMind 自动生成骨架
 * 职责：执行 getAvailableAdapters 流程
 */
export declare function getAvailableAdapters(): LanguageAdapter[];
