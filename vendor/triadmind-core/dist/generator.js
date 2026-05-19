"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyProtocol = applyProtocol;
const adapter_1 = require("./adapter");
/**
 * TriadMind 自动生成骨架
 * 职责：执行 applyProtocol 流程
 */
function applyProtocol(projectRoot, protocolPath) {
    return (0, adapter_1.resolveAdapter)(projectRoot).applyUpgradeProtocol(projectRoot, protocolPath);
}
if (require.main === module) {
    applyProtocol(process.argv[2] ?? process.cwd(), process.argv[3]);
}
//# sourceMappingURL=generator.js.map