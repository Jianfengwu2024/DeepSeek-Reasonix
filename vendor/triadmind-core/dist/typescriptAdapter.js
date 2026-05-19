"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTypeScriptAdapter = createTypeScriptAdapter;
exports.readTopologyIR = readTopologyIR;
exports.parseTopology = parseTopology;
exports.applyUpgradeProtocol = applyUpgradeProtocol;
const config_1 = require("./config");
const ir_1 = require("./ir");
const protocol_1 = require("./protocol");
const treeSitterParser_1 = require("./treeSitterParser");
const typescriptGenerator_1 = require("./typescriptGenerator");
const typescriptParser_1 = require("./typescriptParser");
const workspace_1 = require("./workspace");
function createTypeScriptAdapter() {
    return {
        language: 'typescript',
        displayName: 'TypeScript',
        parserEngine: 'tree-sitter',
        adapterPackage: '@triadmind/plugin-ts',
        status: 'stable',
        readTopologyIR,
        parseTopology,
        applyUpgradeProtocol,
        supportsRuntimeHealing: true
    };
}
/**
 * TriadMind 自动生成骨架
 * 职责：执行 readTopologyIR 流程
 */
function readTopologyIR(projectRoot) {
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    return (0, ir_1.buildTopologyIR)((0, protocol_1.readTriadMap)(paths.mapFile), 'typescript');
}
/**
 * TriadMind 自动生成骨架
 * 职责：执行 parseTopology 流程
 */
function parseTopology(projectRoot, outputPath, configOverride) {
    const paths = (0, workspace_1.getWorkspacePaths)(projectRoot);
    const config = configOverride ?? (0, config_1.loadTriadConfig)(paths);
    if (config.architecture.parserEngine === 'native') {
        (0, typescriptParser_1.runTypeScriptParser)(projectRoot, outputPath);
        return;
    }
    (0, treeSitterParser_1.runTreeSitterParser)('typescript', projectRoot, outputPath ?? paths.mapFile, config);
}
/**
 * TriadMind 自动生成骨架
 * 职责：执行 applyUpgradeProtocol 流程
 */
function applyUpgradeProtocol(projectRoot, protocolPath) {
    return (0, typescriptGenerator_1.applyTypeScriptProtocol)(projectRoot, protocolPath);
}
//# sourceMappingURL=typescriptAdapter.js.map