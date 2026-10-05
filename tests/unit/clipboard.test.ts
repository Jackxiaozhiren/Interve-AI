/**
 * Behaviour of the single clipboard owner.
 *
 * The app used to call `navigator.clipboard.writeText(text)` and then announce
 * success, at five sites, in four of which the announcement was unconditional.
 * Two failure modes are normal rather than exotic: `navigator.clipboard` is
 * `undefined` in an insecure context (so the old code threw a TypeError), and
 * `writeText()` rejects when the document is not focused. The helper has to
 * report those honestly, which is what these cases pin.
 */
import { describe, expect, it } from "vitest";
import { copyTextToClipboard, type ClipboardEnvironment } from "@/lib/clipboard";

interface Harness {
  written: string[];
  lifecycle: string[];
  env: ClipboardEnvironment;
}

function harness(opts: {
  api?: "resolves" | "rejects" | "absent";
  exec?: boolean | "throws" | "absent";
}): Harness {
  const written: string[] = [];
  const lifecycle: string[] = [];
  const clipboard =
    opts.api === "absent" || opts.api === undefined
      ? null
      : {
          writeText: async (text: string) => {
            written.push(text);
            if (opts.api === "rejects") throw new DOMException("not focused");
          },
        };
  const execCommand =
    opts.exec === "absent" || opts.exec === undefined
      ? undefined
      : (): boolean => {
          lifecycle.push("execCommand");
          if (opts.exec === "throws") throw new Error("selection discarded");
          return opts.exec === true;
        };
  const env: ClipboardEnvironment = {
    clipboard,
    dom:
      execCommand === undefined
        ? null
        : {
            createElement: () => {
              lifecycle.push("createElement");
              return { value: "", select: () => lifecycle.push("select") };
            },
            body: {
              appendChild: () => lifecycle.push("append"),
              removeChild: () => lifecycle.push("remove"),
            },
            execCommand,
          },
  };
  return { written, lifecycle, env };
}

describe("copyTextToClipboard", () => {
  it("reports success only when the async write resolved, with the text passed through", async () => {
    const h = harness({ api: "resolves" });
    await expect(copyTextToClipboard("面试官问题", h.env)).resolves.toBe(true);
    expect(h.written).toEqual(["面试官问题"]);
    expect(h.lifecycle).toEqual([]);
  });

  it("falls back to the selection copy when the async write rejects, and inherits its verdict", async () => {
    const ok = harness({ api: "rejects", exec: true });
    await expect(copyTextToClipboard("x", ok.env)).resolves.toBe(true);
    const refused = harness({ api: "rejects", exec: false });
    await expect(copyTextToClipboard("x", refused.env)).resolves.toBe(false);
    expect(refused.lifecycle).toContain("execCommand");
  });

  it("reports the legacy verdict rather than assuming it, and tears the helper node down", async () => {
    const h = harness({ api: "absent", exec: true });
    await expect(copyTextToClipboard("code", h.env)).resolves.toBe(true);
    expect(h.lifecycle).toEqual(["createElement", "append", "select", "execCommand", "remove"]);
  });

  it("returns false instead of throwing when no clipboard surface exists at all", async () => {
    // The insecure-context case the old call sites hit as an uncaught TypeError.
    await expect(copyTextToClipboard("x", { clipboard: null, dom: null })).resolves.toBe(false);
    await expect(copyTextToClipboard("x", {})).resolves.toBe(false);
  });

  it("returns false when the legacy copy throws, and still attempts cleanup", async () => {
    const h = harness({ api: "absent", exec: "throws" });
    await expect(copyTextToClipboard("x", h.env)).resolves.toBe(false);
    expect(h.lifecycle).toContain("remove");
  });

  it("reads the real navigator.clipboard when no environment is injected", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const calls: string[] = [];
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: async (text: string) => void calls.push(text) } },
      configurable: true,
      writable: true,
    });
    try {
      await expect(copyTextToClipboard("default path")).resolves.toBe(true);
      expect(calls).toEqual(["default path"]);
    } finally {
      if (original) Object.defineProperty(globalThis, "navigator", original);
    }
  });

  it("reports false through the default path when the browser has no clipboard", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });
    try {
      await expect(copyTextToClipboard("x")).resolves.toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, "navigator", original);
    }
  });
});
