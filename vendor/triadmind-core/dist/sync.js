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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncTriadMap = syncTriadMap;
exports.syncTriadMapWithOptions = syncTriadMapWithOptions;
exports.watchTriadMap = watchTriadMap;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const adapter_1 = require("./adapter");
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const treeSitterParser_1 = require("./treeSitterParser");
const workspace_1 = require("./workspace");
function syncTriadMap(paths, force = false) {
    return syncTriadMapWithOptions(paths, { force });
}
function syncTriadMapWithOptions(paths, options = {}) {
    fs.mkdirSync(paths.cacheDir, { recursive: true });
    const config = (0, config_1.loadTriadConfig)(paths);
    const effectiveConfig = options.scanMode
        ? {
            ...config,
            parser: {
                ...config.parser,
                scanMode: options.scanMode
            }
        }
        : config;
    const currentManifest = buildManifest(paths, effectiveConfig);
    const previousManifest = readManifest(paths);
    const changed = Boolean(options.force) || !previousManifest || !isSameManifest(previousManifest, currentManifest);
    if (!changed) {
        console.log(chalk_1.default.gray('   - [Sync] triad-map is up to date; no source changes detected.'));
        return {
            changed: false,
            fileCount: currentManifest.files.length
        };
    }
    console.log(chalk_1.default.gray('   - [Sync] source changes detected; rebuilding triad-map...'));
    if (effectiveConfig.architecture.parserEngine === 'tree-sitter') {
        syncPolyglotTreeSitterTopology(paths, effectiveConfig);
    }
    else {
        (0, adapter_1.resolveAdapter)(paths).parseTopology(paths.projectRoot, paths.mapFile, effectiveConfig);
    }
    const nextManifest = {
        ...currentManifest,
        parserEngine: effectiveConfig.architecture.parserEngine,
        generatedAt: new Date().toISOString()
    };
    fs.writeFileSync(paths.syncCacheFile, JSON.stringify(nextManifest, null, 2), 'utf-8');
    return {
        changed: true,
        fileCount: currentManifest.files.length
    };
}
function watchTriadMap(paths) {
    console.log(chalk_1.default.cyan(`[TriadMind] Watching ${paths.projectRoot}`));
    syncTriadMap(paths, true);
    let timer;
    const schedule = () => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            try {
                syncTriadMap(paths);
            }
            catch (error) {
                console.log(chalk_1.default.red(`[TriadMind] watch sync failed: ${error.message}`));
            }
        }, 250);
    };
    const watcher = fs.watch(paths.projectRoot, { recursive: true }, (_event, filename) => {
        if (!filename) {
            return;
        }
        const relativePath = (0, workspace_1.normalizePath)(String(filename));
        const config = (0, config_1.loadTriadConfig)(paths);
        const includeSourcePath = (0, config_1.createSourcePathFilter)(paths.projectRoot, config);
        if (!includeSourcePath(relativePath)) {
            return;
        }
        if (!isSourceFile(relativePath)) {
            return;
        }
        schedule();
    });
    process.on('SIGINT', () => {
        watcher.close();
        process.exit(0);
    });
}
function buildManifest(paths, config = (0, config_1.loadTriadConfig)(paths)) {
    const files = collectSourceFiles(paths)
        .map((filePath) => ({
        path: filePath,
        sha256: hashFile(path.join(paths.projectRoot, filePath))
    }))
        .filter((file) => Boolean(file.sha256));
    return {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        parserEngine: config.architecture.parserEngine,
        configHash: hashContent(JSON.stringify(config)),
        files
    };
}
function collectSourceFiles(paths) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const includeSourcePath = (0, config_1.createSourcePathFilter)(paths.projectRoot, config);
    const files = [];
    walk(paths.projectRoot, (filePath) => {
        const relativePath = (0, workspace_1.normalizePath)(path.relative(paths.projectRoot, filePath));
        if (!includeSourcePath(relativePath)) {
            return;
        }
        if (isSourceFile(relativePath)) {
            files.push(relativePath);
        }
    });
    return files.sort();
}
function walk(currentPath, visit) {
    if (!fs.existsSync(currentPath)) {
        return;
    }
    let stat;
    try {
        stat = fs.statSync(currentPath);
    }
    catch (error) {
        if ((0, config_1.isIgnorableFsError)(error)) {
            return;
        }
        throw error;
    }
    if (stat.isFile()) {
        try {
            visit(currentPath);
        }
        catch (error) {
            if ((0, config_1.isIgnorableFsError)(error)) {
                return;
            }
            throw error;
        }
        return;
    }
    if ((0, config_1.shouldSkipWalkPath)((0, workspace_1.normalizePath)(currentPath)) || (0, config_1.shouldSkipWalkPath)(path.basename(currentPath))) {
        return;
    }
    let entries;
    try {
        entries = fs.readdirSync(currentPath);
    }
    catch (error) {
        if ((0, config_1.isIgnorableFsError)(error)) {
            return;
        }
        throw error;
    }
    for (const entry of entries) {
        walk(path.join(currentPath, entry), visit);
    }
}
function readManifest(paths) {
    const result = (0, artifactReaders_1.readJsonObjectArtifactResult)(paths.syncCacheFile);
    if (result.status !== 'ok' || !result.value) {
        return null;
    }
    return result.value;
}
function isSameManifest(left, right) {
    if (left.parserEngine !== right.parserEngine) {
        return false;
    }
    if ((left.configHash ?? '') !== (right.configHash ?? '')) {
        return false;
    }
    if (left.files.length !== right.files.length) {
        return false;
    }
    return left.files.every((file, index) => file.path === right.files[index].path && file.sha256 === right.files[index].sha256);
}
function hashFile(filePath) {
    try {
        return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    }
    catch (error) {
        if ((0, config_1.isIgnorableFsError)(error)) {
            return '';
        }
        throw error;
    }
}
function hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}
function isSourceFile(filePath) {
    return /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|go|rs|cpp|cc|cxx|hpp|hh|h|java)$/i.test(filePath) && !filePath.endsWith('.d.ts');
}
function syncPolyglotTreeSitterTopology(paths, config) {
    const languages = detectProjectLanguages(paths, config);
    const results = languages.map((language) => (0, treeSitterParser_1.collectTreeSitterParseResult)(language, paths.projectRoot, config));
    const rewritePlan = buildCollisionRewritePlan(results.flatMap((result) => [...result.leafNodes, ...result.projectedNodes]));
    const mergedLeafNodes = mergeMultiLanguageNodes(results.flatMap((result) => result.leafNodes), rewritePlan);
    const mergedCapabilityNodes = mergeMultiLanguageNodes(results.flatMap((result) => result.projectedNodes), rewritePlan);
    const mergedDiagnostics = results.flatMap((result) => result.diagnostics ?? []);
    fs.mkdirSync(path.dirname(paths.leafMapFile), { recursive: true });
    fs.mkdirSync(path.dirname(paths.mapFile), { recursive: true });
    fs.mkdirSync(path.dirname(paths.triadDiagnosticsFile), { recursive: true });
    fs.writeFileSync(paths.leafMapFile, JSON.stringify(mergedLeafNodes, null, 2), 'utf-8');
    fs.writeFileSync(paths.mapFile, JSON.stringify(mergedCapabilityNodes, null, 2), 'utf-8');
    fs.writeFileSync(paths.triadDiagnosticsFile, JSON.stringify(mergedDiagnostics, null, 2), 'utf-8');
    console.log(chalk_1.default.gray(`   - [Sync] polyglot tree-sitter merge complete: languages=${languages.join(', ')}, capability=${mergedCapabilityNodes.length}, leaf=${mergedLeafNodes.length}`));
}
function detectProjectLanguages(paths, config) {
    const includeSourcePath = (0, config_1.createSourcePathFilter)(paths.projectRoot, config);
    const detected = new Set();
    for (const relativePath of collectSourceFiles(paths)) {
        if (!includeSourcePath(relativePath)) {
            continue;
        }
        const language = inferLanguageFromPath(relativePath);
        if (language) {
            detected.add(language);
        }
    }
    if (detected.size === 0) {
        detected.add(config.architecture.language);
    }
    return LANGUAGE_PRIORITY.filter((language) => detected.has(language));
}
function inferLanguageFromPath(filePath) {
    const normalized = (0, workspace_1.normalizePath)(filePath).toLowerCase();
    if (/\.(ts|tsx|mts|cts)$/.test(normalized))
        return 'typescript';
    if (/\.(js|jsx|mjs|cjs)$/.test(normalized))
        return 'javascript';
    if (/\.py$/.test(normalized))
        return 'python';
    if (/\.go$/.test(normalized))
        return 'go';
    if (/\.rs$/.test(normalized))
        return 'rust';
    if (/\.(cc|cpp|cxx|hpp|hh|h)$/.test(normalized))
        return 'cpp';
    if (/\.java$/.test(normalized))
        return 'java';
    return undefined;
}
function mergeMultiLanguageNodes(nodes, rewritePlan) {
    return nodes
        .map((node) => applyCollisionRewrite(node, rewritePlan))
        .sort((left, right) => left.nodeId.localeCompare(right.nodeId) || left.sourcePath.localeCompare(right.sourcePath));
}
function buildCollisionRewritePlan(nodes) {
    const grouped = new Map();
    for (const node of nodes) {
        const list = grouped.get(node.nodeId) ?? [];
        list.push(node);
        grouped.set(node.nodeId, list);
    }
    const rewritePlan = new Map();
    for (const [nodeId, group] of grouped.entries()) {
        const uniqueSourceKeys = new Set(group.map((node) => (0, workspace_1.normalizePath)(node.sourcePath).toLowerCase()));
        if (uniqueSourceKeys.size <= 1) {
            continue;
        }
        const sourceNamespaces = chooseUniqueSourceNamespaces(group);
        for (const node of group) {
            const identity = buildNodeIdentity(node);
            const namespace = sourceNamespaces.get(identity) ?? sanitizeNamespace(node.category);
            rewritePlan.set(identity, `${sanitizeNamespace(node.category)}.${namespace}.${nodeId}`);
        }
    }
    return rewritePlan;
}
function chooseUniqueSourceNamespaces(group) {
    const keyedSegments = group.map((node) => ({
        identity: buildNodeIdentity(node),
        segments: extractSourceNamespaceSegments(node.sourcePath)
    }));
    for (let width = 1; width <= Math.max(...keyedSegments.map((item) => item.segments.length), 1); width += 1) {
        const candidateMap = new Map();
        let hasCollision = false;
        for (const item of keyedSegments) {
            const namespace = buildNamespaceFromSegments(item.segments, width);
            if (Array.from(candidateMap.values()).includes(namespace)) {
                hasCollision = true;
                break;
            }
            candidateMap.set(item.identity, namespace);
        }
        if (!hasCollision) {
            return candidateMap;
        }
    }
    return new Map(keyedSegments.map((item, index) => [item.identity, `${buildNamespaceFromSegments(item.segments, item.segments.length)}.${index + 1}`]));
}
function applyCollisionRewrite(node, rewritePlan) {
    const identity = buildNodeIdentity(node);
    const rewrittenNodeId = rewritePlan.get(identity) ?? node.nodeId;
    const rewrittenFoldedLeaves = Array.isArray(node.topology?.foldedLeaves)
        ? node.topology?.foldedLeaves.map((leafId) => {
            const leafIdentity = buildNodeIdentity({
                ...node,
                nodeId: leafId
            });
            return rewritePlan.get(leafIdentity) ?? leafId;
        })
        : undefined;
    return {
        ...node,
        nodeId: rewrittenNodeId,
        topology: rewrittenFoldedLeaves && rewrittenFoldedLeaves.length > 0 ? { foldedLeaves: rewrittenFoldedLeaves } : node.topology
    };
}
function buildNodeIdentity(node) {
    return [node.nodeId, (0, workspace_1.normalizePath)(node.sourcePath).toLowerCase(), sanitizeNamespace(node.category)].join('::');
}
function extractSourceNamespaceSegments(sourcePath) {
    return (0, workspace_1.normalizePath)(sourcePath)
        .replace(/\.[^.\/]+$/, '')
        .split('/')
        .filter(Boolean)
        .map((segment) => sanitizeNamespace(segment))
        .filter((segment) => segment && !GENERIC_NAMESPACE_SEGMENTS.has(segment));
}
function buildNamespaceFromSegments(segments, width) {
    const chosen = segments.slice(-Math.max(1, width));
    if (chosen.length === 0) {
        return 'source';
    }
    return chosen.join('.');
}
function sanitizeNamespace(value) {
    return String(value ?? '')
        .trim()
        .replace(/\.[^.]+$/, '')
        .replace(/[^A-Za-z0-9_]+/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .replace(/\.{2,}/g, '.')
        .toLowerCase() || 'source';
}
const LANGUAGE_PRIORITY = ['typescript', 'javascript', 'python', 'go', 'rust', 'cpp', 'java'];
const GENERIC_NAMESPACE_SEGMENTS = new Set(['src', 'app', 'apps', 'packages', 'package', 'lib', 'core', 'main', 'index']);
//# sourceMappingURL=sync.js.map