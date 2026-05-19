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
exports.readTextIfExists = readTextIfExists;
exports.readRequiredTextFile = readRequiredTextFile;
exports.readSourceFileText = readSourceFileText;
exports.parseJsonText = parseJsonText;
exports.parseJsonTextStrict = parseJsonTextStrict;
exports.readJsonFileStrict = readJsonFileStrict;
exports.readJsonIfExists = readJsonIfExists;
exports.readJsonArrayArtifactResult = readJsonArrayArtifactResult;
exports.readJsonObjectArtifactResult = readJsonObjectArtifactResult;
exports.readTriadNodesArtifactResult = readTriadNodesArtifactResult;
exports.readRuntimeMapArtifactResult = readRuntimeMapArtifactResult;
exports.readRuntimeDiagnosticsArtifactResult = readRuntimeDiagnosticsArtifactResult;
exports.readTriadNodesArtifact = readTriadNodesArtifact;
exports.readRuntimeMapArtifact = readRuntimeMapArtifact;
exports.readRuntimeDiagnosticsArtifact = readRuntimeDiagnosticsArtifact;
exports.readDraftProtocolArtifact = readDraftProtocolArtifact;
exports.readMicroSplitArtifact = readMicroSplitArtifact;
exports.readVerifyBaselineArtifact = readVerifyBaselineArtifact;
exports.readChangedFilesArtifact = readChangedFilesArtifact;
const fs = __importStar(require("fs"));
function readTextIfExists(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
        return '';
    }
    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return options.trim ? content.trim() : content;
}
function readRequiredTextFile(filePath, options = {}) {
    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return options.trim ? content.trim() : content;
}
function readSourceFileText(filePath) {
    return readRequiredTextFile(filePath);
}
function parseJsonText(content) {
    if (!content.trim()) {
        return undefined;
    }
    try {
        return JSON.parse(content);
    }
    catch {
        return undefined;
    }
}
function parseJsonTextStrict(content) {
    return JSON.parse(content);
}
function readJsonFileStrict(filePath) {
    return parseJsonTextStrict(readRequiredTextFile(filePath));
}
function readJsonIfExists(filePath) {
    const result = readJsonArtifactResult(filePath);
    return result.status === 'ok' ? result.value : undefined;
}
function readJsonArrayArtifactResult(filePath) {
    const result = readJsonArtifactResult(filePath);
    if (result.status !== 'ok') {
        return result;
    }
    if (!Array.isArray(result.value)) {
        return {
            status: 'shape_invalid'
        };
    }
    return {
        status: 'ok',
        value: result.value
    };
}
function readJsonObjectArtifactResult(filePath) {
    const result = readJsonArtifactResult(filePath);
    if (result.status !== 'ok') {
        return result;
    }
    if (!result.value || typeof result.value !== 'object' || Array.isArray(result.value)) {
        return {
            status: 'shape_invalid'
        };
    }
    return {
        status: 'ok',
        value: result.value
    };
}
function readTriadNodesArtifactResult(filePath) {
    return readJsonArrayArtifactResult(filePath);
}
function readRuntimeMapArtifactResult(filePath) {
    const result = readJsonObjectArtifactResult(filePath);
    if (result.status !== 'ok') {
        return result;
    }
    const runtimeMap = result.value;
    if (!Array.isArray(runtimeMap.nodes) || !Array.isArray(runtimeMap.edges)) {
        return {
            status: 'shape_invalid'
        };
    }
    return {
        status: 'ok',
        value: runtimeMap
    };
}
function readRuntimeDiagnosticsArtifactResult(filePath) {
    const result = readJsonArtifactResult(filePath);
    if (result.status !== 'ok') {
        return result;
    }
    if (Array.isArray(result.value)) {
        return {
            status: 'ok',
            value: result.value
        };
    }
    if (result.value &&
        typeof result.value === 'object' &&
        Array.isArray(result.value.diagnostics)) {
        return {
            status: 'ok',
            value: (result.value.diagnostics ?? [])
        };
    }
    return {
        status: 'shape_invalid'
    };
}
function readTriadNodesArtifact(filePath) {
    const result = readTriadNodesArtifactResult(filePath);
    return result.value ?? [];
}
function readRuntimeMapArtifact(filePath) {
    const result = readRuntimeMapArtifactResult(filePath);
    return result.value;
}
function readRuntimeDiagnosticsArtifact(filePath) {
    const result = readRuntimeDiagnosticsArtifactResult(filePath);
    return result.value ?? [];
}
function readDraftProtocolArtifact(filePath) {
    const result = readJsonObjectArtifactResult(filePath);
    if (result.status !== 'ok') {
        return undefined;
    }
    return result.value;
}
function readMicroSplitArtifact(filePath) {
    const result = readJsonObjectArtifactResult(filePath);
    if (result.status !== 'ok') {
        return undefined;
    }
    return result.value;
}
function readVerifyBaselineArtifact(filePath) {
    const result = readJsonObjectArtifactResult(filePath);
    if (result.status !== 'ok' || !result.value) {
        return undefined;
    }
    const unmatched = Number(result.value.runtime_unmatched_route_count);
    if (!Number.isFinite(unmatched) || unmatched < 0) {
        return undefined;
    }
    return {
        runtime_unmatched_route_count: Math.floor(unmatched)
    };
}
function readChangedFilesArtifact(filePath) {
    const result = readJsonObjectArtifactResult(filePath);
    const files = result.status === 'ok' && result.value ? result.value.files : undefined;
    if (!Array.isArray(files)) {
        return [];
    }
    return files.filter((item) => typeof item === 'string' && item.trim().length > 0);
}
function readJsonArtifactResult(filePath) {
    if (!fs.existsSync(filePath)) {
        return {
            status: 'missing'
        };
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
        return {
            status: 'ok',
            value: JSON.parse(content)
        };
    }
    catch {
        return {
            status: 'parse_failed'
        };
    }
}
//# sourceMappingURL=artifactReaders.js.map