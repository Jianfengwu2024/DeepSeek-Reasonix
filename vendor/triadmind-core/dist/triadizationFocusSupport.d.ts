import { TriadizationFocusReference, TriadizationRecommendedOperation } from './protocolRightBranch';
import { WorkspacePaths } from './workspace';
export type TriadizationFocusReferenceLike = {
    triadizationFocus?: unknown;
    recommendedOperation?: unknown;
};
export type NormalizedTriadizationFocusReference = {
    source: string;
    triadizationFocus: string;
    recommendedOperation: string;
};
export type TriadizationFocusSeed = {
    triadizationFocus: string;
    recommendedOperation: string;
};
export declare function normalizeTriadizationRecommendedOperation(value: unknown): TriadizationRecommendedOperation | undefined;
export declare function normalizeTriadizationFocusReference(reference: {
    triadizationFocus: unknown;
    recommendedOperation: unknown;
}): {
    triadizationFocus: string;
    recommendedOperation: string;
};
export declare function createTriadizationFocusSeed(focus?: Partial<{
    triadizationFocus: unknown;
    recommendedOperation: unknown;
}>): TriadizationFocusSeed;
export declare function collectTriadizationFocusReference(source: string, reference: TriadizationFocusReferenceLike | undefined, focusReferences: NormalizedTriadizationFocusReference[], violations: string[]): void;
export declare function resolvePrimaryTriadizationFocusReference(focusReferences: NormalizedTriadizationFocusReference[]): NormalizedTriadizationFocusReference | undefined;
export declare function resolveExpectedTriadizationFocus(paths: WorkspacePaths): TriadizationFocusReference | undefined;
