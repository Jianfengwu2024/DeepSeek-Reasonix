/**
 * dreamRuleExtractor.ts
 *
 * LLM-powered rule extraction from dream proposal rejections.
 * Given a rejected proposal and the user's natural-language reason,
 * calls OpenAI/Anthropic to produce a structured architecture constraint
 * that can be persisted in the DreamRuleLedger and injected into the
 * Navigator prompt as "lessons learned from past mistakes."
 */

import * as fs from 'fs';
import type { DreamProposalRejectionRecord } from './dreamFeedbackSupport';
import type { DreamProposal } from './dream';
import { loadTriadConfig, TriadConfig } from './config';
import type { WorkspacePaths } from './workspace';
import type { DreamRuleEntry } from './dreamRuleLedger';

// ─── Public types ───────────────────────────────────────────────

export interface ExtractRuleInput {
    proposal: DreamProposal;
    rejection: DreamProposalRejectionRecord;
}

export interface ExtractRuleResult {
    /** true when the LLM successfully extracted a rule. */
    extracted: boolean;
    /** The structured rule when extracted, or a fallback. */
    rule: ExtractedRule;
    /** Raw LLM response text (for diagnostics). */
    rawResponse?: string;
    /** Error message when extraction failed. */
    error?: string;
}

/**
 * The structured output expected from the LLM.
 * This is a subset of DreamRuleEntry filled by the LLM.
 */
export interface ExtractedRule {
    /** One-sentence summary of the architecture constraint. */
    summary: string;
    /** Nature of the constraint. */
    constraintType: 'forbid' | 'require' | 'exempt';
    /** Glob-like or source-path pattern for where the rule applies.
     *  The LLM infers this from the proposal's sourcePath / protocolDraft. */
    targetPattern: string;
    /** LLM self-assessed confidence (0–1). */
    confidence: number;
    /** Optional TTL in days. null means "until manually removed". */
    ttlDays: number | null;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Call the configured LLM to extract a structured architecture constraint
 * from a rejected dream proposal and its rejection reason.
 *
 * Returns a fully populated result. When the LLM is not configured or the
 * call fails, `extracted` is false and `rule` contains a best-effort
 * fallback derived from the rejection reason.
 */
export async function extractRuleFromRejection(
    paths: Pick<WorkspacePaths, 'projectRoot' | 'triadDir' | 'configFile' | 'profileFile'>,
    input: ExtractRuleInput
): Promise<ExtractRuleResult> {
    const config = loadTriadConfig(paths);

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
        ...(input.proposal.actions || []).map((action: string) => `  - ${action}`),
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
    } catch (error: any) {
        return {
            extracted: false,
            rule: fallbackRule(input),
            error: `LLM call failed: ${error.message ?? String(error)}`
        };
    }
}

// ─── LLM calling (mirrors navigatorLlm.ts pattern) ────────────────

type LlmProvider = 'openai' | 'anthropic';

interface LlmConfig {
    provider: LlmProvider;
    model: string;
    apiKey: string;
    baseUrl: string;
    timeoutMs: number;
    maxOutputTokens: number;
    temperature: number;
}

function isLlmConfigured(config: TriadConfig): boolean {
    const navigator = config.navigator;
    if (!navigator) return false;
    const apiKeyEnv = navigator.apiKeyEnv || defaultApiKeyEnv(navigator.provider as LlmProvider);
    const apiKey = String(process.env[apiKeyEnv] ?? '').trim();
    return apiKey.length > 0;
}

function resolveLlmConfig(config: TriadConfig): LlmConfig {
    const navigator = config.navigator;
    const provider: LlmProvider =
        navigator.provider === 'anthropic' ? 'anthropic' : 'openai';
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

async function callLlmForExtraction(
    config: TriadConfig,
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    const llm = resolveLlmConfig(config);
    return llm.provider === 'anthropic'
        ? requestAnthropicCompletion(llm, systemPrompt, userPrompt)
        : requestOpenAiCompletion(llm, systemPrompt, userPrompt);
}

async function requestOpenAiCompletion(
    config: LlmConfig,
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    const body = {
        model: config.model,
        input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        text: { format: { type: 'text' } as const },
        temperature: config.temperature,
        max_output_tokens: config.maxOutputTokens
    };

    const response = await fetchJsonWithTimeout(
        joinUrl(config.baseUrl, 'responses'),
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(body)
        },
        config.timeoutMs
    );

    const output = response?.output;
    if (Array.isArray(output)) {
        for (const item of output) {
            if (item?.type === 'message' && Array.isArray(item.content)) {
                const text = item.content
                    .filter((c: any) => c?.type === 'output_text')
                    .map((c: any) => c.text)
                    .join('');
                if (text) return text;
            }
        }
    }

    throw new Error('OpenAI response did not contain expected output_text content.');
}

async function requestAnthropicCompletion(
    config: LlmConfig,
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    const body = {
        model: config.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: config.maxOutputTokens,
        temperature: config.temperature
    };

    const response = await fetchJsonWithTimeout(
        joinUrl(config.baseUrl, 'messages'),
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(body)
        },
        config.timeoutMs
    );

    const content = response?.content;
    if (Array.isArray(content)) {
        const text = content
            .filter((c: any) => c?.type === 'text')
            .map((c: any) => c.text)
            .join('');
        if (text) return text;
    }

    throw new Error('Anthropic response did not contain expected text content.');
}

// ─── Response parsing ────────────────────────────────────────────

function parseExtractedRule(raw: string): ExtractedRule | null {
    // Strip possible markdown fences
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        const firstNl = cleaned.indexOf('\n');
        const lastFence = cleaned.lastIndexOf('```');
        if (firstNl > 0 && lastFence > firstNl) {
            cleaned = cleaned.slice(firstNl + 1, lastFence).trim();
        }
    }

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        // Try to extract JSON object from the response
        const match = cleaned.match(/\{[^{}]*("summary"|"constraintType")[^{}]*\}/);
        if (match) {
            try {
                parsed = JSON.parse(match[0]);
            } catch {
                return null;
            }
        } else {
            return null;
        }
    }

    if (!parsed || typeof parsed !== 'object') return null;
    const summary = String(parsed.summary ?? '').trim();
    if (!summary) return null;

    const constraintType = normalizeConstraintType(parsed.constraintType);
    const targetPattern = String(parsed.targetPattern ?? '').trim() || '*';
    const confidence = clampNumber(Number(parsed.confidence) || 0.5, 0, 1);
    const ttlDays = Number.isFinite(parsed.ttlDays) ? Math.max(1, Number(parsed.ttlDays)) : null;

    return { summary, constraintType, targetPattern, confidence, ttlDays };
}

function normalizeConstraintType(value: unknown): 'forbid' | 'require' | 'exempt' {
    const s = String(value ?? '').trim().toLowerCase();
    if (s === 'forbid' || s === 'require' || s === 'exempt') return s;
    return 'forbid';
}

// ─── Fallback ────────────────────────────────────────────────────

function buildFallbackResult(
    input: ExtractRuleInput,
    error: string
): ExtractRuleResult {
    return {
        extracted: false,
        rule: fallbackRule(input),
        error
    };
}

function fallbackRule(input: ExtractRuleInput): ExtractedRule {
    return {
        summary: truncateText(input.rejection.reason, 200),
        constraintType: input.rejection.isStableAnchor ? 'exempt' : 'forbid',
        targetPattern: inferTargetPattern(input),
        confidence: 0.4,
        ttlDays: input.rejection.isStableAnchor ? null : 90
    };
}

function inferTargetPattern(input: ExtractRuleInput): string {
    if (input.proposal.sourcePath) return input.proposal.sourcePath;
    const draft = input.proposal.protocolDraft;
    if (draft?.actions) {
        for (const action of draft.actions) {
            const src = (action as any).node?.sourcePath || (action as any).sourcePath;
            if (src) return String(src);
        }
    }
    return '*';
}

// ─── HTTP / URL utilities ────────────────────────────────────────

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
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
        } catch {
            return JSON.parse(extractJson(text));
        }
    } finally {
        clearTimeout(timer);
    }
}

function extractJson(text: string): string {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return text.slice(start, end + 1);
    }
    return text;
}

function joinUrl(base: string, path: string): string {
    const baseClean = base.replace(/\/+$/, '');
    const pathClean = path.replace(/^\/+/, '');
    return `${baseClean}/${pathClean}`;
}

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function defaultApiKeyEnv(provider: LlmProvider): string {
    return provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
}

function defaultModel(provider: LlmProvider): string {
    return provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
}

function defaultBaseUrl(provider: LlmProvider): string {
    return provider === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : 'https://api.openai.com/v1';
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function truncateText(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
}
