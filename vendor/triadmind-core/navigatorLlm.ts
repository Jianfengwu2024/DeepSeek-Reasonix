import { TriadConfig } from './config';
import { assertProtocolShape, TriadNodeDefinition, UpgradeProtocol } from './protocol';
import { normalizePath, WorkspacePaths } from './workspace';

type NavigatorLlmProvider = 'openai' | 'anthropic';

interface NavigatorLlmGenerationOptions {
    paths: WorkspacePaths;
    demand: string;
    prompt: string;
    config: TriadConfig;
    existingNodes: TriadNodeDefinition[];
    llm?: string;
}

interface NavigatorLlmResolvedConfig {
    provider: NavigatorLlmProvider;
    model: string;
    apiKeyEnv: string;
    apiKey: string;
    baseUrl: string;
    timeoutMs: number;
    maxOutputTokens: number;
    temperature: number;
    maxRepairRounds: number;
    failOnLlmError: boolean;
    requestedByCli: boolean;
}

export interface NavigatorLlmGenerationResult {
    status: 'generated' | 'skipped';
    protocol?: UpgradeProtocol;
    note?: string;
}

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

export async function tryGenerateNavigatorProtocol(
    options: NavigatorLlmGenerationOptions
): Promise<NavigatorLlmGenerationResult> {
    const requestedByCli = Boolean(options.llm?.trim());
    const autoGenerateEnabled = options.config.navigator.autoGenerateProtocol || requestedByCli;
    if (!autoGenerateEnabled) {
        return {
            status: 'skipped'
        };
    }

    const resolved = resolveNavigatorLlmConfig(options.config, options.llm);
    if (!resolved.apiKey) {
        const message = `Navigator LLM API key env is not set: ${resolved.apiKeyEnv}`;
        if (resolved.requestedByCli || resolved.failOnLlmError) {
            throw new Error(message);
        }
        return {
            status: 'skipped',
            note: `${message}; falling back to prompt-first workflow.`
        };
    }

    const systemPrompt = [
        'You are TriadMind Navigator, a pre-implementation architecture copilot.',
        'Return only strict JSON compatible with UpgradeProtocol.',
        'Do not include markdown fences or explanation text.'
    ].join(' ');

    const userPrompt = [
        options.prompt,
        '',
        'Final instruction:',
        `Produce a strict UpgradeProtocol JSON payload for the feature demand ${JSON.stringify(options.demand)}.`,
        'The actions array must contain at least one reuse, modify, or create_child operation.'
    ].join('\n');

    try {
        let rawResponse = await requestNavigatorCompletion(resolved, systemPrompt, userPrompt);
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= resolved.maxRepairRounds; attempt += 1) {
            try {
                const protocol = parseAndValidateNavigatorProtocol(
                    rawResponse,
                    options.paths,
                    options.demand,
                    options.config,
                    options.existingNodes
                );
                return {
                    status: 'generated',
                    protocol,
                    note: `Impact protocol generated via ${resolved.provider}:${resolved.model}.`
                };
            } catch (error: any) {
                lastError = error instanceof Error ? error : new Error(String(error?.message ?? error));
                if (attempt >= resolved.maxRepairRounds) {
                    break;
                }

                rawResponse = await requestNavigatorCompletion(
                    resolved,
                    systemPrompt,
                    buildRepairPrompt(options.prompt, rawResponse, lastError.message)
                );
            }
        }

        throw lastError ?? new Error('Navigator LLM returned an invalid protocol payload.');
    } catch (error: any) {
        const message = `Navigator LLM generation failed: ${error.message ?? String(error)}`;
        if (resolved.requestedByCli || resolved.failOnLlmError) {
            throw new Error(message);
        }
        return {
            status: 'skipped',
            note: `${message}; falling back to prompt-first workflow.`
        };
    }
}

function resolveNavigatorLlmConfig(config: TriadConfig, llm?: string): NavigatorLlmResolvedConfig {
    const override = parseNavigatorLlmDescriptor(llm);
    const provider = override.provider ?? config.navigator.provider;
    const model = override.model ?? config.navigator.model ?? defaultModelForProvider(provider);
    const apiKeyEnv = config.navigator.apiKeyEnv || defaultApiKeyEnvForProvider(provider);
    const baseUrl = trimTrailingSlash(config.navigator.baseUrl || defaultBaseUrlForProvider(provider));

    return {
        provider,
        model,
        apiKeyEnv,
        apiKey: String(process.env[apiKeyEnv] ?? '').trim(),
        baseUrl,
        timeoutMs: config.navigator.timeoutMs,
        maxOutputTokens: config.navigator.maxOutputTokens,
        temperature: config.navigator.temperature,
        maxRepairRounds: config.navigator.maxRepairRounds,
        failOnLlmError: config.navigator.failOnLlmError,
        requestedByCli: Boolean(llm?.trim())
    };
}

function parseNavigatorLlmDescriptor(descriptor?: string): Partial<Pick<NavigatorLlmResolvedConfig, 'provider' | 'model'>> {
    const normalized = String(descriptor ?? '').trim();
    if (!normalized) {
        return {};
    }

    const separatorIndex = normalized.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) {
        throw new Error('Navigator LLM descriptor must look like <provider:model>, for example openai:gpt-5.');
    }

    const provider = normalizeNavigatorLlmProvider(normalized.slice(0, separatorIndex));
    const model = normalized.slice(separatorIndex + 1).trim();
    if (!model) {
        throw new Error('Navigator LLM descriptor is missing the model name after the provider prefix.');
    }

    return {
        provider,
        model
    };
}

function normalizeNavigatorLlmProvider(value: string): NavigatorLlmProvider {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'openai') {
        return 'openai';
    }
    if (normalized === 'anthropic') {
        return 'anthropic';
    }
    throw new Error(`Unsupported navigator LLM provider: ${value}`);
}

async function requestNavigatorCompletion(
    config: NavigatorLlmResolvedConfig,
    systemPrompt: string,
    userPrompt: string
) {
    return config.provider === 'anthropic'
        ? requestAnthropicCompletion(config, systemPrompt, userPrompt)
        : requestOpenAiCompletion(config, systemPrompt, userPrompt);
}

async function requestOpenAiCompletion(
    config: NavigatorLlmResolvedConfig,
    systemPrompt: string,
    userPrompt: string
) {
    const response = await fetchJsonWithTimeout(joinUrl(config.baseUrl, 'responses'), {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            input: [
                {
                    role: 'system',
                    content: [{ type: 'input_text', text: systemPrompt }]
                },
                {
                    role: 'user',
                    content: [{ type: 'input_text', text: userPrompt }]
                }
            ],
            max_output_tokens: config.maxOutputTokens,
            temperature: config.temperature
        }),
        timeoutMs: config.timeoutMs
    });

    return extractOpenAiText(response);
}

async function requestAnthropicCompletion(
    config: NavigatorLlmResolvedConfig,
    systemPrompt: string,
    userPrompt: string
) {
    const response = await fetchJsonWithTimeout(joinUrl(config.baseUrl, 'messages'), {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxOutputTokens,
            temperature: config.temperature,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userPrompt
                }
            ]
        }),
        timeoutMs: config.timeoutMs
    });

    return extractAnthropicText(response);
}

async function fetchJsonWithTimeout(
    url: string,
    options: {
        method: string;
        headers: Record<string, string>;
        body: string;
        timeoutMs: number;
    }
) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
        const response = await fetch(url, {
            method: options.method,
            headers: options.headers,
            body: options.body,
            signal: controller.signal
        });
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 400)}`);
        }

        try {
            return JSON.parse(text) as Record<string, unknown>;
        } catch {
            throw new Error(`Provider response is not valid JSON: ${text.slice(0, 400)}`);
        }
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw new Error(`request timed out after ${options.timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

function parseAndValidateNavigatorProtocol(
    rawResponse: string,
    paths: WorkspacePaths,
    demand: string,
    config: TriadConfig,
    existingNodes: TriadNodeDefinition[]
) {
    const parsed = JSON.parse(extractJsonPayload(rawResponse)) as UpgradeProtocol;
    const normalized = normalizeGeneratedProtocol(parsed, paths, demand);
    return assertProtocolShape(normalized, {
        existingNodes,
        minConfidence: config.protocol.minConfidence,
        requireConfidence: config.protocol.requireConfidence
    });
}

function normalizeGeneratedProtocol(protocol: UpgradeProtocol, paths: WorkspacePaths, demand: string): UpgradeProtocol {
    return {
        ...protocol,
        protocolVersion: protocol.protocolVersion ?? '1.0',
        project: protocol.project ?? normalizePath(paths.projectRoot),
        mapSource: protocol.mapSource ?? normalizePath(paths.mapFile),
        userDemand: demand,
        upgradePolicy: {
            allowedOps:
                protocol.upgradePolicy?.allowedOps && protocol.upgradePolicy.allowedOps.length > 0
                    ? protocol.upgradePolicy.allowedOps
                    : ['reuse', 'modify', 'create_child'],
            principle: protocol.upgradePolicy?.principle ?? 'reuse_first_minimal_change'
        },
        actions: Array.isArray(protocol.actions) ? protocol.actions : []
    };
}

function extractJsonPayload(rawText: string) {
    const trimmed = rawText.trim();
    if (!trimmed) {
        throw new Error('Provider returned an empty response.');
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim();
    }

    try {
        JSON.parse(trimmed);
        return trimmed;
    } catch {
        const extracted = findBalancedJsonObject(trimmed);
        if (!extracted) {
            throw new Error('Provider response does not contain a parsable JSON object.');
        }
        return extracted;
    }
}

function findBalancedJsonObject(input: string) {
    let depth = 0;
    let startIndex = -1;
    let inString = false;
    let escapeNext = false;

    for (let index = 0; index < input.length; index += 1) {
        const char = input[index];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (char === '{') {
            if (depth === 0) {
                startIndex = index;
            }
            depth += 1;
            continue;
        }

        if (char === '}') {
            depth -= 1;
            if (depth === 0 && startIndex >= 0) {
                return input.slice(startIndex, index + 1);
            }
        }
    }

    return undefined;
}

function extractOpenAiText(payload: Record<string, unknown>) {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text;
    }

    const output = Array.isArray(payload.output) ? payload.output : [];
    const textChunks: string[] = [];
    for (const item of output) {
        if (!item || typeof item !== 'object') {
            continue;
        }
        const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
        for (const block of content) {
            if (!block || typeof block !== 'object') {
                continue;
            }
            const text = (block as { text?: unknown; output_text?: unknown }).text ?? (block as { output_text?: unknown }).output_text;
            if (typeof text === 'string' && text.trim()) {
                textChunks.push(text);
            }
        }
    }

    if (textChunks.length === 0) {
        throw new Error('OpenAI response did not contain output text.');
    }

    return textChunks.join('\n');
}

function extractAnthropicText(payload: Record<string, unknown>) {
    const content = Array.isArray(payload.content) ? payload.content : [];
    const textChunks = content
        .map((item) => (item && typeof item === 'object' ? (item as { text?: unknown }).text : undefined))
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

    if (textChunks.length === 0) {
        throw new Error('Anthropic response did not contain text content.');
    }

    return textChunks.join('\n');
}

function buildRepairPrompt(originalPrompt: string, invalidResponse: string, validationError: string) {
    return [
        'The previous response was not a valid UpgradeProtocol JSON payload.',
        '',
        `Validation error: ${validationError}`,
        '',
        'Original prompt:',
        originalPrompt,
        '',
        'Previous invalid response:',
        invalidResponse,
        '',
        'Return a corrected UpgradeProtocol JSON object only.'
    ].join('\n');
}

function defaultApiKeyEnvForProvider(provider: NavigatorLlmProvider) {
    return provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
}

function defaultBaseUrlForProvider(provider: NavigatorLlmProvider) {
    return provider === 'anthropic' ? DEFAULT_ANTHROPIC_BASE_URL : DEFAULT_OPENAI_BASE_URL;
}

function defaultModelForProvider(provider: NavigatorLlmProvider) {
    return provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-5';
}

function joinUrl(baseUrl: string, pathSegment: string) {
    return `${trimTrailingSlash(baseUrl)}/${pathSegment.replace(/^\/+/, '')}`;
}

function trimTrailingSlash(value: string) {
    return String(value ?? '').trim().replace(/\/+$/, '');
}
