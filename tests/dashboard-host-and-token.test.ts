/** `startDashboardServer({ host, token })` — LAN exposure + stable token (#968). */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDashboardUrl, inferSshDashboardBindHost } from "../src/server/dashboard-url.js";
import { type DashboardServerHandle, startDashboardServer } from "../src/server/index.js";

const TOKEN = "stable-pinned-token-1234567890";

function ctx(dir: string) {
  return {
    mode: "standalone" as const,
    configPath: join(dir, "config.json"),
    usageLogPath: join(dir, "usage.jsonl"),
  };
}

describe("startDashboardServer host + token (#968)", () => {
  let dir: string;
  let handle: DashboardServerHandle | undefined;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "reasonix-dashhost-"));
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
    writeSpy.mockRestore();
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it("defaults to 127.0.0.1 when no host is given and emits no LAN warning", async () => {
    handle = await startDashboardServer(ctx(dir), { token: TOKEN });
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/\?token=/);
    const warnings = writeSpy.mock.calls.map((c) => String(c[0])).filter((s) => s.includes("▲"));
    expect(warnings).toEqual([]);
  });

  it("reuses opts.token verbatim instead of minting a fresh one", async () => {
    handle = await startDashboardServer(ctx(dir), { token: TOKEN });
    expect(handle.token).toBe(TOKEN);
    expect(handle.url).toContain(`token=${TOKEN}`);
  });

  it("binds 0.0.0.0 when requested and prints a stderr warning", async () => {
    handle = await startDashboardServer(ctx(dir), { token: TOKEN, host: "0.0.0.0" });
    expect(handle.url).toMatch(/^http:\/\/[^/]+:\d+\/\?token=/);
    expect(handle.url).not.toContain("://0.0.0.0:");
    const warnings = writeSpy.mock.calls.map((c) => String(c[0])).filter((s) => s.includes("▲"));
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("non-loopback");
    expect(warnings[0]).toContain("token");
  });

  it("does not warn for ::1 or localhost (still loopback)", async () => {
    handle = await startDashboardServer(ctx(dir), { token: TOKEN, host: "localhost" });
    const warnings = writeSpy.mock.calls.map((c) => String(c[0])).filter((s) => s.includes("▲"));
    expect(warnings).toEqual([]);
  });

  it("uses the SSH server address as the public URL host for wildcard binds", () => {
    const url = buildDashboardUrl({
      bindHost: "0.0.0.0",
      port: 8420,
      token: TOKEN,
      env: {
        SSH_CONNECTION: "203.0.113.10 52000 198.51.100.7 22",
      } as NodeJS.ProcessEnv,
    });
    expect(url).toBe(`http://198.51.100.7:8420/?token=${TOKEN}`);
  });

  it("infers wildcard binding for non-loopback SSH server addresses", () => {
    expect(
      inferSshDashboardBindHost({
        SSH_CONNECTION: "203.0.113.10 52000 198.51.100.7 22",
      } as NodeJS.ProcessEnv),
    ).toBe("0.0.0.0");
    expect(
      inferSshDashboardBindHost({
        SSH_CONNECTION: "203.0.113.10 52000 127.0.0.1 22",
      } as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });

  it("uses publicUrl when provided and appends the dashboard token", async () => {
    handle = await startDashboardServer(ctx(dir), {
      token: TOKEN,
      publicUrl: "https://dash.example.test/reasonix?x=1",
    });
    expect(handle.url).toBe(`https://dash.example.test/reasonix?x=1&token=${TOKEN}`);
  });

  it("rejects non-http dashboard public URLs", async () => {
    await expect(
      startDashboardServer(ctx(dir), {
        token: TOKEN,
        publicUrl: "file:///tmp/dashboard.html",
      }),
    ).rejects.toThrow(/http/i);
  });
});
