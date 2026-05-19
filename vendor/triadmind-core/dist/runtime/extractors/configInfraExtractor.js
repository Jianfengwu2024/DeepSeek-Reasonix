"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configInfraExtractor = void 0;
const runtimeUtils_1 = require("../runtimeUtils");
exports.configInfraExtractor = {
    name: 'ConfigInfraExtractor',
    detect(context) {
        return (context.includeInfra &&
            context.files.some((file) => /(docker-compose\.ya?ml|dockerfile|\.env|pyproject\.toml|package\.json)/i.test(file.relativePath) ||
                /services:|REDIS_URL|POSTGRES|MONGO|MINIO|S3|QUEUE/i.test(file.content)));
    },
    extract(context) {
        const nodes = [];
        const edges = [];
        const diagnostics = [];
        if (!context.includeInfra) {
            return { nodes, edges, diagnostics };
        }
        for (const file of context.files) {
            const basename = file.relativePath.split('/').pop()?.toLowerCase() ?? '';
            if (basename === 'docker-compose.yml' || basename === 'docker-compose.yaml') {
                extractDockerCompose(file, nodes, diagnostics);
            }
            else if (basename === 'dockerfile') {
                nodes.push({
                    id: 'Config.Dockerfile',
                    type: 'Config',
                    label: 'Dockerfile',
                    sourcePath: file.relativePath,
                    category: 'infra',
                    evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'config', 'Dockerfile', 0, 0.8)]
                });
            }
            else if (/^\.env(\..+)?$/.test(basename)) {
                extractEnvFile(file, nodes, edges);
            }
            else if (basename === 'package.json') {
                extractPackageJson(file, nodes);
            }
            else if (basename === 'pyproject.toml') {
                extractPyProject(file, nodes);
            }
            else if (file.language === 'yaml' && /kind:\s*(Deployment|StatefulSet|CronJob|Service)/.test(file.content)) {
                extractKubernetes(file, nodes, diagnostics);
            }
        }
        return { nodes, edges, diagnostics };
    }
};
function extractDockerCompose(file, nodes, diagnostics) {
    const serviceBlocks = Array.from(file.content.matchAll(/^\s{2}([A-Za-z0-9._-]+):\s*$([\s\S]*?)(?=^\s{2}[A-Za-z0-9._-]+:\s*$|$)/gm));
    for (const match of serviceBlocks) {
        const serviceName = match[1];
        const block = match[2] ?? '';
        const node = inferInfraNodeFromService(serviceName, block, file.relativePath);
        if (!node) {
            diagnostics.push({
                level: 'info',
                code: 'RUNTIME_INFRA_SERVICE_SKIPPED_UNKNOWN_CATEGORY',
                extractor: 'ConfigInfraExtractor',
                message: `Skipped docker-compose service without known runtime category: ${serviceName}`,
                sourcePath: file.relativePath
            });
            continue;
        }
        nodes.push(node);
    }
}
function extractEnvFile(file, nodes, edges) {
    const envRegex = /^([A-Z0-9_]+)=(.+)$/gm;
    for (const match of file.content.matchAll(envRegex)) {
        const key = match[1];
        const value = match[2];
        const configId = (0, runtimeUtils_1.normalizeRuntimeId)(`Config.${key}`);
        nodes.push({
            id: configId,
            type: 'Config',
            label: key,
            sourcePath: file.relativePath,
            category: 'infra',
            metadata: { value },
            evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'env', match[0], match.index, 0.85)]
        });
        if (/_KEY|_SECRET|TOKEN|PASSWORD/i.test(key)) {
            const secretId = (0, runtimeUtils_1.normalizeRuntimeId)(`Secret.${key}`);
            nodes.push({
                id: secretId,
                type: 'Secret',
                label: key,
                sourcePath: file.relativePath,
                category: 'infra',
                evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'env', match[0], match.index, 0.85)]
            });
            edges.push({
                from: configId,
                to: secretId,
                type: 'uses_secret',
                confidence: 0.8,
                evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'env', match[0], match.index, 0.8)]
            });
        }
        const inferred = inferInfraNodeFromEnv(key, value, file.relativePath, match.index ?? 0, file.content);
        if (inferred) {
            nodes.push(inferred);
            edges.push({
                from: configId,
                to: inferred.id,
                type: 'connects',
                confidence: 0.65,
                evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'env', match[0], match.index, 0.65)]
            });
        }
    }
}
function extractPackageJson(file, nodes) {
    try {
        const parsed = JSON.parse(file.content);
        nodes.push({
            id: 'Config.PackageJson',
            type: 'Config',
            label: 'package.json',
            sourcePath: file.relativePath,
            category: 'infra',
            metadata: {
                scripts: Object.keys(parsed.scripts ?? {}),
                dependencies: Object.keys(parsed.dependencies ?? {})
            },
            evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'manifest', 'package.json', 0, 0.8)]
        });
    }
    catch {
        nodes.push({
            id: 'Config.PackageJson',
            type: 'Config',
            label: 'package.json',
            sourcePath: file.relativePath,
            category: 'infra',
            evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'manifest', 'package.json', 0, 0.5)]
        });
    }
}
function extractPyProject(file, nodes) {
    nodes.push({
        id: 'Config.PyProject',
        type: 'Config',
        label: 'pyproject.toml',
        sourcePath: file.relativePath,
        category: 'infra',
        evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'manifest', 'pyproject.toml', 0, 0.75)]
    });
}
function extractKubernetes(file, nodes, diagnostics) {
    const nameMatch = file.content.match(/metadata:\s*[\s\S]*?name:\s*([A-Za-z0-9._-]+)/);
    const kindMatch = file.content.match(/kind:\s*(Deployment|StatefulSet|CronJob|Service)/);
    const name = nameMatch?.[1] ?? 'k8s-resource';
    const kind = kindMatch?.[1] ?? 'Resource';
    nodes.push({
        id: (0, runtimeUtils_1.normalizeRuntimeId)(`Config.K8s.${kind}.${name}`),
        type: kind === 'CronJob' ? 'Scheduler' : 'Config',
        label: `${kind} ${name}`,
        sourcePath: file.relativePath,
        category: 'infra',
        evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'manifest', kindMatch?.[0] ?? kind, kindMatch?.index, 0.7)]
    });
    diagnostics.push({
        level: 'info',
        code: 'RUNTIME_INFRA_K8S_RESOURCE_CAPTURED',
        extractor: 'ConfigInfraExtractor',
        message: `Captured Kubernetes ${kind} ${name}`,
        sourcePath: file.relativePath
    });
}
function inferInfraNodeFromService(serviceName, block, sourcePath) {
    const lower = `${serviceName} ${block}`.toLowerCase();
    if (lower.includes('redis')) {
        return buildInfraNode('Cache.Redis', 'Cache', 'Redis', sourcePath);
    }
    if (lower.includes('postgres')) {
        return buildInfraNode('DataStore.Postgres', 'DataStore', 'Postgres', sourcePath);
    }
    if (lower.includes('mongo')) {
        return buildInfraNode('DataStore.Mongo', 'DataStore', 'MongoDB', sourcePath);
    }
    if (lower.includes('minio')) {
        return buildInfraNode('ObjectStore.MinIO', 'ObjectStore', 'MinIO', sourcePath);
    }
    if (lower.includes('rabbitmq') || lower.includes('amqp')) {
        return buildInfraNode('Queue.RabbitMQ', 'Queue', 'RabbitMQ', sourcePath);
    }
    return undefined;
}
function inferInfraNodeFromEnv(key, value, sourcePath, index, content) {
    const lower = `${key}=${value}`.toLowerCase();
    if (lower.includes('redis')) {
        return buildInfraNode('Cache.Redis', 'Cache', 'Redis', sourcePath, index, content);
    }
    if (lower.includes('postgres')) {
        return buildInfraNode('DataStore.Postgres', 'DataStore', 'Postgres', sourcePath, index, content);
    }
    if (lower.includes('mongo')) {
        return buildInfraNode('DataStore.Mongo', 'DataStore', 'MongoDB', sourcePath, index, content);
    }
    if (lower.includes('minio') || lower.includes('s3')) {
        return buildInfraNode('ObjectStore.MinIO', 'ObjectStore', 'MinIO', sourcePath, index, content);
    }
    if (lower.includes('queue') || lower.includes('amqp') || lower.includes('redis://')) {
        return buildInfraNode('Queue.Default', 'Queue', 'Queue', sourcePath, index, content);
    }
    return undefined;
}
function buildInfraNode(id, type, label, sourcePath, index = 0, content = '') {
    return {
        id,
        type,
        label,
        sourcePath,
        category: 'infra',
        evidence: [
            {
                sourcePath,
                line: content ? content.slice(0, index).split(/\r?\n/).length : undefined,
                column: 1,
                kind: 'config',
                text: label,
                confidence: 0.75
            }
        ]
    };
}
//# sourceMappingURL=configInfraExtractor.js.map