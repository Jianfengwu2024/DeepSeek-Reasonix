import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { DashboardCliOptions, openFile, resolveDemand, syncProjectTopology, toDashboardOptions } from './cliSupport';
import { runNavigator } from './navigator';
import { ensureTriadSpec, getWorkspacePaths } from './workflow';

type NavigatorCliOptions = DashboardCliOptions & {
    demand?: string;
    protocol?: string;
    llm?: string;
    open?: boolean;
    json?: boolean;
};

export function registerNavigatorCommands(program: Command) {
    registerNavigatorCommand(program, 'navigate', 'Generate a pre-implementation impact map for the requested feature');
    registerNavigatorCommand(program, 'impact', 'Alias of `navigate`');
}

function registerNavigatorCommand(program: Command, name: string, description: string) {
    program
        .command(`${name} [demand...]`)
        .description(description)
        .option('-d, --demand <text>', 'Explicit feature description text')
        .option('--llm <provider:model>', 'Generate impact protocol via a live LLM provider before rendering')
        .option('--protocol <path>', 'Use an existing impact protocol JSON instead of the default .triadmind/impact-protocol.json')
        .option('--no-open', 'Generate the impact map without opening the browser')
        .option('--view <architecture|leaf>', 'Set the initial visualizer view')
        .option('--show-isolated', 'Show isolated capability nodes in architecture view')
        .option('--full-contract-edges', 'Disable contract-edge capping in the visualizer')
        .option('--json', 'Emit machine-readable navigator result JSON')
        .action(async (demandParts: string[], options: NavigatorCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const demand = resolveDemand(demandParts, options.demand, paths);
            if (!demand) {
                console.log(chalk.red('Please provide a feature description, for example: triadmind navigate "add payment module"'));
                process.exitCode = 1;
                return;
            }

            if (!fs.existsSync(paths.mapFile)) {
                console.log(chalk.yellow('[TriadMind] triad-map.json is missing; running a topology sync first.'));
                syncProjectTopology(paths);
            }

            try {
                const result = await runNavigator(paths, demand, {
                    protocolPath: options.protocol,
                    llm: options.llm,
                    dashboardOptions: toDashboardOptions(options)
                });

                if (result.status === 'ready' && options.open !== false) {
                    try {
                        await openFile(result.impactVisualizerFile);
                    } catch (error: any) {
                        console.log(chalk.yellow(`[TriadMind] failed to open browser automatically: ${error.message}`));
                    }
                }

                if (options.json) {
                    console.log(JSON.stringify(result, null, 2));
                    return;
                }

                if (result.status === 'pending_protocol') {
                    console.log(chalk.cyan('[TriadMind] navigator prompt prepared.'));
                    result.summary.forEach((line) => console.log(chalk.green(`[TriadMind] ${line}`)));
                    console.log(chalk.yellow(`[TriadMind] send ${result.impactPromptFile} to the current AI assistant and save the JSON to ${result.impactProtocolFile}.`));
                    console.log(chalk.yellow('[TriadMind] rerun `triadmind navigate` after the protocol is ready to render the red dashed impact map.'));
                    return;
                }

                result.summary.forEach((line) => console.log(chalk.green(`[TriadMind] ${line}`)));
                console.log(chalk.green('[TriadMind] Impact map generated. Review the red dashed proposed nodes and edges in the browser.'));
                console.log(chalk.yellow('[TriadMind] If the impact looks correct, continue with `triadmind apply` or hand the approved protocol to the coding assistant.'));
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] navigate failed: ${error.message}`));
                process.exitCode = 1;
            }
        });
}
