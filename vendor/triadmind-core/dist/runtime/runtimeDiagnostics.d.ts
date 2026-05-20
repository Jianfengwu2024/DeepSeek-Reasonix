import { RuntimeDiagnostic } from './types';
type RuntimeDiagnosticInput = Partial<RuntimeDiagnostic> & {
    level?: RuntimeDiagnostic['level'];
    message?: string;
};
export declare function normalizeRuntimeDiagnostic(diagnostic: RuntimeDiagnosticInput, fallbackExtractor?: string): RuntimeDiagnostic;
export declare function normalizeRuntimeDiagnostics(diagnostics: Array<RuntimeDiagnosticInput>, fallbackExtractor?: string): RuntimeDiagnostic[];
export {};
