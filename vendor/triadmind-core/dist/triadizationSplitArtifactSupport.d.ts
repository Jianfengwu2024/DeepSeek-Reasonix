import type { TriadizationFocusSeed } from './triadizationFocusSupport';
import type { MacroSplitShape, MesoSplitShape, MicroSplitShape } from './triadizationSplitBlueprintSupport';
export type MacroSplitSeed = MacroSplitShape<TriadizationFocusSeed>;
export type MesoSplitSeed = MesoSplitShape<TriadizationFocusSeed>;
export type MicroSplitSeed = MicroSplitShape<TriadizationFocusSeed>;
export interface DraftProtocolTemplateSeed {
    protocolVersion: string;
    project: string;
    mapSource: string;
    userDemand: string;
    upgradePolicy: {
        allowedOps: Array<'reuse' | 'modify' | 'create_child'>;
        principle: string;
    };
    macroSplit: MacroSplitSeed;
    mesoSplit: MesoSplitSeed;
    microSplit: MicroSplitSeed;
    impactedNodes: unknown[];
    actions: unknown[];
}
export declare function createDraftProtocolTemplateSeed(projectRoot: string, mapFile: string, userDemand?: string): DraftProtocolTemplateSeed;
export declare function createDefaultUpgradePolicySeed(): {
    allowedOps: Array<"reuse" | "modify" | "create_child">;
    principle: string;
};
export declare function createMacroSplitSeedRecord(userDemand: string, focus?: Partial<TriadizationFocusSeed>): MacroSplitSeed;
export declare function createMesoSplitSeedRecord(focus?: Partial<TriadizationFocusSeed>): MesoSplitSeed;
export declare function createMicroSplitSeedRecord(focus?: Partial<TriadizationFocusSeed>): MicroSplitSeed;
export declare function buildSplitArtifactShapeJson(stage: 'macro' | 'meso' | 'micro'): string;
