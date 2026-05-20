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
exports.runTypeScriptParser = runTypeScriptParser;
const ts_morph_1 = require("ts-morph");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const workspace_1 = require("./workspace");
const config_1 = require("./config");
const BUILTIN_GLOBALS = new Set([
    'Array',
    'Boolean',
    'Date',
    'Error',
    'Intl',
    'JSON',
    'Map',
    'Math',
    'Number',
    'Object',
    'Promise',
    'Reflect',
    'RegExp',
    'Set',
    'String',
    'Symbol',
    'WeakMap',
    'WeakSet',
    'console',
    'document',
    'globalThis',
    'process',
    'window'
]);
/**
 * TriadMind 自动生成骨架
 * 职责：执行 TypeScript parser 流程
 */
function runTypeScriptParser(targetDir, outputPath) {
    console.log(chalk_1.default.gray('   - [Parser] 正在扫描 TypeScript AST，回写项目拓扑地图...'));
    const tsConfigFilePath = path.join(targetDir, 'tsconfig.json');
    if (!fs.existsSync(tsConfigFilePath)) {
        throw new Error(`目标目录下缺少 tsconfig.json：${tsConfigFilePath}`);
    }
    const triadDir = path.join(targetDir, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });
    const workspacePaths = (0, workspace_1.getWorkspacePaths)(targetDir);
    const config = (0, config_1.loadTriadConfig)(workspacePaths);
    const includeSourcePath = (0, config_1.createSourcePathFilter)(targetDir, config);
    const scanScope = (0, config_1.describeSourceScanScope)(targetDir, config);
    const resolvedOutputPath = outputPath ?? path.join(triadDir, 'triad-map.json');
    const project = new ts_morph_1.Project({
        tsConfigFilePath
    });
    const triadGraph = [];
    const sourceFiles = project
        .getSourceFiles()
        .filter((file) => !file.getFilePath().endsWith('.d.ts') &&
        !file.getBaseName().endsWith('types.ts') &&
        includeSourcePath(path.relative(targetDir, file.getFilePath())));
    if (scanScope.mode === 'scoped') {
        console.log(chalk_1.default.gray(`   - [Parser] 扫描作用域：${scanScope.patterns.join(', ')}`));
    }
    else {
        console.log(chalk_1.default.gray('   - [Parser] 未发现前后端功能目录，回退到全项目源码扫描。'));
    }
    for (const sourceFile of sourceFiles) {
        const filePath = sourceFile.getFilePath();
        const sourcePath = (0, workspace_1.normalizePath)(path.relative(targetDir, filePath));
        const category = (0, config_1.resolveCategoryFromConfig)(sourcePath, config);
        collectClassMethodNodes(sourceFile, category, sourcePath, triadGraph, config);
        collectExportedFunctionNodes(sourceFile, category, sourcePath, triadGraph, config);
    }
    triadGraph.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    fs.writeFileSync(resolvedOutputPath, JSON.stringify(triadGraph, null, 2), 'utf-8');
    console.log(chalk_1.default.gray(`   - [Parser] 扫描完成，共抽取 ${triadGraph.length} 个叶节点。`));
}
function collectClassMethodNodes(sourceFile, category, sourcePath, triadGraph, config) {
    for (const cls of sourceFile.getClasses()) {
        const className = cls.getName();
        if (!className) {
            continue;
        }
        const classHasTriadTag = hasTriadTag(cls, config);
        for (const method of cls.getMethods()) {
            if (method.getName() === 'constructor') {
                continue;
            }
            const scope = method.getScope();
            if (scope === 'private' || scope === 'protected') {
                continue;
            }
            if (!config.parser.includeUntaggedExports && !classHasTriadTag && !hasTriadTag(method, config)) {
                continue;
            }
            const demand = method.getParameters().map((parameter) => {
                const typeName = parameter.getTypeNode()?.getText() ?? 'unknown';
                return `${typeName} (${parameter.getName()})`;
            });
            const ghostDemand = collectGhostDependencies(method, cls);
            const answer = method.getReturnTypeNode()?.getText() ?? method.getReturnType().getText(method);
            const mergedDemand = mergeDemandEntries(demand, ghostDemand);
            triadGraph.push({
                nodeId: `${className}.${method.getName()}`,
                category,
                sourcePath,
                fission: {
                    problem: `执行 ${method.getName()} 流程`,
                    demand: mergedDemand.length > 0 ? mergedDemand : ['None'],
                    answer: [answer]
                }
            });
        }
    }
}
function collectExportedFunctionNodes(sourceFile, category, sourcePath, triadGraph, config) {
    const moduleName = toPascalCase(sourceFile.getBaseNameWithoutExtension());
    for (const fn of sourceFile.getFunctions()) {
        const functionName = fn.getName();
        if (!functionName || !fn.isExported()) {
            continue;
        }
        if (!config.parser.includeUntaggedExports && !hasTriadTag(fn, config)) {
            continue;
        }
        const demand = fn.getParameters().map((parameter) => {
            const typeName = parameter.getTypeNode()?.getText() ?? 'unknown';
            return `${typeName} (${parameter.getName()})`;
        });
        const ghostDemand = collectGhostDependencies(fn);
        const answer = fn.getReturnTypeNode()?.getText() ?? fn.getReturnType().getText(fn);
        const mergedDemand = mergeDemandEntries(demand, ghostDemand);
        triadGraph.push({
            nodeId: `${moduleName}.${functionName}`,
            category,
            sourcePath,
            fission: {
                problem: `执行 ${functionName} 流程`,
                demand: mergedDemand.length > 0 ? mergedDemand : ['None'],
                answer: [answer]
            }
        });
    }
}
function collectGhostDependencies(executable, cls) {
    const body = executable.getBody();
    if (!body) {
        return [];
    }
    const localNames = new Set(executable.getParameters().map((parameter) => parameter.getName()));
    const ghostMap = new Map();
    body.forEachDescendant((node) => {
        const declaredName = getDeclaredName(node);
        if (declaredName) {
            localNames.add(declaredName);
        }
    });
    body.forEachDescendant((node) => {
        if (cls && ts_morph_1.Node.isPropertyAccessExpression(node)) {
            const thisGhost = extractThisGhost(node, cls);
            if (thisGhost) {
                registerGhost(ghostMap, thisGhost.label, thisGhost.typeName, getGhostAccessMode(node));
                return;
            }
        }
        if (!ts_morph_1.Node.isIdentifier(node)) {
            return;
        }
        const name = node.getText();
        if (!name || localNames.has(name) || BUILTIN_GLOBALS.has(name)) {
            return;
        }
        if (isDeclarationName(node) || isPropertyNamePosition(node)) {
            return;
        }
        const ghost = resolveIdentifierGhost(node, body);
        if (!ghost) {
            return;
        }
        registerGhost(ghostMap, ghost.label, ghost.typeName, getGhostAccessMode(node));
    });
    return Array.from(ghostMap.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, ghost]) => {
        if (ghost.read && ghost.write) {
            return `[Ghost:ReadWrite] ${ghost.typeName} (${label})`;
        }
        if (ghost.write) {
            return `[Ghost:Write] ${ghost.typeName} (${label})`;
        }
        return `[Ghost:Read] ${ghost.typeName} (${label})`;
    });
}
function getDeclaredName(node) {
    if (ts_morph_1.Node.isVariableDeclaration(node) ||
        ts_morph_1.Node.isBindingElement(node) ||
        ts_morph_1.Node.isParameterDeclaration(node) ||
        ts_morph_1.Node.isFunctionDeclaration(node) ||
        ts_morph_1.Node.isClassDeclaration(node) ||
        ts_morph_1.Node.isEnumDeclaration(node)) {
        return node.getName?.() ?? '';
    }
    return '';
}
function resolveIdentifierGhost(node, body) {
    if (!ts_morph_1.Node.isIdentifier(node)) {
        return null;
    }
    const definitions = node.getDefinitions();
    if (definitions.length === 0) {
        return null;
    }
    const definitionNode = getDefinitionDeclarationNode(definitions[0].getNode());
    if (ts_morph_1.Node.isImportSpecifier(definitionNode) ||
        ts_morph_1.Node.isNamespaceImport(definitionNode) ||
        ts_morph_1.Node.isImportClause(definitionNode)) {
        return {
            label: normalizeImportedGhostLabel(node),
            typeName: normalizeTypeName(node.getType().getText(node) || 'unknown')
        };
    }
    if (!isExternalDefinition(definitionNode, body)) {
        return null;
    }
    if (ts_morph_1.Node.isVariableDeclaration(definitionNode) ||
        ts_morph_1.Node.isFunctionDeclaration(definitionNode) ||
        ts_morph_1.Node.isClassDeclaration(definitionNode) ||
        ts_morph_1.Node.isEnumDeclaration(definitionNode)) {
        return {
            label: node.getText(),
            typeName: normalizeTypeName(node.getType().getText(node) || 'unknown')
        };
    }
    return null;
}
function getDefinitionDeclarationNode(node) {
    let current = node;
    while (ts_morph_1.Node.isIdentifier(current) && current.getParent()) {
        const parent = current.getParentOrThrow();
        if (ts_morph_1.Node.isImportSpecifier(parent) ||
            ts_morph_1.Node.isNamespaceImport(parent) ||
            ts_morph_1.Node.isImportClause(parent) ||
            ts_morph_1.Node.isVariableDeclaration(parent) ||
            ts_morph_1.Node.isFunctionDeclaration(parent) ||
            ts_morph_1.Node.isClassDeclaration(parent) ||
            ts_morph_1.Node.isEnumDeclaration(parent) ||
            ts_morph_1.Node.isPropertyDeclaration(parent)) {
            return parent;
        }
        current = parent;
    }
    return current;
}
function extractThisGhost(node, cls) {
    if (!ts_morph_1.Node.isPropertyAccessExpression(node)) {
        return null;
    }
    const rootAccess = getRootThisPropertyAccess(node);
    if (!rootAccess) {
        return null;
    }
    const propertyName = rootAccess.getName();
    const propertyDecl = cls.getProperty(propertyName);
    const typeName = normalizeTypeName(propertyDecl?.getTypeNode()?.getText() ??
        propertyDecl?.getType().getText(propertyDecl) ??
        node.getType().getText(node) ??
        'unknown');
    return {
        label: `this.${propertyName}`,
        typeName
    };
}
function getRootThisPropertyAccess(node) {
    if (!ts_morph_1.Node.isPropertyAccessExpression(node)) {
        return null;
    }
    let current = node;
    while (ts_morph_1.Node.isPropertyAccessExpression(current)) {
        const expression = current.getExpression();
        if (ts_morph_1.Node.isThisExpression(expression)) {
            return current;
        }
        if (!ts_morph_1.Node.isPropertyAccessExpression(expression)) {
            return null;
        }
        current = expression;
    }
    return null;
}
function normalizeImportedGhostLabel(node) {
    if (!ts_morph_1.Node.isIdentifier(node)) {
        return '';
    }
    return node.getText();
}
function isExternalDefinition(definitionNode, body) {
    if (definitionNode.getSourceFile().getFilePath() !== body.getSourceFile().getFilePath()) {
        return true;
    }
    return definitionNode.getStart() < body.getStart() || definitionNode.getEnd() > body.getEnd();
}
function registerGhost(ghostMap, label, typeName, mode) {
    if (!label) {
        return;
    }
    const current = ghostMap.get(label) ?? {
        typeName: normalizeTypeName(typeName),
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
        current.typeName = normalizeTypeName(typeName);
    }
    ghostMap.set(label, current);
}
function getGhostAccessMode(node) {
    const target = getAccessTarget(node);
    const parent = target.getParent();
    if (!parent) {
        return 'read';
    }
    if (ts_morph_1.Node.isBinaryExpression(parent) && parent.getLeft() === target) {
        switch (parent.getOperatorToken().getKind()) {
            case ts_morph_1.SyntaxKind.EqualsToken:
                return 'write';
            case ts_morph_1.SyntaxKind.PlusEqualsToken:
            case ts_morph_1.SyntaxKind.MinusEqualsToken:
            case ts_morph_1.SyntaxKind.AsteriskEqualsToken:
            case ts_morph_1.SyntaxKind.AsteriskAsteriskEqualsToken:
            case ts_morph_1.SyntaxKind.SlashEqualsToken:
            case ts_morph_1.SyntaxKind.PercentEqualsToken:
            case ts_morph_1.SyntaxKind.AmpersandEqualsToken:
            case ts_morph_1.SyntaxKind.BarEqualsToken:
            case ts_morph_1.SyntaxKind.CaretEqualsToken:
            case ts_morph_1.SyntaxKind.LessThanLessThanEqualsToken:
            case ts_morph_1.SyntaxKind.GreaterThanGreaterThanEqualsToken:
            case ts_morph_1.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
                return 'readwrite';
        }
    }
    if (ts_morph_1.Node.isPrefixUnaryExpression(parent) && parent.getOperand() === target) {
        const operator = parent.getOperatorToken();
        if (operator === ts_morph_1.SyntaxKind.PlusPlusToken || operator === ts_morph_1.SyntaxKind.MinusMinusToken) {
            return 'readwrite';
        }
    }
    if (ts_morph_1.Node.isPostfixUnaryExpression(parent) && parent.getOperand() === target) {
        const operator = parent.getOperatorToken();
        if (operator === ts_morph_1.SyntaxKind.PlusPlusToken || operator === ts_morph_1.SyntaxKind.MinusMinusToken) {
            return 'readwrite';
        }
    }
    return 'read';
}
function getAccessTarget(node) {
    let current = node;
    while (true) {
        const parent = current.getParent();
        if (!parent) {
            return current;
        }
        if ((ts_morph_1.Node.isPropertyAccessExpression(parent) || ts_morph_1.Node.isElementAccessExpression(parent)) &&
            parent.getExpression() === current) {
            current = parent;
            continue;
        }
        if (ts_morph_1.Node.isParenthesizedExpression(parent) ||
            ts_morph_1.Node.isNonNullExpression(parent) ||
            ts_morph_1.Node.isAsExpression(parent) ||
            ts_morph_1.Node.isTypeAssertion(parent)) {
            current = parent;
            continue;
        }
        return current;
    }
}
function isDeclarationName(node) {
    if (!ts_morph_1.Node.isIdentifier(node)) {
        return false;
    }
    const parent = node.getParent();
    if (!parent) {
        return false;
    }
    return ((ts_morph_1.Node.isVariableDeclaration(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isBindingElement(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isParameterDeclaration(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isFunctionDeclaration(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isMethodDeclaration(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isClassDeclaration(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isPropertyDeclaration(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isEnumDeclaration(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isImportSpecifier(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isNamespaceImport(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isImportClause(parent) && parent.getDefaultImport() === node));
}
function isPropertyNamePosition(node) {
    if (!ts_morph_1.Node.isIdentifier(node)) {
        return false;
    }
    const parent = node.getParent();
    return ((ts_morph_1.Node.isPropertyAccessExpression(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isPropertyAssignment(parent) && parent.getNameNode() === node) ||
        (ts_morph_1.Node.isPropertyDeclaration(parent) && parent.getNameNode() === node));
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
function normalizeTypeName(value) {
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized || 'unknown';
}
function toPascalCase(value) {
    return value
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}
function hasTriadTag(node, config) {
    const supportedTags = new Set([
        config.parser.jsDocTags.triadNode,
        config.parser.jsDocTags.leftBranch,
        config.parser.jsDocTags.rightBranch
    ]);
    return node
        .getJsDocs()
        .flatMap((doc) => doc.getTags())
        .some((tag) => supportedTags.has(tag.getTagName()));
}
//# sourceMappingURL=typescriptParser.js.map