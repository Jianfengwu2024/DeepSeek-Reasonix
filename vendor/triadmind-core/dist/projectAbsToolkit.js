"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncProjectAbsToolkitFromMemory = syncProjectAbsToolkitFromMemory;
exports.ensureProjectAbsToolkit = ensureProjectAbsToolkit;
exports.loadProjectAbsToolkit = loadProjectAbsToolkit;
exports.searchProjectAbsToolkit = searchProjectAbsToolkit;
exports.buildProjectAbsToolkitPromptContext = buildProjectAbsToolkitPromptContext;
exports.formatProjectAbsToolkitPromptJson = formatProjectAbsToolkitPromptJson;
exports.renderProjectAbsToolkitMarkdown = renderProjectAbsToolkitMarkdown;
exports.exportProjectAbsToolkitMarkdown = exportProjectAbsToolkitMarkdown;
exports.exportProjectAbsToolkitDirectory = exportProjectAbsToolkitDirectory;
exports.persistProjectAbsToolkit = persistProjectAbsToolkit;
exports.recalculateProjectAbsToolkitSummary = recalculateProjectAbsToolkitSummary;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const abstractionMemory_1 = require("./abstractionMemory");
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
function syncProjectAbsToolkitFromMemory(paths) {
    const memoryArtifact = (0, abstractionMemory_1.loadAbstractionMemory)(paths.abstractionMemoryFile);
    if (!memoryArtifact) {
        throw new Error(`abstraction memory not found: ${paths.abstractionMemoryFile}`);
    }
    const existing = loadProjectAbsToolkit(paths.projectAbsToolkitFile);
    const projectName = path.basename(paths.projectRoot);
    const artifact = buildProjectAbsToolkitArtifact(paths, memoryArtifact, existing, projectName);
    persistProjectAbsToolkit(paths, artifact);
    return artifact;
}
function ensureProjectAbsToolkit(paths, options = {}) {
    const existing = loadProjectAbsToolkit(paths.projectAbsToolkitFile);
    if (!options.force && existing) {
        return existing;
    }
    return syncProjectAbsToolkitFromMemory(paths);
}
function loadProjectAbsToolkit(filePath) {
    const result = (0, artifactReaders_1.readJsonObjectArtifactResult)(filePath);
    if (result.status !== 'ok' || !Array.isArray(result.value?.entries)) {
        return undefined;
    }
    return result.value;
}
function searchProjectAbsToolkit(artifact, query, limit = 10) {
    const terms = tokenize(query);
    if (terms.length === 0 || artifact.entries.length === 0) {
        return [];
    }
    const scored = artifact.entries
        .map((entry) => {
        const { score, matchedTerms } = scoreToolkitEntry(entry, terms);
        return {
            entry,
            score,
            matchedTerms
        };
    })
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score ||
        right.entry.reusabilityScore - left.entry.reusabilityScore ||
        left.entry.name.localeCompare(right.entry.name));
    const normalizedLimit = Math.min(50, Math.max(1, Math.floor(limit)));
    return scored.slice(0, normalizedLimit);
}
function buildProjectAbsToolkitPromptContext(paths, demand) {
    const artifact = ensureProjectAbsToolkitForPrompt(paths);
    if (!artifact || artifact.entries.length === 0) {
        return {
            summaryLines: [
                'Project abstraction toolkit has no promoted entries yet.',
                'Discipline: scan abstraction memory first and promote reusable abstractions before creating new ones.'
            ],
            matches: []
        };
    }
    const query = demand.trim();
    const matches = query ? searchProjectAbsToolkit(artifact, query, 6).map((item) => item.entry) : artifact.entries.slice(0, 6);
    const summaryLines = [
        `Project toolkit entries: ${artifact.summary.promotedEntryCount} (${artifact.summary.categoryCount} categories, ${artifact.summary.subcategoryCount} subcategories).`,
        'Reuse discipline: search toolkit first, prefer reuse_first entries, and justify any new abstraction that bypasses a close toolkit match.',
        matches.length > 0
            ? `Current toolkit candidates: ${matches.map((entry) => entry.name).join(', ')}`
            : 'No direct toolkit match for this demand; review top promoted entries before creating new abstractions.'
    ];
    return {
        summaryLines,
        matches
    };
}
function formatProjectAbsToolkitPromptJson(entries) {
    return JSON.stringify(entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        category: entry.category,
        subcategory: entry.subcategory,
        reusePolicy: entry.reusePolicy,
        stability: entry.stability,
        primarySourcePath: entry.primarySourcePath,
        reusabilityScore: entry.reusabilityScore,
        signatures: entry.signatures.slice(0, 4),
        whyReusable: entry.whyReusable
    })), null, 2);
}
function renderProjectAbsToolkitMarkdown(artifact) {
    const lines = [
        `# ${artifact.project} Project Abstraction Toolkit`,
        '',
        `- Generated: ${artifact.generatedAt}`,
        `- Source memory: ${artifact.sourceMemoryFile}`,
        `- Promoted entries: ${artifact.summary.promotedEntryCount}`,
        `- Categories: ${artifact.summary.categoryCount}`,
        `- Subcategories: ${artifact.summary.subcategoryCount}`,
        `- Reuse-first entries: ${artifact.summary.reuseFirstEntryCount}`,
        `- Stable entries: ${artifact.summary.stableEntryCount}`,
        '',
        '## Reuse Discipline',
        '',
        '1. Search the toolkit before creating a new abstract class or function.',
        '2. Prefer reuse_first entries when capability fit is close enough.',
        '3. If no entry fits, explain why before introducing new abstractions.',
        '',
        '## Toolkit Entries'
    ];
    if (artifact.entries.length === 0) {
        lines.push('', 'No promoted abstractions yet.');
        return lines.join('\n');
    }
    artifact.entries.forEach((entry, index) => {
        lines.push('', `### ${index + 1}. ${entry.name} [${entry.kind}]`, '', `- Status: ${entry.status}`, `- Reuse policy: ${entry.reusePolicy}`, `- Stability: ${entry.stability}`, `- Toolkit path: ${entry.category}/${entry.subcategory}`, `- Source: ${entry.primarySourcePath}`, `- Score: reuse=${entry.reusabilityScore.toFixed(2)}, abstraction=${entry.abstractionRatio.toFixed(2)}`, `- Intent: ${entry.intent}`, `- Why reusable: ${entry.whyReusable}`);
        if (entry.applicability.length > 0) {
            lines.push(`- Applicable when: ${entry.applicability.join('; ')}`);
        }
        if (entry.nonApplicability.length > 0) {
            lines.push(`- Avoid when: ${entry.nonApplicability.join('; ')}`);
        }
        if (entry.adaptationRules.length > 0) {
            lines.push(`- Adaptation rules: ${entry.adaptationRules.join('; ')}`);
        }
        if (entry.signatures.length > 0) {
            lines.push(`- Signature: ${entry.signatures[0]}`);
        }
        if (entry.examples.length > 0) {
            lines.push(`- Example: ${entry.examples.join('; ')}`);
        }
    });
    return lines.join('\n');
}
function exportProjectAbsToolkitMarkdown(artifact, markdownFile) {
    fs.mkdirSync(path.dirname(markdownFile), { recursive: true });
    fs.writeFileSync(markdownFile, renderProjectAbsToolkitMarkdown(artifact), 'utf-8');
}
function exportProjectAbsToolkitDirectory(artifact, toolkitDir) {
    if (fs.existsSync(toolkitDir)) {
        fs.rmSync(toolkitDir, { recursive: true, force: true });
    }
    fs.mkdirSync(toolkitDir, { recursive: true });
    fs.writeFileSync(path.join(toolkitDir, 'README.md'), renderProjectAbsToolkitMarkdown(artifact), 'utf-8');
    const grouped = groupEntriesByCategory(artifact.entries);
    for (const [category, subgroups] of grouped) {
        const categoryDir = path.join(toolkitDir, category);
        fs.mkdirSync(categoryDir, { recursive: true });
        fs.writeFileSync(path.join(categoryDir, 'README.md'), renderCategoryMarkdown(artifact, category, subgroups), 'utf-8');
        for (const [subcategory, entries] of subgroups) {
            const subcategoryDir = path.join(categoryDir, subcategory);
            fs.mkdirSync(subcategoryDir, { recursive: true });
            fs.writeFileSync(path.join(subcategoryDir, 'README.md'), renderSubcategoryMarkdown(artifact, category, subcategory, entries), 'utf-8');
            for (const entry of entries) {
                const docPath = path.join(toolkitDir, entry.toolkitDocPath);
                fs.mkdirSync(path.dirname(docPath), { recursive: true });
                fs.writeFileSync(docPath, renderEntryMarkdown(entry), 'utf-8');
            }
        }
    }
}
function persistProjectAbsToolkit(paths, artifact) {
    fs.mkdirSync(paths.triadDir, { recursive: true });
    fs.writeFileSync(paths.projectAbsToolkitFile, JSON.stringify(artifact, null, 2), 'utf-8');
    exportProjectAbsToolkitMarkdown(artifact, paths.projectAbsToolkitMarkdownFile);
    exportProjectAbsToolkitDirectory(artifact, paths.projectAbsToolkitDir);
}
function recalculateProjectAbsToolkitSummary(artifact, scannedMemoryEntryCount) {
    const categorySet = new Set();
    const subcategorySet = new Set();
    let reuseFirstEntryCount = 0;
    let stableEntryCount = 0;
    let canonicalEntryCount = 0;
    let experimentalEntryCount = 0;
    for (const entry of artifact.entries) {
        categorySet.add(entry.category);
        subcategorySet.add(`${entry.category}/${entry.subcategory}`);
        if (entry.reusePolicy === 'reuse_first') {
            reuseFirstEntryCount += 1;
        }
        if (entry.stability === 'stable' || entry.stability === 'canonical') {
            stableEntryCount += 1;
        }
        if (entry.stability === 'canonical') {
            canonicalEntryCount += 1;
        }
        if (entry.stability === 'experimental') {
            experimentalEntryCount += 1;
        }
    }
    return {
        scannedMemoryEntryCount: Math.max(0, Math.floor(scannedMemoryEntryCount ?? artifact.summary.scannedMemoryEntryCount ?? 0)),
        promotedEntryCount: artifact.entries.length,
        categoryCount: categorySet.size,
        subcategoryCount: subcategorySet.size,
        reuseFirstEntryCount,
        stableEntryCount,
        canonicalEntryCount,
        experimentalEntryCount
    };
}
function ensureProjectAbsToolkitForPrompt(paths) {
    const config = (0, config_1.loadTriadConfig)(paths);
    if (!config.abstractionMemory.enabled && !fs.existsSync(paths.projectAbsToolkitFile)) {
        return undefined;
    }
    if (fs.existsSync(paths.projectAbsToolkitFile)) {
        const artifact = loadProjectAbsToolkit(paths.projectAbsToolkitFile);
        if (artifact) {
            return artifact;
        }
    }
    if (!config.abstractionMemory.enabled) {
        return undefined;
    }
    (0, abstractionMemory_1.ensureAbstractionMemory)(paths, { autoSync: true });
    return ensureProjectAbsToolkit(paths, { force: true });
}
function buildProjectAbsToolkitArtifact(paths, memoryArtifact, existingArtifact, projectName) {
    const existingById = new Map(existingArtifact?.entries.map((entry) => [entry.id, entry]) ?? []);
    const entries = memoryArtifact.entries
        .filter((entry) => shouldPromoteMemoryEntry(entry))
        .map((entry) => buildToolkitEntryFromMemory(entry, existingById.get(entry.id)))
        .sort((left, right) => right.reusabilityScore - left.reusabilityScore ||
        right.abstractionRatio - left.abstractionRatio ||
        left.name.localeCompare(right.name));
    const artifact = {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        project: projectName,
        sourceMemoryFile: normalizePath(path.relative(paths.projectRoot, paths.abstractionMemoryFile)),
        sourceMapFile: memoryArtifact.sourceMapFile,
        summary: {
            scannedMemoryEntryCount: memoryArtifact.entries.length,
            promotedEntryCount: 0,
            categoryCount: 0,
            subcategoryCount: 0,
            reuseFirstEntryCount: 0,
            stableEntryCount: 0,
            canonicalEntryCount: 0,
            experimentalEntryCount: 0
        },
        entries
    };
    artifact.summary = recalculateProjectAbsToolkitSummary(artifact, memoryArtifact.entries.length);
    return artifact;
}
function buildToolkitEntryFromMemory(entry, existing) {
    const kind = toToolkitEntryKind(entry.kind);
    const defaultTaxonomy = deriveDefaultTaxonomy(kind);
    const category = sanitizeTaxonomyComponent(existing?.category || defaultTaxonomy.category);
    const subcategory = sanitizeTaxonomyComponent(existing?.subcategory || defaultTaxonomy.subcategory);
    const toolkitRelativeDir = `${category}/${subcategory}`;
    const toolkitDocPath = `${toolkitRelativeDir}/${slugify(entry.id)}.md`;
    return {
        id: entry.id,
        name: entry.name,
        kind,
        status: existing?.status || 'promoted',
        category,
        subcategory,
        toolkitRelativeDir,
        toolkitDocPath,
        sourceEntryId: entry.id,
        primarySourcePath: entry.primarySourcePath,
        sourcePaths: [...entry.sourcePaths],
        providerNodeIds: [...entry.providerNodeIds],
        consumerNodeIds: [...entry.consumerNodeIds],
        relatedAbstractions: [...entry.relatedAbstractions],
        signatures: [...entry.signatures],
        tags: [...entry.tags],
        abstractionRatio: entry.abstractionRatio,
        reusabilityScore: entry.reusabilityScore,
        whyReusable: entry.whyReusable,
        intent: existing?.intent || buildDefaultIntent(entry),
        reusePolicy: existing?.reusePolicy || deriveReusePolicy(kind),
        applicability: existing?.applicability?.length ? [...existing.applicability] : buildDefaultApplicability(entry),
        nonApplicability: existing?.nonApplicability?.length
            ? [...existing.nonApplicability]
            : ['Avoid forcing this abstraction when demand is one-off and local-only.'],
        adaptationRules: existing?.adaptationRules?.length
            ? [...existing.adaptationRules]
            : ['Keep contract surface stable and adapt via wrappers/adapters first.'],
        examples: existing?.examples?.length ? [...existing.examples] : buildDefaultExamples(entry),
        owner: existing?.owner || 'triadmind',
        stability: existing?.stability || deriveStability(entry),
        notes: existing?.notes || '',
        promotedAt: existing?.promotedAt || new Date().toISOString(),
        lastReviewedAt: existing?.lastReviewedAt
    };
}
function shouldPromoteMemoryEntry(entry) {
    if (entry.reusabilityScore < 10) {
        return false;
    }
    const topologyFootprint = entry.providerNodeIds.length + entry.consumerNodeIds.length + entry.nodeIds.length;
    return (topologyFootprint >= 2 ||
        entry.sourcePaths.length >= 2 ||
        entry.kind === 'interface_or_contract' ||
        entry.kind === 'abstract_class');
}
function buildDefaultIntent(entry) {
    return `Reuse ${entry.name} before creating new ${entry.kind === 'abstract_function' ? 'function contracts' : 'abstraction branches'}.`;
}
function buildDefaultApplicability(entry) {
    if (entry.kind === 'interface_or_contract') {
        return ['When new features need the same contract surface across implementations.'];
    }
    if (entry.kind === 'abstract_class') {
        return ['When behavior variants share base responsibilities and extension points.'];
    }
    if (entry.kind === 'abstract_function') {
        return ['When a function-level contract is repeated across nodes or modules.'];
    }
    if (entry.kind === 'abstraction_module') {
        return ['When demand belongs to the same abstraction-rich module context.'];
    }
    return ['When dependency contracts are already wired in upstream/downstream nodes.'];
}
function buildDefaultExamples(entry) {
    if (entry.signatures.length > 0) {
        return [entry.signatures[0]];
    }
    if (entry.primarySourcePath) {
        return [`See ${entry.primarySourcePath}`];
    }
    return [];
}
function deriveReusePolicy(kind) {
    if (kind === 'interface_or_contract' || kind === 'abstract_function') {
        return 'reuse_first';
    }
    if (kind === 'abstract_class' || kind === 'abstraction_module') {
        return 'reuse_with_adaptation';
    }
    return 'reference_only';
}
function deriveStability(entry) {
    const score = entry.reusabilityScore;
    if (score >= 30 && entry.sourcePaths.length >= 3) {
        return 'canonical';
    }
    if (score >= 20) {
        return 'stable';
    }
    if (score >= 12) {
        return 'candidate';
    }
    return 'experimental';
}
function deriveDefaultTaxonomy(kind) {
    switch (kind) {
        case 'interface_or_contract':
            return { category: 'architecture', subcategory: 'contracts' };
        case 'abstract_class':
            return { category: 'architecture', subcategory: 'base_classes' };
        case 'abstract_function':
            return { category: 'behavior', subcategory: 'function_signatures' };
        case 'contract_dependency':
            return { category: 'dependencies', subcategory: 'contract_usage' };
        case 'abstraction_module':
            return { category: 'modules', subcategory: 'abstraction_rich' };
    }
}
function toToolkitEntryKind(kind) {
    return kind;
}
function scoreToolkitEntry(entry, terms) {
    const haystack = buildToolkitSearchHaystack(entry);
    const matchedTerms = [];
    let score = 0;
    for (const term of terms) {
        if (haystack.includes(term)) {
            score += 1;
            matchedTerms.push(term);
        }
        else if (fuzzyContains(haystack, term)) {
            score += 0.5;
            matchedTerms.push(`~${term}`);
        }
    }
    score *= 1 + entry.reusabilityScore / 10;
    return { score, matchedTerms };
}
function buildToolkitSearchHaystack(entry) {
    return [
        entry.name,
        entry.kind,
        entry.category,
        entry.subcategory,
        entry.intent,
        entry.tags.join(' '),
        entry.signatures.join(' '),
        entry.applicability.join(' '),
        entry.nonApplicability.join(' '),
        entry.adaptationRules.join(' '),
        entry.primarySourcePath,
        entry.toolkitRelativeDir,
        entry.whyReusable
    ]
        .join(' ')
        .toLowerCase();
}
function tokenize(input) {
    return Array.from(new Set(String(input || '')
        .toLowerCase()
        .split(/[^a-z0-9_]+/g)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)));
}
function fuzzyContains(haystack, term) {
    return (haystack.includes(term.replace(/_/g, '')) ||
        haystack.includes(term.replace(/-/g, '')) ||
        haystack.includes(term.replace(/\s+/g, '')));
}
function groupEntriesByCategory(entries) {
    const grouped = new Map();
    for (const entry of entries) {
        const category = sanitizeTaxonomyComponent(entry.category);
        const subcategory = sanitizeTaxonomyComponent(entry.subcategory);
        const categoryMap = grouped.get(category) ?? new Map();
        const list = categoryMap.get(subcategory) ?? [];
        list.push(entry);
        categoryMap.set(subcategory, list);
        grouped.set(category, categoryMap);
    }
    return grouped;
}
function renderCategoryMarkdown(artifact, category, subgroups) {
    const lines = [`# ${artifact.project} Toolkit / ${category}`, '', `Subcategories: ${subgroups.size}`, '', '## Entries'];
    for (const [subcategory, entries] of subgroups) {
        lines.push('', `### ${subcategory}`, '');
        for (const entry of entries) {
            lines.push(`- [${entry.name}](${toPosixPath(path.join(subcategory, `${slugify(entry.id)}.md`))}) [${entry.kind}] policy=${entry.reusePolicy}`);
        }
    }
    return lines.join('\n');
}
function renderSubcategoryMarkdown(artifact, category, subcategory, entries) {
    const lines = [
        `# ${artifact.project} Toolkit / ${category} / ${subcategory}`,
        '',
        `Entry count: ${entries.length}`,
        '',
        '## Entries'
    ];
    for (const entry of entries) {
        lines.push('', `- [${entry.name}](${slugify(entry.id)}.md) [${entry.kind}] policy=${entry.reusePolicy}`);
    }
    return lines.join('\n');
}
function renderEntryMarkdown(entry) {
    const lines = [
        `# ${entry.name}`,
        '',
        `- id: ${entry.id}`,
        `- kind: ${entry.kind}`,
        `- status: ${entry.status}`,
        `- category: ${entry.category}`,
        `- subcategory: ${entry.subcategory}`,
        `- reuse_policy: ${entry.reusePolicy}`,
        `- stability: ${entry.stability}`,
        `- source: ${entry.primarySourcePath}`,
        `- reusability_score: ${entry.reusabilityScore.toFixed(2)}`,
        `- abstraction_ratio: ${entry.abstractionRatio.toFixed(2)}`,
        '',
        '## Intent',
        '',
        entry.intent,
        '',
        '## Why Reusable',
        '',
        entry.whyReusable
    ];
    if (entry.applicability.length > 0) {
        lines.push('', '## Applicable When', '', ...entry.applicability.map((item) => `- ${item}`));
    }
    if (entry.nonApplicability.length > 0) {
        lines.push('', '## Avoid When', '', ...entry.nonApplicability.map((item) => `- ${item}`));
    }
    if (entry.adaptationRules.length > 0) {
        lines.push('', '## Adaptation Rules', '', ...entry.adaptationRules.map((item) => `- ${item}`));
    }
    if (entry.signatures.length > 0) {
        lines.push('', '## Signatures', '', ...entry.signatures.map((item) => `- ${item}`));
    }
    if (entry.examples.length > 0) {
        lines.push('', '## Examples', '', ...entry.examples.map((item) => `- ${item}`));
    }
    if (entry.relatedAbstractions.length > 0) {
        lines.push('', '## Related Abstractions', '', ...entry.relatedAbstractions.map((item) => `- ${item}`));
    }
    return lines.join('\n');
}
function sanitizeTaxonomyComponent(value) {
    const slug = slugify(value);
    return slug || 'uncategorized';
}
function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}
function normalizePath(input) {
    return input.replace(/\\/g, '/');
}
function toPosixPath(input) {
    return normalizePath(input);
}
//# sourceMappingURL=projectAbsToolkit.js.map