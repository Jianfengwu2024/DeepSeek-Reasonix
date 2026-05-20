"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRuntimeDiagnostic = normalizeRuntimeDiagnostic;
exports.normalizeRuntimeDiagnostics = normalizeRuntimeDiagnostics;
const DEFAULT_EXTRACTOR = 'RuntimeOrchestrator';
const DEFAULT_CODE = 'RUNTIME_UNKNOWN_DIAGNOSTIC';
function normalizeRuntimeDiagnostic(diagnostic, fallbackExtractor = DEFAULT_EXTRACTOR) {
    const level = normalizeLevel(diagnostic.level);
    const extractor = normalizeExtractor(diagnostic.extractor, fallbackExtractor);
    const message = normalizeMessage(diagnostic.message);
    const code = normalizeCode(diagnostic.code) ?? fallbackCode(extractor, level);
    return {
        level,
        code,
        extractor,
        message,
        sourcePath: normalizeOptionalText(diagnostic.sourcePath)
    };
}
function normalizeRuntimeDiagnostics(diagnostics, fallbackExtractor = DEFAULT_EXTRACTOR) {
    return diagnostics.map((diagnostic) => normalizeRuntimeDiagnostic(diagnostic, fallbackExtractor));
}
function normalizeLevel(level) {
    return level === 'info' || level === 'warning' || level === 'error' ? level : 'info';
}
function normalizeExtractor(extractor, fallbackExtractor) {
    const normalized = normalizeOptionalText(extractor);
    return normalized || fallbackExtractor;
}
function normalizeMessage(message) {
    return normalizeOptionalText(message) || 'Runtime diagnostic without message';
}
function normalizeCode(code) {
    const normalized = normalizeOptionalText(code);
    if (!normalized) {
        return undefined;
    }
    return normalized
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120);
}
function fallbackCode(extractor, level) {
    const extractorToken = extractor
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
    if (!extractorToken) {
        return DEFAULT_CODE;
    }
    return `RUNTIME_${extractorToken}_${level.toUpperCase()}`;
}
function normalizeOptionalText(value) {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
}
//# sourceMappingURL=runtimeDiagnostics.js.map