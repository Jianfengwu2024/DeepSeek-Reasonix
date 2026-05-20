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
exports.applyTypeScriptProtocol = applyTypeScriptProtocol;
const ts_morph_1 = require("ts-morph");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const generatorRightBranch_1 = require("./generatorRightBranch");
const workspace_1 = require("./workspace");
const protocol_1 = require("./protocol");
/**
 * TriadMind 自动生成骨架
 * 职责：执行 TypeScript protocol apply 流程
 */
function applyTypeScriptProtocol(projectRoot, protocolPath) {
    const resolvedProjectRoot = path.resolve(projectRoot);
    const resolvedProtocolPath = protocolPath ?? path.join(resolvedProjectRoot, '.triadmind', 'draft-protocol.json');
    const tsConfigFilePath = path.join(resolvedProjectRoot, 'tsconfig.json');
    if (!fs.existsSync(resolvedProtocolPath)) {
        throw new Error(`找不到协议文件：${resolvedProtocolPath}`);
    }
    if (!fs.existsSync(tsConfigFilePath)) {
        throw new Error(`找不到 tsconfig.json：${tsConfigFilePath}`);
    }
    const protocol = (0, protocol_1.readJsonFile)(resolvedProtocolPath);
    const triadMapPath = path.join(resolvedProjectRoot, '.triadmind', 'triad-map.json');
    const existingNodes = (0, protocol_1.readTriadMap)(triadMapPath);
    const config = (0, config_1.loadTriadConfig)((0, workspace_1.getWorkspacePaths)(resolvedProjectRoot));
    (0, protocol_1.assertProtocolShape)(protocol, {
        existingNodes,
        minConfidence: config.protocol.minConfidence,
        requireConfidence: config.protocol.requireConfidence
    });
    const project = new ts_morph_1.Project({
        tsConfigFilePath
    });
    const exportedTypeNames = getExportedTypeNames(project, resolvedProjectRoot);
    const nodeLocations = loadNodeLocations(resolvedProjectRoot);
    const changedFiles = new Set();
    for (const action of protocol.actions) {
        if (action.op === 'reuse') {
            continue;
        }
        if (action.op === 'create_child') {
            changedFiles.add(upsertNode(project, resolvedProjectRoot, action.node, exportedTypeNames, nodeLocations, action));
            continue;
        }
        if (action.op === 'modify') {
            changedFiles.add(upsertNode(project, resolvedProjectRoot, {
                nodeId: action.nodeId,
                category: action.category,
                sourcePath: action.sourcePath,
                fission: action.fission
            }, exportedTypeNames, nodeLocations, action));
        }
    }
    project.saveSync();
    const normalizedFiles = Array.from(changedFiles).map((filePath) => path.relative(resolvedProjectRoot, filePath));
    console.log(`[TriadMind] 协议执行完成，涉及 ${normalizedFiles.length} 个源码文件。`);
    return {
        changedFiles: normalizedFiles
    };
}
function upsertNode(project, projectRoot, node, exportedTypeNames, nodeLocations, action) {
    const ref = (0, protocol_1.parseNodeRef)(node.nodeId, node.category);
    const filePath = (0, generatorRightBranch_1.resolveSourceFilePath)(projectRoot, ref, node, nodeLocations);
    const sourceFile = project.getSourceFile(filePath) ?? project.createSourceFile(filePath, '', { overwrite: false });
    ensureTypeImports(projectRoot, sourceFile, exportedTypeNames, node);
    if ((0, generatorRightBranch_1.shouldUseTopLevelFunction)(sourceFile, ref, node.sourcePath)) {
        upsertFunctionVertex(sourceFile, ref, node, action);
    }
    else {
        upsertClassVertex(sourceFile, ref, node, action);
    }
    sourceFile.formatText({
        indentSize: 4
    });
    return filePath;
}
function upsertClassVertex(sourceFile, ref, node, action) {
    const cls = sourceFile.getClass(ref.className) ??
        sourceFile.addClass({
            name: ref.className,
            isExported: true
        });
    const existingMethod = cls.getMethod(ref.methodName);
    const parameters = (0, generatorRightBranch_1.buildParameters)(node.fission.demand);
    const returnType = (0, protocol_1.parseReturnType)(node.fission.answer[0] ?? 'void');
    if (!existingMethod) {
        cls.addMethod((0, generatorRightBranch_1.buildMethodStructure)(ref, node, parameters, returnType, action.op === 'create_child'));
    }
    else {
        syncMethod(existingMethod, parameters, returnType, node);
    }
}
function upsertFunctionVertex(sourceFile, ref, node, action) {
    const existingFunction = sourceFile.getFunction(ref.methodName);
    const parameters = (0, generatorRightBranch_1.buildParameters)(node.fission.demand);
    const returnType = (0, protocol_1.parseReturnType)(node.fission.answer[0] ?? 'void');
    if (!existingFunction) {
        sourceFile.addFunction((0, generatorRightBranch_1.buildFunctionStructure)(ref, node, parameters, returnType, action.op === 'create_child'));
    }
    else {
        syncFunction(existingFunction, parameters, returnType, node);
    }
}
function syncMethod(method, parameters, returnType, node) {
    const existingParameters = method.getParameters();
    for (let index = existingParameters.length - 1; index >= parameters.length; index -= 1) {
        existingParameters[index].remove();
    }
    parameters.forEach((parameter, index) => {
        const existing = method.getParameters()[index];
        if (!existing) {
            method.insertParameter(index, parameter);
            return;
        }
        existing.rename(parameter.name);
        existing.setType(parameter.type ?? 'unknown');
    });
    method.setReturnType(returnType);
    replaceDocs(method, node.fission.problem);
    if (method.getStatements().length === 0) {
        method.addStatements([(0, generatorRightBranch_1.buildTodoStatement)(node.nodeId, node.fission.problem)]);
    }
}
function syncFunction(fn, parameters, returnType, node) {
    const existingParameters = fn.getParameters();
    for (let index = existingParameters.length - 1; index >= parameters.length; index -= 1) {
        existingParameters[index].remove();
    }
    parameters.forEach((parameter, index) => {
        const existing = fn.getParameters()[index];
        if (!existing) {
            fn.insertParameter(index, parameter);
            return;
        }
        existing.rename(parameter.name);
        existing.setType(parameter.type ?? 'unknown');
    });
    fn.setReturnType(returnType);
    fn.setIsExported(true);
    replaceDocs(fn, node.fission.problem);
    if (fn.getStatements().length === 0) {
        fn.addStatements([(0, generatorRightBranch_1.buildTodoStatement)(node.nodeId, node.fission.problem)]);
    }
}
function ensureTypeImports(projectRoot, sourceFile, exportedTypeNames, node) {
    const referencedTypes = new Set();
    for (const demand of node.fission.demand) {
        const parsed = (0, protocol_1.parseDemandEntry)(demand, 0);
        if (parsed) {
            (0, generatorRightBranch_1.collectTypeTokens)(parsed.type).forEach((token) => referencedTypes.add(token));
        }
    }
    (0, generatorRightBranch_1.collectTypeTokens)((0, protocol_1.parseReturnType)(node.fission.answer[0] ?? 'void')).forEach((token) => referencedTypes.add(token));
    const typeImports = Array.from(referencedTypes).filter((token) => exportedTypeNames.has(token));
    if (typeImports.length === 0) {
        return;
    }
    const moduleSpecifier = (0, generatorRightBranch_1.resolveTypesModuleSpecifier)(projectRoot, sourceFile);
    removeStaleTypeImports(sourceFile, moduleSpecifier, typeImports);
    const existingImport = sourceFile.getImportDeclaration((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier);
    if (!existingImport) {
        sourceFile.addImportDeclaration({
            moduleSpecifier,
            namedImports: typeImports.sort()
        });
        return;
    }
    const existingNames = new Set(existingImport.getNamedImports().map((specifier) => specifier.getName()));
    typeImports
        .sort()
        .filter((name) => !existingNames.has(name))
        .forEach((name) => existingImport.addNamedImport(name));
}
function getExportedTypeNames(project, projectRoot) {
    const typesFilePath = path.join(projectRoot, 'src', 'types.ts');
    const sourceFile = project.getSourceFile(typesFilePath);
    const exported = new Set();
    if (!sourceFile) {
        return exported;
    }
    for (const [name] of sourceFile.getExportedDeclarations()) {
        exported.add(name);
    }
    return exported;
}
function loadNodeLocations(projectRoot) {
    const candidates = [
        path.join(projectRoot, '.triadmind', 'triad-map.json'),
        path.join(projectRoot, 'triad-map.json')
    ];
    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) {
            continue;
        }
        const nodes = (0, artifactReaders_1.readTriadNodesArtifact)(candidate);
        return nodes.reduce((result, item) => {
            if (item?.nodeId && item?.sourcePath) {
                result[item.nodeId] = item.sourcePath;
            }
            return result;
        }, {});
    }
    return {};
}
function replaceDocs(node, responsibility) {
    node.getJsDocs().forEach((doc) => doc.remove());
    node.addJsDoc({
        description: (0, generatorRightBranch_1.buildTriadGeneratedDoc)(responsibility)
    });
}
function removeStaleTypeImports(sourceFile, moduleSpecifier, typeImports) {
    const targetNames = new Set(typeImports);
    sourceFile
        .getImportDeclarations()
        .filter((declaration) => {
        const value = declaration.getModuleSpecifierValue();
        return value !== moduleSpecifier && value.includes('types');
    })
        .forEach((declaration) => {
        declaration
            .getNamedImports()
            .filter((specifier) => targetNames.has(specifier.getName()))
            .forEach((specifier) => specifier.remove());
        if (declaration.getNamedImports().length === 0 &&
            !declaration.getDefaultImport() &&
            !declaration.getNamespaceImport()) {
            declaration.remove();
        }
    });
}
if (require.main === module) {
    applyTypeScriptProtocol(process.argv[2] ?? process.cwd(), process.argv[3]);
}
//# sourceMappingURL=typescriptGenerator.js.map