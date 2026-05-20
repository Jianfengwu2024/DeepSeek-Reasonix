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
exports.installAlwaysOnRules = installAlwaysOnRules;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const workspace_1 = require("./workspace");
const START_MARKER = '<!-- TRIADMIND_RULES_START -->';
const END_MARKER = '<!-- TRIADMIND_RULES_END -->';
function installAlwaysOnRules(paths) {
    fs.mkdirSync(paths.triadDir, { recursive: true });
    fs.mkdirSync(paths.cursorRulesDir, { recursive: true });
    const agentRules = buildAgentRules(paths);
    fs.writeFileSync(paths.agentRulesFile, agentRules, 'utf-8');
    upsertAgentsMd(paths.agentsFile, agentRules);
    fs.writeFileSync(paths.cursorRuleFile, buildCursorRule(paths), 'utf-8');
}
function buildAgentRules(paths) {
    return [
        START_MARKER,
        '# TriadMind Always-On Rules',
        '',
        `- Before answering architecture questions, read \`${(0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.mapFile))}\`.`,
        `- Before generating or modifying code, read \`${(0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.configFile))}\` and \`${(0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.masterPromptFile))}\`.`,
        '- Do not jump straight into implementation when a topology upgrade is required.',
        '- Prefer the TriadMind sequence: Macro -> Meso -> Micro -> draft-protocol -> visualizer -> apply -> handoff.',
        '- If the user message starts with `@triadmind`, treat it as a TriadMind directive.',
        '- If the body is a control command like `init`, `macro`, `meso`, `micro`, `finalize`, `plan`, `apply`, `renormalize`, `heal`, or `handoff`, route to the matching TriadMind lifecycle action.',
        '- Otherwise, treat it as a silent topology-upgrade demand: run the full protocol workflow first, then continue to apply and handoff.',
        '- Use `reuse` first, then `modify`, and only use `create_child` when the current leaf node cannot safely absorb the new responsibility.',
        '- If a runtime error occurs, prefer generating a repair protocol via `.triadmind/healing-prompt.md` instead of ad-hoc code edits.',
        END_MARKER,
        ''
    ].join('\n');
}
function buildCursorRule(paths) {
    return `---
description: TriadMind always-on architecture guard
alwaysApply: true
---

Before answering architecture questions, read \`${(0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.mapFile))}\`.
Before generating or changing code, read \`${(0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.configFile))}\` and \`${(0, workspace_1.normalizePath)(path.relative(paths.projectRoot, paths.masterPromptFile))}\`.
When a feature changes topology, do not skip protocol design. Follow:
Macro -> Meso -> Micro -> draft-protocol -> visualizer -> apply -> handoff.
If the user message starts with \`@triadmind\`, treat it as a TriadMind directive.
If it is a control command like \`init\`, \`macro\`, \`meso\`, \`micro\`, \`finalize\`, \`plan\`, \`apply\`, \`renormalize\`, \`heal\`, or \`handoff\`, route to that lifecycle action.
Otherwise, treat it as a silent topology-upgrade demand, complete the protocol workflow first, then continue to apply and handoff.
Prefer \`reuse\`, then \`modify\`, and only then \`create_child\`.
`;
}
function upsertAgentsMd(agentsPath, triadRules) {
    const existing = (0, artifactReaders_1.readTextIfExists)(agentsPath);
    const normalized = stripExistingRules(existing).trimEnd();
    const next = normalized ? `${normalized}\n\n${triadRules}` : triadRules;
    fs.writeFileSync(agentsPath, next, 'utf-8');
}
function stripExistingRules(content) {
    const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}\\n?`, 'g');
    return content.replace(pattern, '').trim();
}
//# sourceMappingURL=rules.js.map