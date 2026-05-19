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
exports.resolveExpectedTriadizationFocus = void 0;
exports.syncProjectTopology = syncProjectTopology;
exports.readCurrentTriadMap = readCurrentTriadMap;
exports.prepareWorkspace = prepareWorkspace;
exports.resolveDemand = resolveDemand;
exports.normalizeInvokeDemand = normalizeInvokeDemand;
exports.openFile = openFile;
exports.dispatchProtocolApply = dispatchProtocolApply;
exports.assertNoTopologicalDegradation = assertNoTopologicalDegradation;
exports.warnBlastRadiusIfNeeded = warnBlastRadiusIfNeeded;
exports.validateDraftProtocol = validateDraftProtocol;
exports.assertTriadizationFocusGate = assertTriadizationFocusGate;
exports.writeHandoffPrompt = writeHandoffPrompt;
exports.toDashboardOptions = toDashboardOptions;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const adapter_1 = require("./adapter");
const analyzerOptionsSupport_1 = require("./analyzerOptionsSupport");
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const analyzer_1 = require("./analyzer");
const protocol_1 = require("./protocol");
const verify_1 = require("./verify");
const sync_1 = require("./sync");
const triadizationFocusSupport_1 = require("./triadizationFocusSupport");
const workflow_1 = require("./workflow");
const workspace_1 = require("./workspace");
var triadizationFocusSupport_2 = require("./triadizationFocusSupport");
Object.defineProperty(exports, "resolveExpectedTriadizationFocus", { enumerable: true, get: function () { return triadizationFocusSupport_2.resolveExpectedTriadizationFocus; } });
const BLAST_RADIUS_WARNING_THRESHOLD = 5;
function syncProjectTopology(paths, force = false, scanMode) {
    return scanMode ? (0, sync_1.syncTriadMapWithOptions)(paths, { force, scanMode }) : (0, sync_1.syncTriadMap)(paths, force);
}
function readCurrentTriadMap(paths) {
    return (0, protocol_1.readTriadMap)(paths.mapFile);
}
function prepareWorkspace(paths, demand) {
    (0, workflow_1.ensureTriadSpec)(paths);
    syncProjectTopology(paths);
    (0, workflow_1.createDraftTemplate)(paths, demand);
    (0, workflow_1.writePromptPacket)(paths, demand);
}
function resolveDemand(demandParts, optionDemand, paths) {
    const fromArgs = demandParts.join(' ').trim();
    if (optionDemand?.trim()) {
        return optionDemand.trim();
    }
    if (fromArgs) {
        return fromArgs;
    }
    if (paths?.demandFile && fs.existsSync(paths.demandFile)) {
        return (0, artifactReaders_1.readTextIfExists)(paths.demandFile, { trim: true });
    }
    return '';
}
function normalizeInvokeDemand(value) {
    return value.trim().replace(/^@?triadmind(?:\s*[:锛?]\s*|\s+)/i, '').trim();
}
async function openFile(filePath) {
    const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', filePath] : [filePath];
    const child = (0, child_process_1.spawn)(command, args, {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
}
function dispatchProtocolApply(projectRoot, protocol) {
    const detectedLanguage = sniffProjectLanguage(projectRoot);
    const adapter = createCliLanguageAdapter(detectedLanguage);
    adapter.applyProtocol(protocol, projectRoot);
    return {
        language: detectedLanguage,
        displayName: adapter.displayName,
        changedFiles: adapter.consumeChangedFiles()
    };
}
function assertNoTopologicalDegradation(paths, previousMap, lifecycle) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const drift = (0, analyzer_1.detectTopologicalDrift)(previousMap, readCurrentTriadMap(paths), (0, analyzerOptionsSupport_1.resolveAnalyzerOptionsFromConfig)(config));
    if (!drift.isDegraded) {
        return;
    }
    throw new Error(`[${lifecycle}] topological drift detected: ${drift.summary.join(' ')}`);
}
function warnBlastRadiusIfNeeded(paths, protocol) {
    const currentMap = readCurrentTriadMap(paths);
    if (currentMap.length === 0) {
        return;
    }
    const config = (0, config_1.loadTriadConfig)(paths);
    const analyzerOptions = (0, analyzerOptionsSupport_1.resolveAnalyzerOptionsFromConfig)(config);
    const currentNodeMap = new Map(currentMap.map((node) => [node.nodeId, node]));
    const impactedNodeIds = new Set();
    const hotspots = [];
    for (const action of protocol.actions) {
        if (action.op !== 'modify') {
            continue;
        }
        const currentNode = currentNodeMap.get(action.nodeId);
        if (!currentNode) {
            continue;
        }
        const isContractChange = hasContractChange(currentNode, action.fission);
        const impacted = (0, analyzer_1.calculateBlastRadius)(currentMap, action.nodeId, isContractChange, analyzerOptions);
        impacted.forEach((nodeId) => impactedNodeIds.add(nodeId));
        if (isContractChange && impacted.length > 0) {
            hotspots.push(`${action.nodeId} -> ${impacted.length}`);
        }
    }
    if (impactedNodeIds.size < BLAST_RADIUS_WARNING_THRESHOLD) {
        return;
    }
    console.log(`Blast radius warning: ${impactedNodeIds.size} downstream nodes may be affected (${Array.from(impactedNodeIds)
        .sort()
        .slice(0, 8)
        .join(', ')}).`);
    if (hotspots.length > 0) {
        console.log(`   - contract hotspots: ${hotspots.join('; ')}`);
    }
}
function validateDraftProtocol(paths) {
    let protocol;
    try {
        protocol = (0, protocol_1.readJsonFile)(paths.draftFile);
    }
    catch (error) {
        throw new Error(`Invalid JSON in ${paths.draftFile}: ${error.message}`);
    }
    const existingNodes = (0, protocol_1.readTriadMap)(paths.mapFile);
    const config = (0, config_1.loadTriadConfig)(paths);
    const expectedTriadizationFocus = (0, triadizationFocusSupport_1.resolveExpectedTriadizationFocus)(paths);
    const parsedProtocol = (0, protocol_1.assertProtocolShape)(protocol, {
        existingNodes,
        minConfidence: config.protocol.minConfidence,
        requireConfidence: config.protocol.requireConfidence,
        expectedTriadizationFocus
    });
    synchronizeSplitArtifactsFromDraftProtocol(paths, parsedProtocol);
    assertTriadizationFocusGate(paths);
    return parsedProtocol;
}
function assertTriadizationFocusGate(paths) {
    const report = (0, verify_1.runTopologyVerify)(paths);
    const failedChecks = report.checks.filter((check) => (check.key === 'protocol_focus_alignment' || check.key === 'triad_focus_closure') &&
        check.status === 'fail');
    if (failedChecks.length === 0) {
        return;
    }
    const detail = failedChecks.map((check) => `${check.key}: ${check.detail}`).join('; ');
    throw new Error(`Triadization focus gate failed: ${detail}. Please realign draft-protocol.json and micro-split.json around the same triadization focus before plan/apply.`);
}
function synchronizeSplitArtifactsFromDraftProtocol(paths, protocol) {
    const descriptors = [
        {
            stage: 'macroSplit',
            filePath: paths.macroSplitFile,
            requiredKeys: ['anchorNodeId', 'leftBranch', 'rightBranch']
        },
        {
            stage: 'mesoSplit',
            filePath: paths.mesoSplitFile,
            requiredKeys: ['classes', 'pipelines']
        },
        {
            stage: 'microSplit',
            filePath: paths.microSplitFile,
            requiredKeys: ['classes']
        }
    ];
    descriptors.forEach(({ stage, filePath, requiredKeys }) => {
        const nextValue = protocol[stage];
        if (!shouldRepairSplitArtifact(nextValue, undefined, requiredKeys, stage)) {
            return;
        }
        const currentValue = readJsonArtifactIfExists(filePath);
        if (!shouldRepairSplitArtifact(nextValue, currentValue, requiredKeys, stage)) {
            return;
        }
        fs.writeFileSync(filePath, JSON.stringify(nextValue, null, 2), 'utf-8');
    });
}
function shouldRepairSplitArtifact(nextValue, currentValue, requiredKeys, _stage) {
    if (!isPlainObject(nextValue)) {
        return false;
    }
    if (!hasAuthoritativeSplitShape(nextValue, requiredKeys)) {
        return false;
    }
    if (!isPlainObject(currentValue)) {
        return true;
    }
    const nextFocus = normalizeDraftFocusValue(nextValue.triadizationFocus);
    const nextOperation = normalizeDraftFocusValue(nextValue.recommendedOperation);
    const currentFocus = normalizeDraftFocusValue(currentValue.triadizationFocus);
    const currentOperation = normalizeDraftFocusValue(currentValue.recommendedOperation);
    if ((nextFocus && currentFocus && currentFocus !== nextFocus) || (nextOperation && currentOperation && currentOperation !== nextOperation)) {
        return false;
    }
    if ((nextFocus && !currentFocus) || (nextOperation && !currentOperation)) {
        return true;
    }
    return requiredKeys.some((key) => hasMeaningfulStageValue(nextValue[key]) && !hasMeaningfulStageValue(currentValue[key]));
}
function hasAuthoritativeSplitShape(value, requiredKeys) {
    const focus = normalizeDraftFocusValue(value.triadizationFocus);
    const operation = normalizeDraftFocusValue(value.recommendedOperation);
    if (focus && operation) {
        return true;
    }
    return requiredKeys.some((key) => hasMeaningfulStageValue(value[key]));
}
function hasMeaningfulStageValue(value) {
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    if (value && typeof value === 'object') {
        return Object.keys(value).length > 0;
    }
    return Boolean(value);
}
function normalizeDraftFocusValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function readJsonArtifactIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        return undefined;
    }
    try {
        return JSON.parse((0, artifactReaders_1.readTextIfExists)(filePath));
    }
    catch {
        return undefined;
    }
}
function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function writeHandoffPrompt(projectRoot, changedFiles, approvedProtocolJson) {
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    const demand = (0, artifactReaders_1.readTextIfExists)(paths.demandFile);
    const protocolJson = approvedProtocolJson ??
        (0, artifactReaders_1.readTextIfExists)(paths.approvedProtocolFile);
    const triadMapJson = (0, artifactReaders_1.readRequiredTextFile)(paths.mapFile);
    const trackedFiles = changedFiles ?? (0, artifactReaders_1.readChangedFilesArtifact)(paths.lastApplyFilesFile);
    const filePayload = trackedFiles
        .filter((filePath) => typeof filePath === 'string' && filePath.trim())
        .map((filePath) => ({
        path: filePath,
        content: fs.existsSync(path.join(projectRoot, filePath))
            ? (0, artifactReaders_1.readTextIfExists)(path.join(projectRoot, filePath))
            : ''
    }));
    (0, workflow_1.writeImplementationHandoff)(paths, {
        userDemand: demand,
        approvedProtocolJson: protocolJson,
        triadMapJson,
        changedFiles: filePayload
    });
}
function toDashboardOptions(options) {
    return {
        defaultView: normalizeDashboardView(options.view),
        showIsolatedCapabilities: Boolean(options.showIsolated),
        fullContractEdges: Boolean(options.fullContractEdges)
    };
}
function normalizeDashboardView(value) {
    if (!value) {
        return undefined;
    }
    return value === 'leaf' ? 'leaf' : 'architecture';
}
function sniffProjectLanguage(projectRoot) {
    if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
        return 'rust';
    }
    if (fs.existsSync(path.join(projectRoot, 'pom.xml')) || fs.existsSync(path.join(projectRoot, 'build.gradle'))) {
        return 'java';
    }
    if (fs.existsSync(path.join(projectRoot, 'package.json')) &&
        fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
        return 'typescript';
    }
    if (fs.existsSync(path.join(projectRoot, 'package.json')) &&
        !fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
        return 'javascript';
    }
    if (fs.existsSync(path.join(projectRoot, 'requirements.txt')) ||
        fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) {
        return 'python';
    }
    if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
        return 'go';
    }
    return (0, config_1.loadTriadConfig)((0, workspace_1.getWorkspacePaths)(projectRoot)).architecture.language;
}
function resolveStableAdapter(language) {
    const adapters = (0, adapter_1.getAvailableAdapters)().filter((adapter) => adapter.language === language);
    const stableAdapter = adapters.find((adapter) => adapter.status === 'stable');
    const adapter = stableAdapter ?? adapters[0];
    if (!adapter) {
        throw new Error(`No language adapter registered for ${language}`);
    }
    return adapter;
}
function createCliLanguageAdapter(language) {
    const adapter = resolveStableAdapter(language);
    let changedFiles = [];
    return {
        language,
        displayName: adapter.displayName,
        applyProtocol(protocol, projectRoot) {
            const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
            const approvedProtocolPath = paths.approvedProtocolFile;
            fs.writeFileSync(approvedProtocolPath, JSON.stringify(protocol, null, 2), 'utf-8');
            changedFiles = adapter.applyUpgradeProtocol(projectRoot, approvedProtocolPath).changedFiles;
        },
        consumeChangedFiles() {
            const current = changedFiles;
            changedFiles = [];
            return current;
        }
    };
}
function hasContractChange(currentNode, nextFission) {
    const normalizeEntries = (entries) => entries.map((entry) => entry.trim()).filter(Boolean);
    return (JSON.stringify(normalizeEntries(currentNode.fission.demand)) !== JSON.stringify(normalizeEntries(nextFission.demand)) ||
        JSON.stringify(normalizeEntries(currentNode.fission.answer)) !== JSON.stringify(normalizeEntries(nextFission.answer)));
}
//# sourceMappingURL=cliSupport.js.map