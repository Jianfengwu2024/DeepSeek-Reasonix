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
exports.safeWalkProject = safeWalkProject;
exports.shouldSkipDirectory = shouldSkipDirectory;
exports.shouldSkipFile = shouldSkipFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const workspace_1 = require("./workspace");
const RUNTIME_SKIP_SEGMENTS = new Set([
    'node_modules',
    '.git',
    '.triadmind',
    'venv',
    '.venv',
    '__pycache__',
    '.pytest_cache',
    '.next',
    'dist',
    'build',
    'logs',
    'uploads',
    'fastgpt_data',
    '.run_state',
    'tmp'
]);
const GENERATED_OR_LOCK_FILE_PATTERNS = [
    /\.lock$/i,
    /^package-lock\.json$/i,
    /^pnpm-lock\.ya?ml$/i,
    /^yarn\.lock$/i,
    /\.min\.(js|css)$/i,
    /\.map$/i,
    /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|tar|bz2|7z|exe|dll|so|dylib|bin|class|jar)$/i
];
function safeWalkProject(options) {
    const summary = {
        scannedFiles: 0,
        skippedPermissionPaths: [],
        skippedExcludedPaths: [],
        skippedMissingPaths: [],
        maxFilesReached: false
    };
    walk(options.projectRoot);
    return summary;
    function walk(currentPath) {
        if (summary.maxFilesReached) {
            return;
        }
        let stat;
        try {
            stat = fs.statSync(currentPath);
        }
        catch (error) {
            recordRecoverablePath(error, currentPath);
            return;
        }
        const relativePath = normalizeRelativePath(options.projectRoot, currentPath);
        if (stat.isFile()) {
            if (shouldSkipFile(relativePath, options.config, options.mode)) {
                recordExcludedPath(relativePath);
                return;
            }
            summary.scannedFiles += 1;
            options.onFile(currentPath, relativePath);
            if (options.maxFiles && summary.scannedFiles >= options.maxFiles) {
                summary.maxFilesReached = true;
                options.onDiagnostic?.({
                    level: 'warning',
                    code: 'RUNTIME_MAX_FILES_REACHED',
                    message: `Stopped runtime source scan after reaching runtime.maxScannedFiles=${options.maxFiles}`
                });
            }
            return;
        }
        if (relativePath && shouldSkipDirectory(relativePath, options.config, options.mode)) {
            recordExcludedPath(relativePath);
            return;
        }
        let entries;
        try {
            entries = fs.readdirSync(currentPath);
        }
        catch (error) {
            recordRecoverablePath(error, currentPath);
            return;
        }
        for (const entry of entries) {
            walk(path.join(currentPath, entry));
            if (summary.maxFilesReached) {
                return;
            }
        }
    }
    function recordExcludedPath(relativePath) {
        if (!relativePath || summary.skippedExcludedPaths.includes(relativePath)) {
            return;
        }
        summary.skippedExcludedPaths.push(relativePath);
    }
    function recordRecoverablePath(error, targetPath) {
        if (!(0, config_1.isIgnorableFsError)(error)) {
            throw error;
        }
        const relativePath = normalizeRelativePath(options.projectRoot, targetPath);
        const code = String(error?.code ?? '').toUpperCase();
        if (code === 'ENOENT') {
            summary.skippedMissingPaths.push(relativePath);
        }
        else {
            summary.skippedPermissionPaths.push(relativePath);
        }
        options.onDiagnostic?.({
            level: code === 'ENOENT' ? 'info' : 'warning',
            code: code === 'ENOENT' ? 'RUNTIME_PATH_MISSING' : 'RUNTIME_PERMISSION_SKIPPED',
            sourcePath: relativePath,
            message: `Skipped ${relativePath || '.'} due to ${code || 'recoverable FS error'}`
        });
    }
}
function shouldSkipDirectory(relativePath, config, mode) {
    const normalized = (0, workspace_1.normalizePath)(relativePath).toLowerCase();
    const segments = normalized.split('/').filter(Boolean);
    const basename = segments[segments.length - 1] ?? normalized;
    if ((0, config_1.shouldSkipWalkPath)(normalized) || (0, config_1.shouldSkipWalkPath)(basename)) {
        return true;
    }
    if (mode === 'runtime') {
        return segments.some((segment) => RUNTIME_SKIP_SEGMENTS.has(segment));
    }
    return false;
}
function shouldSkipFile(relativePath, config, mode) {
    const normalized = (0, workspace_1.normalizePath)(relativePath).toLowerCase();
    const basename = normalized.split('/').filter(Boolean).pop() ?? normalized;
    if ((0, config_1.shouldSkipWalkPath)(normalized) || (0, config_1.shouldSkipWalkPath)(basename)) {
        return true;
    }
    if (mode === 'runtime' && !(0, config_1.shouldIncludeRuntimePath)(relativePath, config)) {
        return true;
    }
    return GENERATED_OR_LOCK_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}
function normalizeRelativePath(projectRoot, currentPath) {
    const relative = (0, workspace_1.normalizePath)(path.relative(projectRoot, currentPath));
    return relative === '' ? '' : relative;
}
//# sourceMappingURL=sourceWalker.js.map