import { TriadScanMode } from './config';
import { WorkspacePaths } from './workspace';
export declare function syncTriadMap(paths: WorkspacePaths, force?: boolean): {
    changed: boolean;
    fileCount: number;
};
export declare function syncTriadMapWithOptions(paths: WorkspacePaths, options?: {
    force?: boolean;
    scanMode?: TriadScanMode;
}): {
    changed: boolean;
    fileCount: number;
};
export declare function watchTriadMap(paths: WorkspacePaths): void;
