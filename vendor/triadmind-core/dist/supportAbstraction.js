"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupportAbstractionSourcePath = isSupportAbstractionSourcePath;
exports.isRootLevelSupportAbstractionSourcePath = isRootLevelSupportAbstractionSourcePath;
const workspace_1 = require("./workspace");
function isSupportAbstractionSourcePath(sourcePath) {
    const normalizedPath = normalizeSupportAbstractionPath(sourcePath);
    const fileName = normalizedPath.split('/').pop() ?? normalizedPath;
    return fileName.includes('support') || fileName.includes('helper');
}
function isRootLevelSupportAbstractionSourcePath(sourcePath) {
    const normalizedPath = normalizeSupportAbstractionPath(sourcePath);
    if (!normalizedPath || normalizedPath.includes('/')) {
        return false;
    }
    return isSupportAbstractionSourcePath(normalizedPath);
}
function normalizeSupportAbstractionPath(sourcePath) {
    return (0, workspace_1.normalizePath)(String(sourcePath ?? ''))
        .replace(/^\.?\//, '')
        .replace(/\/+$/, '')
        .toLowerCase();
}
//# sourceMappingURL=supportAbstraction.js.map