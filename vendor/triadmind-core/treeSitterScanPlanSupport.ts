import { TriadConfig, TriadScanMode } from './config';

type TreeSitterArchitectureScanMode = Exclude<TriadScanMode, 'leaf'>;

export interface TreeSitterScanPlan {
    projectedScanMode: TriadScanMode;
    architectureScanMode: TreeSitterArchitectureScanMode;
    leafParserConfig: TriadConfig['parser'];
    architectureParserConfig: TriadConfig['parser'];
    useLeafProjection: boolean;
    scanUnit: string;
}

export function createTreeSitterScanPlan(parserConfig: TriadConfig['parser']): TreeSitterScanPlan {
    const projectedScanMode = parserConfig.scanMode;
    const architectureScanMode: TreeSitterArchitectureScanMode =
        projectedScanMode === 'leaf' ? 'capability' : projectedScanMode;

    return {
        projectedScanMode,
        architectureScanMode,
        leafParserConfig: {
            ...parserConfig,
            scanMode: 'leaf'
        },
        architectureParserConfig: {
            ...parserConfig,
            scanMode: architectureScanMode
        },
        useLeafProjection: projectedScanMode === 'leaf',
        scanUnit:
            projectedScanMode === 'leaf'
                ? 'leaf nodes'
                : projectedScanMode === 'module'
                  ? 'module capability nodes'
                  : projectedScanMode === 'domain'
                    ? 'domain capability nodes'
                    : 'capability nodes'
    };
}
