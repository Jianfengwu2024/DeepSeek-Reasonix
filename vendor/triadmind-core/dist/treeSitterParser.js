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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTreeSitterParser = runTreeSitterParser;
exports.collectTreeSitterParseResult = collectTreeSitterParseResult;
exports.runTreeSitterTypeScriptParser = runTreeSitterTypeScriptParser;
exports.applyGhostDemandGovernance = applyGhostDemandGovernance;
exports.canonicalizeTriadNodes = canonicalizeTriadNodes;
const Parser = require("triadmind-tree-sitter");
const JavaScript = require("triadmind-tree-sitter-javascript");
const Python = require("triadmind-tree-sitter-python");
const Go = require("triadmind-tree-sitter-go");
const Rust = require("triadmind-tree-sitter-rust");
const Cpp = require("triadmind-tree-sitter-cpp");
const Java = require("triadmind-tree-sitter-java");
const TypeScript = require("triadmind-tree-sitter-typescript");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const artifactPathContracts_1 = require("./artifactPathContracts");
const supportAbstraction_1 = require("./supportAbstraction");
const treeSitterBindingSupport_1 = require("./treeSitterBindingSupport");
const treeSitterGhostScanner_1 = require("./treeSitterGhostScanner");
const treeSitterPythonSupport_1 = require("./treeSitterPythonSupport");
const treeSitterScanPlanSupport_1 = require("./treeSitterScanPlanSupport");
const workspace_1 = require("./workspace");
function createValueBinding(typeName) {
    return {
        typeName: normalizeTypeText(typeName || 'unknown')
    };
}
function createCallableBinding(displayName, returnType) {
    return {
        typeName: normalizeTypeText(displayName || 'unknown'),
        callableReturnType: normalizeTypeText(returnType || 'unknown')
    };
}
function createModuleBinding(typeName = 'module') {
    return {
        typeName: normalizeTypeText(typeName || 'module')
    };
}
function resolveBindingValueType(binding, fallbackName) {
    return normalizeTypeText(binding?.callableReturnType ?? binding?.typeName ?? guessBindingTypeFromName(fallbackName));
}
const TREE_SITTER_LANGUAGES = {
    typescript: TypeScript.typescript,
    javascript: JavaScript,
    python: Python,
    go: Go,
    rust: Rust,
    cpp: Cpp,
    java: Java
};
const FILE_PATTERNS = {
    typescript: /\.(ts|tsx|mts|cts)$/i,
    javascript: /\.(js|jsx|mjs|cjs)$/i,
    python: /\.py$/i,
    go: /\.go$/i,
    rust: /\.rs$/i,
    cpp: /\.(cpp|cc|cxx|hpp|hh|h)$/i,
    java: /\.java$/i
};
let ACTIVE_PARSER_CONFIG;
const TREE_SITTER_PARSER_BINDING_PROFILE = {
    identifierNodes: ['identifier', 'property_identifier', 'shorthand_property_identifier_pattern'],
    dedupe: false
};
function runTreeSitterParser(language, targetDir, outputPath, config) {
    const result = collectTreeSitterParseResult(language, targetDir, config);
    const leafOutputPath = resolveParserOutputPath(targetDir, config.parser.leafOutputFile);
    const capabilityOutputPath = resolveParserOutputPath(targetDir, config.parser.capabilityOutputFile);
    const diagnosticsOutputPath = path.resolve(targetDir, '.triadmind', 'triad-diagnostics.json');
    fs.mkdirSync(path.dirname(leafOutputPath), { recursive: true });
    fs.mkdirSync(path.dirname(capabilityOutputPath), { recursive: true });
    fs.mkdirSync(path.dirname(diagnosticsOutputPath), { recursive: true });
    fs.writeFileSync(leafOutputPath, JSON.stringify(result.leafNodes, null, 2), 'utf-8');
    fs.writeFileSync(capabilityOutputPath, JSON.stringify(result.projectedNodes, null, 2), 'utf-8');
    fs.writeFileSync(diagnosticsOutputPath, JSON.stringify(result.diagnostics, null, 2), 'utf-8');
    if ((0, workspace_1.normalizePath)(path.resolve(outputPath)) !== (0, workspace_1.normalizePath)(path.resolve(capabilityOutputPath))) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(result.projectedNodes, null, 2), 'utf-8');
    }
    console.log(chalk_1.default.gray(`   - [Parser] tree-sitter scan complete, extracted ${result.projectedNodes.length} ${result.scanUnit}; leaf-map has ${result.leafNodes.length} leaf nodes.`));
    if (config.parser.scanMode === 'capability' && result.projectedNodes.length > 300) {
        console.log(chalk_1.default.yellow('   - [Parser] capability graph is still dense; consider module/domain view for overview.'));
    }
}
function collectTreeSitterParseResult(language, targetDir, config) {
    ACTIVE_PARSER_CONFIG = config;
    console.log(chalk_1.default.gray(`   - [Parser] scanning ${language} via tree-sitter...`));
    const parser = new Parser();
    parser.setLanguage(TREE_SITTER_LANGUAGES[language]);
    const scanPlan = (0, treeSitterScanPlanSupport_1.createTreeSitterScanPlan)(config.parser);
    const leafGraph = [];
    const capabilityGraph = [];
    const files = collectSourceFiles(language, targetDir, config);
    const parsedFiles = [];
    const leafConfig = {
        ...config,
        parser: scanPlan.leafParserConfig
    };
    const architectureConfig = {
        ...config,
        parser: scanPlan.architectureParserConfig
    };
    for (const filePath of files) {
        let source;
        try {
            source = (0, artifactReaders_1.readSourceFileText)(filePath);
        }
        catch (error) {
            if ((0, config_1.isIgnorableFsError)(error)) {
                continue;
            }
            throw error;
        }
        const sourcePath = (0, workspace_1.normalizePath)(path.relative(targetDir, filePath));
        const tree = parseSourceFile(parser, source, sourcePath);
        parsedFiles.push({
            filePath,
            sourcePath,
            source,
            rootNode: tree.rootNode
        });
    }
    for (const parsedFile of parsedFiles) {
        const category = (0, config_1.resolveCategoryFromConfig)(parsedFile.sourcePath, config);
        leafGraph.push(...collectLanguageNodes(language, parsedFile.rootNode, parsedFile.source, parsedFile.filePath, parsedFile.sourcePath, category, leafConfig, parsedFiles));
        capabilityGraph.push(...collectLanguageNodes(language, parsedFile.rootNode, parsedFile.source, parsedFile.filePath, parsedFile.sourcePath, category, architectureConfig, parsedFiles));
    }
    const leafCanonical = canonicalizeTriadNodes(dedupeNodes(leafGraph).sort((left, right) => left.nodeId.localeCompare(right.nodeId)), config);
    const capabilityCanonical = canonicalizeTriadNodes(dedupeNodes(capabilityGraph).sort((left, right) => left.nodeId.localeCompare(right.nodeId)), config);
    const projectedCanonical = canonicalizeTriadNodes((scanPlan.useLeafProjection
        ? leafCanonical.nodes
        : aggregateNodesForScanMode(capabilityCanonical.nodes, architectureConfig).sort((left, right) => left.nodeId.localeCompare(right.nodeId))).map((node) => ({ ...node })), config);
    return {
        language,
        leafNodes: leafCanonical.nodes,
        capabilityNodes: capabilityCanonical.nodes,
        projectedNodes: projectedCanonical.nodes,
        diagnostics: dedupeParserDiagnostics([
            ...leafCanonical.diagnostics,
            ...capabilityCanonical.diagnostics,
            ...projectedCanonical.diagnostics
        ]),
        fileCount: files.length,
        scanUnit: scanPlan.scanUnit
    };
}
function resolveParserOutputPath(projectRoot, outputFile) {
    return path.resolve(projectRoot, outputFile);
}
function runTreeSitterTypeScriptParser(targetDir, outputPath, config) {
    runTreeSitterParser('typescript', targetDir, outputPath, config);
}
function parseSourceFile(parser, source, sourcePath) {
    try {
        return parser.parse(source, undefined, { bufferSize: Math.max(65536, source.length + 1) });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Tree-sitter failed to parse ${sourcePath}: ${message}`);
    }
}
function collectLanguageNodes(language, rootNode, source, filePath, sourcePath, category, config, parsedFiles) {
    switch (language) {
        case 'typescript':
            return collectTypeScriptNodes(rootNode, source, filePath, sourcePath, category, config, parsedFiles);
        case 'javascript':
            return collectJavaScriptNodes(rootNode, source, filePath, sourcePath, category, config, parsedFiles);
        case 'python':
            return collectPythonNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
        case 'go':
            return collectGoNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
        case 'rust':
            return collectRustNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
        case 'cpp':
            return collectCppNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
        case 'java':
            return collectJavaNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
    }
}
function collectTypeScriptNodes(rootNode, source, filePath, sourcePath, category, config, parsedFiles) {
    if (config.parser.scanMode === 'capability' || config.parser.scanMode === 'module' || config.parser.scanMode === 'domain') {
        return collectTypeScriptCapabilityNodes(rootNode, source, filePath, sourcePath, category, config, parsedFiles);
    }
    return collectTypeScriptLeafNodes(rootNode, source, filePath, sourcePath, category, config, parsedFiles);
}
function collectTypeScriptLeafNodes(rootNode, source, filePath, sourcePath, category, config, parsedFiles) {
    const triadGraph = [];
    const ghostContext = buildGhostBindingContext(rootNode, filePath, parsedFiles);
    const moduleName = toPascalCase(path.basename(filePath).replace(/\.(tsx?|mts|cts)$/, ''));
    const topLevelRecords = [
        ...collectTypeScriptTopLevelExecutableRecords(rootNode, moduleName, ghostContext, source, config),
        ...collectTypeScriptCliRegistrationRecords(rootNode, sourcePath, moduleName),
        ...collectTypeScriptApiRegistrationRecords(rootNode, sourcePath, moduleName)
    ];
    const abstractionContext = buildTypeScriptAbstractionContext(rootNode, topLevelRecords);
    for (const classNode of rootNode.descendantsOfType('class_declaration')) {
        const className = getNameText(classNode.childForFieldName('name'));
        const classBody = classNode.childForFieldName('body');
        if (!className || !classBody) {
            continue;
        }
        const classHasTriadTag = hasNearbyTriadTag(source, classNode.startIndex, config);
        const classPropertyTypes = collectTypeScriptClassPropertyTypes(classNode, ghostContext);
        for (const methodNode of classBody.namedChildren.filter((node) => node.type === 'method_definition')) {
            const methodName = getNameText(methodNode.childForFieldName('name'));
            if (!methodName || methodName === 'constructor' || hasModifier(methodNode, ['private', 'protected'])) {
                continue;
            }
            if (!config.parser.includeUntaggedExports &&
                !classHasTriadTag &&
                !hasNearbyTriadTag(source, methodNode.startIndex, config)) {
                continue;
            }
            const ghostDemand = collectTypeScriptGhostDemand(methodNode, ghostContext, classPropertyTypes);
            const demand = mergeDemandEntries(parseTsParameters(methodNode.childForFieldName('parameters')), ghostDemand);
            const answer = [
                normalizeGenericContractType(methodNode.childForFieldName('return_type')?.text.replace(/^:\s*/, '') ?? 'void')
            ];
            triadGraph.push(createTriadNode(`${className}.${methodName}`, category, sourcePath, demand, answer, undefined, [], buildTypeScriptAbstractionEvidence(abstractionContext, {
                ownerName: className,
                demand,
                answer
            })));
        }
    }
    for (const record of topLevelRecords) {
        triadGraph.push(createTriadNode(`${toPascalCase(record.ownerName || moduleName)}.${record.name}`, category, sourcePath, record.demand, record.answer, undefined, [], buildTypeScriptAbstractionEvidence(abstractionContext, {
            ownerName: record.ownerName,
            demand: record.demand,
            answer: record.answer
        })));
    }
    return triadGraph;
}
function buildGhostBindingContext(rootNode, filePath, parsedFiles) {
    return {
        importedBindings: collectTypeScriptImportedBindings(rootNode, filePath, parsedFiles),
        moduleBindings: collectTypeScriptModuleBindings(rootNode)
    };
}
function collectTypeScriptImportedBindings(rootNode, filePath, parsedFiles) {
    const bindings = new Map();
    for (const importNode of rootNode.descendantsOfType('import_statement')) {
        const modulePath = getImportModulePath(importNode);
        const targetFile = resolveImportedParsedFile(filePath, modulePath, parsedFiles);
        for (const importClause of importNode.namedChildren.filter((node) => node.type === 'import_clause')) {
            for (const child of importClause.namedChildren) {
                if (child.type === 'identifier') {
                    const localName = child.text;
                    bindings.set(localName, resolveImportedBindingInfo(targetFile, 'default', localName));
                    continue;
                }
                if (child.type === 'named_imports') {
                    for (const specifier of child.namedChildren.filter((node) => node.type === 'import_specifier')) {
                        const identifiers = specifier.namedChildren.filter((node) => node.type === 'identifier' || node.type === 'type_identifier');
                        const importedName = identifiers[0]?.text ?? '';
                        const localName = identifiers[identifiers.length - 1]?.text ?? importedName;
                        if (!localName) {
                            continue;
                        }
                        bindings.set(localName, resolveImportedBindingInfo(targetFile, importedName, localName));
                    }
                    continue;
                }
                if (child.type === 'namespace_import') {
                    const localName = getFirstNamedChildText(child, ['identifier']);
                    if (localName) {
                        bindings.set(localName, createModuleBinding());
                    }
                }
            }
        }
    }
    return bindings;
}
function collectTypeScriptModuleBindings(rootNode) {
    const bindings = new Map();
    for (const child of rootNode.namedChildren) {
        const declarationNode = child.type === 'export_statement' ? child.namedChildren[0] : child;
        if (!declarationNode) {
            continue;
        }
        if (declarationNode.type === 'lexical_declaration' || declarationNode.type === 'variable_declaration') {
            for (const declarator of declarationNode.namedChildren.filter((node) => node.type === 'variable_declarator')) {
                const nameNode = declarator.childForFieldName('name') ?? declarator.namedChildren[0];
                const localName = (0, treeSitterBindingSupport_1.extractBindingNames)(nameNode, TREE_SITTER_PARSER_BINDING_PROFILE)[0];
                if (!localName) {
                    continue;
                }
                bindings.set(localName, createValueBinding(inferTypeScriptDeclaratorType(declarator, localName, bindings)));
            }
            continue;
        }
        if (declarationNode.type === 'function_declaration') {
            const localName = getNameText(declarationNode.childForFieldName('name'));
            if (localName) {
                bindings.set(localName, createCallableBinding(localName, extractTypeScriptFunctionReturnType(declarationNode)));
            }
            continue;
        }
        if (declarationNode.type === 'class_declaration') {
            const localName = getNameText(declarationNode.childForFieldName('name'));
            if (localName) {
                bindings.set(localName, createValueBinding(localName));
            }
            continue;
        }
        if (declarationNode.type === 'enum_declaration') {
            const localName = getNameText(declarationNode.childForFieldName('name'));
            if (localName) {
                bindings.set(localName, createValueBinding(localName));
            }
        }
    }
    return bindings;
}
function collectTypeScriptClassPropertyTypes(classNode, ghostContext) {
    const propertyTypes = new Map();
    const classBody = classNode.childForFieldName('body');
    if (!classBody) {
        return propertyTypes;
    }
    for (const child of classBody.namedChildren.filter((node) => node.type === 'public_field_definition')) {
        const propertyName = getNameText(child.childForFieldName('name') ?? child.namedChildren[0]);
        if (!propertyName) {
            continue;
        }
        const explicitType = normalizeTypeAnnotationNode(child.childForFieldName('type') ?? child.namedChildren.find((node) => node.type === 'type_annotation') ?? null);
        if (explicitType && explicitType !== 'unknown') {
            propertyTypes.set(propertyName, explicitType);
            continue;
        }
        const valueNode = child.childForFieldName('value') ?? child.namedChildren[1] ?? null;
        propertyTypes.set(propertyName, inferTypeScriptValueType(valueNode, propertyName, ghostContext));
    }
    return propertyTypes;
}
function collectTypeScriptGhostDemand(executableNode, ghostContext, classPropertyTypes = new Map()) {
    const ghostStates = new Map();
    for (const reference of (0, treeSitterGhostScanner_1.scanTreeSitterGhostReferences)(executableNode)) {
        if (reference.kind === 'self') {
            const propertyName = reference.propertyName ?? reference.rootName;
            const typeName = classPropertyTypes.get(propertyName) ?? 'unknown';
            registerGhostState(ghostStates, reference.label, typeName, reference.mode);
            continue;
        }
        const binding = ghostContext.importedBindings.get(reference.rootName) ?? ghostContext.moduleBindings.get(reference.rootName);
        if (!binding) {
            continue;
        }
        registerGhostState(ghostStates, reference.label, binding.typeName, reference.mode);
    }
    return Array.from(ghostStates.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, state]) => {
        if (state.read && state.write) {
            return `[Ghost:ReadWrite] ${state.typeName} (${label})`;
        }
        if (state.write) {
            return `[Ghost:Write] ${state.typeName} (${label})`;
        }
        return `[Ghost:Read] ${state.typeName} (${label})`;
    });
}
function registerGhostState(ghostStates, label, typeName, mode) {
    const current = ghostStates.get(label) ?? {
        typeName: normalizeTypeText(typeName || 'unknown'),
        read: false,
        write: false
    };
    if (mode === 'read' || mode === 'readwrite') {
        current.read = true;
    }
    if (mode === 'write' || mode === 'readwrite') {
        current.write = true;
    }
    if (!current.typeName || current.typeName === 'unknown') {
        current.typeName = normalizeTypeText(typeName || 'unknown');
    }
    ghostStates.set(label, current);
}
function mergeDemandEntries(demand, ghostDemand) {
    const merged = [...demand];
    const seen = new Set(merged);
    for (const entry of ghostDemand) {
        if (!seen.has(entry)) {
            merged.push(entry);
            seen.add(entry);
        }
    }
    return merged;
}
function getImportModulePath(importNode) {
    const stringNode = importNode.namedChildren.find((node) => node.type === 'string');
    const fragment = stringNode?.namedChildren.find((node) => node.type === 'string_fragment');
    return fragment?.text ?? stringNode?.text.replace(/^['"]|['"]$/g, '') ?? '';
}
function resolveImportedParsedFile(currentFilePath, importPath, parsedFiles) {
    if (!importPath.startsWith('.')) {
        return undefined;
    }
    const basePath = path.resolve(path.dirname(currentFilePath), importPath);
    const candidates = [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.mts`,
        `${basePath}.cts`,
        path.join(basePath, 'index.ts'),
        path.join(basePath, 'index.tsx')
    ].map((candidate) => path.normalize(candidate));
    return parsedFiles.find((entry) => candidates.includes(path.normalize(entry.filePath)));
}
function resolveImportedBindingInfo(targetFile, importedName, localName) {
    if (!targetFile) {
        return createValueBinding(importedName || localName);
    }
    return lookupExportedBindingInfo(targetFile.rootNode, importedName || localName) ?? createValueBinding(importedName || localName);
}
function lookupExportedBindingInfo(rootNode, bindingName) {
    for (const child of rootNode.namedChildren.filter((node) => node.type === 'export_statement')) {
        const declarationNode = child.namedChildren[0];
        if (!declarationNode) {
            continue;
        }
        if (declarationNode.type === 'class_declaration') {
            const name = getNameText(declarationNode.childForFieldName('name'));
            if (name === bindingName || bindingName === 'default') {
                return createValueBinding(name || bindingName);
            }
        }
        if (declarationNode.type === 'function_declaration') {
            const name = getNameText(declarationNode.childForFieldName('name'));
            if (name === bindingName || bindingName === 'default') {
                return createCallableBinding(name || bindingName, extractTypeScriptFunctionReturnType(declarationNode));
            }
        }
        if (declarationNode.type === 'lexical_declaration' || declarationNode.type === 'variable_declaration') {
            for (const declarator of declarationNode.namedChildren.filter((node) => node.type === 'variable_declarator')) {
                const nameNode = declarator.childForFieldName('name') ?? declarator.namedChildren[0];
                const localName = (0, treeSitterBindingSupport_1.extractBindingNames)(nameNode, TREE_SITTER_PARSER_BINDING_PROFILE)[0];
                if (localName === bindingName || bindingName === 'default') {
                    return createValueBinding(inferTypeScriptDeclaratorType(declarator, localName || bindingName));
                }
            }
        }
    }
    return undefined;
}
function inferTypeScriptDeclaratorType(declarator, fallbackName, ghostContext) {
    const explicitType = normalizeTypeAnnotationNode(declarator.childForFieldName('type') ?? declarator.namedChildren.find((node) => node.type === 'type_annotation') ?? null);
    if (explicitType && explicitType !== 'unknown') {
        return explicitType;
    }
    const valueNode = declarator.childForFieldName('value') ?? declarator.namedChildren[1] ?? null;
    return inferTypeScriptValueType(valueNode, fallbackName, ghostContext instanceof Map
        ? { importedBindings: new Map(), moduleBindings: ghostContext }
        : ghostContext);
}
function inferTypeScriptValueType(valueNode, fallbackName, ghostContext) {
    if (!valueNode) {
        return guessBindingTypeFromName(fallbackName);
    }
    if (valueNode.type === 'object') {
        return inferTypeScriptObjectType(valueNode, ghostContext);
    }
    if (valueNode.type === 'array') {
        return 'unknown[]';
    }
    if (valueNode.type === 'string' || valueNode.type === 'template_string') {
        return 'string';
    }
    if (valueNode.type === 'number') {
        return 'number';
    }
    if (valueNode.type === 'true' || valueNode.type === 'false') {
        return 'boolean';
    }
    if (valueNode.type === 'identifier') {
        const identifierType = ghostContext?.importedBindings.get(valueNode.text)?.typeName ??
            ghostContext?.moduleBindings.get(valueNode.text)?.typeName;
        return identifierType ?? guessBindingTypeFromName(valueNode.text);
    }
    if (valueNode.type === 'call_expression') {
        const calleeNode = valueNode.namedChildren[0] ?? null;
        const calleeName = getNameText(calleeNode);
        if (calleeName) {
            const binding = ghostContext?.importedBindings.get(calleeName) ??
                ghostContext?.moduleBindings.get(calleeName);
            if (binding) {
                return resolveBindingValueType(binding, calleeName);
            }
        }
        return guessBindingTypeFromName(calleeName || fallbackName);
    }
    if (valueNode.type === 'member_expression') {
        const rootName = getNameText(valueNode.namedChildren[0] ?? null);
        const propertyName = getNameText(valueNode.namedChildren[1] ?? null);
        const binding = ghostContext?.importedBindings.get(rootName) ??
            ghostContext?.moduleBindings.get(rootName);
        if (binding && binding.typeName !== 'module') {
            return binding.typeName;
        }
        return guessBindingTypeFromName(propertyName || rootName || fallbackName);
    }
    if (valueNode.type === 'new_expression') {
        const constructorNode = valueNode.namedChildren.find((node) => node.type === 'identifier' || node.type === 'type_identifier' || node.type === 'member_expression');
        return normalizeTypeText(getNameText(constructorNode) || fallbackName);
    }
    return guessBindingTypeFromName(fallbackName);
}
function inferTypeScriptObjectType(objectNode, ghostContext) {
    const fields = [];
    for (const child of objectNode.namedChildren) {
        if (child.type === 'pair') {
            const keyNode = child.namedChildren[0];
            const valueNode = child.namedChildren[1] ?? null;
            const key = getNameText(keyNode);
            if (!key) {
                continue;
            }
            fields.push(`${key}: ${inferTypeScriptValueType(valueNode, key, ghostContext)}`);
            continue;
        }
        if (child.type === 'method_definition') {
            const methodName = getNameText(child.childForFieldName('name') ?? child.namedChildren[0]);
            const parameters = formatTypeScriptParameterSignature(child.childForFieldName('parameters'));
            const returnType = normalizeTypeAnnotationNode(child.childForFieldName('return_type') ?? child.namedChildren.find((node) => node.type === 'type_annotation') ?? null);
            if (methodName) {
                fields.push(`${methodName}(${parameters}): ${returnType || 'unknown'}`);
            }
        }
    }
    return fields.length > 0 ? `{ ${fields.join('; ')} }` : 'object';
}
function extractTypeScriptFunctionReturnType(functionNode) {
    return normalizeTypeText(functionNode.childForFieldName('return_type')?.text.replace(/^:\s*/, '') ?? 'unknown');
}
function formatTypeScriptParameterSignature(parametersNode) {
    if (!parametersNode) {
        return '';
    }
    return parametersNode.namedChildren
        .map((child, index) => {
        const nameNode = child.childForFieldName('pattern') ?? child.childForFieldName('name') ?? child.namedChildren[0] ?? null;
        const typeNode = child.childForFieldName('type') ?? child.namedChildren.find((node) => node.type === 'type_annotation') ?? null;
        const name = getNameText(nameNode) || `input${index + 1}`;
        const typeName = normalizeTypeAnnotationNode(typeNode) || 'unknown';
        return `${name}: ${typeName}`;
    })
        .join(', ');
}
function normalizeTypeAnnotationNode(node) {
    if (!node) {
        return '';
    }
    return normalizeTypeText(node.text.replace(/^:\s*/, '').trim());
}
function guessBindingTypeFromName(name) {
    if (/^[A-Z]/.test(name)) {
        return name;
    }
    return normalizeTypeText(name || 'unknown');
}
function collectJavaScriptNodes(rootNode, source, filePath, sourcePath, category, config, parsedFiles) {
    if (config.parser.scanMode === 'capability' || config.parser.scanMode === 'module' || config.parser.scanMode === 'domain') {
        return collectJavaScriptCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
    }
    return collectJavaScriptLeafNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
}
function collectJavaScriptLeafNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(filePath).replace(/\.(jsx?|mjs|cjs)$/, ''));
    const ghostContext = buildJavaScriptGhostContext(rootNode, filePath, parsedFiles);
    for (const classNode of rootNode.descendantsOfType('class_declaration')) {
        const className = getNameText(classNode.childForFieldName('name'));
        const classBody = classNode.childForFieldName('body');
        if (!className || !classBody) {
            continue;
        }
        const classPropertyTypes = collectJavaScriptClassPropertyTypes(classNode, ghostContext);
        for (const methodNode of classBody.namedChildren.filter((node) => node.type === 'method_definition')) {
            const methodName = getNameText(methodNode.childForFieldName('name'));
            if (!methodName || methodName === 'constructor') {
                continue;
            }
            const ghostDemand = collectTypeScriptGhostDemand(methodNode, ghostContext, classPropertyTypes);
            triadGraph.push(createTriadNode(`${className}.${methodName}`, category, sourcePath, mergeDemandEntries(parseJsParameters(methodNode.childForFieldName('parameters')), ghostDemand), ['unknown']));
        }
    }
    const topLevelNodes = config.parser.includeUntaggedExports
        ? rootNode.namedChildren
        : rootNode.namedChildren.filter((node) => node.type === 'export_statement');
    const topLevelRecords = [
        ...topLevelNodes.flatMap((node) => collectJavaScriptTopLevelCapabilityRecords(node, rootNode, moduleName, ghostContext)),
        ...collectJavaScriptCliRegistrationRecords(rootNode, sourcePath, moduleName),
        ...collectJavaScriptApiRegistrationRecords(rootNode, sourcePath, moduleName)
    ];
    for (const record of topLevelRecords) {
        triadGraph.push(createTriadNode(`${toPascalCase(record.ownerName || moduleName)}.${record.name}`, category, sourcePath, record.demand, record.answer));
    }
    return triadGraph;
}
function buildJavaScriptGhostContext(rootNode, filePath, parsedFiles) {
    return {
        importedBindings: collectJavaScriptImportedBindings(rootNode, filePath, parsedFiles),
        moduleBindings: collectJavaScriptModuleBindings(rootNode)
    };
}
function collectJavaScriptImportedBindings(rootNode, filePath, parsedFiles) {
    const bindings = new Map();
    for (const importNode of rootNode.descendantsOfType('import_statement')) {
        const modulePath = getImportModulePath(importNode);
        const targetFile = resolveImportedParsedFile(filePath, modulePath, parsedFiles);
        for (const importClause of importNode.namedChildren.filter((node) => node.type === 'import_clause')) {
            for (const child of importClause.namedChildren) {
                if (child.type === 'identifier') {
                    const localName = child.text;
                    bindings.set(localName, resolveJavaScriptImportedBindingInfo(targetFile, 'default', localName));
                    continue;
                }
                if (child.type === 'named_imports') {
                    for (const specifier of child.namedChildren.filter((node) => node.type === 'import_specifier')) {
                        const identifiers = specifier.namedChildren.filter((node) => node.type === 'identifier');
                        const importedName = identifiers[0]?.text ?? '';
                        const localName = identifiers[identifiers.length - 1]?.text ?? importedName;
                        if (!localName) {
                            continue;
                        }
                        bindings.set(localName, resolveJavaScriptImportedBindingInfo(targetFile, importedName, localName));
                    }
                    continue;
                }
                if (child.type === 'namespace_import') {
                    const localName = getFirstNamedChildText(child, ['identifier']);
                    if (localName) {
                        bindings.set(localName, createModuleBinding());
                    }
                }
            }
        }
    }
    for (const requireCall of rootNode.descendantsOfType('call_expression')) {
        if (requireCall.namedChildren[0]?.text !== 'require') {
            continue;
        }
        const parent = requireCall.parent;
        if (!parent || parent.type !== 'variable_declarator') {
            continue;
        }
        const nameNode = parent.childForFieldName('name') ?? parent.namedChildren[0] ?? null;
        const localNames = (0, treeSitterBindingSupport_1.extractBindingNames)(nameNode, TREE_SITTER_PARSER_BINDING_PROFILE);
        if (localNames.length === 0) {
            continue;
        }
        const modulePath = requireCall.namedChildren.find((node) => node.type === 'arguments')?.namedChildren[0]?.text.replace(/^['"]|['"]$/g, '') ?? '';
        const targetFile = resolveImportedParsedFile(filePath, modulePath, parsedFiles);
        for (const localName of localNames) {
            bindings.set(localName, resolveJavaScriptImportedBindingInfo(targetFile, localName, localName));
        }
    }
    return bindings;
}
function collectJavaScriptModuleBindings(rootNode) {
    const bindings = new Map();
    for (const child of rootNode.namedChildren) {
        const declarationNode = child.type === 'export_statement' ? child.namedChildren[0] : child;
        if (!declarationNode) {
            continue;
        }
        if (declarationNode.type === 'lexical_declaration' || declarationNode.type === 'variable_declaration') {
            for (const declarator of declarationNode.namedChildren.filter((node) => node.type === 'variable_declarator')) {
                const nameNode = declarator.childForFieldName('name') ?? declarator.namedChildren[0];
                const localName = (0, treeSitterBindingSupport_1.extractBindingNames)(nameNode, TREE_SITTER_PARSER_BINDING_PROFILE)[0];
                if (!localName) {
                    continue;
                }
                bindings.set(localName, createValueBinding(inferJavaScriptDeclaratorType(declarator, localName, bindings)));
            }
            continue;
        }
        if (declarationNode.type === 'function_declaration') {
            const localName = getNameText(declarationNode.childForFieldName('name'));
            if (localName) {
                bindings.set(localName, createCallableBinding(localName, 'unknown'));
            }
            continue;
        }
        if (declarationNode.type === 'class_declaration') {
            const localName = getNameText(declarationNode.childForFieldName('name'));
            if (localName) {
                bindings.set(localName, createValueBinding(localName));
            }
        }
    }
    return bindings;
}
function collectJavaScriptClassPropertyTypes(classNode, ghostContext) {
    const propertyTypes = new Map();
    const classBody = classNode.childForFieldName('body');
    if (!classBody) {
        return propertyTypes;
    }
    for (const child of classBody.namedChildren.filter((node) => node.type === 'field_definition' || node.type === 'public_field_definition')) {
        const propertyName = getNameText(child.childForFieldName('name') ?? child.namedChildren[0]);
        if (!propertyName) {
            continue;
        }
        const valueNode = child.childForFieldName('value') ?? child.namedChildren[1] ?? null;
        propertyTypes.set(propertyName, inferJavaScriptValueType(valueNode, propertyName, ghostContext));
    }
    return propertyTypes;
}
function resolveJavaScriptImportedBindingInfo(targetFile, importedName, localName) {
    if (!targetFile) {
        return createValueBinding(importedName || localName);
    }
    return (lookupJavaScriptExportedBindingInfo(targetFile.rootNode, importedName || localName) ??
        createValueBinding(importedName || localName));
}
function lookupJavaScriptExportedBindingInfo(rootNode, bindingName) {
    for (const child of rootNode.namedChildren.filter((node) => node.type === 'export_statement')) {
        const declarationNode = child.namedChildren[0];
        if (!declarationNode) {
            continue;
        }
        if (declarationNode.type === 'class_declaration') {
            const name = getNameText(declarationNode.childForFieldName('name'));
            if (name === bindingName || bindingName === 'default') {
                return createValueBinding(name || bindingName);
            }
        }
        if (declarationNode.type === 'function_declaration') {
            const name = getNameText(declarationNode.childForFieldName('name'));
            if (name === bindingName || bindingName === 'default') {
                return createCallableBinding(name || bindingName, 'unknown');
            }
        }
        if (declarationNode.type === 'lexical_declaration' || declarationNode.type === 'variable_declaration') {
            for (const declarator of declarationNode.namedChildren.filter((node) => node.type === 'variable_declarator')) {
                const nameNode = declarator.childForFieldName('name') ?? declarator.namedChildren[0];
                const localName = (0, treeSitterBindingSupport_1.extractBindingNames)(nameNode, TREE_SITTER_PARSER_BINDING_PROFILE)[0];
                if (localName === bindingName || bindingName === 'default') {
                    return createValueBinding(inferJavaScriptDeclaratorType(declarator, localName || bindingName));
                }
            }
        }
    }
    return undefined;
}
function inferJavaScriptDeclaratorType(declarator, fallbackName, ghostContext) {
    const valueNode = declarator.childForFieldName('value') ?? declarator.namedChildren[1] ?? null;
    return inferJavaScriptValueType(valueNode, fallbackName, ghostContext instanceof Map
        ? { importedBindings: new Map(), moduleBindings: ghostContext }
        : ghostContext);
}
function inferJavaScriptValueType(valueNode, fallbackName, ghostContext) {
    return inferTypeScriptValueType(valueNode, fallbackName, ghostContext);
}
function collectPythonNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    if (config.parser.scanMode === 'capability' || config.parser.scanMode === 'module' || config.parser.scanMode === 'domain') {
        return collectPythonCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
    }
    return collectPythonLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles);
}
function collectPythonLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(sourcePath).replace(/\.py$/, ''));
    const ghostContext = buildPythonGhostContext(rootNode, filePath, parsedFiles);
    for (const node of rootNode.namedChildren) {
        const classNode = (0, treeSitterPythonSupport_1.unwrapPythonDefinition)(node, 'class_definition');
        if (classNode) {
            const className = getNameText(classNode.childForFieldName('name'));
            const classBody = classNode.childForFieldName('body');
            if (!className || !classBody) {
                continue;
            }
            const classPropertyTypes = collectPythonClassPropertyTypes(classNode, ghostContext);
            for (const methodNode of (0, treeSitterPythonSupport_1.getPythonFunctionDefinitions)(classBody)) {
                const methodName = getNameText(methodNode.childForFieldName('name'));
                if (!methodName || methodName === '__init__') {
                    continue;
                }
                const ghostDemand = collectPythonGhostDemand(methodNode, ghostContext, classPropertyTypes);
                triadGraph.push(createTriadNode(`${className}.${methodName}`, category, sourcePath, mergeDemandEntries(parsePythonParametersAst(methodNode.childForFieldName('parameters')), ghostDemand), [extractPythonReturnType(methodNode)]));
            }
            continue;
        }
        const functionNode = (0, treeSitterPythonSupport_1.unwrapPythonDefinition)(node, 'function_definition');
        if (functionNode) {
            const functionName = getNameText(functionNode.childForFieldName('name'));
            if (!functionName || functionName.startsWith('_')) {
                continue;
            }
            const ghostDemand = collectPythonGhostDemand(functionNode, ghostContext);
            triadGraph.push(createTriadNode(`${moduleName}.${functionName}`, category, sourcePath, mergeDemandEntries(parsePythonParametersAst(functionNode.childForFieldName('parameters')), ghostDemand), [extractPythonReturnType(functionNode)]));
        }
    }
    for (const record of collectPythonCliRegistrationRecords(rootNode, sourcePath, moduleName)) {
        triadGraph.push(createTriadNode(`${toPascalCase(record.ownerName || moduleName)}.${record.name}`, category, sourcePath, record.demand, record.answer));
    }
    return triadGraph;
}
function collectTypeScriptCapabilityNodes(rootNode, source, filePath, sourcePath, category, config, parsedFiles) {
    const triadGraph = [];
    const ghostContext = buildGhostBindingContext(rootNode, filePath, parsedFiles);
    const moduleName = toPascalCase(path.basename(filePath).replace(/\.(tsx?|mts|cts)$/, ''));
    const topLevelRecords = [
        ...collectTypeScriptTopLevelExecutableRecords(rootNode, moduleName, ghostContext, source, config),
        ...collectTypeScriptCliRegistrationRecords(rootNode, sourcePath, moduleName),
        ...collectTypeScriptApiRegistrationRecords(rootNode, sourcePath, moduleName)
    ];
    const abstractionContext = buildTypeScriptAbstractionContext(rootNode, topLevelRecords);
    for (const classNode of rootNode.descendantsOfType('class_declaration')) {
        triadGraph.push(...collectTypeScriptClassCapabilityNodes(classNode, source, sourcePath, category, config, ghostContext, abstractionContext));
    }
    const promotableTopLevel = topLevelRecords.filter((record) => !isTypeScriptNoiseCapability(record.name, config, sourcePath, record));
    const promotedTopLevel = promotableTopLevel.filter((record) => shouldPromoteTypeScriptCapability(record.name, sourcePath, record.ownerName, record.isExported, config, record));
    for (const record of promotedTopLevel) {
        triadGraph.push(createTriadNode(`${toPascalCase(record.ownerName || moduleName)}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${toPascalCase(record.ownerName || moduleName)}.${record.name} capability`, [], buildTypeScriptAbstractionEvidence(abstractionContext, {
            ownerName: record.ownerName,
            demand: record.demand,
            answer: record.answer
        })));
    }
    const moduleAggregateRecords = promotableTopLevel.length > 0
        ? promotableTopLevel
        : shouldCreateSupportModuleAggregate(sourcePath, topLevelRecords)
            ? topLevelRecords
            : [];
    if (triadGraph.length === 0 && moduleAggregateRecords.length > 0) {
        triadGraph.push(createTriadNode(`${moduleName}.module_pipeline`, category, sourcePath, mergeCapabilityDemand(moduleAggregateRecords.map((record) => record.demand)), mergeCapabilityAnswer(moduleAggregateRecords.map((record) => record.answer)), `execute ${moduleName} module capability`, [], buildTypeScriptAbstractionEvidence(abstractionContext, {
            ownerName: moduleName,
            demand: mergeCapabilityDemand(moduleAggregateRecords.map((record) => record.demand)),
            answer: mergeCapabilityAnswer(moduleAggregateRecords.map((record) => record.answer))
        })));
    }
    return triadGraph;
}
function buildTypeScriptAbstractionContext(rootNode, topLevelRecords) {
    const interfaceNodes = rootNode.descendantsOfType('interface_declaration');
    const interfaceNames = new Set(interfaceNodes
        .map((node) => getNameText(node.childForFieldName('name')))
        .filter(Boolean));
    const typeAliasNodes = rootNode
        .descendantsOfType('type_alias_declaration')
        .filter((node) => isTypeScriptContractAliasNode(node));
    const typeAliasNames = new Set(typeAliasNodes
        .map((node) => getNameText(node.childForFieldName('name')))
        .filter(Boolean));
    const abstractClassNodes = rootNode.descendantsOfType('abstract_class_declaration');
    const abstractClassNames = new Set(abstractClassNodes
        .map((node) => getNameText(node.childForFieldName('name')))
        .filter(Boolean));
    const abstractFunctions = dedupeStringEntries([
        ...interfaceNodes.flatMap((node) => collectTypeScriptInterfaceFunctionContracts(node)),
        ...typeAliasNodes.flatMap((node) => collectTypeScriptTypeAliasFunctionContracts(node)),
        ...abstractClassNodes.flatMap((node) => collectTypeScriptAbstractClassFunctionContracts(node))
    ]);
    const concreteClassNodes = rootNode.descendantsOfType('class_declaration');
    const publicMethodCount = concreteClassNodes.reduce((count, classNode) => {
        const classBody = classNode.childForFieldName('body');
        if (!classBody) {
            return count;
        }
        return (count +
            classBody.namedChildren.filter((node) => {
                if (node.type !== 'method_definition') {
                    return false;
                }
                const methodName = getNameText(node.childForFieldName('name'));
                return Boolean(methodName) && methodName !== 'constructor' && !hasModifier(node, ['private', 'protected']);
            }).length);
    }, 0);
    const classVariantClusters = detectTypeScriptClassVariantClusters(concreteClassNodes
        .map((node) => getNameText(node.childForFieldName('name')))
        .filter(Boolean));
    const concreteClassProfiles = new Map();
    for (const classNode of concreteClassNodes) {
        const className = getNameText(classNode.childForFieldName('name'));
        if (!className) {
            continue;
        }
        const heritage = classNode.namedChildren.find((node) => node.type === 'class_heritage');
        const implementsNames = heritage
            ? heritage.namedChildren
                .filter((node) => node.type === 'implements_clause')
                .flatMap((node) => extractTypeScriptHeritageTypeNames(node))
            : [];
        const extendsAbstract = heritage
            ? heritage.namedChildren
                .filter((node) => node.type === 'extends_clause')
                .flatMap((node) => extractTypeScriptHeritageTypeNames(node))
                .filter((name) => abstractClassNames.has(name))
            : [];
        concreteClassProfiles.set(className, {
            className,
            implements: dedupeStringEntries(implementsNames),
            extendsAbstract: dedupeStringEntries(extendsAbstract),
            variantCluster: classVariantClusters.get(className)
        });
    }
    const interfaceCount = interfaceNames.size;
    const typeAliasCount = typeAliasNames.size;
    const abstractClassCount = abstractClassNames.size;
    const concreteClassCount = concreteClassProfiles.size;
    const topLevelExecutableCount = topLevelRecords.length;
    return {
        interfaceNames,
        typeAliasNames,
        abstractClassNames,
        abstractTypeNames: new Set([...interfaceNames, ...typeAliasNames, ...abstractClassNames]),
        abstractFunctions,
        concreteClassProfiles,
        abstractionSignalCount: interfaceCount + typeAliasCount + abstractClassCount,
        functionContractCount: abstractFunctions.length,
        concreteSignalCount: concreteClassCount + publicMethodCount + topLevelExecutableCount,
        interfaceCount,
        typeAliasCount,
        abstractClassCount,
        concreteClassCount,
        publicMethodCount,
        topLevelExecutableCount
    };
}
function buildTypeScriptAbstractionEvidence(context, options) {
    const ownerName = String(options.ownerName ?? '').trim();
    const profile = ownerName ? context.concreteClassProfiles.get(ownerName) : undefined;
    const dependsOnAbstractions = resolveReferencedTypeNames([...(options.demand ?? []), ...(options.answer ?? [])], context.abstractTypeNames);
    const signals = new Set();
    if (context.interfaceCount > 0) {
        signals.add('interface_declaration');
    }
    if (context.typeAliasCount > 0) {
        signals.add('type_contract');
    }
    if (context.abstractClassCount > 0) {
        signals.add('abstract_class');
    }
    if ((profile?.implements?.length ?? 0) > 0) {
        signals.add('implements_contract');
    }
    if ((profile?.extendsAbstract?.length ?? 0) > 0) {
        signals.add('extends_abstract');
    }
    if ((profile?.variantCluster ?? '').trim()) {
        signals.add('variant_member');
    }
    if (dependsOnAbstractions.length > 0) {
        signals.add('depends_on_contract');
    }
    if (context.functionContractCount > 0) {
        signals.add('abstract_function');
    }
    let role = 'unknown';
    if (profile) {
        role = 'concrete';
    }
    else if (context.abstractionSignalCount > 0 && context.concreteSignalCount > 0) {
        role = 'mixed';
    }
    else if (context.abstractionSignalCount > 0) {
        role = 'abstraction';
    }
    else if (context.concreteSignalCount > 0) {
        role = 'concrete';
    }
    return {
        role,
        signals: Array.from(signals).sort(),
        implements: profile?.implements ?? [],
        extendsAbstract: profile?.extendsAbstract ?? [],
        dependsOnAbstractions,
        abstractFunctions: context.abstractFunctions,
        variantCluster: profile?.variantCluster,
        abstractionSignalCount: context.abstractionSignalCount,
        functionContractCount: context.functionContractCount,
        concreteSignalCount: context.concreteSignalCount,
        interfaceCount: context.interfaceCount,
        abstractClassCount: context.abstractClassCount,
        typeAliasCount: context.typeAliasCount,
        concreteClassCount: context.concreteClassCount,
        publicMethodCount: context.publicMethodCount,
        topLevelExecutableCount: context.topLevelExecutableCount
    };
}
function collectTypeScriptInterfaceFunctionContracts(interfaceNode) {
    const interfaceName = getNameText(interfaceNode.childForFieldName('name'));
    if (!interfaceName) {
        return [];
    }
    const contracts = [];
    const bodyNode = interfaceNode.childForFieldName('body') ?? interfaceNode.namedChildren.find((node) => node.type === 'object_type');
    for (const child of bodyNode?.namedChildren ?? []) {
        const contract = formatTypeScriptContractSignatureChild(child, interfaceName);
        if (contract) {
            contracts.push(contract);
        }
    }
    return dedupeStringEntries(contracts);
}
function collectTypeScriptTypeAliasFunctionContracts(typeAliasNode) {
    const aliasName = getNameText(typeAliasNode.childForFieldName('name'));
    if (!aliasName) {
        return [];
    }
    const typeNode = typeAliasNode.namedChildren.find((child) => child.type !== 'type_identifier');
    if (!typeNode) {
        return [];
    }
    if (typeNode.type === 'function_type' || typeNode.type === 'constructor_type') {
        return [formatTypeScriptFunctionTypeSignature(aliasName, typeNode)];
    }
    if (typeNode.type === 'object_type') {
        return dedupeStringEntries(typeNode.namedChildren
            .map((child) => formatTypeScriptContractSignatureChild(child, aliasName))
            .filter(Boolean));
    }
    if (typeNode.type === 'union_type' || typeNode.type === 'intersection_type') {
        return dedupeStringEntries(typeNode.namedChildren
            .flatMap((child) => {
            if (child.type === 'function_type' || child.type === 'constructor_type') {
                return [formatTypeScriptFunctionTypeSignature(aliasName, child)];
            }
            if (child.type === 'object_type') {
                return child.namedChildren
                    .map((entry) => formatTypeScriptContractSignatureChild(entry, aliasName))
                    .filter(Boolean);
            }
            return [];
        }));
    }
    return [];
}
function collectTypeScriptAbstractClassFunctionContracts(classNode) {
    const className = getNameText(classNode.childForFieldName('name'));
    if (!className) {
        return [];
    }
    const bodyNode = classNode.childForFieldName('body');
    const contracts = [];
    for (const child of bodyNode?.namedChildren ?? []) {
        if (child.type === 'abstract_method_signature') {
            const methodName = getNameText(child.childForFieldName('name') ?? child.namedChildren[0]);
            if (!methodName || methodName === 'constructor') {
                continue;
            }
            const parameters = formatTypeScriptParameterSignature(child.childForFieldName('parameters'));
            const returnType = normalizeTypeAnnotationNode(child.childForFieldName('return_type') ??
                child.namedChildren.find((node) => node.type === 'type_annotation') ??
                null);
            contracts.push(`${className}.${methodName}(${parameters}): ${returnType || 'unknown'}`);
            continue;
        }
        if (child.type !== 'method_definition' || !hasModifier(child, ['abstract'])) {
            continue;
        }
        const methodName = getNameText(child.childForFieldName('name') ?? child.namedChildren[0]);
        if (!methodName || methodName === 'constructor') {
            continue;
        }
        const parameters = formatTypeScriptParameterSignature(child.childForFieldName('parameters'));
        const returnType = normalizeTypeAnnotationNode(child.childForFieldName('return_type') ??
            child.namedChildren.find((node) => node.type === 'type_annotation') ??
            null);
        contracts.push(`${className}.${methodName}(${parameters}): ${returnType || 'unknown'}`);
    }
    return dedupeStringEntries(contracts);
}
function formatTypeScriptContractSignatureChild(child, ownerName) {
    if (child.type === 'method_signature') {
        const methodName = getNameText(child.childForFieldName('name') ?? child.namedChildren[0]);
        const parameters = formatTypeScriptParameterSignature(child.childForFieldName('parameters'));
        const returnType = normalizeTypeAnnotationNode(child.childForFieldName('return_type') ??
            child.namedChildren.find((node) => node.type === 'type_annotation') ??
            null);
        return methodName ? `${ownerName}.${methodName}(${parameters}): ${returnType || 'unknown'}` : '';
    }
    if (child.type === 'call_signature') {
        const parameters = formatTypeScriptParameterSignature(child.childForFieldName('parameters'));
        const returnType = normalizeTypeAnnotationNode(child.childForFieldName('return_type') ??
            child.namedChildren.find((node) => node.type === 'type_annotation') ??
            null);
        return `${ownerName}(${parameters}): ${returnType || 'unknown'}`;
    }
    if (child.type === 'construct_signature') {
        const parameters = formatTypeScriptParameterSignature(child.childForFieldName('parameters'));
        const returnType = normalizeTypeAnnotationNode(child.childForFieldName('return_type') ??
            child.namedChildren.find((node) => node.type === 'type_annotation') ??
            null);
        return `new ${ownerName}(${parameters}): ${returnType || ownerName}`;
    }
    if (child.type === 'property_signature') {
        const propertyName = getNameText(child.childForFieldName('name') ?? child.namedChildren[0]);
        const functionTypeNode = child.namedChildren.find((node) => node.type === 'function_type' || node.type === 'constructor_type');
        if (!propertyName || !functionTypeNode) {
            return '';
        }
        return formatTypeScriptFunctionTypeSignature(`${ownerName}.${propertyName}`, functionTypeNode);
    }
    return '';
}
function formatTypeScriptFunctionTypeSignature(name, functionTypeNode) {
    const parameters = formatTypeScriptParameterSignature(functionTypeNode.childForFieldName('parameters'));
    const returnType = normalizeTypeAnnotationNode(functionTypeNode.childForFieldName('return_type') ??
        functionTypeNode.namedChildren.find((node) => node.type === 'type_annotation') ??
        null);
    return `${name}(${parameters}): ${returnType || 'unknown'}`;
}
function isTypeScriptContractAliasNode(node) {
    const typeNode = node.namedChildren.find((child) => child.type !== 'type_identifier');
    if (!typeNode) {
        return false;
    }
    if (typeNode.type === 'function_type' || typeNode.type === 'constructor_type') {
        return true;
    }
    if (typeNode.type === 'parenthesized_type') {
        const inner = typeNode.namedChildren[0] ?? null;
        return Boolean(inner) && isTypeScriptContractLikeType(inner);
    }
    return isTypeScriptContractLikeType(typeNode);
}
function isTypeScriptContractLikeType(node) {
    if (node.type === 'function_type' || node.type === 'constructor_type') {
        return true;
    }
    if (node.type === 'object_type') {
        return node.namedChildren.some((child) => {
            if (child.type === 'method_signature' ||
                child.type === 'call_signature' ||
                child.type === 'construct_signature') {
                return true;
            }
            if (child.type !== 'property_signature') {
                return false;
            }
            return child.namedChildren.some((entry) => entry.type === 'function_type');
        });
    }
    if (node.type === 'union_type' || node.type === 'intersection_type') {
        return node.namedChildren.some((child) => isTypeScriptContractLikeType(child));
    }
    return false;
}
function extractTypeScriptHeritageTypeNames(node) {
    return dedupeStringEntries(node.namedChildren
        .filter((child) => child.type === 'identifier' ||
        child.type === 'type_identifier' ||
        child.type === 'member_expression' ||
        child.type === 'nested_type_identifier' ||
        child.type === 'generic_type')
        .map((child) => {
        if (child.type === 'generic_type') {
            return getNameText(child.namedChildren[0] ?? null);
        }
        return getNameText(child);
    })
        .filter(Boolean));
}
function detectTypeScriptClassVariantClusters(classNames) {
    const clusterMembers = new Map();
    for (const className of classNames) {
        const tokens = splitSemanticNameTokens(className);
        if (tokens.length < 2) {
            continue;
        }
        const cluster = tokens[tokens.length - 1];
        if (!cluster || cluster.length < 3 || isIgnoredVariantClusterToken(cluster)) {
            continue;
        }
        const members = clusterMembers.get(cluster) ?? [];
        members.push(className);
        clusterMembers.set(cluster, members);
    }
    const result = new Map();
    for (const [cluster, members] of clusterMembers.entries()) {
        if (members.length < 2) {
            continue;
        }
        for (const className of members) {
            result.set(className, cluster);
        }
    }
    return result;
}
function splitSemanticNameTokens(value) {
    return String(value ?? '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);
}
function isIgnoredVariantClusterToken(value) {
    return new Set(['base', 'abstract', 'core', 'default', 'main', 'service', 'manager', 'handler']).has(String(value ?? '').trim().toLowerCase());
}
function resolveReferencedTypeNames(values, candidates) {
    const referenced = [];
    for (const candidate of candidates) {
        const escaped = escapeRegExp(candidate);
        const pattern = new RegExp(`\\b${escaped}\\b`);
        if (values.some((value) => pattern.test(String(value ?? '')))) {
            referenced.push(candidate);
        }
    }
    return dedupeStringEntries(referenced);
}
function collectTypeScriptTopLevelExecutableRecords(rootNode, moduleName, ghostContext, source, config) {
    const topLevelNodes = config.parser.includeUntaggedExports
        ? rootNode.namedChildren
        : rootNode.namedChildren.filter((node) => node.type === 'export_statement');
    return topLevelNodes.flatMap((node) => collectTypeScriptTopLevelExecutableRecordsFromDeclaration(node, rootNode, moduleName, ghostContext, source, config));
}
function collectTypeScriptTopLevelExecutableRecordsFromDeclaration(node, rootNode, moduleName, ghostContext, source, config) {
    const declarationNode = node.type === 'export_statement' ? node.namedChildren[0] : node;
    const isExported = node.type === 'export_statement';
    if (!declarationNode) {
        return [];
    }
    if (!config.parser.includeUntaggedExports &&
        !hasNearbyTriadTag(source, node.startIndex, config) &&
        !hasNearbyTriadTag(source, declarationNode.startIndex, config)) {
        return [];
    }
    if (declarationNode.type === 'function_declaration') {
        return [buildTypeScriptExecutableRecord(declarationNode, ghostContext, moduleName, undefined, isExported)];
    }
    if (declarationNode.type === 'lexical_declaration' || declarationNode.type === 'variable_declaration') {
        return declarationNode.namedChildren
            .filter((child) => child.type === 'variable_declarator')
            .flatMap((declarator) => {
            const name = getNameText(declarator.childForFieldName('name'));
            const valueNode = unwrapTypeScriptExecutableValueNode(declarator.childForFieldName('value'));
            if (!name || !valueNode) {
                return [];
            }
            if (valueNode.type === 'arrow_function' || valueNode.type === 'function') {
                return [buildTypeScriptExecutableRecord(valueNode, ghostContext, moduleName, undefined, isExported, name)];
            }
            if (valueNode.type === 'object') {
                return collectTypeScriptObjectExecutableRecords(valueNode, ghostContext, name, isExported);
            }
            return [];
        })
            .filter((record) => Boolean(record));
    }
    if (declarationNode.type === 'object') {
        return collectTypeScriptObjectExecutableRecords(declarationNode, ghostContext, moduleName, isExported);
    }
    if (declarationNode.type === 'identifier' || declarationNode.type === 'type_identifier') {
        return resolveTypeScriptTopLevelExecutableRecordByName(declarationNode.text, rootNode, moduleName, ghostContext, source, config);
    }
    if (declarationNode.type === 'export_clause') {
        return declarationNode.namedChildren
            .filter((child) => child.type === 'identifier' || child.type === 'type_identifier')
            .flatMap((child) => resolveTypeScriptTopLevelExecutableRecordByName(child.text, rootNode, moduleName, ghostContext, source, config));
    }
    return [];
}
function resolveTypeScriptTopLevelExecutableRecordByName(bindingName, rootNode, moduleName, ghostContext, source, config) {
    if (!bindingName) {
        return [];
    }
    for (const child of rootNode.namedChildren) {
        const declarationNode = child.type === 'export_statement' ? child.namedChildren[0] : child;
        if (!declarationNode) {
            continue;
        }
        if (!config.parser.includeUntaggedExports &&
            !hasNearbyTriadTag(source, child.startIndex, config) &&
            !hasNearbyTriadTag(source, declarationNode.startIndex, config)) {
            continue;
        }
        if (declarationNode.type === 'function_declaration') {
            const functionName = getNameText(declarationNode.childForFieldName('name'));
            if (functionName === bindingName) {
                return [buildTypeScriptExecutableRecord(declarationNode, ghostContext, moduleName, undefined, true)];
            }
            continue;
        }
        if (declarationNode.type !== 'lexical_declaration' && declarationNode.type !== 'variable_declaration') {
            continue;
        }
        for (const declarator of declarationNode.namedChildren.filter((entry) => entry.type === 'variable_declarator')) {
            const functionName = getNameText(declarator.childForFieldName('name'));
            const valueNode = unwrapTypeScriptExecutableValueNode(declarator.childForFieldName('value'));
            if (functionName !== bindingName || !valueNode) {
                continue;
            }
            if (valueNode.type === 'arrow_function' || valueNode.type === 'function') {
                return [buildTypeScriptExecutableRecord(valueNode, ghostContext, moduleName, undefined, true, functionName)];
            }
            if (valueNode.type === 'object') {
                return collectTypeScriptObjectExecutableRecords(valueNode, ghostContext, functionName, true);
            }
        }
    }
    return [];
}
function collectTypeScriptCliRegistrationRecords(rootNode, sourcePath, moduleName) {
    if (inferSourceCapabilityPolicy(sourcePath) !== 'cli') {
        return [];
    }
    return rootNode.namedChildren
        .flatMap((child) => {
        if (child.type !== 'expression_statement') {
            return [];
        }
        const callNode = child.namedChildren[0] ?? null;
        const descriptor = extractCliRegistrationDescriptor(callNode, moduleName);
        if (!descriptor) {
            return [];
        }
        return [
            {
                name: descriptor.name,
                ownerName: descriptor.ownerName,
                demand: [],
                answer: deriveCliSyntheticAnswer(descriptor.name),
                isExported: true,
                decorators: []
            }
        ];
    })
        .filter((record, index, records) => records.findIndex((candidate) => candidate.ownerName === record.ownerName && candidate.name === record.name) === index);
}
function collectTypeScriptApiRegistrationRecords(rootNode, sourcePath, moduleName) {
    if (inferSourceCapabilityPolicy(sourcePath) !== 'api') {
        return [];
    }
    return rootNode.namedChildren
        .flatMap((child) => {
        if (child.type !== 'expression_statement') {
            return [];
        }
        const expressionNode = child.namedChildren[0] ?? null;
        const descriptor = extractApiRegistrationDescriptor(expressionNode, moduleName);
        if (!descriptor) {
            return [];
        }
        return [
            {
                name: descriptor.name,
                ownerName: descriptor.ownerName,
                demand: [],
                answer: ['ApiRouteHandler'],
                isExported: true,
                decorators: [`route:${descriptor.method}:${descriptor.routePath}`]
            }
        ];
    })
        .filter((record, index, records) => records.findIndex((candidate) => candidate.ownerName === record.ownerName && candidate.name === record.name) === index);
}
function collectJavaScriptApiRegistrationRecords(rootNode, sourcePath, moduleName) {
    if (inferSourceCapabilityPolicy(sourcePath) !== 'api') {
        return [];
    }
    return rootNode.namedChildren
        .flatMap((child) => {
        if (child.type !== 'expression_statement') {
            return [];
        }
        const expressionNode = child.namedChildren[0] ?? null;
        const descriptor = extractApiRegistrationDescriptor(expressionNode, moduleName);
        if (!descriptor) {
            return [];
        }
        return [
            {
                name: descriptor.name,
                ownerName: descriptor.ownerName,
                demand: [],
                answer: ['ApiRouteHandler'],
                isExported: true
            }
        ];
    })
        .filter((record, index, records) => records.findIndex((candidate) => candidate.ownerName === record.ownerName && candidate.name === record.name) === index);
}
function collectTypeScriptClassCapabilityNodes(classNode, source, sourcePath, category, config, ghostContext, abstractionContext) {
    const className = getNameText(classNode.childForFieldName('name'));
    const classBody = classNode.childForFieldName('body');
    if (!className || !classBody || isSuppressedCapabilityContainerName(className, config)) {
        return [];
    }
    const classHasTriadTag = hasNearbyTriadTag(source, classNode.startIndex, config);
    const classPropertyTypes = collectTypeScriptClassPropertyTypes(classNode, ghostContext);
    const records = classBody.namedChildren
        .filter((node) => node.type === 'method_definition')
        .map((methodNode) => ({
        node: methodNode,
        name: getNameText(methodNode.childForFieldName('name'))
    }))
        .filter((entry) => entry.name && entry.name !== 'constructor' && !hasModifier(entry.node, ['private', 'protected']))
        .filter((entry) => config.parser.includeUntaggedExports ||
        classHasTriadTag ||
        hasNearbyTriadTag(source, entry.node.startIndex, config))
        .map((entry) => buildTypeScriptExecutableRecord(entry.node, ghostContext, className, classPropertyTypes));
    const promotable = records.filter((record) => !isTypeScriptNoiseCapability(record.name, config, sourcePath, record));
    if (promotable.length === 0) {
        return [];
    }
    const entrypoint = promotable.find((record) => isTypeScriptPrimaryCapabilityMethod(record.name, config));
    if (entrypoint &&
        shouldPromoteTypeScriptCapability(entrypoint.name, sourcePath, className, false, config, entrypoint)) {
        const foldedRecords = getFoldableCapabilityRecords(records, promotable, config, TYPESCRIPT_MAGIC_METHODS);
        const demand = mergeCapabilityDemand(foldedRecords.map((record) => record.demand));
        const answer = mergeCapabilityAnswer(foldedRecords.map((record) => record.answer));
        return [
            createTriadNode(`${className}.${entrypoint.name}`, category, sourcePath, demand, answer, `execute ${className} capability pipeline`, buildFoldedLeafIds(className, foldedRecords), buildTypeScriptAbstractionEvidence(abstractionContext, {
                ownerName: className,
                demand,
                answer
            }))
        ];
    }
    const capabilityMethods = promotable.filter((record) => shouldPromoteTypeScriptCapability(record.name, sourcePath, className, false, config, record));
    if (capabilityMethods.length > 0) {
        return capabilityMethods.map((record) => createTriadNode(`${className}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${className}.${record.name} capability`, [], buildTypeScriptAbstractionEvidence(abstractionContext, {
            ownerName: className,
            demand: record.demand,
            answer: record.answer
        })));
    }
    if (isTypeScriptCapabilityContainer(className)) {
        const foldedRecords = getFoldableCapabilityRecords(records, promotable, config, TYPESCRIPT_MAGIC_METHODS);
        const demand = mergeCapabilityDemand(foldedRecords.map((record) => record.demand));
        const answer = mergeCapabilityAnswer(foldedRecords.map((record) => record.answer));
        return [
            createTriadNode(`${className}.capability`, category, sourcePath, demand, answer, `execute ${className} aggregate capability`, buildFoldedLeafIds(className, foldedRecords), buildTypeScriptAbstractionEvidence(abstractionContext, {
                ownerName: className,
                demand,
                answer
            }))
        ];
    }
    return [];
}
function buildTypeScriptExecutableRecord(executableNode, ghostContext, ownerName, classPropertyTypes, isExported = false, fallbackName) {
    const name = fallbackName ?? getNameText(executableNode.childForFieldName('name')) ?? 'execute';
    const ghostDemand = collectTypeScriptGhostDemand(executableNode, ghostContext, classPropertyTypes);
    return {
        name,
        demand: mergeDemandEntries(parseTsParameters(executableNode.childForFieldName('parameters')), ghostDemand),
        answer: [normalizeGenericContractType(executableNode.childForFieldName('return_type')?.text.replace(/^:\s*/, '') ?? 'void')],
        isExported,
        ownerName,
        decorators: getTypeScriptDecorators(executableNode)
    };
}
function collectTypeScriptObjectExecutableRecords(objectNode, ghostContext, ownerName, isExported = false) {
    const records = [];
    for (const child of objectNode.namedChildren) {
        if (child.type === 'method_definition') {
            records.push(buildTypeScriptExecutableRecord(child, ghostContext, ownerName, undefined, isExported));
            continue;
        }
        if (child.type !== 'pair') {
            continue;
        }
        const propertyName = getNameText(child.namedChildren[0] ?? null);
        const valueNode = unwrapTypeScriptExecutableValueNode(child.namedChildren[1] ?? null);
        if (!propertyName || !valueNode) {
            continue;
        }
        if (valueNode.type === 'arrow_function' || valueNode.type === 'function') {
            records.push(buildTypeScriptExecutableRecord(valueNode, ghostContext, ownerName, undefined, isExported, propertyName));
        }
    }
    return records;
}
function unwrapTypeScriptExecutableValueNode(node) {
    let current = node;
    while (current) {
        if (current.type === 'satisfies_expression' ||
            current.type === 'as_expression' ||
            current.type === 'parenthesized_expression' ||
            current.type === 'type_assertion') {
            current = current.namedChildren[0] ?? null;
            continue;
        }
        break;
    }
    return current;
}
function getTypeScriptDecorators(executableNode) {
    return (executableNode.children ?? executableNode.namedChildren ?? [])
        .filter((child) => child.type === 'decorator')
        .map((child) => child.text.replace(/^@/, '').trim())
        .filter(Boolean);
}
function collectJavaScriptCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(filePath).replace(/\.(jsx?|mjs|cjs)$/, ''));
    const ghostContext = buildJavaScriptGhostContext(rootNode, filePath, parsedFiles);
    for (const classNode of rootNode.descendantsOfType('class_declaration')) {
        triadGraph.push(...collectJavaScriptClassCapabilityNodes(classNode, sourcePath, category, config, ghostContext));
    }
    const topLevelNodes = config.parser.includeUntaggedExports
        ? rootNode.namedChildren
        : rootNode.namedChildren.filter((node) => node.type === 'export_statement');
    const topLevelRecords = topLevelNodes.flatMap((node) => collectJavaScriptTopLevelCapabilityRecords(node, rootNode, moduleName, ghostContext));
    topLevelRecords.push(...collectJavaScriptApiRegistrationRecords(rootNode, sourcePath, moduleName));
    const promotableTopLevel = topLevelRecords.filter((record) => !isJavaScriptNoiseCapability(record.name, config, sourcePath, record));
    const promotedTopLevel = promotableTopLevel.filter((record) => shouldPromoteJavaScriptCapability(record.name, sourcePath, record.ownerName, record.isExported, config, record));
    for (const record of promotedTopLevel) {
        triadGraph.push(createTriadNode(`${toPascalCase(record.ownerName || moduleName)}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${toPascalCase(record.ownerName || moduleName)}.${record.name} capability`));
    }
    const moduleAggregateRecords = resolveTopLevelModuleAggregateRecords(sourcePath, topLevelRecords, promotableTopLevel);
    if (triadGraph.length === 0 && moduleAggregateRecords.length > 0) {
        triadGraph.push(createTriadNode(`${moduleName}.module_pipeline`, category, sourcePath, mergeCapabilityDemand(moduleAggregateRecords.map((record) => record.demand)), mergeCapabilityAnswer(moduleAggregateRecords.map((record) => record.answer)), `execute ${moduleName} module capability`));
    }
    return triadGraph;
}
function collectJavaScriptClassCapabilityNodes(classNode, sourcePath, category, config, ghostContext) {
    const className = getNameText(classNode.childForFieldName('name'));
    const classBody = classNode.childForFieldName('body');
    if (!className || !classBody || isSuppressedCapabilityContainerName(className, config)) {
        return [];
    }
    const classPropertyTypes = collectJavaScriptClassPropertyTypes(classNode, ghostContext);
    const records = classBody.namedChildren
        .filter((node) => node.type === 'method_definition')
        .map((methodNode) => buildJavaScriptExecutableRecord(methodNode, ghostContext, className, classPropertyTypes))
        .filter((record) => record.name !== 'constructor');
    const promotable = records.filter((record) => !isJavaScriptNoiseCapability(record.name, config, sourcePath, record));
    if (promotable.length === 0) {
        return [];
    }
    const entrypoint = promotable.find((record) => isJavaScriptPrimaryCapabilityMethod(record.name, config));
    if (entrypoint &&
        shouldPromoteJavaScriptCapability(entrypoint.name, sourcePath, className, entrypoint.isExported, config, entrypoint)) {
        const foldedRecords = getFoldableCapabilityRecords(records, promotable, config, JAVASCRIPT_MAGIC_METHODS);
        return [
            createTriadNode(`${className}.${entrypoint.name}`, category, sourcePath, mergeCapabilityDemand(foldedRecords.map((record) => record.demand)), mergeCapabilityAnswer(foldedRecords.map((record) => record.answer)), `execute ${className} capability pipeline`, buildFoldedLeafIds(className, foldedRecords))
        ];
    }
    const capabilityMethods = promotable.filter((record) => shouldPromoteJavaScriptCapability(record.name, sourcePath, className, record.isExported, config, record));
    if (capabilityMethods.length > 0) {
        return capabilityMethods.map((record) => createTriadNode(`${className}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${className}.${record.name} capability`));
    }
    if (isJavaScriptCapabilityContainer(className)) {
        const foldedRecords = getFoldableCapabilityRecords(records, promotable, config, JAVASCRIPT_MAGIC_METHODS);
        return [
            createTriadNode(`${className}.capability`, category, sourcePath, mergeCapabilityDemand(foldedRecords.map((record) => record.demand)), mergeCapabilityAnswer(foldedRecords.map((record) => record.answer)), `execute ${className} aggregate capability`, buildFoldedLeafIds(className, foldedRecords))
        ];
    }
    return [];
}
function collectJavaScriptTopLevelCapabilityRecords(node, rootNode, moduleName, ghostContext) {
    if (node.type === 'export_statement') {
        return collectJavaScriptTopLevelCapabilityRecordsFromDeclaration(node.namedChildren[0], rootNode, moduleName, ghostContext, true);
    }
    return collectJavaScriptTopLevelCapabilityRecordsFromDeclaration(node, rootNode, moduleName, ghostContext, false);
}
function collectJavaScriptTopLevelCapabilityRecordsFromDeclaration(declarationNode, rootNode, moduleName, ghostContext, isExported) {
    if (!declarationNode) {
        return [];
    }
    if (declarationNode.type === 'function_declaration') {
        return [buildJavaScriptExecutableRecord(declarationNode, ghostContext, moduleName, undefined, isExported)];
    }
    if (declarationNode.type === 'lexical_declaration' || declarationNode.type === 'variable_declaration') {
        return declarationNode.namedChildren
            .filter((node) => node.type === 'variable_declarator')
            .flatMap((declarator) => {
            const name = getNameText(declarator.childForFieldName('name'));
            const valueNode = unwrapJavaScriptExecutableValueNode(declarator.childForFieldName('value'));
            if (!name || !valueNode) {
                return [];
            }
            if (valueNode.type === 'arrow_function' || valueNode.type === 'function') {
                return [buildJavaScriptExecutableRecord(valueNode, ghostContext, moduleName, undefined, isExported, name)];
            }
            if (valueNode.type === 'object') {
                return collectJavaScriptObjectExecutableRecords(valueNode, ghostContext, name, isExported);
            }
            return [];
        })
            .filter((record) => Boolean(record));
    }
    if (declarationNode.type === 'object') {
        return collectJavaScriptObjectExecutableRecords(declarationNode, ghostContext, moduleName, isExported);
    }
    if (declarationNode.type === 'identifier') {
        return resolveJavaScriptTopLevelExecutableRecordByName(declarationNode.text, rootNode, moduleName, ghostContext);
    }
    if (declarationNode.type === 'export_clause') {
        return declarationNode.namedChildren
            .filter((child) => child.type === 'identifier')
            .flatMap((child) => resolveJavaScriptTopLevelExecutableRecordByName(child.text, rootNode, moduleName, ghostContext));
    }
    return [];
}
function resolveJavaScriptTopLevelExecutableRecordByName(bindingName, rootNode, moduleName, ghostContext) {
    if (!bindingName) {
        return [];
    }
    for (const child of rootNode.namedChildren) {
        const declarationNode = child.type === 'export_statement' ? child.namedChildren[0] : child;
        if (!declarationNode) {
            continue;
        }
        if (declarationNode.type === 'function_declaration') {
            const functionName = getNameText(declarationNode.childForFieldName('name'));
            if (functionName === bindingName) {
                return [buildJavaScriptExecutableRecord(declarationNode, ghostContext, moduleName, undefined, true)];
            }
            continue;
        }
        if (declarationNode.type !== 'lexical_declaration' && declarationNode.type !== 'variable_declaration') {
            continue;
        }
        for (const declarator of declarationNode.namedChildren.filter((entry) => entry.type === 'variable_declarator')) {
            const functionName = getNameText(declarator.childForFieldName('name'));
            const valueNode = unwrapJavaScriptExecutableValueNode(declarator.childForFieldName('value'));
            if (functionName !== bindingName || !valueNode) {
                continue;
            }
            if (valueNode.type === 'arrow_function' || valueNode.type === 'function') {
                return [buildJavaScriptExecutableRecord(valueNode, ghostContext, moduleName, undefined, true, functionName)];
            }
            if (valueNode.type === 'object') {
                return collectJavaScriptObjectExecutableRecords(valueNode, ghostContext, functionName, true);
            }
        }
    }
    return [];
}
function collectJavaScriptCliRegistrationRecords(rootNode, sourcePath, moduleName) {
    if (inferSourceCapabilityPolicy(sourcePath) !== 'cli') {
        return [];
    }
    return rootNode.namedChildren
        .flatMap((child) => {
        if (child.type !== 'expression_statement') {
            return [];
        }
        const callNode = child.namedChildren[0] ?? null;
        const descriptor = extractCliRegistrationDescriptor(callNode, moduleName);
        if (!descriptor) {
            return [];
        }
        return [
            {
                name: descriptor.name,
                ownerName: descriptor.ownerName,
                demand: [],
                answer: deriveCliSyntheticAnswer(descriptor.name),
                isExported: true
            }
        ];
    })
        .filter((record, index, records) => records.findIndex((candidate) => candidate.ownerName === record.ownerName && candidate.name === record.name) === index);
}
function buildJavaScriptExecutableRecord(executableNode, ghostContext, ownerName, classPropertyTypes, isExported = false, fallbackName) {
    const name = fallbackName ?? getNameText(executableNode.childForFieldName('name')) ?? 'execute';
    const ghostDemand = collectTypeScriptGhostDemand(executableNode, ghostContext, classPropertyTypes);
    return {
        name,
        demand: mergeDemandEntries(parseJsParameters(executableNode.childForFieldName('parameters')), ghostDemand),
        answer: [inferJavaScriptExecutableReturnType(executableNode)],
        ownerName,
        isExported
    };
}
function collectJavaScriptObjectExecutableRecords(objectNode, ghostContext, ownerName, isExported = false) {
    const records = [];
    for (const child of objectNode.namedChildren) {
        if (child.type === 'method_definition') {
            records.push(buildJavaScriptExecutableRecord(child, ghostContext, ownerName, undefined, isExported));
            continue;
        }
        if (child.type !== 'pair') {
            continue;
        }
        const propertyName = getNameText(child.namedChildren[0] ?? null);
        const valueNode = unwrapJavaScriptExecutableValueNode(child.namedChildren[1] ?? null);
        if (!propertyName || !valueNode) {
            continue;
        }
        if (valueNode.type === 'arrow_function' || valueNode.type === 'function') {
            records.push(buildJavaScriptExecutableRecord(valueNode, ghostContext, ownerName, undefined, isExported, propertyName));
        }
    }
    return records;
}
function unwrapJavaScriptExecutableValueNode(node) {
    let current = node;
    while (current && current.type === 'parenthesized_expression') {
        current = current.namedChildren[0] ?? null;
    }
    return current;
}
const CLI_COMMAND_REGISTRATION_METHODS = new Set([
    'command',
    'commands',
    'add_parser',
    'addparser',
    'addcommand',
    'subcommand'
]);
const CLI_HANDLER_REGISTRATION_METHODS = new Set(['action', 'handler', 'callback', 'set_defaults', 'setdefaults']);
const API_REGISTRATION_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'del', 'options', 'head', 'all']);
function extractCliRegistrationDescriptor(callNode, moduleName) {
    if (!callNode || (callNode.type !== 'call_expression' && callNode.type !== 'call')) {
        return null;
    }
    const methods = [];
    let commandName = '';
    let actionName = '';
    const visit = (node) => {
        if (!node || (node.type !== 'call_expression' && node.type !== 'call')) {
            return;
        }
        const calleeNode = node.namedChildren[0] ?? null;
        const argsNode = node.namedChildren.find((child) => child.type === 'arguments' || child.type === 'argument_list') ?? null;
        if (calleeNode?.type === 'member_expression' || calleeNode?.type === 'attribute') {
            const objectNode = calleeNode.namedChildren[0] ?? null;
            const propertyName = normalizeText(getNameText(calleeNode.namedChildren[1] ?? null));
            if (propertyName) {
                methods.push(propertyName);
                if (!commandName && CLI_COMMAND_REGISTRATION_METHODS.has(propertyName)) {
                    commandName = extractCliCommandName(argsNode);
                    if (!actionName) {
                        actionName = extractCliHandlerName(argsNode);
                    }
                }
                if (!actionName && CLI_HANDLER_REGISTRATION_METHODS.has(propertyName)) {
                    actionName = extractCliHandlerName(argsNode);
                }
            }
            if (objectNode?.type === 'call_expression' || objectNode?.type === 'call') {
                visit(objectNode);
            }
            return;
        }
        if (calleeNode?.type === 'identifier') {
            const propertyName = normalizeText(calleeNode.text);
            if (propertyName && CLI_COMMAND_REGISTRATION_METHODS.has(propertyName)) {
                methods.push(propertyName);
                if (!commandName) {
                    commandName = extractCliCommandName(argsNode);
                }
                if (!actionName) {
                    actionName = extractCliHandlerName(argsNode);
                }
            }
        }
    };
    visit(callNode);
    const methodSet = new Set(methods);
    if (!commandName && !actionName) {
        return null;
    }
    if (!methodSet.has('command') && !methodSet.has('commands') && !methodSet.has('add_parser') && !methodSet.has('addparser') && !methodSet.has('addcommand') && !methodSet.has('subcommand')) {
        return null;
    }
    const ownerName = toPascalCase(commandName || moduleName || 'cli');
    const name = normalizeCliRegistrationNodeName(actionName, commandName, methodSet);
    return {
        ownerName,
        name,
        commandName
    };
}
function extractApiRegistrationDescriptor(callNode, moduleName) {
    if (!callNode || (callNode.type !== 'call_expression' && callNode.type !== 'call')) {
        return null;
    }
    const methods = [];
    let routePath = '';
    let handlerName = '';
    const visit = (node) => {
        if (!node || (node.type !== 'call_expression' && node.type !== 'call')) {
            return;
        }
        const calleeNode = node.namedChildren[0] ?? null;
        const argsNode = node.namedChildren.find((child) => child.type === 'arguments' || child.type === 'argument_list') ?? null;
        if (calleeNode?.type === 'member_expression' || calleeNode?.type === 'attribute') {
            const objectNode = calleeNode.namedChildren[0] ?? null;
            const propertyName = normalizeText(getNameText(calleeNode.namedChildren[1] ?? null)).toLowerCase();
            if (propertyName) {
                methods.push(propertyName);
                if (propertyName === 'route' && !routePath) {
                    routePath = extractApiRoutePath(argsNode);
                }
                if (API_REGISTRATION_METHODS.has(propertyName)) {
                    if (!routePath) {
                        routePath = extractApiRoutePath(argsNode);
                    }
                    if (!handlerName) {
                        handlerName = extractApiHandlerName(argsNode);
                    }
                }
            }
            if (objectNode?.type === 'call_expression' || objectNode?.type === 'call') {
                visit(objectNode);
            }
            return;
        }
        if (calleeNode?.type === 'identifier') {
            const calleeName = normalizeText(calleeNode.text).toLowerCase();
            if (calleeName === 'route') {
                methods.push(calleeName);
                if (!routePath) {
                    routePath = extractApiRoutePath(argsNode);
                }
                return;
            }
            if (API_REGISTRATION_METHODS.has(calleeName)) {
                methods.push(calleeName);
                if (!routePath) {
                    routePath = extractApiRoutePath(argsNode);
                }
                if (!handlerName) {
                    handlerName = extractApiHandlerName(argsNode);
                }
            }
        }
    };
    visit(callNode);
    const methodSet = new Set(methods);
    const method = [...methodSet].find((entry) => API_REGISTRATION_METHODS.has(entry));
    if (!method || !routePath) {
        return null;
    }
    return {
        ownerName: normalizeApiOwnerName(routePath, moduleName),
        name: normalizeApiRegistrationNodeName(handlerName, routePath),
        routePath,
        method
    };
}
function extractCliCommandName(argsNode) {
    if (!argsNode) {
        return '';
    }
    for (const child of argsNode.namedChildren) {
        if (child.type === 'string') {
            const stringFragment = child.namedChildren.find((node) => node.type === 'string_fragment' || node.type === 'string_content');
            const value = normalizeText(stringFragment?.text ?? child.text.replace(/^['"]|['"]$/g, ''));
            if (value && !value.startsWith('--')) {
                return value;
            }
        }
    }
    return '';
}
function extractCliHandlerName(argsNode) {
    if (!argsNode) {
        return '';
    }
    const children = [...argsNode.namedChildren].reverse();
    for (const child of children) {
        if (child.type === 'identifier' || child.type === 'property_identifier') {
            return normalizeText(child.text);
        }
        if (child.type === 'member_expression' || child.type === 'attribute') {
            const valueName = normalizeText(getNameText(child));
            if (valueName) {
                return valueName;
            }
        }
        if (child.type === 'keyword_argument') {
            const valueNode = child.childForFieldName('value') ?? child.namedChildren[1] ?? null;
            const valueName = normalizeText(getNameText(valueNode));
            if (valueName) {
                return valueName;
            }
        }
    }
    return '';
}
function normalizeCliRegistrationNodeName(actionName, commandName, methods) {
    const normalizedAction = normalizeText(actionName);
    if (normalizedAction && normalizedAction !== normalizeText(commandName)) {
        return normalizedAction;
    }
    if (methods.has('set_defaults') || methods.has('setdefaults')) {
        return 'handler';
    }
    if (methods.has('action') || methods.has('handler') || methods.has('callback')) {
        return 'command';
    }
    return 'command';
}
function extractApiRoutePath(argsNode) {
    if (!argsNode) {
        return '';
    }
    for (const child of argsNode.namedChildren) {
        const direct = extractStaticStringLikeValue(child);
        if (direct && direct.startsWith('/')) {
            return normalizeApiRoutePath(direct);
        }
    }
    return '';
}
function extractApiHandlerName(argsNode) {
    if (!argsNode) {
        return '';
    }
    const children = [...argsNode.namedChildren].reverse();
    for (const child of children) {
        if (child.type === 'identifier' || child.type === 'property_identifier') {
            return normalizeText(child.text);
        }
        if (child.type === 'member_expression' || child.type === 'attribute') {
            const valueName = normalizeText(getNameText(child));
            if (valueName) {
                return valueName.split('.').pop() ?? valueName;
            }
        }
        if (child.type === 'arrow_function' || child.type === 'function' || child.type === 'function_definition') {
            return 'handler';
        }
        if (child.type === 'call_expression' || child.type === 'call') {
            const valueName = normalizeText(getNameText(child.namedChildren[0] ?? null));
            if (valueName) {
                return valueName.split('.').pop() ?? valueName;
            }
        }
    }
    return '';
}
function normalizeApiOwnerName(routePath, moduleName) {
    const normalizedPath = normalizeApiRoutePath(routePath);
    const segments = normalizedPath.split('/').filter(Boolean).filter((segment) => !isDynamicApiSegment(segment));
    return toPascalCase(segments[segments.length - 1] ?? moduleName ?? 'api');
}
function normalizeApiRegistrationNodeName(handlerName, routePath) {
    const normalizedHandler = normalizeText(handlerName);
    if (normalizedHandler) {
        return normalizedHandler;
    }
    const normalizedPath = normalizeApiRoutePath(routePath);
    const fallback = normalizedPath
        .split('/')
        .filter(Boolean)
        .reverse()
        .find((segment) => !isDynamicApiSegment(segment));
    return normalizeText(fallback ?? 'handler') || 'handler';
}
function normalizeApiRoutePath(routePath) {
    const normalized = normalizeText(routePath)
        .replace(/\/{2,}/g, '/')
        .replace(/\$\{[^}]+\}/g, ':param')
        .replace(/\[[^\]]+\]/g, ':param')
        .replace(/\{[^}]+\}/g, ':param');
    if (!normalized) {
        return '';
    }
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
}
function isDynamicApiSegment(segment) {
    const normalized = normalizeText(segment);
    return !normalized || normalized.startsWith(':');
}
function extractStaticStringLikeValue(node) {
    if (!node) {
        return '';
    }
    if (node.type === 'string') {
        const fragment = node.namedChildren.find((child) => child.type === 'string_fragment' || child.type === 'string_content');
        return normalizeText(fragment?.text ?? node.text);
    }
    if (node.type === 'template_string') {
        const pieces = node.namedChildren
            .map((child) => {
            if (child.type === 'string_fragment' || child.type === 'string_content') {
                return child.text;
            }
            if (child.type === 'template_substitution' || child.type === 'interpolation') {
                return ':param';
            }
            return '';
        })
            .join('');
        return normalizeText(pieces);
    }
    return '';
}
function inferJavaScriptExecutableReturnType(executableNode) {
    const bodyNode = executableNode.childForFieldName('body') ?? executableNode.namedChildren[executableNode.namedChildren.length - 1];
    if (executableNode.type === 'arrow_function' && bodyNode && bodyNode.type !== 'statement_block') {
        return normalizeGenericContractType(inferJavaScriptValueType(bodyNode, 'result'));
    }
    return '[Generic] unknown';
}
const JAVASCRIPT_MAGIC_METHODS = new Set(['toString', 'valueOf', 'toJSON', 'inspect']);
const JAVASCRIPT_HELPER_PREFIXES = [
    '_',
    'get',
    'set',
    'build',
    'parse',
    'format',
    'normalize',
    'sanitize',
    'validate',
    'ensure',
    'create',
    'load',
    'save',
    'list',
    'collect',
    'resolve',
    'prepare',
    'read',
    'write',
    'convert',
    'sync',
    'merge',
    'filter',
    'check',
    'infer',
    'guess',
    'serialize',
    'deserialize',
    'dump',
    'helper'
];
const JAVASCRIPT_PRIMARY_CAPABILITY_PREFIXES = [
    'execute',
    'run',
    'handle',
    'process',
    'invoke',
    'dispatch',
    'orchestrate',
    'apply',
    'plan',
    'schedule'
];
const GENERIC_CAPABILITY_CONTAINER_SUFFIXES = [
    'Service',
    'Node',
    'Workflow',
    'Pipeline',
    'Step',
    'Handler',
    'Controller',
    'Tool',
    'Agent',
    'Manager',
    'Orchestrator',
    'Router',
    'Planner',
    'Coordinator',
    'Dispatcher',
    'Executor',
    'Registry'
];
const JAVASCRIPT_CAPABILITY_CLASS_SUFFIXES = GENERIC_CAPABILITY_CONTAINER_SUFFIXES;
const TYPESCRIPT_MAGIC_METHODS = JAVASCRIPT_MAGIC_METHODS;
const TYPESCRIPT_HELPER_PREFIXES = JAVASCRIPT_HELPER_PREFIXES;
const TYPESCRIPT_PRIMARY_CAPABILITY_PREFIXES = JAVASCRIPT_PRIMARY_CAPABILITY_PREFIXES;
const TYPESCRIPT_CAPABILITY_CLASS_SUFFIXES = JAVASCRIPT_CAPABILITY_CLASS_SUFFIXES;
const JAVA_MAGIC_METHODS = new Set(['toString', 'hashCode', 'equals']);
const JAVA_HELPER_PREFIXES = [
    'get', 'set', 'build', 'parse', 'format', 'normalize', 'sanitize', 'validate', 'ensure', 'create', 'load', 'save',
    'list', 'collect', 'resolve', 'prepare', 'read', 'write', 'convert', 'sync', 'merge', 'filter', 'check', 'infer',
    'guess', 'serialize', 'deserialize', 'dump'
];
const JAVA_PRIMARY_CAPABILITY_PREFIXES = ['execute', 'run', 'handle', 'process', 'invoke', 'dispatch', 'orchestrate', 'apply', 'plan', 'schedule'];
const JAVA_CAPABILITY_CLASS_SUFFIXES = GENERIC_CAPABILITY_CONTAINER_SUFFIXES;
const GO_HELPER_PREFIXES = [
    'get', 'set', 'build', 'parse', 'format', 'normalize', 'sanitize', 'validate', 'ensure', 'create', 'load', 'save',
    'list', 'collect', 'resolve', 'prepare', 'read', 'write', 'convert', 'sync', 'merge', 'filter', 'check', 'infer',
    'guess', 'dump'
];
const GO_PRIMARY_CAPABILITY_PREFIXES = ['execute', 'run', 'handle', 'process', 'invoke', 'dispatch', 'orchestrate', 'apply', 'plan', 'schedule'];
const GO_CAPABILITY_TYPE_SUFFIXES = GENERIC_CAPABILITY_CONTAINER_SUFFIXES;
const RUST_HELPER_PREFIXES = [
    '_', 'get', 'set', 'build', 'parse', 'format', 'normalize', 'sanitize', 'validate', 'ensure', 'create', 'load',
    'save', 'list', 'collect', 'resolve', 'prepare', 'read', 'write', 'convert', 'sync', 'merge', 'filter', 'check',
    'infer', 'guess', 'dump'
];
const RUST_PRIMARY_CAPABILITY_PREFIXES = ['execute', 'run', 'handle', 'process', 'invoke', 'dispatch', 'orchestrate', 'apply', 'plan', 'schedule'];
const RUST_CAPABILITY_TYPE_SUFFIXES = GENERIC_CAPABILITY_CONTAINER_SUFFIXES;
const CPP_MAGIC_METHODS = new Set(['ToString', 'toString']);
const CPP_HELPER_PREFIXES = [
    'Build', 'Parse', 'Format', 'Normalize', 'Sanitize', 'Validate', 'Ensure', 'Create', 'Load', 'Save', 'List',
    'Collect', 'Resolve', 'Prepare', 'Read', 'Write', 'Convert', 'Sync', 'Merge', 'Filter', 'Check', 'Infer', 'Guess',
    'Get', 'Set', 'Dump', 'build', 'parse', 'format', 'normalize', 'sanitize', 'validate', 'ensure', 'create', 'load',
    'save', 'list', 'collect', 'resolve', 'prepare', 'read', 'write', 'convert', 'sync', 'merge', 'filter', 'check',
    'infer', 'guess', 'get', 'set', 'dump'
];
const CPP_PRIMARY_CAPABILITY_PREFIXES = ['Execute', 'Run', 'Handle', 'Process', 'Invoke', 'Dispatch', 'Orchestrate', 'Apply', 'Plan', 'Schedule', 'execute', 'run', 'handle', 'process', 'invoke', 'dispatch', 'orchestrate', 'apply', 'plan', 'schedule'];
const CPP_CAPABILITY_TYPE_SUFFIXES = GENERIC_CAPABILITY_CONTAINER_SUFFIXES;
const CAPABILITY_ACTION_PREFIXES = ['submit', 'export', 'import', 'reconcile'];
const CAPABILITY_DECORATOR_PATTERN = /\b(route|get|post|put|delete|patch|task|workflow|tool|step|action|consumer|handler|command|event|rpc)\b/i;
const HARD_SUPPRESSED_HELPER_PREFIXES = [
    'set', 'build', 'parse', 'format', 'normalize', 'sanitize', 'validate', 'collect', 'resolve', 'prepare', 'infer',
    'guess', 'convert', 'merge', 'filter', 'check'
];
const CONDITIONAL_HELPER_PREFIXES = ['get', 'list', 'create', 'load', 'save', 'ensure', 'read', 'write', 'sync', 'extract'];
const UTILS_ALLOWED_CAPABILITY_PREFIXES = ['run', 'detect', 'analyze', 'apply'];
const NODE_ENTRYPOINT_PREFIXES = ['execute', 'run', 'process'];
const EXECUTE_LIKE_METHOD_PATTERN = /^(execute|run|handle|process|dispatch|apply|invoke|orchestrate|schedule|plan|do)(?:$|[_A-Z])/i;
const RUNTIME_EXTRACTOR_ENTRYPOINT_NAMES = new Set(['detect', 'extract']);
const COMMAND_REGISTRATION_PREFIXES = ['register'];
const INFRASTRUCTURE_HELPER_PREFIXES = ['extract', 'get', 'has', 'init', 'initialize', 'inspect', 'install', 'is', 'read', 'resolve', 'write'];
const INFRASTRUCTURE_SOURCE_HINTS = ['bootstrap', 'catalog', 'config', 'lifecycle', 'parser', 'scaffold', 'sessionstore', 'store'];
const WORKFLOW_MAINTENANCE_PREFIXES = ['ensure', 'reset'];
const WORKFLOW_MAINTENANCE_HINTS = ['artifact', 'focus', 'prompt', 'seed', 'snapshot'];
const DEFAULT_GHOST_POLICY = {
    includeInDemand: true,
    topK: 5,
    minConfidence: 4
};
function isConfiguredNoiseCapability(name, config) {
    const trimmedName = name.trim();
    if (!trimmedName) {
        return true;
    }
    return (config?.parser.excludeNodeNamePatterns ?? []).some((pattern) => {
        try {
            return new RegExp(pattern, 'i').test(trimmedName);
        }
        catch {
            return false;
        }
    });
}
function isSuppressedCapabilityContainerName(name, config) {
    const trimmedName = name.trim();
    if (!trimmedName) {
        return true;
    }
    return /^_/.test(trimmedName) || /^__.*__$/.test(trimmedName) || isConfiguredNoiseCapability(trimmedName, config);
}
function isConfiguredPrimaryCapabilityMethod(name, config) {
    const entries = config?.parser.entryMethodNames ?? [];
    return entries.some((entryName) => hasNamePrefix(name, entryName) || name.trim().toLowerCase() === entryName.toLowerCase());
}
function inferSourceCapabilityPolicy(sourcePath = '') {
    const configuredScope = ACTIVE_PARSER_CONFIG ? (0, config_1.resolveSourceScanScope)(sourcePath, ACTIVE_PARSER_CONFIG) : undefined;
    if (configuredScope?.kind) {
        return configuredScope.kind;
    }
    const normalizedPath = (0, workspace_1.normalizePath)(String(sourcePath ?? '')).toLowerCase();
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.some((segment) => segment === 'test' || segment === 'tests' || segment === '__tests__')) {
        return 'tests';
    }
    if (segments.some((segment) => segment === 'migration' || segment === 'migrations' || segment === 'alembic')) {
        return 'migrations';
    }
    if (segments.some((segment) => ['types', 'schemas', 'schema', 'models', 'model', 'entities', 'entity', 'dto', 'vo'].includes(segment))) {
        return 'types';
    }
    return 'other';
}
function normalizeCapabilitySourcePath(sourcePath = '') {
    return (0, workspace_1.normalizePath)(String(sourcePath ?? ''))
        .replace(/^\.?\//, '')
        .replace(/\/{2,}/g, '/')
        .toLowerCase();
}
function getCapabilitySourceFileStem(sourcePath = '') {
    const normalizedPath = normalizeCapabilitySourcePath(sourcePath);
    const fileName = normalizedPath.split('/').pop() ?? normalizedPath;
    return fileName.replace(/\.[^.]+$/, '');
}
function isRuntimeExtractorSourcePath(sourcePath) {
    const normalizedPath = normalizeCapabilitySourcePath(sourcePath);
    const fileStem = getCapabilitySourceFileStem(sourcePath);
    return normalizedPath.includes('runtime/extractors/') || fileStem.endsWith('extractor');
}
function isCommandRegistrationSourcePath(sourcePath) {
    const normalizedPath = normalizeCapabilitySourcePath(sourcePath);
    const fileStem = getCapabilitySourceFileStem(sourcePath);
    return /(^|\/)(commands?|subcommands?)(\/|$)/.test(normalizedPath) || fileStem.endsWith('commands');
}
function isInfrastructureHelperSourcePath(sourcePath) {
    const fileStem = getCapabilitySourceFileStem(sourcePath);
    return INFRASTRUCTURE_SOURCE_HINTS.some((hint) => fileStem.includes(hint));
}
function isWorkflowMaintenanceSourcePath(sourcePath) {
    return /workflow(?:$|[^a-z0-9])/i.test(getCapabilitySourceFileStem(sourcePath));
}
function hasStrongSurfaceCapabilitySignal(name, sourcePath, record) {
    const demand = record?.demand ?? [];
    const answer = record?.answer ?? [];
    return (hasCapabilityDecorator(record) ||
        hasFrontendSurfaceCapabilitySignal(name, sourcePath) ||
        hasAgentCapabilitySignal(name, sourcePath, undefined, demand, answer) ||
        hasCliCapabilitySignal(name, sourcePath, undefined, demand, answer));
}
function isSupportAbstractionCapabilityNoiseCandidate(name, sourcePath, record) {
    if (!(0, supportAbstraction_1.isSupportAbstractionSourcePath)(sourcePath)) {
        return false;
    }
    if (/\.module_pipeline$/i.test(String(name ?? '').trim())) {
        return false;
    }
    return !hasStrongSurfaceCapabilitySignal(name, sourcePath, record);
}
function isRuntimeExtractorHelperCapability(name, sourcePath) {
    if (!isRuntimeExtractorSourcePath(sourcePath)) {
        return false;
    }
    return !RUNTIME_EXTRACTOR_ENTRYPOINT_NAMES.has(name.trim().toLowerCase());
}
function isAdministrativeCommandRegistrationCapability(name, sourcePath, record) {
    return isCommandRegistrationSourcePath(sourcePath) &&
        COMMAND_REGISTRATION_PREFIXES.some((prefix) => hasNamePrefix(name, prefix)) &&
        !hasCapabilityDecorator(record);
}
function isInfrastructureHelperCapability(name, sourcePath, record) {
    return isInfrastructureHelperSourcePath(sourcePath) &&
        INFRASTRUCTURE_HELPER_PREFIXES.some((prefix) => hasNamePrefix(name, prefix)) &&
        !hasCapabilityDecorator(record);
}
function isWorkflowArtifactMaintenanceCapability(name, sourcePath, record) {
    if (!isWorkflowMaintenanceSourcePath(sourcePath)) {
        return false;
    }
    if (!WORKFLOW_MAINTENANCE_PREFIXES.some((prefix) => hasNamePrefix(name, prefix))) {
        return false;
    }
    const semanticText = [name, ...(record?.demand ?? []), ...(record?.answer ?? [])].join(' ').toLowerCase();
    return WORKFLOW_MAINTENANCE_HINTS.some((hint) => semanticText.includes(hint));
}
function shouldCreateSupportModuleAggregate(sourcePath, topLevelRecords) {
    if (topLevelRecords.length === 0) {
        return false;
    }
    const sourcePolicy = inferSourceCapabilityPolicy(sourcePath);
    if (sourcePolicy !== 'services' && sourcePolicy !== 'other') {
        return false;
    }
    return (0, supportAbstraction_1.isRootLevelSupportAbstractionSourcePath)(sourcePath);
}
function resolveTopLevelModuleAggregateRecords(sourcePath, topLevelRecords, promotableTopLevel) {
    return promotableTopLevel.length > 0
        ? promotableTopLevel
        : shouldCreateSupportModuleAggregate(sourcePath, topLevelRecords)
            ? topLevelRecords
            : [];
}
function isStaticRightBranchSourcePath(sourcePath) {
    return /rightbranch\.[^.]+$/i.test((0, workspace_1.normalizePath)(String(sourcePath ?? '')).toLowerCase());
}
function isLikelyUiSourcePath(normalizedPath, segments) {
    void segments;
    return /\.(tsx|jsx)$/.test(normalizedPath) || inferSourceCapabilityPolicy(normalizedPath) === 'ui';
}
function isLikelyAgentSourcePath(normalizedPath, segments) {
    void segments;
    return inferSourceCapabilityPolicy(normalizedPath) === 'agent';
}
function isLikelyCliSourcePath(normalizedPath, segments) {
    void segments;
    return inferSourceCapabilityPolicy(normalizedPath) === 'cli';
}
function classifyHelperVerb(name) {
    if (!name.trim()) {
        return 'none';
    }
    if (HARD_SUPPRESSED_HELPER_PREFIXES.some((prefix) => hasNamePrefix(name, prefix))) {
        return 'hard';
    }
    if (CONDITIONAL_HELPER_PREFIXES.some((prefix) => hasNamePrefix(name, prefix))) {
        return 'conditional';
    }
    return 'none';
}
function hasCapabilityDecorator(record) {
    return (record?.decorators ?? []).some((decorator) => CAPABILITY_DECORATOR_PATTERN.test(decorator));
}
function isPrivateCapabilityName(name, config) {
    return (config?.parser.excludePrivateMethods ?? true) && /^_/.test(name.trim());
}
function isMagicCapabilityName(name, magicMethods, config) {
    const trimmedName = name.trim();
    return (config?.parser.excludeMagicMethods ?? true) && (magicMethods.has(trimmedName) || /^__.*__$/.test(trimmedName));
}
function isConditionalHelperCapabilityAllowed(name, sourcePath, record, isPrimary, config) {
    if ((config?.parser.helperVerbPolicy ?? 'suppress') === 'allow') {
        return true;
    }
    const policy = inferSourceCapabilityPolicy(sourcePath);
    if (policy === 'api') {
        return hasCapabilityDecorator(record) || isPrimary || Boolean(record?.isExported);
    }
    if (policy === 'nodes') {
        return NODE_ENTRYPOINT_PREFIXES.some((prefix) => hasNamePrefix(name, prefix)) && isPrimary;
    }
    if (policy === 'tasks') {
        return isPrimary || hasCapabilityDecorator(record) || isWorkflowLikeName(name);
    }
    if (policy === 'ui') {
        return (Boolean(record?.isExported) ||
            isPrimary ||
            hasFrontendSurfaceCapabilitySignal(name, sourcePath) ||
            isWorkflowLikeName(name));
    }
    if (policy === 'agent') {
        return isPrimary || hasCapabilityDecorator(record) || hasAgentCapabilitySignal(name, sourcePath) || isWorkflowLikeName(name);
    }
    if (policy === 'cli') {
        return (Boolean(record?.isExported) ||
            isPrimary ||
            hasCliCapabilitySignal(name, sourcePath) ||
            isWorkflowLikeName(name));
    }
    if (policy === 'utils') {
        return UTILS_ALLOWED_CAPABILITY_PREFIXES.some((prefix) => hasNamePrefix(name, prefix));
    }
    if (policy === 'services') {
        return hasDomainContract(record?.demand ?? [], config) || hasDomainContract(record?.answer ?? [], config);
    }
    return isPrimary || hasCapabilityDecorator(record) || Boolean(record?.isExported);
}
function isSuppressedCapabilityCandidate(name, sourcePath, config, record, isPrimary, magicMethods) {
    const trimmedName = name.trim();
    if (!trimmedName) {
        return true;
    }
    const sourcePolicy = inferSourceCapabilityPolicy(sourcePath);
    if (sourcePolicy === 'tests' || sourcePolicy === 'types' || sourcePolicy === 'migrations') {
        return true;
    }
    if (isStaticRightBranchSourcePath(sourcePath)) {
        return true;
    }
    if (isPrivateCapabilityName(trimmedName, config)) {
        return true;
    }
    if (isMagicCapabilityName(trimmedName, magicMethods, config)) {
        return true;
    }
    if (isConfiguredNoiseCapability(trimmedName, config)) {
        return true;
    }
    if (isSupportAbstractionCapabilityNoiseCandidate(trimmedName, sourcePath, record)) {
        return true;
    }
    if (isRuntimeExtractorHelperCapability(trimmedName, sourcePath)) {
        return true;
    }
    if (isAdministrativeCommandRegistrationCapability(trimmedName, sourcePath, record)) {
        return true;
    }
    if (isInfrastructureHelperCapability(trimmedName, sourcePath, record)) {
        return true;
    }
    if (isWorkflowArtifactMaintenanceCapability(trimmedName, sourcePath, record)) {
        return true;
    }
    const helperClass = classifyHelperVerb(trimmedName);
    const relaxHardSuppression = helperClass === 'hard' && shouldRelaxHardSuppression(trimmedName, sourcePath, record, sourcePolicy);
    if (helperClass === 'hard' && !relaxHardSuppression) {
        return true;
    }
    if ((helperClass === 'conditional' || relaxHardSuppression) &&
        !isConditionalHelperCapabilityAllowed(trimmedName, sourcePath, record, isPrimary, config)) {
        return true;
    }
    if (sourcePolicy === 'api' && !hasCapabilityDecorator(record) && !isPrimary && !record?.isExported) {
        return true;
    }
    if (sourcePolicy === 'nodes' && !NODE_ENTRYPOINT_PREFIXES.some((prefix) => hasNamePrefix(trimmedName, prefix))) {
        return true;
    }
    if (sourcePolicy === 'tasks' && !isPrimary && !hasCapabilityDecorator(record) && !isWorkflowLikeName(trimmedName)) {
        return true;
    }
    if (sourcePolicy === 'utils' &&
        !UTILS_ALLOWED_CAPABILITY_PREFIXES.some((prefix) => hasNamePrefix(trimmedName, prefix)) &&
        !hasCapabilityDecorator(record)) {
        return true;
    }
    return false;
}
function shouldRelaxHardSuppression(name, sourcePath, record, sourcePolicy) {
    if (sourcePolicy !== 'agent') {
        return false;
    }
    return (hasAgentCapabilitySignal(name, sourcePath, undefined, record?.demand ?? [], record?.answer ?? []) ||
        isWorkflowLikeName(name));
}
function shouldPromoteCapabilityByScore(name, sourcePath, className, record, config, isContainer, isPrimary, isExported = false, magicMethods = new Set()) {
    if (isSuppressedCapabilityCandidate(name, sourcePath, config, record, isPrimary, magicMethods)) {
        return false;
    }
    const decorators = record?.decorators ?? [];
    const demand = record?.demand ?? [];
    const answer = record?.answer ?? [];
    const sourcePolicy = inferSourceCapabilityPolicy(sourcePath);
    const helperClass = classifyHelperVerb(name);
    const hasDecoratorSignal = decorators.some((decorator) => CAPABILITY_DECORATOR_PATTERN.test(decorator));
    const hasDomainSignal = hasDomainContract(demand, config) || hasDomainContract(answer, config);
    const hasWorkflowSignal = isWorkflowLikeName(name) || (className ? isWorkflowLikeName(className) : false);
    const hasFrontendSignal = hasFrontendSurfaceCapabilitySignal(name, sourcePath, className);
    const hasAgentSignal = hasAgentCapabilitySignal(name, sourcePath, className, demand, answer);
    const hasCliSignal = hasCliCapabilitySignal(name, sourcePath, className, demand, answer);
    const isExecuteLike = isExecuteLikeMethodName(name);
    const supportSource = (0, supportAbstraction_1.isSupportAbstractionSourcePath)(sourcePath);
    const hasOperationalSignal = hasDecoratorSignal || hasWorkflowSignal || hasFrontendSignal || hasAgentSignal || hasCliSignal || isPrimary || isExecuteLike;
    const isSuppressedOwner = isSuppressedPromotionOwner(className);
    const evidenceReasons = derivePromotionEvidenceReasons(name, sourcePath, className, demand, answer, decorators);
    const suppressLowSignalHelper = helperClass !== 'none' &&
        (sourcePolicy === 'other' || sourcePolicy === 'utils' || sourcePolicy === 'services') &&
        !hasOperationalSignal &&
        !(sourcePolicy === 'services' && hasDomainSignal);
    if (isSuppressedOwner) {
        return false;
    }
    if ((supportSource && !hasOperationalSignal) || suppressLowSignalHelper) {
        return false;
    }
    if (evidenceReasons.length < 2) {
        return false;
    }
    if (isExecuteLike && !hasDomainSignal && !hasDecoratorSignal && !hasWorkflowSignal) {
        return false;
    }
    let score = 0;
    if (isExported || record?.isExported)
        score += 1;
    if (hasDecoratorSignal)
        score += 3;
    if (isPrimary)
        score += 1;
    if (hasWorkflowSignal)
        score += 2;
    if (hasFrontendSignal)
        score += 1;
    if (hasAgentSignal)
        score += 1;
    if (hasCliSignal)
        score += 1;
    if (isContainer && !isExecuteLike)
        score += 1;
    if (CAPABILITY_ACTION_PREFIXES.some((prefix) => hasNamePrefix(name, prefix)))
        score += 1;
    if (hasDomainSignal)
        score += 3;
    if (sourcePolicy === 'api' && hasCapabilityDecorator(record))
        score += 2;
    if (sourcePolicy === 'ui' && (hasFrontendSignal || isExported || record?.isExported || hasWorkflowSignal))
        score += 2;
    if (sourcePolicy === 'agent' && (hasAgentSignal || hasWorkflowSignal || isPrimary))
        score += 2;
    if (sourcePolicy === 'cli' && (hasCliSignal || isPrimary || isExported || record?.isExported))
        score += 2;
    if ((sourcePolicy === 'tasks' || sourcePolicy === 'nodes') && (isPrimary || hasWorkflowSignal))
        score += 2;
    if (sourcePolicy === 'services' && (hasDomainSignal || hasWorkflowSignal))
        score += 1;
    if (sourcePolicy === 'utils' && UTILS_ALLOWED_CAPABILITY_PREFIXES.some((prefix) => hasNamePrefix(name, prefix)))
        score += 1;
    if (helperClass === 'conditional')
        score -= 2;
    if (hasOnlyGenericContracts([...demand, ...answer], config))
        score -= 3;
    if (isExecuteLike)
        score -= 3;
    const threshold = config?.parser.capabilityThreshold ?? 4;
    const promoted = score >= threshold;
    if (promoted && record) {
        record.promotionReasons = evidenceReasons;
    }
    return promoted;
}
function isSuppressedPromotionOwner(className) {
    if (!className) {
        return false;
    }
    return /(base|abstract|container|wrapper)/i.test(className);
}
function derivePromotionEvidenceReasons(methodName, sourcePath, className, demand, answer, decorators) {
    const reasons = [];
    if (hasDomainContract(demand, ACTIVE_PARSER_CONFIG) || hasDomainContract(answer, ACTIVE_PARSER_CONFIG)) {
        reasons.push('external_contract');
    }
    if (decorators.some((decorator) => CAPABILITY_DECORATOR_PATTERN.test(decorator)) || isWorkflowLikeName(methodName)) {
        reasons.push('runtime_signal');
    }
    if (hasFrontendSurfaceCapabilitySignal(methodName, sourcePath, className)) {
        reasons.push('frontend_surface');
    }
    if (hasAgentCapabilitySignal(methodName, sourcePath, className, demand, answer)) {
        reasons.push('agent_flow');
    }
    if (hasCliCapabilitySignal(methodName, sourcePath, className, demand, answer)) {
        reasons.push('cli_entrypoint');
    }
    if (hasBusinessSemanticSignal(methodName, className, sourcePath)) {
        reasons.push('business_semantic');
    }
    if (hasCrossModuleCallSignal(demand)) {
        reasons.push('cross_module_call');
    }
    return dedupeStringEntries(reasons);
}
function hasBusinessSemanticSignal(methodName, className, sourcePath) {
    const tokens = tokenizeSemanticName(`${methodName} ${className ?? ''} ${getSemanticSourcePathTail(sourcePath)}`);
    const meaningfulTokens = tokens.filter((token) => !GENERIC_SUBJECT_TOKENS.has(token) && !GENERIC_METHOD_TOKENS.has(token));
    return meaningfulTokens.length >= 2;
}
function hasFrontendSurfaceCapabilitySignal(methodName, sourcePath, className) {
    const normalizedPath = (0, workspace_1.normalizePath)(String(sourcePath ?? '')).toLowerCase();
    if (!isLikelyUiSourcePath(normalizedPath, normalizedPath.split('/').filter(Boolean))) {
        return false;
    }
    const semanticText = `${methodName} ${className ?? ''} ${getSemanticSourcePathTail(sourcePath)}`;
    return (/^use[A-Z0-9_]/.test(methodName) ||
        /^render[A-Z0-9_]/.test(methodName) ||
        /(page|layout|provider|store|query|mutation|dashboard|screen|view|form|modal|dialog|panel|widget|table|chart|route)/i.test(semanticText) ||
        /(^|\/)(page|layout|route|loading|error)\.(tsx|jsx|ts|js)$/.test(normalizedPath));
}
function hasAgentCapabilitySignal(methodName, sourcePath, className, demand = [], answer = []) {
    const normalizedPath = (0, workspace_1.normalizePath)(String(sourcePath ?? '')).toLowerCase();
    if (!isLikelyAgentSourcePath(normalizedPath, normalizedPath.split('/').filter(Boolean))) {
        return false;
    }
    const semanticText = `${methodName} ${className ?? ''} ${getSemanticSourcePathTail(sourcePath)} ${getFirstDomainContractName([
        ...answer,
        ...demand
    ])}`;
    return /(chat|conversation|orchestr|planner|tool|function|memory|session|assistant|reasoning|router|dispatch|message|prompt|completion|registry|executor|coordinator)/i.test(semanticText);
}
function hasCliCapabilitySignal(methodName, sourcePath, className, demand = [], answer = []) {
    const normalizedPath = (0, workspace_1.normalizePath)(String(sourcePath ?? '')).toLowerCase();
    if (!isLikelyCliSourcePath(normalizedPath, normalizedPath.split('/').filter(Boolean))) {
        return false;
    }
    if (/(^|\/)(commands?|handlers?|parsers?|subcommands?)(\/|$)/.test(normalizedPath)) {
        return true;
    }
    const semanticText = `${methodName} ${className ?? ''} ${getSemanticSourcePathTail(sourcePath)} ${getFirstDomainContractName([
        ...answer,
        ...demand
    ])}`;
    return /(cli|commands?|subcommands?|handlers?|argv|option|flag|serve|start|deploy|init|main|entry|program|parser|subparser|register|load|plugin|auth|mcp)/i.test(semanticText);
}
function hasCrossModuleCallSignal(demand) {
    return demand
        .filter((entry) => /^\[Ghost:/i.test(String(entry ?? '').trim()))
        .some((entry) => {
        const parsed = parseGhostDemandEntry(entry);
        if (/^(self|this|ctx|context|state|data)(?:$|\.)/i.test(parsed.target)) {
            return false;
        }
        return (parsed.target.includes('.') ||
            isRuntimeResourceTarget(parsed.target) ||
            hasTypedCrossModuleGhostSignal(parsed.target, parsed.valueType));
    });
}
function hasTypedCrossModuleGhostSignal(target, valueType) {
    const normalizedType = String(valueType ?? '').trim();
    if (!normalizedType || isUnknownLikeType(normalizedType) || /^(default|set|map)$/i.test(normalizedType)) {
        return false;
    }
    const targetLeaf = String(target ?? '').trim().split('.').filter(Boolean).pop() ?? '';
    if (targetLeaf &&
        isSimpleGhostSymbol(targetLeaf) &&
        isSimpleGhostSymbol(normalizedType) &&
        normalizeGhostSymbol(targetLeaf) === normalizeGhostSymbol(normalizedType)) {
        return false;
    }
    return normalizedType.includes('.') || /[<>\[\]|&]/.test(normalizedType) || /^[A-Z]/.test(normalizedType);
}
function isSimpleGhostSymbol(value) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(value ?? '').trim());
}
function normalizeGhostSymbol(value) {
    return String(value ?? '')
        .trim()
        .replace(/^this\./i, '')
        .replace(/^self\./i, '')
        .replace(/[^a-z0-9]+/gi, '')
        .toLowerCase();
}
function isWorkflowLikeName(value) {
    return /(workflow|pipeline|stage|step|transition|handler|controller|service|adapter|gateway|tool|worker|operator|kernel|agent|command|consumer|endpoint|orchestrator|planner|router|dispatcher|executor|registry|conversation|session|memory)/i.test(value);
}
function hasDomainContract(entries, config) {
    return entries.some((entry) => {
        const typeText = extractContractTypeText(entry);
        return Boolean(typeText) && !isIgnoredContractType(typeText, config);
    });
}
function hasOnlyGenericContracts(entries, config) {
    const typeTexts = entries
        .map((entry) => extractContractTypeText(entry))
        .filter((entry) => Boolean(entry));
    return typeTexts.length > 0 && typeTexts.every((entry) => isIgnoredContractType(entry, config));
}
function isExecuteLikeMethodName(value) {
    return EXECUTE_LIKE_METHOD_PATTERN.test(String(value ?? '').trim());
}
function extractContractTypeText(entry) {
    const raw = String(entry ?? '')
        .trim()
        .replace(/^\[Generic\]\s*/i, '')
        .replace(/^\[Ghost:[^\]]+\]\s*/i, '');
    if (!raw || /^(none|void|null|undefined)$/i.test(raw)) {
        return '';
    }
    const match = raw.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    return (match ? match[1] : raw).trim();
}
function isIgnoredContractType(value, config) {
    const compact = value.toLowerCase().replace(/^typing\./, '').replace(/\s+/g, '');
    const configured = new Set((config?.parser.genericContractIgnoreList ?? []).map((entry) => entry.toLowerCase().replace(/\s+/g, '')));
    return configured.has(compact) || isGenericContractType(value);
}
function isJavaScriptNoiseCapability(name, config, sourcePath = '', record) {
    return isSuppressedCapabilityCandidate(name, sourcePath, config, record, isJavaScriptPrimaryCapabilityMethod(name, config), JAVASCRIPT_MAGIC_METHODS);
}
function isTypeScriptNoiseCapability(name, config, sourcePath = '', record) {
    return isSuppressedCapabilityCandidate(name, sourcePath, config, record, isTypeScriptPrimaryCapabilityMethod(name, config), TYPESCRIPT_MAGIC_METHODS);
}
function isTypeScriptPrimaryCapabilityMethod(name, config) {
    return (isConfiguredPrimaryCapabilityMethod(name, config) ||
        TYPESCRIPT_PRIMARY_CAPABILITY_PREFIXES.some((prefix) => hasNamePrefix(name, prefix) || name === prefix));
}
function isTypeScriptCapabilityContainer(className) {
    return TYPESCRIPT_CAPABILITY_CLASS_SUFFIXES.some((suffix) => className.endsWith(suffix));
}
function shouldPromoteTypeScriptCapability(name, sourcePath, className, isExported = false, config, record) {
    if (isTypeScriptNoiseCapability(name, config, sourcePath, record)) {
        return false;
    }
    return shouldPromoteCapabilityByScore(name, sourcePath, className, record, config, Boolean(className && isTypeScriptCapabilityContainer(className)), isTypeScriptPrimaryCapabilityMethod(name, config), isExported, TYPESCRIPT_MAGIC_METHODS);
}
function isJavaScriptPrimaryCapabilityMethod(name, config) {
    return (isConfiguredPrimaryCapabilityMethod(name, config) ||
        JAVASCRIPT_PRIMARY_CAPABILITY_PREFIXES.some((prefix) => hasNamePrefix(name, prefix) || name === prefix));
}
function isJavaScriptCapabilityContainer(className) {
    return JAVASCRIPT_CAPABILITY_CLASS_SUFFIXES.some((suffix) => className.endsWith(suffix));
}
function shouldPromoteJavaScriptCapability(name, sourcePath, className, isExported = false, config, record) {
    if (isJavaScriptNoiseCapability(name, config, sourcePath, record)) {
        return false;
    }
    return shouldPromoteCapabilityByScore(name, sourcePath, className, record, config, Boolean(className && isJavaScriptCapabilityContainer(className)), isJavaScriptPrimaryCapabilityMethod(name, config), isExported, JAVASCRIPT_MAGIC_METHODS);
}
function isJavaNoiseCapability(name, config, sourcePath = '', record) {
    return isSuppressedCapabilityCandidate(name, sourcePath, config, record, isJavaPrimaryCapabilityMethod(name, config), JAVA_MAGIC_METHODS);
}
function isJavaPrimaryCapabilityMethod(name, config) {
    return (isConfiguredPrimaryCapabilityMethod(name, config) ||
        JAVA_PRIMARY_CAPABILITY_PREFIXES.some((prefix) => hasNamePrefix(name, prefix) || name === prefix));
}
function isJavaCapabilityContainer(className) {
    return JAVA_CAPABILITY_CLASS_SUFFIXES.some((suffix) => className.endsWith(suffix));
}
function shouldPromoteJavaCapability(name, sourcePath, className, config, record) {
    if (isJavaNoiseCapability(name, config, sourcePath, record)) {
        return false;
    }
    return shouldPromoteCapabilityByScore(name, sourcePath, className, record, config, Boolean(className && isJavaCapabilityContainer(className)), isJavaPrimaryCapabilityMethod(name, config), false, JAVA_MAGIC_METHODS);
}
function isGoNoiseCapability(name, config, sourcePath = '', record) {
    return isSuppressedCapabilityCandidate(name, sourcePath, config, record, isGoPrimaryCapabilityMethod(name, config), new Set());
}
function isGoPrimaryCapabilityMethod(name, config) {
    return (isConfiguredPrimaryCapabilityMethod(name, config) ||
        GO_PRIMARY_CAPABILITY_PREFIXES.some((prefix) => hasNamePrefix(name, prefix) || name === prefix));
}
function isGoCapabilityContainer(typeName) {
    return Boolean(typeName) && GO_CAPABILITY_TYPE_SUFFIXES.some((suffix) => typeName.endsWith(suffix));
}
function shouldPromoteGoCapability(name, sourcePath, typeName, config, record) {
    if (isGoNoiseCapability(name, config, sourcePath, record)) {
        return false;
    }
    return shouldPromoteCapabilityByScore(name, sourcePath, typeName, record, config, Boolean(isGoCapabilityContainer(typeName)), isGoPrimaryCapabilityMethod(name, config));
}
function isRustNoiseCapability(name, config, sourcePath = '', record) {
    return isSuppressedCapabilityCandidate(name, sourcePath, config, record, isRustPrimaryCapabilityMethod(name, config), new Set());
}
function isRustPrimaryCapabilityMethod(name, config) {
    return (isConfiguredPrimaryCapabilityMethod(name, config) ||
        RUST_PRIMARY_CAPABILITY_PREFIXES.some((prefix) => hasNamePrefix(name, prefix) || name === prefix));
}
function isRustCapabilityContainer(typeName) {
    return Boolean(typeName) && RUST_CAPABILITY_TYPE_SUFFIXES.some((suffix) => typeName.endsWith(suffix));
}
function shouldPromoteRustCapability(name, sourcePath, typeName, config, record) {
    if (isRustNoiseCapability(name, config, sourcePath, record)) {
        return false;
    }
    return shouldPromoteCapabilityByScore(name, sourcePath, typeName, record, config, Boolean(isRustCapabilityContainer(typeName)), isRustPrimaryCapabilityMethod(name, config));
}
function isCppNoiseCapability(name, config, sourcePath = '', record) {
    return isSuppressedCapabilityCandidate(name, sourcePath, config, record, isCppPrimaryCapabilityMethod(name, config), CPP_MAGIC_METHODS);
}
function isCppPrimaryCapabilityMethod(name, config) {
    return (isConfiguredPrimaryCapabilityMethod(name, config) ||
        CPP_PRIMARY_CAPABILITY_PREFIXES.some((prefix) => hasNamePrefix(name, prefix) || name === prefix));
}
function isCppCapabilityContainer(typeName) {
    return Boolean(typeName) && CPP_CAPABILITY_TYPE_SUFFIXES.some((suffix) => typeName.endsWith(suffix));
}
function shouldPromoteCppCapability(name, sourcePath, typeName, config, record) {
    if (isCppNoiseCapability(name, config, sourcePath, record)) {
        return false;
    }
    return shouldPromoteCapabilityByScore(name, sourcePath, typeName, record, config, Boolean(isCppCapabilityContainer(typeName)), isCppPrimaryCapabilityMethod(name, config), false, CPP_MAGIC_METHODS);
}
function hasNamePrefix(name, prefix) {
    const lowerName = name.trim().toLowerCase();
    const lowerPrefix = prefix.toLowerCase();
    return (lowerName === lowerPrefix ||
        lowerName.startsWith(`${lowerPrefix}_`) ||
        lowerName.startsWith(`${lowerPrefix}-`) ||
        lowerName.startsWith(lowerPrefix) && name.charAt(lowerPrefix.length) !== name.charAt(lowerPrefix.length).toLowerCase());
}
function collectPythonCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(sourcePath).replace(/\.py$/, ''));
    const ghostContext = buildPythonGhostContext(rootNode, filePath, parsedFiles);
    for (const rootChild of rootNode.namedChildren) {
        const classNode = (0, treeSitterPythonSupport_1.unwrapPythonDefinition)(rootChild, 'class_definition');
        if (classNode) {
            triadGraph.push(...collectPythonClassCapabilityNodes(classNode, sourcePath, category, config, ghostContext));
        }
    }
    const topLevelRecords = rootNode.namedChildren
        .map((child) => (0, treeSitterPythonSupport_1.unwrapPythonDefinition)(child, 'function_definition'))
        .filter((node) => Boolean(node))
        .map((node) => buildPythonExecutableRecord(node, ghostContext, moduleName))
        .concat(collectPythonCliRegistrationRecords(rootNode, sourcePath, moduleName));
    const promotableTopLevel = topLevelRecords.filter((record) => !isPythonNoiseCapability(record.name, config, sourcePath, record));
    const promotedTopLevel = promotableTopLevel.filter((record) => shouldPromotePythonCapability(record.name, sourcePath, undefined, record.decorators, config, record));
    for (const record of promotedTopLevel) {
        triadGraph.push(createTriadNode(`${moduleName}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${moduleName}.${record.name} capability`));
    }
    const moduleAggregateRecords = resolveTopLevelModuleAggregateRecords(sourcePath, topLevelRecords, promotableTopLevel);
    if (triadGraph.length === 0 && moduleAggregateRecords.length > 0) {
        triadGraph.push(createTriadNode(`${moduleName}.module_pipeline`, category, sourcePath, mergeCapabilityDemand(moduleAggregateRecords.map((record) => record.demand)), mergeCapabilityAnswer(moduleAggregateRecords.map((record) => record.answer)), `execute ${moduleName} module capability`));
    }
    return triadGraph;
}
function collectPythonClassCapabilityNodes(classNode, sourcePath, category, config, ghostContext) {
    const className = getNameText(classNode.childForFieldName('name'));
    const classBody = classNode.childForFieldName('body');
    if (!className || !classBody || isSuppressedCapabilityContainerName(className, config)) {
        return [];
    }
    const classPropertyTypes = collectPythonClassPropertyTypes(classNode, ghostContext);
    const records = (0, treeSitterPythonSupport_1.getPythonFunctionDefinitions)(classBody)
        .map((methodNode) => buildPythonExecutableRecord(methodNode, ghostContext, className, classPropertyTypes))
        .filter((record) => record.name !== '__init__');
    const promotable = records.filter((record) => !isPythonNoiseCapability(record.name, config, sourcePath, record));
    if (promotable.length === 0) {
        return [];
    }
    const entrypoint = promotable.find((record) => isPythonPrimaryCapabilityMethod(record.name, config));
    if (entrypoint &&
        shouldPromotePythonCapability(entrypoint.name, sourcePath, className, entrypoint.decorators, config, entrypoint)) {
        const foldedRecords = getFoldableCapabilityRecords(records, promotable, config, PYTHON_MAGIC_METHODS);
        return [
            createTriadNode(`${className}.${entrypoint.name}`, category, sourcePath, mergeCapabilityDemand(foldedRecords.map((record) => record.demand)), mergeCapabilityAnswer(foldedRecords.map((record) => record.answer)), `execute ${className} capability pipeline`, buildFoldedLeafIds(className, foldedRecords))
        ];
    }
    const capabilityMethods = promotable.filter((record) => shouldPromotePythonCapability(record.name, sourcePath, className, record.decorators, config, record));
    if (capabilityMethods.length > 0) {
        return capabilityMethods.map((record) => createTriadNode(`${className}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${className}.${record.name} capability`));
    }
    if (isPythonCapabilityContainer(className)) {
        const foldedRecords = getFoldableCapabilityRecords(records, promotable, config, PYTHON_MAGIC_METHODS);
        return [
            createTriadNode(`${className}.capability`, category, sourcePath, mergeCapabilityDemand(foldedRecords.map((record) => record.demand)), mergeCapabilityAnswer(foldedRecords.map((record) => record.answer)), `execute ${className} aggregate capability`, buildFoldedLeafIds(className, foldedRecords))
        ];
    }
    return [];
}
function buildPythonExecutableRecord(executableNode, ghostContext, ownerName, classPropertyTypes) {
    const name = getNameText(executableNode.childForFieldName('name')) ?? 'execute';
    const decorators = getPythonDecorators(executableNode);
    const ghostDemand = collectPythonGhostDemand(executableNode, ghostContext, classPropertyTypes);
    return {
        name,
        decorators,
        demand: mergeDemandEntries(parsePythonParametersAst(executableNode.childForFieldName('parameters')), ghostDemand),
        answer: [extractPythonReturnType(executableNode)],
        ownerName
    };
}
function collectPythonCliRegistrationRecords(rootNode, sourcePath, moduleName) {
    if (inferSourceCapabilityPolicy(sourcePath) !== 'cli') {
        return [];
    }
    const parserBindings = new Map();
    const records = [];
    for (const child of rootNode.namedChildren) {
        if (child.type !== 'expression_statement') {
            continue;
        }
        const expressionNode = child.namedChildren[0] ?? null;
        if (!expressionNode) {
            continue;
        }
        if (expressionNode.type === 'assignment') {
            const bindingName = normalizeText(getNameText(expressionNode.childForFieldName('left')));
            const rightNode = expressionNode.childForFieldName('right') ?? expressionNode.namedChildren[1] ?? null;
            const descriptor = extractCliRegistrationDescriptor(rightNode, moduleName);
            if (bindingName && descriptor?.commandName) {
                parserBindings.set(bindingName, descriptor.commandName);
            }
            if (descriptor) {
                records.push({
                    name: descriptor.name,
                    decorators: [],
                    demand: [],
                    answer: deriveCliSyntheticAnswer(descriptor.name),
                    ownerName: descriptor.ownerName
                });
            }
            continue;
        }
        const descriptor = extractCliRegistrationDescriptor(expressionNode, moduleName);
        if (descriptor) {
            records.push({
                name: descriptor.name,
                decorators: [],
                demand: [],
                answer: deriveCliSyntheticAnswer(descriptor.name),
                ownerName: descriptor.ownerName
            });
        }
        const boundDescriptor = extractPythonCliBoundHandlerDescriptor(expressionNode, moduleName, parserBindings);
        if (boundDescriptor) {
            records.push({
                name: boundDescriptor.name,
                decorators: [],
                demand: [],
                answer: deriveCliSyntheticAnswer(boundDescriptor.name),
                ownerName: boundDescriptor.ownerName
            });
        }
    }
    return records.filter((record, index, entries) => {
        return entries.findIndex((candidate) => candidate.ownerName === record.ownerName && candidate.name === record.name) === index;
    });
}
function deriveCliSyntheticAnswer(name) {
    return [/^(command|load|register)$/i.test(String(name ?? '').trim()) ? 'CliCommand' : 'CliCommandHandler'];
}
function extractPythonCliBoundHandlerDescriptor(expressionNode, moduleName, parserBindings) {
    if (expressionNode.type !== 'call') {
        return null;
    }
    const calleeNode = expressionNode.childForFieldName('function') ?? expressionNode.namedChildren[0] ?? null;
    const argsNode = expressionNode.childForFieldName('arguments') ??
        expressionNode.namedChildren.find((child) => child.type === 'argument_list') ??
        null;
    if (!calleeNode || calleeNode.type !== 'attribute') {
        return null;
    }
    const objectNode = calleeNode.childForFieldName('object') ?? calleeNode.namedChildren[0] ?? null;
    const propertyNode = calleeNode.childForFieldName('attribute') ?? calleeNode.namedChildren[1] ?? null;
    const methodName = normalizeText(getNameText(propertyNode));
    if (!CLI_HANDLER_REGISTRATION_METHODS.has(methodName)) {
        return null;
    }
    const bindingName = normalizeText(getNameText(objectNode));
    const commandName = parserBindings.get(bindingName);
    if (!commandName) {
        return null;
    }
    const actionName = extractCliHandlerName(argsNode);
    return {
        ownerName: toPascalCase(commandName || moduleName || 'cli'),
        name: normalizeCliRegistrationNodeName(actionName, commandName, new Set(['command', methodName]))
    };
}
function getPythonDecorators(executableNode) {
    const decoratedDefinition = executableNode.parent?.type === 'decorated_definition' ? executableNode.parent : null;
    return (decoratedDefinition?.namedChildren ?? [])
        .filter((child) => child.type === 'decorator')
        .map((child) => child.text.replace(/^@/, '').trim())
        .filter(Boolean);
}
const PYTHON_MAGIC_METHODS = new Set([
    '__str__',
    '__repr__',
    '__enter__',
    '__exit__',
    '__aenter__',
    '__aexit__',
    '__iter__',
    '__next__',
    '__len__',
    '__bool__',
    '__hash__',
    '__eq__'
]);
const PYTHON_HELPER_PREFIXES = [
    '_',
    'get',
    'set',
    'build',
    'parse',
    'format',
    'normalize',
    'sanitize',
    'validate',
    'ensure',
    'create',
    'load',
    'save',
    'list',
    'collect',
    'resolve',
    'prepare',
    'read',
    'write',
    'convert',
    'sync',
    'merge',
    'filter',
    'check',
    'infer',
    'guess',
    'serialize',
    'deserialize',
    'cache',
    'path',
    'dump',
    'helper'
];
const PYTHON_PRIMARY_CAPABILITY_PREFIXES = [
    'execute',
    'run',
    'handle',
    'process',
    'invoke',
    'dispatch',
    'orchestrate',
    'apply',
    'plan',
    'schedule'
];
const PYTHON_CAPABILITY_CLASS_SUFFIXES = GENERIC_CAPABILITY_CONTAINER_SUFFIXES;
function isPythonNoiseCapability(name, config, sourcePath = '', record) {
    return isSuppressedCapabilityCandidate(name, sourcePath, config, record, isPythonPrimaryCapabilityMethod(name, config), PYTHON_MAGIC_METHODS);
}
function isPythonPrimaryCapabilityMethod(name, config) {
    const lowerName = name.trim().toLowerCase();
    return (isConfiguredPrimaryCapabilityMethod(name, config) ||
        PYTHON_PRIMARY_CAPABILITY_PREFIXES.some((prefix) => lowerName === prefix || lowerName.startsWith(`${prefix}_`)));
}
function isPythonCapabilityContainer(className) {
    return PYTHON_CAPABILITY_CLASS_SUFFIXES.some((suffix) => className.endsWith(suffix));
}
function shouldPromotePythonCapability(name, sourcePath, className, decorators = [], config, record) {
    if (isPythonNoiseCapability(name, config, sourcePath, { ...record, decorators })) {
        return false;
    }
    return shouldPromoteCapabilityByScore(name, sourcePath, className, { ...record, decorators }, config, Boolean(className && isPythonCapabilityContainer(className)), isPythonPrimaryCapabilityMethod(name, config), false, PYTHON_MAGIC_METHODS);
}
function mergeCapabilityDemand(demandGroups) {
    return mergeCapabilityEntries(demandGroups, 'None');
}
function mergeCapabilityAnswer(answerGroups) {
    return mergeCapabilityEntries(answerGroups, 'void');
}
function mergeCapabilityEntries(groups, fallback) {
    const merged = [];
    const seen = new Set();
    for (const entry of groups.flat()) {
        const trimmed = String(entry ?? '').trim();
        if (!trimmed || trimmed.toLowerCase() === fallback.toLowerCase()) {
            continue;
        }
        if (!seen.has(trimmed)) {
            seen.add(trimmed);
            merged.push(trimmed);
        }
    }
    return merged.length > 0 ? merged : [fallback];
}
function buildPythonGhostContext(rootNode, filePath, parsedFiles) {
    return {
        importedBindings: collectPythonImportedBindings(rootNode, filePath, parsedFiles),
        moduleBindings: collectPythonModuleBindings(rootNode)
    };
}
function collectPythonImportedBindings(rootNode, filePath, parsedFiles) {
    const bindings = new Map();
    for (const importFrom of rootNode.descendantsOfType('import_from_statement')) {
        const moduleNode = importFrom.namedChildren.find((node) => node.type === 'dotted_name');
        const modulePath = moduleNode?.text ?? '';
        const targetFile = resolvePythonImportedParsedFile(filePath, modulePath, parsedFiles);
        for (const child of importFrom.namedChildren.slice(1)) {
            if (child.type === 'dotted_name') {
                const localName = child.text;
                if (localName) {
                    bindings.set(localName, resolvePythonImportedBindingInfo(targetFile, localName));
                }
                continue;
            }
            if (child.type === 'aliased_import') {
                const importedNode = child.namedChildren.find((node) => node.type === 'dotted_name') ?? null;
                const aliasNode = child.namedChildren.find((node) => node.type === 'identifier') ?? null;
                const importedName = importedNode?.text ?? '';
                const localName = aliasNode?.text ?? importedName;
                if (localName) {
                    bindings.set(localName, resolvePythonImportedBindingInfo(targetFile, importedName || localName));
                }
            }
        }
    }
    for (const importStatement of rootNode.descendantsOfType('import_statement')) {
        for (const child of importStatement.namedChildren) {
            if (child.type === 'aliased_import') {
                const moduleNode = child.namedChildren.find((node) => node.type === 'dotted_name');
                const aliasNode = child.namedChildren.find((node) => node.type === 'identifier');
                const localName = aliasNode?.text ?? moduleNode?.text.split('.').pop() ?? '';
                if (!localName) {
                    continue;
                }
                bindings.set(localName, createModuleBinding());
                continue;
            }
            if (child.type === 'dotted_name') {
                const localName = child.text.split('.').pop() ?? '';
                if (!localName) {
                    continue;
                }
                bindings.set(localName, createModuleBinding());
            }
        }
    }
    return bindings;
}
function collectPythonModuleBindings(rootNode) {
    const bindings = new Map();
    for (const child of rootNode.namedChildren) {
        if (child.type === 'function_definition') {
            const localName = getNameText(child.childForFieldName('name'));
            if (localName) {
                bindings.set(localName, createCallableBinding(localName, extractPythonReturnType(child)));
            }
            continue;
        }
        if (child.type === 'class_definition') {
            const localName = getNameText(child.childForFieldName('name'));
            if (localName) {
                bindings.set(localName, createValueBinding(localName));
            }
            continue;
        }
        if (child.type === 'expression_statement') {
            const assignmentNode = child.namedChildren.find((node) => node.type === 'assignment');
            if (!assignmentNode) {
                continue;
            }
            const leftNode = assignmentNode.childForFieldName('left') ?? assignmentNode.namedChildren[0] ?? null;
            const localName = (0, treeSitterBindingSupport_1.extractBindingNames)(leftNode, TREE_SITTER_PARSER_BINDING_PROFILE)[0];
            if (!localName) {
                continue;
            }
            bindings.set(localName, createValueBinding(inferPythonAssignmentType(assignmentNode, localName, {
                importedBindings: new Map(),
                moduleBindings: bindings
            })));
        }
    }
    return bindings;
}
function collectPythonClassPropertyTypes(classNode, ghostContext) {
    const propertyTypes = new Map();
    const classBody = classNode.childForFieldName('body');
    if (!classBody) {
        return propertyTypes;
    }
    for (const child of classBody.namedChildren) {
        if (child.type === 'expression_statement') {
            const assignmentNode = child.namedChildren.find((node) => node.type === 'assignment');
            if (!assignmentNode) {
                continue;
            }
            const leftNode = assignmentNode.childForFieldName('left') ?? assignmentNode.namedChildren[0] ?? null;
            const propertyName = (0, treeSitterBindingSupport_1.extractBindingNames)(leftNode, TREE_SITTER_PARSER_BINDING_PROFILE)[0];
            if (!propertyName) {
                continue;
            }
            propertyTypes.set(propertyName, inferPythonAssignmentType(assignmentNode, propertyName, ghostContext));
            continue;
        }
        if (child.type === 'function_definition' && getNameText(child.childForFieldName('name')) === '__init__') {
            const initBody = child.childForFieldName('body');
            if (!initBody) {
                continue;
            }
            for (const stmt of initBody.namedChildren.filter((node) => node.type === 'expression_statement')) {
                const assignmentNode = stmt.namedChildren.find((node) => node.type === 'assignment');
                if (!assignmentNode) {
                    continue;
                }
                const leftNode = assignmentNode.childForFieldName('left') ?? assignmentNode.namedChildren[0] ?? null;
                if (!leftNode || leftNode.type !== 'attribute') {
                    continue;
                }
                const rootNode = leftNode.namedChildren[0] ?? null;
                const propertyNode = leftNode.namedChildren[1] ?? null;
                if (!rootNode || rootNode.text !== 'self' || !propertyNode) {
                    continue;
                }
                const propertyName = getNameText(propertyNode);
                if (!propertyName) {
                    continue;
                }
                if (propertyTypes.has(propertyName)) {
                    continue;
                }
                propertyTypes.set(propertyName, inferPythonAssignmentType(assignmentNode, propertyName, ghostContext));
            }
        }
    }
    return propertyTypes;
}
function collectPythonGhostDemand(executableNode, ghostContext, classPropertyTypes = new Map()) {
    const ghostStates = new Map();
    for (const reference of (0, treeSitterGhostScanner_1.scanTreeSitterGhostReferences)(executableNode, {
        localDeclarationNodes: ['assignment', 'for_statement', 'for_in_clause', 'with_item'],
        memberExpressionNodes: ['attribute', 'subscript'],
        functionBodyNodes: ['block'],
        selfNames: ['self', 'cls']
    })) {
        if (reference.kind === 'self') {
            const propertyName = reference.propertyName ?? reference.rootName;
            const typeName = classPropertyTypes.get(propertyName) ?? 'unknown';
            registerGhostState(ghostStates, reference.label, typeName, reference.mode);
            continue;
        }
        const binding = ghostContext.importedBindings.get(reference.rootName) ?? ghostContext.moduleBindings.get(reference.rootName);
        if (!binding) {
            continue;
        }
        registerGhostState(ghostStates, reference.label, binding.typeName, reference.mode);
    }
    return Array.from(ghostStates.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, state]) => {
        if (state.read && state.write) {
            return `[Ghost:ReadWrite] ${state.typeName} (${label})`;
        }
        if (state.write) {
            return `[Ghost:Write] ${state.typeName} (${label})`;
        }
        return `[Ghost:Read] ${state.typeName} (${label})`;
    });
}
function resolvePythonImportedParsedFile(currentFilePath, importPath, parsedFiles) {
    if (!importPath) {
        return undefined;
    }
    const modulePath = importPath.replace(/\./g, path.sep);
    const relativeCandidates = [
        `${modulePath}.py`,
        path.join(modulePath, '__init__.py')
    ].map((candidate) => path.normalize(candidate));
    const siblingCandidates = relativeCandidates.map((candidate) => path.normalize(path.join(path.dirname(currentFilePath), candidate)));
    return parsedFiles.find((entry) => {
        const normalized = path.normalize(entry.filePath);
        return siblingCandidates.includes(normalized) || relativeCandidates.some((candidate) => normalized.endsWith(candidate));
    });
}
function resolvePythonImportedBindingInfo(targetFile, bindingName) {
    if (!targetFile) {
        return createValueBinding(bindingName);
    }
    return lookupPythonExportedBindingInfo(targetFile.rootNode, bindingName) ?? createValueBinding(bindingName);
}
function lookupPythonExportedBindingInfo(rootNode, bindingName) {
    for (const child of rootNode.namedChildren) {
        if (child.type === 'class_definition') {
            const name = getNameText(child.childForFieldName('name'));
            if (name === bindingName) {
                return createValueBinding(name);
            }
            continue;
        }
        if (child.type === 'function_definition') {
            const name = getNameText(child.childForFieldName('name'));
            if (name === bindingName) {
                return createCallableBinding(name, extractPythonReturnType(child));
            }
            continue;
        }
        if (child.type === 'expression_statement') {
            const assignmentNode = child.namedChildren.find((node) => node.type === 'assignment');
            if (!assignmentNode) {
                continue;
            }
            const leftNode = assignmentNode.childForFieldName('left') ?? assignmentNode.namedChildren[0] ?? null;
            const name = (0, treeSitterBindingSupport_1.extractBindingNames)(leftNode, TREE_SITTER_PARSER_BINDING_PROFILE)[0];
            if (name === bindingName) {
                return createValueBinding(inferPythonAssignmentType(assignmentNode, bindingName));
            }
        }
    }
    return undefined;
}
function inferPythonAssignmentType(assignmentNode, fallbackName, ghostContext) {
    const leftNode = assignmentNode.childForFieldName('left') ?? assignmentNode.namedChildren[0] ?? null;
    const rightNode = assignmentNode.childForFieldName('right') ?? assignmentNode.namedChildren[1] ?? null;
    const explicitTypeNode = assignmentNode.namedChildren.find((node) => node.type === 'type') ?? null;
    if (explicitTypeNode) {
        return normalizeTypeText(explicitTypeNode.text);
    }
    return inferPythonValueType(rightNode, fallbackName, ghostContext, leftNode);
}
function inferPythonValueType(valueNode, fallbackName, ghostContext, leftNode) {
    if (!valueNode) {
        return guessBindingTypeFromName(fallbackName);
    }
    if (valueNode.type === 'dictionary') {
        const fields = [];
        for (const pair of valueNode.namedChildren.filter((node) => node.type === 'pair')) {
            const key = pair.namedChildren[0]?.text.replace(/^['"]|['"]$/g, '') ?? '';
            const val = pair.namedChildren[1] ?? null;
            if (key) {
                fields.push(`${key}: ${inferPythonValueType(val, key, ghostContext)}`);
            }
        }
        return fields.length > 0 ? `{ ${fields.join('; ')} }` : 'dict';
    }
    if (valueNode.type === 'list' || valueNode.type === 'tuple') {
        return 'list';
    }
    if (valueNode.type === 'string') {
        return 'str';
    }
    if (valueNode.type === 'integer' || valueNode.type === 'float') {
        return 'number';
    }
    if (valueNode.type === 'true' || valueNode.type === 'false') {
        return 'bool';
    }
    if (valueNode.type === 'identifier') {
        const binding = ghostContext?.importedBindings.get(valueNode.text) ?? ghostContext?.moduleBindings.get(valueNode.text);
        return resolveBindingValueType(binding, valueNode.text);
    }
    if (valueNode.type === 'attribute') {
        const rootName = getNameText(valueNode.namedChildren[0] ?? null);
        const propertyName = getNameText(valueNode.namedChildren[1] ?? null);
        const binding = ghostContext?.importedBindings.get(rootName) ?? ghostContext?.moduleBindings.get(rootName);
        return binding?.typeName === 'module'
            ? guessBindingTypeFromName(propertyName || rootName || fallbackName)
            : resolveBindingValueType(binding, rootName || fallbackName);
    }
    if (valueNode.type === 'call') {
        const callee = valueNode.namedChildren[0] ?? null;
        const calleeName = getNameText(callee);
        const binding = calleeName
            ? ghostContext?.importedBindings.get(calleeName) ?? ghostContext?.moduleBindings.get(calleeName)
            : undefined;
        return resolveBindingValueType(binding, calleeName || fallbackName);
    }
    if (leftNode?.type === 'attribute') {
        const propertyName = getNameText(leftNode.namedChildren[1] ?? null);
        if (propertyName) {
            return guessBindingTypeFromName(propertyName);
        }
    }
    return guessBindingTypeFromName(fallbackName);
}
function buildGoGhostContext(rootNode, filePath, parsedFiles) {
    return {
        importedBindings: collectGoImportedBindings(rootNode, filePath, parsedFiles),
        moduleBindings: collectGoModuleBindings(rootNode)
    };
}
function collectGoImportedBindings(rootNode, _filePath, _parsedFiles) {
    const bindings = new Map();
    for (const importDeclaration of rootNode.descendantsOfType('import_declaration')) {
        for (const importSpec of importDeclaration.descendantsOfType('import_spec')) {
            const aliasNode = importSpec.namedChildren.find((node) => node.type === 'package_identifier');
            const moduleNode = importSpec.namedChildren.find((node) => node.type === 'interpreted_string_literal' || node.type === 'raw_string_literal');
            const modulePath = stripQuotedLiteral(moduleNode?.text ?? '');
            const localName = aliasNode?.text || modulePath.split('/').pop() || '';
            if (!localName || localName === '_' || localName === '.') {
                continue;
            }
            bindings.set(localName, {
                typeName: 'module'
            });
        }
    }
    return bindings;
}
function collectGoModuleBindings(rootNode) {
    const bindings = new Map();
    for (const child of rootNode.namedChildren) {
        if (child.type === 'function_declaration') {
            const localName = getNameText(child.childForFieldName('name'));
            if (localName) {
                bindings.set(localName, createCallableBinding(localName, extractGoReturnType(child)));
            }
            continue;
        }
        if (child.type === 'type_declaration') {
            for (const typeSpec of child.namedChildren.filter((node) => node.type === 'type_spec')) {
                const localName = getNameText(typeSpec.namedChildren.find((node) => node.type === 'type_identifier') ?? null);
                if (localName) {
                    bindings.set(localName, createValueBinding(localName));
                }
            }
            continue;
        }
    }
    for (const child of rootNode.namedChildren) {
        if (child.type !== 'var_declaration' && child.type !== 'const_declaration') {
            continue;
        }
        for (const specNode of child.namedChildren.filter((node) => node.type === 'var_spec' || node.type === 'const_spec')) {
            const nameNodes = specNode.namedChildren.filter((node) => node.type === 'identifier');
            if (nameNodes.length === 0) {
                continue;
            }
            const typeName = inferGoBindingType(specNode, nameNodes[0]?.text ?? 'unknown', bindings);
            for (const nameNode of nameNodes) {
                bindings.set(nameNode.text, createValueBinding(typeName));
            }
        }
    }
    return bindings;
}
function collectGoStructPropertyTypes(rootNode, receiverType) {
    const propertyTypes = new Map();
    if (!receiverType) {
        return propertyTypes;
    }
    for (const typeDeclaration of rootNode.namedChildren.filter((node) => node.type === 'type_declaration')) {
        for (const typeSpec of typeDeclaration.namedChildren.filter((node) => node.type === 'type_spec')) {
            const typeName = getNameText(typeSpec.namedChildren.find((node) => node.type === 'type_identifier') ?? null);
            if (typeName !== receiverType) {
                continue;
            }
            const structNode = typeSpec.namedChildren.find((node) => node.type === 'struct_type');
            const fieldList = structNode?.namedChildren.find((node) => node.type === 'field_declaration_list') ?? null;
            if (!fieldList) {
                continue;
            }
            for (const fieldNode of fieldList.namedChildren.filter((node) => node.type === 'field_declaration')) {
                const fieldNames = fieldNode.namedChildren.filter((node) => node.type === 'field_identifier');
                const typeNode = [...fieldNode.namedChildren]
                    .reverse()
                    .find((node) => node.type !== 'field_identifier');
                const typeNameText = normalizeTypeText(typeNode?.text ?? 'unknown');
                for (const fieldName of fieldNames) {
                    propertyTypes.set(fieldName.text, typeNameText);
                }
            }
        }
    }
    return propertyTypes;
}
function collectGoGhostDemand(executableNode, ghostContext, classPropertyTypes = new Map(), receiverBindingName = '') {
    const ghostStates = new Map();
    const selfNames = receiverBindingName ? [receiverBindingName] : [];
    for (const reference of (0, treeSitterGhostScanner_1.scanTreeSitterGhostReferences)(executableNode, {
        localDeclarationNodes: ['short_var_declaration', 'var_spec', 'const_spec', 'range_clause'],
        memberExpressionNodes: ['selector_expression'],
        functionBodyNodes: ['block'],
        selfNames
    })) {
        if (reference.kind === 'self') {
            const propertyName = reference.propertyName ?? reference.rootName;
            const typeName = classPropertyTypes.get(propertyName) ?? 'unknown';
            registerGhostState(ghostStates, reference.label, typeName, reference.mode);
            continue;
        }
        const binding = ghostContext.importedBindings.get(reference.rootName) ?? ghostContext.moduleBindings.get(reference.rootName);
        if (!binding) {
            continue;
        }
        registerGhostState(ghostStates, reference.label, binding.typeName, reference.mode);
    }
    return Array.from(ghostStates.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, state]) => {
        if (state.read && state.write) {
            return `[Ghost:ReadWrite] ${state.typeName} (${label})`;
        }
        if (state.write) {
            return `[Ghost:Write] ${state.typeName} (${label})`;
        }
        return `[Ghost:Read] ${state.typeName} (${label})`;
    });
}
function inferGoBindingType(specNode, fallbackName, bindings) {
    const namedChildren = specNode.namedChildren;
    const explicitTypeNode = namedChildren.find((node) => node.type !== 'identifier' &&
        node.type !== 'expression_list' &&
        node.type !== 'interpreted_string_literal' &&
        node.type !== 'raw_string_literal');
    if (explicitTypeNode) {
        return normalizeTypeText(explicitTypeNode.text);
    }
    const expressionList = namedChildren.find((node) => node.type === 'expression_list') ?? null;
    const valueNode = expressionList?.namedChildren[0] ?? null;
    if (!valueNode) {
        return guessBindingTypeFromName(fallbackName);
    }
    if (valueNode.type === 'composite_literal') {
        return normalizeTypeText(valueNode.namedChildren[0]?.text ?? fallbackName);
    }
    if (valueNode.type === 'call_expression') {
        const calleeName = getNameText(valueNode.namedChildren[0] ?? null) || fallbackName;
        return resolveBindingValueType(bindings?.get(calleeName), calleeName);
    }
    if (valueNode.type === 'identifier') {
        return resolveBindingValueType(bindings?.get(valueNode.text), valueNode.text);
    }
    if (valueNode.type === 'selector_expression') {
        const rootName = getNameText(valueNode.namedChildren[0] ?? null);
        const propertyName = getNameText(valueNode.namedChildren[1] ?? null);
        const binding = rootName ? bindings?.get(rootName) : undefined;
        return binding?.typeName === 'module'
            ? guessBindingTypeFromName(propertyName || rootName || fallbackName)
            : resolveBindingValueType(binding, propertyName || rootName || fallbackName);
    }
    return guessBindingTypeFromName(fallbackName);
}
function extractGoReceiverBindingName(receiverNode) {
    if (!receiverNode) {
        return '';
    }
    const match = receiverNode.text.replace(/[()]/g, '').trim().match(/^([A-Za-z_]\w*)\b/);
    return match?.[1] ?? '';
}
function collectGoNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    if (config.parser.scanMode === 'capability' || config.parser.scanMode === 'module' || config.parser.scanMode === 'domain') {
        return collectGoCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
    }
    return collectGoLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles);
}
function collectGoLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(sourcePath).replace(/\.go$/, ''));
    const ghostContext = buildGoGhostContext(rootNode, filePath, parsedFiles);
    for (const node of rootNode.namedChildren) {
        if (node.type === 'method_declaration') {
            const receiver = node.childForFieldName('receiver') ?? node.namedChildren[0];
            const receiverType = extractGoReceiverType(receiver);
            const methodName = getNameText(node.childForFieldName('name'));
            if (!receiverType || !methodName) {
                continue;
            }
            const receiverBindingName = extractGoReceiverBindingName(receiver);
            const classPropertyTypes = collectGoStructPropertyTypes(rootNode, receiverType);
            const ghostDemand = collectGoGhostDemand(node, ghostContext, classPropertyTypes, receiverBindingName);
            triadGraph.push(createTriadNode(`${receiverType}.${methodName}`, category, sourcePath, mergeDemandEntries(parseGoParametersAst(node.childForFieldName('parameters')), ghostDemand), [extractGoReturnType(node)]));
            continue;
        }
        if (node.type === 'function_declaration') {
            const functionName = getNameText(node.childForFieldName('name'));
            if (!functionName) {
                continue;
            }
            const ghostDemand = collectGoGhostDemand(node, ghostContext);
            triadGraph.push(createTriadNode(`${moduleName}.${functionName}`, category, sourcePath, mergeDemandEntries(parseGoParametersAst(node.childForFieldName('parameters')), ghostDemand), [extractGoReturnType(node)]));
        }
    }
    return triadGraph;
}
function collectGoCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(sourcePath).replace(/\.go$/, ''));
    const ghostContext = buildGoGhostContext(rootNode, filePath, parsedFiles);
    const methodsByReceiver = new Map();
    const topLevelRecords = [];
    for (const node of rootNode.namedChildren) {
        if (node.type === 'method_declaration') {
            const receiver = node.childForFieldName('receiver') ?? node.namedChildren[0];
            const receiverType = extractGoReceiverType(receiver);
            const methodName = getNameText(node.childForFieldName('name'));
            if (!receiverType || !methodName) {
                continue;
            }
            const receiverBindingName = extractGoReceiverBindingName(receiver);
            const classPropertyTypes = collectGoStructPropertyTypes(rootNode, receiverType);
            const ghostDemand = collectGoGhostDemand(node, ghostContext, classPropertyTypes, receiverBindingName);
            const record = {
                name: methodName,
                demand: mergeDemandEntries(parseGoParametersAst(node.childForFieldName('parameters')), ghostDemand),
                answer: [normalizeGenericContractType(extractGoReturnType(node))]
            };
            const bucket = methodsByReceiver.get(receiverType) ?? [];
            bucket.push(record);
            methodsByReceiver.set(receiverType, bucket);
            continue;
        }
        if (node.type === 'function_declaration') {
            const functionName = getNameText(node.childForFieldName('name'));
            if (!functionName) {
                continue;
            }
            const ghostDemand = collectGoGhostDemand(node, ghostContext);
            topLevelRecords.push({
                name: functionName,
                demand: mergeDemandEntries(parseGoParametersAst(node.childForFieldName('parameters')), ghostDemand),
                answer: [normalizeGenericContractType(extractGoReturnType(node))]
            });
        }
    }
    for (const [receiverType, records] of methodsByReceiver.entries()) {
        if (isSuppressedCapabilityContainerName(receiverType, config)) {
            continue;
        }
        const promotable = records.filter((record) => !isGoNoiseCapability(record.name, config, sourcePath, record));
        if (promotable.length === 0) {
            continue;
        }
        const entrypoint = promotable.find((record) => isGoPrimaryCapabilityMethod(record.name, config));
        if (entrypoint && shouldPromoteGoCapability(entrypoint.name, sourcePath, receiverType, config, entrypoint)) {
            const foldedRecords = getFoldableCapabilityRecords(records, promotable, config, new Set());
            triadGraph.push(createTriadNode(`${receiverType}.${entrypoint.name}`, category, sourcePath, mergeCapabilityDemand(foldedRecords.map((record) => record.demand)), mergeCapabilityAnswer(foldedRecords.map((record) => record.answer)), `execute ${receiverType} capability pipeline`, buildFoldedLeafIds(receiverType, foldedRecords)));
            continue;
        }
        const capabilityMethods = promotable.filter((record) => shouldPromoteGoCapability(record.name, sourcePath, receiverType, config, record));
        if (capabilityMethods.length > 0) {
            triadGraph.push(...capabilityMethods.map((record) => createTriadNode(`${receiverType}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${receiverType}.${record.name} capability`)));
            continue;
        }
        triadGraph.push(createTriadNode(`${receiverType}.capability`, category, sourcePath, mergeCapabilityDemand(getFoldableCapabilityRecords(records, promotable, config, new Set()).map((record) => record.demand)), mergeCapabilityAnswer(getFoldableCapabilityRecords(records, promotable, config, new Set()).map((record) => record.answer)), `execute ${receiverType} aggregate capability`, buildFoldedLeafIds(receiverType, getFoldableCapabilityRecords(records, promotable, config, new Set()))));
    }
    const promotableTopLevel = topLevelRecords.filter((record) => !isGoNoiseCapability(record.name, config, sourcePath, record));
    const promotedTopLevel = promotableTopLevel.filter((record) => shouldPromoteGoCapability(record.name, sourcePath, undefined, config, record));
    for (const record of promotedTopLevel) {
        triadGraph.push(createTriadNode(`${moduleName}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${moduleName}.${record.name} capability`));
    }
    const moduleAggregateRecords = resolveTopLevelModuleAggregateRecords(sourcePath, topLevelRecords, promotableTopLevel);
    if (triadGraph.length === 0 && moduleAggregateRecords.length > 0) {
        triadGraph.push(createTriadNode(`${moduleName}.module_pipeline`, category, sourcePath, mergeCapabilityDemand(moduleAggregateRecords.map((record) => record.demand)), mergeCapabilityAnswer(moduleAggregateRecords.map((record) => record.answer)), `execute ${moduleName} module capability`));
    }
    return triadGraph;
}
function buildRustGhostContext(rootNode, filePath, parsedFiles) {
    return {
        importedBindings: collectRustImportedBindings(rootNode, filePath, parsedFiles),
        moduleBindings: collectRustModuleBindings(rootNode)
    };
}
function collectRustImportedBindings(rootNode, filePath, parsedFiles) {
    const bindings = new Map();
    for (const useDeclaration of rootNode.descendantsOfType('use_declaration')) {
        for (const binding of collectRustUseBindings(useDeclaration, filePath, parsedFiles)) {
            bindings.set(binding.localName, {
                typeName: binding.typeName,
                callableReturnType: binding.callableReturnType
            });
        }
    }
    return bindings;
}
function collectRustUseBindings(node, currentFilePath, parsedFiles, inheritedPrefix = '') {
    if (node.type === 'use_as_clause') {
        const aliasNode = node.namedChildren[node.namedChildren.length - 1] ?? null;
        const importedNode = node.namedChildren[0] ?? null;
        const localName = getNameText(aliasNode);
        const importedPath = inheritedPrefix ? `${inheritedPrefix}::${importedNode?.text ?? ''}` : importedNode?.text ?? '';
        if (!localName) {
            return [];
        }
        return [resolveRustImportedBinding(importedPath, localName, currentFilePath, parsedFiles)];
    }
    if (node.type === 'scoped_use_list') {
        const prefixNode = node.namedChildren.find((child) => child.type !== 'use_list') ?? null;
        const useListNode = node.namedChildren.find((child) => child.type === 'use_list') ?? null;
        const nextPrefix = inheritedPrefix
            ? `${inheritedPrefix}::${prefixNode?.text ?? ''}`
            : prefixNode?.text ?? '';
        return useListNode ? useListNode.namedChildren.flatMap((child) => collectRustUseBindings(child, currentFilePath, parsedFiles, nextPrefix)) : [];
    }
    if (node.type === 'use_list') {
        return node.namedChildren.flatMap((child) => collectRustUseBindings(child, currentFilePath, parsedFiles, inheritedPrefix));
    }
    if (node.type === 'scoped_identifier') {
        if (node.parent?.type === 'use_as_clause' || node.parent?.type === 'scoped_use_list') {
            return [];
        }
        const fullPath = inheritedPrefix ? `${inheritedPrefix}::${node.text}` : node.text;
        const localName = getRustPathBindingName(fullPath);
        return localName ? [resolveRustImportedBinding(fullPath, localName, currentFilePath, parsedFiles)] : [];
    }
    if ((node.type === 'identifier' || node.type === 'crate' || node.type === 'self' || node.type === 'super') &&
        (node.parent?.type === 'use_declaration' || node.parent?.type === 'use_list')) {
        const fullPath = inheritedPrefix ? `${inheritedPrefix}::${node.text}` : node.text;
        return [resolveRustImportedBinding(fullPath, getNameText(node) || node.text, currentFilePath, parsedFiles)];
    }
    return node.namedChildren.flatMap((child) => collectRustUseBindings(child, currentFilePath, parsedFiles, inheritedPrefix));
}
function collectRustModuleBindings(rootNode) {
    const bindings = new Map();
    for (const child of rootNode.namedChildren) {
        if (child.type === 'function_item') {
            const localName = getNameText(child.childForFieldName('name'));
            if (localName) {
                bindings.set(localName, createCallableBinding(localName, extractRustReturnType(child)));
            }
            continue;
        }
        if (child.type === 'struct_item' || child.type === 'enum_item' || child.type === 'trait_item' || child.type === 'type_item') {
            const localName = getFirstNamedChildText(child, ['type_identifier']);
            if (localName) {
                bindings.set(localName, createValueBinding(localName));
            }
            continue;
        }
        if (child.type !== 'static_item' && child.type !== 'const_item') {
            continue;
        }
        const localName = getNameText(child.childForFieldName('name') ?? child.namedChildren.find((node) => node.type === 'identifier') ?? null);
        if (!localName) {
            continue;
        }
        const explicitType = child.childForFieldName('type') ?? child.namedChildren.find((node) => node.type.endsWith('_type')) ?? null;
        bindings.set(localName, createValueBinding(explicitType?.text ?? guessBindingTypeFromName(localName)));
    }
    return bindings;
}
function resolveRustImportedBinding(importPath, localName, currentFilePath, parsedFiles) {
    const bindingName = getRustPathBindingName(importPath) || localName;
    const targetFile = resolveRustImportedParsedFile(currentFilePath, importPath, parsedFiles);
    const binding = targetFile ? lookupRustExportedBindingInfo(targetFile.rootNode, bindingName) : undefined;
    return {
        localName,
        typeName: binding?.typeName ?? guessBindingTypeFromName(bindingName || localName),
        callableReturnType: binding?.callableReturnType
    };
}
function resolveRustImportedParsedFile(currentFilePath, importPath, parsedFiles) {
    if (!importPath) {
        return undefined;
    }
    const segments = importPath.split('::').filter(Boolean);
    if (segments.length < 2) {
        return undefined;
    }
    const crateRoot = findRustCrateRoot(currentFilePath);
    const head = segments[0];
    const moduleSegments = segments.slice(1, -1);
    let baseDir = path.dirname(currentFilePath);
    if (head === 'crate') {
        baseDir = crateRoot;
    }
    else if (head === 'super') {
        baseDir = path.dirname(path.dirname(currentFilePath));
    }
    else if (head === 'self') {
        baseDir = path.dirname(currentFilePath);
    }
    else {
        return undefined;
    }
    const candidates = moduleSegments.length === 0
        ? [path.join(crateRoot, 'lib.rs'), path.join(crateRoot, 'main.rs')].map((candidate) => path.normalize(candidate))
        : [
            `${path.join(baseDir, ...moduleSegments)}.rs`,
            path.join(baseDir, ...moduleSegments, 'mod.rs')
        ].map((candidate) => path.normalize(candidate));
    return parsedFiles.find((entry) => candidates.includes(path.normalize(entry.filePath)));
}
function findRustCrateRoot(currentFilePath) {
    let currentDir = path.dirname(currentFilePath);
    while (currentDir && currentDir !== path.dirname(currentDir)) {
        if (path.basename(currentDir) === 'src') {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    return path.dirname(currentFilePath);
}
function getRustPathBindingName(importPath) {
    const segments = importPath.split('::').filter(Boolean);
    return segments[segments.length - 1] ?? '';
}
function lookupRustExportedBindingInfo(rootNode, bindingName) {
    for (const child of rootNode.namedChildren) {
        if (child.type === 'function_item') {
            const localName = getNameText(child.childForFieldName('name'));
            if (localName === bindingName) {
                return createCallableBinding(localName, extractRustReturnType(child));
            }
            continue;
        }
        if (child.type === 'struct_item' || child.type === 'enum_item' || child.type === 'trait_item' || child.type === 'type_item') {
            const localName = getFirstNamedChildText(child, ['type_identifier']);
            if (localName === bindingName) {
                return createValueBinding(localName);
            }
            continue;
        }
        if (child.type === 'static_item' || child.type === 'const_item') {
            const localName = getNameText(child.childForFieldName('name') ?? child.namedChildren.find((node) => node.type === 'identifier') ?? null);
            if (localName === bindingName) {
                const explicitType = child.childForFieldName('type') ?? child.namedChildren.find((node) => node.type.endsWith('_type')) ?? null;
                return createValueBinding(explicitType?.text ?? localName);
            }
        }
    }
    return undefined;
}
function collectRustStructPropertyTypes(rootNode, implType) {
    const propertyTypes = new Map();
    if (!implType) {
        return propertyTypes;
    }
    for (const structNode of rootNode.namedChildren.filter((node) => node.type === 'struct_item')) {
        const typeName = getFirstNamedChildText(structNode, ['type_identifier']);
        if (typeName !== implType) {
            continue;
        }
        const fieldList = structNode.namedChildren.find((node) => node.type === 'field_declaration_list') ?? null;
        if (!fieldList) {
            continue;
        }
        for (const fieldNode of fieldList.namedChildren.filter((node) => node.type === 'field_declaration')) {
            const fieldName = getNameText(fieldNode.namedChildren.find((node) => node.type === 'field_identifier') ?? null);
            const typeNode = [...fieldNode.namedChildren]
                .reverse()
                .find((node) => node.type !== 'field_identifier');
            if (!fieldName) {
                continue;
            }
            propertyTypes.set(fieldName, normalizeTypeText(typeNode?.text ?? 'unknown'));
        }
    }
    return propertyTypes;
}
function collectRustGhostDemand(executableNode, ghostContext, classPropertyTypes = new Map()) {
    const ghostStates = new Map();
    for (const reference of (0, treeSitterGhostScanner_1.scanTreeSitterGhostReferences)(executableNode, {
        localDeclarationNodes: ['let_declaration'],
        memberExpressionNodes: ['field_expression'],
        functionBodyNodes: ['block'],
        selfNames: ['self']
    })) {
        if (reference.kind === 'self') {
            const propertyName = reference.propertyName ?? reference.rootName;
            const typeName = classPropertyTypes.get(propertyName) ?? 'unknown';
            registerGhostState(ghostStates, reference.label, typeName, reference.mode);
            continue;
        }
        const binding = ghostContext.importedBindings.get(reference.rootName) ?? ghostContext.moduleBindings.get(reference.rootName);
        if (!binding) {
            continue;
        }
        registerGhostState(ghostStates, reference.label, binding.typeName, reference.mode);
    }
    return Array.from(ghostStates.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, state]) => {
        if (state.read && state.write) {
            return `[Ghost:ReadWrite] ${state.typeName} (${label})`;
        }
        if (state.write) {
            return `[Ghost:Write] ${state.typeName} (${label})`;
        }
        return `[Ghost:Read] ${state.typeName} (${label})`;
    });
}
function collectRustNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    if (config.parser.scanMode === 'capability' || config.parser.scanMode === 'module' || config.parser.scanMode === 'domain') {
        return collectRustCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
    }
    return collectRustLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles);
}
function collectRustLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(filePath).replace(/\.rs$/, ''));
    const ghostContext = buildRustGhostContext(rootNode, filePath, parsedFiles);
    for (const node of rootNode.namedChildren) {
        if (node.type === 'impl_item') {
            const implType = getFirstNamedChildText(node, ['type_identifier', 'primitive_type']);
            const declarationList = node.childForFieldName('body') ?? node.namedChildren.find((child) => child.type === 'declaration_list');
            if (!implType || !declarationList) {
                continue;
            }
            const classPropertyTypes = collectRustStructPropertyTypes(rootNode, implType);
            for (const functionNode of declarationList.namedChildren.filter((child) => child.type === 'function_item')) {
                const functionName = getNameText(functionNode.childForFieldName('name'));
                if (!functionName) {
                    continue;
                }
                const ghostDemand = collectRustGhostDemand(functionNode, ghostContext, classPropertyTypes);
                triadGraph.push(createTriadNode(`${implType}.${functionName}`, category, sourcePath, mergeDemandEntries(parseRustParametersAst(functionNode.childForFieldName('parameters')), ghostDemand), [extractRustReturnType(functionNode)]));
            }
            continue;
        }
        if (node.type === 'function_item') {
            const functionName = getNameText(node.childForFieldName('name'));
            if (!functionName) {
                continue;
            }
            const ghostDemand = collectRustGhostDemand(node, ghostContext);
            triadGraph.push(createTriadNode(`${moduleName}.${functionName}`, category, sourcePath, mergeDemandEntries(parseRustParametersAst(node.childForFieldName('parameters')), ghostDemand), [extractRustReturnType(node)]));
        }
    }
    return triadGraph;
}
function buildCppGhostContext(rootNode, filePath, parsedFiles) {
    return {
        importedBindings: collectCppImportedBindings(rootNode, filePath, parsedFiles),
        moduleBindings: collectCppModuleBindings(rootNode)
    };
}
function collectCppImportedBindings(rootNode, filePath, parsedFiles) {
    const bindings = new Map();
    for (const includeNode of rootNode.descendantsOfType('preproc_include')) {
        const includePath = includeNode.namedChildren.find((child) => child.type === 'string_literal')?.namedChildren[0]?.text ?? '';
        if (!includePath) {
            continue;
        }
        const targetFile = resolveIncludedParsedFile(filePath, includePath, parsedFiles);
        if (!targetFile) {
            continue;
        }
        for (const [name, binding] of collectCppModuleBindings(targetFile.rootNode).entries()) {
            if (!bindings.has(name)) {
                bindings.set(name, binding);
            }
        }
    }
    return bindings;
}
function collectCppModuleBindings(rootNode) {
    const bindings = new Map();
    for (const child of rootNode.namedChildren) {
        if (child.type === 'declaration') {
            const typeNode = child.namedChildren.find((node) => node.type === 'type_identifier' || node.type.endsWith('_type') || node.type === 'primitive_type');
            const localName = getNameText(child.namedChildren.find((node) => node.type === 'identifier' || node.type === 'field_identifier') ?? null);
            if (localName) {
                bindings.set(localName, createValueBinding(typeNode?.text ?? guessBindingTypeFromName(localName)));
            }
            continue;
        }
        if (child.type === 'function_definition') {
            const declarator = child.childForFieldName('declarator') ?? child.namedChildren.find((node) => node.type === 'function_declarator');
            const nameNode = declarator?.childForFieldName('declarator') ??
                declarator?.childForFieldName('name') ??
                declarator?.namedChildren.find((node) => node.type === 'identifier' || node.type === 'qualified_identifier') ??
                null;
            const localName = getNameText(nameNode);
            if (localName) {
                bindings.set(localName, createCallableBinding(localName, extractCppReturnType(child)));
            }
            continue;
        }
        if (child.type === 'class_specifier' || child.type === 'struct_specifier') {
            const localName = getFirstNamedChildText(child, ['type_identifier']);
            if (localName) {
                bindings.set(localName, createValueBinding(localName));
            }
        }
    }
    return bindings;
}
function collectCppClassPropertyTypes(classNode) {
    const propertyTypes = new Map();
    const body = classNode.childForFieldName('body') ?? classNode.namedChildren.find((child) => child.type === 'field_declaration_list');
    if (!body) {
        return propertyTypes;
    }
    for (const field of body.namedChildren.filter((child) => child.type === 'field_declaration')) {
        const declarator = field.descendantsOfType('function_declarator')[0];
        if (declarator) {
            continue;
        }
        const typeNode = field.namedChildren.find((node) => node.type === 'type_identifier' || node.type.endsWith('_type') || node.type === 'primitive_type');
        const typeName = normalizeTypeText(typeNode?.text ?? 'unknown');
        for (const fieldNameNode of field.namedChildren.filter((node) => node.type === 'field_identifier')) {
            propertyTypes.set(fieldNameNode.text, typeName);
        }
    }
    return propertyTypes;
}
function collectCppGhostDemand(executableNode, ghostContext, classPropertyTypes = new Map()) {
    const ghostStates = new Map();
    for (const reference of (0, treeSitterGhostScanner_1.scanTreeSitterGhostReferences)(executableNode, {
        localDeclarationNodes: ['declaration', 'init_declarator', 'for_range_loop'],
        memberExpressionNodes: ['field_expression', 'qualified_identifier'],
        functionBodyNodes: ['compound_statement'],
        selfNames: ['this']
    })) {
        if (reference.kind === 'self') {
            const propertyName = reference.propertyName ?? reference.rootName;
            const typeName = classPropertyTypes.get(propertyName) ?? 'unknown';
            registerGhostState(ghostStates, reference.label, typeName, reference.mode);
            continue;
        }
        const selfTypeName = classPropertyTypes.get(reference.rootName);
        if (selfTypeName) {
            registerGhostState(ghostStates, reference.label, selfTypeName, reference.mode);
            continue;
        }
        const binding = ghostContext.importedBindings.get(reference.rootName) ?? ghostContext.moduleBindings.get(reference.rootName);
        if (!binding) {
            continue;
        }
        registerGhostState(ghostStates, reference.label, binding.typeName, reference.mode);
    }
    return Array.from(ghostStates.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, state]) => {
        if (state.read && state.write) {
            return `[Ghost:ReadWrite] ${state.typeName} (${label})`;
        }
        if (state.write) {
            return `[Ghost:Write] ${state.typeName} (${label})`;
        }
        return `[Ghost:Read] ${state.typeName} (${label})`;
    });
}
function collectCppNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    if (config.parser.scanMode === 'capability' || config.parser.scanMode === 'module' || config.parser.scanMode === 'domain') {
        return collectCppCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
    }
    return collectCppLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles);
}
function collectCppLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(filePath).replace(/\.(cpp|cc|cxx|hpp|hh|h)$/i, ''));
    const ghostContext = buildCppGhostContext(rootNode, filePath, parsedFiles);
    for (const node of rootNode.namedChildren) {
        if (node.type === 'class_specifier' || node.type === 'struct_specifier') {
            const className = getFirstNamedChildText(node, ['type_identifier']);
            const body = node.childForFieldName('body') ?? node.namedChildren.find((child) => child.type === 'field_declaration_list');
            if (!className || !body) {
                continue;
            }
            const classPropertyTypes = collectCppClassPropertyTypes(node);
            for (const memberNode of body.namedChildren.filter((child) => child.type === 'field_declaration' || child.type === 'function_definition')) {
                const declarator = memberNode.type === 'function_definition'
                    ? memberNode.childForFieldName('declarator') ?? memberNode.namedChildren.find((child) => child.type === 'function_declarator')
                    : memberNode.descendantsOfType('function_declarator')[0];
                const methodName = getNameText(declarator?.childForFieldName('declarator') ?? declarator?.childForFieldName('name') ?? declarator?.namedChildren[0]);
                if (!declarator || !methodName || methodName === className || methodName === `~${className}`) {
                    continue;
                }
                const functionNode = memberNode.type === 'function_definition'
                    ? memberNode
                    : memberNode.namedChildren.find((child) => child.type === 'function_definition') ?? declarator.parent?.parent ?? memberNode;
                const ghostDemand = collectCppGhostDemand(functionNode, ghostContext, classPropertyTypes);
                triadGraph.push(createTriadNode(`${className}.${methodName}`, category, sourcePath, mergeDemandEntries(parseCppParametersAst(declarator.childForFieldName('parameters') ??
                    declarator.namedChildren.find((child) => child.type === 'parameter_list') ??
                    null), ghostDemand), [extractCppReturnType(memberNode)]));
            }
            continue;
        }
        if (node.type === 'function_definition') {
            const declarator = node.childForFieldName('declarator') ?? node.namedChildren.find((child) => child.type === 'function_declarator');
            if (!declarator) {
                continue;
            }
            const nameNode = declarator.childForFieldName('declarator') ??
                declarator.childForFieldName('name') ??
                declarator.namedChildren.find((child) => child.type === 'qualified_identifier' || child.type === 'identifier');
            const qualifiedNode = nameNode?.type === 'qualified_identifier' ? nameNode : null;
            const functionName = getNameText(qualifiedNode ? qualifiedNode.namedChildren[qualifiedNode.namedChildren.length - 1] : nameNode);
            const ownerName = qualifiedNode ? getFirstNamedChildText(qualifiedNode, ['namespace_identifier', 'type_identifier']) : moduleName;
            if (!functionName || !ownerName) {
                continue;
            }
            const ghostDemand = collectCppGhostDemand(node, ghostContext);
            triadGraph.push(createTriadNode(`${ownerName}.${functionName}`, category, sourcePath, mergeDemandEntries(parseCppParametersAst(declarator.childForFieldName('parameters') ??
                declarator.namedChildren.find((child) => child.type === 'parameter_list') ??
                null), ghostDemand), [extractCppReturnType(node)]));
        }
    }
    return triadGraph;
}
function buildJavaGhostContext(rootNode, filePath, parsedFiles) {
    return {
        importedBindings: collectJavaImportedBindings(rootNode, filePath, parsedFiles),
        moduleBindings: collectJavaModuleBindings(rootNode)
    };
}
function collectJavaImportedBindings(rootNode, _filePath, parsedFiles) {
    const bindings = new Map();
    for (const importNode of rootNode.descendantsOfType('import_declaration')) {
        const scopedNode = importNode.namedChildren.find((node) => node.type === 'scoped_identifier' || node.type === 'identifier');
        const importPath = scopedNode?.text ?? '';
        const localName = getScopedPathTail(importPath, '.');
        if (!localName) {
            continue;
        }
        bindings.set(localName, resolveJavaImportedBindingInfo(importPath, parsedFiles, localName));
    }
    return bindings;
}
function collectJavaModuleBindings(rootNode) {
    const bindings = new Map();
    for (const classNode of rootNode.namedChildren.filter((node) => node.type === 'class_declaration')) {
        const className = getNameText(classNode.childForFieldName('name'));
        if (!className) {
            continue;
        }
        bindings.set(className, createValueBinding(className));
        const classBody = classNode.childForFieldName('body');
        if (!classBody) {
            continue;
        }
        for (const child of classBody.namedChildren) {
            if (child.type === 'field_declaration') {
                const typeNode = child.childForFieldName('type') ?? child.namedChildren.find((node) => node.type.endsWith('_type')) ?? null;
                const typeName = normalizeTypeText(typeNode?.text ?? 'unknown');
                for (const declarator of child.namedChildren.filter((node) => node.type === 'variable_declarator')) {
                    const localName = getNameText(declarator.childForFieldName('name') ?? declarator.namedChildren[0] ?? null);
                    if (localName) {
                        bindings.set(localName, createValueBinding(typeName));
                    }
                }
                continue;
            }
            if (child.type === 'method_declaration') {
                const localName = getNameText(child.childForFieldName('name'));
                if (localName) {
                    bindings.set(localName, createCallableBinding(localName, normalizeTypeText(child.childForFieldName('type')?.text ?? 'unknown')));
                }
            }
        }
    }
    return bindings;
}
function collectJavaClassPropertyTypes(classNode) {
    const propertyTypes = new Map();
    const classBody = classNode.childForFieldName('body');
    if (!classBody) {
        return propertyTypes;
    }
    for (const child of classBody.namedChildren.filter((node) => node.type === 'field_declaration')) {
        const typeNode = child.childForFieldName('type') ?? child.namedChildren.find((node) => node.type.endsWith('_type')) ?? null;
        const typeName = normalizeTypeText(typeNode?.text ?? 'unknown');
        for (const declarator of child.namedChildren.filter((node) => node.type === 'variable_declarator')) {
            const propertyName = getNameText(declarator.childForFieldName('name') ?? declarator.namedChildren[0] ?? null);
            if (propertyName) {
                propertyTypes.set(propertyName, typeName);
            }
        }
    }
    return propertyTypes;
}
function collectJavaGhostDemand(executableNode, ghostContext, classPropertyTypes = new Map()) {
    const ghostStates = new Map();
    for (const reference of (0, treeSitterGhostScanner_1.scanTreeSitterGhostReferences)(executableNode, {
        localDeclarationNodes: ['local_variable_declaration', 'variable_declarator', 'catch_formal_parameter'],
        memberExpressionNodes: ['field_access', 'method_invocation'],
        functionBodyNodes: ['block'],
        selfNames: ['this']
    })) {
        if (reference.kind === 'self') {
            const propertyName = reference.propertyName ?? reference.rootName;
            const typeName = classPropertyTypes.get(propertyName) ?? 'unknown';
            registerGhostState(ghostStates, reference.label, typeName, reference.mode);
            continue;
        }
        const selfTypeName = classPropertyTypes.get(reference.rootName);
        if (selfTypeName) {
            registerGhostState(ghostStates, reference.label, selfTypeName, reference.mode);
            continue;
        }
        const binding = ghostContext.importedBindings.get(reference.rootName) ?? ghostContext.moduleBindings.get(reference.rootName);
        if (!binding) {
            continue;
        }
        registerGhostState(ghostStates, reference.label, binding.typeName, reference.mode);
    }
    return Array.from(ghostStates.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, state]) => {
        if (state.read && state.write) {
            return `[Ghost:ReadWrite] ${state.typeName} (${label})`;
        }
        if (state.write) {
            return `[Ghost:Write] ${state.typeName} (${label})`;
        }
        return `[Ghost:Read] ${state.typeName} (${label})`;
    });
}
function collectJavaNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    if (config.parser.scanMode === 'capability' || config.parser.scanMode === 'module' || config.parser.scanMode === 'domain') {
        return collectJavaCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles);
    }
    return collectJavaLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles);
}
function collectJavaLeafNodes(rootNode, filePath, sourcePath, category, parsedFiles) {
    const triadGraph = [];
    const ghostContext = buildJavaGhostContext(rootNode, filePath, parsedFiles);
    for (const classNode of rootNode.namedChildren.filter((node) => node.type === 'class_declaration')) {
        const className = getNameText(classNode.childForFieldName('name'));
        const classBody = classNode.childForFieldName('body');
        if (!className || !classBody) {
            continue;
        }
        const classPropertyTypes = collectJavaClassPropertyTypes(classNode);
        for (const methodNode of classBody.namedChildren.filter((child) => child.type === 'method_declaration')) {
            const methodName = getNameText(methodNode.childForFieldName('name'));
            if (!methodName) {
                continue;
            }
            const ghostDemand = collectJavaGhostDemand(methodNode, ghostContext, classPropertyTypes);
            triadGraph.push(createTriadNode(`${className}.${methodName}`, category, sourcePath, mergeDemandEntries(parseJavaParametersAst(methodNode.childForFieldName('parameters')), ghostDemand), [normalizeGenericContractType(methodNode.childForFieldName('type')?.text ?? 'void')]));
        }
    }
    return triadGraph;
}
function collectCppCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(filePath).replace(/\.(cpp|cc|cxx|hpp|hh|h)$/i, ''));
    const ghostContext = buildCppGhostContext(rootNode, filePath, parsedFiles);
    const classRecords = new Map();
    const topLevelRecords = [];
    for (const node of rootNode.namedChildren) {
        if (node.type === 'class_specifier' || node.type === 'struct_specifier') {
            const className = getFirstNamedChildText(node, ['type_identifier']);
            const body = node.childForFieldName('body') ?? node.namedChildren.find((child) => child.type === 'field_declaration_list');
            if (!className || !body) {
                continue;
            }
            const classPropertyTypes = collectCppClassPropertyTypes(node);
            for (const memberNode of body.namedChildren.filter((child) => child.type === 'field_declaration' || child.type === 'function_definition')) {
                const declarator = memberNode.type === 'function_definition'
                    ? memberNode.childForFieldName('declarator') ?? memberNode.namedChildren.find((child) => child.type === 'function_declarator')
                    : memberNode.descendantsOfType('function_declarator')[0];
                const methodName = getNameText(declarator?.childForFieldName('declarator') ?? declarator?.childForFieldName('name') ?? declarator?.namedChildren[0]);
                if (!declarator || !methodName || methodName === className || methodName === `~${className}`) {
                    continue;
                }
                const functionNode = memberNode.type === 'function_definition'
                    ? memberNode
                    : memberNode.namedChildren.find((child) => child.type === 'function_definition') ?? declarator.parent?.parent ?? memberNode;
                const ghostDemand = collectCppGhostDemand(functionNode, ghostContext, classPropertyTypes);
                const record = {
                    name: methodName,
                    demand: mergeDemandEntries(parseCppParametersAst(declarator.childForFieldName('parameters') ??
                        declarator.namedChildren.find((child) => child.type === 'parameter_list') ??
                        null), ghostDemand),
                    answer: [normalizeGenericContractType(extractCppReturnType(memberNode))]
                };
                const bucket = classRecords.get(className) ?? [];
                bucket.push(record);
                classRecords.set(className, bucket);
            }
            continue;
        }
        if (node.type === 'function_definition') {
            const declarator = node.childForFieldName('declarator') ?? node.namedChildren.find((child) => child.type === 'function_declarator');
            if (!declarator) {
                continue;
            }
            const nameNode = declarator.childForFieldName('declarator') ??
                declarator.childForFieldName('name') ??
                declarator.namedChildren.find((child) => child.type === 'qualified_identifier' || child.type === 'identifier');
            const qualifiedNode = nameNode?.type === 'qualified_identifier' ? nameNode : null;
            const functionName = getNameText(qualifiedNode ? qualifiedNode.namedChildren[qualifiedNode.namedChildren.length - 1] : nameNode);
            const ownerName = qualifiedNode ? getFirstNamedChildText(qualifiedNode, ['namespace_identifier', 'type_identifier']) : moduleName;
            if (!functionName || !ownerName) {
                continue;
            }
            const ghostDemand = collectCppGhostDemand(node, ghostContext);
            topLevelRecords.push({
                name: functionName,
                ownerName,
                demand: mergeDemandEntries(parseCppParametersAst(declarator.childForFieldName('parameters') ??
                    declarator.namedChildren.find((child) => child.type === 'parameter_list') ??
                    null), ghostDemand),
                answer: [normalizeGenericContractType(extractCppReturnType(node))]
            });
        }
    }
    for (const [className, records] of classRecords.entries()) {
        if (isSuppressedCapabilityContainerName(className, config)) {
            continue;
        }
        const promotable = records.filter((record) => !isCppNoiseCapability(record.name, config, sourcePath, record));
        if (promotable.length === 0) {
            continue;
        }
        const entrypoint = promotable.find((record) => isCppPrimaryCapabilityMethod(record.name, config));
        if (entrypoint && shouldPromoteCppCapability(entrypoint.name, sourcePath, className, config, entrypoint)) {
            const foldedRecords = getFoldableCapabilityRecords(records, promotable, config, CPP_MAGIC_METHODS);
            triadGraph.push(createTriadNode(`${className}.${entrypoint.name}`, category, sourcePath, mergeCapabilityDemand(foldedRecords.map((record) => record.demand)), mergeCapabilityAnswer(foldedRecords.map((record) => record.answer)), `execute ${className} capability pipeline`, buildFoldedLeafIds(className, foldedRecords)));
            continue;
        }
        const capabilityMethods = promotable.filter((record) => shouldPromoteCppCapability(record.name, sourcePath, className, config, record));
        if (capabilityMethods.length > 0) {
            triadGraph.push(...capabilityMethods.map((record) => createTriadNode(`${className}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${className}.${record.name} capability`)));
            continue;
        }
        triadGraph.push(createTriadNode(`${className}.capability`, category, sourcePath, mergeCapabilityDemand(getFoldableCapabilityRecords(records, promotable, config, CPP_MAGIC_METHODS).map((record) => record.demand)), mergeCapabilityAnswer(getFoldableCapabilityRecords(records, promotable, config, CPP_MAGIC_METHODS).map((record) => record.answer)), `execute ${className} aggregate capability`, buildFoldedLeafIds(className, getFoldableCapabilityRecords(records, promotable, config, CPP_MAGIC_METHODS))));
    }
    const promotableTopLevel = topLevelRecords.filter((record) => !isCppNoiseCapability(record.name, config, sourcePath, record));
    const promotedTopLevel = promotableTopLevel.filter((record) => (!record.ownerName || !isSuppressedCapabilityContainerName(record.ownerName, config)) &&
        shouldPromoteCppCapability(record.name, sourcePath, record.ownerName, config, record));
    for (const record of promotedTopLevel) {
        triadGraph.push(createTriadNode(`${record.ownerName ?? moduleName}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${(record.ownerName ?? moduleName)}.${record.name} capability`));
    }
    const moduleAggregateRecords = resolveTopLevelModuleAggregateRecords(sourcePath, topLevelRecords, promotableTopLevel);
    if (triadGraph.length === 0 && moduleAggregateRecords.length > 0) {
        triadGraph.push(createTriadNode(`${moduleName}.module_pipeline`, category, sourcePath, mergeCapabilityDemand(moduleAggregateRecords.map((record) => record.demand)), mergeCapabilityAnswer(moduleAggregateRecords.map((record) => record.answer)), `execute ${moduleName} module capability`));
    }
    return triadGraph;
}
function collectRustCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    const triadGraph = [];
    const moduleName = toPascalCase(path.basename(filePath).replace(/\.rs$/, ''));
    const ghostContext = buildRustGhostContext(rootNode, filePath, parsedFiles);
    const implRecords = new Map();
    const topLevelRecords = [];
    for (const node of rootNode.namedChildren) {
        if (node.type === 'impl_item') {
            const implType = getFirstNamedChildText(node, ['type_identifier', 'primitive_type']);
            const declarationList = node.childForFieldName('body') ?? node.namedChildren.find((child) => child.type === 'declaration_list');
            if (!implType || !declarationList) {
                continue;
            }
            const classPropertyTypes = collectRustStructPropertyTypes(rootNode, implType);
            for (const functionNode of declarationList.namedChildren.filter((child) => child.type === 'function_item')) {
                const functionName = getNameText(functionNode.childForFieldName('name'));
                if (!functionName) {
                    continue;
                }
                const ghostDemand = collectRustGhostDemand(functionNode, ghostContext, classPropertyTypes);
                const record = {
                    name: functionName,
                    demand: mergeDemandEntries(parseRustParametersAst(functionNode.childForFieldName('parameters')), ghostDemand),
                    answer: [normalizeGenericContractType(extractRustReturnType(functionNode))]
                };
                const bucket = implRecords.get(implType) ?? [];
                bucket.push(record);
                implRecords.set(implType, bucket);
            }
            continue;
        }
        if (node.type === 'function_item') {
            const functionName = getNameText(node.childForFieldName('name'));
            if (!functionName) {
                continue;
            }
            const ghostDemand = collectRustGhostDemand(node, ghostContext);
            topLevelRecords.push({
                name: functionName,
                demand: mergeDemandEntries(parseRustParametersAst(node.childForFieldName('parameters')), ghostDemand),
                answer: [normalizeGenericContractType(extractRustReturnType(node))]
            });
        }
    }
    for (const [implType, records] of implRecords.entries()) {
        if (isSuppressedCapabilityContainerName(implType, config)) {
            continue;
        }
        const promotable = records.filter((record) => !isRustNoiseCapability(record.name, config, sourcePath, record));
        if (promotable.length === 0) {
            continue;
        }
        const entrypoint = promotable.find((record) => isRustPrimaryCapabilityMethod(record.name, config));
        if (entrypoint && shouldPromoteRustCapability(entrypoint.name, sourcePath, implType, config, entrypoint)) {
            const foldedRecords = getFoldableCapabilityRecords(records, promotable, config, new Set());
            triadGraph.push(createTriadNode(`${implType}.${entrypoint.name}`, category, sourcePath, mergeCapabilityDemand(foldedRecords.map((record) => record.demand)), mergeCapabilityAnswer(foldedRecords.map((record) => record.answer)), `execute ${implType} capability pipeline`, buildFoldedLeafIds(implType, foldedRecords)));
            continue;
        }
        const capabilityMethods = promotable.filter((record) => shouldPromoteRustCapability(record.name, sourcePath, implType, config, record));
        if (capabilityMethods.length > 0) {
            triadGraph.push(...capabilityMethods.map((record) => createTriadNode(`${implType}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${implType}.${record.name} capability`)));
            continue;
        }
        triadGraph.push(createTriadNode(`${implType}.capability`, category, sourcePath, mergeCapabilityDemand(getFoldableCapabilityRecords(records, promotable, config, new Set()).map((record) => record.demand)), mergeCapabilityAnswer(getFoldableCapabilityRecords(records, promotable, config, new Set()).map((record) => record.answer)), `execute ${implType} aggregate capability`, buildFoldedLeafIds(implType, getFoldableCapabilityRecords(records, promotable, config, new Set()))));
    }
    const promotableTopLevel = topLevelRecords.filter((record) => !isRustNoiseCapability(record.name, config, sourcePath, record));
    const promotedTopLevel = promotableTopLevel.filter((record) => shouldPromoteRustCapability(record.name, sourcePath, undefined, config, record));
    for (const record of promotedTopLevel) {
        triadGraph.push(createTriadNode(`${moduleName}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${moduleName}.${record.name} capability`));
    }
    const moduleAggregateRecords = resolveTopLevelModuleAggregateRecords(sourcePath, topLevelRecords, promotableTopLevel);
    if (triadGraph.length === 0 && moduleAggregateRecords.length > 0) {
        triadGraph.push(createTriadNode(`${moduleName}.module_pipeline`, category, sourcePath, mergeCapabilityDemand(moduleAggregateRecords.map((record) => record.demand)), mergeCapabilityAnswer(moduleAggregateRecords.map((record) => record.answer)), `execute ${moduleName} module capability`));
    }
    return triadGraph;
}
function collectJavaCapabilityNodes(rootNode, filePath, sourcePath, category, config, parsedFiles) {
    const triadGraph = [];
    const ghostContext = buildJavaGhostContext(rootNode, filePath, parsedFiles);
    for (const classNode of rootNode.namedChildren.filter((node) => node.type === 'class_declaration')) {
        const className = getNameText(classNode.childForFieldName('name'));
        const classBody = classNode.childForFieldName('body');
        if (!className || !classBody) {
            continue;
        }
        const classPropertyTypes = collectJavaClassPropertyTypes(classNode);
        const records = classBody.namedChildren
            .filter((child) => child.type === 'method_declaration')
            .map((methodNode) => buildJavaExecutableRecord(methodNode, ghostContext, classPropertyTypes))
            .filter((record) => !isJavaNoiseCapability(record.name, config, sourcePath, record));
        if (records.length === 0) {
            continue;
        }
        const entrypoint = records.find((record) => isJavaPrimaryCapabilityMethod(record.name, config));
        if (entrypoint && shouldPromoteJavaCapability(entrypoint.name, sourcePath, className, config, entrypoint)) {
            const foldedRecords = getFoldableCapabilityRecords(records, records, config, JAVA_MAGIC_METHODS);
            triadGraph.push(createTriadNode(`${className}.${entrypoint.name}`, category, sourcePath, mergeCapabilityDemand(foldedRecords.map((record) => record.demand)), mergeCapabilityAnswer(foldedRecords.map((record) => record.answer)), `execute ${className} capability pipeline`, buildFoldedLeafIds(className, foldedRecords)));
            continue;
        }
        const capabilityMethods = records.filter((record) => shouldPromoteJavaCapability(record.name, sourcePath, className, config, record));
        if (capabilityMethods.length > 0) {
            triadGraph.push(...capabilityMethods.map((record) => createTriadNode(`${className}.${record.name}`, category, sourcePath, record.demand, record.answer, `execute ${className}.${record.name} capability`)));
            continue;
        }
        triadGraph.push(createTriadNode(`${className}.capability`, category, sourcePath, mergeCapabilityDemand(getFoldableCapabilityRecords(records, records, config, JAVA_MAGIC_METHODS).map((record) => record.demand)), mergeCapabilityAnswer(getFoldableCapabilityRecords(records, records, config, JAVA_MAGIC_METHODS).map((record) => record.answer)), isJavaCapabilityContainer(className)
            ? `execute ${className} aggregate capability`
            : `execute ${className} class capability`, buildFoldedLeafIds(className, getFoldableCapabilityRecords(records, records, config, JAVA_MAGIC_METHODS))));
    }
    return triadGraph;
}
function buildJavaExecutableRecord(executableNode, ghostContext, classPropertyTypes) {
    const name = getNameText(executableNode.childForFieldName('name')) ?? 'execute';
    const ghostDemand = collectJavaGhostDemand(executableNode, ghostContext, classPropertyTypes);
    return {
        name,
        demand: mergeDemandEntries(parseJavaParametersAst(executableNode.childForFieldName('parameters')), ghostDemand),
        answer: [normalizeGenericContractType(executableNode.childForFieldName('type')?.text ?? 'void')]
    };
}
function collectSourceFiles(language, targetDir, config) {
    const files = [];
    const includeSourcePath = (0, config_1.createSourcePathFilter)(targetDir, config);
    const scanScope = (0, config_1.describeSourceScanScope)(targetDir, config);
    if (scanScope.mode === 'scoped') {
        console.log(chalk_1.default.gray(`   - [TreeSitter] 扫描作用域：${scanScope.patterns.join(', ')}`));
    }
    else {
        console.log(chalk_1.default.gray('   - [TreeSitter] 未发现前后端功能目录，回退到全项目源码扫描。'));
    }
    walk(targetDir, (filePath) => {
        const relativePath = path.relative(targetDir, filePath);
        if (!includeSourcePath(relativePath)) {
            return;
        }
        if (filePath.endsWith('.d.ts') || path.basename(filePath).endsWith('types.ts')) {
            return;
        }
        if (language === 'go' && filePath.endsWith('_test.go')) {
            return;
        }
        if (FILE_PATTERNS[language].test(filePath)) {
            files.push(filePath);
        }
    });
    return files.sort();
}
function walk(currentPath, visit) {
    if (!fs.existsSync(currentPath)) {
        return;
    }
    let stat;
    try {
        stat = fs.statSync(currentPath);
    }
    catch (error) {
        if ((0, config_1.isIgnorableFsError)(error)) {
            return;
        }
        throw error;
    }
    if (stat.isFile()) {
        try {
            visit(currentPath);
        }
        catch (error) {
            if ((0, config_1.isIgnorableFsError)(error)) {
                return;
            }
            throw error;
        }
        return;
    }
    if ((0, config_1.shouldSkipWalkPath)((0, workspace_1.normalizePath)(currentPath)) ||
        (0, config_1.shouldSkipWalkPath)(path.basename(currentPath)) ||
        path.basename(currentPath) === 'target') {
        return;
    }
    let entries;
    try {
        entries = fs.readdirSync(currentPath);
    }
    catch (error) {
        if ((0, config_1.isIgnorableFsError)(error)) {
            return;
        }
        throw error;
    }
    for (const entry of entries) {
        walk(path.join(currentPath, entry), visit);
    }
}
function parseTsParameters(parametersNode) {
    if (!parametersNode) {
        return ['None'];
    }
    const demand = parametersNode.namedChildren.map((child, index) => {
        if (child.type === 'identifier') {
            return `${normalizeGenericContractType('unknown')} (${child.text})`;
        }
        const nameNode = child.childForFieldName('pattern') ?? child.childForFieldName('name') ?? child.namedChildren[0];
        const typeNode = child.childForFieldName('type');
        const name = getNameText(nameNode) ?? `input${index + 1}`;
        const typeName = normalizeGenericContractType(typeNode?.text.replace(/^:\s*/, '') ?? 'unknown');
        return `${typeName} (${name})`;
    });
    return demand.length > 0 ? demand : ['None'];
}
function parseJsParameters(parametersNode) {
    if (!parametersNode) {
        return ['None'];
    }
    const demand = parametersNode.namedChildren.map((child, index) => `${normalizeGenericContractType('unknown')} (${getNameText(child) ?? `input${index + 1}`})`);
    return demand.length > 0 ? demand : ['None'];
}
function parsePythonParametersAst(parametersNode) {
    if (!parametersNode) {
        return ['None'];
    }
    const demand = parametersNode.namedChildren
        .map((child, index) => {
        const rawText = child.text.replace(/=.*/, '').trim();
        if (!rawText || rawText === 'self' || rawText === 'cls') {
            return '';
        }
        const normalized = rawText.replace(/^\*+/, '');
        const parts = normalized.split(':');
        const name = parts[0]?.trim() || `input${index + 1}`;
        const typeName = normalizePythonContractType(parts[1] ?? 'unknown');
        return `${typeName} (${name})`;
    })
        .filter(Boolean);
    return demand.length > 0 ? demand : ['None'];
}
function parseGoParametersAst(parametersNode) {
    if (!parametersNode) {
        return ['None'];
    }
    const demand = [];
    for (const child of parametersNode.namedChildren.filter((node) => node.type === 'parameter_declaration')) {
        const identifiers = child.namedChildren.filter((node) => node.type === 'identifier');
        const typeNode = child.namedChildren[child.namedChildren.length - 1];
        const typeName = normalizeGenericContractType(typeNode?.text ?? 'unknown');
        if (identifiers.length === 0) {
            demand.push(`${typeName} (input${demand.length + 1})`);
            continue;
        }
        for (const identifier of identifiers) {
            demand.push(`${typeName} (${identifier.text})`);
        }
    }
    return demand.length > 0 ? demand : ['None'];
}
function parseRustParametersAst(parametersNode) {
    if (!parametersNode) {
        return ['None'];
    }
    const demand = parametersNode.namedChildren
        .map((child, index) => {
        const rawText = child.text.trim();
        if (!rawText || rawText === 'self' || rawText === '&self' || rawText === '&mut self') {
            return '';
        }
        const parts = rawText.split(':');
        const name = parts[0]?.trim().replace(/^mut\s+/, '') || `input${index + 1}`;
        const typeName = normalizeGenericContractType(parts[1] ?? 'unknown');
        return `${typeName} (${name})`;
    })
        .filter(Boolean);
    return demand.length > 0 ? demand : ['None'];
}
function parseCppParametersAst(parametersNode) {
    if (!parametersNode) {
        return ['None'];
    }
    const demand = parametersNode.namedChildren
        .filter((child) => child.type === 'parameter_declaration')
        .map((child, index) => {
        const tokens = child.text.replace(/=.*/, '').trim().split(/\s+/).filter(Boolean);
        if (tokens.length >= 2) {
            const name = tokens[tokens.length - 1].replace(/^[*&]+/, '');
            const typeName = normalizeGenericContractType(tokens.slice(0, -1).join(' '));
            return `${typeName} (${name})`;
        }
        return `${normalizeGenericContractType(child.text)} (input${index + 1})`;
    });
    return demand.length > 0 ? demand : ['None'];
}
function parseJavaParametersAst(parametersNode) {
    if (!parametersNode) {
        return ['None'];
    }
    const demand = parametersNode.namedChildren
        .filter((child) => child.type === 'formal_parameter' || child.type === 'spread_parameter')
        .map((child, index) => {
        const rawText = child.text.replace(/@[\w.]+(?:\([^)]*\))?\s*/g, '').trim();
        const tokens = rawText.split(/\s+/).filter(Boolean);
        if (tokens.length >= 2) {
            const name = tokens[tokens.length - 1];
            const typeName = normalizeGenericContractType(tokens.slice(0, -1).join(' '));
            return `${typeName} (${name})`;
        }
        return `${normalizeGenericContractType('unknown')} (input${index + 1})`;
    });
    return demand.length > 0 ? demand : ['None'];
}
function extractPythonReturnType(functionNode) {
    const parametersNode = functionNode.childForFieldName('parameters');
    const blockNode = functionNode.childForFieldName('body');
    const namedChildren = functionNode.namedChildren;
    const parametersIndex = parametersNode ? namedChildren.findIndex((child) => child.id === parametersNode.id) : -1;
    const returnNode = parametersIndex >= 0
        ? namedChildren.find((child, index) => index > parametersIndex && (!blockNode || child.id !== blockNode.id))
        : null;
    return normalizePythonContractType(returnNode?.text ?? 'void');
}
function extractGoReturnType(functionNode) {
    const blockNode = functionNode.childForFieldName('body') ?? functionNode.namedChildren[functionNode.namedChildren.length - 1];
    const candidate = [...functionNode.namedChildren]
        .reverse()
        .find((child) => !blockNode || child.id !== blockNode.id && child.type !== 'parameter_list' && child.type !== 'identifier' && child.type !== 'field_identifier');
    return normalizeGenericContractType(candidate?.text ?? 'void');
}
function extractRustReturnType(functionNode) {
    const blockNode = functionNode.childForFieldName('body');
    const parametersNode = functionNode.childForFieldName('parameters');
    const candidate = functionNode.namedChildren.find((child) => child.id !== blockNode?.id && child.id !== parametersNode?.id && child.type !== 'identifier' && child.type !== 'visibility_modifier');
    return normalizeGenericContractType(candidate?.text ?? 'void');
}
function extractCppReturnType(node) {
    const declarator = node.childForFieldName('declarator') ?? node.namedChildren.find((child) => child.type === 'function_declarator');
    const candidates = node.namedChildren.filter((child) => child.id !== declarator?.id && child.type !== 'compound_statement' && child.type !== 'field_declaration_list');
    return normalizeGenericContractType(candidates.map((child) => child.text).join(' ').trim() || 'void');
}
function extractGoReceiverType(receiverNode) {
    if (!receiverNode) {
        return '';
    }
    const receiverText = receiverNode.text.replace(/[()]/g, '').trim();
    const match = receiverText.match(/(?:[A-Za-z_]\w*\s+)?\*?([A-Za-z_]\w*)$/);
    return match?.[1] ?? '';
}
function resolveIncludedParsedFile(currentFilePath, includePath, parsedFiles) {
    const normalizedInclude = path.normalize(includePath);
    const directCandidate = path.normalize(path.resolve(path.dirname(currentFilePath), normalizedInclude));
    return parsedFiles.find((entry) => {
        const normalized = path.normalize(entry.filePath);
        return normalized === directCandidate || normalized.endsWith(normalizedInclude);
    });
}
function resolveJavaImportedBindingInfo(importPath, parsedFiles, fallbackName) {
    if (!importPath) {
        return createValueBinding(fallbackName);
    }
    const segments = importPath.split('.').filter(Boolean);
    if (segments.length === 0) {
        return createValueBinding(fallbackName);
    }
    const directClass = resolveJavaClassImport(parsedFiles, segments);
    if (directClass) {
        return directClass.binding;
    }
    if (segments.length >= 2) {
        const staticMember = resolveJavaStaticImport(parsedFiles, segments);
        if (staticMember) {
            return staticMember;
        }
    }
    return createValueBinding(fallbackName);
}
function resolveJavaClassImport(parsedFiles, segments) {
    const className = segments[segments.length - 1] ?? '';
    const packageName = segments.slice(0, -1).join('.');
    const targetFile = parsedFiles.find((entry) => {
        return getJavaPackageName(entry.rootNode) === packageName && hasJavaClassNamed(entry.rootNode, className);
    });
    if (!targetFile) {
        return undefined;
    }
    return {
        targetFile,
        binding: createValueBinding(className)
    };
}
function resolveJavaStaticImport(parsedFiles, segments) {
    const memberName = segments[segments.length - 1] ?? '';
    const ownerClassName = segments[segments.length - 2] ?? '';
    const packageName = segments.slice(0, -2).join('.');
    const targetFile = parsedFiles.find((entry) => {
        return getJavaPackageName(entry.rootNode) === packageName && hasJavaClassNamed(entry.rootNode, ownerClassName);
    });
    if (!targetFile) {
        return undefined;
    }
    return lookupJavaStaticMemberBinding(targetFile.rootNode, ownerClassName, memberName) ?? createValueBinding(memberName);
}
function lookupJavaStaticMemberBinding(rootNode, className, memberName) {
    const classNode = rootNode.namedChildren.find((node) => node.type === 'class_declaration' && getNameText(node.childForFieldName('name')) === className);
    const classBody = classNode?.childForFieldName('body');
    if (!classBody) {
        return undefined;
    }
    for (const child of classBody.namedChildren) {
        if (child.type === 'field_declaration') {
            const typeNode = child.childForFieldName('type') ?? child.namedChildren.find((node) => node.type.endsWith('_type')) ?? null;
            const typeName = normalizeTypeText(typeNode?.text ?? 'unknown');
            for (const declarator of child.namedChildren.filter((node) => node.type === 'variable_declarator')) {
                const localName = getNameText(declarator.childForFieldName('name') ?? declarator.namedChildren[0] ?? null);
                if (localName === memberName) {
                    return createValueBinding(typeName);
                }
            }
        }
        if (child.type === 'method_declaration') {
            const localName = getNameText(child.childForFieldName('name'));
            if (localName === memberName) {
                return createCallableBinding(localName, normalizeTypeText(child.childForFieldName('type')?.text ?? 'unknown'));
            }
        }
    }
    return undefined;
}
function getJavaPackageName(rootNode) {
    const packageNode = rootNode.namedChildren.find((node) => node.type === 'package_declaration');
    const scopedNode = packageNode?.namedChildren.find((node) => node.type === 'scoped_identifier' || node.type === 'identifier');
    return scopedNode?.text ?? '';
}
function hasJavaClassNamed(rootNode, className) {
    return rootNode.namedChildren.some((node) => node.type === 'class_declaration' && getNameText(node.childForFieldName('name')) === className);
}
function getScopedPathTail(value, separator) {
    const parts = value.split(separator).filter(Boolean);
    return parts[parts.length - 1] ?? '';
}
function stripQuotedLiteral(value) {
    return value.replace(/^['"`]|['"`]$/g, '');
}
function buildFoldedLeafIds(ownerName, records) {
    return Array.from(new Set(records
        .map((record) => record.name?.trim())
        .filter((name) => Boolean(name))
        .map((name) => `${ownerName}.${name}`)));
}
function getFoldableCapabilityRecords(records, promotable, config, magicMethods) {
    if (!config.parser.foldHelpersIntoOwner) {
        return promotable;
    }
    return records.filter((record) => {
        const name = record.name?.trim() ?? '';
        return Boolean(name) && !isMagicCapabilityName(name, magicMethods, config);
    });
}
function createTriadNode(nodeId, category, sourcePath, demand, answer, problem, foldedLeaves = [], abstractionEvidence) {
    const methodName = nodeId.split('.').pop() ?? 'execute';
    const governedContracts = applyGhostDemandGovernance(nodeId, sourcePath, demand, answer, ACTIVE_PARSER_CONFIG);
    const promotionReasons = derivePromotionEvidenceReasons(methodName, sourcePath, nodeId.split('.').slice(0, -1).join('.'), demand, answer, []);
    const evidence = governedContracts.ghostReads.length > 0 || promotionReasons.length > 0 || abstractionEvidence
        ? {
            ...(governedContracts.ghostReads.length > 0
                ? {
                    ghostReads: governedContracts.ghostReads
                }
                : {}),
            ...(promotionReasons.length > 0
                ? {
                    promotionReasons
                }
                : {}),
            ...(abstractionEvidence
                ? {
                    abstraction: abstractionEvidence
                }
                : {})
        }
        : undefined;
    return {
        nodeId,
        category,
        sourcePath,
        fission: {
            problem: deriveCapabilityProblem(nodeId, sourcePath, demand, answer, problem ?? `execute ${methodName} flow`),
            demand: governedContracts.demand.length > 0 ? governedContracts.demand : ['None'],
            answer: answer.length > 0 ? answer : ['void'],
            evidence
        },
        topology: foldedLeaves.length > 0 ? { foldedLeaves } : undefined
    };
}
function applyGhostDemandGovernance(nodeId, sourcePath, demand, answer, config) {
    const normalizedDemand = demand.length > 0 ? demand.map((entry) => String(entry ?? '').trim()).filter(Boolean) : [];
    const nonGhostDemand = normalizedDemand.filter((entry) => !isGhostDemandEntry(entry) && !/^none$/i.test(entry));
    const ghostPolicy = resolveGhostPolicyForSourcePath(sourcePath, config ?? ACTIVE_PARSER_CONFIG);
    const ghostRecords = normalizedDemand
        .filter((entry) => isGhostDemandEntry(entry))
        .map((entry) => {
        const parsed = parseGhostDemandEntry(entry);
        const score = scoreGhostDemand(parsed, nodeId, sourcePath);
        return {
            ...parsed,
            raw: entry,
            score
        };
    })
        .sort((left, right) => right.score - left.score);
    const keepGhostInDemand = ghostPolicy.includeInDemand && shouldKeepGhostInDemand(nodeId, sourcePath, nonGhostDemand, answer);
    const keptGhostRecords = keepGhostInDemand
        ? ghostRecords.filter((entry) => entry.score >= ghostPolicy.minConfidence).slice(0, ghostPolicy.topK)
        : [];
    const keptGhostSet = new Set(keptGhostRecords.map((entry) => entry.raw));
    const governedDemand = dedupeStringEntries([...nonGhostDemand, ...keptGhostRecords.map((entry) => entry.raw)]);
    return {
        demand: governedDemand.length > 0 ? governedDemand : ['None'],
        ghostReads: ghostRecords.map((entry) => ({
            raw: entry.raw,
            mode: entry.mode,
            target: entry.target,
            valueType: entry.valueType,
            retainedInDemand: keptGhostSet.has(entry.raw),
            score: entry.score
        }))
    };
}
function resolveGhostPolicyForSourcePath(sourcePath, config) {
    const language = detectSourceLanguageFromPath(sourcePath);
    const policyByLanguage = config?.parser.ghostPolicyByLanguage ?? {};
    const fallback = policyByLanguage.default ?? DEFAULT_GHOST_POLICY;
    const languagePolicy = language ? policyByLanguage[language] : undefined;
    return {
        includeInDemand: languagePolicy?.includeInDemand ?? fallback.includeInDemand ?? DEFAULT_GHOST_POLICY.includeInDemand,
        topK: Math.max(0, languagePolicy?.topK ?? fallback.topK ?? DEFAULT_GHOST_POLICY.topK),
        minConfidence: Math.max(0, languagePolicy?.minConfidence ?? fallback.minConfidence ?? DEFAULT_GHOST_POLICY.minConfidence)
    };
}
function detectSourceLanguageFromPath(sourcePath) {
    const normalized = (0, workspace_1.normalizePath)(String(sourcePath ?? '').toLowerCase());
    if (/\.(ts|tsx|mts|cts)$/.test(normalized))
        return 'typescript';
    if (/\.(js|jsx|mjs|cjs)$/.test(normalized))
        return 'javascript';
    if (/\.py$/.test(normalized))
        return 'python';
    if (/\.go$/.test(normalized))
        return 'go';
    if (/\.rs$/.test(normalized))
        return 'rust';
    if (/\.(cc|cpp|cxx|hpp|hh|h)$/.test(normalized))
        return 'cpp';
    if (/\.java$/.test(normalized))
        return 'java';
    return undefined;
}
function deriveCapabilityProblem(nodeId, sourcePath, demand, answer, rawProblem) {
    if (!isLowSemanticProblem(rawProblem)) {
        return rawProblem;
    }
    const nodeParts = nodeId.split('.').filter(Boolean);
    const methodName = nodeParts[nodeParts.length - 1] ?? 'capability';
    const ownerName = nodeParts.length > 1 ? nodeParts.slice(0, -1).join(' ') : '';
    const capabilityType = inferCapabilityProblemType(nodeId, sourcePath, methodName);
    const verb = inferCapabilityProblemVerb(methodName, rawProblem);
    const subject = buildCapabilityProblemSubject(ownerName, methodName, sourcePath, demand, answer);
    const prefix = isLowSemanticSubject(subject, methodName, sourcePath) ? '[low_semantic_name] ' : '';
    return `${prefix}${capabilityType} Capability: ${verb} ${subject}`;
}
function shouldKeepGhostInDemand(nodeId, sourcePath, demand, answer) {
    const signalText = `${nodeId} ${sourcePath}`;
    const hasRuntimeSemanticSignal = /(workflow|pipeline|stage|step|node|service|task|worker|queue|scheduler|handler|controller|api|route|event|consumer)/i.test(signalText) && !/(types?|schema|dto|entity|model)(\/|$)/i.test(sourcePath);
    const hasMeaningfulContracts = [...demand, ...answer]
        .map((entry) => extractContractTypeText(entry))
        .filter((entry) => Boolean(entry))
        .some((entry) => !isGenericContractType(entry));
    return hasRuntimeSemanticSignal && hasMeaningfulContracts;
}
function isGhostDemandEntry(entry) {
    return /^\[Ghost:[^\]]+\]/i.test(String(entry ?? '').trim());
}
function parseGhostDemandEntry(entry) {
    const raw = String(entry ?? '').trim();
    const match = raw.match(/^\[Ghost:(ReadWrite|Read)\]\s*(.*?)\s*\(([^()]+)\)\s*$/i);
    if (!match) {
        return {
            mode: 'read',
            valueType: 'unknown',
            target: raw.replace(/^\[Ghost:[^\]]+\]\s*/i, '') || 'unknown'
        };
    }
    return {
        mode: match[1].toLowerCase() === 'readwrite' ? 'read_write' : 'read',
        valueType: normalizeTypeText(match[2] || 'unknown'),
        target: String(match[3] ?? '').trim() || 'unknown'
    };
}
function scoreGhostDemand(ghost, nodeId, sourcePath) {
    let score = 0;
    if (ghost.mode === 'read_write')
        score += 2;
    if (!isGenericContractType(ghost.valueType) && !isUnknownLikeType(ghost.valueType))
        score += 3;
    if (isRuntimeResourceTarget(ghost.target))
        score += 2;
    if (/(service|workflow|worker|task|queue|api|route|handler|controller)/i.test(`${nodeId} ${sourcePath}`))
        score += 1;
    if (/^(self|this|ctx|context|state|data)$/i.test(ghost.target))
        score -= 2;
    if (isUnknownLikeType(ghost.valueType))
        score -= 1;
    return score;
}
function isRuntimeResourceTarget(value) {
    return /(redis|cache|db|database|session|postgres|mysql|mongo|minio|s3|queue|worker|task|workflow|pipeline|event|topic|client|http|api|tool|model|provider)/i.test(String(value ?? ''));
}
function isUnknownLikeType(value) {
    return /^(unknown|any|none|null|undefined|module|object|dict|map|list|array|json)$/i.test(String(value ?? '').trim());
}
function dedupeStringEntries(entries) {
    const seen = new Set();
    const result = [];
    for (const entry of entries) {
        const normalized = String(entry ?? '').trim();
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}
function isLowSemanticProblem(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return (!normalized ||
        /^execute\s+.+\s+(flow|capability|pipeline)$/.test(normalized) ||
        /^execute\s+.+\s+(aggregate|module|class)\s+capability$/.test(normalized) ||
        /^aggregate\s+(module|domain)\s+capability\s+for\s+/.test(normalized));
}
function inferCapabilityProblemType(nodeId, sourcePath, methodName) {
    const text = `${nodeId} ${sourcePath} ${methodName}`.toLowerCase();
    if (/(api|route|endpoint|controller|handler|command|consumer|rpc|webhook)/.test(text))
        return 'Interface';
    if (/(workflow|pipeline|orchestrat|stage|sync|plan|apply|dispatch|handoff|protocol)/.test(text))
        return 'Workflow';
    if (/(adapter|gateway|repository|storage|database|db|queue|client|filesystem|network|model)/.test(text)) {
        return 'Adapter';
    }
    if (/(policy|rule|guard|auth|permission|decide|resolver|router|validator)/.test(text))
        return 'Policy';
    if (/(worker|job|tool|agent|operator|kernel|execute|runner|runtime|healing)/.test(text))
        return 'Execution';
    if (/(service|usecase|manager|domain)/.test(text))
        return 'Service';
    return 'System';
}
function inferCapabilityProblemVerb(methodName, rawProblem) {
    const name = methodName.toLowerCase();
    if (/^(handle|process|dispatch|consume|receive)/.test(name))
        return 'Handle';
    if (/^(plan|prepare|draft|protocol)/.test(name) || /\bplan\b/i.test(rawProblem))
        return 'Plan';
    if (/^(apply|commit|write|save|persist|upsert|generate|create)/.test(name))
        return 'Produce';
    if (/^(sync|watch|heal|recover|rollback|restore)/.test(name))
        return 'Coordinate';
    if (/^(detect|analyze|diagnose|calculate|resolve|scan|parse|read|load)/.test(name))
        return 'Analyze';
    if (/^(execute|run|invoke|call)/.test(name))
        return 'Run';
    return 'Provide';
}
function buildCapabilityProblemSubject(ownerName, methodName, sourcePath, demand, answer) {
    const ownerTokens = tokenizeSemanticName(ownerName);
    const methodTokens = tokenizeSemanticName(methodName);
    const sourceTokens = tokenizeSemanticName(getSemanticSourcePathTail(sourcePath));
    const contractTokens = tokenizeSemanticName(getFirstDomainContractName([...answer, ...demand]));
    const tokens = dedupeSemanticTokens([
        ...ownerTokens,
        ...methodTokens.filter((token) => !GENERIC_METHOD_TOKENS.has(token)),
        ...sourceTokens.filter((token) => !GENERIC_SOURCE_TOKENS.has(token)).slice(0, 2),
        ...contractTokens.slice(0, 2)
    ]).filter((token) => !GENERIC_SUBJECT_TOKENS.has(token));
    if (tokens.length === 0) {
        return toHumanCapabilityName(methodName || ownerName || getSemanticSourcePathTail(sourcePath) || 'capability');
    }
    return toHumanCapabilityName(tokens.join(' '));
}
function isLowSemanticSubject(subject, methodName, sourcePath) {
    const tokens = tokenizeSemanticName(`${subject} ${getSemanticSourcePathTail(sourcePath)}`);
    const meaningfulTokens = tokens.filter((token) => !GENERIC_SUBJECT_TOKENS.has(token));
    return meaningfulTokens.length <= 1 && GENERIC_METHOD_TOKENS.has(methodName.toLowerCase());
}
const GENERIC_METHOD_TOKENS = new Set([
    'execute',
    'run',
    'handle',
    'process',
    'dispatch',
    'apply',
    'invoke',
    'call',
    'capability',
    'pipeline',
    'flow'
]);
const GENERIC_SOURCE_TOKENS = new Set(['index', 'main', 'src', 'lib', 'core', 'app', 'server', 'client']);
const GENERIC_SUBJECT_TOKENS = new Set([
    'module',
    'domain',
    'capability',
    'pipeline',
    'flow',
    'aggregate',
    'class',
    'function',
    'method',
    'index',
    'main'
]);
function tokenizeSemanticName(value) {
    return String(value ?? '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-./\\:]+/g, ' ')
        .split(/\s+/)
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean);
}
function dedupeSemanticTokens(tokens) {
    const seen = new Set();
    return tokens.filter((token) => {
        if (seen.has(token)) {
            return false;
        }
        seen.add(token);
        return true;
    });
}
function getSemanticSourcePathTail(sourcePath) {
    const normalized = (0, workspace_1.normalizePath)(String(sourcePath ?? '').trim()).replace(/\.[^.\/]+$/, '');
    const parts = normalized.split('/').filter(Boolean);
    return parts.slice(-2).join(' ');
}
function getFirstDomainContractName(contracts) {
    return (contracts
        .map((contract) => String(contract ?? '').replace(/^\[[^\]]+\]\s*/, '').split(/[<(]/)[0].trim())
        .find((contract) => contract && !/^(none|void|unknown|\[generic\])/i.test(contract)) ?? '');
}
function toHumanCapabilityName(value) {
    const text = tokenizeSemanticName(value)
        .filter((token) => token.length > 0)
        .join(' ');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Capability';
}
function dedupeNodes(nodes) {
    const seen = new Set();
    return nodes.filter((node) => {
        const key = [node.nodeId, (0, workspace_1.normalizePath)(node.sourcePath).toLowerCase(), String(node.category ?? '').toLowerCase()].join('::');
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function canonicalizeTriadNodes(nodes, config) {
    const diagnostics = [];
    const canonicalized = nodes.map((node) => {
        const resolvedCategory = (0, config_1.resolveCategoryBySourcePath)(node.sourcePath, config.categories);
        if (resolvedCategory !== 'unknown' && String(node.category ?? '').trim() !== resolvedCategory) {
            diagnostics.push({
                level: 'warning',
                code: 'TRIAD_SOURCE_CATEGORY_MISMATCH_AUTO_FIXED',
                message: 'sourcePath/category mismatch auto-fixed by category resolver',
                sourcePath: node.sourcePath,
                nodeId: node.nodeId,
                originalCategory: node.category,
                resolvedCategory
            });
            return {
                ...node,
                category: resolvedCategory
            };
        }
        if (resolvedCategory === 'unknown') {
            diagnostics.push({
                level: 'info',
                code: 'TRIAD_SOURCE_CATEGORY_UNRESOLVED',
                message: 'sourcePath could not be resolved to a configured category',
                sourcePath: node.sourcePath,
                nodeId: node.nodeId,
                originalCategory: node.category
            });
        }
        return node;
    });
    return {
        nodes: canonicalized,
        diagnostics
    };
}
function dedupeParserDiagnostics(diagnostics) {
    const seen = new Set();
    return diagnostics.filter((diagnostic) => {
        const key = [
            diagnostic.code,
            diagnostic.sourcePath ?? '',
            diagnostic.nodeId ?? '',
            diagnostic.originalCategory ?? '',
            diagnostic.resolvedCategory ?? ''
        ].join('::');
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function aggregateNodesForScanMode(nodes, config) {
    if (config.parser.scanMode === 'module') {
        return buildAggregatedNodes(nodes, config, 'module');
    }
    if (config.parser.scanMode === 'domain') {
        return buildAggregatedNodes(nodes, config, 'domain');
    }
    return nodes;
}
function buildAggregatedNodes(nodes, config, level) {
    const producersByContract = new Map();
    const consumersByContract = new Map();
    const grouped = new Map();
    for (const node of nodes) {
        for (const answer of node.fission.answer ?? []) {
            const key = normalizeAggregationContractKey(answer, false, config);
            if (!key)
                continue;
            ensureStringSet(producersByContract, key).add(node.nodeId);
        }
        for (const demand of node.fission.demand ?? []) {
            const key = normalizeAggregationContractKey(demand, true, config);
            if (!key)
                continue;
            ensureStringSet(consumersByContract, key).add(node.nodeId);
        }
    }
    for (const node of nodes) {
        const groupId = level === 'module' ? getModuleAggregateId(node) : getDomainAggregateId(node, config);
        const aggregate = grouped.get(groupId) ??
            {
                nodeId: groupId,
                category: node.category,
                sourcePath: level === 'module' ? normalizeModuleSourcePath(node.sourcePath) : deriveDomainSourcePath(node, config),
                members: []
            };
        aggregate.members.push(node);
        grouped.set(groupId, aggregate);
    }
    return Array.from(grouped.values()).map((group) => buildAggregateNode(group, producersByContract, consumersByContract, config, level));
}
function buildAggregateNode(group, producersByContract, consumersByContract, config, level) {
    const memberIds = new Set(group.members.map((member) => member.nodeId));
    const demandByKey = new Map();
    const answerByKey = new Map();
    for (const member of group.members) {
        for (const demand of member.fission.demand ?? []) {
            const raw = String(demand ?? '').trim();
            if (!raw || /^none$/i.test(raw)) {
                continue;
            }
            const isGhostDemand = /^\[Ghost/i.test(raw);
            const key = normalizeAggregationContractKey(raw, true, config);
            if (!key && !isGhostDemand) {
                continue;
            }
            const resolvedKey = key ?? `ghost:${raw}`;
            const internalProducers = key
                ? Array.from(producersByContract.get(key) ?? []).some((producerId) => memberIds.has(producerId))
                : false;
            if (!internalProducers) {
                if (!demandByKey.has(resolvedKey)) {
                    demandByKey.set(resolvedKey, raw);
                }
            }
        }
        for (const answer of member.fission.answer ?? []) {
            const raw = String(answer ?? '').trim();
            if (!raw || /^void$/i.test(raw)) {
                continue;
            }
            const key = normalizeAggregationContractKey(raw, false, config);
            if (!key) {
                continue;
            }
            const consumers = Array.from(consumersByContract.get(key) ?? []);
            const hasExternalConsumer = consumers.some((consumerId) => !memberIds.has(consumerId));
            if (hasExternalConsumer || consumers.length === 0) {
                if (!answerByKey.has(key)) {
                    answerByKey.set(key, raw);
                }
            }
        }
    }
    const problem = deriveCapabilityProblem(group.nodeId, group.sourcePath, Array.from(demandByKey.values()), Array.from(answerByKey.values()), level === 'module'
        ? `aggregate module capability for ${group.sourcePath}`
        : `aggregate domain capability for ${group.sourcePath || group.nodeId}`);
    return {
        nodeId: group.nodeId,
        category: group.category,
        sourcePath: group.sourcePath,
        fission: {
            problem,
            demand: demandByKey.size > 0 ? Array.from(demandByKey.values()).sort() : ['None'],
            answer: answerByKey.size > 0 ? Array.from(answerByKey.values()).sort() : ['void']
        }
    };
}
function getModuleAggregateId(node) {
    const normalized = normalizeModuleSourcePath(node.sourcePath);
    return `Module.${normalized.replace(/\//g, '.')}`;
}
function normalizeModuleSourcePath(sourcePath) {
    return (0, workspace_1.normalizePath)(String(sourcePath ?? '').trim()).replace(/\.[^.\/]+$/, '').replace(/^\.?\//, '') || 'root';
}
function getDomainAggregateId(node, config) {
    const domainPath = deriveDomainPath(node, config);
    return `Domain.${domainPath.replace(/\//g, '.')}`;
}
function deriveDomainSourcePath(node, config) {
    return deriveDomainPath(node, config);
}
function deriveDomainPath(node, config) {
    const sourcePath = (0, workspace_1.normalizePath)(String(node.sourcePath ?? '').trim()).replace(/^\.?\//, '');
    const normalized = sourcePath.toLowerCase();
    const categoryPatterns = (config.categories[node.category] ?? [])
        .map((pattern) => (0, workspace_1.normalizePath)(pattern).replace(/^\.?\//, '').toLowerCase())
        .sort((left, right) => right.length - left.length);
    for (const pattern of categoryPatterns) {
        if (!pattern)
            continue;
        if (normalized === pattern || normalized.startsWith(`${pattern}/`)) {
            const remainder = sourcePath.slice(pattern.length).replace(/^\/+/, '');
            const firstSegment = remainder.split('/').filter(Boolean)[0];
            return firstSegment ? `${node.category}/${firstSegment}` : `${node.category}`;
        }
    }
    const parts = sourcePath.split('/').filter(Boolean);
    if (parts.length === 0) {
        return node.category;
    }
    return parts.length > 1 ? `${node.category}/${parts[0]}` : `${node.category}`;
}
function normalizeAggregationContractKey(entry, isDemand, config) {
    const raw = String(entry ?? '').trim();
    if (!raw)
        return null;
    if (isDemand && /^\[Ghost/i.test(raw))
        return null;
    const extracted = extractContractTypeText(raw);
    if (!extracted) {
        return null;
    }
    return isIgnoredContractType(extracted, config)
        ? null
        : extracted
            .replace(/^typing\./i, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*([<>{}()[\]|,:=&?])\s*/g, '$1');
}
function ensureStringSet(map, key) {
    const existing = map.get(key);
    if (existing) {
        return existing;
    }
    const created = new Set();
    map.set(key, created);
    return created;
}
function normalizeTypeText(value) {
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized || 'unknown';
}
function normalizeText(value) {
    return String(value ?? '')
        .replace(/^['"`]+|['"`]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function normalizeGenericContractType(value) {
    const normalized = normalizeTypeText(value.replace(/^:\s*/, ''));
    return isGenericContractType(normalized) ? `[Generic] ${normalized}` : normalized;
}
function normalizePythonContractType(value) {
    const normalized = normalizeTypeText(value.replace(/^:\s*/, ''));
    return isGenericContractType(normalized) ? `[Generic] ${normalized}` : normalized;
}
function isGenericContractType(value) {
    const compact = value
        .trim()
        .toLowerCase()
        .replace(/^typing\./g, '')
        .replace(/\s+/g, '');
    return ((0, artifactPathContracts_1.isArtifactPathContractType)(compact) ||
        compact === 'str' ||
        compact === 'string' ||
        compact === 'std::string' ||
        compact === 'String'.toLowerCase() ||
        compact === 'int' ||
        compact === 'integer' ||
        compact === 'long' ||
        compact === 'short' ||
        compact === 'byte' ||
        compact === 'usize' ||
        compact === 'isize' ||
        compact === 'u8' ||
        compact === 'u16' ||
        compact === 'u32' ||
        compact === 'u64' ||
        compact === 'u128' ||
        compact === 'i8' ||
        compact === 'i16' ||
        compact === 'i32' ||
        compact === 'i64' ||
        compact === 'i128' ||
        compact === 'bool' ||
        compact === 'boolean' ||
        compact === 'number' ||
        compact === 'float' ||
        compact === 'double' ||
        compact === 'f32' ||
        compact === 'f64' ||
        compact === 'bigint' ||
        compact === 'symbol' ||
        compact === 'dict' ||
        compact === 'list' ||
        compact === 'vec' ||
        compact === 'set' ||
        compact === 'tuple' ||
        compact === 'any' ||
        compact === 'unknown' ||
        compact === 'object' ||
        compact === 'dict[str,any]' ||
        compact === 'record<string,any>' ||
        compact === 'record<string,unknown>' ||
        compact === 'map<string,any>' ||
        compact === 'map<string,unknown>' ||
        compact === 'map<string,object>' ||
        compact === 'mapping[str,any]' ||
        compact === 'list[any]' ||
        compact === 'array<any>' ||
        compact === 'array<unknown>' ||
        compact === 'sequence[any]');
}
function hasModifier(node, modifiers) {
    const modifierSet = new Set(modifiers);
    return node.namedChildren.some((child) => child.type.includes('modifier') && modifierSet.has(child.text.trim()));
}
function hasNearbyTriadTag(source, nodeStartIndex, config) {
    const prefix = source.slice(Math.max(0, nodeStartIndex - 600), nodeStartIndex);
    const supportedTags = [
        config.parser.jsDocTags.triadNode,
        config.parser.jsDocTags.leftBranch,
        config.parser.jsDocTags.rightBranch
    ];
    return supportedTags.some((tag) => prefix.includes(`@${tag}`));
}
function toPascalCase(value) {
    return value
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}
function getNameText(node) {
    if (!node) {
        return '';
    }
    if (node.type === 'identifier' || node.type.endsWith('_identifier') || node.type === 'property_identifier') {
        return node.text;
    }
    return node.namedChildren.length > 0 ? getNameText(node.namedChildren[node.namedChildren.length - 1]) : node.text;
}
function getFirstNamedChildText(node, candidateTypes) {
    const target = node.namedChildren.find((child) => candidateTypes.includes(child.type));
    return target?.text ?? '';
}
function escapeRegExp(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=treeSitterParser.js.map
