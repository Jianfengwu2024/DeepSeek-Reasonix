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
exports.getBuiltinTypeNames = getBuiltinTypeNames;
exports.resolveSourceFilePath = resolveSourceFilePath;
exports.buildParameters = buildParameters;
exports.buildMethodStructure = buildMethodStructure;
exports.buildFunctionStructure = buildFunctionStructure;
exports.shouldUseTopLevelFunction = shouldUseTopLevelFunction;
exports.collectTypeTokens = collectTypeTokens;
exports.normalizeToken = normalizeToken;
exports.resolveTypesModuleSpecifier = resolveTypesModuleSpecifier;
exports.buildTodoStatement = buildTodoStatement;
exports.buildTriadGeneratedDoc = buildTriadGeneratedDoc;
const ts_morph_1 = require("ts-morph");
const path = __importStar(require("path"));
const protocol_1 = require("./protocol");
const BUILTIN_TYPE_NAMES = new Set([
    'string',
    'number',
    'boolean',
    'void',
    'null',
    'undefined',
    'unknown',
    'any',
    'never',
    'object',
    'Array',
    'ReadonlyArray',
    'Promise',
    'Record',
    'Pick',
    'Omit',
    'Partial',
    'Required',
    'NonNullable',
    'ReturnType',
    'Parameters',
    'Date',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'Blob',
    'HTMLElement',
    'HTMLButtonElement',
    'HTMLDivElement',
    'HTMLCanvasElement',
    'MouseEvent'
]);
/**
 * @RightBranch
 */
function getBuiltinTypeNames() {
    return BUILTIN_TYPE_NAMES;
}
/**
 * @RightBranch
 */
function resolveSourceFilePath(projectRoot, ref, node, nodeLocations) {
    const explicitSourcePath = node.sourcePath?.trim();
    if (explicitSourcePath) {
        return path.join(projectRoot, explicitSourcePath);
    }
    const existingSourcePath = nodeLocations[node.nodeId] ?? nodeLocations[ref.normalizedNodeId];
    if (existingSourcePath) {
        return path.join(projectRoot, existingSourcePath);
    }
    const folder = ref.category === 'frontend' || ref.category === 'backend' ? ref.category : 'core';
    return path.join(projectRoot, 'src', folder, `${ref.className}.ts`);
}
/**
 * @RightBranch
 */
function buildParameters(demand) {
    return demand
        .map((entry, index) => (0, protocol_1.parseDemandEntry)(entry, index))
        .filter((entry) => Boolean(entry))
        .map((entry) => ({
        name: entry.name,
        type: entry.type
    }));
}
/**
 * @RightBranch
 */
function buildMethodStructure(ref, node, parameters, returnType, includeTodo) {
    const statements = includeTodo
        ? [`throw new Error(${JSON.stringify(`TODO: 实现 ${ref.normalizedNodeId}，职责：${node.fission.problem}`)});`]
        : [];
    return {
        name: ref.methodName,
        scope: ts_morph_1.Scope.Public,
        parameters,
        returnType,
        docs: [
            {
                description: `TriadMind 自动生成骨架\n职责：${node.fission.problem}`
            }
        ],
        statements
    };
}
/**
 * @RightBranch
 */
function buildFunctionStructure(ref, node, parameters, returnType, includeTodo) {
    const statements = includeTodo
        ? [`throw new Error(${JSON.stringify(`TODO: 实现 ${ref.normalizedNodeId}，职责：${node.fission.problem}`)});`]
        : [];
    return {
        name: ref.methodName,
        isExported: true,
        parameters,
        returnType,
        docs: [
            {
                description: `TriadMind 自动生成骨架\n职责：${node.fission.problem}`
            }
        ],
        statements
    };
}
/**
 * @RightBranch
 */
function shouldUseTopLevelFunction(sourceFile, ref, sourcePath) {
    const existingFunction = sourceFile.getFunction(ref.methodName);
    if (existingFunction?.isExported()) {
        return true;
    }
    if (sourceFile.getClass(ref.className)) {
        return false;
    }
    if (!sourcePath) {
        return false;
    }
    return normalizeToken(sourceFile.getBaseNameWithoutExtension()) === normalizeToken(ref.className);
}
/**
 * @RightBranch
 */
function collectTypeTokens(typeText) {
    const matches = typeText.match(/[A-Za-z_]\w*/g) ?? [];
    return matches.filter((token) => !getBuiltinTypeNames().has(token));
}
/**
 * @RightBranch
 */
function normalizeToken(value) {
    return value.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}
/**
 * @RightBranch
 */
function resolveTypesModuleSpecifier(projectRoot, sourceFile) {
    const sourceFilePath = sourceFile.getFilePath();
    const typesFilePath = path.join(projectRoot, 'src', 'types.ts');
    const relativePath = path.relative(path.dirname(sourceFilePath), typesFilePath);
    const withoutExtension = relativePath.replace(/\.ts$/, '');
    const normalized = withoutExtension.replace(/\\/g, '/');
    return normalized.startsWith('.') ? normalized : `./${normalized}`;
}
/**
 * @RightBranch
 */
function buildTodoStatement(nodeId, responsibility) {
    return `throw new Error(${JSON.stringify(`TODO: 实现 ${nodeId}，职责：${responsibility}`)});`;
}
/**
 * @RightBranch
 */
function buildTriadGeneratedDoc(responsibility) {
    return `TriadMind 自动生成骨架\n职责：${responsibility}`;
}
//# sourceMappingURL=generatorRightBranch.js.map