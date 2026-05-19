import { ParsedDemand, ParsedNodeRef, ProtocolValidationContext, TriadCategory, TriadNodeDefinition, UpgradeProtocol } from './protocolRightBranch';
export * from './protocolRightBranch';
/**
 * @LeftBranch
 */
export declare function normalizeCategory(category?: string, fallback?: TriadCategory): TriadCategory;
/**
 * @LeftBranch
 */
export declare function parseNodeRef(nodeId: string, category?: string): ParsedNodeRef;
/**
 * @LeftBranch
 */
export declare function parseDemandEntry(entry: string, index: number): ParsedDemand | null;
/**
 * @LeftBranch
 */
export declare function parseReturnType(answer: string): string;
/**
 * @LeftBranch
 */
export declare function readTriadMap(mapPath: string): TriadNodeDefinition[] | {
    [x: string]: unknown;
    nodeId: string;
    fission: {
        [x: string]: unknown;
        problem: string;
        demand: string[];
        answer: string[];
        evidence?: {
            [x: string]: unknown;
            ghostReads?: {
                [x: string]: unknown;
                raw?: string | undefined;
                mode?: string | undefined;
                target?: string | undefined;
                valueType?: string | undefined;
                retainedInDemand?: boolean | undefined;
                score?: number | undefined;
            }[] | undefined;
            promotionReasons?: string[] | undefined;
            abstraction?: {
                [x: string]: unknown;
                role?: string | undefined;
                signals?: string[] | undefined;
                implements?: string[] | undefined;
                extendsAbstract?: string[] | undefined;
                dependsOnAbstractions?: string[] | undefined;
                peerConcreteCalls?: string[] | undefined;
                variantCluster?: string | undefined;
                abstractionSignalCount?: number | undefined;
                concreteSignalCount?: number | undefined;
                interfaceCount?: number | undefined;
                abstractClassCount?: number | undefined;
                typeAliasCount?: number | undefined;
                concreteClassCount?: number | undefined;
                publicMethodCount?: number | undefined;
                topLevelExecutableCount?: number | undefined;
            } | undefined;
        } | undefined;
    };
    category?: string | undefined;
    sourcePath?: string | undefined;
    lifecycle?: "existing" | "proposed" | undefined;
}[];
/**
 * @LeftBranch
 */
export declare function readJsonFile<T>(filePath: string): T;
/**
 * @LeftBranch
 */
export declare function assertProtocolShape(protocol: UpgradeProtocol, context?: ProtocolValidationContext): UpgradeProtocol;
