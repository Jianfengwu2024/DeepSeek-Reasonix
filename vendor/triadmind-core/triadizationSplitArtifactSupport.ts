import { createTriadizationFocusSeed } from './triadizationFocusSupport';
import type { TriadizationFocusSeed } from './triadizationFocusSupport';
import {
    createMacroSplitBlueprintSeed,
    createMesoSplitBlueprintSeed,
    createMicroSplitBlueprintSeed
} from './triadizationSplitBlueprintSupport';
import type {
    MacroSplitShape,
    MesoSplitShape,
    MicroSplitShape
} from './triadizationSplitBlueprintSupport';
import { normalizePath } from './workspace';

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

export function createDraftProtocolTemplateSeed(projectRoot: string, mapFile: string, userDemand = ''): DraftProtocolTemplateSeed {
    return {
        protocolVersion: '1.0',
        project: normalizePath(projectRoot),
        mapSource: normalizePath(mapFile),
        userDemand,
        upgradePolicy: createDefaultUpgradePolicySeed(),
        macroSplit: createMacroSplitSeedRecord(''),
        mesoSplit: createMesoSplitSeedRecord(),
        microSplit: createMicroSplitSeedRecord(),
        impactedNodes: [],
        actions: []
    };
}

export function createDefaultUpgradePolicySeed() {
    return {
        allowedOps: ['reuse', 'modify', 'create_child'] as Array<'reuse' | 'modify' | 'create_child'>,
        principle: 'reuse_first_minimal_change'
    };
}

export function createMacroSplitSeedRecord(userDemand: string, focus?: Partial<TriadizationFocusSeed>): MacroSplitSeed {
    return {
        ...createTriadizationFocusSeed(focus),
        ...createMacroSplitBlueprintSeed(userDemand)
    };
}

export function createMesoSplitSeedRecord(focus?: Partial<TriadizationFocusSeed>): MesoSplitSeed {
    return {
        ...createTriadizationFocusSeed(focus),
        ...createMesoSplitBlueprintSeed()
    };
}

export function createMicroSplitSeedRecord(focus?: Partial<TriadizationFocusSeed>): MicroSplitSeed {
    return {
        ...createTriadizationFocusSeed(focus),
        ...createMicroSplitBlueprintSeed()
    };
}

export function buildSplitArtifactShapeJson(stage: 'macro' | 'meso' | 'micro') {
    switch (stage) {
        case 'macro':
            return JSON.stringify(createMacroSplitSeedRecord(''));
        case 'meso':
            return JSON.stringify(createMesoSplitSeedRecord());
        case 'micro':
            return JSON.stringify(createMicroSplitSeedRecord());
    }
}
