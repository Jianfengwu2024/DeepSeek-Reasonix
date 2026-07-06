import { readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import type { DashboardContext } from "./context.js";

const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

const CONTENT_TYPES = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".htm", "text/html; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

export interface ArtifactLoadResult {
  status: number;
  contentType: string;
  body: string;
}

function jsonResult(status: number, error: string): ArtifactLoadResult {
  return {
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ error }),
  };
}

function resolveArtifactPath(cwd: string, requested: string): string {
  if (/^[A-Za-z]:[\\/]/.test(requested) || requested.startsWith("/")) {
    return resolve(requested);
  }
  return resolve(cwd, requested);
}

export function loadWorkspaceArtifact(
  ctx: DashboardContext,
  requestedPath: string,
): ArtifactLoadResult {
  const requested = requestedPath.trim();
  if (!requested) return jsonResult(400, "path query parameter required");

  const cwd = ctx.getCurrentCwd?.();
  if (!cwd) return jsonResult(503, "no project directory available");

  const normalizedCwd = resolve(cwd);
  const resolved = resolveArtifactPath(normalizedCwd, requested);
  if (resolved !== normalizedCwd && !resolved.startsWith(normalizedCwd + sep)) {
    return jsonResult(403, "path escapes workspace");
  }

  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(resolved);
  } catch {
    return jsonResult(404, `artifact not found: ${requested}`);
  }
  if (!stats.isFile()) return jsonResult(400, "artifact path is not a file");
  if (stats.size > MAX_ARTIFACT_BYTES) {
    return jsonResult(413, `artifact too large (${stats.size} bytes, max ${MAX_ARTIFACT_BYTES})`);
  }

  const contentType = CONTENT_TYPES.get(extname(resolved).toLowerCase());
  if (!contentType) {
    return jsonResult(415, "artifact type is not supported for browser viewing");
  }

  return {
    status: 200,
    contentType,
    body: readFileSync(resolved, "utf-8"),
  };
}
