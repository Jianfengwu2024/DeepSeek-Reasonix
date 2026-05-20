import type { RuntimeMap } from './runtime/types';
import type { TopologyQualityNodeLike } from './topologyQuality';
import type { DraftProtocolLike, MicroSplitLike } from './triadizationFocus';
export interface RuntimeDiagnosticLike {
    level?: string;
    code?: string;
    extractor?: string;
    message?: string;
}
export interface VerifyBaselineArtifact {
    runtime_unmatched_route_count: number;
}
export interface ChangedFilesArtifact {
    files?: unknown[];
}
export interface TextArtifactReadOptions {
    trim?: boolean;
}
export type ArtifactReadStatus = 'ok' | 'missing' | 'parse_failed' | 'shape_invalid';
export interface ArtifactReadResult<T> {
    status: ArtifactReadStatus;
    value?: T;
}
export declare function readTextIfExists(filePath: string, options?: TextArtifactReadOptions): string;
export declare function readRequiredTextFile(filePath: string, options?: TextArtifactReadOptions): string;
export declare function readSourceFileText(filePath: string): string;
export declare function parseJsonText<T>(content: string): T | undefined;
export declare function parseJsonTextStrict<T>(content: string): T;
export declare function readJsonFileStrict<T>(filePath: string): T;
export declare function readJsonIfExists<T = unknown>(filePath: string): T | undefined;
export declare function readJsonArrayArtifactResult<T = unknown>(filePath: string): ArtifactReadResult<T[]>;
export declare function readJsonObjectArtifactResult<T extends object = Record<string, unknown>>(filePath: string): ArtifactReadResult<T>;
export declare function readTriadNodesArtifactResult(filePath: string): ArtifactReadResult<TopologyQualityNodeLike[]>;
export declare function readRuntimeMapArtifactResult(filePath: string): ArtifactReadResult<RuntimeMap>;
export declare function readRuntimeDiagnosticsArtifactResult(filePath: string): ArtifactReadResult<RuntimeDiagnosticLike[]>;
export declare function readTriadNodesArtifact(filePath: string): TopologyQualityNodeLike[];
export declare function readRuntimeMapArtifact(filePath: string): RuntimeMap | undefined;
export declare function readRuntimeDiagnosticsArtifact(filePath: string): RuntimeDiagnosticLike[];
export declare function readDraftProtocolArtifact(filePath: string): DraftProtocolLike | undefined;
export declare function readMicroSplitArtifact(filePath: string): MicroSplitLike | undefined;
export declare function readVerifyBaselineArtifact(filePath: string): {
    runtime_unmatched_route_count: number;
} | undefined;
export declare function readChangedFilesArtifact(filePath: string): string[];
