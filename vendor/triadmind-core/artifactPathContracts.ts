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
] as const;

export const INTERNAL_ARTIFACT_PATH_CONTRACT_TYPES = [...ARTIFACT_PATH_CONTRACT_TYPES];

const INTERNAL_ARTIFACT_PATH_CONTRACT_SET = new Set(
    INTERNAL_ARTIFACT_PATH_CONTRACT_TYPES.map((entry) => normalizeArtifactPathContractType(entry))
);

export function normalizeArtifactPathContractType(value: string) {
    return String(value ?? '')
        .trim()
        .replace(/^typing\./i, '')
        .replace(/\s+/g, '')
        .toLowerCase();
}

export function isArtifactPathContractType(value: string) {
    return INTERNAL_ARTIFACT_PATH_CONTRACT_SET.has(normalizeArtifactPathContractType(value));
}
