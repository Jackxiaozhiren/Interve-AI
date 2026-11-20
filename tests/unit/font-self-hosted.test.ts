// S0 design quick-win guards (report §12.13, stage S0).
//
// Two defects shipped together for two weeks while the design system claimed a
// font it never loaded and an AA-compliant secondary text colour it kept
// overriding: `globals.css` referenced `var(--font-inter)` three times with no
// definition anywhere in the repo (no `next/font`, no `@font-face`, no file), so
// every page rendered the OS stack; and `#86909C` — 3.24:1 on white, called out
// in that same file as failing WCAG AA — survived in five components plus the
// chart palette after the token was corrected.
//
// Static contract tests: unit tests run in node with no DOM, so these pin the
// wiring rather than the rendering. They are deliberately narrow — a future
// migration to another font may replace every assertion here, but it has to do
// so on purpose, and it cannot do so by dropping the self-hosting guarantee
// without also having to edit the CSP and the privacy page that depend on it.
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

const fontsModule = readRepo("src/app/fonts.ts");
const layout = readRepo("src/app/layout.tsx");
const globals = readRepo("src/app/globals.css");
const proxy = readRepo("src/proxy.ts");
const privacy = readRepo("src/app/privacy/page.tsx");

const FONT_FILE = "src/app/fonts/InterVariable-latin.woff2";
const fontBytes = () => readFileSync(new URL(`../../${FONT_FILE}`, import.meta.url));

describe("the brand font is bundled and wired to --font-inter", () => {
  it("loads the font through next/font/local, never a remote provider", () => {
    expect(fontsModule, "next/font/local import missing").toMatch(
      /import\s+localFont\s+from\s+["']next\/font\/local["']/
    );
    expect(fontsModule, "remote font provider imported").not.toMatch(/next\/font\/google/);
    expect(fontsModule, "--font-inter variable not declared").toContain('variable: "--font-inter"');
    expect(fontsModule, "font file not referenced").toContain("fonts/InterVariable-latin.woff2");
  });

  it("ships a real woff2 file, small enough to stay on the critical path", () => {
    const bytes = fontBytes();
    // wOF2 magic; a truncated or HTML-error download would fail here first.
    expect(bytes.subarray(0, 4).toString("latin1"), "not a woff2 file").toBe("wOF2");
    const kb = statSync(new URL(`../../${FONT_FILE}`, import.meta.url)).size / 1024;
    expect(kb, `font file is ${kb.toFixed(0)}KB — the latin subset budget is 80KB`).toBeLessThan(80);
    // OFL 1.1 requires the licence to travel with the font.
    expect(readRepo("src/app/fonts/OFL.txt")).toContain("SIL Open Font License");
  });

  it("applies the generated variable class on <html>, so every route inherits it", () => {
    expect(layout, "inter not imported").toMatch(/import\s+\{\s*inter\s*\}\s+from\s+["']\.\/fonts["']/);
    expect(layout, "variable class not applied to <html>").toMatch(
      /<html[^>]*className=\{inter\.variable\}/
    );
  });

  it("keeps the font stack token as the single owner of family + CJK fallbacks", () => {
    expect(globals).toMatch(/--font-sans:\s*var\(--font-inter\)/);
    expect(globals).toMatch(/--font-heading:\s*var\(--font-inter\)/);
    // Inter carries no CJK glyphs; without these the fallback for Chinese is the
    // generic family, which is how the app ended up on Segoe UI on Windows.
    expect(globals, "CJK fallback dropped from --font-sans").toContain('"PingFang SC"');
  });
});

describe("no font request leaves this origin", () => {
  it("keeps font-src at 'self'", () => {
    expect(proxy).toMatch(/font-src 'self'/);
  });

  it("names no third-party font host anywhere in src", () => {
    const offenders = walkRepo("src", (rel) => /\.(ts|tsx|css)$/.test(rel)).filter((rel) =>
      /fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.bunny\.net/.test(readRepo(rel))
    );
    expect(offenders, `remote font hosts referenced: ${offenders.join(", ")}`).toEqual([]);
  });

  it("still discloses the font correctly on the privacy page", () => {
    // The page used to say "本项目不使用 next/font … 界面字体由你设备本地已安装的字体渲染".
    // That sentence became false the moment this stage landed; the disclosure has
    // to move with the implementation, not behind it.
    expect(privacy).toContain("字体不来自第三方");
    expect(privacy, "stale claim about next/font").not.toContain("不使用 next/font");
    expect(privacy, "font is no longer described as same-origin").toContain("同域加载");
  });
});

describe("#86909C is gone from the surfaces that still used it", () => {
  it("no component reintroduces the colour that fails AA on white", () => {
    const offenders = walkRepo("src", (rel) => rel.endsWith(".tsx")).filter((rel) =>
      readRepo(rel).includes("#86909C")
    );
    expect(offenders, `AA-failing colour reintroduced: ${offenders.join(", ")}`).toEqual([]);
  });

  it("points those surfaces at the corrected semantic token instead", () => {
    expect(globals).toContain("--interve-text-secondary: #5B6472");
    expect(globals, "chart palette still on the AA-failing grey").not.toContain("--chart-5: #86909C");
    expect(readRepo("src/components/data/StateBlocks.tsx")).toContain(
      "text-[var(--interve-text-secondary)]"
    );
  });
});
