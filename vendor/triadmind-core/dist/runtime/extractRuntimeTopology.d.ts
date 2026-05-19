import { RuntimeExtractOptions, RuntimeMap, RuntimeTopologyExtractor } from './types';
export declare function extractRuntimeTopology(projectRoot: string, options?: RuntimeExtractOptions): Promise<RuntimeMap>;
export declare function getBuiltInRuntimeExtractors(): RuntimeTopologyExtractor[];
