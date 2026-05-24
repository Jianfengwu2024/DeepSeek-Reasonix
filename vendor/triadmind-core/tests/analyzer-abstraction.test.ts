import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateAbstractionSummaryBySourcePath,
    detectAbstractionDeficitHotspots,
    detectFlatVariantClusters
} from '../analyzer';

test('calculateAbstractionSummaryBySourcePath groups abstraction evidence by sourcePath', () => {
    const map = [
        {
            nodeId: 'StripePay.execute',
            sourcePath: 'backend/payments/strategies.ts',
            fission: {
                demand: ['PayInput'],
                answer: ['PayResult'],
                evidence: {
                    abstraction: {
                        role: 'concrete',
                        signals: ['interface_declaration', 'implements_contract', 'variant_member'],
                        implements: ['PaymentStrategy'],
                        extendsAbstract: ['BasePaymentProvider'],
                        variantCluster: 'pay',
                        abstractionSignalCount: 3,
                        concreteSignalCount: 7,
                        interfaceCount: 1,
                        typeAliasCount: 1,
                        abstractClassCount: 1,
                        concreteClassCount: 2,
                        publicMethodCount: 2,
                        topLevelExecutableCount: 1
                    }
                }
            }
        },
        {
            nodeId: 'PaypalPay.execute',
            sourcePath: 'backend/payments/strategies.ts',
            fission: {
                demand: ['PayInput'],
                answer: ['PayResult'],
                evidence: {
                    abstraction: {
                        role: 'concrete',
                        signals: ['implements_contract', 'variant_member'],
                        implements: ['PaymentStrategy'],
                        extendsAbstract: ['BasePaymentProvider'],
                        variantCluster: 'pay',
                        abstractionSignalCount: 3,
                        concreteSignalCount: 7,
                        interfaceCount: 1,
                        typeAliasCount: 1,
                        abstractClassCount: 1,
                        concreteClassCount: 2,
                        publicMethodCount: 2,
                        topLevelExecutableCount: 1
                    }
                }
            }
        },
        {
            nodeId: 'Strategies.runPayment',
            sourcePath: 'backend/payments/strategies.ts',
            fission: {
                demand: ['PaymentStrategy (strategy)', 'PayInput (input)'],
                answer: ['PayResult'],
                evidence: {
                    abstraction: {
                        role: 'mixed',
                        signals: ['depends_on_contract'],
                        dependsOnAbstractions: ['PaymentStrategy'],
                        abstractionSignalCount: 3,
                        concreteSignalCount: 7,
                        interfaceCount: 1,
                        typeAliasCount: 1,
                        abstractClassCount: 1,
                        concreteClassCount: 2,
                        publicMethodCount: 2,
                        topLevelExecutableCount: 1
                    }
                }
            }
        }
    ];

    const summary = calculateAbstractionSummaryBySourcePath(map);
    assert.equal(summary.length, 1);
    assert.equal(summary[0].sourcePath, 'backend/payments/strategies.ts');
    assert.equal(summary[0].abstractionSignalCount, 3);
    assert.equal(summary[0].concreteSignalCount, 7);
    assert.equal(summary[0].role, 'mixed');
    assert.deepEqual(summary[0].variantClusters, ['pay']);
    assert.deepEqual(summary[0].implementingNodes, ['PaypalPay.execute', 'StripePay.execute']);
    assert.deepEqual(summary[0].dependentNodes, ['Strategies.runPayment']);
});

test('detectFlatVariantClusters and abstraction hotspots expose concrete-only growth zones', () => {
    const map = [
        {
            nodeId: 'StripePay.execute',
            sourcePath: 'backend/payments/flat.ts',
            fission: {
                demand: ['PayInput'],
                answer: ['PayResult'],
                evidence: {
                    abstraction: {
                        role: 'concrete',
                        signals: ['variant_member'],
                        variantCluster: 'pay',
                        abstractionSignalCount: 0,
                        concreteSignalCount: 6,
                        concreteClassCount: 3,
                        publicMethodCount: 3,
                        topLevelExecutableCount: 0
                    }
                }
            }
        },
        {
            nodeId: 'PaypalPay.execute',
            sourcePath: 'backend/payments/flat.ts',
            fission: {
                demand: ['PayInput'],
                answer: ['PayResult'],
                evidence: {
                    abstraction: {
                        role: 'concrete',
                        signals: ['variant_member'],
                        variantCluster: 'pay',
                        abstractionSignalCount: 0,
                        concreteSignalCount: 6,
                        concreteClassCount: 3,
                        publicMethodCount: 3,
                        topLevelExecutableCount: 0
                    }
                }
            }
        },
        {
            nodeId: 'WechatPay.execute',
            sourcePath: 'backend/payments/flat.ts',
            fission: {
                demand: ['PayInput'],
                answer: ['PayResult'],
                evidence: {
                    abstraction: {
                        role: 'concrete',
                        signals: ['variant_member'],
                        variantCluster: 'pay',
                        abstractionSignalCount: 0,
                        concreteSignalCount: 6,
                        concreteClassCount: 3,
                        publicMethodCount: 3,
                        topLevelExecutableCount: 0
                    }
                }
            }
        }
    ];

    const clusters = detectFlatVariantClusters(map);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].sourcePath, 'backend/payments/flat.ts');
    assert.equal(clusters[0].cluster, 'pay');
    assert.equal(clusters[0].contractCoverage, false);
    assert.deepEqual(clusters[0].nodeIds, ['PaypalPay.execute', 'StripePay.execute', 'WechatPay.execute']);

    const hotspots = detectAbstractionDeficitHotspots(map, {
        minConcreteSignals: 4,
        maxAbstractionRatio: 0.2
    });
    assert.equal(hotspots.length, 1);
    assert.equal(hotspots[0].sourcePath, 'backend/payments/flat.ts');
    assert.equal(hotspots[0].abstractionSignalCount, 0);
    assert.equal(hotspots[0].concreteSignalCount, 6);
    assert.deepEqual(hotspots[0].variantClusters, ['pay']);
    assert.match(hotspots[0].reason, /no abstraction signals detected/i);
});
