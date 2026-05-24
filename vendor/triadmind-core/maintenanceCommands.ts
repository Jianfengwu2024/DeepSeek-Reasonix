import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { syncProjectTopology } from './cliSupport';
import { collectManualSnapshotFiles, resolveHealingInput } from './cliPresentationSupport';
import { prepareHealingArtifacts } from './healing';
import { createSnapshot, listSnapshots, restoreSnapshot } from './snapshot';
import { ensureTriadSpec, getWorkspacePaths } from './workflow';

class MaintenanceWorkflowService {
    getPaths() {
        return getWorkspacePaths(process.cwd());
    }

    prepareHealing(errorFile?: string, options: { message?: string; retries?: string } = {}) {
        const paths = this.getPaths();
        ensureTriadSpec(paths);

        if (!fs.existsSync(paths.mapFile)) {
            syncProjectTopology(paths);
        }

        const errorText = resolveHealingInput(paths, errorFile, options.message);
        if (!errorText) {
            return { paths, errorText, diagnosis: undefined };
        }

        const retryCount = Number.parseInt(options.retries ?? '0', 10);
        const { diagnosis } = prepareHealingArtifacts(paths, errorText, Number.isFinite(retryCount) ? retryCount : 0);
        return { paths, errorText, diagnosis };
    }

    listManualSnapshots() {
        const paths = this.getPaths();
        return {
            paths,
            snapshots: listSnapshots(paths)
        };
    }

    createManualSnapshot(label?: string) {
        const paths = this.getPaths();
        ensureTriadSpec(paths);
        const snapshot = createSnapshot(paths, label ?? 'manual', collectManualSnapshotFiles(paths));
        return { paths, snapshot };
    }

    rollbackSnapshot(snapshotId?: string) {
        const paths = this.getPaths();
        const snapshot = restoreSnapshot(paths, snapshotId);
        return { paths, snapshot };
    }
}

abstract class AbstractMaintenanceCommand {
    constructor(protected readonly workflow: MaintenanceWorkflowService) {}
}

class HealCommand extends AbstractMaintenanceCommand {
    register(program: Command) {
        program
            .command('heal [errorFile]')
            .description('Generate runtime healing diagnosis and prompt from an error trace')
            .option('-m, --message <text>', 'Inline runtime error text')
            .option('-r, --retries <count>', 'Current auto-retry count', '0')
            .action((errorFile: string | undefined, options: { message?: string; retries?: string }) => {
                try {
                    const { paths, errorText, diagnosis } = this.workflow.prepareHealing(errorFile, options);

                    if (!errorText || !diagnosis) {
                        console.log(chalk.red(`Please provide runtime error text, or write it into ${paths.runtimeErrorFile}`));
                        process.exitCode = 1;
                        return;
                    }

                    console.log(chalk.green(`Healing report written: ${paths.healingReportFile}`));
                    console.log(chalk.green(`Healing prompt written: ${paths.healingPromptFile}`));
                    console.log(chalk.green(`Runtime error snapshot written: ${paths.runtimeErrorFile}`));
                    console.log(chalk.yellow(`Matched node: ${diagnosis.matchedNodeId ?? 'unresolved'}`));
                    console.log(chalk.yellow(`Diagnosis: ${diagnosis.diagnosis}, action=${diagnosis.suggestedAction}`));
                    if (diagnosis.requiresHumanApproval) {
                        console.log(
                            chalk.yellow('Human approval is recommended before applying contract-impacting repairs.')
                        );
                    }
                } catch (error: any) {
                    console.log(chalk.red(`${error.message}`));
                    process.exitCode = 1;
                }
            });
    }
}

class SnapshotsCommand extends AbstractMaintenanceCommand {
    register(program: Command) {
        program
            .command('snapshots')
            .description('List TriadMind manual safety snapshots')
            .action(() => {
                const { snapshots } = this.workflow.listManualSnapshots();

                if (snapshots.length === 0) {
                    console.log(chalk.yellow('No TriadMind snapshots found.'));
                    return;
                }

                snapshots.forEach((snapshot) => {
                    console.log(`${snapshot.id} | ${snapshot.createdAt} | ${snapshot.label}`);
                });
            });
    }
}

class SnapshotCommand extends AbstractMaintenanceCommand {
    register(program: Command) {
        program
            .command('snapshot [label]')
            .description('Create a manual snapshot of key TriadMind workspace files')
            .action((label?: string) => {
                const { snapshot } = this.workflow.createManualSnapshot(label);
                console.log(chalk.green(`Snapshot created: ${snapshot.id}`));
            });
    }
}

class RollbackCommand extends AbstractMaintenanceCommand {
    register(program: Command) {
        program
            .command('rollback [snapshotId]')
            .description('Restore a TriadMind safety snapshot; defaults to the latest snapshot')
            .action((snapshotId?: string) => {
                try {
                    const { snapshot } = this.workflow.rollbackSnapshot(snapshotId);
                    console.log(chalk.green(`Snapshot restored: ${snapshot.id}`));
                } catch (error: any) {
                    console.log(chalk.red(`Rollback failed: ${error.message}`));
                    process.exitCode = 1;
                }
            });
    }
}

export function registerMaintenanceCommands(program: Command) {
    const workflow = new MaintenanceWorkflowService();

    new HealCommand(workflow).register(program);
    new SnapshotsCommand(workflow).register(program);
    new SnapshotCommand(workflow).register(program);
    new RollbackCommand(workflow).register(program);
}
