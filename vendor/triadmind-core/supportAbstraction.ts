import { normalizePath } from './workspace';

export function isSupportAbstractionSourcePath(sourcePath: string) {
    const normalizedPath = normalizeSupportAbstractionPath(sourcePath);
    const fileName = normalizedPath.split('/').pop() ?? normalizedPath;
    return fileName.includes('support') || fileName.includes('helper');
}

export function isRootLevelSupportAbstractionSourcePath(sourcePath: string) {
    const normalizedPath = normalizeSupportAbstractionPath(sourcePath);
    if (!normalizedPath || normalizedPath.includes('/')) {
        return false;
    }

    return isSupportAbstractionSourcePath(normalizedPath);
}

function normalizeSupportAbstractionPath(sourcePath: string) {
    return normalizePath(String(sourcePath ?? ''))
        .replace(/^\.?\//, '')
        .replace(/\/+$/, '')
        .toLowerCase();
}
