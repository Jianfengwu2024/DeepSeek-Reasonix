import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getWorkspacePaths } from '../workspace';
import {
    loadDreamRuleLedger,
    addDreamRule,
    formatActiveRulesPrompt,
    getActiveRules,
    deactivateDreamRule,
    expireStaleRules,
    getDreamRuleFilePath,
    saveDreamRuleLedger,
    jaccardSimilarity,
    findConflictingRules,
    deduplicateRules,
    checkForDuplicateBeforeAdd,
    type DreamRuleLedger,
    type DreamRuleEntry
} from '../dreamRuleLedger';
import { formatDreamFeedbackRules, loadDreamFeedbackLedger, recordDreamProposalRejection, type DreamFeedbackLedger } from '../dreamFeedbackSupport';
import { validateFeedback } from '../dreamFeedbackValidator';
import { detectC2cCoupling } from '../analyzer';
import type { DreamProposal } from '../dream';

// ─── Helpers ────────────────────────────────────────────────────

function createFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-rule-ledger-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });

    // Minimal config so `getWorkspacePaths` works
    fs.writeFileSync(path.join(triadDir, 'config.json'), JSON.stringify({
        schemaVersion: '1.0',
        architecture: { language: 'typescript', parserEngine: 'native', adapter: 'typescript' },
        categories: { backend: ['src/**'] },
        parser: { excludePatterns: [], excludePathPatterns: [], scanCategories: ['backend'], scanMode: 'leaf', leafOutputFile: 'leaf-map.json', capabilityOutputFile: 'capability-map.json', capabilityThreshold: 1 },
        navigator: { provider: 'openai', model: 'gpt-4o', apiKeyEnv: 'OPENAI_API_KEY' },
        dream: { enabled: false, idleOnly: false, minHoursBetweenRuns: 24, minConfidence: 0, maxProposals: 10 },
        protocol: { minConfidence: 0.5, requireConfidence: false }
    }, null, 2), 'utf-8');

    // Empty triad-map so workspace paths resolve
    fs.writeFileSync(path.join(triadDir, 'triad-map.json'), '[]', 'utf-8');

    const paths = getWorkspacePaths(root);
    return { root, triadDir, paths };
}

function createMockProposal(overrides?: Partial<DreamProposal>): DreamProposal {
    return {
        id: 'DREAM_TEST_001',
        title: 'Refactor payment processing',
        priority: 'high',
        confidence: 0.85,
        objective: 'Split monolithic PaymentGateway into strategy-pattern variants',
        expectedOutcome: 'Reduced execute-like ratio, better testability',
        actions: ['Extract IPaymentStrategy interface', 'Move PaymentGateway.execute to PaymentStrategy variants'],
        linkedFindings: ['FINDING_EXECUTE_RATIO_HIGH'],
        evidence: [],
        ...overrides
    };
}

// ─── Rule Ledger Tests ─────────────────────────────────────────

test('dreamRuleLedger: add and load rules', () => {
    const { paths } = createFixture();

    const added = addDreamRule(paths, {
        summary: 'Payment modules must depend on IPaymentStrategy, never on ConcretePaymentGateway.',
        constraintType: 'forbid',
        targetPattern: 'src/payment/**',
        confidence: 0.9,
        sourceProposalId: 'DREAM_SPLIT_HIGH_FANOUT_PAYMENT',
        sourceProposalTitle: 'Refactor payment processing',
        sourceRejectionId: 'reject_123'
    });

    assert.ok(added.rule.ruleId.startsWith('RULE_'), `ruleId should start with RULE_: ${added.rule.ruleId}`);
    assert.equal(added.rule.summary, 'Payment modules must depend on IPaymentStrategy, never on ConcretePaymentGateway.');
    assert.equal(added.rule.constraintType, 'forbid');
    assert.equal(added.rule.active, true);
    assert.ok(added.rule.createdAt);
    assert.equal(added.rule.sourceProposalId, 'DREAM_SPLIT_HIGH_FANOUT_PAYMENT');
    assert.equal(added.rule.ttlDays, undefined);

    // Load back
    const loaded = loadDreamRuleLedger(paths);
    assert.equal(loaded.status, 'ok');
    assert.equal(loaded.ledger.rules.length, 1);
    assert.equal(loaded.ledger.rules[0].ruleId, added.rule.ruleId);
});

test('dreamRuleLedger: add with TTL', () => {
    const { paths } = createFixture();

    addDreamRule(paths, {
        summary: 'Temporary constraint: use legacy API adapter for Q2 migration.',
        constraintType: 'require',
        targetPattern: 'src/legacy/**',
        confidence: 0.7,
        sourceProposalId: 'DREAM_TEMP_001',
        sourceProposalTitle: 'Legacy migration adapter',
        sourceRejectionId: 'reject_temp',
        ttlDays: 30
    });

    const loaded = loadDreamRuleLedger(paths);
    assert.equal(loaded.ledger.rules.length, 1);
    assert.equal(loaded.ledger.rules[0].ttlDays, 30);
    assert.equal(loaded.ledger.rules[0].constraintType, 'require');
});

test('dreamRuleLedger: formatActiveRulesPrompt', () => {
    const { paths } = createFixture();

    const { rule } = addDreamRule(paths, {
        summary: 'Payment modules must depend on IPaymentStrategy.',
        constraintType: 'forbid',
        targetPattern: 'src/payment/**',
        confidence: 0.9,
        sourceProposalId: 'DREAM_TEST',
        sourceProposalTitle: 'Test proposal',
        sourceRejectionId: 'reject_test'
    });

    const loaded = loadDreamRuleLedger(paths);
    const prompt = formatActiveRulesPrompt(loaded.ledger);

    assert.ok(prompt.includes('CRITICAL_CONSTRAINTS_FROM_PAST_MISTAKES:'));
    assert.ok(prompt.includes('FORBID'));
    assert.ok(prompt.includes('Payment modules must depend on IPaymentStrategy.'));
    assert.ok(prompt.includes('Test proposal'));
});

test('dreamRuleLedger: getActiveRules excludes inactive', () => {
    const { paths } = createFixture();

    addDreamRule(paths, {
        summary: 'Rule one',
        constraintType: 'forbid',
        targetPattern: 'src/a/**',
        confidence: 0.5,
        sourceProposalId: 'P1',
        sourceProposalTitle: 'Proposal one',
        sourceRejectionId: 'r1'
    });

    addDreamRule(paths, {
        summary: 'Rule two',
        constraintType: 'require',
        targetPattern: 'src/b/**',
        confidence: 0.5,
        sourceProposalId: 'P2',
        sourceProposalTitle: 'Proposal two',
        sourceRejectionId: 'r2'
    });

    let loaded = loadDreamRuleLedger(paths);
    assert.equal(getActiveRules(loaded.ledger).length, 2);

    // Deactivate rule two
    const ruleIds = loaded.ledger.rules.map((r) => r.ruleId);
    deactivateDreamRule(paths, ruleIds[1]);

    loaded = loadDreamRuleLedger(paths);
    assert.equal(getActiveRules(loaded.ledger).length, 1);
    assert.equal(getActiveRules(loaded.ledger)[0].summary, 'Rule one');
});

test('dreamRuleLedger: expireStaleRules deactivates expired TTL rules', () => {
    const { paths } = createFixture();

    addDreamRule(paths, {
        summary: 'Permanent rule (no TTL)',
        constraintType: 'forbid',
        targetPattern: 'src/permanent/**',
        confidence: 0.5,
        sourceProposalId: 'P1',
        sourceProposalTitle: 'Permanent',
        sourceRejectionId: 'r1'
    });

    // Manually insert a rule with TTL that is already expired
    const now = new Date();
    const expiredDate = new Date(now.getTime() - 2 * 86_400_000).toISOString(); // 2 days ago

    const loaded = loadDreamRuleLedger(paths);
    const expiredRule = {
        ruleId: 'RULE_EXPIRED',
        proposalId: 'P2',
        decisionId: 'r2',
        summary: 'Expired rule',
        constraintType: 'forbid' as const,
        targetPattern: 'src/expired/**',
        confidence: 0.5,
        sourceProposalId: 'P2',
        sourceProposalTitle: 'Expired',
        sourceRejectionId: 'r2',
        createdAt: expiredDate,
        updatedAt: expiredDate,
        active: true,
        ttlDays: 1 // expired after 1 day, and it's been 2
    };

    const ledger: DreamRuleLedger = {
        schemaVersion: '1.0',
        project: loaded.ledger.project,
        updatedAt: now.toISOString(),
        rules: [...loaded.ledger.rules, expiredRule]
    };

    // Write manually
    saveDreamRuleLedger(paths, ledger);

    // Before expiration check
    let reloaded = loadDreamRuleLedger(paths);
    // getActiveRules should already filter out the TTL-expired rule
    assert.equal(getActiveRules(reloaded.ledger).length, 1);

    // Run expiration — expireStaleRules sets active=false so even without TTL check it's gone
    const expired = expireStaleRules(paths);
    assert.equal(expired, 1);

    // After expiration
    reloaded = loadDreamRuleLedger(paths);
    assert.equal(getActiveRules(reloaded.ledger).length, 1);
    assert.equal(getActiveRules(reloaded.ledger)[0].summary, 'Permanent rule (no TTL)');
});

test('dreamRuleLedger: load returns empty ledger when file missing', () => {
    const { paths } = createFixture();
    const loaded = loadDreamRuleLedger(paths);
    assert.equal(loaded.status, 'not_found');
    assert.deepEqual(loaded.ledger.rules, []);
    assert.equal(loaded.ledger.schemaVersion, '1.0');
});

// ─── formatDreamFeedbackRules with additional rules ───────────

test('formatDreamFeedbackRules: merges rejection rules and additional formatted rules', () => {
    const rejectionLedger: DreamFeedbackLedger = {
        schemaVersion: '1.0',
        project: 'test',
        rejections: [
            {
                decisionId: 'd1',
                decision: 'reject',
                proposalId: 'P1',
                proposalFamily: 'DREAM_TEST',
                proposalSignature: JSON.stringify({ family: 'DREAM_TEST', sourcePath: '' }),
                proposalTitle: 'Proposal one',
                reason: 'This violates our architecture',
                extractedRule: 'Do not couple services directly.',
                reviewer: 'developer',
                reviewerRole: 'maintainer',
                recordedAt: new Date().toISOString(),
                targetNodeIds: [],
                linkedFindings: []
            }
        ]
    };

    const additionalRules = 'CRITICAL_CONSTRAINTS_FROM_PAST_MISTAKES:\n- [REQUIRE] Use IPaymentStrategy for all payment operations.';

    const result = formatDreamFeedbackRules(rejectionLedger, additionalRules);

    assert.ok(result.includes('Do not couple services directly.'));
    assert.ok(result.includes('Use IPaymentStrategy for all payment operations.'));
});

test('formatDreamFeedbackRules: only additional rules when rejection ledger is empty', () => {
    const rejectionLedger: DreamFeedbackLedger = {
        schemaVersion: '1.0',
        project: 'test',
        rejections: []
    };

    const additionalRules = 'CRITICAL_CONSTRAINTS_FROM_PAST_MISTAKES:\n- [REQUIRE] Use IPaymentStrategy for all payment operations.';

    const result = formatDreamFeedbackRules(rejectionLedger, additionalRules);
    assert.ok(result.includes('Use IPaymentStrategy for all payment operations.'));
});

test('formatDreamFeedbackRules: empty when neither source has rules', () => {
    const rejectionLedger: DreamFeedbackLedger = {
        schemaVersion: '1.0',
        project: 'test',
        rejections: []
    };

    assert.equal(formatDreamFeedbackRules(rejectionLedger, ''), '');
    assert.equal(formatDreamFeedbackRules(rejectionLedger), '');
});

// ─── ParseExtractedRule tests (via fallback behavior) ────────

test('extractRuleFromRejection returns fallback when LLM not configured', async () => {
    const { paths } = createFixture();
    const { extractRuleFromRejection } = await import('../dreamRuleExtractor');
    const proposal = createMockProposal({ sourcePath: 'src/payment/PaymentGateway.ts' });

    const result = await extractRuleFromRejection(paths, {
        proposal,
        rejection: {
            decisionId: 'reject_001',
            decision: 'reject',
            proposalId: 'DREAM_TEST_001',
            proposalFamily: 'DREAM_TEST',
            proposalSignature: 'sig',
            proposalTitle: 'Refactor payment processing',
            reason: 'PaymentGateway is a stable core module; do not modify its internal structure.',
            reviewer: 'architect',
            reviewerRole: 'maintainer',
            recordedAt: new Date().toISOString(),
            targetNodeIds: ['PaymentGateway'],
            linkedFindings: ['FINDING_EXECUTE_RATIO_HIGH']
        }
    });

    assert.equal(result.extracted, false);
    assert.ok(result.error, 'should have an error message about LLM not configured');
    assert.ok(result.rule.summary.includes('stable core module'), 'fallback should contain the rejection reason');
    assert.equal(result.rule.constraintType, 'forbid'); // not marked as stable anchor → forbid
});

// ─── Similarity & Conflict Detection Tests ─────────────────────

test('jaccardSimilarity: identical texts', () => {
    assert.equal(jaccardSimilarity('hello world', 'hello world'), 1.0);
});

test('jaccardSimilarity: no overlap', () => {
    assert.equal(jaccardSimilarity('aaa bbb ccc', 'xxx yyy zzz'), 0);
});

test('jaccardSimilarity: partial overlap', () => {
    const sim = jaccardSimilarity('Payment modules must use interface', 'Use IPaymentStrategy interface for payment');
    assert.ok(sim > 0.3 && sim < 0.9, `expected moderate similarity, got ${sim}`);
});

test('jaccardSimilarity: CJK text', () => {
    assert.equal(jaccardSimilarity('支付模块必须使用接口', '支付模块必须使用接口'), 1.0);
    // "支付模块" are 4 shared CJK chars; "必须使用接口" vs "不应该直接依赖" differ
    assert.ok(jaccardSimilarity('支付模块必须使用接口', '支付模块不应该直接依赖') > 0.2);
});

test('jaccardSimilarity: empty strings', () => {
    assert.equal(jaccardSimilarity('', ''), 1.0);
    assert.equal(jaccardSimilarity('', 'hello'), 0);
});

test('findConflictingRules: direct contradiction', () => {
    const ledger: DreamRuleLedger = {
        schemaVersion: '1.0',
        project: 'test',
        updatedAt: new Date().toISOString(),
        rules: [
            makeRule('RULE_A', 'Payment modules must depend on IPaymentStrategy.', 'require', 'src/payment/**'),
            makeRule('RULE_B', 'Payment modules must NOT use IPaymentStrategy.', 'forbid', 'src/payment/**')
        ]
    };

    const report = findConflictingRules(ledger);
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.conflicts[0].type, 'direct_contradiction');
    assert.ok(report.conflicts[0].detail.includes('contradictory'));
});

test('findConflictingRules: near duplicate', () => {
    const ledger: DreamRuleLedger = {
        schemaVersion: '1.0',
        project: 'test',
        updatedAt: new Date().toISOString(),
        rules: [
            makeRule('RULE_A', 'Payment modules must depend on IPaymentStrategy interface.', 'require', 'src/payment/**'),
            makeRule('RULE_B', 'Payment modules should depend on IPaymentStrategy interface.', 'require', 'src/payment/**')
        ]
    };

    const report = findConflictingRules(ledger);
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.conflicts[0].type, 'near_duplicate');
});

test('findConflictingRules: overlapping scope', () => {
    const ledger: DreamRuleLedger = {
        schemaVersion: '1.0',
        project: 'test',
        updatedAt: new Date().toISOString(),
        rules: [
            makeRule('RULE_A', 'All payment operations must depend on IPaymentStrategy interface.', 'require', 'src/payment/**', 'backend'),
            makeRule('RULE_B', 'Payment gateway should depend on IPaymentStrategy interface.', 'require', 'src/payment/gateway.ts', 'backend')
        ]
    };

    const report = findConflictingRules(ledger);
    // Should detect at least overlapping scope
    assert.ok(report.conflicts.length > 0);
});

test('findConflictingRules: no conflicts with distinct rules', () => {
    const ledger: DreamRuleLedger = {
        schemaVersion: '1.0',
        project: 'test',
        updatedAt: new Date().toISOString(),
        rules: [
            makeRule('RULE_A', 'Payment modules must depend on IPaymentStrategy.', 'require', 'src/payment/**'),
            makeRule('RULE_B', 'Logging should use structured logger.', 'require', 'src/logging/**')
        ]
    };

    const report = findConflictingRules(ledger);
    assert.equal(report.conflicts.length, 0);
});

test('findConflictingRules: with newRule param checks pre-add', () => {
    const ledger: DreamRuleLedger = {
        schemaVersion: '1.0',
        project: 'test',
        updatedAt: new Date().toISOString(),
        rules: [
            makeRule('RULE_A', 'Payment modules must depend on IPaymentStrategy interface.', 'require', 'src/payment/**')
        ]
    };

    const newRule = makeRule('RULE_NEW', 'Payment modules should depend on IPaymentStrategy interface.', 'require', 'src/payment/**');

    const report = findConflictingRules(ledger, newRule);
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.conflicts[0].type, 'near_duplicate');
});

test('deduplicateRules: merges near-duplicate rules', () => {
    const { root, triadDir, paths } = createFixture();

    // Add two near-duplicate rules
    addDreamRule(paths, {
        summary: 'Payment modules must depend on IPaymentStrategy interface for all operations.',
        constraintType: 'require',
        targetPattern: 'src/payment/**',
        confidence: 0.9,
        sourceProposalId: 'P1',
        sourceProposalTitle: 'Proposal one',
        sourceRejectionId: 'r1'
    });

    addDreamRule(paths, {
        summary: 'Payment modules should depend on IPaymentStrategy interface for all operations.',
        constraintType: 'require',
        targetPattern: 'src/payment/**',
        confidence: 0.7,
        sourceProposalId: 'P2',
        sourceProposalTitle: 'Proposal two',
        sourceRejectionId: 'r2'
    });

    const dedupResult = deduplicateRules(paths);
    assert.equal(dedupResult.removedCount, 1);
    assert.equal(dedupResult.mergedPairs.length, 1);
    assert.ok(dedupResult.mergedPairs[0].survivor.confidence >= 0.9);

    // Verify the survivor is still active
    const ledger = loadDreamRuleLedger(paths);
    const active = getActiveRules(ledger.ledger);
    assert.equal(active.length, 1);
    assert.equal(active[0].summary, 'Payment modules must depend on IPaymentStrategy interface for all operations.');
});

test('deduplicateRules: no-op when no duplicates', () => {
    const { paths } = createFixture();
    addDreamRule(paths, {
        summary: 'Payment must use interface.',
        constraintType: 'require',
        targetPattern: 'src/payment/**',
        confidence: 0.8,
        sourceProposalId: 'P1',
        sourceProposalTitle: 'One',
        sourceRejectionId: 'r1'
    });

    const result = deduplicateRules(paths);
    assert.equal(result.removedCount, 0);
});

test('checkForDuplicateBeforeAdd: detects exact duplicate', () => {
    const { paths } = createFixture();
    addDreamRule(paths, {
        summary: 'Payment modules must use IPaymentStrategy.',
        constraintType: 'require',
        targetPattern: 'src/payment/**',
        confidence: 0.8,
        sourceProposalId: 'P1',
        sourceProposalTitle: 'One',
        sourceRejectionId: 'r1'
    });

    const check = checkForDuplicateBeforeAdd(paths, {
        summary: 'Payment modules must use IPaymentStrategy.',
        constraintType: 'require',
        targetPattern: 'src/payment/**',
        confidence: 0.9,
        sourceProposalId: 'P2',
        sourceProposalTitle: 'Two',
        sourceRejectionId: 'r2'
    });

    assert.equal(check.isExactDuplicate, true);
});

test('checkForDuplicateBeforeAdd: warns on near-duplicate', () => {
    const { paths } = createFixture();
    addDreamRule(paths, {
        summary: 'Payment modules must use IPaymentStrategy interface.',
        constraintType: 'require',
        targetPattern: 'src/payment/**',
        confidence: 0.8,
        sourceProposalId: 'P1',
        sourceProposalTitle: 'One',
        sourceRejectionId: 'r1'
    });

    const check = checkForDuplicateBeforeAdd(paths, {
        summary: 'Payment modules should use IPaymentStrategy interface.',
        constraintType: 'require',
        targetPattern: 'src/payment/**',
        confidence: 0.9,
        sourceProposalId: 'P2',
        sourceProposalTitle: 'Two',
        sourceRejectionId: 'r2'
    });

    assert.equal(check.isExactDuplicate, false);
    assert.ok(check.warnings.length > 0, 'should have conflict warnings for near-duplicate');
    assert.ok(check.warnings[0].includes('Conflict'), 'warning should mention conflict');
});

// ─── Helper: build a minimal DreamRuleEntry for tests ────────────

function makeRule(
    ruleId: string,
    summary: string,
    constraintType: 'forbid' | 'require' | 'exempt',
    targetPattern: string,
    category?: string
): DreamRuleEntry {
    return {
        ruleId,
        proposalId: ruleId,
        decisionId: ruleId,
        summary,
        constraintType,
        targetPattern,
        category,
        confidence: 0.8,
        sourceProposalId: ruleId,
        sourceProposalTitle: `Proposal ${ruleId}`,
        sourceRejectionId: `${ruleId}_rej`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true
    };
}

// ─── C2C Coupling Detection Tests ─────────────────────────────

test('detectC2cCoupling: flags sources with many concrete classes and no interfaces', () => {
    const map = [
        {
            nodeId: 'PaymentService.process',
            sourcePath: 'src/payment/PaymentService.ts',
            category: 'backend',
            fission: {
                evidence: {
                    abstraction: {
                        concreteClassCount: 5,
                        interfaceCount: 0,
                        concreteSignalCount: 10,
                        abstractionSignalCount: 0
                    }
                }
            }
        }
    ];

    const findings = detectC2cCoupling(map, { minConcreteClasses: 2 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].sourcePath, 'src/payment/PaymentService.ts');
    assert.equal(findings[0].concretePerInterface, -1); // Infinity → -1
    assert.ok(findings[0].confidence >= 0.5);
    assert.ok(findings[0].detail.includes('zero interfaces'));
});

test('detectC2cCoupling: does not flag sources with balanced interfaces', () => {
    const map = [
        {
            nodeId: 'PaymentStrategy',
            sourcePath: 'src/payment/strategies.ts',
            category: 'backend',
            fission: {
                evidence: {
                    abstraction: {
                        concreteClassCount: 3,
                        interfaceCount: 2,
                        concreteSignalCount: 5,
                        abstractionSignalCount: 8
                    }
                }
            }
        }
    ];

    const findings = detectC2cCoupling(map, { minConcreteClasses: 2, maxConcretePerInterface: 5 });
    // 3/2 = 1.5 which is ≤ 5, so no flag
    assert.equal(findings.length, 0);
});

// ─── validateFeedback Tests ──────────────────────────────────

test('validateFeedback: returns compliant when no rules exist', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-val-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });
    fs.writeFileSync(path.join(triadDir, 'config.json'), JSON.stringify({
        schemaVersion: '1.0',
        architecture: { language: 'typescript', parserEngine: 'native', adapter: 'typescript' },
        categories: { backend: ['src/**'] },
        parser: { excludePatterns: [], excludePathPatterns: [], scanCategories: ['backend'], scanMode: 'leaf', leafOutputFile: 'leaf-map.json', capabilityOutputFile: 'capability-map.json', capabilityThreshold: 1 },
        navigator: { provider: 'openai', model: 'gpt-4o', apiKeyEnv: 'OPENAI_API_KEY' },
        dream: { enabled: false, idleOnly: false, minHoursBetweenRuns: 24, minConfidence: 0, maxProposals: 10 },
        protocol: { minConfidence: 0.5, requireConfidence: false }
    }, null, 2), 'utf-8');
    fs.writeFileSync(path.join(triadDir, 'triad-map.json'), '[]', 'utf-8');
    const paths = getWorkspacePaths(root);

    const report = validateFeedback(paths);
    assert.equal(report.summary.totalRules, 0);
    assert.equal(report.summary.overallScore, 1.0);
});
