import {
  type TriadMindMode,
  defaultConfigPath,
  readConfig,
  saveTriadMindConfig,
} from "../../../../config.js";
import type { SlashHandler } from "../dispatch.js";

const TRIADMIND_USAGE =
  "/triadmind <status|config|sync|verify|visualize|rules|memory|toolkit|dream|govern|navigate> [...]";

const triadmind: SlashHandler = (args, _loop, ctx) => {
  const sub = (args[0] ?? "status").toLowerCase();
  if (sub === "config") return triadmindConfig(args.slice(1), ctx.configPath);
  if (sub === "help") return { info: triadmindHelp() };

  if (!ctx.runTriadMindInternal) {
    return {
      info: "/triadmind is only available inside `reasonix code` when internal TriadMind is enabled. Use `/triadmind config mode tools_only` to enable it for the next launch.",
    };
  }

  if (sub === "" || sub === "status") {
    return { info: ctx.triadmindStatus?.() ?? "TriadMind status is unavailable." };
  }

  const commandArgs = toTriadMindArgs(sub, args.slice(1));
  if (!commandArgs) return { info: triadmindHelp() };

  void ctx
    .runTriadMindInternal(commandArgs)
    .then((message) => ctx.postInfo?.(message))
    .catch((error) => ctx.postInfo?.(`TriadMind ${sub} failed: ${(error as Error).message}`));

  return { info: `> internal triadmind ${commandArgs.join(" ")} started` };
};

function triadmindConfig(args: string[], configPath = defaultConfigPath()): { info: string } {
  const key = (args[0] ?? "").toLowerCase();
  if (!key || key === "show" || key === "status") {
    return { info: renderTriadMindConfig(configPath) };
  }

  try {
    if (key === "mode") {
      const mode = args[1] as TriadMindMode | undefined;
      if (!mode) return { info: "Usage: /triadmind config mode <disabled|tools_only|advisory>" };
      const saved = saveTriadMindConfig({ mode }, configPath);
      return { info: savedMessage(`triadmind.mode = ${saved.mode ?? "disabled"}`, configPath) };
    }
    if (key === "corepath" || key === "core-path") {
      const corePath = args.slice(1).join(" ").trim();
      if (!corePath)
        return { info: "Usage: /triadmind config corePath <triadmind-core root-or-dist>" };
      const saved = saveTriadMindConfig({ corePath }, configPath);
      return {
        info: savedMessage(`triadmind.corePath = ${saved.corePath ?? "(auto)"}`, configPath),
      };
    }
    if (key === "command" || key === "args") {
      return {
        info: "TriadMind is internal to Reasonix now; no external command/args are used. Optional corePath only overrides the bundled engine for development.",
      };
    }
    if (key === "timeout" || key === "timeoutms" || key === "timeout-ms") {
      const raw = args[1];
      if (!raw || !/^\d+$/.test(raw)) {
        return { info: "Usage: /triadmind config timeoutMs <positive milliseconds>" };
      }
      const saved = saveTriadMindConfig({ timeoutMs: Number.parseInt(raw, 10) }, configPath);
      return { info: savedMessage(`triadmind.timeoutMs = ${saved.timeoutMs}`, configPath) };
    }
    if (key === "advisoryforcesync" || key === "advisory-force-sync" || key === "force-sync") {
      const value = parseBoolean(args[1]);
      if (value === null)
        return { info: "Usage: /triadmind config advisoryForceSync <true|false>" };
      const saved = saveTriadMindConfig({ advisoryForceSync: value }, configPath);
      return {
        info: savedMessage(
          `triadmind.advisoryForceSync = ${saved.advisoryForceSync === true}`,
          configPath,
        ),
      };
    }
  } catch (error) {
    return { info: `TriadMind config error: ${(error as Error).message}` };
  }

  return { info: triadmindConfigHelp() };
}

function renderTriadMindConfig(configPath: string): string {
  const cfg = readConfig(configPath).triadmind ?? {};
  return [
    `TriadMind config (${configPath})`,
    `  mode: ${cfg.mode ?? "disabled"}`,
    "  engine: internal",
    `  corePath: ${cfg.corePath ?? "(bundled internal TriadMind core)"}`,
    `  command: ${cfg.command ?? "(migrated/ignored; no external CLI is used)"}`,
    `  args: ${JSON.stringify(cfg.args ?? [])} (migrated/ignored)`,
    `  timeoutMs: ${cfg.timeoutMs ?? 120000}`,
    `  advisoryForceSync: ${cfg.advisoryForceSync === true}`,
    "",
    triadmindConfigHelp(),
  ].join("\n");
}

function savedMessage(head: string, configPath: string): string {
  return `${head} (saved to ${configPath}; restart \`reasonix code\` for tool/governance changes)`;
}

function parseBoolean(value: string | undefined): boolean | null {
  switch (value?.trim().toLowerCase()) {
    case "true":
    case "on":
    case "yes":
    case "1":
      return true;
    case "false":
    case "off":
    case "no":
    case "0":
      return false;
    default:
      return null;
  }
}

function toTriadMindArgs(sub: string, rest: string[]): string[] | null {
  switch (sub) {
    case "sync":
    case "verify":
    case "dream":
    case "govern":
    case "navigate":
      return [sub, ...rest];
    case "visualize":
    case "viz":
      return ["plan", "--no-open", ...rest];
    case "rules":
      return ["rules", ...rest];
    case "memory":
      return ["memory", ...rest];
    case "toolkit":
      return ["memory", "toolkit", ...rest];
    default:
      return null;
  }
}

function triadmindHelp(): string {
  return [
    TRIADMIND_USAGE,
    "",
    "Examples:",
    "  /triadmind status",
    "  /triadmind config mode tools_only",
    "  /triadmind sync --force",
    "  /triadmind verify --json --strict",
    "  /triadmind visualize --view architecture",
    "  /triadmind memory search auth --json",
    "  /triadmind toolkit sync",
  ].join("\n");
}

function triadmindConfigHelp(): string {
  return [
    "Config commands:",
    "  /triadmind config",
    "  /triadmind config mode <disabled|tools_only|advisory>",
    "  /triadmind config corePath <triadmind-core root-or-dist>  # advanced dev override",
    "  /triadmind config timeoutMs <positive milliseconds>",
    "  /triadmind config advisoryForceSync <true|false>",
  ].join("\n");
}

export const handlers: Record<string, SlashHandler> = {
  triadmind,
};
