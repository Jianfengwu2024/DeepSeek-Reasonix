import { RuntimeDiagnostic, RuntimeMap } from './types';
export declare function writeRuntimeMap(runtimeMap: RuntimeMap, runtimeMapPath: string): void;
export declare function writeRuntimeDiagnostics(diagnostics: RuntimeDiagnostic[], diagnosticsPath: string): void;
export declare function writeRuntimeMapArtifacts(runtimeMap: RuntimeMap, runtimeMapPath: string, diagnosticsPath: string): void;
