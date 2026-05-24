import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function createTrendFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-trend-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });
    fs.writeFileSync(
        path.join(triadDir, 'triad-map.json'),
        JSON.stringify(
            [
                {
                    nodeId: 'ApiController.execute',
                    category: 'backend',
                    sourcePath: 'src/backend/api/controller.py',
                    fission: {
                        problem: 'Handle request',
                        demand: ['RunCommand (command)', '[Ghost:Read] RedisClient (cache.redis)'],
                        answer: ['RunResult']
                    }
                },
                {
                    nodeId: 'WorkflowService.dispatch',
                    category: 'backend',
                    sourcePath: 'src/backend/workflows/service.py',
                    fission: {
                        problem: 'Dispatch workflow',
                        demand: ['RunCommand (command)'],
                        answer: ['RunResult']
                    }
                }
            ],
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(
        path.join(triadDir, 'runtime-map.json'),
        JSON.stringify(
            {
                schemaVersion: '1.0',
                project: 'trend-test',
                generatedAt: new Date().toISOString(),
                view: 'full',
                nodes: [
                    { id: 'ApiRoute.POST./run', type: 'ApiRoute', label: 'POST /run' },
                    { id: 'Service.WorkflowService.dispatch', type: 'Service', label: 'WorkflowService.dispatch' }
                ],
                edges: [{ from: 'ApiRoute.POST./run', to: 'Service.WorkflowService.dispatch', type: 'invokes' }]
            },
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(
        path.join(triadDir, 'runtime-diagnostics.json'),
        JSON.stringify(
            [
                {
                    level: 'info',
                    code: 'RUNTIME_PERMISSION_SKIPPED_SUMMARY',
                    extractor: 'RuntimeSourceCollector',
                    message: 'none'
                }
            ],
            null,
            2
        ),
        'utf-8'
    );
    return root;
}

function createTrendRiskPartitionFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-trend-risk-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });
    fs.writeFileSync(
        path.join(triadDir, 'triad-map.json'),
        JSON.stringify(
            [
                {
                    nodeId: 'AnalyzerOptionsSupport.module_pipeline',
                    category: 'core',
                    sourcePath: 'analyzerOptionsSupport.ts',
                    fission: {
                        problem: 'Support analyzer options plumbing',
                        demand: ['AnalyzerConfigLike (config)'],
                        answer: ['AnalyzerOptions']
                    }
                },
                {
                    nodeId: 'RuntimeExtractor.extract',
                    category: 'runtime',
                    sourcePath: 'runtime/extractors/runtimeExtractor.ts',
                    fission: {
                        problem: 'Extract runtime graph fragments',
                        demand: ['[Ghost:Read] RuntimeRegistry (registry)'],
                        answer: ['RuntimeEdge[]']
                    }
                },
                {
                    nodeId: 'CliWorkflowSupport.executeDreamRun',
                    category: 'workflow',
                    sourcePath: 'cliWorkflowSupport.ts',
                    fission: {
                        problem: 'Run dream workflow command',
                        demand: ['DreamRunCliOptions (options)', '[Ghost:Read] ensureTriadSpec (ensureTriadSpec)'],
                        answer: ['void']
                    }
                },
                {
                    nodeId: 'BootstrapScaffoldService.init',
                    category: 'bootstrap',
                    sourcePath: 'bootstrapScaffoldService.ts',
                    fission: {
                        problem: 'Bootstrap workspace scaffold',
                        demand: ['WorkspacePaths (paths)', '[Ghost:Read] writeTemplateFile (writeTemplateFile)'],
                        answer: ['BootstrapScaffoldInitResult']
                    }
                }
            ],
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(
        path.join(triadDir, 'runtime-map.json'),
        JSON.stringify(
            {
                schemaVersion: '1.0',
                project: 'trend-risk-test',
                generatedAt: new Date().toISOString(),
                view: 'full',
                nodes: [],
                edges: []
            },
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(path.join(triadDir, 'runtime-diagnostics.json'), JSON.stringify([], null, 2), 'utf-8');
    return root;
}

function createTrendStableAnchorFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-trend-stable-anchor-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });
    fs.writeFileSync(
        path.join(triadDir, 'triad-map.json'),
        JSON.stringify(
            [
                {
                    nodeId: 'LegacyCore.execute',
                    category: 'core',
                    sourcePath: 'src/legacy/core.ts',
                    fission: {
                        problem: 'Run legacy core workflow',
                        demand: ['LegacyCommand'],
                        answer: ['LegacyResult']
                    }
                },
                ...Array.from({ length: 6 }, (_, index) => ({
                    nodeId: `LegacyConsumer${index + 1}.handle`,
                    category: 'core',
                    sourcePath: `src/core/legacy_consumer_${index + 1}.ts`,
                    fission: {
                        problem: `Consume legacy result ${index + 1}`,
                        demand: ['LegacyResult'],
                        answer: [`Consumer${index + 1}Receipt`]
                    }
                }))
            ],
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(
        path.join(triadDir, 'runtime-map.json'),
        JSON.stringify(
            {
                schemaVersion: '1.0',
                project: 'trend-stable-anchor-test',
                generatedAt: new Date().toISOString(),
                view: 'full',
                nodes: [],
                edges: []
            },
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(path.join(triadDir, 'runtime-diagnostics.json'), JSON.stringify([], null, 2), 'utf-8');
    fs.writeFileSync(
        path.join(triadDir, 'config.json'),
        JSON.stringify(
            {
                topologyRisk: {
                    matureStableNodeIds: ['LegacyCore.execute'],
                    matureStableNodePatterns: [],
                    matureStableSourcePaths: ['src/legacy/core.ts'],
                    matureStableSourcePathPatterns: ['src/legacy/**']
                }
            },
            null,
            2
        ),
        'utf-8'
    );
    return root;
}

function runCli(cwd: string, args: string[]) {
    const repoRoot = path.resolve(__dirname, '..');
    const cliPath = path.join(repoRoot, 'cli.ts');
    const tsxLoader = pathToFileURL(require.resolve('tsx')).href;
    return spawnSync(process.execPath, ['--import', tsxLoader, cliPath, ...args], {
        cwd,
        encoding: 'utf-8'
    });
}

test('trend command writes trend.json and trend-report.md', () => {
    const root = createTrendFixture();
    const result = runCli(root, ['trend']);
    assert.equal(result.status, 0, `trend command failed: ${result.stderr || result.stdout}`);

    const trendFile = path.join(root, '.triadmind', 'trend.json');
    const trendReportFile = path.join(root, '.triadmind', 'trend-report.md');
    assert.equal(fs.existsSync(trendFile), true);
    assert.equal(fs.existsSync(trendReportFile), true);

    const trend = JSON.parse(fs.readFileSync(trendFile, 'utf-8'));
    assert.equal(Array.isArray(trend.snapshots), true);
    assert.equal(trend.snapshots.length, 1);
    const markdown = fs.readFileSync(trendReportFile, 'utf-8');
    assert.match(markdown, /Architecture Drift Weekly Report/);
    assert.match(markdown, /Summary/);
});

test('trend --json reports chain drift against previous snapshot', () => {
    const root = createTrendFixture();
    const firstRun = runCli(root, ['trend']);
    assert.equal(firstRun.status, 0, `trend first run failed: ${firstRun.stderr || firstRun.stdout}`);

    const triadMapPath = path.join(root, '.triadmind', 'triad-map.json');
    const triadMap = JSON.parse(fs.readFileSync(triadMapPath, 'utf-8'));
    triadMap.push({
        nodeId: 'WorkerNode.process',
        category: 'backend',
        sourcePath: 'src/backend/worker/node.py',
        fission: {
            problem: 'Process task',
            demand: ['RunResult (result)'],
            answer: ['ProcessResult']
        }
    });
    fs.writeFileSync(triadMapPath, JSON.stringify(triadMap, null, 2), 'utf-8');

    const secondRun = runCli(root, ['trend', '--json']);
    assert.equal(secondRun.status, 0, `trend second run failed: ${secondRun.stderr || secondRun.stdout}`);
    const jsonStart = secondRun.stdout.indexOf('{');
    assert.ok(jsonStart >= 0, 'trend --json output missing JSON payload');
    const payload = JSON.parse(secondRun.stdout.slice(jsonStart));
    assert.ok(Array.isArray(payload.report.addedTriadEdges));
    assert.ok(Array.isArray(payload.report.removedTriadEdges));
    assert.ok(Array.isArray(payload.report.summary));
    assert.ok(payload.report.summary.length > 0);
    assert.ok(payload.report.previousGeneratedAt);
});

test('trend separates support hubs and ghost-only noise from structural risk scoring', () => {
    const root = createTrendRiskPartitionFixture();
    const firstRun = runCli(root, ['trend']);
    assert.equal(firstRun.status, 0, `trend first run failed: ${firstRun.stderr || firstRun.stdout}`);

    const triadMapPath = path.join(root, '.triadmind', 'triad-map.json');
    const triadMap = JSON.parse(fs.readFileSync(triadMapPath, 'utf-8'));
    for (let index = 0; index < 6; index += 1) {
        triadMap.push({
            nodeId: `AnalyzerConsumer.consumeOption${index + 1}`,
            category: 'core',
            sourcePath: `src/core/consumer_${index + 1}.ts`,
            fission: {
                problem: `Consume analyzer options ${index + 1}`,
                demand: ['AnalyzerOptions'],
                answer: [`AnalyzerReceipt${index + 1}`]
            }
        });
    }
    triadMap.push({
        nodeId: 'BootstrapConsumer.handle',
        category: 'bootstrap',
        sourcePath: 'bootstrapConsumer.ts',
        fission: {
            problem: 'Consume bootstrap scaffold result',
            demand: ['BootstrapScaffoldInitResult'],
            answer: ['void']
        }
    });
    fs.writeFileSync(triadMapPath, JSON.stringify(triadMap, null, 2), 'utf-8');

    const secondRun = runCli(root, ['trend', '--json']);
    assert.equal(secondRun.status, 0, `trend second run failed: ${secondRun.stderr || secondRun.stdout}`);
    const jsonStart = secondRun.stdout.indexOf('{');
    assert.ok(jsonStart >= 0, 'trend --json output missing JSON payload');
    const payload = JSON.parse(secondRun.stdout.slice(jsonStart));
    const snapshot = payload.report.snapshot;

    assert.equal(
        snapshot.highRiskNodes.some((node: { nodeId?: string }) => node.nodeId === 'AnalyzerOptionsSupport.module_pipeline'),
        false
    );
    assert.equal(
        snapshot.supportLayerNodes.some((node: { nodeId?: string }) => node.nodeId === 'AnalyzerOptionsSupport.module_pipeline'),
        true
    );
    assert.equal(
        snapshot.ghostNoiseNodes.some((node: { nodeId?: string }) => node.nodeId === 'RuntimeExtractor.extract'),
        true
    );
    assert.equal(
        snapshot.ghostNoiseNodes.some((node: { nodeId?: string }) => node.nodeId === 'CliWorkflowSupport.executeDreamRun'),
        true
    );
    assert.equal(
        snapshot.ghostNoiseNodes.some((node: { nodeId?: string }) => node.nodeId === 'BootstrapScaffoldService.init'),
        true
    );
    assert.equal(
        snapshot.highRiskNodes.some((node: { nodeId?: string }) => node.nodeId === 'RuntimeExtractor.extract'),
        false
    );
    assert.equal(
        snapshot.highRiskNodes.some((node: { nodeId?: string }) => node.nodeId === 'CliWorkflowSupport.executeDreamRun'),
        false
    );
    assert.equal(
        snapshot.highRiskNodes.some((node: { nodeId?: string }) => node.nodeId === 'BootstrapScaffoldService.init'),
        false
    );
    assert.equal(
        payload.report.centralitySurges.some(
            (item: { nodeId?: string }) => item.nodeId === 'AnalyzerOptionsSupport.module_pipeline'
        ),
        true
    );
});

test('trend classifies mature stable anchors outside structural high-risk scoring', () => {
    const root = createTrendStableAnchorFixture();
    const run = runCli(root, ['trend', '--json']);
    assert.equal(run.status, 0, `trend run failed: ${run.stderr || run.stdout}`);

    const jsonStart = run.stdout.indexOf('{');
    assert.ok(jsonStart >= 0, 'trend --json output missing JSON payload');
    const payload = JSON.parse(run.stdout.slice(jsonStart));
    const snapshot = payload.report.snapshot;

    assert.equal(snapshot.highRiskNodes.some((node: { nodeId?: string }) => node.nodeId === 'LegacyCore.execute'), false);
    assert.equal(
        snapshot.matureStableNodes.some((node: { nodeId?: string }) => node.nodeId === 'LegacyCore.execute'),
        true
    );
    assert.equal(
        payload.report.centralitySurges.some((item: { nodeId?: string }) => item.nodeId === 'LegacyCore.execute'),
        false
    );
});
