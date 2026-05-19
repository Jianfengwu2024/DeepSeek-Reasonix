"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectRuntimeSourceFiles = collectRuntimeSourceFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sourceWalker_1 = require("../sourceWalker");
const workspace_1 = require("../workspace");
function collectRuntimeSourceFiles(projectRoot, config, diagnostics) {
    const files = [];
    const summary = (0, sourceWalker_1.safeWalkProject)({
        projectRoot,
        mode: 'runtime',
        config,
        maxFiles: config.runtime.maxScannedFiles,
        onDiagnostic(diagnostic) {
            diagnostics.push({
                level: diagnostic.level,
                code: diagnostic.code ?? `RUNTIME_SOURCE_WALK_${diagnostic.level.toUpperCase()}`,
                sourcePath: diagnostic.sourcePath,
                extractor: 'RuntimeSourceCollector',
                message: diagnostic.message
            });
        },
        onFile(absolutePath, relativePath) {
            const language = detectRuntimeLanguage(absolutePath);
            if (language === 'unknown' && !isRuntimeUnknownConfigFile(relativePath)) {
                return;
            }
            let stat;
            try {
                stat = fs.statSync(absolutePath);
            }
            catch (error) {
                diagnostics.push({
                    level: 'warning',
                    code: String(error?.code ?? '').toUpperCase() || 'RUNTIME_STAT_FAILED',
                    message: `Could not stat runtime source file: ${error?.message ?? String(error)}`,
                    sourcePath: relativePath,
                    extractor: 'RuntimeSourceCollector'
                });
                return;
            }
            if (stat.size > config.runtime.maxSourceFileBytes) {
                diagnostics.push({
                    level: 'info',
                    code: 'RUNTIME_FILE_TOO_LARGE',
                    message: `Skipped source file above runtime.maxSourceFileBytes (${stat.size} bytes)`,
                    sourcePath: relativePath,
                    extractor: 'RuntimeSourceCollector'
                });
                return;
            }
            try {
                const content = fs.readFileSync(absolutePath, 'utf-8').replace(/^\uFEFF/, '');
                if (content.includes('\0')) {
                    diagnostics.push({
                        level: 'info',
                        code: 'RUNTIME_BINARY_SKIPPED',
                        message: 'Skipped binary-like source file during runtime extraction',
                        sourcePath: relativePath,
                        extractor: 'RuntimeSourceCollector'
                    });
                    return;
                }
                files.push({
                    absolutePath,
                    relativePath,
                    language,
                    content
                });
            }
            catch (error) {
                diagnostics.push({
                    level: 'warning',
                    code: String(error?.code ?? '').toUpperCase() || 'RUNTIME_READ_FAILED',
                    message: `Could not read runtime source file: ${error?.message ?? String(error)}`,
                    sourcePath: relativePath,
                    extractor: 'RuntimeSourceCollector'
                });
            }
        }
    });
    pushSummaryDiagnostics(summary, diagnostics);
    return files;
}
function pushSummaryDiagnostics(summary, diagnostics) {
    if (summary.skippedPermissionPaths.length > 0) {
        diagnostics.push({
            level: 'warning',
            code: 'RUNTIME_PERMISSION_SKIPPED_SUMMARY',
            extractor: 'RuntimeSourceCollector',
            message: buildSummaryMessage('Skipped runtime paths due to permission restrictions', summary.skippedPermissionPaths)
        });
    }
    if (summary.skippedExcludedPaths.length > 0) {
        diagnostics.push({
            level: 'info',
            code: 'RUNTIME_EXCLUDED_PATHS_SUMMARY',
            extractor: 'RuntimeSourceCollector',
            message: buildSummaryMessage('Skipped runtime paths by exclude rules', summary.skippedExcludedPaths)
        });
    }
    if (summary.skippedMissingPaths.length > 0) {
        diagnostics.push({
            level: 'info',
            code: 'RUNTIME_PATH_MISSING_SUMMARY',
            extractor: 'RuntimeSourceCollector',
            message: buildSummaryMessage('Skipped missing runtime paths during traversal', summary.skippedMissingPaths)
        });
    }
    if (summary.maxFilesReached) {
        diagnostics.push({
            level: 'warning',
            code: 'RUNTIME_MAX_FILES_REACHED',
            extractor: 'RuntimeSourceCollector',
            message: `Runtime source scan reached maxScannedFiles limit at ${summary.scannedFiles} files`
        });
    }
}
function buildSummaryMessage(prefix, paths) {
    const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
    const samples = uniquePaths.slice(0, 5).join(', ');
    const suffix = uniquePaths.length > 5 ? ` (+${uniquePaths.length - 5} more)` : '';
    return `${prefix}: ${uniquePaths.length}${samples ? ` [${samples}${suffix}]` : ''}`;
}
function detectRuntimeLanguage(filePath) {
    const basename = path.basename(filePath).toLowerCase();
    const extension = path.extname(filePath).toLowerCase();
    if (basename === 'dockerfile' || basename.endsWith('.dockerfile')) {
        return 'dockerfile';
    }
    if (extension === '.py') {
        return 'python';
    }
    if (extension === '.ts' || extension === '.tsx' || extension === '.mts' || extension === '.cts') {
        return 'typescript';
    }
    if (extension === '.js' || extension === '.jsx' || extension === '.mjs' || extension === '.cjs') {
        return 'javascript';
    }
    if (extension === '.json') {
        return 'json';
    }
    if (extension === '.yaml' || extension === '.yml') {
        return 'yaml';
    }
    if (extension === '.toml') {
        return 'toml';
    }
    return 'unknown';
}
function isRuntimeUnknownConfigFile(relativePath) {
    const basename = (0, workspace_1.normalizePath)(relativePath).split('/').pop()?.toLowerCase() ?? '';
    return /^\.env(\..+)?$/.test(basename);
}
//# sourceMappingURL=collectRuntimeSourceFiles.js.map