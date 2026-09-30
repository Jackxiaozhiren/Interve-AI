import { beforeEach, describe, expect, it } from "vitest";
import {
  BOARD_KEYS,
  readDesignCanvas,
  readScratchpadCodeContext,
  readScratchpadContent,
  readScratchpadLogLines,
  readScratchpadMode,
  appendScratchpadContent,
  writeScratchpadLogs,
} from "@/lib/interview/board-state";
import type { LogEntry } from "@/hooks/useCodeExecutor";

/**
 * The interview page builds the model's code context from what the candidate
 * has on the scratchpad. Those reads used to be 11 hand-typed key literals
 * spread over 4 files, untested in every direction.
 */

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});

const log = (message: string, type: LogEntry["type"] = "log"): LogEntry =>
  ({ type, message, timestamp: 0 });

beforeEach(() => store.clear());

describe("board-state key ownership", () => {
  it("names every board key exactly once", () => {
    const names = Object.values(BOARD_KEYS);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      "interve_scratchpad_content",
      "interve_scratchpad_mode",
      "interve_scratchpad_logs",
      "interve_system_design_content",
    ]);
  });

  it("stays covered by the privacy page's local-data wipe", () => {
    // src/app/dashboard/privacy/page.tsx erases localStorage by prefix. A key
    // that no longer matches those prefixes would survive "delete my data".
    const prefixes = ["interve_session_", "interve_scratchpad_", "interve_system_design_"];
    for (const key of Object.values(BOARD_KEYS)) {
      expect(prefixes.some((p) => key.startsWith(p)), key).toBe(true);
    }
  });
});

describe("readScratchpadCodeContext", () => {
  it("is empty when nothing is on the board", () => {
    expect(readScratchpadCodeContext()).toBe("");
  });

  it("ignores the buffer while the board is in notes mode", () => {
    store.set(BOARD_KEYS.scratchpadContent, "draft of my story");
    store.set(BOARD_KEYS.scratchpadMode, "notes");
    expect(readScratchpadCodeContext()).toBe("");
  });

  it("sends code, but no logs block, when nothing has been executed", () => {
    store.set(BOARD_KEYS.scratchpadContent, "func main() {}");
    store.set(BOARD_KEYS.scratchpadMode, "code");
    expect(readScratchpadCodeContext()).toBe("func main() {}");
  });

  it("appends rendered terminal output", () => {
    store.set(BOARD_KEYS.scratchpadContent, "print(1)");
    store.set(BOARD_KEYS.scratchpadMode, "code");
    writeScratchpadLogs([log("1"), log("boom", "error")]);
    expect(readScratchpadCodeContext()).toBe(
      "print(1)\n\n【Terminal Output / Execution Logs】:\n[log] 1\n[error] boom",
    );
  });

  it("keeps the buffer when the logs payload is unreadable", () => {
    // Matching the old inline behaviour by design: a corrupt logs write costs
    // the terminal block, not the candidate's code context.
    store.set(BOARD_KEYS.scratchpadContent, "still here");
    store.set(BOARD_KEYS.scratchpadMode, "code");
    store.set(BOARD_KEYS.scratchpadLogs, "{not json");
    expect(readScratchpadCodeContext()).toBe("still here");
    store.set(BOARD_KEYS.scratchpadLogs, '{"type":"log"}');
    expect(readScratchpadCodeContext()).toBe("still here");
  });

  it("drops log entries with no message rather than prompting 'undefined'", () => {
    // The regression this guards: the old single .map() over the parsed array
    // had no filter, so a partial entry reached the model as "[undefined]
    // undefined".
    store.set(BOARD_KEYS.scratchpadLogs, JSON.stringify([log("keep"), { type: "log" }]));
    expect(readScratchpadLogLines()).toEqual(["[log] keep"]);
  });
});

describe("read/write helpers", () => {
  it("reads back what the scratchpad writes", () => {
    expect(readScratchpadContent()).toBe("");
    store.set(BOARD_KEYS.scratchpadContent, "x = 1");
    expect(readScratchpadContent()).toBe("x = 1");
  });

  it("rejects an unknown persisted mode", () => {
    store.set(BOARD_KEYS.scratchpadMode, "diagrams");
    expect(readScratchpadMode()).toBeNull();
  });

  it("appends to the board without overwriting the draft in progress", () => {
    store.set(BOARD_KEYS.scratchpadContent, "existing notes");
    appendScratchpadContent("quoted text");
    expect(store.get(BOARD_KEYS.scratchpadContent)).toBe("existing notes\n\nquoted text");
    store.clear();
    appendScratchpadContent("first");
    expect(store.get(BOARD_KEYS.scratchpadContent)).toBe("first");
  });

  it("removes the logs key once the terminal is cleared", () => {
    writeScratchpadLogs([log("out")]);
    expect(store.has(BOARD_KEYS.scratchpadLogs)).toBe(true);
    writeScratchpadLogs([]);
    expect(store.has(BOARD_KEYS.scratchpadLogs)).toBe(false);
  });

  it("reads the design canvas the board writes", () => {
    store.set(BOARD_KEYS.designCanvas, "boxes and arrows");
    expect(readDesignCanvas()).toBe("boxes and arrows");
  });

  it("returns empty context when storage access throws", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => { throw new Error("SecurityError"); } },
    });
    expect(readScratchpadContent()).toBe("");
    expect(readScratchpadCodeContext()).toBe("");
    expect(readDesignCanvas()).toBe("");
    if (original?.value) Object.defineProperty(globalThis, "localStorage", original);
  });
});
