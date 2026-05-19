import { RuntimeNode } from './types';
export interface NormalizedRuntimeLabel {
    label: string;
    hint?: string;
    lowSignal: boolean;
    source: 'metadata' | 'node_label' | 'node_id';
}
export declare function normalizeRuntimeNodeLabel(node: RuntimeNode): NormalizedRuntimeLabel;
export declare function isLowSignalRuntimeLabel(label: string): boolean;
