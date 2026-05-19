"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERNAL_ARTIFACT_PATH_CONTRACT_TYPES = void 0;
exports.normalizeArtifactPathContractType = normalizeArtifactPathContractType;
exports.isArtifactPathContractType = isArtifactPathContractType;
const ARTIFACT_PATH_CONTRACT_TYPES = [
    'WorkspacePaths',
    'TriadConfigPaths',
    'BootstrapPaths',
    'WorkflowPaths',
    'TriadizationPaths',
    'CoveragePaths',
    'ViewMapPaths',
    'VerifyPaths',
    'GovernPaths',
    'RuntimeArtifactPaths',
    'DreamPaths'
];
exports.INTERNAL_ARTIFACT_PATH_CONTRACT_TYPES = [...ARTIFACT_PATH_CONTRACT_TYPES];
const INTERNAL_ARTIFACT_PATH_CONTRACT_SET = new Set(exports.INTERNAL_ARTIFACT_PATH_CONTRACT_TYPES.map((entry) => normalizeArtifactPathContractType(entry)));
function normalizeArtifactPathContractType(value) {
    return String(value ?? '')
        .trim()
        .replace(/^typing\./i, '')
        .replace(/\s+/g, '')
        .toLowerCase();
}
function isArtifactPathContractType(value) {
    return INTERNAL_ARTIFACT_PATH_CONTRACT_SET.has(normalizeArtifactPathContractType(value));
}
//# sourceMappingURL=artifactPathContracts.js.map