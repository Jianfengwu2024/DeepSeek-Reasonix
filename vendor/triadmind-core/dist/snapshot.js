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
exports.createSnapshot = createSnapshot;
exports.listSnapshots = listSnapshots;
exports.restoreSnapshot = restoreSnapshot;
exports.collectProtocolSnapshotFiles = collectProtocolSnapshotFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const workspace_1 = require("./workspace");
function createSnapshot(paths, label, filePaths) {
    fs.mkdirSync(paths.snapshotDir, { recursive: true });
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${sanitizeLabel(label)}`;
    const uniqueFiles = Array.from(new Set(filePaths.map((filePath) => (0, workspace_1.normalizePath)(filePath)).filter(Boolean)));
    const snapshot = {
        id,
        label,
        createdAt: new Date().toISOString(),
        files: uniqueFiles.map((filePath) => readSnapshotFile(paths.projectRoot, filePath))
    };
    const snapshotPath = getSnapshotPath(paths, id);
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    updateSnapshotIndex(paths, snapshot);
    return snapshot;
}
function listSnapshots(paths) {
    const result = (0, artifactReaders_1.readJsonArrayArtifactResult)(paths.snapshotIndexFile);
    return result.value ?? [];
}
function restoreSnapshot(paths, snapshotId) {
    const id = snapshotId ?? listSnapshots(paths)[0]?.id;
    if (!id) {
        throw new Error('No snapshot found to restore');
    }
    const snapshotPath = getSnapshotPath(paths, id);
    if (!fs.existsSync(snapshotPath)) {
        throw new Error(`Snapshot file not found: ${snapshotPath}`);
    }
    const snapshotResult = (0, artifactReaders_1.readJsonObjectArtifactResult)(snapshotPath);
    if (snapshotResult.status !== 'ok' || !snapshotResult.value || !Array.isArray(snapshotResult.value.files)) {
        throw new Error(`Snapshot file is invalid: ${snapshotPath}`);
    }
    const snapshot = snapshotResult.value;
    for (const file of snapshot.files) {
        const absolutePath = path.join(paths.projectRoot, file.path);
        if (!file.exists) {
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
            continue;
        }
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, file.content, 'utf-8');
    }
    return snapshot;
}
function collectProtocolSnapshotFiles(paths, protocol) {
    const files = new Set([
        (0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.mapFile)),
        (0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.draftFile)),
        (0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.approvedProtocolFile)),
        (0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.handoffPromptFile)),
        (0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.lastApplyFilesFile))
    ]);
    const existingNodeSourceMap = readNodeSourceMap(paths.mapFile);
    for (const action of protocol.actions) {
        if (action.op === 'reuse') {
            continue;
        }
        if (action.op === 'modify') {
            const sourcePath = action.sourcePath ?? existingNodeSourceMap.get(action.nodeId);
            if (sourcePath) {
                files.add((0, workspace_1.normalizePath)(sourcePath));
            }
            continue;
        }
        if (action.node.sourcePath) {
            files.add((0, workspace_1.normalizePath)(action.node.sourcePath));
            continue;
        }
        const parentSourcePath = existingNodeSourceMap.get(action.parentNodeId);
        if (parentSourcePath) {
            files.add((0, workspace_1.normalizePath)(parentSourcePath));
        }
    }
    return Array.from(files);
}
function readSnapshotFile(projectRoot, filePath) {
    const absolutePath = path.join(projectRoot, filePath);
    const exists = fs.existsSync(absolutePath);
    return {
        path: filePath,
        exists,
        content: exists ? fs.readFileSync(absolutePath, 'utf-8') : ''
    };
}
function readNodeSourceMap(mapPath) {
    const result = new Map();
    const nodes = (0, artifactReaders_1.readTriadNodesArtifact)(mapPath);
    nodes.forEach((node) => {
        if (node.nodeId && node.sourcePath) {
            result.set(node.nodeId, node.sourcePath);
        }
    });
    return result;
}
function updateSnapshotIndex(paths, snapshot) {
    const index = listSnapshots(paths).filter((item) => item.id !== snapshot.id);
    index.unshift({
        id: snapshot.id,
        label: snapshot.label,
        createdAt: snapshot.createdAt
    });
    fs.mkdirSync(paths.snapshotDir, { recursive: true });
    fs.writeFileSync(paths.snapshotIndexFile, JSON.stringify(index.slice(0, 30), null, 2), 'utf-8');
}
function getSnapshotPath(paths, snapshotId) {
    return path.join(paths.snapshotDir, `${snapshotId}.json`);
}
function sanitizeLabel(label) {
    return label.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'snapshot';
}
//# sourceMappingURL=snapshot.js.map