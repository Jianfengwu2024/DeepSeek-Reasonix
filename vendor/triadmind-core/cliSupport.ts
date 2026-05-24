import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getAvailableAdapters } from './adapter';
import { resolveAnalyzerOptionsFromConfig } from './analyzerOptionsSupport';
import { readChangedFilesArtifact, readRequiredTextFile, readTextIfExists } from './artifactReaders';
import { loadTriadConfig, TriadLanguage, TriadScanMode } from './config';
import { detectTopologicalDrift, calculateBlastRadius } from './analyzer';
import { LanguageAdapter } from './languageAdapter';
import { assertProtocolShape, readJsonFile, readTriadMap, UpgradeProtocol } from './protocol';
import { runTopologyVerify } from './verify';
import { syncTriadMap, syncTriadMapWithOptions } from './sync';
import {
    resolveExpectedTriadizationFocus as resolveExpectedTriadizationFocusFromArtifacts
} from './triadizationFocusSupport';
import { createDraftTemplate, ensureTriadSpec, writeImplementationHandoff, writePromptPacket } from './workflow';
import { DashboardOptions } from './visualizer';
import { getWorkspacePaths, WorkspacePaths } from './workspace';

export { resolveExpectedTriadizationFocus } from './triadizationFocusSupport';

const BLAST_RADIUS_WARNING_THRESHOLD = 5;

type DashboardView = 'architecture' | 'leaf';

export interface DashboardCliOptions {
    view?: string;
    showIsolated?: boolean;
    fullContractEdges?: boolean;
}

type CliLanguageAdapter = {
    language: TriadLanguage;
    displayName: string;
    applyProtocol(protocol: unknown, projectRoot: string): void;
    consumeChangedFiles(): string[];
};

export function syncProjectTopology(paths: WorkspacePaths, force = false, scanMode?: TriadScanMode) {
    return scanMode ? syncTriadMapWithOptions(paths, { force, scanMode }) : syncTriadMap(paths, force);
}

export function readCurrentTriadMap(paths: WorkspacePaths) {
    return readTriadMap(paths.mapFile);
}

export function prepareWorkspace(paths: WorkspacePaths, demand: string) {
    ensureTriadSpec(paths);
    syncProjectTopology(paths);
    createDraftTemplate(paths, demand);
    writePromptPacket(paths, demand);
}

export function resolveDemand(demandParts: string[], optionDemand?: string, paths?: WorkspacePaths) {
    const fromArgs = demandParts.join(' ').trim();
    if (optionDemand?.trim()) {
        return optionDemand.trim();
    }

    if (fromArgs) {
        return fromArgs;
    }

    if (paths?.demandFile && fs.existsSync(paths.demandFile)) {
        return readTextIfExists(paths.demandFile, { trim: true });
    }

    return '';
}

export function normalizeInvokeDemand(value: string) {
    return value.trim().replace(/^@?triadmind(?:\s*[:锛?]\s*|\s+)/i, '').trim();
}

export async function openFile(filePath: string) {
    const command =
        process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', filePath] : [filePath];

    const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore'
    });

    child.unref();
}

export function dispatchProtocolApply(projectRoot: string, protocol: UpgradeProtocol) {
    const detectedLanguage = sniffProjectLanguage(projectRoot);
    const adapter = createCliLanguageAdapter(detectedLanguage);
    adapter.applyProtocol(protocol, projectRoot);

    return {
        language: detectedLanguage,
        displayName: adapter.displayName,
        changedFiles: adapter.consumeChangedFiles()
    };
}

export function assertNoTopologicalDegradation(
    paths: WorkspacePaths,
    previousMap: any[],
    lifecycle: 'init' | 'apply'
) {
    const config = loadTriadConfig(paths);
    const drift = detectTopologicalDrift(previousMap, readCurrentTriadMap(paths), resolveAnalyzerOptionsFromConfig(config));
    if (!drift.isDegraded) {
        return;
    }

    throw new Error(`[${lifecycle}] topological drift detected: ${drift.summary.join(' ')}`);
}

export function warnBlastRadiusIfNeeded(paths: WorkspacePaths, protocol: UpgradeProtocol) {
    const currentMap = readCurrentTriadMap(paths);
    if (currentMap.length === 0) {
        return;
    }

    const config = loadTriadConfig(paths);
    const analyzerOptions = resolveAnalyzerOptionsFromConfig(config);
    const currentNodeMap = new Map(currentMap.map((node) => [node.nodeId, node]));
    const impactedNodeIds = new Set<string>();
    const hotspots: string[] = [];

    for (const action of protocol.actions) {
        if (action.op !== 'modify') {
            continue;
        }

        const currentNode = currentNodeMap.get(action.nodeId);
        if (!currentNode) {
            continue;
        }

        const isContractChange = hasContractChange(currentNode, action.fission);
        const impacted = calculateBlastRadius(currentMap, action.nodeId, isContractChange, analyzerOptions);
        impacted.forEach((nodeId) => impactedNodeIds.add(nodeId));

        if (isContractChange && impacted.length > 0) {
            hotspots.push(`${action.nodeId} -> ${impacted.length}`);
        }
    }

    if (impactedNodeIds.size < BLAST_RADIUS_WARNING_THRESHOLD) {
        return;
    }

    console.log(
        `Blast radius warning: ${impactedNodeIds.size} downstream nodes may be affected (${Array.from(impactedNodeIds)
            .sort()
            .slice(0, 8)
            .join(', ')}).`
    );

    if (hotspots.length > 0) {
        console.log(`   - contract hotspots: ${hotspots.join('; ')}`);
    }
}

export function validateDraftProtocol(paths: WorkspacePaths) {
    let protocol: UpgradeProtocol;

    try {
        protocol = readJsonFile<UpgradeProtocol>(paths.draftFile);
    } catch (error: any) {
        throw new Error(`Invalid JSON in ${paths.draftFile}: ${error.message}`);
    }

    const existingNodes = readTriadMap(paths.mapFile);
    const config = loadTriadConfig(paths);
    const expectedTriadizationFocus = resolveExpectedTriadizationFocusFromArtifacts(paths);
    const parsedProtocol = assertProtocolShape(protocol, {
        existingNodes,
        minConfidence: config.protocol.minConfidence,
        requireConfidence: config.protocol.requireConfidence,
        expectedTriadizationFocus
    });
    synchronizeSplitArtifactsFromDraftProtocol(paths, parsedProtocol);
    assertTriadizationFocusGate(paths);
    return parsedProtocol;
}

export function assertTriadizationFocusGate(paths: WorkspacePaths) {
    const report = runTopologyVerify(paths);
    const failedChecks = report.checks.filter(
        (check) =>
            (check.key === 'protocol_focus_alignment' || check.key === 'triad_focus_closure') &&
            check.status === 'fail'
    );

    if (failedChecks.length === 0) {
        return;
    }

    const detail = failedChecks.map((check) => `${check.key}: ${check.detail}`).join('; ');
    throw new Error(
        `Triadization focus gate failed: ${detail}. Please realign draft-protocol.json and micro-split.json around the same triadization focus before plan/apply.`
    );
}

function synchronizeSplitArtifactsFromDraftProtocol(paths: WorkspacePaths, protocol: UpgradeProtocol) {
    const descriptors: Array<{
        stage: 'macroSplit' | 'mesoSplit' | 'microSplit';
        filePath: string;
        requiredKeys: string[];
    }> = [
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

function shouldRepairSplitArtifact(
    nextValue: unknown,
    currentValue: unknown,
    requiredKeys: string[],
    _stage: 'macroSplit' | 'mesoSplit' | 'microSplit'
) {
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

function hasAuthoritativeSplitShape(value: Record<string, unknown>, requiredKeys: string[]) {
    const focus = normalizeDraftFocusValue(value.triadizationFocus);
    const operation = normalizeDraftFocusValue(value.recommendedOperation);
    if (focus && operation) {
        return true;
    }

    return requiredKeys.some((key) => hasMeaningfulStageValue(value[key]));
}

function hasMeaningfulStageValue(value: unknown) {
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return Boolean(value);
}

function normalizeDraftFocusValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function readJsonArtifactIfExists(filePath: string) {
    if (!fs.existsSync(filePath)) {
        return undefined;
    }

    try {
        return JSON.parse(readTextIfExists(filePath));
    } catch {
        return undefined;
    }
}

function isPlainObject(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function writeHandoffPrompt(projectRoot: string, changedFiles?: string[], approvedProtocolJson?: string) {
    const paths = getWorkspacePaths(projectRoot);
    const demand = readTextIfExists(paths.demandFile);
    const protocolJson =
        approvedProtocolJson ??
        readTextIfExists(paths.approvedProtocolFile);
    const triadMapJson = readRequiredTextFile(paths.mapFile);
    const trackedFiles = changedFiles ?? readChangedFilesArtifact(paths.lastApplyFilesFile);

    const filePayload = trackedFiles
        .filter((filePath: string) => typeof filePath === 'string' && filePath.trim())
        .map((filePath: string) => ({
            path: filePath,
            content: fs.existsSync(path.join(projectRoot, filePath))
                ? readTextIfExists(path.join(projectRoot, filePath))
                : ''
        }));

    writeImplementationHandoff(paths, {
        userDemand: demand,
        approvedProtocolJson: protocolJson,
        triadMapJson,
        changedFiles: filePayload
    });
}

export function toDashboardOptions(options: DashboardCliOptions): DashboardOptions {
    return {
        defaultView: normalizeDashboardView(options.view),
        showIsolatedCapabilities: Boolean(options.showIsolated),
        fullContractEdges: Boolean(options.fullContractEdges)
    };
}

function normalizeDashboardView(value?: string): DashboardView | undefined {
    if (!value) {
        return undefined;
    }
    return value === 'leaf' ? 'leaf' : 'architecture';
}

function sniffProjectLanguage(projectRoot: string): TriadLanguage {
    if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
        return 'rust';
    }

    if (fs.existsSync(path.join(projectRoot, 'pom.xml')) || fs.existsSync(path.join(projectRoot, 'build.gradle'))) {
        return 'java';
    }

    if (
        fs.existsSync(path.join(projectRoot, 'package.json')) &&
        fs.existsSync(path.join(projectRoot, 'tsconfig.json'))
    ) {
        return 'typescript';
    }

    if (
        fs.existsSync(path.join(projectRoot, 'package.json')) &&
        !fs.existsSync(path.join(projectRoot, 'tsconfig.json'))
    ) {
        return 'javascript';
    }

    if (
        fs.existsSync(path.join(projectRoot, 'requirements.txt')) ||
        fs.existsSync(path.join(projectRoot, 'pyproject.toml'))
    ) {
        return 'python';
    }

    if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
        return 'go';
    }

    return loadTriadConfig(getWorkspacePaths(projectRoot)).architecture.language;
}

function resolveStableAdapter(language: TriadLanguage): LanguageAdapter {
    const adapters = getAvailableAdapters().filter((adapter) => adapter.language === language);
    const stableAdapter = adapters.find((adapter) => adapter.status === 'stable');
    const adapter = stableAdapter ?? adapters[0];

    if (!adapter) {
        throw new Error(`No language adapter registered for ${language}`);
    }

    return adapter;
}

function createCliLanguageAdapter(language: TriadLanguage): CliLanguageAdapter {
    const adapter = resolveStableAdapter(language);
    let changedFiles: string[] = [];

    return {
        language,
        displayName: adapter.displayName,
        applyProtocol(protocol: unknown, projectRoot: string) {
            const paths = getWorkspacePaths(projectRoot);
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

function hasContractChange(
    currentNode: { fission: { demand: string[]; answer: string[] } },
    nextFission: { demand: string[]; answer: string[] }
) {
    const normalizeEntries = (entries: string[]) => entries.map((entry) => entry.trim()).filter(Boolean);

    return (
        JSON.stringify(normalizeEntries(currentNode.fission.demand)) !== JSON.stringify(normalizeEntries(nextFission.demand)) ||
        JSON.stringify(normalizeEntries(currentNode.fission.answer)) !== JSON.stringify(normalizeEntries(nextFission.answer))
    );
}
