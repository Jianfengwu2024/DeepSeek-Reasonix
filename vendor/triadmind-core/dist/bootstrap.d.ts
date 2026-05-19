import { UpgradeProtocol } from './protocol';
import { BootstrapPaths } from './workspace';
interface BootstrapModule {
    moduleName: string;
    sourcePath: string;
    role: string;
    staticRightBranch: string[];
    dynamicLeftBranch: string[];
}
interface SelfBootstrapArchitecture {
    vertex: {
        name: string;
        responsibility: string;
        invariant: string;
    };
    macroSplit: {
        anchorNodeId: string;
        leftBranch: string[];
        rightBranch: string[];
    };
    mesoSplit: BootstrapModule[];
    microSplit: BootstrapModule[];
}
/**
 * @LeftBranch
 */
export declare function buildSelfBootstrapArchitecture(paths: BootstrapPaths): SelfBootstrapArchitecture;
/**
 * @LeftBranch
 */
export declare function writeSelfBootstrapReport(paths: BootstrapPaths): string;
/**
 * @LeftBranch
 */
export declare function buildSelfBootstrapProtocol(paths: BootstrapPaths): UpgradeProtocol;
/**
 * @LeftBranch
 */
export declare function writeSelfBootstrapProtocol(paths: BootstrapPaths): UpgradeProtocol;
export {};
