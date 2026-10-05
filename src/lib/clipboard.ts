/**
 * Single owner of "put this text on the clipboard".
 *
 * Both paths can fail in ways the caller cannot see: `navigator.clipboard` is
 * undefined in an insecure context, `writeText()` rejects when the document
 * loses focus, and `execCommand("copy")` reports failure as a boolean. Callers
 * therefore get a `boolean` and must only claim success when it is true.
 */

export interface LegacyClipboardDom {
  createElement(tag: "textarea"): { value: string; select(): void };
  body: { appendChild(node: unknown): unknown; removeChild(node: unknown): unknown };
  execCommand(command: "copy"): boolean;
}

export interface ClipboardEnvironment {
  clipboard?: { writeText?(text: string): Promise<void> } | null;
  dom?: LegacyClipboardDom | null;
}

type BrowserDocument = {
  createElement?: (tag: string) => unknown;
  body?: { appendChild(node: unknown): unknown; removeChild(node: unknown): unknown };
  execCommand?: (command: string) => boolean;
};

function currentEnvironment(): ClipboardEnvironment {
  const nav = (globalThis as {
    navigator?: { clipboard?: { writeText?(text: string): Promise<void> } };
  }).navigator;
  const doc = (globalThis as { document?: BrowserDocument }).document;
  if (!doc || typeof doc.createElement !== "function" || !doc.body || typeof doc.execCommand !== "function") {
    return { clipboard: nav?.clipboard ?? null, dom: null };
  }
  const createElement = doc.createElement;
  const body = doc.body;
  const execCommand = doc.execCommand;
  return {
    clipboard: nav?.clipboard ?? null,
    dom: {
      createElement: (tag: "textarea") => createElement(tag) as { value: string; select(): void },
      body,
      execCommand: (command: "copy") => execCommand(command),
    },
  };
}

async function writeViaClipboardApi(
  clipboard: NonNullable<ClipboardEnvironment["clipboard"]>,
  text: string,
): Promise<boolean> {
  try {
    await clipboard.writeText!(text);
    return true;
  } catch {
    return false;
  }
}

function copyViaLegacySelection(dom: LegacyClipboardDom, text: string): boolean {
  let area: { value: string; select(): void } | null = null;
  try {
    area = dom.createElement("textarea");
    area.value = text;
    dom.body.appendChild(area);
    area.select();
    return dom.execCommand("copy");
  } catch {
    return false;
  } finally {
    if (area) {
      try {
        dom.body.removeChild(area);
      } catch {
        // The node was never attached (or already gone); nothing to clean up.
      }
    }
  }
}

export async function copyTextToClipboard(
  text: string,
  env: ClipboardEnvironment = currentEnvironment(),
): Promise<boolean> {
  const clipboard = env.clipboard;
  if (clipboard && typeof clipboard.writeText === "function") {
    if (await writeViaClipboardApi(clipboard, text)) return true;
  }
  if (!env.dom) return false;
  return copyViaLegacySelection(env.dom, text);
}
