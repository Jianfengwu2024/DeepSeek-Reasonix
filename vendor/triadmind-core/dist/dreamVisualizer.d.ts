import { DreamReport } from './dream';
export interface DreamDashboardOptions {
    theme?: 'leaf-like' | 'runtime-dark';
    title?: string;
}
export declare function generateDreamDashboard(report: DreamReport, outputFilePath: string, options?: DreamDashboardOptions): void;
export declare function generateDreamDashboardFromFile(reportFilePath: string, outputFilePath: string, options?: DreamDashboardOptions): void;
