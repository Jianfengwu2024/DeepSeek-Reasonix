import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadTriadConfig } from '../config';
import { collectTreeSitterParseResult } from '../treeSitterParser';
import { ensureTriadSpec, getWorkspacePaths } from '../workflow';

test('tree-sitter abstraction evidence captures abstract function signatures', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-tree-sitter-abstraction-'));
    const srcDir = path.join(root, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    fs.writeFileSync(
        path.join(srcDir, 'payments.ts'),
        [
            'export interface PaymentStrategy {',
            '  pay(input: PayInput): Promise<PayResult>;',
            '}',
            '',
            'export type PaymentSelector = (provider: string, input: PayInput) => Promise<PayResult>;',
            '',
            'export abstract class BasePaymentProvider {',
            '  abstract pay(input: PayInput): Promise<PayResult>;',
            '}',
            '',
            'export function routePayment(',
            '  strategy: PaymentStrategy,',
            '  select: PaymentSelector,',
            '  input: PayInput',
            '): Promise<PayResult> {',
            '  return select("stripe", input);',
            '}'
        ].join('\n'),
        'utf-8'
    );

    const paths = getWorkspacePaths(root);
    ensureTriadSpec(paths, true);
    const config = loadTriadConfig(paths);
    const result = collectTreeSitterParseResult('typescript', root, config);

    const paymentNode = result.projectedNodes.find((node) => node.sourcePath === 'src/payments.ts');
    assert.ok(paymentNode);
    const abstraction = paymentNode?.fission?.evidence?.abstraction;
    assert.ok(abstraction);
    assert.equal(abstraction?.signals?.includes('abstract_function'), true);
    assert.equal(abstraction?.functionContractCount, 3);
    assert.deepEqual(
        [...(abstraction?.abstractFunctions ?? [])].sort(),
        [
            'BasePaymentProvider.pay(input: PayInput): Promise<PayResult>',
            'PaymentSelector(provider: string, input: PayInput): Promise<PayResult>',
            'PaymentStrategy.pay(input: PayInput): Promise<PayResult>'
        ].sort()
    );
});
