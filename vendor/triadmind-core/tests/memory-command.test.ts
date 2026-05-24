import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function runCli(cwd: string, args: string[]) {
    const repoRoot = path.resolve(__dirname, '..');
    const cliPath = path.join(repoRoot, 'cli.ts');
    const tsxLoader = pathToFileURL(require.resolve('tsx')).href;
    return spawnSync(process.execPath, ['--import', tsxLoader, cliPath, ...args], {
        cwd,
        encoding: 'utf-8',
        env: process.env
    });
}

function createMemoryCommandFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-memory-command-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });

    fs.writeFileSync(
        path.join(triadDir, 'triad-map.json'),
        JSON.stringify(
            [
                {
                    nodeId: 'CacheReader.load',
                    category: 'core',
                    sourcePath: 'src/cache/cache.ts',
                    fission: {
                        problem: 'Read from cache',
                        demand: ['CachePort', 'CacheKey'],
                        answer: ['CacheValue'],
                        evidence: {
                            abstraction: {
                                role: 'mixed',
                                signals: ['depends_on_contract'],
                                dependsOnAbstractions: ['CachePort'],
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
                },
                {
                    nodeId: 'RedisCache.load',
                    category: 'core',
                    sourcePath: 'src/cache/cache.ts',
                    fission: {
                        problem: 'Read from redis cache',
                        demand: ['CacheKey'],
                        answer: ['CacheValue'],
                        evidence: {
                            abstraction: {
                                role: 'mixed',
                                signals: ['implements_contract'],
                                implements: ['CachePort'],
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

    return root;
}

test('memory sync and search expose abstraction memory through CLI', () => {
    const root = createMemoryCommandFixture();

    const syncResult = runCli(root, ['memory', 'sync']);
    assert.equal(syncResult.status, 0, syncResult.stderr || syncResult.stdout);
    assert.match(syncResult.stdout, /abstraction memory written/i);
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'abstraction-memory.json')), true);

    const searchResult = runCli(root, ['memory', 'search', 'cache']);
    assert.equal(searchResult.status, 0, searchResult.stderr || searchResult.stdout);
    assert.match(searchResult.stdout, /CachePort/);

    const recommendResult = runCli(root, ['memory', 'recommend', 'cache']);
    assert.equal(recommendResult.status, 0, recommendResult.stderr || recommendResult.stdout);
    assert.match(recommendResult.stdout, /top protocol seed candidates/i);
    assert.match(recommendResult.stdout, /reuse|modify/);

    const actionsResult = runCli(root, ['memory', 'actions', 'cache']);
    assert.equal(actionsResult.status, 0, actionsResult.stderr || actionsResult.stdout);
    assert.match(actionsResult.stdout, /protocol seed actions/i);
    assert.match(actionsResult.stdout, /"op":"reuse"|"op":"modify"/);
});
