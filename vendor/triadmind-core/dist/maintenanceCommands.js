"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMaintenanceCommands = registerMaintenanceCommands;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const cliSupport_1 = require("./cliSupport");
const cliPresentationSupport_1 = require("./cliPresentationSupport");
const healing_1 = require("./healing");
const snapshot_1 = require("./snapshot");
const workflow_1 = require("./workflow");
class MaintenanceWorkflowService {
    getPaths() {
        return (0, workflow_1.getWorkspacePaths)(process.cwd());
    }
    prepareHealing(errorFile, options = {}) {
        const paths = this.getPaths();
        (0, workflow_1.ensureTriadSpec)(paths);
        if (!fs.existsSync(paths.mapFile)) {
            (0, cliSupport_1.syncProjectTopology)(paths);
        }
        const errorText = (0, cliPresentationSupport_1.resolveHealingInput)(paths, errorFile, options.message);
        if (!errorText) {
            return { paths, errorText, diagnosis: undefined };
        }
        const retryCount = Number.parseInt(options.retries ?? '0', 10);
        const { diagnosis } = (0, healing_1.prepareHealingArtifacts)(paths, errorText, Number.isFinite(retryCount) ? retryCount : 0);
        return { paths, errorText, diagnosis };
    }
    listManualSnapshots() {
        const paths = this.getPaths();
        return {
            paths,
            snapshots: (0, snapshot_1.listSnapshots)(paths)
        };
    }
    createManualSnapshot(label) {
        const paths = this.getPaths();
        (0, workflow_1.ensureTriadSpec)(paths);
        const snapshot = (0, snapshot_1.createSnapshot)(paths, label ?? 'manual', (0, cliPresentationSupport_1.collectManualSnapshotFiles)(paths));
        return { paths, snapshot };
    }
    rollbackSnapshot(snapshotId) {
        const paths = this.getPaths();
        const snapshot = (0, snapshot_1.restoreSnapshot)(paths, snapshotId);
        return { paths, snapshot };
    }
}
class AbstractMaintenanceCommand {
    workflow;
    constructor(workflow) {
        this.workflow = workflow;
    }
}
class HealCommand extends AbstractMaintenanceCommand {
    register(program) {
        program
            .command('heal [errorFile]')
            .description('Generate runtime healing diagnosis and prompt from an error trace')
            .option('-m, --message <text>', 'Inline runtime error text')
            .option('-r, --retries <count>', 'Current auto-retry count', '0')
            .action((errorFile, options) => {
            try {
                const { paths, errorText, diagnosis } = this.workflow.prepareHealing(errorFile, options);
                if (!errorText || !diagnosis) {
                    console.log(chalk_1.default.red(`Please provide runtime error text, or write it into ${paths.runtimeErrorFile}`));
                    process.exitCode = 1;
                    return;
                }
                console.log(chalk_1.default.green(`Healing report written: ${paths.healingReportFile}`));
                console.log(chalk_1.default.green(`Healing prompt written: ${paths.healingPromptFile}`));
                console.log(chalk_1.default.green(`Runtime error snapshot written: ${paths.runtimeErrorFile}`));
                console.log(chalk_1.default.yellow(`Matched node: ${diagnosis.matchedNodeId ?? 'unresolved'}`));
                console.log(chalk_1.default.yellow(`Diagnosis: ${diagnosis.diagnosis}, action=${diagnosis.suggestedAction}`));
                if (diagnosis.requiresHumanApproval) {
                    console.log(chalk_1.default.yellow('Human approval is recommended before applying contract-impacting repairs.'));
                }
            }
            catch (error) {
                console.log(chalk_1.default.red(`${error.message}`));
                process.exitCode = 1;
            }
        });
    }
}
class SnapshotsCommand extends AbstractMaintenanceCommand {
    register(program) {
        program
            .command('snapshots')
            .description('List TriadMind manual safety snapshots')
            .action(() => {
            const { snapshots } = this.workflow.listManualSnapshots();
            if (snapshots.length === 0) {
                console.log(chalk_1.default.yellow('No TriadMind snapshots found.'));
                return;
            }
            snapshots.forEach((snapshot) => {
                console.log(`${snapshot.id} | ${snapshot.createdAt} | ${snapshot.label}`);
            });
        });
    }
}
class SnapshotCommand extends AbstractMaintenanceCommand {
    register(program) {
        program
            .command('snapshot [label]')
            .description('Create a manual snapshot of key TriadMind workspace files')
            .action((label) => {
            const { snapshot } = this.workflow.createManualSnapshot(label);
            console.log(chalk_1.default.green(`Snapshot created: ${snapshot.id}`));
        });
    }
}
class RollbackCommand extends AbstractMaintenanceCommand {
    register(program) {
        program
            .command('rollback [snapshotId]')
            .description('Restore a TriadMind safety snapshot; defaults to the latest snapshot')
            .action((snapshotId) => {
            try {
                const { snapshot } = this.workflow.rollbackSnapshot(snapshotId);
                console.log(chalk_1.default.green(`Snapshot restored: ${snapshot.id}`));
            }
            catch (error) {
                console.log(chalk_1.default.red(`Rollback failed: ${error.message}`));
                process.exitCode = 1;
            }
        });
    }
}
function registerMaintenanceCommands(program) {
    const workflow = new MaintenanceWorkflowService();
    new HealCommand(workflow).register(program);
    new SnapshotsCommand(workflow).register(program);
    new SnapshotCommand(workflow).register(program);
    new RollbackCommand(workflow).register(program);
}
//# sourceMappingURL=maintenanceCommands.js.map