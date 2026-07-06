import { useStdout } from "ink";
import React from "react";

const MIN_USABLE_COLUMNS = 24;
const DEFAULT_COLUMNS = 80;

const TerminalColumnsContext = React.createContext<number | undefined>(undefined);

export function normalizeTerminalColumns(
  value: number | undefined,
  fallback = DEFAULT_COLUMNS,
): number {
  const n = Number(value);
  const fallbackColumns = Math.max(MIN_USABLE_COLUMNS, Math.floor(fallback));
  if (!Number.isFinite(n) || n < MIN_USABLE_COLUMNS) return fallbackColumns;
  return Math.floor(n);
}

export function useTerminalColumns(fallback = DEFAULT_COLUMNS): number {
  const { stdout } = useStdout();
  return normalizeTerminalColumns(stdout?.columns ?? process.stdout.columns, fallback);
}

export function useAvailableColumns(fallback = DEFAULT_COLUMNS): number {
  const scoped = React.useContext(TerminalColumnsContext);
  const terminalColumns = useTerminalColumns(fallback);
  return normalizeTerminalColumns(scoped, terminalColumns);
}

export function TerminalColumnsProvider({
  columns,
  children,
}: {
  columns: number | undefined;
  children: React.ReactNode;
}): React.ReactElement {
  const fallback = useTerminalColumns();
  const normalized = normalizeTerminalColumns(columns, fallback);
  return (
    <TerminalColumnsContext.Provider value={normalized}>{children}</TerminalColumnsContext.Provider>
  );
}

export function splitPlanPanelColumns(totalColumns: number): {
  mainColumns: number;
  panelColumns: number;
} {
  const total = normalizeTerminalColumns(totalColumns);
  const targetPanel = Math.round(total * (total >= 120 ? 0.44 : 0.4));
  const minPanel = total >= 90 ? 34 : 28;
  const maxPanel = Math.max(minPanel, total - 40);
  const panelColumns = Math.min(maxPanel, Math.max(minPanel, targetPanel));
  return {
    mainColumns: Math.max(1, total - panelColumns),
    panelColumns,
  };
}
