#!/usr/bin/env node
/**
 * TriadMind MCP Server
 *
 * Model Context Protocol (MCP) server that exposes TriadMind architecture
 * analysis tools to MCP-compatible clients (e.g. DeepSeek-TUI).
 *
 * Protocol: JSON-RPC 2.0 over stdio
 *
 * Exposed tools:
 *   - triadmind_sync        Scan source code, update triad-map.json
 *   - triadmind_navigate    Generate architecture impact map for a feature
 *   - triadmind_dream       Run dream engine (topology health analysis)
 *   - triadmind_govern      Run governance policy checks
 *   - triadmind_verify      Verify topology quality metrics
 *   - triadmind_analyze     Analyze topology for abstraction deficits
 *   - triadmind_visualize   Generate HTML topology visualization
 */
export {};
