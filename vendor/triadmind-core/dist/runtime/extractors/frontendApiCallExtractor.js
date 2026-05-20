"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.frontendApiCallExtractor = void 0;
const runtimeUtils_1 = require("../runtimeUtils");
exports.frontendApiCallExtractor = {
    name: 'FrontendApiCallExtractor',
    detect(context) {
        return (context.includeFrontend &&
            context.files.some((file) => (file.language === 'typescript' || file.language === 'javascript') &&
                /fetch\(|axios\.(get|post|put|delete|patch)\(|apiClient\.(get|post|put|delete|patch)\(/.test(file.content)));
    },
    extract(context) {
        const nodes = [];
        const edges = [];
        const diagnostics = [];
        const knownRoutes = collectKnownRoutes(context.files);
        for (const file of context.files) {
            if (file.language !== 'typescript' && file.language !== 'javascript') {
                continue;
            }
            if (!context.includeFrontend && !looksFrontendPath(file.relativePath)) {
                continue;
            }
            const calls = collectFrontendCalls(file);
            if (calls.length === 0) {
                continue;
            }
            const frontendId = (0, runtimeUtils_1.normalizeRuntimeId)(`FrontendEntry.${file.relativePath}`);
            nodes.push({
                id: frontendId,
                type: 'FrontendEntry',
                label: `${(0, runtimeUtils_1.labelFromPath)(file.relativePath)} ${looksFrontendPath(file.relativePath) ? 'page' : 'entry'}`,
                sourcePath: file.relativePath,
                category: 'frontend',
                evidence: calls.map((call) => (0, runtimeUtils_1.lineEvidence)(file, 'call', call.text, call.index, 0.75))
            });
            for (const call of calls) {
                if (call.isExternal) {
                    continue;
                }
                const targetRoute = matchRoute(call.method, call.path, knownRoutes);
                const targetId = targetRoute?.id ?? (0, runtimeUtils_1.apiRouteId)('UNKNOWN', call.path);
                if (!targetRoute) {
                    nodes.push({
                        id: targetId,
                        type: 'ApiRoute',
                        label: `UNKNOWN ${(0, runtimeUtils_1.normalizeApiPath)(call.path)}`,
                        category: 'backend',
                        metadata: {
                            method: call.method,
                            path: (0, runtimeUtils_1.normalizeApiPath)(call.path),
                            unresolved: true
                        },
                        evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'inferred', call.text, call.index, 0.45)]
                    });
                    diagnostics.push({
                        level: 'warning',
                        code: 'RUNTIME_FRONTEND_API_ROUTE_UNMATCHED',
                        extractor: 'FrontendApiCallExtractor',
                        message: `Could not match frontend API call raw=${call.rawPath} normalized=${call.path} to a known ApiRoute`,
                        sourcePath: file.relativePath
                    });
                }
                edges.push({
                    from: frontendId,
                    to: targetId,
                    type: 'calls',
                    confidence: targetRoute ? 0.78 : 0.45,
                    metadata: {
                        method: call.method,
                        path: call.path,
                        rawPath: call.rawPath
                    },
                    evidence: [(0, runtimeUtils_1.lineEvidence)(file, 'call', call.text, call.index, targetRoute ? 0.78 : 0.45)]
                });
            }
        }
        return { nodes, edges, diagnostics };
    }
};
function collectFrontendCalls(file) {
    const calls = [];
    const fetchRegex = /fetch\(\s*([`"'][\s\S]*?[`"']|[^,\n)]+(?:\s*\+\s*[^,\n)]+)*)\s*(?:,\s*([\s\S]*?))?\)/g;
    for (const match of file.content.matchAll(fetchRegex)) {
        const options = match[2] ?? '';
        const methodMatch = options.match(/method\s*:\s*["'`](GET|POST|PUT|DELETE|PATCH)["'`]/i);
        const parsedPath = resolveApiPathExpression(match[1]);
        if (!parsedPath) {
            continue;
        }
        calls.push({
            method: (methodMatch?.[1] ?? 'GET').toUpperCase(),
            rawPath: parsedPath.rawPath,
            path: parsedPath.normalizedPath,
            isExternal: parsedPath.isExternal,
            text: match[0],
            index: match.index ?? 0
        });
    }
    const clientRegex = /\b(?:axios|apiClient)\.(get|post|put|delete|patch)\(\s*([`"'][\s\S]*?[`"']|[^,\n)]+(?:\s*\+\s*[^,\n)]+)*)/gi;
    for (const match of file.content.matchAll(clientRegex)) {
        const parsedPath = resolveApiPathExpression(match[2]);
        if (!parsedPath) {
            continue;
        }
        calls.push({
            method: match[1].toUpperCase(),
            rawPath: parsedPath.rawPath,
            path: parsedPath.normalizedPath,
            isExternal: parsedPath.isExternal,
            text: match[0],
            index: match.index ?? 0
        });
    }
    const objectClientRegex = /\b(?:axios|apiClient)\(\s*\{([\s\S]*?)\}\s*\)/gi;
    for (const match of file.content.matchAll(objectClientRegex)) {
        const body = match[1] ?? '';
        const methodMatch = body.match(/\bmethod\s*:\s*["'`](GET|POST|PUT|DELETE|PATCH)["'`]/i);
        const urlMatch = body.match(/\b(?:url|path)\s*:\s*([`"'][\s\S]*?[`"']|[^,\n}]+)/i);
        if (!urlMatch) {
            continue;
        }
        const parsedPath = resolveApiPathExpression(urlMatch[1]);
        if (!parsedPath) {
            continue;
        }
        calls.push({
            method: (methodMatch?.[1] ?? 'GET').toUpperCase(),
            rawPath: parsedPath.rawPath,
            path: parsedPath.normalizedPath,
            isExternal: parsedPath.isExternal,
            text: match[0],
            index: match.index ?? 0
        });
    }
    return calls.filter((call) => call.isExternal || call.path.startsWith('/'));
}
function resolveApiPathExpression(expression) {
    const trimmed = String(expression ?? '').trim();
    if (!trimmed) {
        return undefined;
    }
    const literal = readLiteralPath(trimmed);
    if (literal) {
        return {
            rawPath: literal,
            normalizedPath: normalizeFrontendApiCallPath(literal),
            isExternal: isExternalApiTarget(literal)
        };
    }
    if (!trimmed.includes('+')) {
        return undefined;
    }
    const tokens = trimmed.split('+').map((token) => token.trim()).filter(Boolean);
    const parts = [];
    let sawPathLiteral = false;
    for (const token of tokens) {
        const tokenLiteral = readLiteralPath(token);
        if (tokenLiteral) {
            parts.push(tokenLiteral);
            if (tokenLiteral.includes('/')) {
                sawPathLiteral = true;
            }
            continue;
        }
        if (/(?:baseUrl|apiBase|origin|host|endpoint|serverUrl|apiUrl)/i.test(token)) {
            continue;
        }
        parts.push('/:param');
    }
    if (!sawPathLiteral && parts.length === 0) {
        return undefined;
    }
    const rawPath = parts.join('');
    return {
        rawPath,
        normalizedPath: normalizeFrontendApiCallPath(rawPath),
        isExternal: isExternalApiTarget(rawPath)
    };
}
function readLiteralPath(value) {
    const quoted = value.match(/^["']([\s\S]*)["']$/);
    if (quoted) {
        return quoted[1];
    }
    const template = value.match(/^`([\s\S]*)`$/);
    if (!template) {
        return undefined;
    }
    return template[1];
}
function normalizeFrontendApiCallPath(value) {
    const normalizedRaw = String(value ?? '').replace(/\$\{[^}]+\}/g, ':param');
    let normalized = (0, runtimeUtils_1.normalizeApiPath)(normalizedRaw);
    const apiAnchorIndex = normalized.search(/\/api(?:\/v\d+)?(?:\/|$)/i);
    if (apiAnchorIndex > 0) {
        normalized = normalized.slice(apiAnchorIndex);
    }
    return (0, runtimeUtils_1.normalizeApiPath)(normalized);
}
function isExternalApiTarget(value) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed || !/^(?:https?:)?\/\//i.test(trimmed)) {
        return false;
    }
    const host = readAbsoluteUrlHost(trimmed);
    if (!host) {
        return true;
    }
    return !isLocalOriginHost(host);
}
function readAbsoluteUrlHost(value) {
    try {
        return new URL(value.startsWith('//') ? `https:${value}` : value).hostname.toLowerCase();
    }
    catch {
        return undefined;
    }
}
function isLocalOriginHost(host) {
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]';
}
function collectKnownRoutes(files) {
    const routes = new Map();
    for (const file of files) {
        collectPythonRoutes(file, routes);
        collectJavaScriptRoutes(file, routes);
    }
    return Array.from(routes.values());
}
function collectPythonRoutes(file, routes) {
    const routerPrefixes = new Map();
    for (const match of file.content.matchAll(/\b([A-Za-z_][\w]*)\s*=\s*APIRouter\(([^)]*)\)/g)) {
        const name = match[1];
        const args = match[2] ?? '';
        const prefixMatch = args.match(/prefix\s*=\s*["'`]([^"'`]+)["'`]/);
        if (prefixMatch?.[1]) {
            routerPrefixes.set(name, (0, runtimeUtils_1.normalizeApiPath)(prefixMatch[1]));
        }
    }
    const methodDecoratorRegex = /@([A-Za-z_][\w]*)\.(get|post|put|delete|patch|options|head)\(\s*["'`]([^"'`]+)["'`]/gi;
    for (const match of file.content.matchAll(methodDecoratorRegex)) {
        const method = match[2].toUpperCase();
        const routerName = match[1];
        const prefix = routerPrefixes.get(routerName) ?? '';
        registerRoute(routes, method, combineRoutePath(prefix, match[3]));
    }
    const genericRouteRegex = /@([A-Za-z_][\w]*)\.route\(\s*["'`]([^"'`]+)["'`]([^)]*)\)/gi;
    for (const match of file.content.matchAll(genericRouteRegex)) {
        const routerName = match[1];
        const prefix = routerPrefixes.get(routerName) ?? '';
        const methods = Array.from((match[3] ?? '').matchAll(/["'`](GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)["'`]/gi)).map((entry) => entry[1].toUpperCase());
        for (const method of methods.length > 0 ? methods : ['GET']) {
            registerRoute(routes, method, combineRoutePath(prefix, match[2]));
        }
    }
}
function collectJavaScriptRoutes(file, routes) {
    const jsRegex = /\b(?:app|router)\.(get|post|put|delete|patch|options|head)\(\s*["'`]([^"'`]+)["'`]|@(Get|Post|Put|Delete|Patch)\(\s*["'`]([^"'`]*)["'`]\s*\)/gi;
    for (const match of file.content.matchAll(jsRegex)) {
        const method = (match[1] ?? match[3] ?? 'GET').toUpperCase();
        const routePath = match[2] ?? match[4] ?? '/';
        registerRoute(routes, method, routePath);
    }
}
function registerRoute(routes, method, pathValue) {
    const normalizedPath = (0, runtimeUtils_1.normalizeApiPath)(pathValue);
    const id = (0, runtimeUtils_1.apiRouteId)(method, normalizedPath);
    routes.set(id, {
        id,
        method,
        path: normalizedPath,
        variants: (0, runtimeUtils_1.buildApiPathVariants)(normalizedPath)
    });
}
function combineRoutePath(prefix, routePath) {
    if (!prefix) {
        return (0, runtimeUtils_1.normalizeApiPath)(routePath);
    }
    return (0, runtimeUtils_1.normalizeApiPath)(`${prefix}/${routePath}`);
}
function matchRoute(method, callPath, knownRoutes) {
    const callVariants = buildFrontendCallPathVariants(callPath);
    const candidates = knownRoutes.filter((route) => route.method === method.toUpperCase());
    for (const candidate of candidates) {
        if (hasExactVariantMatch(callVariants, candidate.variants)) {
            return candidate;
        }
    }
    for (const candidate of candidates) {
        if (hasDynamicVariantMatch(callVariants, candidate.variants)) {
            return candidate;
        }
    }
    return undefined;
}
function buildFrontendCallPathVariants(pathValue) {
    const variants = new Set((0, runtimeUtils_1.buildApiPathVariants)(pathValue));
    for (const variant of Array.from(variants)) {
        const dynamicTrimmed = trimDynamicPrefix(variant);
        if (dynamicTrimmed) {
            (0, runtimeUtils_1.buildApiPathVariants)(dynamicTrimmed).forEach((item) => variants.add(item));
        }
        const apiAnchorIndex = variant.search(/\/api(?:\/v\d+)?(?:\/|$)/i);
        if (apiAnchorIndex > 0) {
            (0, runtimeUtils_1.buildApiPathVariants)(variant.slice(apiAnchorIndex)).forEach((item) => variants.add(item));
        }
    }
    return Array.from(variants);
}
function trimDynamicPrefix(pathValue) {
    const segments = (0, runtimeUtils_1.normalizeApiPath)(pathValue).split('/').filter(Boolean);
    if (segments.length < 3) {
        return undefined;
    }
    let index = 0;
    while (index < segments.length - 1 && isDynamicSegment(segments[index])) {
        index += 1;
    }
    if (index === 0 || index >= segments.length - 1) {
        return undefined;
    }
    return (0, runtimeUtils_1.normalizeApiPath)(`/${segments.slice(index).join('/')}`);
}
function hasExactVariantMatch(callVariants, routeVariants) {
    const routeSet = new Set(routeVariants);
    return callVariants.some((variant) => routeSet.has(variant));
}
function hasDynamicVariantMatch(callVariants, routeVariants) {
    for (const callVariant of callVariants) {
        for (const routeVariant of routeVariants) {
            if (matchComparablePath(callVariant, routeVariant)) {
                return true;
            }
        }
    }
    return false;
}
function matchComparablePath(leftPath, rightPath) {
    const leftParts = (0, runtimeUtils_1.normalizeApiComparablePath)(leftPath).split('/').filter(Boolean);
    const rightParts = (0, runtimeUtils_1.normalizeApiComparablePath)(rightPath).split('/').filter(Boolean);
    if (leftParts.length !== rightParts.length) {
        return false;
    }
    for (let index = 0; index < leftParts.length; index += 1) {
        const left = leftParts[index];
        const right = rightParts[index];
        if (left === right) {
            continue;
        }
        if (isDynamicSegment(left) || isDynamicSegment(right)) {
            continue;
        }
        return false;
    }
    return true;
}
function isDynamicSegment(segment) {
    return (segment === ':param' ||
        /^\{[^/}]+\}$/.test(segment) ||
        /^\[[^/\]]+\]$/.test(segment) ||
        /^:[A-Za-z_][\w-]*$/.test(segment));
}
function looksFrontendPath(relativePath) {
    return /(^|\/)(frontend|client|web|pages|components|app)(\/|$)/i.test(relativePath);
}
//# sourceMappingURL=frontendApiCallExtractor.js.map