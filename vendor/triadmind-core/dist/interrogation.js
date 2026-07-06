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
exports.runInterrogation = runInterrogation;
exports.loadInterrogationState = loadInterrogationState;
exports.reviewInterrogation = reviewInterrogation;
exports.approveInterrogation = approveInterrogation;
exports.assertInterrogationApproval = assertInterrogationApproval;
exports.assessInterrogationRequirement = assessInterrogationRequirement;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const abstractionMemory_1 = require("./abstractionMemory");
const artifactReaders_1 = require("./artifactReaders");
const workflowPromptRenderSupport_1 = require("./workflowPromptRenderSupport");
const workspace_1 = require("./workspace");
const navigator_1 = require("./navigator");
const REQUIRED_QUESTION_IDS = ['objective', 'scope', 'constraints', 'success'];
async function runInterrogation(paths, demand, options = {}) {
    const normalizedDemand = demand.trim();
    if (!normalizedDemand) {
        throw new Error('Interrogation demand cannot be empty.');
    }
    fs.mkdirSync(paths.triadDir, { recursive: true });
    const promptContext = (0, abstractionMemory_1.buildAbstractionMemoryPromptContext)(paths, normalizedDemand);
    const prompt = buildInterrogationPrompt(paths, normalizedDemand, promptContext);
    fs.writeFileSync(paths.interrogationPromptFile, prompt, 'utf-8');
    fs.writeFileSync(paths.demandFile, normalizedDemand, 'utf-8');
    const existingState = loadInterrogationState(paths);
    let state = existingState && existingState.userDemand === normalizedDemand
        ? existingState
        : createInterrogationState(paths, normalizedDemand, promptContext);
    if (options.answersFile?.trim()) {
        state = mergeAnswersIntoState(state, readAnswersFile(paths, options.answersFile));
    }
    state = refreshInterrogationState(state);
    fs.writeFileSync(paths.interrogationStateFile, JSON.stringify(state, null, 2), 'utf-8');
    const unanswered = getMissingRequiredQuestionIds(state);
    if (unanswered.length > 0) {
        return {
            status: 'pending_answers',
            demand: normalizedDemand,
            promptFile: paths.interrogationPromptFile,
            stateFile: paths.interrogationStateFile,
            summary: [
                `Interrogation prompt written: ${paths.interrogationPromptFile}`,
                `Interrogation state written: ${paths.interrogationStateFile}`,
                `Pending answers: ${unanswered.join(', ')}`,
                'Ask only the unanswered questions, then write the answers back into interrogation-state.json and rerun `triadmind interrogate`.'
            ],
            state
        };
    }
    if (!state.impactDemand) {
        throw new Error('Interrogation state is missing impactDemand after readiness evaluation.');
    }
    const navigatorResult = await (0, navigator_1.runNavigator)(paths, state.impactDemand, {
        llm: options.llm,
        dashboardOptions: options.dashboardOptions
    });
    if (navigatorResult.status !== 'ready') {
        return {
            status: 'pending_impact_protocol',
            demand: normalizedDemand,
            promptFile: paths.interrogationPromptFile,
            stateFile: paths.interrogationStateFile,
            summary: [
                `Interrogation state is ready for impact review: ${paths.interrogationStateFile}`,
                ...navigatorResult.summary
            ],
            state
        };
    }
    const config = (0, config_1.loadTriadConfig)(paths);
    state.status = 'impact_review';
    const gateAssessment = readInterrogationGateAssessment(navigatorResult.impactProtocolFile, config.interrogation.autoApproveMaxImpactEdgeCount);
    state.updatedAt = new Date().toISOString();
    state.impactFiles = {
        impactMapFile: navigatorResult.impactMapFile,
        impactVisualizerFile: navigatorResult.impactVisualizerFile
    };
    if (gateAssessment.bypassedForSmallImpact) {
        state.status = 'approved_for_development';
        state.approvedAt = state.updatedAt;
    }
    fs.writeFileSync(paths.interrogationStateFile, JSON.stringify(state, null, 2), 'utf-8');
    return {
        status: 'impact_ready',
        demand: normalizedDemand,
        promptFile: paths.interrogationPromptFile,
        stateFile: paths.interrogationStateFile,
        impactMapFile: navigatorResult.impactMapFile,
        impactVisualizerFile: navigatorResult.impactVisualizerFile,
        summary: [
            `Interrogation prompt written: ${paths.interrogationPromptFile}`,
            `Interrogation state written: ${paths.interrogationStateFile}`,
            ...navigatorResult.summary,
            ...(gateAssessment.bypassedForSmallImpact
                ? [
                    `Interrogation gate bypassed: max impact edge count ${gateAssessment.maxImpactEdgeCount} <= ${gateAssessment.autoApproveMaxEdgeCount}.`,
                    'Small-impact demand is approved for development without manual interrogation approval.'
                ]
                : ['Impact review is ready. Ask the user to inspect the shock chain before apply.'])
        ],
        state
    };
}
function loadInterrogationState(paths) {
    if (!fs.existsSync(paths.interrogationStateFile)) {
        return undefined;
    }
    return JSON.parse(fs.readFileSync(paths.interrogationStateFile, 'utf-8'));
}
function reviewInterrogation(paths) {
    return loadInterrogationState(paths);
}
function approveInterrogation(paths) {
    const state = loadInterrogationState(paths);
    if (!state) {
        throw new Error(`Interrogation state file not found: ${paths.interrogationStateFile}`);
    }
    if (state.status === 'approved_for_development') {
        return state;
    }
    if (state.status !== 'impact_review' && state.status !== 'ready_for_impact') {
        throw new Error(`Interrogation state is not ready for approval: ${state.status}`);
    }
    state.status = 'approved_for_development';
    state.updatedAt = new Date().toISOString();
    state.approvedAt = state.updatedAt;
    fs.writeFileSync(paths.interrogationStateFile, JSON.stringify(state, null, 2), 'utf-8');
    return state;
}
function assertInterrogationApproval(paths, protocol) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const gateAssessment = assessInterrogationRequirement(protocol, config.interrogation.autoApproveMaxImpactEdgeCount);
    if (!gateAssessment.requiresApproval) {
        return;
    }
    const state = loadInterrogationState(paths);
    if (!state) {
        throw new Error(`Interrogation approval is required before apply. Missing state file: ${paths.interrogationStateFile}`);
    }
    if (state.status !== 'approved_for_development') {
        throw new Error(`Interrogation approval is required before apply. Current interrogation status is ${state.status}.`);
    }
}
function assessInterrogationRequirement(protocol, autoApproveMaxEdgeCount = 6) {
    const hasExplicitGate = protocol.actions.some((action) => (action.op === 'create_child' && action.node.nodeId === 'RequirementApprovalGate.requireInterrogationPass') ||
        ('nodeId' in action && action.nodeId === 'RequirementApprovalGate.requireInterrogationPass'));
    const maxImpactEdgeCount = deriveMaxImpactEdgeCount(protocol);
    const bypassedForSmallImpact = hasExplicitGate &&
        typeof maxImpactEdgeCount === 'number' &&
        maxImpactEdgeCount <= autoApproveMaxEdgeCount;
    return {
        hasExplicitGate,
        requiresApproval: hasExplicitGate && !bypassedForSmallImpact,
        bypassedForSmallImpact,
        maxImpactEdgeCount,
        autoApproveMaxEdgeCount
    };
}
function createInterrogationState(paths, demand, promptContext) {
    const now = new Date().toISOString();
    const workflowStage = inferWorkflowStage(demand);
    return {
        schemaVersion: '1.0',
        generatedAt: now,
        updatedAt: now,
        project: path.basename(paths.projectRoot),
        userDemand: demand,
        workflowStage,
        status: 'questioning',
        topologyFeedback: {
            summaryLines: promptContext.summaryLines,
            abstractionMatchesJson: (0, abstractionMemory_1.formatAbstractionMemoryPromptJson)(promptContext.matches),
            recommendationsJson: (0, abstractionMemory_1.formatAbstractionMemoryRecommendationsJson)(promptContext.recommendations),
            protocolSeedActionsJson: (0, abstractionMemory_1.formatAbstractionProtocolActionCandidatesJson)(promptContext.protocolActionCandidates)
        },
        questionPlan: createQuestionPlan(workflowStage, promptContext.summaryLines),
        answers: []
    };
}
function createQuestionPlan(workflowStage, summaryLines) {
    const topologyHint = summaryLines.find((line) => /reuse|candidate|anchor|memory/i.test(line)) ??
        'Use the topology feedback to prefer reuse or bounded modify before create_child.';
    const workflowStageQuestion = workflowStage === 'unknown'
        ? 'Is this request creating a brand-new project/workflow, or modifying an existing one?'
        : `Confirm the workflow mode for this request: ${workflowStage}.`;
    return [
        {
            id: 'workflow_stage',
            question: workflowStageQuestion,
            rationale: 'The follow-up strategy changes between greenfield creation and bounded modification.',
            required: false
        },
        {
            id: 'objective',
            question: 'What concrete user-visible outcome must be true when this work is finished?',
            rationale: 'A crisp outcome keeps the topology plan centered on one capability instead of a vague platform expansion.',
            required: true
        },
        {
            id: 'scope',
            question: 'Which existing workflow, capability, or file area should this touch, and what should stay outside scope?',
            rationale: topologyHint,
            required: true
        },
        {
            id: 'constraints',
            question: 'What must remain unchanged, and what is the over-design boundary for this request?',
            rationale: 'This is the main guardrail against turning a bounded feature into a subsystem rewrite.',
            required: true
        },
        {
            id: 'success',
            question: 'What approval signal or review artifact should convince us that the requirement is fully understood?',
            rationale: 'The answer becomes the readiness condition for rendering the shock chain and moving into apply.',
            required: true
        },
        {
            id: 'non_goals',
            question: 'List any tempting but explicitly out-of-scope additions we should reject during planning.',
            rationale: 'Non-goals make the anti-over-design boundary visible to the model and the reviewer.',
            required: false
        }
    ];
}
function buildInterrogationPrompt(paths, demand, promptContext) {
    const triadSpec = (0, artifactReaders_1.readTextIfExists)(paths.triadSpecFile, { trim: true });
    const mapJson = (0, artifactReaders_1.readTextIfExists)(paths.mapFile);
    const existingStateJson = (0, artifactReaders_1.readTextIfExists)(paths.interrogationStateFile);
    const previousDemand = (0, artifactReaders_1.readTextIfExists)(paths.demandFile, { trim: true });
    return (0, workflowPromptRenderSupport_1.renderPromptBlocks)([
        (0, workflowPromptRenderSupport_1.createPromptSection)('System', [
            'You are TriadMind Interrogation Agent, a requirement-clarification copilot that operates before implementation.',
            'Ask only the next bounded follow-up questions needed to clarify demand, merge user answers with topology feedback, and stop once the request is precise enough to render a shock chain.',
            'Avoid over-design. Prefer reuse and bounded modification over new subsystems.',
            'Return only strict JSON compatible with the interrogation-state.json contract. Do not emit prose outside JSON.'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Project Root', (0, workspace_1.normalizePath)(paths.projectRoot)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Interrogation State Output Path', (0, workspace_1.normalizePath)(paths.interrogationStateFile)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Interrogation Prompt Path', (0, workspace_1.normalizePath)(paths.interrogationPromptFile)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Impact Protocol Output Path', (0, workspace_1.normalizePath)(paths.impactProtocolFile)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triad Spec', triadSpec || ''),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triad Map JSON', mapJson, '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Abstraction Memory Workflow', promptContext.summaryLines),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Abstraction Memory Matches JSON', (0, abstractionMemory_1.formatAbstractionMemoryPromptJson)(promptContext.matches), '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Abstraction Memory Recommendations JSON', (0, abstractionMemory_1.formatAbstractionMemoryRecommendationsJson)(promptContext.recommendations), '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Protocol Seed Action Candidates JSON', (0, abstractionMemory_1.formatAbstractionProtocolActionCandidatesJson)(promptContext.protocolActionCandidates), '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Previous Demand', previousDemand ? JSON.stringify(previousDemand) : '""'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('User Demand', JSON.stringify(demand)),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Existing Interrogation State JSON', existingStateJson, '{}'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Interrogation State Contract', [
            'Required top-level fields: schemaVersion, generatedAt, updatedAt, project, userDemand, workflowStage, status, topologyFeedback, questionPlan, answers.',
            'questionPlan is an ordered list of follow-up questions. Ask only unanswered high-value questions and keep the list bounded.',
            'Once the answers are sufficient, fill clarifiedRequirement and impactDemand, then move status to ready_for_impact.',
            'When impact review artifacts already exist, status may move to impact_review.',
            'Never mark approved_for_development on your own; that status is reserved for explicit human approval.'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Behavior Rules', [
            'Use topology feedback to bias toward reuse or bounded modify before create_child.',
            'Turn the requirement into one coherent impactDemand string only when the unanswered required questions are resolved.',
            'If an answer is still missing or ambiguous, leave status as questioning and ask only the smallest next question set.',
            'Reflect anti-over-design constraints inside clarifiedRequirement.constraints and clarifiedRequirement.nonGoals.'
        ])
    ]);
}
function readInterrogationGateAssessment(protocolFile, autoApproveMaxEdgeCount) {
    if (!fs.existsSync(protocolFile)) {
        return {
            hasExplicitGate: false,
            requiresApproval: false,
            bypassedForSmallImpact: false,
            autoApproveMaxEdgeCount
        };
    }
    try {
        const protocol = JSON.parse(fs.readFileSync(protocolFile, 'utf-8'));
        return assessInterrogationRequirement(protocol, autoApproveMaxEdgeCount);
    }
    catch {
        return {
            hasExplicitGate: false,
            requiresApproval: false,
            bypassedForSmallImpact: false,
            autoApproveMaxEdgeCount
        };
    }
}
function deriveMaxImpactEdgeCount(protocol) {
    if (!Array.isArray(protocol.impactedNodes) || protocol.impactedNodes.length === 0) {
        return undefined;
    }
    let maxEdgeCount;
    for (const rawEntry of protocol.impactedNodes) {
        const edgeCount = deriveImpactEdgeCount(rawEntry);
        if (typeof edgeCount !== 'number') {
            continue;
        }
        maxEdgeCount = typeof maxEdgeCount === 'number' ? Math.max(maxEdgeCount, edgeCount) : edgeCount;
    }
    return maxEdgeCount;
}
function deriveImpactEdgeCount(rawEntry) {
    if (!rawEntry || typeof rawEntry !== 'object') {
        return undefined;
    }
    const entry = rawEntry;
    for (const key of ['pathEdges', 'edgeCount', 'hops', 'chainLength', 'impactChainLength', 'distance']) {
        const value = entry[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return Math.max(0, Math.floor(value));
        }
        if (Array.isArray(value)) {
            return Math.max(0, value.length);
        }
    }
    if (Array.isArray(entry.path)) {
        return Math.max(0, entry.path.length - 1);
    }
    if (Array.isArray(entry.edges)) {
        return Math.max(0, entry.edges.length);
    }
    return undefined;
}
function refreshInterrogationState(state) {
    const refreshed = {
        ...state,
        updatedAt: new Date().toISOString()
    };
    const answerMap = new Map((refreshed.answers ?? [])
        .map((entry) => [String(entry.questionId ?? '').trim(), String(entry.answer ?? '').trim()])
        .filter((entry) => entry[0] && entry[1]));
    const missingRequired = getMissingRequiredQuestionIds(refreshed);
    if (missingRequired.length > 0) {
        refreshed.status = 'questioning';
        delete refreshed.clarifiedRequirement;
        delete refreshed.impactDemand;
        delete refreshed.impactFiles;
        delete refreshed.approvedAt;
        return refreshed;
    }
    const clarifiedRequirement = buildClarifiedRequirement(refreshed, answerMap);
    refreshed.clarifiedRequirement = clarifiedRequirement;
    refreshed.impactDemand = buildImpactDemand(refreshed, clarifiedRequirement, answerMap);
    if (refreshed.status !== 'approved_for_development') {
        refreshed.status = refreshed.impactFiles ? 'impact_review' : 'ready_for_impact';
    }
    return refreshed;
}
function buildClarifiedRequirement(state, answerMap) {
    const objective = answerMap.get('objective') ?? '';
    const scope = splitList(answerMap.get('scope'));
    const constraints = splitList(answerMap.get('constraints'));
    const nonGoals = splitList(answerMap.get('non_goals'));
    const successSignals = splitList(answerMap.get('success'));
    const topologyNotes = [
        ...state.topologyFeedback.summaryLines.slice(0, 3),
        'Prefer existing topology anchors before adding new capability hubs.'
    ];
    const summaryParts = [
        objective,
        scope.length > 0 ? `In scope: ${scope.join('; ')}` : '',
        constraints.length > 0 ? `Constraints: ${constraints.join('; ')}` : ''
    ].filter(Boolean);
    return {
        summary: summaryParts.join(' '),
        inScope: scope,
        constraints,
        nonGoals,
        successSignals,
        topologyNotes
    };
}
function buildImpactDemand(state, clarifiedRequirement, answerMap) {
    const parts = [
        clarifiedRequirement.summary,
        clarifiedRequirement.nonGoals.length > 0 ? `Non-goals: ${clarifiedRequirement.nonGoals.join('; ')}` : '',
        clarifiedRequirement.successSignals.length > 0
            ? `Success signals: ${clarifiedRequirement.successSignals.join('; ')}`
            : '',
        clarifiedRequirement.topologyNotes.length > 0
            ? `Topology notes: ${clarifiedRequirement.topologyNotes.join('; ')}`
            : '',
        answerMap.get('workflow_stage') ? `Workflow mode: ${answerMap.get('workflow_stage')}` : '',
        `Original demand: ${state.userDemand}`
    ].filter(Boolean);
    return parts.join(' ');
}
function mergeAnswersIntoState(state, answers) {
    const nextAnswers = new Map();
    for (const answer of state.answers ?? []) {
        const questionId = String(answer.questionId ?? '').trim();
        const value = String(answer.answer ?? '').trim();
        if (questionId && value) {
            nextAnswers.set(questionId, value);
        }
    }
    for (const answer of answers) {
        const questionId = String(answer.questionId ?? '').trim();
        const value = String(answer.answer ?? '').trim();
        if (questionId && value) {
            nextAnswers.set(questionId, value);
        }
    }
    return {
        ...state,
        answers: Array.from(nextAnswers.entries()).map(([questionId, answer]) => ({ questionId, answer }))
    };
}
function readAnswersFile(paths, inputPath) {
    const resolvedPath = path.isAbsolute(inputPath) ? inputPath : path.join(paths.projectRoot, inputPath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Answers file not found: ${resolvedPath}`);
    }
    const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
    if (Array.isArray(parsed)) {
        return parsed
            .map((entry) => ({
            questionId: String(entry.questionId ?? '').trim(),
            answer: String(entry.answer ?? '').trim()
        }))
            .filter((entry) => entry.questionId && entry.answer);
    }
    if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed)
            .map(([questionId, answer]) => ({
            questionId: String(questionId).trim(),
            answer: String(answer ?? '').trim()
        }))
            .filter((entry) => entry.questionId && entry.answer);
    }
    throw new Error(`Answers file must be a JSON object map or array: ${resolvedPath}`);
}
function getMissingRequiredQuestionIds(state) {
    const answerMap = new Map((state.answers ?? [])
        .map((entry) => [String(entry.questionId ?? '').trim(), String(entry.answer ?? '').trim()])
        .filter((entry) => entry[0] && entry[1]));
    return state.questionPlan
        .filter((question) => question.required)
        .map((question) => question.id)
        .filter((questionId) => !answerMap.has(questionId) && REQUIRED_QUESTION_IDS.includes(questionId));
}
function splitList(value) {
    return String(value ?? '')
        .split(/\r?\n|;|,/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function inferWorkflowStage(demand) {
    const normalized = demand.trim().toLowerCase();
    if (/\b(create|new|greenfield|from scratch|bootstrap)\b/.test(normalized)) {
        return 'create';
    }
    if (/\b(modify|change|update|extend|add|refactor|improve)\b/.test(normalized)) {
        return 'modify';
    }
    return 'unknown';
}
//# sourceMappingURL=interrogation.js.map