import { RuntimeMap, RuntimeView } from './types';
export declare function filterRuntimeMapByView(runtimeMap: RuntimeMap, view: RuntimeView): RuntimeMap;
export declare function normalizeRuntimeView(value: string | undefined, fallback?: RuntimeView): RuntimeView;
