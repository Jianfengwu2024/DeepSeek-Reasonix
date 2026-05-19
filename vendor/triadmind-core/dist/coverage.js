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
exports.runCoverage = runCoverage;
exports.formatCoverageReport = formatCoverageReport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const sourceWalker_1 = require("./sourceWalker");
const workspace_1 = require("./workspace");
const SUPPORTED_SOURCE_FILE_PATTERN = /\.(py|ts|tsx|mts|cts|js|jsx|mjs|cjs|go|rs|java|cc|cpp|cxx|hpp|hh|h)$/i;
const MAX_UNCOVERED_SAMPLES = 20;
function runCoverage(paths) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const diagnostics = [];
    const universeFiles = collectCoverageUniverse(paths, config, diagnostics);
    const universeLookup = new Map(universeFiles.map((item) => [canonicalizeCoverageKey(item), item]));
    const triadCovered = resolveCoveredFiles(readTriadNodes(paths.mapFile), universeLookup, diagnostics, 'triad', paths.projectRoot);
    const runtimeCovered = resolveCoveredFiles(collectRuntimeSourcePaths(paths.runtimeMapFile), universeLookup, diagnostics, 'runtime', paths.projectRoot);
    const combinedCovered = new Set([...triadCovered, ...runtimeCovered]);
    const byCategoryEntries = Object.keys(config.categories).map((rawCategory) => {
        const category = rawCategory;
        const categoryFiles = universeFiles.filter((relativePath) => (0, config_1.resolveCategoryFromConfig)(relativePath, config) === category);
        return [
            category,
            buildBucketReport({
                key: category,
                category,
                totalFiles: categoryFiles,
                triadCovered,
                runtimeCovered,
                combinedCovered
            })
        ];
    });
    const byRootEntries = collectConfiguredRoots(paths.projectRoot, config.categories).map((root) => {
        const rootFiles = universeFiles.filter((relativePath) => matchesRoot(relativePath, root.rootPath));
        return [
            root.rootPath,
            buildBucketReport({
                key: root.rootPath,
                category: root.category,
                rootPath: root.rootPath,
                exists: root.exists,
                totalFiles: rootFiles,
                triadCovered,
                runtimeCovered,
                combinedCovered
            })
        ];
    });
    const report = {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        projectRoot: paths.projectRoot,
        artifacts: {
            triadMapFile: paths.mapFile,
            runtimeMapFile: paths.runtimeMapFile,
            coverageReportFile: paths.coverageReportFile
        },
        summary: buildBucketReport({
            key: 'summary',
            totalFiles: universeFiles,
            triadCovered,
            runtimeCovered,
            combinedCovered
        }),
        byCategory: Object.fromEntries(byCategoryEntries),
        byRoot: Object.fromEntries(byRootEntries),
        diagnostics
    };
    fs.mkdirSync(path.dirname(paths.coverageReportFile), { recursive: true });
    fs.writeFileSync(paths.coverageReportFile, JSON.stringify(report, null, 2), 'utf-8');
    return report;
}
function formatCoverageReport(report) {
    const lines = [
        'TriadMind Coverage',
        `generatedAt=${report.generatedAt}`,
        `summary triad=${report.summary.triadCoverage.toFixed(3)} runtime=${report.summary.runtimeCoverage.toFixed(3)} combined=${report.summary.combinedCoverage.toFixed(3)}`,
        `sourceFiles=${report.summary.totalSourceFiles}, triadCovered=${report.summary.triadCoveredFiles}, runtimeCovered=${report.summary.runtimeCoveredFiles}, combinedCovered=${report.summary.combinedCoveredFiles}`
    ];
    for (const bucket of Object.values(report.byCategory)) {
        lines.push(`category:${bucket.key} triad=${bucket.triadCoverage.toFixed(3)} runtime=${bucket.runtimeCoverage.toFixed(3)} combined=${bucket.combinedCoverage.toFixed(3)} files=${bucket.totalSourceFiles}`);
    }
    for (const bucket of Object.values(report.byRoot)) {
        lines.push(`root:${bucket.key} exists=${bucket.exists ? 'true' : 'false'} combined=${bucket.combinedCoverage.toFixed(3)} files=${bucket.totalSourceFiles}`);
    }
    if (report.diagnostics.length > 0) {
        lines.push(`diagnostics=${report.diagnostics.length}`);
    }
    return lines.join('\n');
}
function collectCoverageUniverse(paths, config, diagnostics) {
    const files = new Set();
    (0, sourceWalker_1.safeWalkProject)({
        projectRoot: paths.projectRoot,
        mode: 'runtime',
        config,
        maxFiles: config.runtime.maxScannedFiles,
        onFile: (_absolutePath, relativePath) => {
            const normalized = normalizeCoveragePath(paths.projectRoot, relativePath);
            if (!normalized || !isSupportedCoverageFile(normalized) || (0, config_1.shouldExcludeSourcePath)(normalized, config)) {
                return;
            }
            files.add(normalized);
        },
        onDiagnostic: (diagnostic) => {
            diagnostics.push({
                level: diagnostic.level,
                code: diagnostic.code ?? 'COVERAGE_SOURCE_WALK_NOTICE',
                message: diagnostic.message,
                sourcePath: diagnostic.sourcePath
            });
        }
    });
    return Array.from(files).sort();
}
function resolveCoveredFiles(rawSourcePaths, universeLookup, diagnostics, channel, projectRoot) {
    const covered = new Set();
    const missing = new Set();
    for (const rawSourcePath of rawSourcePaths) {
        const normalized = normalizeCoveragePath(projectRoot, rawSourcePath);
        if (!normalized || !isSupportedCoverageFile(normalized)) {
            continue;
        }
        const resolved = universeLookup.get(canonicalizeCoverageKey(normalized));
        if (resolved) {
            covered.add(resolved);
        }
        else {
            missing.add(normalized);
        }
    }
    for (const sourcePath of Array.from(missing).sort().slice(0, MAX_UNCOVERED_SAMPLES)) {
        diagnostics.push({
            level: 'info',
            code: channel === 'triad' ? 'COVERAGE_TRIAD_SOURCE_OUTSIDE_UNIVERSE' : 'COVERAGE_RUNTIME_SOURCE_OUTSIDE_UNIVERSE',
            message: `${channel} sourcePath did not match coverage universe`,
            sourcePath
        });
    }
    return covered;
}
function buildBucketReport(input) {
    const triadCoveredFiles = input.totalFiles.filter((file) => input.triadCovered.has(file));
    const runtimeCoveredFiles = input.totalFiles.filter((file) => input.runtimeCovered.has(file));
    const combinedCoveredFiles = input.totalFiles.filter((file) => input.combinedCovered.has(file));
    const uncovered = input.totalFiles.filter((file) => !input.combinedCovered.has(file));
    return {
        key: input.key,
        category: input.category,
        rootPath: input.rootPath,
        exists: input.exists,
        totalSourceFiles: input.totalFiles.length,
        triadCoveredFiles: triadCoveredFiles.length,
        runtimeCoveredFiles: runtimeCoveredFiles.length,
        combinedCoveredFiles: combinedCoveredFiles.length,
        triadCoverage: safeRatio(triadCoveredFiles.length, input.totalFiles.length),
        runtimeCoverage: safeRatio(runtimeCoveredFiles.length, input.totalFiles.length),
        combinedCoverage: safeRatio(combinedCoveredFiles.length, input.totalFiles.length),
        coveredSamples: combinedCoveredFiles.slice(0, MAX_UNCOVERED_SAMPLES),
        uncoveredSamples: uncovered.slice(0, MAX_UNCOVERED_SAMPLES)
    };
}
function collectConfiguredRoots(projectRoot, categories) {
    const descriptors = new Map();
    for (const [rawCategory, patterns] of Object.entries(categories)) {
        for (const rawPattern of Array.isArray(patterns) ? patterns : []) {
            const rootPath = normalizeRootPattern(rawPattern);
            if (!rootPath || descriptors.has(rootPath)) {
                continue;
            }
            descriptors.set(rootPath, {
                category: rawCategory,
                rootPath,
                exists: pathExists(path.join(projectRoot, rootPath))
            });
        }
    }
    return Array.from(descriptors.values()).sort((left, right) => left.rootPath.localeCompare(right.rootPath));
}
function readTriadNodes(filePath) {
    return (0, artifactReaders_1.readTriadNodesArtifact)(filePath)
        .map((node) => String(node?.sourcePath ?? ''))
        .filter(Boolean);
}
function collectRuntimeSourcePaths(filePath) {
    const runtimeMap = (0, artifactReaders_1.readRuntimeMapArtifact)(filePath);
    if (!runtimeMap) {
        return [];
    }
    const sourcePaths = new Set();
    runtimeMap.nodes.forEach((node) => collectRuntimeNodeSourcePaths(node, sourcePaths));
    runtimeMap.edges.forEach((edge) => collectRuntimeEdgeSourcePaths(edge, sourcePaths));
    return Array.from(sourcePaths);
}
function collectRuntimeNodeSourcePaths(node, sink) {
    if (node.sourcePath) {
        sink.add(node.sourcePath);
    }
    collectEvidenceSourcePaths(node.evidence, sink);
}
function collectRuntimeEdgeSourcePaths(edge, sink) {
    collectEvidenceSourcePaths(edge.evidence, sink);
}
function collectEvidenceSourcePaths(evidence, sink) {
    for (const item of Array.isArray(evidence) ? evidence : []) {
        if (item?.sourcePath) {
            sink.add(item.sourcePath);
        }
    }
}
function matchesRoot(relativePath, rootPath) {
    return relativePath === rootPath || relativePath.startsWith(`${rootPath}/`);
}
function normalizeRootPattern(value) {
    return (0, workspace_1.normalizePath)(String(value ?? '').trim())
        .replace(/^\.?\//, '')
        .replace(/\/+$/, '')
        .toLowerCase();
}
function normalizeCoveragePath(projectRoot, value) {
    const raw = String(value ?? '').trim();
    if (!raw) {
        return '';
    }
    let normalized = (0, workspace_1.normalizePath)(raw);
    if (projectRoot && path.isAbsolute(raw)) {
        const relative = (0, workspace_1.normalizePath)(path.relative(projectRoot, raw));
        if (relative.startsWith('..')) {
            return '';
        }
        normalized = relative;
    }
    normalized = normalized.replace(/^\.?\//, '').replace(/^\/+/, '').replace(/\/+/g, '/');
    return normalized;
}
function canonicalizeCoverageKey(value) {
    return normalizeCoveragePath('', value).toLowerCase();
}
function isSupportedCoverageFile(relativePath) {
    return SUPPORTED_SOURCE_FILE_PATTERN.test(relativePath);
}
function pathExists(targetPath) {
    try {
        return fs.existsSync(targetPath);
    }
    catch {
        return false;
    }
}
function safeRatio(part, total) {
    if (!total) {
        return 0;
    }
    return Number((part / total).toFixed(6));
}
//# sourceMappingURL=coverage.js.map