/**
 * The candidate's two working surfaces — the technical scratchpad (code, mode
 * and terminal logs) and the system design canvas — live in localStorage, and
 * the interview page reads them on every turn to assemble the model's context.
 *
 * Both sides used to spell the key names out by hand: 14 literals across 4
 * files, with no test touching a single one. A write that missed one key, or a
 * rename that missed one read, splits the state silently — the board keeps
 * showing its own buffer while the model is handed an empty context, and
 * nothing fails loudly anywhere. This module owns the key names and the
 * restricted-storage failure path so producer and consumer cannot drift, and so
 * the read the interview page depends on has one place to be tested against.
 */
import type { LogEntry } from "@/hooks/useCodeExecutor";

export const BOARD_KEYS = {
  scratchpadContent: "interve_scratchpad_content",
  scratchpadMode: "interve_scratchpad_mode",
  scratchpadLogs: "interve_scratchpad_logs",
  designCanvas: "interve_system_design_content",
} as const;

export type ScratchpadMode = "code" | "notes";

/** Safari private mode and blocked-cookie iframes throw on any access. */
function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the board still works in memory */
  }
}

function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* see writeItem */
  }
}

/** Persisted buffer, or "" when empty or storage is unavailable. */
export function readScratchpadContent(): string {
  return readItem(BOARD_KEYS.scratchpadContent) ?? "";
}

export function writeScratchpadContent(content: string): void {
  writeItem(BOARD_KEYS.scratchpadContent, content);
}

/** Appends to the existing buffer, blank-line separated (the "ask AI → send to
 * board" path must not overwrite whatever the candidate is mid-typing). */
export function appendScratchpadContent(text: string): void {
  const existing = readScratchpadContent();
  writeScratchpadContent(existing ? `${existing}\n\n${text}` : text);
}

export function readScratchpadMode(): ScratchpadMode | null {
  const mode = readItem(BOARD_KEYS.scratchpadMode);
  return mode === "code" || mode === "notes" ? mode : null;
}

export function writeScratchpadMode(mode: ScratchpadMode): void {
  writeItem(BOARD_KEYS.scratchpadMode, mode);
}

/**
 * Execution logs, already rendered as `[type] message` lines. Empty or absent
 * yields "".
 *
 * Two behaviours carried over deliberately, because the inline version had them
 * by accident and callers relied on it: a payload that fails to parse costs the
 * logs block only, never the code buffer, and entries are dropped rather than
 * rendered — the old single map turned a malformed entry into a literal
 * "[undefined] undefined" line inside the prompt sent to the model.
 */
export function readScratchpadLogLines(): string[] {
  const raw = readItem(BOARD_KEYS.scratchpadLogs);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is LogEntry =>
        !!entry && typeof (entry as LogEntry).message === "string")
      .map((entry) => `[${entry.type}] ${entry.message}`);
  } catch {
    return [];
  }
}

/** An empty log list removes the key, matching the writer's old behaviour. */
export function writeScratchpadLogs(logs: LogEntry[]): void {
  if (logs.length > 0) {
    writeItem(BOARD_KEYS.scratchpadLogs, JSON.stringify(logs));
  } else {
    removeItem(BOARD_KEYS.scratchpadLogs);
  }
}

/**
 * What the model is told about the code board: the buffer plus its terminal
 * output, and only while the board is in code mode — notes are prose the
 * candidate is drafting, not an attempt at the problem.
 */
export function readScratchpadCodeContext(): string {
  const content = readScratchpadContent();
  if (!content || readScratchpadMode() !== "code") return "";
  const logLines = readScratchpadLogLines();
  if (logLines.length === 0) return content;
  return `${content}\n\n【Terminal Output / Execution Logs】:\n${logLines.join("\n")}`;
}

export function readDesignCanvas(): string {
  return readItem(BOARD_KEYS.designCanvas) ?? "";
}

export function writeDesignCanvas(text: string): void {
  writeItem(BOARD_KEYS.designCanvas, text);
}
