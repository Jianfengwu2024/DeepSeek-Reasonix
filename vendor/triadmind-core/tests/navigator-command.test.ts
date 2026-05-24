import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function runCli(cwd: string, args: string[], env?: Record<string, string>) {
    const repoRoot = path.resolve(__dirname, '..');
    const cliPath = path.join(repoRoot, 'cli.ts');
    const tsxLoader = pathToFileURL(require.resolve('tsx')).href;
    return spawnSync(process.execPath, ['--import', tsxLoader, cliPath, ...args], {
        cwd,
        encoding: 'utf-8',
        env: {
            ...process.env,
            ...env
        }
    });
}

function runCliAsync(cwd: string, args: string[], env?: Record<string, string>) {
    const repoRoot = path.resolve(__dirname, '..');
    const cliPath = path.join(repoRoot, 'cli.ts');
    const tsxLoader = pathToFileURL(require.resolve('tsx')).href;

    return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', tsxLoader, cliPath, ...args], {
            cwd,
            env: {
                ...process.env,
                ...env
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += String(chunk);
        });
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
        });
        child.on('error', reject);
        child.on('close', (status) => {
            resolve({
                status,
                stdout,
                stderr
            });
        });
    });
}

function createNavigatorFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-navigator-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });

    fs.writeFileSync(
        path.join(triadDir, 'triad-map.json'),
        JSON.stringify(
            [
                {
                    nodeId: 'OrderService.execute',
                    category: 'backend',
                    sourcePath: 'src/backend/order_service.ts',
                    fission: {
                        problem: 'Execute order workflow',
                        demand: ['OrderCommand'],
                        answer: ['OrderResult']
                    }
                },
                {
                    nodeId: 'NotificationService.handle',
                    category: 'backend',
                    sourcePath: 'src/backend/notification_service.ts',
                    fission: {
                        problem: 'Handle order notifications',
                        demand: ['OrderResult'],
                        answer: ['void']
                    }
                }
            ],
            null,
            2
        ),
        'utf-8'
    );

    return root;
}

function readVisualizerArray<T>(html: string, name: string) {
    const nextName = name === 'RAW_NODES' ? 'RAW_EDGES' : name === 'RAW_EDGES' ? 'LEGEND' : 'MAYA_DATA';
    const match = html.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);\\s*const ${nextName} = `));
    assert.ok(match, `${name} bootstrap not found in generated html`);
    return JSON.parse(match[1]) as T[];
}

function writeNavigatorConfig(root: string, navigatorConfig: Record<string, unknown>) {
    fs.writeFileSync(
        path.join(root, '.triadmind', 'config.json'),
        JSON.stringify(
            {
                navigator: navigatorConfig
            },
            null,
            2
        ),
        'utf-8'
    );
}

function createCreateChildProtocol(demand: string) {
    return {
        protocolVersion: '1.0',
        project: 'navigator-test',
        mapSource: '.triadmind/triad-map.json',
        userDemand: demand,
        upgradePolicy: {
            allowedOps: ['reuse', 'modify', 'create_child'],
            principle: 'reuse_first_minimal_change'
        },
        actions: [
            {
                op: 'create_child',
                parentNodeId: 'OrderService.execute',
                node: {
                    nodeId: 'PaymentService.process',
                    category: 'backend',
                    sourcePath: 'src/backend/payment_service.ts',
                    fission: {
                        problem: 'Process payment for submitted orders',
                        demand: ['OrderResult'],
                        answer: ['PaymentResult']
                    }
                },
                reason: 'Add payment processing capability'
            }
        ]
    };
}

async function withMockOpenAiServer(
    handler: (requestBody: any) => Record<string, unknown> | Promise<Record<string, unknown>>,
    run: (baseUrl: string) => Promise<void>
) {
    const requests: any[] = [];
    const server = http.createServer(async (req, res) => {
        if (req.method !== 'POST' || req.url !== '/v1/responses') {
            res.statusCode = 404;
            res.end('not found');
            return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        requests.push(body);
        const payload = await handler(body);

        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}/v1`;

    try {
        await run(baseUrl);
    } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }

    return requests;
}

test('navigate writes prompt and protocol template when no impact protocol is available yet', () => {
    const root = createNavigatorFixture();
    const result = runCli(root, ['navigate', 'add payment module', '--no-open']);

    assert.equal(result.status, 0, `navigate command failed: ${result.stderr || result.stdout}`);
    assert.match(result.stdout, /navigator prompt prepared/i);
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'impact-prompt.md')), true);
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'impact-protocol.json')), true);
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'impact-map.json')), false);
    assert.match(fs.readFileSync(path.join(root, '.triadmind', 'impact-prompt.md'), 'utf-8'), /Abstraction Memory Workflow/);
    assert.match(fs.readFileSync(path.join(root, '.triadmind', 'impact-prompt.md'), 'utf-8'), /Abstraction Memory Recommendations JSON/);
    assert.match(fs.readFileSync(path.join(root, '.triadmind', 'impact-prompt.md'), 'utf-8'), /Protocol Seed Action Candidates JSON/);
});

test('navigate renders impact-map and proposed lifecycle overlays when protocol actions are provided', () => {
    const root = createNavigatorFixture();
    const triadDir = path.join(root, '.triadmind');
    fs.writeFileSync(
        path.join(triadDir, 'impact-protocol.json'),
        JSON.stringify(createCreateChildProtocol('add payment module'), null, 2),
        'utf-8'
    );

    const result = runCli(root, ['navigate', 'add payment module', '--no-open']);
    assert.equal(result.status, 0, `navigate command failed: ${result.stderr || result.stdout}`);

    const impactMapFile = path.join(triadDir, 'impact-map.json');
    const impactVisualizerFile = path.join(triadDir, 'impact-visualizer.html');
    assert.equal(fs.existsSync(impactMapFile), true);
    assert.equal(fs.existsSync(impactVisualizerFile), true);

    const impactMap = JSON.parse(fs.readFileSync(impactMapFile, 'utf-8'));
    assert.ok(impactMap.summary.proposedNodeCount > 0);
    assert.ok(impactMap.summary.proposedEdgeCount > 0);
    assert.ok(impactMap.graph.nodes.some((node: any) => node.lifecycle === 'proposed'));
    assert.ok(impactMap.graph.edges.some((edge: any) => edge.lifecycle === 'proposed'));

    const html = fs.readFileSync(impactVisualizerFile, 'utf-8');
    assert.match(html, /架构导航冲击地图/);
    assert.match(html, /Proposed Feature \(拟新增功能\)/);
    assert.match(html, /#ff4d4f/);

    const nodes = readVisualizerArray<any>(html, 'RAW_NODES');
    const edges = readVisualizerArray<any>(html, 'RAW_EDGES');
    assert.equal(nodes.some((node) => node.id === 'PaymentService.process' && node._lifecycle === 'proposed'), true);
    assert.equal(edges.some((edge) => edge._lifecycle === 'proposed'), true);
});

test('navigate can generate impact protocol through a provider-backed OpenAI adapter', async () => {
    const root = createNavigatorFixture();
    const triadDir = path.join(root, '.triadmind');

    await withMockOpenAiServer(
        (requestBody) => {
            assert.equal(requestBody.model, 'gpt-test');
            return {
                output_text: JSON.stringify(createCreateChildProtocol('add payment module'))
            };
        },
        async (baseUrl) => {
            writeNavigatorConfig(root, {
                baseUrl,
                apiKeyEnv: 'TRIADMIND_TEST_OPENAI_KEY'
            });

            const result = await runCliAsync(
                root,
                ['navigate', 'add payment module', '--llm', 'openai:gpt-test', '--no-open'],
                {
                TRIADMIND_TEST_OPENAI_KEY: 'test-key'
                }
            );

            assert.equal(result.status, 0, `navigate command failed: ${result.stderr || result.stdout}`);
            assert.match(result.stdout, /Impact protocol generated via openai:gpt-test/i);
            assert.equal(fs.existsSync(path.join(triadDir, 'impact-map.json')), true);

            const protocol = JSON.parse(fs.readFileSync(path.join(triadDir, 'impact-protocol.json'), 'utf-8'));
            assert.equal(protocol.userDemand, 'add payment module');
            assert.equal(protocol.actions.length, 1);
        }
    );
});

test('navigate resets stale default impact protocol when the demand changes', () => {
    const root = createNavigatorFixture();
    const triadDir = path.join(root, '.triadmind');
    fs.writeFileSync(path.join(triadDir, 'impact-map.json'), JSON.stringify({ stale: true }, null, 2), 'utf-8');
    fs.writeFileSync(path.join(triadDir, 'impact-visualizer.html'), '<html>stale</html>', 'utf-8');
    fs.writeFileSync(
        path.join(triadDir, 'impact-protocol.json'),
        JSON.stringify(createCreateChildProtocol('legacy reporting module'), null, 2),
        'utf-8'
    );

    const result = runCli(root, ['navigate', 'add payment module', '--no-open']);

    assert.equal(result.status, 0, `navigate command failed: ${result.stderr || result.stdout}`);
    assert.match(result.stdout, /stale/i);
    assert.match(result.stdout, /navigator prompt prepared/i);
    assert.equal(fs.existsSync(path.join(triadDir, 'impact-map.json')), false);
    assert.equal(fs.existsSync(path.join(triadDir, 'impact-visualizer.html')), false);

    const protocol = JSON.parse(fs.readFileSync(path.join(triadDir, 'impact-protocol.json'), 'utf-8'));
    assert.equal(protocol.userDemand, 'add payment module');
    assert.deepEqual(protocol.actions, []);
});
