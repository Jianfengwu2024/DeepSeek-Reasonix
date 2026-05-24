import * as fs from 'fs';
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
    zero_abstraction_hotspot_count?: number;
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

export function readTextIfExists(filePath: string, options: TextArtifactReadOptions = {}) {
    if (!fs.existsSync(filePath)) {
        return '';
    }

    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return options.trim ? content.trim() : content;
}

export function readRequiredTextFile(filePath: string, options: TextArtifactReadOptions = {}) {
    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return options.trim ? content.trim() : content;
}

export function readSourceFileText(filePath: string) {
    return readRequiredTextFile(filePath);
}

export function parseJsonText<T>(content: string) {
    if (!content.trim()) {
        return undefined;
    }

    try {
        return JSON.parse(content) as T;
    } catch {
        return undefined;
    }
}

export function parseJsonTextStrict<T>(content: string) {
    return JSON.parse(content) as T;
}

export function readJsonFileStrict<T>(filePath: string) {
    return parseJsonTextStrict<T>(readRequiredTextFile(filePath));
}

export function readJsonIfExists<T = unknown>(filePath: string) {
    const result = readJsonArtifactResult<T>(filePath);
    return result.status === 'ok' ? result.value : undefined;
}

export function readJsonArrayArtifactResult<T = unknown>(filePath: string): ArtifactReadResult<T[]> {
    const result = readJsonArtifactResult<unknown>(filePath);
    if (result.status !== 'ok') {
        return result as ArtifactReadResult<T[]>;
    }
    if (!Array.isArray(result.value)) {
        return {
            status: 'shape_invalid'
        };
    }
    return {
        status: 'ok',
        value: result.value as T[]
    };
}

export function readJsonObjectArtifactResult<T extends object = Record<string, unknown>>(
    filePath: string
): ArtifactReadResult<T> {
    const result = readJsonArtifactResult<unknown>(filePath);
    if (result.status !== 'ok') {
        return result as ArtifactReadResult<T>;
    }
    if (!result.value || typeof result.value !== 'object' || Array.isArray(result.value)) {
        return {
            status: 'shape_invalid'
        };
    }
    return {
        status: 'ok',
        value: result.value as T
    };
}

export function readTriadNodesArtifactResult(filePath: string): ArtifactReadResult<TopologyQualityNodeLike[]> {
    return readJsonArrayArtifactResult<TopologyQualityNodeLike>(filePath);
}

export function readRuntimeMapArtifactResult(filePath: string): ArtifactReadResult<RuntimeMap> {
    const result = readJsonObjectArtifactResult<RuntimeMap>(filePath);
    if (result.status !== 'ok') {
        return result;
    }

    const runtimeMap = result.value as RuntimeMap;
    if (!Array.isArray(runtimeMap.nodes) || !Array.isArray(runtimeMap.edges)) {
        return {
            status: 'shape_invalid'
        };
    }

    return {
        status: 'ok',
        value: runtimeMap
    };
}

export function readRuntimeDiagnosticsArtifactResult(filePath: string): ArtifactReadResult<RuntimeDiagnosticLike[]> {
    const result = readJsonArtifactResult<unknown>(filePath);
    if (result.status !== 'ok') {
        return result as ArtifactReadResult<RuntimeDiagnosticLike[]>;
    }

    if (Array.isArray(result.value)) {
        return {
            status: 'ok',
            value: result.value as RuntimeDiagnosticLike[]
        };
    }

    if (
        result.value &&
        typeof result.value === 'object' &&
        Array.isArray((result.value as { diagnostics?: unknown[] }).diagnostics)
    ) {
        return {
            status: 'ok',
            value: ((result.value as { diagnostics?: unknown[] }).diagnostics ?? []) as RuntimeDiagnosticLike[]
        };
    }

    return {
        status: 'shape_invalid'
    };
}

export function readTriadNodesArtifact(filePath: string) {
    const result = readTriadNodesArtifactResult(filePath);
    return result.value ?? ([] as TopologyQualityNodeLike[]);
}

export function readRuntimeMapArtifact(filePath: string) {
    const result = readRuntimeMapArtifactResult(filePath);
    return result.value;
}

export function readRuntimeDiagnosticsArtifact(filePath: string) {
    const result = readRuntimeDiagnosticsArtifactResult(filePath);
    return result.value ?? ([] as RuntimeDiagnosticLike[]);
}

export function readDraftProtocolArtifact(filePath: string) {
    const result = readJsonObjectArtifactResult<DraftProtocolLike>(filePath);
    if (result.status !== 'ok') {
        return undefined;
    }
    return result.value;
}

export function readMicroSplitArtifact(filePath: string) {
    const result = readJsonObjectArtifactResult<MicroSplitLike>(filePath);
    if (result.status !== 'ok') {
        return undefined;
    }
    return result.value;
}

export function readVerifyBaselineArtifact(filePath: string) {
    const result = readJsonObjectArtifactResult<{
        runtime_unmatched_route_count?: number;
        zero_abstraction_hotspot_count?: number;
    }>(filePath);
    if (result.status !== 'ok' || !result.value) {
        return undefined;
    }

    const unmatched = Number(result.value.runtime_unmatched_route_count);
    if (!Number.isFinite(unmatched) || unmatched < 0) {
        return undefined;
    }

    const zeroAbstractionHotspots = Number(result.value.zero_abstraction_hotspot_count);

    return {
        runtime_unmatched_route_count: Math.floor(unmatched),
        zero_abstraction_hotspot_count:
            Number.isFinite(zeroAbstractionHotspots) && zeroAbstractionHotspots >= 0
                ? Math.floor(zeroAbstractionHotspots)
                : undefined
    } satisfies VerifyBaselineArtifact;
}

export function readChangedFilesArtifact(filePath: string) {
    const result = readJsonObjectArtifactResult<ChangedFilesArtifact>(filePath);
    const files = result.status === 'ok' && result.value ? result.value.files : undefined;
    if (!Array.isArray(files)) {
        return [] as string[];
    }
    return files.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readJsonArtifactResult<T = unknown>(filePath: string): ArtifactReadResult<T> {
    if (!fs.existsSync(filePath)) {
        return {
            status: 'missing'
        };
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
        return {
            status: 'ok',
            value: JSON.parse(content) as T
        };
    } catch {
        return {
            status: 'parse_failed'
        };
    }
}
