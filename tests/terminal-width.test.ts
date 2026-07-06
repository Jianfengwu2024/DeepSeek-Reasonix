import { describe, expect, it } from "vitest";
import { normalizeTerminalColumns, splitPlanPanelColumns } from "../src/cli/ui/terminal-width.js";

describe("terminal width helpers", () => {
  it("falls back when IDE terminals temporarily report unusable columns", () => {
    expect(normalizeTerminalColumns(undefined, 100)).toBe(100);
    expect(normalizeTerminalColumns(0, 100)).toBe(100);
    expect(normalizeTerminalColumns(12, 100)).toBe(100);
  });

  it("keeps the chat column readable when the plan panel is open", () => {
    const narrow = splitPlanPanelColumns(80);
    expect(narrow.mainColumns).toBeGreaterThanOrEqual(48);
    expect(narrow.mainColumns + narrow.panelColumns).toBe(80);

    const wide = splitPlanPanelColumns(120);
    expect(wide.mainColumns).toBeGreaterThanOrEqual(60);
    expect(wide.mainColumns + wide.panelColumns).toBe(120);
  });
});
