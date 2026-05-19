import { TriadConfig } from '../config';
import { RuntimeDiagnostic, RuntimeSourceFile } from './types';
export declare function collectRuntimeSourceFiles(projectRoot: string, config: TriadConfig, diagnostics: RuntimeDiagnostic[]): RuntimeSourceFile[];
