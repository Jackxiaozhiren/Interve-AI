/**
 * "原始音频不上传、不保存" — the privacy page says it, so the build must prove it.
 *
 * Checked as two mechanical clauses over `src/**`, because a sentence in prose is
 * only as true as the code that lets it stay true:
 *   1. a Blob constructed from an `audio/*` type never reaches a network call —
 *      not as `fetch(url, { body })`, not as a `Request` body, not appended to a
 *      `FormData`, and not as a direct argument of a transport call;
 *   2. every transcriber/synthesiser worker is built from a *relative module
 *      specifier*, so the model ships with the bundle and runs in the page.
 *      `new Worker("https://…")` would break the sentence quietly, because the
 *      code still reads "worker".
 *
 * Today exactly one audio Blob exists in the app (the room's recording), and it is
 * decoded to PCM in the browser and handed to the local Whisper worker.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const AUDIO_TYPE = /['"`]audio\//;

function findTs(dir = path.join(process.cwd(), "src")): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function assignmentsOf(source: ts.SourceFile, name: string): ts.Expression[] {
  const out: ts.Expression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) out.push(node.initializer);
    node.forEachChild(visit);
  };
  visit(source);
  return out;
}

const TRANSPORTS = new Set(["fetch", "Request", "XMLHttpRequest", "sendBeacon"]);

function analyze(label: string, text: string): { audioLeaks: string[]; remoteWorkers: string[]; blobs: number } {
  const source = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const audioLeaks: string[] = [];
  const remoteWorkers: string[] = [];
  let blobs = 0;
  const line = (n: ts.Node) => source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1;

  // names bound to an audio Blob in this file
  const audioNames = new Set<string>();
  const collectBlobs = (node: ts.Node) => {
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Blob") {
      blobs += 1;
      const typeArg = node.arguments?.[1];
      const isAudio = typeArg ? AUDIO_TYPE.test(typeArg.getText(source)) : AUDIO_TYPE.test(node.getText(source));
      if (isAudio && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
        audioNames.add(node.parent.name.text);
      }
    }
    node.forEachChild(collectBlobs);
  };
  source.forEachChild(collectBlobs);

  if (audioNames.size) {
    const mark = (node: ts.Node, why: string) => audioLeaks.push(`${label}:${line(node)} ${why}`);
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && audioNames.has(node.text)) {
        let cur: ts.Node = node;
        while (cur.parent && cur.parent !== source) {
          const parent = cur.parent;
          if (ts.isCallExpression(parent)) {
            const callee = parent.expression.getText(source);
            const isTransport = TRANSPORTS.has(callee) || /\.(post|put|patch|send)$/.test(callee);
            const argIndex = parent.arguments.indexOf(node as ts.Expression);
            const appended = callee.endsWith(".append") || callee === "append";
            if (isTransport && argIndex >= 0) mark(node, "audio Blob passed to a transport call");
            if (appended && argIndex >= 0) mark(node, "audio Blob appended to FormData");
          }
          if (ts.isPropertyAssignment(parent) && parent.name.getText(source) === "body") {
            mark(node, "audio Blob used as a request body");
            break;
          }
          cur = parent;
        }
      }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
  }

  const visitWorker = (node: ts.Node) => {
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Worker") {
      const first = node.arguments?.[0];
      const relativeModuleUrl =
        !!first && ts.isNewExpression(first) &&
        ts.isIdentifier(first.expression) && first.expression.text === "URL" &&
        !!first.arguments?.[0] && /^['"`]\./.test(first.arguments[0].getText(source));
      const inlineModule = !!first && ts.isStringLiteral(first) && !/^https?:|^file:/.test(first.text);
      // new Worker(URL.createObjectURL(blob)) is the sandbox pattern the code
      // executor uses: the script is generated in this same tab, so it is local.
      const objectUrl =
        !!first && ts.isIdentifier(first) &&
        assignmentsOf(source, first.text).some((init) =>
          ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression) &&
          init.expression.name.text === "createObjectURL");
      if (!relativeModuleUrl && !inlineModule && !objectUrl) {
        remoteWorkers.push(`${label}:${line(node)} Worker not built from a relative module URL`);
      }
    }
    node.forEachChild(visitWorker);
  };
  source.forEachChild(visitWorker);

  return { audioLeaks, remoteWorkers, blobs };
}

describe("the probe itself (it must be able to fail)", () => {
  const leakCases: [string, string, number][] = [
    ["fetch body property", 'const blob = new Blob(parts, { type: "audio/webm" });\nawait fetch("/api/x", { method: "POST", body: blob });', 1],
    ["fetch positional", 'const blob = new Blob(parts, { type: "audio/webm" });\nfetch(blob);', 1],
    ["FormData append", 'const blob = new Blob(parts, { type: "audio/webm" });\nconst fd = new FormData();\nfd.append("clip", blob);', 1],
    ["new Request", 'const blob = new Blob(parts, { type: "audio/webm" });\nnew Request("/api/x", { body: blob });', 1],
    ["stays in the browser", 'const blob = new Blob(parts, { type: "audio/webm" });\nconst pcm = await decode(blob);', 0],
    ["a non-audio blob may be sent", 'const blob = new Blob([code], { type: "application/javascript" });\nawait fetch("/api/x", { body: blob });', 0],
  ];
  it.each(leakCases)("reports %s", (_label, body, expected) => {
    expect(analyze("probe.ts", body).audioLeaks).toHaveLength(expected);
  });

  it("names the remote worker and not the local one", () => {
    expect(analyze("probe.ts", 'new Worker("https://cdn.example/whisper.js");').remoteWorkers).toHaveLength(1);
    expect(analyze("probe.ts", 'new Worker(new URL("./workers/w.ts", import.meta.url));').remoteWorkers).toEqual([]);
  });

  it("does not flag a Blob it never saw an audio type on", () => {
    const { audioLeaks, blobs } = analyze("probe.ts", 'const b = new Blob([x]);\nawait fetch("/api/y", { body: b });');
    expect(blobs).toBe(1);
    expect(audioLeaks).toEqual([]);
  });
});

describe("src/ keeps raw audio inside the browser", () => {
  const reports = findTs().map((file) => {
    const label = path.relative(process.cwd(), file);
    return { label, ...analyze(label, fs.readFileSync(file, "utf8")) };
  });

  it("finds the audio recording this rule is written about", () => {
    const total = reports.reduce((sum, r) => sum + r.blobs, 0);
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it("no audio Blob reaches a transport call anywhere in src/", () => {
    expect(reports.flatMap((r) => r.audioLeaks)).toEqual([]);
  });

  it("every Worker is built from a relative module URL, so the models run in the page", () => {
    expect(reports.flatMap((r) => r.remoteWorkers)).toEqual([]);
  });

  it("the privacy sentence these clauses protect is still on the page", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/privacy/page.tsx"), "utf8");
    expect(page).toContain("原始音频不上传、不保存");
  });
});
