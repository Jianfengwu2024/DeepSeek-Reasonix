import { UpgradeProtocol } from './protocol';
import { WorkspacePaths } from './workspace';
export interface SnapshotFileEntry {
    path: string;
    exists: boolean;
    content: string;
}
export interface TriadSnapshot {
    id: string;
    label: string;
    createdAt: string;
    files: SnapshotFileEntry[];
}
export declare function createSnapshot(paths: WorkspacePaths, label: string, filePaths: string[]): TriadSnapshot;
export declare function listSnapshots(paths: WorkspacePaths): Pick<TriadSnapshot, "id" | "label" | "createdAt">[];
export declare function restoreSnapshot(paths: WorkspacePaths, snapshotId?: string): TriadSnapshot;
export declare function collectProtocolSnapshotFiles(paths: WorkspacePaths, protocol: UpgradeProtocol): string[];
