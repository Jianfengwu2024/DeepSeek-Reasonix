import { networkInterfaces } from "node:os";

export const LOOPBACK_DASHBOARD_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

const WILDCARD_DASHBOARD_HOSTS = new Set(["0.0.0.0", "::"]);

function stripIpv6Brackets(host: string): string {
  const trimmed = host.trim();
  return trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
}

function isLoopbackHost(host: string): boolean {
  return LOOPBACK_DASHBOARD_HOSTS.has(stripIpv6Brackets(host).toLowerCase());
}

function isWildcardHost(host: string): boolean {
  return WILDCARD_DASHBOARD_HOSTS.has(stripIpv6Brackets(host));
}

function formatHostForUrl(host: string): string {
  const normalized = stripIpv6Brackets(host);
  return normalized.includes(":") ? `[${normalized}]` : normalized;
}

export function parseSshConnectionServerHost(
  env: { SSH_CONNECTION?: string } = process.env,
): string | undefined {
  const parts = env.SSH_CONNECTION?.trim().split(/\s+/) ?? [];
  const host = parts[2]?.trim();
  return host || undefined;
}

export function inferSshDashboardBindHost(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const serverHost = parseSshConnectionServerHost(env);
  if (!serverHost || isLoopbackHost(serverHost) || isWildcardHost(serverHost)) return undefined;
  return stripIpv6Brackets(serverHost).includes(":") ? "::" : "0.0.0.0";
}

function firstExternalAddress(): string | undefined {
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.internal) continue;
      if (entry.family === "IPv4") return entry.address;
    }
  }
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.internal) continue;
      if (entry.family === "IPv6") return entry.address;
    }
  }
  return undefined;
}

export function resolveDashboardUrlHost(
  bindHost: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const normalized = stripIpv6Brackets(bindHost);
  if (!isWildcardHost(normalized)) return formatHostForUrl(normalized);
  const sshServerHost = parseSshConnectionServerHost(env);
  if (sshServerHost && !isLoopbackHost(sshServerHost) && !isWildcardHost(sshServerHost)) {
    return formatHostForUrl(sshServerHost);
  }
  const external = firstExternalAddress();
  return formatHostForUrl(external ?? "localhost");
}

export function buildDashboardUrl({
  bindHost,
  port,
  token,
  publicUrl,
  env = process.env,
}: {
  bindHost: string;
  port: number;
  token: string;
  publicUrl?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  if (publicUrl?.trim()) {
    const url = new URL(publicUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("dashboard public URL must start with http:// or https://");
    }
    if (!url.pathname) url.pathname = "/";
    url.searchParams.set("token", token);
    return url.toString();
  }
  return `http://${resolveDashboardUrlHost(bindHost, env)}:${port}/?token=${token}`;
}
