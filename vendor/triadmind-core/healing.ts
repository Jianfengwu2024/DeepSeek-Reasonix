import * as fs from 'fs';
import { readTextIfExists } from './artifactReaders';
import { loadTriadConfig } from './config';
import {
    BlastRadius,
    buildEvidence,
    buildSummary,
    chooseSuggestedAction,
    classifyDiagnosis,
    estimateBlastRadius,
    getContractGuardLine,
    getHealingOutputRuleLines,
    HealingDiagnosis,
    parseTraceLine,
    RuntimeTraceFrame,
    scoreNodeMatch
} from './healingRightBranch';
import { parseNodeRef, readTriadMap, TriadNodeDefinition } from './protocol';
import { normalizePath, WorkspacePaths } from './workspace';

export * from './healingRightBranch';

/**
 * @LeftBranch
 */
export function prepareHealingArtifacts(paths: WorkspacePaths, errorText: string, retryCount = 0) {
    const config = loadTriadConfig(paths);
    const nodes = readTriadMap(paths.mapFile);
    const diagnosis = diagnoseRuntimeFailure(paths, errorText, retryCount, nodes);
    const requiresHumanApproval =
        diagnosis.blastRadius.risk === 'high' ||
        (diagnosis.diagnosis === 'contract' && config.runtimeHealing.requireHumanApprovalForContractChanges);
    const finalDiagnosis: HealingDiagnosis = {
        ...diagnosis,
        requiresHumanApproval
    };
    const prompt = buildHealingPrompt(paths, errorText, finalDiagnosis);

    fs.writeFileSync(paths.runtimeErrorFile, errorText.trim(), 'utf-8');
    fs.writeFileSync(paths.healingReportFile, JSON.stringify(finalDiagnosis, null, 2), 'utf-8');
    fs.writeFileSync(paths.healingPromptFile, prompt, 'utf-8');

    return {
        diagnosis: finalDiagnosis,
        prompt
    };
}

/**
 * @LeftBranch
 */
export function diagnoseRuntimeFailure(
    paths: WorkspacePaths,
    errorText: string,
    retryCount: number,
    nodes: TriadNodeDefinition[]
): HealingDiagnosis {
    const config = loadTriadConfig(paths);
    const verifyFailure = parseVerifyGateFailure(errorText);
    if (verifyFailure) {
        return diagnoseVerifyGateFailure(paths, errorText, retryCount, nodes, verifyFailure, config.architecture.language);
    }

    const traceFrames = extractTraceFrames(errorText, paths.projectRoot);
    const match = locateBestNodeMatch(traceFrames, nodes);
    const diagnosis = classifyDiagnosis(errorText);
    const blastRadius = estimateBlastRadius(match?.node ?? null, nodes, diagnosis === 'contract');
    const suggestedAction = chooseSuggestedAction(diagnosis, retryCount, config.runtimeHealing.maxAutoRetries);
    const evidence = buildEvidence(errorText, traceFrames, match?.node ?? null, diagnosis, blastRadius);

    return {
        projectRoot: normalizePath(paths.projectRoot),
        adapterLanguage: config.architecture.language,
        retryCount,
        matchedNodeId: match?.node.nodeId ?? null,
        matchedSourcePath: match?.node.sourcePath ?? null,
        diagnosis,
        suggestedAction,
        summary: buildSummary(match?.node ?? null, diagnosis, suggestedAction, blastRadius),
        blastRadius,
        traceFrames,
        evidence,
        requiresHumanApproval: false
    };
}

interface ParsedVerifyGateFailure {
    checks: Array<{
        key: string;
        expected?: number | boolean | string;
        actual?: number | boolean | null;
        detail?: string;
        pre_existing?: boolean;
        introduced_by_current_diff?: boolean;
        remediation?: string[];
    }>;
}

function parseVerifyGateFailure(errorText: string): ParsedVerifyGateFailure | undefined {
    const parsed = parseEmbeddedJsonObject(errorText);
    if (parsed && Array.isArray(parsed.checks)) {
        const failedChecks = parsed.checks.filter(
            (check: any) => check && check.status === 'fail' && typeof check.key === 'string'
        );
        if (failedChecks.length > 0) {
            return { checks: failedChecks };
        }
    }

    const metricMatch = errorText.match(/\b([a-z][a-z0-9_]*_count|[a-z][a-z0-9_]*_ratio|abstraction_deficit_index)\s*[=:]\s*(\d+(?:\.\d+)?)/i);
    if (/verify\s+--strict|strict\s+fails?|zero_abstraction_hotspot_count|runtime_unmatched_route_count/i.test(errorText)) {
        const key = metricMatch?.[1] ?? (errorText.includes('zero_abstraction_hotspot_count') ? 'zero_abstraction_hotspot_count' : 'verify_gate');
        return {
            checks: [
                {
                    key,
                    actual: metricMatch ? Number(metricMatch[2]) : null,
                    detail: errorText.split(/\r?\n/).find((line) => line.trim())?.trim()
                }
            ]
        };
    }

    return undefined;
}

function parseEmbeddedJsonObject(text: string): any | undefined {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) {
        return undefined;
    }

    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch {
        return undefined;
    }
}

function diagnoseVerifyGateFailure(
    paths: WorkspacePaths,
    errorText: string,
    retryCount: number,
    nodes: TriadNodeDefinition[],
    verifyFailure: ParsedVerifyGateFailure,
    adapterLanguage: string
): HealingDiagnosis {
    const gateFailures = verifyFailure.checks.map((check) => {
        const matchedSourcePaths = extractSourcePathsFromDetail(check.detail ?? errorText);
        return {
            key: check.key,
            expected: check.expected,
            actual: check.actual,
            pre_existing: check.pre_existing,
            introduced_by_current_diff: check.introduced_by_current_diff,
            matchedSourcePaths
        };
    });
    const matchedNode = findBestVerifyGateNode(nodes, gateFailures.flatMap((failure) => failure.matchedSourcePaths));
    const impactedNodeIds = matchedNode ? [matchedNode.nodeId] : [];
    const remediation = buildVerifyGateRemediation(verifyFailure.checks, errorText);
    const preExistingOnly = gateFailures.length > 0 && gateFailures.every((failure) => failure.pre_existing === true);
    const evidence = [
        'diagnosis=topology',
        'source=verify_gate',
        `failedChecks=${gateFailures.map((failure) => failure.key).join(', ')}`,
        preExistingOnly ? 'classification=pre_existing' : 'classification=regression_or_unbaselined',
        ...remediation.map((item) => `remediation=${item}`)
    ];

    return {
        projectRoot: normalizePath(paths.projectRoot),
        adapterLanguage,
        retryCount,
        matchedNodeId: matchedNode?.nodeId ?? null,
        matchedSourcePath: matchedNode?.sourcePath ?? gateFailures[0]?.matchedSourcePaths[0] ?? null,
        diagnosis: 'topology',
        suggestedAction: 'manual_review',
        summary: buildVerifyGateSummary(gateFailures, matchedNode, preExistingOnly),
        blastRadius: {
            impactedNodeIds,
            risk: gateFailures.some((failure) => failure.introduced_by_current_diff === true) ? 'medium' : 'low'
        },
        traceFrames: [],
        evidence,
        remediation,
        gateFailures,
        requiresHumanApproval: false
    };
}

function extractSourcePathsFromDetail(text: string) {
    const matches = Array.from(text.matchAll(/(?:^|[\s,;])((?:[\w.-]+\/)+[\w.@-]+\.[A-Za-z0-9]+)(?=\s|$|\(|,|;)/g));
    return Array.from(new Set(matches.map((match) => normalizePath(match[1]))));
}

function findBestVerifyGateNode(nodes: TriadNodeDefinition[], sourcePaths: string[]) {
    const normalizedSources = new Set(sourcePaths.map((sourcePath) => normalizePath(sourcePath).toLowerCase()));
    if (normalizedSources.size === 0) {
        return undefined;
    }

    return nodes.find((node) => normalizedSources.has(normalizePath(node.sourcePath ?? '').toLowerCase()));
}

function buildVerifyGateRemediation(checks: ParsedVerifyGateFailure['checks'], errorText: string) {
    const fromReport = checks.flatMap((check) => (Array.isArray(check.remediation) ? check.remediation : []));
    const keys = checks.map((check) => check.key).join('\n');
    const text = `${keys}\n${errorText}`;
    const steps = [...fromReport];

    if (/zero_abstraction_hotspot_count|abstraction/i.test(text)) {
        steps.push('If this is existing debt, run `triadmind verify --update-baseline --json` before unrelated integration.');
        steps.push('For API clients, extract a domain adapter that owns typed endpoint contracts and transport concerns.');
        steps.push('For calibration pages, split state, commands, and view rendering into separate topology nodes.');
        steps.push('For query clients, add a contract boundary around cache policy, retry policy, and error handling.');
    }
    if (/runtime_unmatched_route_count/i.test(text)) {
        steps.push('Add or refresh backend route contracts, then regenerate runtime artifacts and verify the unmatched route baseline.');
    }

    return Array.from(new Set(steps));
}

function buildVerifyGateSummary(
    gateFailures: HealingDiagnosis['gateFailures'],
    matchedNode: TriadNodeDefinition | undefined,
    preExistingOnly: boolean
) {
    const target = matchedNode?.nodeId ?? gateFailures?.[0]?.matchedSourcePaths?.[0] ?? 'verify gate';
    const classification = preExistingOnly ? 'pre-existing baseline debt' : 'new or unbaselined strict-gate failure';
    return `${target} is classified as topology; ${classification}; suggested action is manual_review; blast radius is low.`;
}

/**
 * @LeftBranch
 */
export function buildHealingPrompt(paths: WorkspacePaths, errorText: string, diagnosis: HealingDiagnosis) {
    const config = loadTriadConfig(paths);
    const triadMapJson = readTextIfExists(paths.mapFile, { trim: true }) || '[]';
    const triadSpec = readTextIfExists(paths.triadSpecFile, { trim: true });
    const latestDemand = readTextIfExists(paths.demandFile, { trim: true });
    const contractGuard = getContractGuardLine(config.runtimeHealing.requireHumanApprovalForContractChanges);

    return [
        '[System]',
        '你是 TriadMind 的 Runtime Self-Healing 架构师。',
        '你的任务不是直接输出补丁代码，而是先根据运行时错误回溯到拓扑节点，再输出严格 JSON 升级协议。',
        '优先使用 `modify` 修复当前节点；只有当重试预算耗尽或职责明显过载时，才允许 `create_child`。',
        contractGuard,
        '',
        '[Triad Spec]',
        triadSpec,
        '',
        '[Project Root]',
        normalizePath(paths.projectRoot),
        '',
        '[Runtime Healing Config]',
        '```json',
        JSON.stringify(config.runtimeHealing, null, 2),
        '```',
        '',
        '[Latest User Demand]',
        latestDemand ? JSON.stringify(latestDemand) : '""',
        '',
        '[Triad Map JSON]',
        '```json',
        triadMapJson,
        '```',
        '',
        '[Runtime Error]',
        '```text',
        errorText.trim(),
        '```',
        '',
        '[Healing Diagnosis]',
        '```json',
        JSON.stringify(diagnosis, null, 2),
        '```',
        '',
        '[Output Rules]',
        ...getHealingOutputRuleLines(),
        '',
        '[Output Target]',
        normalizePath(paths.draftFile)
    ].join('\n');
}

function extractTraceFrames(errorText: string, projectRoot: string) {
    const frames: RuntimeTraceFrame[] = [];
    const projectRootNormalized = normalizePath(projectRoot).toLowerCase();

    for (const rawLine of errorText.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }

        const frame = parseTraceLine(line, projectRootNormalized, projectRoot);
        if (frame) {
            frames.push(frame);
        }
    }

    return frames;
}

function locateBestNodeMatch(frames: RuntimeTraceFrame[], nodes: TriadNodeDefinition[]) {
    let bestMatch:
        | {
              node: TriadNodeDefinition;
              score: number;
          }
        | undefined;

    for (const frame of frames) {
        for (const node of nodes) {
            const score = scoreNodeMatch(frame, node);
            if (score <= 0) {
                continue;
            }

            if (!bestMatch || score > bestMatch.score) {
                bestMatch = {
                    node,
                    score
                };
            }
        }
    }

    return bestMatch;
}
