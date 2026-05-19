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
export declare function createTreeSitterScanPlan(parserConfig: TriadConfig['parser']): TreeSitterScanPlan;
export {};
