"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDreamCommands = registerDreamCommands;
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("./config");
const dream_1 = require("./dream");
const dreamDaemon_1 = require("./dreamDaemon");
const dreamFeedbackSupport_1 = require("./dreamFeedbackSupport");
const dreamScheduler_1 = require("./dreamScheduler");
const dreamVisualizer_1 = require("./dreamVisualizer");
const stableArchitectureAnchorSupport_1 = require("./stableArchitectureAnchorSupport");
const dreamFeedbackValidator_1 = require("./dreamFeedbackValidator");
const dreamRuleLedger_1 = require("./dreamRuleLedger");
const dreamRuleExtractor_1 = require("./dreamRuleExtractor");
const cliSupport_1 = require("./cliSupport");
const cliPresentationSupport_1 = require("./cliPresentationSupport");
const cliWorkflowSupport_1 = require("./cliWorkflowSupport");
const workflow_1 = require("./workflow");
function registerDreamCommands(program) {
    const dreamCommand = program
        .command('dream')
        .description('Run idle-style architecture dreaming and governance proposal generation')
        .addHelpText('after', '\nDefault behavior: `triadmind dream` is equivalent to `triadmind dream run`.\nYou can pass run flags directly, e.g. `triadmind dream --json`.');
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
        .action(async (options) => {
        await (0, cliWorkflowSupport_1.executeDreamRun)(options);
    });
    dreamCommand
        .command('fast')
        .description('Fast Dream scan for advisory/strict impact chains only (alias: dream run --impact-threshold 3)')
        .option('--json', 'Emit machine-readable dream report JSON')
        .action(async (options) => {
        await (0, cliWorkflowSupport_1.executeDreamRun)({
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
        .action(async (options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const result = await (0, dreamScheduler_1.tickDreamAutoRun)(paths, {
            trigger: String(options.trigger ?? 'manual'),
            force: Boolean(options.force),
            impactThreshold: (0, cliPresentationSupport_1.normalizePositiveCliInteger)(options.impactThreshold, 0) || undefined
        });
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        const color = result.status === 'run' ? chalk_1.default.green : result.status === 'error' ? chalk_1.default.red : chalk_1.default.gray;
        console.log(color(`[TriadMind] dream auto ${result.status}: trigger=${result.trigger}, reason=${result.reason}, pending=${result.pendingEvents}, lock=${result.lock}`));
        if (result.error) {
            console.log(chalk_1.default.yellow(`[TriadMind] dream auto error: ${result.error}`));
        }
    });
    dreamCommand
        .command('review')
        .description('Read the latest dream report from workspace artifacts')
        .option('--json', 'Emit machine-readable dream report JSON')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const report = (0, dream_1.loadLatestDreamReport)(paths);
        if (!report) {
            console.log(chalk_1.default.red(`No dream report found: ${paths.dreamReportFile}`));
            process.exitCode = 1;
            return;
        }
        if (options.json) {
            console.log(JSON.stringify(report, null, 2));
            return;
        }
        console.log((0, dream_1.formatDreamReport)(report));
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
        .action(async (options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const report = (0, dream_1.loadLatestDreamReport)(paths);
        if (!report) {
            console.log(chalk_1.default.red(`No dream report found: ${paths.dreamReportFile}`));
            process.exitCode = 1;
            return;
        }
        const reviewerRole = (0, dreamFeedbackSupport_1.normalizeDreamFeedbackReviewerRole)(options.reviewerRole) ?? undefined;
        if (!reviewerRole) {
            console.log(chalk_1.default.red(`Invalid reviewer role: ${options.reviewerRole}`));
            process.exitCode = 1;
            return;
        }
        const proposalId = String(options.proposal ?? '').trim();
        const proposal = report.proposals.find((item) => item.id === proposalId);
        if (!proposal) {
            console.log(chalk_1.default.red(`Dream proposal not found in latest report: ${proposalId}`));
            process.exitCode = 1;
            return;
        }
        const shouldMarkStableAnchor = Boolean(options.markStableAnchor) || String(options.reasonCode ?? '').trim() === 'stable_core_module';
        const stableAnchor = shouldMarkStableAnchor ? (0, dreamFeedbackSupport_1.deriveStableArchitectureAnchorFromProposal)(proposal) : undefined;
        let registeredStableAnchor;
        if (shouldMarkStableAnchor && stableAnchor) {
            (0, config_1.registerMatureStableArchitectureAnchor)(paths, stableAnchor);
            registeredStableAnchor = stableAnchor;
        }
        const result = (0, dreamFeedbackSupport_1.recordDreamProposalRejection)(paths, {
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
        let extraction;
        try {
            extraction = await (0, dreamRuleExtractor_1.extractRuleFromRejection)(paths, {
                proposal,
                rejection: result.record
            });
        }
        catch (extractError) {
            // Extraction is best-effort; don't fail the rejection flow
        }
        let savedRuleId;
        if (extraction?.extracted && extraction.rule.summary) {
            try {
                const addResult = (0, dreamRuleLedger_1.addDreamRule)(paths, {
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
                    const dupCheck = (0, dreamRuleLedger_1.checkForDuplicateBeforeAdd)(paths, {
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
                        console.log(chalk_1.default.yellow(`[TriadMind] warning: exact duplicate rule already exists — ${addResult.rule.ruleId} may be redundant.`));
                    }
                    else if (dupCheck.warnings.length > 0) {
                        for (const w of dupCheck.warnings) {
                            console.log(chalk_1.default.yellow(`[TriadMind] conflict warning: ${w}`));
                        }
                    }
                }
                catch {
                    // Best-effort
                }
            }
            catch (ruleError) {
                // Rule persistence is best-effort too
            }
        }
        if (options.json) {
            console.log(JSON.stringify({
                dreamFeedbackFile: paths.dreamFeedbackFile,
                dreamRuleFile: (0, dreamRuleLedger_1.getDreamRuleFilePath)(paths),
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
            }, null, 2));
            return;
        }
        console.log(chalk_1.default.green(`[TriadMind] Dream rejection recorded: ${proposal.id}`));
        console.log(chalk_1.default.green(`[TriadMind] feedback memory: ${paths.dreamFeedbackFile}`));
        console.log(chalk_1.default.gray(`[TriadMind] reason: ${result.record.reason}`));
        if (extraction) {
            if (extraction.extracted && savedRuleId) {
                console.log(chalk_1.default.cyan(`[TriadMind] architecture rule extracted (${savedRuleId}): ${extraction.rule.summary}`));
            }
            else if (extraction.error) {
                console.log(chalk_1.default.yellow(`[TriadMind] rule extraction note: ${extraction.error}`));
            }
        }
        if (registeredStableAnchor) {
            console.log(chalk_1.default.green(`[TriadMind] stable architecture anchor registered: ${registeredStableAnchor.nodeId ?? registeredStableAnchor.sourcePath}`));
        }
    });
    dreamFeedbackCommand
        .command('review')
        .description('Read the recorded dream proposal rejection memory')
        .option('--json', 'Emit machine-readable dream feedback JSON')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const feedback = (0, dreamFeedbackSupport_1.loadDreamFeedbackLedger)(paths);
        if (options.json) {
            console.log(JSON.stringify(feedback.ledger, null, 2));
            return;
        }
        if (feedback.status === 'parse_failed' || feedback.status === 'shape_invalid') {
            console.log(chalk_1.default.yellow(`[TriadMind] dream feedback memory was unreadable and has been ignored.`));
        }
        console.log((0, dreamFeedbackSupport_1.formatDreamFeedbackLedger)(feedback.ledger));
    });
    dreamFeedbackCommand
        .command('rules')
        .description('View and manage extracted architecture constraint rules from dream-rules.json')
        .option('--json', 'Emit machine-readable rule ledger JSON')
        .option('--deactivate <ruleId>', 'Deactivate a rule by ruleId')
        .option('--expire', 'Manually trigger TTL-based rule expiration')
        .option('--check-conflicts', 'Detect contradictions and near-duplicates among active rules')
        .option('--deduplicate', 'Auto-merge near-duplicate rules (keeps highest confidence)')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        if (options.expire) {
            const expiredCount = (0, dreamRuleLedger_1.expireStaleRules)(paths);
            console.log(expiredCount > 0
                ? chalk_1.default.green(`[TriadMind] expired ${expiredCount} stale rule(s)`)
                : chalk_1.default.gray('[TriadMind] no stale rules to expire'));
            if (options.json) {
                console.log(JSON.stringify({ expiredCount }, null, 2));
                return;
            }
        }
        if (options.deactivate) {
            const ok = (0, dreamRuleLedger_1.deactivateDreamRule)(paths, options.deactivate);
            console.log(ok
                ? chalk_1.default.green(`[TriadMind] rule deactivated: ${options.deactivate}`)
                : chalk_1.default.yellow(`[TriadMind] rule not found or already inactive: ${options.deactivate}`));
            if (options.json) {
                console.log(JSON.stringify({ deactivated: ok, ruleId: options.deactivate }, null, 2));
                return;
            }
        }
        // ── Deduplicate ────────────────────────────────────────────
        if (options.deduplicate) {
            const dedupResult = (0, dreamRuleLedger_1.deduplicateRules)(paths);
            if (dedupResult.removedCount > 0) {
                console.log(chalk_1.default.green(`[TriadMind] deduplicated ${dedupResult.removedCount} rule(s):`));
                for (const pair of dedupResult.mergedPairs) {
                    console.log(chalk_1.default.gray(`  - ${pair.reason}`));
                }
            }
            else {
                console.log(chalk_1.default.gray('[TriadMind] no near-duplicate rules found.'));
            }
            if (options.json) {
                console.log(JSON.stringify(dedupResult, null, 2));
                return;
            }
        }
        // ── Conflict check ──────────────────────────────────────────
        if (options.checkConflicts) {
            const loadResult0 = (0, dreamRuleLedger_1.loadDreamRuleLedger)(paths);
            const report = (0, dreamRuleLedger_1.findConflictingRules)(loadResult0.ledger);
            if (report.conflicts.length === 0) {
                console.log(chalk_1.default.green('[TriadMind] no conflicts detected among active rules.'));
            }
            else {
                console.log(chalk_1.default.yellow(`[TriadMind] ${report.conflicts.length} conflict(s) detected:`));
                for (const conflict of report.conflicts) {
                    const color = conflict.type === 'direct_contradiction' ? chalk_1.default.red : chalk_1.default.yellow;
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
        const loadResult = (0, dreamRuleLedger_1.loadDreamRuleLedger)(paths);
        if (options.json) {
            console.log(JSON.stringify(loadResult.ledger, null, 2));
            return;
        }
        const active = (0, dreamRuleLedger_1.getActiveRules)(loadResult.ledger);
        console.log(`TriadMind Architecture Rules (${active.length} active / ${loadResult.ledger.rules.length} total)`);
        console.log(`rule file: ${(0, dreamRuleLedger_1.getDreamRuleFilePath)(paths)}`);
        if (active.length === 0) {
            console.log(chalk_1.default.gray('- No active architecture constraint rules.'));
        }
        for (const rule of active) {
            const ttl = rule.ttlDays ? ` (TTL: ${rule.ttlDays}d)` : ' (permanent)';
            const scope = rule.targetPattern && rule.targetPattern !== '*' ? ` scope=${rule.targetPattern}` : '';
            console.log(`  ${chalk_1.default.cyan(rule.ruleId)} [${rule.constraintType.toUpperCase()}]${scope}${ttl}`);
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
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const report = (0, dreamFeedbackValidator_1.validateFeedback)(paths);
        if (options.json) {
            console.log(JSON.stringify(report, null, 2));
            return;
        }
        const score = report.summary.overallScore;
        const scoreColor = score >= 0.8 ? chalk_1.default.green : score >= 0.4 ? chalk_1.default.yellow : chalk_1.default.red;
        console.log(`TriadMind Feedback Validation Report`);
        console.log(`project=${report.project}`);
        console.log(`generatedAt=${report.generatedAt}`);
        console.log(``);
        console.log(`Summary:`);
        console.log(`  totalRules=${report.summary.totalRules}`);
        console.log(chalk_1.default.green(`  compliant=${report.summary.compliant}`));
        console.log(report.summary.violated > 0 ? chalk_1.default.red(`  violated=${report.summary.violated}`) : `  violated=${report.summary.violated}`);
        console.log(`  untested=${report.summary.untested}`);
        console.log(scoreColor(`  overallScore=${score.toFixed(3)}`));
        console.log(``);
        for (const entry of report.entries) {
            const vColor = entry.verdict === 'violated' ? chalk_1.default.red : entry.verdict === 'compliant' ? chalk_1.default.green : chalk_1.default.gray;
            console.log(vColor(`  [${entry.verdict.toUpperCase()}] ${entry.rule.ruleId} ${entry.rule.summary}`));
            for (const vp of entry.violatingProposals) {
                console.log(chalk_1.default.red(`    ✗ ${vp.id}: ${vp.reason}`));
            }
            for (const cp of entry.compliantProposals) {
                console.log(chalk_1.default.green(`    ✓ ${cp}`));
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
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const nodeId = String(options.node ?? '').trim();
        const sourcePath = String(options.sourcePath ?? '').trim();
        if (!nodeId && !sourcePath) {
            console.log(chalk_1.default.red('dream stable-anchor add requires --node and/or --source-path'));
            process.exitCode = 1;
            return;
        }
        const topologyRisk = (0, config_1.registerMatureStableArchitectureAnchor)(paths, {
            nodeId: nodeId || undefined,
            sourcePath: sourcePath || undefined
        });
        if (options.json) {
            console.log(JSON.stringify({
                configFile: paths.configFile,
                registeredAnchor: {
                    nodeId: nodeId || undefined,
                    sourcePath: sourcePath || undefined
                },
                topologyRisk
            }, null, 2));
            return;
        }
        console.log(chalk_1.default.green(`[TriadMind] stable architecture anchor registered: ${nodeId || sourcePath}`));
        console.log(chalk_1.default.green(`[TriadMind] config updated: ${paths.configFile}`));
    });
    dreamStableAnchorCommand
        .command('review')
        .description('Review effective mature/stable anchors merged from config and feedback memory')
        .option('--json', 'Emit machine-readable result JSON')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const config = (0, config_1.loadTriadConfig)(paths);
        const result = (0, stableArchitectureAnchorSupport_1.resolveEffectiveStableAnchors)(paths, config.topologyRisk);
        if (options.json) {
            console.log(JSON.stringify({
                loadStatus: result.loadStatus,
                stableAnchors: result.stableAnchors
            }, null, 2));
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
        .action(async (options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const report = (0, dream_1.loadLatestDreamReport)(paths);
        if (!report) {
            console.log(chalk_1.default.red(`No dream report found: ${paths.dreamReportFile}`));
            process.exitCode = 1;
            return;
        }
        (0, dreamVisualizer_1.generateDreamDashboard)(report, paths.dreamVisualizerFile, {
            theme: options.theme === 'runtime-dark' ? 'runtime-dark' : 'leaf-like'
        });
        if (options.open) {
            try {
                await (0, cliSupport_1.openFile)(paths.dreamVisualizerFile);
            }
            catch (error) {
                console.log(chalk_1.default.yellow(`Failed to open dream visualizer: ${error?.message ?? String(error)}`));
            }
        }
        if (options.json) {
            console.log(JSON.stringify({
                dreamReportFile: paths.dreamReportFile,
                dreamVisualizerFile: paths.dreamVisualizerFile
            }, null, 2));
            return;
        }
        console.log(chalk_1.default.green(`Dream visualizer written: ${paths.dreamVisualizerFile}`));
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
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const result = (0, dreamDaemon_1.startDreamDaemon)(paths, {
            intervalSeconds: (0, cliPresentationSupport_1.parseOptionalPositiveCliInteger)(options.intervalSeconds),
            maxTicks: (0, cliPresentationSupport_1.parseOptionalNonNegativeCliInteger)(options.maxTicks)
        });
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        const color = result.status === 'started'
            ? chalk_1.default.green
            : result.status === 'already_running'
                ? chalk_1.default.yellow
                : chalk_1.default.red;
        console.log(color(`[TriadMind] ${result.message}`));
    });
    dreamDaemonCommand
        .command('stop')
        .description('Stop dream daemon')
        .option('--json', 'Emit machine-readable daemon stop result')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const result = (0, dreamDaemon_1.stopDreamDaemon)(paths);
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        const color = result.status === 'stopped'
            ? chalk_1.default.green
            : result.status === 'not_running'
                ? chalk_1.default.gray
                : chalk_1.default.red;
        console.log(color(`[TriadMind] ${result.message}`));
    });
    dreamDaemonCommand
        .command('status')
        .description('Show dream daemon status')
        .option('--json', 'Emit machine-readable daemon status')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const status = (0, dreamDaemon_1.getDreamDaemonStatus)(paths);
        if (options.json) {
            console.log(JSON.stringify({
                running: status.running,
                pid: status.pid,
                state: status.state
            }, null, 2));
            return;
        }
        const color = status.running ? chalk_1.default.green : chalk_1.default.gray;
        console.log(color(`[TriadMind] dream daemon running=${status.running} pid=${status.pid ?? '-'} ticks=${status.state.ticks} last=${status.state.lastStatus ?? '-'}`));
    });
    dreamCommand
        .command('daemon-loop')
        .description('Internal dream daemon loop command (do not invoke directly)')
        .option('--interval-seconds <n>', 'Daemon loop interval in seconds', '180')
        .option('--max-ticks <n>', 'Max daemon ticks before auto-exit (0=infinite)', '0')
        .action(async (options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        await (0, dreamDaemon_1.runDreamDaemonLoop)(paths, {
            intervalSeconds: (0, cliPresentationSupport_1.normalizePositiveCliInteger)(options.intervalSeconds, 180),
            maxTicks: (0, cliPresentationSupport_1.parseOptionalNonNegativeCliInteger)(options.maxTicks) ?? 0
        });
    });
}
//# sourceMappingURL=dreamCommands.js.map