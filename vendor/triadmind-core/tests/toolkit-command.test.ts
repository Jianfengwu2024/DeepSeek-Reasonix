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

function createToolkitFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-toolkit-command-'));
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
                                signals: ['implements_contract', 'abstract_function'],
                                implements: ['CachePort'],
                                abstractFunctions: ['load(cacheKey: CacheKey): CacheValue'],
                                abstractionSignalCount: 2,
                                concreteSignalCount: 2,
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

test('toolkit sync/search/reclassify and whitelist commands work end-to-end', () => {
    const root = createToolkitFixture();

    const syncResult = runCli(root, ['memory', 'toolkit', 'sync']);
    assert.equal(syncResult.status, 0, syncResult.stderr || syncResult.stdout);
    assert.match(syncResult.stdout, /toolkit written/i);

    const toolkitFile = path.join(root, '.triadmind', 'project-abs-toolkit.json');
    const toolkitDir = path.join(root, '.triadmind', 'project-abs-toolkit');
    const whitelistFile = path.join(root, '.triadmind', 'project-abs-toolkit-taxonomy.json');
    assert.equal(fs.existsSync(toolkitFile), true);
    assert.equal(fs.existsSync(toolkitDir), true);

    const searchResult = runCli(root, ['memory', 'toolkit', 'search', 'cache']);
    assert.equal(searchResult.status, 0, searchResult.stderr || searchResult.stdout);
    assert.match(searchResult.stdout, /cache/i);

    const whitelistAddResult = runCli(root, ['memory', 'toolkit', 'whitelist', 'add', 'domain', 'cache_ports']);
    assert.equal(whitelistAddResult.status, 0, whitelistAddResult.stderr || whitelistAddResult.stdout);
    assert.equal(fs.existsSync(whitelistFile), true);

    const toolkitBefore = JSON.parse(fs.readFileSync(toolkitFile, 'utf-8')) as {
        entries: Array<{ id: string }>;
    };
    assert.equal(toolkitBefore.entries.length > 0, true);
    const targetEntryId = toolkitBefore.entries[0].id;

    const reclassifyResult = runCli(root, ['memory', 'toolkit', 'reclassify', targetEntryId, 'domain', 'cache_ports']);
    assert.equal(reclassifyResult.status, 0, reclassifyResult.stderr || reclassifyResult.stdout);
    assert.match(reclassifyResult.stdout, /reclassified/i);

    const toolkitAfter = JSON.parse(fs.readFileSync(toolkitFile, 'utf-8')) as {
        entries: Array<{ id: string; category: string; subcategory: string; toolkitDocPath: string }>;
    };
    const updatedEntry = toolkitAfter.entries.find((entry) => entry.id === targetEntryId);
    assert.ok(updatedEntry);
    assert.equal(updatedEntry?.category, 'domain');
    assert.equal(updatedEntry?.subcategory, 'cache_ports');

    const docPath = path.join(toolkitDir, updatedEntry!.toolkitDocPath);
    assert.equal(fs.existsSync(docPath), true);
});
