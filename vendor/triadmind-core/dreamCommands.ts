import { Command } from 'commander';
import chalk from 'chalk';
import { loadTriadConfig, registerMatureStableArchitectureAnchor } from './config';
import { formatDreamReport, loadLatestDreamReport } from './dream';
import { getDreamDaemonStatus, runDreamDaemonLoop, startDreamDaemon, stopDreamDaemon } from './dreamDaemon';
import {
    deriveStableArchitectureAnchorFromProposal,
    formatDreamFeedbackLedger,
    loadDreamFeedbackLedger,
    normalizeDreamFeedbackReviewerRole,
    recordDreamProposalRejection
} from './dreamFeedbackSupport';
import { tickDreamAutoRun } from './dreamScheduler';
import { generateDreamDashboard } from './dreamVisualizer';
import { resolveEffectiveStableAnchors } from './stableArchitectureAnchorSupport';
import {
    validateFeedback
} from './dreamFeedbackValidator';
import {
    addDreamRule,
    checkForDuplicateBeforeAdd,
    deactivateDreamRule,
    deduplicateRules,
    expireStaleRules,
    findConflictingRules,
    formatActiveRulesPrompt,
    getActiveRules,
    getDreamRuleFilePath,
    loadDreamRuleLedger
} from './dreamRuleLedger';
import {
    extractRuleFromRejection,
    type ExtractRuleResult
} from './dreamRuleExtractor';
import { openFile } from './cliSupport';
import { normalizePositiveCliInteger, parseOptionalNonNegativeCliInteger, parseOptionalPositiveCliInteger } from './cliPresentationSupport';
import { DreamRunCliOptions, executeDreamRun } from './cliWorkflowSupport';
import { ensureTriadSpec, getWorkspacePaths } from './workflow';

export function registerDreamCommands(program: Command) {
    const dreamCommand = program
        .command('dream')
        .description('Run idle-style architecture dreaming and governance proposal generation')
        .addHelpText(
            'after',
            '\nDefault behavior: `triadmind dream` is equivalent to `triadmind dream run`.\nYou can pass run flags directly, e.g. `triadmind dream --json`.'
        );

    dreamCommand
        .command('run')
        .description('Analyze topology drift and emit dream proposals/artifacts')
        .option('--mode <manual|idle>', 'Dream run mode', 'manual')
        .option('--force', 'Ignore idle gate or dream.enabled=false and run immediately')
        .option('--max-proposals <n>', 'Maximum number of dream proposals to keep')
        .option('--min-confidence <n>', 'Minimum confidence threshold for retained proposals (0-1)')
        .option('--impact-threshold <n>', 'Only analyze nodes whose impact-chain length is at least n')
        .option('--visualize', 'Generate dream-visualizer.html after dream run')
        .option('--theme <leaf-like|runtime-dark>', 'Dream visualizer theme', 'leaf-like')
        .option('--json', 'Emit machine-readable dream report JSON')
        .action(async (options: DreamRunCliOptions) => {
            await executeDreamRun(options);
        });

    dreamCommand
        .command('fast')
        .description('Fast Dream scan for advisory/strict impact chains only (alias: dream run --impact-threshold 3)')
        .option('--json', 'Emit machine-readable dream report JSON')
        .action(async (options: { json?: boolean }) => {
            await executeDreamRun({
                mode: 'manual',
                force: true,
                impactThreshold: '3',
                json: Boolean(options.json)
            });
        });

    dreamCommand
        .command('auto')
        .description('Record one activity tick and execute auto-dream when gates pass')
        .option('--trigger <name>', 'Auto trigger source label', 'manual')
        .option('--force', 'Bypass gate checks and force auto-dream execution')
        .option('--impact-threshold <n>', 'Only analyze nodes whose impact-chain length is at least n when auto run fires')
        .option('--json', 'Emit machine-readable auto tick result JSON')
        .action(async (options: { trigger?: string; force?: boolean; impactThreshold?: string; json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const result = await tickDreamAutoRun(paths, {
                trigger: String(options.trigger ?? 'manual'),
                force: Boolean(options.force),
                impactThreshold: normalizePositiveCliInteger(options.impactThreshold, 0) || undefined
            });

            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
                return;
            }

            const color = result.status === 'run' ? chalk.green : result.status === 'error' ? chalk.red : chalk.gray;
            console.log(
                color(
                    `[TriadMind] dream auto ${result.status}: trigger=${result.trigger}, reason=${result.reason}, pending=${result.pendingEvents}, lock=${result.lock}`
                )
            );
            if (result.error) {
                console.log(chalk.yellow(`[TriadMind] dream auto error: ${result.error}`));
            }
        });

    dreamCommand
        .command('review')
        .description('Read the latest dream report from workspace artifacts')
        .option('--json', 'Emit machine-readable dream report JSON')
        .action((options: { json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const report = loadLatestDreamReport(paths);
            if (!report) {
                console.log(chalk.red(`No dream report found: ${paths.dreamReportFile}`));
                process.exitCode = 1;
                return;
            }

            if (options.json) {
                console.log(JSON.stringify(report, null, 2));
                return;
            }

            console.log(formatDreamReport(report));
        });

    const dreamFeedbackCommand = dreamCommand
        .command('feedback')
        .description('Record and inspect project-specific dream proposal rejection memory');

    dreamFeedbackCommand
        .command('reject')
        .description('Reject a proposal from the latest dream report and persist the feedback memory')
        .requiredOption('--proposal <id>', 'Proposal id from the latest dream report')
        .requiredOption('--reason <text>', 'Reason for rejecting the proposal')
        .option('--reason-code <code>', 'Machine-readable rejection reason code, e.g. stable_core_module')
        .option('--reviewer <name>', 'Reviewer name recorded in dream feedback memory')
        .option('--reviewer-role <maintainer|ai|operator>', 'Reviewer role label', 'maintainer')
        .option('--mark-stable-anchor', 'Also register the target as a mature/stable architecture anchor')
        .option('--json', 'Emit machine-readable rejection result JSON')
        .action(
            async (options: {
                proposal?: string;
                reason?: string;
                reasonCode?: string;
                reviewer?: string;
                reviewerRole?: string;
                markStableAnchor?: boolean;
                json?: boolean;
            }) => {
                const paths = getWorkspacePaths(process.cwd());
                ensureTriadSpec(paths);

                const report = loadLatestDreamReport(paths);
                if (!report) {
                    console.log(chalk.red(`No dream report found: ${paths.dreamReportFile}`));
                    process.exitCode = 1;
                    return;
                }

                const reviewerRole = normalizeDreamFeedbackReviewerRole(options.reviewerRole) ?? undefined;
                if (!reviewerRole) {
                    console.log(chalk.red(`Invalid reviewer role: ${options.reviewerRole}`));
                    process.exitCode = 1;
                    return;
                }

                const proposalId = String(options.proposal ?? '').trim();
                const proposal = report.proposals.find((item) => item.id === proposalId);
                if (!proposal) {
                    console.log(chalk.red(`Dream proposal not found in latest report: ${proposalId}`));
                    process.exitCode = 1;
                    return;
                }

                const shouldMarkStableAnchor =
                    Boolean(options.markStableAnchor) || String(options.reasonCode ?? '').trim() === 'stable_core_module';
                const stableAnchor = shouldMarkStableAnchor ? deriveStableArchitectureAnchorFromProposal(proposal) : undefined;
                let registeredStableAnchor:
                    | {
                          nodeId?: string;
                          sourcePath?: string;
                      }
                    | undefined;
                if (shouldMarkStableAnchor && stableAnchor) {
                    registerMatureStableArchitectureAnchor(paths, stableAnchor);
                    registeredStableAnchor = stableAnchor;
                }

                const result = recordDreamProposalRejection(paths, {
                    proposal,
                    reason: String(options.reason ?? ''),
                    reasonCode: options.reasonCode,
                    reviewer: options.reviewer,
                    reviewerRole,
                    isStableAnchor: shouldMarkStableAnchor && Boolean(registeredStableAnchor),
                    stableAnchorNodeId: registeredStableAnchor?.nodeId,
                    stableAnchorSourcePath: registeredStableAnchor?.sourcePath
                });

                // ── Auto-rule extraction ──────────────────────────────
                let extraction: ExtractRuleResult | undefined;
                try {
                    extraction = await extractRuleFromRejection(paths, {
                        proposal,
                        rejection: result.record
                    });
                } catch (extractError: any) {
                    // Extraction is best-effort; don't fail the rejection flow
                }

                let savedRuleId: string | undefined;
                if (extraction?.extracted && extraction.rule.summary) {
                    try {
                        const addResult = addDreamRule(paths, {
                            summary: extraction.rule.summary,
                            constraintType: extraction.rule.constraintType,
                            targetPattern: extraction.rule.targetPattern,
                            category: proposal.category,
                            confidence: extraction.rule.confidence,
                            sourceProposalId: proposal.id,
                            sourceProposalTitle: proposal.title,
                            sourceRejectionId: result.record.decisionId,
                            ttlDays: extraction.rule.ttlDays ?? undefined
                        });
                        savedRuleId = addResult.rule.ruleId;

                        // ── Conflict check after add ────────────────────
                        try {
                            const dupCheck = checkForDuplicateBeforeAdd(paths, {
                                summary: extraction.rule.summary,
                                constraintType: extraction.rule.constraintType,
                                targetPattern: extraction.rule.targetPattern,
                                category: proposal.category,
                                confidence: extraction.rule.confidence,
                                sourceProposalId: proposal.id,
                                sourceProposalTitle: proposal.title,
                                sourceRejectionId: result.record.decisionId,
                                ttlDays: extraction.rule.ttlDays ?? undefined
                            });
                            if (dupCheck.isExactDuplicate) {
                                console.log(
                                    chalk.yellow(
                                        `[TriadMind] warning: exact duplicate rule already exists — ${addResult.rule.ruleId} may be redundant.`
                                    )
                                );
                            } else if (dupCheck.warnings.length > 0) {
                                for (const w of dupCheck.warnings) {
                                    console.log(chalk.yellow(`[TriadMind] conflict warning: ${w}`));
                                }
                            }
                        } catch {
                            // Best-effort
                        }
                    } catch (ruleError: any) {
                        // Rule persistence is best-effort too
                    }
                }

                if (options.json) {
                    console.log(
                        JSON.stringify(
                            {
                                dreamFeedbackFile: paths.dreamFeedbackFile,
                                dreamRuleFile: getDreamRuleFilePath(paths),
                                loadStatus: result.loadStatus,
                                rejectionCount: result.ledger.rejections.length,
                                stableAnchor: registeredStableAnchor,
                                record: result.record,
                                ruleExtraction: extraction
                                    ? {
                                          extracted: extraction.extracted,
                                          rule: extraction.rule,
                                          ruleId: savedRuleId,
                                          error: extraction.error
                                      }
                                    : null
                            },
                            null,
                            2
                        )
                    );
                    return;
                }

                console.log(chalk.green(`[TriadMind] Dream rejection recorded: ${proposal.id}`));
                console.log(chalk.green(`[TriadMind] feedback memory: ${paths.dreamFeedbackFile}`));
                console.log(chalk.gray(`[TriadMind] reason: ${result.record.reason}`));

                if (extraction) {
                    if (extraction.extracted && savedRuleId) {
                        console.log(
                            chalk.cyan(
                                `[TriadMind] architecture rule extracted (${savedRuleId}): ${extraction.rule.summary}`
                            )
                        );
                    } else if (extraction.error) {
                        console.log(
                            chalk.yellow(
                                `[TriadMind] rule extraction note: ${extraction.error}`
                            )
                        );
                    }
                }

                if (registeredStableAnchor) {
                    console.log(
                        chalk.green(
                            `[TriadMind] stable architecture anchor registered: ${registeredStableAnchor.nodeId ?? registeredStableAnchor.sourcePath}`
                        )
                    );
                }
            }
        );

    dreamFeedbackCommand
        .command('review')
        .description('Read the recorded dream proposal rejection memory')
        .option('--json', 'Emit machine-readable dream feedback JSON')
        .action((options: { json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const feedback = loadDreamFeedbackLedger(paths);
            if (options.json) {
                console.log(JSON.stringify(feedback.ledger, null, 2));
                return;
            }

            if (feedback.status === 'parse_failed' || feedback.status === 'shape_invalid') {
                console.log(chalk.yellow(`[TriadMind] dream feedback memory was unreadable and has been ignored.`));
            }
            console.log(formatDreamFeedbackLedger(feedback.ledger));
        });

    dreamFeedbackCommand
        .command('rules')
        .description('View and manage extracted architecture constraint rules from dream-rules.json')
        .option('--json', 'Emit machine-readable rule ledger JSON')
        .option('--deactivate <ruleId>', 'Deactivate a rule by ruleId')
        .option('--expire', 'Manually trigger TTL-based rule expiration')
        .option('--check-conflicts', 'Detect contradictions and near-duplicates among active rules')
        .option('--deduplicate', 'Auto-merge near-duplicate rules (keeps highest confidence)')
        .action((options: {
            json?: boolean;
            deactivate?: string;
            expire?: boolean;
            checkConflicts?: boolean;
            deduplicate?: boolean;
        }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            if (options.expire) {
                const expiredCount = expireStaleRules(paths);
                console.log(
                    expiredCount > 0
                        ? chalk.green(`[TriadMind] expired ${expiredCount} stale rule(s)`)
                        : chalk.gray('[TriadMind] no stale rules to expire')
                );
                if (options.json) {
                    console.log(JSON.stringify({ expiredCount }, null, 2));
                    return;
                }
            }

            if (options.deactivate) {
                const ok = deactivateDreamRule(paths, options.deactivate);
                console.log(
                    ok
                        ? chalk.green(`[TriadMind] rule deactivated: ${options.deactivate}`)
                        : chalk.yellow(`[TriadMind] rule not found or already inactive: ${options.deactivate}`)
                );
                if (options.json) {
                    console.log(JSON.stringify({ deactivated: ok, ruleId: options.deactivate }, null, 2));
                    return;
                }
            }

            // ── Deduplicate ────────────────────────────────────────────
            if (options.deduplicate) {
                const dedupResult = deduplicateRules(paths);
                if (dedupResult.removedCount > 0) {
                    console.log(chalk.green(`[TriadMind] deduplicated ${dedupResult.removedCount} rule(s):`));
                    for (const pair of dedupResult.mergedPairs) {
                        console.log(chalk.gray(`  - ${pair.reason}`));
                    }
                } else {
                    console.log(chalk.gray('[TriadMind] no near-duplicate rules found.'));
                }
                if (options.json) {
                    console.log(JSON.stringify(dedupResult, null, 2));
                    return;
                }
            }

            // ── Conflict check ──────────────────────────────────────────
            if (options.checkConflicts) {
                const loadResult0 = loadDreamRuleLedger(paths);
                const report = findConflictingRules(loadResult0.ledger);
                if (report.conflicts.length === 0) {
                    console.log(chalk.green('[TriadMind] no conflicts detected among active rules.'));
                } else {
                    console.log(chalk.yellow(`[TriadMind] ${report.conflicts.length} conflict(s) detected:`));
                    for (const conflict of report.conflicts) {
                        const color = conflict.type === 'direct_contradiction' ? chalk.red : chalk.yellow;
                        console.log(color(`  [${conflict.type}] ${conflict.detail}`));
                        console.log(color(`    A: ${conflict.ruleA.ruleId} (confidence=${conflict.ruleA.confidence})`));
                        console.log(color(`    B: ${conflict.ruleB.ruleId} (confidence=${conflict.ruleB.confidence})`));
                    }
                }
                if (options.json) {
                    console.log(JSON.stringify(report, null, 2));
                    return;
                }
            }

            const loadResult = loadDreamRuleLedger(paths);

            if (options.json) {
                console.log(JSON.stringify(loadResult.ledger, null, 2));
                return;
            }

            const active = getActiveRules(loadResult.ledger);
            console.log(`TriadMind Architecture Rules (${active.length} active / ${loadResult.ledger.rules.length} total)`);
            console.log(`rule file: ${getDreamRuleFilePath(paths)}`);

            if (active.length === 0) {
                console.log(chalk.gray('- No active architecture constraint rules.'));
            }

            for (const rule of active) {
                const ttl = rule.ttlDays ? ` (TTL: ${rule.ttlDays}d)` : ' (permanent)';
                const scope = rule.targetPattern && rule.targetPattern !== '*' ? ` scope=${rule.targetPattern}` : '';
                console.log(
                    `  ${chalk.cyan(rule.ruleId)} [${rule.constraintType.toUpperCase()}]${scope}${ttl}`
                );
                console.log(`    ${rule.summary}`);
                if (rule.sourceProposalTitle) {
                    console.log(`    (from: ${rule.sourceProposalTitle})`);
                }
            }
        });

    dreamFeedbackCommand
        .command('validate')
        .description('Validate active architecture rules against the latest dream proposals')
        .option('--json', 'Emit machine-readable validation report JSON')
        .action((options: { json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const report = validateFeedback(paths);

            if (options.json) {
                console.log(JSON.stringify(report, null, 2));
                return;
            }

            const score = report.summary.overallScore;
            const scoreColor = score >= 0.8 ? chalk.green : score >= 0.4 ? chalk.yellow : chalk.red;
            console.log(`TriadMind Feedback Validation Report`);
            console.log(`project=${report.project}`);
            console.log(`generatedAt=${report.generatedAt}`);
            console.log(``);
            console.log(`Summary:`);
            console.log(`  totalRules=${report.summary.totalRules}`);
            console.log(chalk.green(`  compliant=${report.summary.compliant}`));
            console.log(report.summary.violated > 0 ? chalk.red(`  violated=${report.summary.violated}`) : `  violated=${report.summary.violated}`);
            console.log(`  untested=${report.summary.untested}`);
            console.log(scoreColor(`  overallScore=${score.toFixed(3)}`));
            console.log(``);

            for (const entry of report.entries) {
                const vColor = entry.verdict === 'violated' ? chalk.red : entry.verdict === 'compliant' ? chalk.green : chalk.gray;
                console.log(vColor(`  [${entry.verdict.toUpperCase()}] ${entry.rule.ruleId} ${entry.rule.summary}`));
                for (const vp of entry.violatingProposals) {
                    console.log(chalk.red(`    ✗ ${vp.id}: ${vp.reason}`));
                }
                for (const cp of entry.compliantProposals) {
                    console.log(chalk.green(`    ✓ ${cp}`));
                }
            }
        });

    const dreamStableAnchorCommand = dreamCommand
        .command('stable-anchor')
        .description('Declare and inspect mature/stable architecture anchors that should be exempt from split pressure');

    dreamStableAnchorCommand
        .command('add')
        .description('Register a mature/stable architecture anchor directly in config.json')
        .option('--node <id>', 'Stable anchor node id')
        .option('--source-path <path>', 'Stable anchor source path')
        .option('--json', 'Emit machine-readable result JSON')
        .action((options: { node?: string; sourcePath?: string; json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const nodeId = String(options.node ?? '').trim();
            const sourcePath = String(options.sourcePath ?? '').trim();
            if (!nodeId && !sourcePath) {
                console.log(chalk.red('dream stable-anchor add requires --node and/or --source-path'));
                process.exitCode = 1;
                return;
            }

            const topologyRisk = registerMatureStableArchitectureAnchor(paths, {
                nodeId: nodeId || undefined,
                sourcePath: sourcePath || undefined
            });

            if (options.json) {
                console.log(
                    JSON.stringify(
                        {
                            configFile: paths.configFile,
                            registeredAnchor: {
                                nodeId: nodeId || undefined,
                                sourcePath: sourcePath || undefined
                            },
                            topologyRisk
                        },
                        null,
                        2
                    )
                );
                return;
            }

            console.log(chalk.green(`[TriadMind] stable architecture anchor registered: ${nodeId || sourcePath}`));
            console.log(chalk.green(`[TriadMind] config updated: ${paths.configFile}`));
        });

    dreamStableAnchorCommand
        .command('review')
        .description('Review effective mature/stable anchors merged from config and feedback memory')
        .option('--json', 'Emit machine-readable result JSON')
        .action((options: { json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const config = loadTriadConfig(paths);
            const result = resolveEffectiveStableAnchors(paths, config.topologyRisk);

            if (options.json) {
                console.log(
                    JSON.stringify(
                        {
                            loadStatus: result.loadStatus,
                            stableAnchors: result.stableAnchors
                        },
                        null,
                        2
                    )
                );
                return;
            }

            console.log(`TriadMind Stable Architecture Anchors`);
            console.log(`loadStatus=${result.loadStatus}`);
            console.log(`nodeIds=${result.stableAnchors.matureStableNodeIds.length}`);
            result.stableAnchors.matureStableNodeIds.forEach((entry) => console.log(`- node: ${entry}`));
            console.log(`sourcePaths=${result.stableAnchors.matureStableSourcePaths.length}`);
            result.stableAnchors.matureStableSourcePaths.forEach((entry) => console.log(`- path: ${entry}`));
            if (result.stableAnchors.entries.length > 0) {
                console.log(`entries=${result.stableAnchors.entries.length}`);
            }
        });

    dreamCommand
        .command('visualize')
        .description('Generate dream governance dashboard html from latest dream report')
        .option('--theme <leaf-like|runtime-dark>', 'Dream visualizer theme', 'leaf-like')
        .option('--open', 'Open generated html in browser')
        .option('--json', 'Emit machine-readable result')
        .action(async (options: { theme?: string; open?: boolean; json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const report = loadLatestDreamReport(paths);
            if (!report) {
                console.log(chalk.red(`No dream report found: ${paths.dreamReportFile}`));
                process.exitCode = 1;
                return;
            }

            generateDreamDashboard(report, paths.dreamVisualizerFile, {
                theme: options.theme === 'runtime-dark' ? 'runtime-dark' : 'leaf-like'
            });

            if (options.open) {
                try {
                    await openFile(paths.dreamVisualizerFile);
                } catch (error: any) {
                    console.log(chalk.yellow(`Failed to open dream visualizer: ${error?.message ?? String(error)}`));
                }
            }

            if (options.json) {
                console.log(
                    JSON.stringify(
                        {
                            dreamReportFile: paths.dreamReportFile,
                            dreamVisualizerFile: paths.dreamVisualizerFile
                        },
                        null,
                        2
                    )
                );
                return;
            }

            console.log(chalk.green(`Dream visualizer written: ${paths.dreamVisualizerFile}`));
        });

    const dreamDaemonCommand = dreamCommand
        .command('daemon')
        .description('Dream daemon lifecycle: background idle run loop');

    dreamDaemonCommand
        .command('start')
        .description('Start dream daemon in background')
        .option('--interval-seconds <n>', 'Daemon loop interval in seconds')
        .option('--max-ticks <n>', 'Max daemon ticks before auto-exit (0 = infinite)')
        .option('--json', 'Emit machine-readable daemon start result')
        .action((options: { intervalSeconds?: string; maxTicks?: string; json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const result = startDreamDaemon(paths, {
                intervalSeconds: parseOptionalPositiveCliInteger(options.intervalSeconds),
                maxTicks: parseOptionalNonNegativeCliInteger(options.maxTicks)
            });

            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
                return;
            }

            const color =
                result.status === 'started'
                    ? chalk.green
                    : result.status === 'already_running'
                      ? chalk.yellow
                      : chalk.red;
            console.log(color(`[TriadMind] ${result.message}`));
        });

    dreamDaemonCommand
        .command('stop')
        .description('Stop dream daemon')
        .option('--json', 'Emit machine-readable daemon stop result')
        .action((options: { json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const result = stopDreamDaemon(paths);
            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
                return;
            }

            const color =
                result.status === 'stopped'
                    ? chalk.green
                    : result.status === 'not_running'
                      ? chalk.gray
                      : chalk.red;
            console.log(color(`[TriadMind] ${result.message}`));
        });

    dreamDaemonCommand
        .command('status')
        .description('Show dream daemon status')
        .option('--json', 'Emit machine-readable daemon status')
        .action((options: { json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const status = getDreamDaemonStatus(paths);
            if (options.json) {
                console.log(
                    JSON.stringify(
                        {
                            running: status.running,
                            pid: status.pid,
                            state: status.state
                        },
                        null,
                        2
                    )
                );
                return;
            }

            const color = status.running ? chalk.green : chalk.gray;
            console.log(
                color(
                    `[TriadMind] dream daemon running=${status.running} pid=${status.pid ?? '-'} ticks=${status.state.ticks} last=${status.state.lastStatus ?? '-'}`
                )
            );
        });

    dreamCommand
        .command('daemon-loop')
        .description('Internal dream daemon loop command (do not invoke directly)')
        .option('--interval-seconds <n>', 'Daemon loop interval in seconds', '180')
        .option('--max-ticks <n>', 'Max daemon ticks before auto-exit (0=infinite)', '0')
        .action(async (options: { intervalSeconds?: string; maxTicks?: string }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            await runDreamDaemonLoop(paths, {
                intervalSeconds: normalizePositiveCliInteger(options.intervalSeconds, 180),
                maxTicks: parseOptionalNonNegativeCliInteger(options.maxTicks) ?? 0
            });
        });
}
