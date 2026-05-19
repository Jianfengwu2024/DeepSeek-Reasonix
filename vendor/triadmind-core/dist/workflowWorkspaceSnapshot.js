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
exports.createTriadPlanningPromptContext = createTriadPlanningPromptContext;
exports.createMasterPromptContext = createMasterPromptContext;
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const stage_1 = require("./stage");
const dreamFeedbackSupport_1 = require("./dreamFeedbackSupport");
const workspace_1 = require("./workspace");
const workflowPromptSupport_1 = require("./workflowPromptSupport");
function createTriadPlanningPromptContext(paths, userDemand) {
    const triadizationReportJson = (0, workflowPromptSupport_1.safeRead)(paths.triadizationReportFile);
    const triadizationSessionJson = (0, workflowPromptSupport_1.safeRead)(paths.triadizationSessionFile);
    return {
        triadSpec: readRequiredFile(paths.triadSpecFile),
        configJson: (0, workflowPromptSupport_1.safeRead)(paths.configFile),
        mapJson: readRequiredFile(paths.mapFile),
        triadizationReportJson,
        triadizationSessionJson,
        triadizationTask: (0, workflowPromptSupport_1.safeRead)(paths.triadizationTaskFile),
        triadizationFocus: (0, workflowPromptSupport_1.resolveTriadizationFocusContext)(paths, triadizationReportJson),
        stage: createStageAnalysis(paths, userDemand.trim(), triadizationReportJson, triadizationSessionJson),
        userDemand: userDemand.trim(),
        macroJson: (0, workflowPromptSupport_1.safeRead)(paths.macroSplitFile),
        mesoJson: (0, workflowPromptSupport_1.safeRead)(paths.mesoSplitFile),
        microJson: (0, workflowPromptSupport_1.safeRead)(paths.microSplitFile)
    };
}
function createMasterPromptContext(paths) {
    const latestDemand = (0, workflowPromptSupport_1.safeRead)(paths.demandFile);
    const triadizationReport = (0, workflowPromptSupport_1.safeRead)(paths.triadizationReportFile);
    const triadizationSession = (0, workflowPromptSupport_1.safeRead)(paths.triadizationSessionFile);
    const changedFiles = (0, workflowPromptSupport_1.readChangedFiles)(paths);
    return {
        triadSpec: (0, workflowPromptSupport_1.safeRead)(paths.triadSpecFile),
        triadConfig: (0, workflowPromptSupport_1.safeRead)(paths.configFile),
        triadMap: (0, workflowPromptSupport_1.safeRead)(paths.mapFile),
        latestDemand,
        draftProtocol: (0, workflowPromptSupport_1.safeRead)(paths.draftFile),
        macroSplit: (0, workflowPromptSupport_1.safeRead)(paths.macroSplitFile),
        mesoSplit: (0, workflowPromptSupport_1.safeRead)(paths.mesoSplitFile),
        microSplit: (0, workflowPromptSupport_1.safeRead)(paths.microSplitFile),
        triadizationReport,
        triadizationSession,
        triadizationTask: (0, workflowPromptSupport_1.safeRead)(paths.triadizationTaskFile),
        pipelinePrompt: (0, workflowPromptSupport_1.safeRead)(paths.pipelinePromptFile),
        approvedProtocol: (0, workflowPromptSupport_1.safeRead)(paths.approvedProtocolFile),
        handoffPrompt: (0, workflowPromptSupport_1.safeRead)(paths.handoffPromptFile),
        applyFilesManifest: (0, workflowPromptSupport_1.safeRead)(paths.lastApplyFilesFile),
        triadizationFocus: (0, workflowPromptSupport_1.resolveTriadizationFocusContext)(paths, triadizationReport),
        stage: createStageAnalysis(paths, latestDemand, triadizationReport, triadizationSession),
        dreamFeedbackRules: (0, dreamFeedbackSupport_1.formatDreamFeedbackRules)((0, dreamFeedbackSupport_1.loadDreamFeedbackLedger)(paths).ledger),
        changedFilesSection: renderFileSnippetSections(changedFiles.map((file) => {
            const fullPath = path.join(paths.projectRoot, file);
            return {
                label: 'Changed File',
                path: (0, workspace_1.normalizePath)(file),
                content: (0, artifactReaders_1.readTextIfExists)(fullPath, { trim: true })
            };
        }), '当前没有记录到最近一次 apply 直接涉及的骨架文件。')
    };
}
function createStageAnalysis(paths, latestDemand, triadizationReport, triadizationSession) {
    return (0, stage_1.analyzeWorkspaceStage)({
        latestDemand,
        draftProtocol: (0, workflowPromptSupport_1.safeRead)(paths.draftFile),
        macroSplit: (0, workflowPromptSupport_1.safeRead)(paths.macroSplitFile),
        mesoSplit: (0, workflowPromptSupport_1.safeRead)(paths.mesoSplitFile),
        microSplit: (0, workflowPromptSupport_1.safeRead)(paths.microSplitFile),
        approvedProtocol: (0, workflowPromptSupport_1.safeRead)(paths.approvedProtocolFile),
        triadizationReport,
        triadizationSession
    });
}
function renderFileSnippetSections(entries, emptyMessage) {
    if (entries.length === 0) {
        return emptyMessage;
    }
    return entries
        .map((entry) => [`[${entry.label}] ${entry.path}`, '```ts', entry.content.trim(), '```'].join('\n'))
        .join('\n\n');
}
function readRequiredFile(filePath) {
    return (0, artifactReaders_1.readRequiredTextFile)(filePath, { trim: true });
}
//# sourceMappingURL=workflowWorkspaceSnapshot.js.map