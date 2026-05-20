"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runParser = runParser;
const adapter_1 = require("./adapter");
/**
 * TriadMind 自动生成骨架
 * 职责：执行 runParser 流程
 */
function runParser(targetDir, outputPath) {
    (0, adapter_1.resolveAdapter)(targetDir).parseTopology(targetDir, outputPath);
}
if (require.main === module) {
    runParser(process.argv[2] ?? process.cwd(), process.argv[3]);
}
//# sourceMappingURL=parser.js.map