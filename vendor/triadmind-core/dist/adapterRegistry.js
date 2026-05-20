"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdapter = registerAdapter;
exports.resolveAdapter = resolveAdapter;
exports.getAvailableAdapters = getAvailableAdapters;
const config_1 = require("./config");
const typescriptAdapter_1 = require("./typescriptAdapter");
const polyglotAdapter_1 = require("./polyglotAdapter");
const workspace_1 = require("./workspace");
const adapterRegistry = new Map();
const builtinAdapters = [
    (0, typescriptAdapter_1.createTypeScriptAdapter)(),
    (0, polyglotAdapter_1.createJavaScriptAdapter)(),
    (0, polyglotAdapter_1.createPythonAdapter)(),
    (0, polyglotAdapter_1.createGoAdapter)(),
    (0, polyglotAdapter_1.createRustAdapter)(),
    (0, polyglotAdapter_1.createCppAdapter)(),
    (0, polyglotAdapter_1.createJavaAdapter)()
];
builtinAdapters.forEach((adapter) => registerAdapter(adapter));
/**
 * TriadMind 自动生成骨架
 * 职责：执行 registerAdapter 流程
 */
function registerAdapter(adapter) {
    const existing = adapterRegistry.get(adapter.language);
    if (existing?.status === 'stable' && adapter.status !== 'stable') {
        throw new Error(`Cannot replace stable ${adapter.language} adapter with non-stable implementation`);
    }
    adapterRegistry.set(adapter.language, adapter);
}
/**
 * TriadMind 自动生成骨架
 * 职责：执行 resolveAdapter 流程
 */
function resolveAdapter(pathsOrProjectRoot) {
    const paths = typeof pathsOrProjectRoot === 'string' ? (0, workspace_1.getWorkspacePaths)(pathsOrProjectRoot) : pathsOrProjectRoot;
    const config = (0, config_1.loadTriadConfig)(paths);
    const adapter = adapterRegistry.get(config.architecture.language);
    if (!adapter) {
        throw new Error(`Unsupported TriadMind language adapter: ${config.architecture.language}`);
    }
    if (adapter.status !== 'stable') {
        throw new Error(`${adapter.displayName} adapter is not implemented yet. Planned package: ${adapter.adapterPackage}`);
    }
    return adapter;
}
/**
 * TriadMind 自动生成骨架
 * 职责：执行 getAvailableAdapters 流程
 */
function getAvailableAdapters() {
    return Array.from(adapterRegistry.values());
}
//# sourceMappingURL=adapterRegistry.js.map