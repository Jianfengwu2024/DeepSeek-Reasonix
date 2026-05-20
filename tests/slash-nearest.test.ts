import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { handleSlash } from "../src/cli/ui/slash/dispatch.js";
import { nearestCommands } from "../src/cli/ui/slash/nearest.js";
import { DeepSeekClient } from "../src/client.js";
import { CacheFirstLoop } from "../src/loop.js";
import { ImmutablePrefix } from "../src/memory/runtime.js";

function makeLoop() {
  const client = new DeepSeekClient({
    apiKey: "sk-test",
    fetch: (() => {
      throw new Error("fetch should not run in slash-nearest tests");
    }) as unknown as typeof fetch,
  });
  return new CacheFirstLoop({
    client,
    prefix: new ImmutablePrefix({ system: "s" }),
  });
}

describe("nearestCommands", () => {
  const commands = ["update", "sessions", "doctor", "models", "model"] as const;

  it("sorts typo matches by distance", () => {
    expect(nearestCommands("upadte", commands)).toEqual(["update"]);
  });

  it("handles missing, extra, and transposed letters", () => {
    expect(nearestCommands("sesions", commands)).toContain("sessions");
    expect(nearestCommands("docttor", commands)).toContain("doctor");
    expect(nearestCommands("modle", commands)).toEqual(["model", "models"]);
  });

  it("returns no matches when nothing is close enough", () => {
    expect(nearestCommands("xyz123", commands)).toEqual([]);
    expect(nearestCommands("x", commands)).toEqual([]);
  });
});

describe("handleSlash unknown suggestions", () => {
  it("adds a did-you-mean hint for close matches", () => {
    const r = handleSlash("upadte", [], makeLoop());
    expect(r.unknown).toBe(true);
    expect(r.info).toBe("unknown command: /upadte — did you mean /update?");
  });

  it("keeps the /help fallback when no command is close", () => {
    const r = handleSlash("xyz123", [], makeLoop());
    expect(r.unknown).toBe(true);
    expect(r.info).toBe("unknown command: /xyz123  (try /help)");
  });
});

describe("handleSlash /triadmind", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("routes /triadmind status to the injected status provider", () => {
    const r = handleSlash("triadmind", ["status"], makeLoop(), {
      triadmindStatus: () => "triadmind ok",
      runTriadMindInternal: async () => "unused",
    });

    expect(r.info).toBe("triadmind ok");
  });

  it("writes /triadmind config mode to the supplied config path", () => {
    const dir = mkdtempSync(join(tmpdir(), "reasonix-triadmind-slash-"));
    tempDirs.push(dir);
    const configPath = join(dir, "config.json");

    const r = handleSlash("triadmind", ["config", "mode", "advisory"], makeLoop(), {
      configPath,
    });

    expect(r.info).toContain("triadmind.mode = advisory");
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual({
      triadmind: { mode: "advisory" },
    });
  });

  it("shows config guidance even when TriadMind runtime tools are disabled", () => {
    const r = handleSlash("triadmind", [], makeLoop(), {});
    expect(r.info).toContain("/triadmind config mode tools_only");
  });

  it("maps toolkit commands to triadmind memory toolkit", () => {
    const calls: string[][] = [];
    const r = handleSlash("triadmind", ["toolkit", "sync"], makeLoop(), {
      runTriadMindInternal: async (args) => {
        calls.push(args);
        return "synced";
      },
      postInfo: () => {},
    });

    expect(r.info).toBe("> internal triadmind memory toolkit sync started");
    expect(calls).toEqual([["memory", "toolkit", "sync"]]);
  });
});
