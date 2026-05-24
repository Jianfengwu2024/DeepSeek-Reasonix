import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import {
    buildAbstractionMemoryPromptContext,
    buildAbstractionProtocolActionCandidates,
    ensureAbstractionMemory,
    formatAbstractionMemoryPromptJson,
    formatAbstractionProtocolActionCandidatesJson,
    searchAbstractionMemory,
    syncAbstractionMemory
} from './abstractionMemory';
import { readTextIfExists } from './artifactReaders';
import { syncProjectTopology } from './cliSupport';
import { ensureTriadSpec, getWorkspacePaths } from './workflow';
import type { WorkspacePaths } from './workspace';
import {
    ensureProjectAbsToolkit,
    exportProjectAbsToolkitDirectory,
    exportProjectAbsToolkitMarkdown,
    persistProjectAbsToolkit,
    recalculateProjectAbsToolkitSummary,
    searchProjectAbsToolkit,
    syncProjectAbsToolkitFromMemory,
    type ProjectAbsToolkitArtifact
} from './projectAbsToolkit';

type MemorySearchCliOptions = {
    limit?: string;
    json?: boolean;
    demand?: boolean;
};

type MemoryRecommendCliOptions = MemorySearchCliOptions & {
    focusNode?: string;
};

type ToolkitWhitelistArtifact = {
    schemaVersion: '1.0';
    categories: Record<string, string[]>;
};

type ToolkitReclassOp = {
    entryId: string;
    category: string;
    subcategory: string;
};

export function registerMemoryCommands(program: Command) {
    const memory = program.command('memory').description('Build and query TriadMind abstraction memory');

    memory
        .command('sync')
        .description('Scan triad-map abstractions and write .triadmind/abstraction-memory.json')
        .action(() => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            if (!fs.existsSync(paths.mapFile)) {
                syncProjectTopology(paths);
            }

            try {
                const artifact = syncAbstractionMemory(paths);
                console.log(chalk.green(`[TriadMind] abstraction memory written: ${paths.abstractionMemoryFile}`));
                console.log(
                    chalk.green(
                        `[TriadMind] remembered ${artifact.summary.rememberedEntryCount} entries across ${artifact.summary.scannedSourceCount} source file(s).`
                    )
                );
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] memory sync failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    memory
        .command('search [query...]')
        .description('Search reusable abstractions before implementation')
        .option('-l, --limit <count>', 'Maximum search results to show', '6')
        .option('--json', 'Emit machine-readable search results JSON')
        .option('--demand', 'Search using the latest recorded user demand when no query is provided')
        .action((queryParts: string[], options: MemorySearchCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            if (!fs.existsSync(paths.mapFile)) {
                syncProjectTopology(paths);
            }

            try {
                const artifact = ensureAbstractionMemory(paths, { force: false, autoSync: true });
                const query = resolveMemoryQuery(paths, queryParts, options);
                const limit = Math.max(1, Number.parseInt(options.limit ?? '6', 10) || 6);
                const results = searchAbstractionMemory(artifact, query, limit);

                if (options.json) {
                    console.log(
                        JSON.stringify(
                            {
                                query,
                                memoryFile: paths.abstractionMemoryFile,
                                results
                            },
                            null,
                            2
                        )
                    );
                    return;
                }

                if (!query) {
                    const promptContext = buildAbstractionMemoryPromptContext(paths, '');
                    promptContext.summaryLines.forEach((line) => console.log(chalk.green(`[TriadMind] ${line}`)));
                    console.log(formatAbstractionMemoryPromptJson(promptContext.matches));
                    return;
                }

                if (results.length === 0) {
                    console.log(chalk.yellow(`[TriadMind] no abstraction memory hits for query: ${JSON.stringify(query)}`));
                    return;
                }

                console.log(chalk.green(`[TriadMind] abstraction memory hits for ${JSON.stringify(query)}:`));
                for (const result of results) {
                    console.log(
                        `${result.entry.name} | kind=${result.entry.kind} | score=${result.score} | source=${result.entry.primarySourcePath}`
                    );
                    console.log(`  ${result.entry.whyReusable}`);
                }
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] memory search failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    memory
        .command('recommend [query...]')
        .description('Recommend top reuse candidates before adding new code')
        .option('-l, --limit <count>', 'Maximum recommendations to show', '5')
        .option('--json', 'Emit machine-readable recommendation results JSON')
        .option('--demand', 'Use the latest recorded user demand when no query is provided')
        .option('--focus-node <nodeId>', 'Bias recommendations toward the current focus node')
        .action((queryParts: string[], options: MemoryRecommendCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            if (!fs.existsSync(paths.mapFile)) {
                syncProjectTopology(paths);
            }

            try {
                const artifact = ensureAbstractionMemory(paths, { force: false, autoSync: true });
                const query = resolveMemoryQuery(paths, queryParts, options);
                const limit = Math.max(1, Number.parseInt(options.limit ?? '5', 10) || 5);
                const recommendations = buildAbstractionProtocolActionCandidates(paths, {
                    demand: query,
                    focusNodeId: options.focusNode,
                    limit
                });

                if (options.json) {
                    console.log(
                        JSON.stringify(
                            {
                                query,
                                focusNodeId: options.focusNode ?? '',
                                memoryFile: paths.abstractionMemoryFile,
                                recommendations
                            },
                            null,
                            2
                        )
                    );
                    return;
                }

                if (recommendations.length === 0) {
                    console.log(chalk.yellow('[TriadMind] no strong abstraction reuse recommendation was found.'));
                    return;
                }

                console.log(chalk.green(`[TriadMind] top protocol seed candidates for ${JSON.stringify(query || 'current context')}:`));
                for (const item of recommendations) {
                    console.log(
                        `${item.action.op} | seed=${item.kind} | score=${item.score} | node=${'nodeId' in item.action ? item.action.nodeId : ''} | basedOn=${item.basedOnEntry.name}`
                    );
                    item.rationale.forEach((line) => console.log(`  - ${line}`));
                }
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] memory recommend failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    memory
        .command('actions [query...]')
        .description('Emit reuse/modify protocol seed actions from abstraction memory')
        .option('-l, --limit <count>', 'Maximum protocol seed actions to show', '5')
        .option('--json', 'Emit machine-readable protocol seed actions JSON')
        .option('--demand', 'Use the latest recorded user demand when no query is provided')
        .option('--focus-node <nodeId>', 'Bias protocol seeds toward the current focus node')
        .action((queryParts: string[], options: MemoryRecommendCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            if (!fs.existsSync(paths.mapFile)) {
                syncProjectTopology(paths);
            }

            try {
                const query = resolveMemoryQuery(paths, queryParts, options);
                const limit = Math.max(1, Number.parseInt(options.limit ?? '5', 10) || 5);
                const candidates = buildAbstractionProtocolActionCandidates(paths, {
                    demand: query,
                    focusNodeId: options.focusNode,
                    limit
                });

                if (options.json) {
                    console.log(formatAbstractionProtocolActionCandidatesJson(candidates));
                    return;
                }

                if (candidates.length === 0) {
                    console.log(chalk.yellow('[TriadMind] no protocol seed action candidates were found.'));
                    return;
                }

                console.log(chalk.green(`[TriadMind] protocol seed actions for ${JSON.stringify(query || 'current context')}:`));
                candidates.forEach((candidate) => {
                    console.log(JSON.stringify(candidate.action));
                });
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] memory actions failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    registerToolkitCommands(memory);
}

function resolveMemoryQuery(paths: ReturnType<typeof getWorkspacePaths>, queryParts: string[], options: MemorySearchCliOptions) {
    const inlineQuery = queryParts.join(' ').trim();
    if (inlineQuery) {
        return inlineQuery;
    }

    if (options.demand) {
        return readTextIfExists(paths.demandFile, { trim: true });
    }

    return '';
}

function registerToolkitCommands(memory: Command) {
    const toolkit = memory.command('toolkit').description('Manage project abstraction toolkit for team reuse');

    toolkit
        .command('show')
        .description('Show promoted toolkit entries and summary')
        .action(() => {
            try {
                const paths = prepareToolkitPaths();
                const artifact = ensureProjectAbsToolkit(paths, { force: false });
                printToolkitOverview(paths, artifact);
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] toolkit show failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    toolkit
        .command('sync')
        .description('Promote abstraction memory entries into project-abs-toolkit.json')
        .action(() => {
            try {
                const paths = prepareToolkitPaths();
                const artifact = syncProjectAbsToolkitFromMemory(paths);
                console.log(chalk.green(`[TriadMind] toolkit written: ${paths.projectAbsToolkitFile}`));
                console.log(
                    chalk.green(
                        `[TriadMind] promoted ${artifact.summary.promotedEntryCount} entries from ${artifact.summary.scannedMemoryEntryCount} memory entries.`
                    )
                );
                console.log(chalk.green(`[TriadMind] markdown: ${paths.projectAbsToolkitMarkdownFile}`));
                console.log(chalk.green(`[TriadMind] directory: ${paths.projectAbsToolkitDir}`));
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] toolkit sync failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    toolkit
        .command('search [query...]')
        .description('Search project abstraction toolkit entries by capability intent')
        .option('-l, --limit <count>', 'Maximum toolkit search results to show', '8')
        .option('--json', 'Emit machine-readable toolkit search results JSON')
        .option('--demand', 'Search using the latest recorded user demand when no query is provided')
        .action((queryParts: string[], options: MemorySearchCliOptions) => {
            try {
                const paths = prepareToolkitPaths();
                const query = resolveMemoryQuery(paths, queryParts, options);
                const artifact = ensureProjectAbsToolkit(paths, { force: false });
                const limit = Math.max(1, Number.parseInt(options.limit ?? '8', 10) || 8);
                const results = searchProjectAbsToolkit(artifact, query, limit);

                if (options.json) {
                    console.log(
                        JSON.stringify(
                            {
                                query,
                                toolkitFile: paths.projectAbsToolkitFile,
                                results
                            },
                            null,
                            2
                        )
                    );
                    return;
                }

                if (!query) {
                    printToolkitOverview(paths, artifact);
                    return;
                }

                if (results.length === 0) {
                    console.log(chalk.yellow(`[TriadMind] no toolkit hits for query: ${JSON.stringify(query)}`));
                    return;
                }

                console.log(chalk.green(`[TriadMind] toolkit hits for ${JSON.stringify(query)}:`));
                for (const result of results) {
                    console.log(
                        `${result.entry.name} | kind=${result.entry.kind} | score=${result.score.toFixed(2)} | taxonomy=${result.entry.category}/${result.entry.subcategory}`
                    );
                    console.log(`  ${result.entry.whyReusable}`);
                }
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] toolkit search failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    toolkit
        .command('export')
        .description('Export project abstraction toolkit markdown and directory tree')
        .action(() => {
            try {
                const paths = prepareToolkitPaths();
                const artifact = ensureProjectAbsToolkit(paths, { force: false });
                exportProjectAbsToolkitMarkdown(artifact, paths.projectAbsToolkitMarkdownFile);
                exportProjectAbsToolkitDirectory(artifact, paths.projectAbsToolkitDir);
                console.log(chalk.green(`[TriadMind] toolkit markdown exported: ${paths.projectAbsToolkitMarkdownFile}`));
                console.log(chalk.green(`[TriadMind] toolkit directory exported: ${paths.projectAbsToolkitDir}`));
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] toolkit export failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    toolkit
        .command('path')
        .description('Print toolkit artifact paths')
        .action(() => {
            const paths = prepareToolkitPaths();
            console.log(chalk.green(`[TriadMind] toolkit JSON: ${paths.projectAbsToolkitFile}`));
            console.log(chalk.green(`[TriadMind] toolkit markdown: ${paths.projectAbsToolkitMarkdownFile}`));
            console.log(chalk.green(`[TriadMind] toolkit directory: ${paths.projectAbsToolkitDir}`));
            console.log(chalk.green(`[TriadMind] toolkit whitelist: ${paths.projectAbsToolkitTaxonomyFile}`));
        });

    toolkit
        .command('reclassify <entryId> <category> <subcategory>')
        .description('Reclassify one toolkit entry into a taxonomy bucket (whitelist-enforced)')
        .action((entryId: string, category: string, subcategory: string) => {
            try {
                const paths = prepareToolkitPaths();
                const op: ToolkitReclassOp = {
                    entryId: entryId.trim(),
                    category: normalizeTaxonomyComponent(category),
                    subcategory: normalizeTaxonomyComponent(subcategory)
                };
                const message = reclassifyToolkitEntries(paths, [op], false);
                console.log(chalk.green(`[TriadMind] ${message}`));
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] toolkit reclassify failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    toolkit
        .command('reclassify-batch [triplets...]')
        .description('Reclassify multiple entries: <entryId> <category> <subcategory> ...')
        .action((triplets: string[]) => {
            try {
                const paths = prepareToolkitPaths();
                const ops = parseBatchReclassifyArgs(triplets);
                const message = reclassifyToolkitEntries(paths, ops, true);
                console.log(chalk.green(`[TriadMind] ${message}`));
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] toolkit reclassify-batch failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    registerToolkitWhitelistCommands(toolkit);
}

function registerToolkitWhitelistCommands(toolkit: Command) {
    const whitelist = toolkit.command('whitelist').description('Manage toolkit category/subcategory whitelist');

    whitelist
        .command('show')
        .description('Show current whitelist')
        .action(() => {
            const paths = prepareToolkitPaths();
            const whitelistArtifact = loadToolkitWhitelist(paths);
            if (!whitelistArtifact) {
                console.log(chalk.yellow(`[TriadMind] toolkit whitelist not configured: ${paths.projectAbsToolkitTaxonomyFile}`));
                return;
            }
            printToolkitWhitelist(paths, whitelistArtifact);
        });

    whitelist
        .command('path')
        .description('Print whitelist file path')
        .action(() => {
            const paths = prepareToolkitPaths();
            console.log(chalk.green(`[TriadMind] toolkit whitelist path: ${paths.projectAbsToolkitTaxonomyFile}`));
        });

    whitelist
        .command('add <category> <subcategory>')
        .description('Allow a category/subcategory pair for reclassification')
        .action((category: string, subcategory: string) => {
            try {
                const paths = prepareToolkitPaths();
                const whitelistArtifact = loadToolkitWhitelist(paths) || createEmptyWhitelist();
                const normalizedCategory = normalizeTaxonomyComponent(category);
                const normalizedSubcategory = normalizeTaxonomyComponent(subcategory);
                const current = new Set(whitelistArtifact.categories[normalizedCategory] || []);
                current.add(normalizedSubcategory);
                whitelistArtifact.categories[normalizedCategory] = Array.from(current).sort();
                saveToolkitWhitelist(paths, whitelistArtifact);
                console.log(
                    chalk.green(
                        `[TriadMind] whitelist updated: added ${normalizedCategory}/${normalizedSubcategory} -> ${paths.projectAbsToolkitTaxonomyFile}`
                    )
                );
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] whitelist add failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    whitelist
        .command('remove <category> <subcategory>')
        .description('Remove a category/subcategory pair from whitelist')
        .action((category: string, subcategory: string) => {
            try {
                const paths = prepareToolkitPaths();
                const whitelistArtifact = loadToolkitWhitelist(paths);
                if (!whitelistArtifact) {
                    console.log(chalk.yellow('[TriadMind] whitelist is not configured yet.'));
                    return;
                }

                const normalizedCategory = normalizeTaxonomyComponent(category);
                const normalizedSubcategory = normalizeTaxonomyComponent(subcategory);
                const current = new Set(whitelistArtifact.categories[normalizedCategory] || []);
                current.delete(normalizedSubcategory);

                if (current.size === 0) {
                    delete whitelistArtifact.categories[normalizedCategory];
                } else {
                    whitelistArtifact.categories[normalizedCategory] = Array.from(current).sort();
                }

                saveToolkitWhitelist(paths, whitelistArtifact);
                console.log(
                    chalk.green(
                        `[TriadMind] whitelist updated: removed ${normalizedCategory}/${normalizedSubcategory} -> ${paths.projectAbsToolkitTaxonomyFile}`
                    )
                );
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] whitelist remove failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    whitelist
        .command('clear')
        .description('Clear the whitelist file while keeping schema')
        .action(() => {
            try {
                const paths = prepareToolkitPaths();
                const whitelistArtifact = createEmptyWhitelist();
                saveToolkitWhitelist(paths, whitelistArtifact);
                console.log(chalk.green(`[TriadMind] whitelist cleared: ${paths.projectAbsToolkitTaxonomyFile}`));
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] whitelist clear failed: ${error.message}`));
                process.exitCode = 1;
            }
        });
}

function prepareToolkitPaths() {
    const paths = getWorkspacePaths(process.cwd());
    ensureTriadSpec(paths);

    if (!fs.existsSync(paths.mapFile)) {
        syncProjectTopology(paths);
    }

    ensureAbstractionMemory(paths, { force: false, autoSync: true });
    return paths;
}

function printToolkitOverview(paths: WorkspacePaths, artifact: ProjectAbsToolkitArtifact) {
    console.log(chalk.green(`[TriadMind] toolkit file: ${paths.projectAbsToolkitFile}`));
    console.log(chalk.green(`[TriadMind] toolkit markdown: ${paths.projectAbsToolkitMarkdownFile}`));
    console.log(chalk.green(`[TriadMind] toolkit directory: ${paths.projectAbsToolkitDir}`));
    console.log(
        chalk.green(
            `[TriadMind] promoted ${artifact.summary.promotedEntryCount}/${artifact.summary.scannedMemoryEntryCount} memory entries across ${artifact.summary.categoryCount} categories.`
        )
    );

    if (artifact.entries.length === 0) {
        console.log(chalk.yellow('[TriadMind] no toolkit entries promoted yet.'));
        return;
    }

    const topEntries = artifact.entries.slice(0, 8);
    for (const entry of topEntries) {
        console.log(
            `${entry.name} | kind=${entry.kind} | policy=${entry.reusePolicy} | taxonomy=${entry.category}/${entry.subcategory} | source=${entry.primarySourcePath}`
        );
    }
}

function reclassifyToolkitEntries(paths: WorkspacePaths, ops: ToolkitReclassOp[], batch: boolean) {
    if (ops.length === 0) {
        throw new Error('no reclassification operation was provided');
    }

    const whitelistArtifact = loadToolkitWhitelist(paths);
    if (!whitelistArtifact || Object.keys(whitelistArtifact.categories).length === 0) {
        throw new Error(
            `toolkit whitelist is not configured. Add allowed categories first with: triadmind memory toolkit whitelist add <category> <subcategory>`
        );
    }

    ops.forEach((op) => validateReclassifyAgainstWhitelist(op, whitelistArtifact));

    const artifact = ensureProjectAbsToolkit(paths, { force: false });
    const changes: string[] = [];

    for (const op of ops) {
        const entry = artifact.entries.find((item) => item.id === op.entryId || item.id.toLowerCase() === op.entryId.toLowerCase());
        if (!entry) {
            throw new Error(`toolkit entry not found: ${op.entryId}`);
        }

        const oldBucket = `${entry.category}/${entry.subcategory}`;
        entry.category = op.category;
        entry.subcategory = op.subcategory;
        entry.toolkitRelativeDir = `${op.category}/${op.subcategory}`;
        entry.toolkitDocPath = `${entry.toolkitRelativeDir}/${slugify(entry.id)}.md`;
        changes.push(`${entry.id}: ${oldBucket} -> ${entry.category}/${entry.subcategory}`);
    }

    artifact.summary = recalculateProjectAbsToolkitSummary(artifact, artifact.summary.scannedMemoryEntryCount);
    persistProjectAbsToolkit(paths, artifact);

    if (batch) {
        return `toolkit batch reclassified (${changes.length} entries)\n${changes.join('\n')}`;
    }
    return `toolkit entry reclassified\n${changes[0]}`;
}

function parseBatchReclassifyArgs(triplets: string[]) {
    if (!triplets || triplets.length === 0 || triplets.length % 3 !== 0) {
        throw new Error('Usage: triadmind memory toolkit reclassify-batch <entryId> <category> <subcategory> ...');
    }

    const ops: ToolkitReclassOp[] = [];
    for (let index = 0; index < triplets.length; index += 3) {
        const entryId = String(triplets[index] || '').trim();
        const category = normalizeTaxonomyComponent(String(triplets[index + 1] || ''));
        const subcategory = normalizeTaxonomyComponent(String(triplets[index + 2] || ''));
        if (!entryId) {
            throw new Error('reclassify-batch contains an empty entryId');
        }
        ops.push({ entryId, category, subcategory });
    }
    return ops;
}

function createEmptyWhitelist(): ToolkitWhitelistArtifact {
    return {
        schemaVersion: '1.0',
        categories: {}
    };
}

function loadToolkitWhitelist(paths: WorkspacePaths) {
    if (!fs.existsSync(paths.projectAbsToolkitTaxonomyFile)) {
        return undefined;
    }
    const raw = fs.readFileSync(paths.projectAbsToolkitTaxonomyFile, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ToolkitWhitelistArtifact>;
    const categories: Record<string, string[]> = {};

    for (const [category, subcategories] of Object.entries(parsed.categories || {})) {
        const normalizedCategory = normalizeTaxonomyComponent(category);
        const normalizedSubcategories = Array.from(
            new Set((subcategories || []).map((value) => normalizeTaxonomyComponent(value)).filter(Boolean))
        ).sort();
        if (normalizedSubcategories.length > 0) {
            categories[normalizedCategory] = normalizedSubcategories;
        }
    }

    return {
        schemaVersion: '1.0',
        categories
    } satisfies ToolkitWhitelistArtifact;
}

function saveToolkitWhitelist(paths: WorkspacePaths, whitelistArtifact: ToolkitWhitelistArtifact) {
    fs.mkdirSync(path.dirname(paths.projectAbsToolkitTaxonomyFile), { recursive: true });
    fs.writeFileSync(paths.projectAbsToolkitTaxonomyFile, JSON.stringify(whitelistArtifact, null, 2), 'utf-8');
}

function printToolkitWhitelist(paths: WorkspacePaths, whitelistArtifact: ToolkitWhitelistArtifact) {
    const categoryEntries = Object.entries(whitelistArtifact.categories);
    const categoryCount = categoryEntries.length;
    const subcategoryCount = categoryEntries.reduce((sum, [, subcategories]) => sum + subcategories.length, 0);
    console.log(chalk.green(`[TriadMind] whitelist path: ${paths.projectAbsToolkitTaxonomyFile}`));
    console.log(chalk.green(`[TriadMind] categories=${categoryCount}, subcategories=${subcategoryCount}`));
    if (categoryEntries.length === 0) {
        console.log(chalk.yellow('[TriadMind] whitelist is empty.'));
        return;
    }
    for (const [category, subcategories] of categoryEntries) {
        console.log(`${category} -> ${subcategories.join(', ')}`);
    }
}

function validateReclassifyAgainstWhitelist(op: ToolkitReclassOp, whitelistArtifact: ToolkitWhitelistArtifact) {
    const allowedSubcategories = whitelistArtifact.categories[op.category];
    if (!allowedSubcategories) {
        throw new Error(
            `category ${op.category} is not allowed. Add it first: triadmind memory toolkit whitelist add ${op.category} <subcategory>`
        );
    }
    if (!allowedSubcategories.includes(op.subcategory)) {
        throw new Error(`subcategory ${op.category}/${op.subcategory} is not allowed by toolkit whitelist`);
    }
}

function normalizeTaxonomyComponent(value: string) {
    const normalized = String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!normalized) {
        throw new Error(`invalid taxonomy component: ${value}`);
    }
    return normalized;
}

function slugify(value: string) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}
