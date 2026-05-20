"use strict";
/**
 * dreamRuleExtractor.ts
 *
 * LLM-powered rule extraction from dream proposal rejections.
 * Given a rejected proposal and the user's natural-language reason,
 * calls OpenAI/Anthropic to produce a structured architecture constraint
 * that can be persisted in the DreamRuleLedger and injected into the
 * Navigator prompt as "lessons learned from past mistakes."
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRuleFromRejection = extractRuleFromRejection;
const config_1 = require("./config");
// ─── Public API ──────────────────────────────────────────────────
/**
 * Call the configured LLM to extract a structured architecture constraint
 * from a rejected dream proposal and its rejection reason.
 *
 * Returns a fully populated result. When the LLM is not configured or the
 * call fails, `extracted` is false and `rule` contains a best-effort
 * fallback derived from the rejection reason.
 */
async function extractRuleFromRejection(paths, input) {
    const config = (0, config_1.loadTriadConfig)(paths);
    if (!isLlmConfigured(config)) {
        return buildFallbackResult(input, 'LLM not configured; skipping rule extraction.');
    }
    const systemPrompt = [
        'You are an architecture constraint extractor for TriadMind.',
        'You will be shown a dream proposal that was rejected and the rejection reason.',
        'Your task: distill the rejection into a single, precise architecture constraint rule.',
        '',
        'Rules:',
        '- Return ONLY strict JSON matching the schema below. No prose, no fences.',
        '- The summary must be a concrete, actionable rule (one sentence).',
        '- constraintType: "forbid" = don\'t do this pattern; "require" = must use this pattern; "exempt" = mark area as exempt.',
        '- targetPattern: infer a glob-like path pattern from the proposal context.',
        '- confidence: 0.0–1.0 based on how clear the rule is from the rejection.',
        '- ttlDays: null for permanent rules, or a reasonable number (7–180) for temporary constraints.',
        '',
        'Output JSON schema:',
        JSON.stringify({
            summary: 'string — e.g. "Payment modules must depend on IPaymentStrategy, never on ConcretePaymentGateway."',
            constraintType: '"forbid" | "require" | "exempt"',
            targetPattern: 'string — e.g. "src/payment/**" or "src/services/*.ts"',
            confidence: 'number 0-1',
            ttlDays: 'number | null'
        }, null, 2)
    ].join('\n');
    const userPrompt = [
        '## Rejected Dream Proposal',
        `- ID: ${input.proposal.id}`,
        `- Title: ${input.proposal.title}`,
        `- Priority: ${input.proposal.priority}`,
        `- Objective: ${input.proposal.objective}`,
        `- Expected Outcome: ${input.proposal.expectedOutcome}`,
        `- Source Path: ${input.proposal.sourcePath || '(none)'}`,
        `- Linked Findings: ${(input.proposal.linkedFindings || []).join(', ') || '(none)'}`,
        '',
        'Proposed Actions:',
        ...(input.proposal.actions || []).map((action) => `  - ${action}`),
        '',
        '## Rejection Reason',
        `- Reason: ${input.rejection.reason}`,
        input.rejection.reasonCode ? `- Reason Code: ${input.rejection.reasonCode}` : '',
        `- Reviewer Role: ${input.rejection.reviewerRole}`,
        input.rejection.isStableAnchor ? '- Context: Target is a stable architecture anchor.' : '',
        '',
        '## Instructions',
        'Distill the rejection above into one structured architecture constraint.',
        'Return only the JSON object, nothing else.'
    ]
        .filter((line) => line !== '')
        .join('\n');
    try {
        const rawResponse = await callLlmForExtraction(config, systemPrompt, userPrompt);
        const rule = parseExtractedRule(rawResponse);
        if (!rule) {
            return {
                extracted: false,
                rule: fallbackRule(input),
                rawResponse,
                error: 'Failed to parse LLM response into valid rule schema.'
            };
        }
        return {
            extracted: true,
            rule,
            rawResponse
        };
    }
    catch (error) {
        return {
            extracted: false,
            rule: fallbackRule(input),
            error: `LLM call failed: ${error.message ?? String(error)}`
        };
    }
}
function isLlmConfigured(config) {
    const navigator = config.navigator;
    if (!navigator)
        return false;
    const apiKeyEnv = navigator.apiKeyEnv || defaultApiKeyEnv(navigator.provider);
    const apiKey = String(process.env[apiKeyEnv] ?? '').trim();
    return apiKey.length > 0;
}
function resolveLlmConfig(config) {
    const navigator = config.navigator;
    const provider = navigator.provider === 'anthropic' ? 'anthropic' : 'openai';
    const apiKeyEnv = navigator.apiKeyEnv || defaultApiKeyEnv(provider);
    return {
        provider,
        model: navigator.model || defaultModel(provider),
        apiKey: String(process.env[apiKeyEnv] ?? '').trim(),
        baseUrl: trimTrailingSlash(navigator.baseUrl || defaultBaseUrl(provider)),
        timeoutMs: navigator.timeoutMs || 60_000,
        maxOutputTokens: navigator.maxOutputTokens || 1024,
        temperature: 0.3
    };
}
async function callLlmForExtraction(config, systemPrompt, userPrompt) {
    const llm = resolveLlmConfig(config);
    return llm.provider === 'anthropic'
        ? requestAnthropicCompletion(llm, systemPrompt, userPrompt)
        : requestOpenAiCompletion(llm, systemPrompt, userPrompt);
}
async function requestOpenAiCompletion(config, systemPrompt, userPrompt) {
    const body = {
        model: config.model,
        input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        text: { format: { type: 'text' } },
        temperature: config.temperature,
        max_output_tokens: config.maxOutputTokens
    };
    const response = await fetchJsonWithTimeout(joinUrl(config.baseUrl, 'responses'), {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
    }, config.timeoutMs);
    const output = response?.output;
    if (Array.isArray(output)) {
        for (const item of output) {
            if (item?.type === 'message' && Array.isArray(item.content)) {
                const text = item.content
                    .filter((c) => c?.type === 'output_text')
                    .map((c) => c.text)
                    .join('');
                if (text)
                    return text;
            }
        }
    }
    throw new Error('OpenAI response did not contain expected output_text content.');
}
async function requestAnthropicCompletion(config, systemPrompt, userPrompt) {
    const body = {
        model: config.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: config.maxOutputTokens,
        temperature: config.temperature
    };
    const response = await fetchJsonWithTimeout(joinUrl(config.baseUrl, 'messages'), {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
    }, config.timeoutMs);
    const content = response?.content;
    if (Array.isArray(content)) {
        const text = content
            .filter((c) => c?.type === 'text')
            .map((c) => c.text)
            .join('');
        if (text)
            return text;
    }
    throw new Error('Anthropic response did not contain expected text content.');
}
// ─── Response parsing ────────────────────────────────────────────
function parseExtractedRule(raw) {
    // Strip possible markdown fences
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        const firstNl = cleaned.indexOf('\n');
        const lastFence = cleaned.lastIndexOf('```');
        if (firstNl > 0 && lastFence > firstNl) {
            cleaned = cleaned.slice(firstNl + 1, lastFence).trim();
        }
    }
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch {
        // Try to extract JSON object from the response
        const match = cleaned.match(/\{[^{}]*("summary"|"constraintType")[^{}]*\}/);
        if (match) {
            try {
                parsed = JSON.parse(match[0]);
            }
            catch {
                return null;
            }
        }
        else {
            return null;
        }
    }
    if (!parsed || typeof parsed !== 'object')
        return null;
    const summary = String(parsed.summary ?? '').trim();
    if (!summary)
        return null;
    const constraintType = normalizeConstraintType(parsed.constraintType);
    const targetPattern = String(parsed.targetPattern ?? '').trim() || '*';
    const confidence = clampNumber(Number(parsed.confidence) || 0.5, 0, 1);
    const ttlDays = Number.isFinite(parsed.ttlDays) ? Math.max(1, Number(parsed.ttlDays)) : null;
    return { summary, constraintType, targetPattern, confidence, ttlDays };
}
function normalizeConstraintType(value) {
    const s = String(value ?? '').trim().toLowerCase();
    if (s === 'forbid' || s === 'require' || s === 'exempt')
        return s;
    return 'forbid';
}
// ─── Fallback ────────────────────────────────────────────────────
function buildFallbackResult(input, error) {
    return {
        extracted: false,
        rule: fallbackRule(input),
        error
    };
}
function fallbackRule(input) {
    return {
        summary: truncateText(input.rejection.reason, 200),
        constraintType: input.rejection.isStableAnchor ? 'exempt' : 'forbid',
        targetPattern: inferTargetPattern(input),
        confidence: 0.4,
        ttlDays: input.rejection.isStableAnchor ? null : 90
    };
}
function inferTargetPattern(input) {
    if (input.proposal.sourcePath)
        return input.proposal.sourcePath;
    const draft = input.proposal.protocolDraft;
    if (draft?.actions) {
        for (const action of draft.actions) {
            const src = action.node?.sourcePath || action.sourcePath;
            if (src)
                return String(src);
        }
    }
    return '*';
}
// ─── HTTP / URL utilities ────────────────────────────────────────
async function fetchJsonWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (!response.ok) {
            const body = await response.text().catch(() => '(no body)');
            throw new Error(`HTTP ${response.status} from ${url}: ${body.slice(0, 300)}`);
        }
        const text = await response.text();
        try {
            return JSON.parse(text);
        }
        catch {
            return JSON.parse(extractJson(text));
        }
    }
    finally {
        clearTimeout(timer);
    }
}
function extractJson(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return text.slice(start, end + 1);
    }
    return text;
}
function joinUrl(base, path) {
    const baseClean = base.replace(/\/+$/, '');
    const pathClean = path.replace(/^\/+/, '');
    return `${baseClean}/${pathClean}`;
}
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}
function defaultApiKeyEnv(provider) {
    return provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
}
function defaultModel(provider) {
    return provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
}
function defaultBaseUrl(provider) {
    return provider === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : 'https://api.openai.com/v1';
}
function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function truncateText(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen - 3) + '...';
}
//# sourceMappingURL=dreamRuleExtractor.js.map