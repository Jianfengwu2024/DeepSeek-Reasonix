import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    buildAbstractionProtocolActionCandidates,
    recommendAbstractionMemory,
    searchAbstractionMemory,
    syncAbstractionMemory
} from '../abstractionMemory';
import { ensureTriadSpec, getWorkspacePaths } from '../workflow';

function createAbstractionMemoryFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-abstraction-memory-'));
    const paths = getWorkspacePaths(root);
    ensureTriadSpec(paths, true);

    fs.writeFileSync(
        paths.configFile,
        JSON.stringify(
            {
                abstractionMemory: {
                    excludeSourcePathPatterns: ['src/platform/']
                }
            },
            null,
            2
        ),
        'utf-8'
    );

    fs.writeFileSync(
        paths.mapFile,
        JSON.stringify(
            [
                {
                    nodeId: 'StripePay.execute',
                    category: 'backend',
                    sourcePath: 'src/payments/strategies.ts',
                    fission: {
                        problem: 'Run stripe payment',
                        demand: ['PayInput'],
                        answer: ['PayResult'],
                        evidence: {
                            abstraction: {
                                role: 'mixed',
                                signals: ['implements_contract', 'variant_member'],
                                implements: ['PaymentStrategy'],
                                abstractFunctions: ['PaymentStrategy.pay(input: PayInput): PayResult'],
                                functionContractCount: 1,
                                variantCluster: 'payment',
                                abstractionSignalCount: 2,
                                concreteSignalCount: 6,
                                interfaceCount: 1,
                                typeAliasCount: 0,
                                abstractClassCount: 0,
                                concreteClassCount: 2,
                                publicMethodCount: 2,
                                topLevelExecutableCount: 0
                            }
                        }
                    }
                },
                {
                    nodeId: 'PaypalPay.execute',
                    category: 'backend',
                    sourcePath: 'src/payments/strategies.ts',
                    fission: {
                        problem: 'Run paypal payment',
                        demand: ['PayInput'],
                        answer: ['PayResult'],
                        evidence: {
                            abstraction: {
                                role: 'mixed',
                                signals: ['implements_contract', 'extends_abstract', 'variant_member'],
                                implements: ['PaymentStrategy'],
                                extendsAbstract: ['BasePaymentProvider'],
                                abstractFunctions: [
                                    'PaymentStrategy.pay(input: PayInput): PayResult',
                                    'BasePaymentProvider.pay(input: PayInput): PayResult'
                                ],
                                functionContractCount: 2,
                                variantCluster: 'payment',
                                abstractionSignalCount: 2,
                                concreteSignalCount: 6,
                                interfaceCount: 1,
                                typeAliasCount: 0,
                                abstractClassCount: 1,
                                concreteClassCount: 2,
                                publicMethodCount: 2,
                                topLevelExecutableCount: 0
                            }
                        }
                    }
                },
                {
                    nodeId: 'PaymentRouter.route',
                    category: 'backend',
                    sourcePath: 'src/payments/router.ts',
                    fission: {
                        problem: 'Route to payment strategy',
                        demand: ['PaymentStrategy', 'PayInput'],
                        answer: ['PayResult'],
                        evidence: {
                            abstraction: {
                                role: 'mixed',
                                signals: ['depends_on_contract'],
                                dependsOnAbstractions: ['PaymentStrategy'],
                                abstractFunctions: ['PaymentStrategy.pay(input: PayInput): PayResult'],
                                functionContractCount: 1,
                                abstractionSignalCount: 1,
                                concreteSignalCount: 4,
                                interfaceCount: 0,
                                typeAliasCount: 0,
                                abstractClassCount: 0,
                                concreteClassCount: 1,
                                publicMethodCount: 1,
                                topLevelExecutableCount: 0
                            }
                        }
                    }
                },
                {
                    nodeId: 'KernelPlugin.run',
                    category: 'core',
                    sourcePath: 'src/platform/kernel.ts',
                    fission: {
                        problem: 'Platform kernel plugin',
                        demand: ['KernelContext'],
                        answer: ['KernelResult'],
                        evidence: {
                            abstraction: {
                                role: 'mixed',
                                signals: ['implements_contract'],
                                implements: ['KernelPlugin'],
                                abstractionSignalCount: 1,
                                concreteSignalCount: 3,
                                interfaceCount: 1,
                                typeAliasCount: 0,
                                abstractClassCount: 0,
                                concreteClassCount: 1,
                                publicMethodCount: 1,
                                topLevelExecutableCount: 0
                            }
                        }
                    }
                }
            ],
            null,
            2
        ),
        'utf-8'
    );

    return { root, paths };
}

test('syncAbstractionMemory records reusable abstractions and excludes configured stable paths', () => {
    const { paths } = createAbstractionMemoryFixture();
    const artifact = syncAbstractionMemory(paths);

    assert.equal(fs.existsSync(paths.abstractionMemoryFile), true);
    assert.ok(artifact.summary.rememberedEntryCount >= 2);
    assert.equal(artifact.entries.some((entry) => entry.name === 'KernelPlugin'), false);

    const paymentStrategy = artifact.entries.find((entry) => entry.name === 'PaymentStrategy');
    assert.ok(paymentStrategy);
    assert.equal(paymentStrategy?.kind, 'interface_or_contract');
    assert.deepEqual(paymentStrategy?.providerNodeIds, ['PaypalPay.execute', 'StripePay.execute']);
    assert.deepEqual(paymentStrategy?.consumerNodeIds, ['PaymentRouter.route']);

    const abstractBase = artifact.entries.find((entry) => entry.name === 'BasePaymentProvider');
    assert.ok(abstractBase);
    assert.equal(abstractBase?.kind, 'abstract_class');

    const abstractFunction = artifact.entries.find((entry) => entry.kind === 'abstract_function');
    assert.ok(abstractFunction);
    assert.equal(abstractFunction?.name, 'PaymentStrategy.pay');
    assert.deepEqual(abstractFunction?.signatures, ['PaymentStrategy.pay(input: PayInput): PayResult']);

    const results = searchAbstractionMemory(artifact, 'payment strategy', 5);
    assert.equal(results.some((item) => item.entry.name === 'PaymentStrategy'), true);
    assert.equal(searchAbstractionMemory(artifact, 'pay input', 5).some((item) => item.entry.kind === 'abstract_function'), true);

    const recommendations = recommendAbstractionMemory(artifact, {
        query: 'payment strategy reuse',
        focusNodeId: 'PaymentRouter.route',
        focusSourcePath: 'src/payments/router.ts',
        limit: 3
    });
    assert.equal(recommendations.length > 0, true);
    assert.equal(recommendations.some((item) => item.entry.name === 'PaymentStrategy'), true);
    assert.equal(recommendations[0].rationale.length > 0, true);

    const protocolCandidates = buildAbstractionProtocolActionCandidates(paths, {
        demand: 'payment strategy reuse',
        focusNodeId: 'PaymentRouter.route',
        limit: 4
    });
    assert.equal(protocolCandidates.length > 0, true);
    assert.equal(protocolCandidates.some((item) => item.action.op === 'reuse'), true);
    assert.equal(protocolCandidates.some((item) => item.action.op === 'modify'), true);
  });
