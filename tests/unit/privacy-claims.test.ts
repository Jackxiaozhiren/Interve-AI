/**
 * /privacy and /terms make checkable claims about this codebase. A policy that
 * drifts from the product is worse than no policy, so the material ones are
 * asserted here against the source they describe — the page is only allowed to
 * say what the code still does.
 *
 * Each test names the sentence it defends. If one starts failing, the honest fix
 * is usually to change the product or the sentence, not the assertion.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const SOURCE_FILES: string[] = [];
(function walk(dir: string): void {
  for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url))) {
    const rel = `${dir}/${entry}`;
    if (statSync(new URL(`../../${rel}`, import.meta.url)).isDirectory()) walk(rel);
    else if (/\.tsx?$/.test(entry)) SOURCE_FILES.push(rel);
  }
})("src");

/**
 * Drops whole-line and block comments. Deliberately shallow: it exists so a
 * comment that *mentions* an avoided API cannot satisfy a "this is never used"
 * assertion. It does not strip trailing comments inside code lines.
 */
function stripLineComments(src: string): string {
  return src.replace(/^\s*(\/\/[^\n]*|\*[^\n]*)$/gm, "");
}

const worker = read("src/workers/whisper.worker.ts");
const camera = read("src/components/interview/CameraSelfView.tsx");
const registry = read("src/ai/providers/registry.ts");
const apiClient = read("src/lib/api-client.ts");
const session = read("src/lib/api/session.ts");
const logging = read("src/lib/api/logging.ts");
const ttl = read("src/lib/interview/session-persistence.ts");
const proxy = read("src/proxy.ts");
const migrations = read("supabase/migrations/003_per_operation_policies.sql");
const privacyPage = read("src/app/privacy/page.tsx");

describe("「原始音频不出这台浏览器」", () => {
  it("transcribes with an in-browser Whisper worker", () => {
    expect(worker).toMatch(/@huggingface\/transformers/);
    expect(worker).toMatch(/Xenova\/whisper-base/);
  });

  it("has no API route that accepts audio", () => {
    // Stronger and simpler than matching a body schema: no server route mentions
    // audio at all, so there is no field it could arrive in.
    const files = [
      "src/app/api/interview-chat/route.ts",
      "src/app/api/analyze-star/route.ts",
      "src/app/api/analyze-behavior/route.ts",
      "src/app/api/analyze-chunk/route.ts",
      "src/app/api/analyze-code/route.ts",
      "src/app/api/copilot/route.ts",
      "src/app/api/parse-resume/route.ts",
    ];
    for (const f of files) expect(read(f), f).not.toMatch(/audio/i);
    // Positive control, so the check above cannot pass by looking at nothing:
    // the word does exist where transcription actually happens.
    expect(worker).toMatch(/audio/i);
  });

  it("never writes a binary object to storage", () => {
    // Supabase Storage is the only place audio or screenshots could persist.
    // Comment-blind, because src/app/api/health/route.ts explains in a comment
    // why it deliberately does NOT probe storage — a text scan would fire there.
    const offenders = SOURCE_FILES.filter((f) => {
      const code = stripLineComments(read(f));
      return /\.storage\b|\.upload\(/.test(code);
    });
    expect(offenders).toEqual([]);
    // And the pattern is real: the same source, unstripped, does contain it.
    expect(read("src/app/api/health/route.ts")).toMatch(/\.storage\b/);
  });
});

describe("「摄像头不做任何分析」", () => {
  it("self-view has no network or analysis call", () => {
    expect(camera).not.toMatch(/fetch\(|\/api\//);
    expect(camera).toMatch(/no analysis performed/i);
  });
});

describe("「默认提供方是智谱，其他只在显式指定时启用」", () => {
  it("points the default client at open.bigmodel.cn", () => {
    expect(registry).toMatch(/open\.bigmodel\.cn/);
  });

  it("routes on an explicit allowlist rather than caller-chosen endpoints", () => {
    expect(registry).toMatch(/spec === "openai"/);
    expect(registry).toMatch(/spec === "gemini"/);
    // Unknown specs must fall through to the default, not to an arbitrary base URL.
    expect(registry).toMatch(/Unknown specs fall through to default|never default/);
  });
});

describe("「行级安全：只有你能读到你的数据」", () => {
  it("defines owner policies keyed on the auth uid", () => {
    expect(migrations).toMatch(/CREATE POLICY "Owner select" ON interviews/);
    expect(migrations).toMatch(/USING \(\(select auth\.uid\(\)\) = user_id\)/);
  });

  it("refuses to store content with no owner instead of storing it unowned", () => {
    expect(apiClient).toMatch(/NO_OWNER/);
    expect(apiClient).toMatch(/CONTENT_TABLES/);
  });
});

describe("「本地快照 30 天自动过期」", () => {
  it("matches the retention the page states", () => {
    expect(ttl).toMatch(/SESSION_TTL_MS = 30 \* 24 \* 3600 \* 1000/);
    expect(privacyPage).toContain("30 天自动过期");
  });
});

describe("「会话 Cookie 是 HttpOnly、24 小时」", () => {
  it("sets both attributes on the session cookie", () => {
    expect(session).toMatch(/HttpOnly/);
    // Max-Age is derived, not a literal — assert the derivation and its source.
    expect(session).toMatch(/Max-Age=\$\{SESSION_TTL_MS \/ 1000\}/);
    expect(session).toMatch(/SESSION_TTL_MS = 24 \* 60 \* 60 \* 1000/);
  });
});

describe("「日志不含你输入的内容」", () => {
  it("declares only operational fields", () => {
    const fields = logging.match(/export interface ApiLogFields \{([\s\S]*?)\n\}/);
    expect(fields, "ApiLogFields shape").not.toBeNull();
    const names = [...fields![1].matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]);
    expect(names.sort()).toEqual(
      ["fallback", "inputTokens", "latencyMs", "model", "outputTokens", "reason", "requestId", "status"].sort()
    );
    // Anything transcript-shaped in this list would make the sentence false.
    expect(names.join(",")).not.toMatch(/text|body|content|transcript|prompt|resume/i);
  });
});

describe("公开可读，且不承诺做不到的联系方式", () => {
  it("leaves /privacy and /terms outside the authenticated page guard", () => {
    const block = proxy.match(/const PROTECTED_PAGE_PREFIXES = \[([\s\S]*?)\]/);
    expect(block, "guard list").not.toBeNull();
    expect(block![1]).not.toMatch(/\/privacy|\/terms/);
  });

  it("links to the repository rather than an invented email address", () => {
    // The URL is owned by src/utils/constants.ts and cited by the legal pages,
    // both footers and this test — assert the shared value, not a copy of it.
    expect(read("src/utils/constants.ts")).toMatch(/github\.com\/Jackxiaozhiren\/Interve-AI\/issues/);
    expect(privacyPage).toMatch(/EXTERNAL_LINKS\.issues/);
    expect(privacyPage).not.toMatch(/mailto:/);
  });
});

/**
 * JSX collapses a newline plus indentation into one ASCII space. In Latin text
 * that is invisible; between two CJK characters it renders as a hole in the
 * sentence ("不一致，␣以代码为准"). Wrapping prose in JSX is therefore not free,
 * and this catches it coming back.
 */
describe("CJK prose is not wrapped inside JSX text", () => {
  const CJK_PUNCT_END = /[　-〿一-鿿＀-￯、。，：；）】]$/;
  const CJK_START = /^[　-〿一-鿿＀-￯]/;
  for (const file of ["src/app/privacy/page.tsx", "src/app/terms/page.tsx"]) {
    it(`${file} has no line break between two CJK runs`, () => {
      const lines = read(file).split("\n");
      const offenders: number[] = [];
      for (let i = 0; i + 1 < lines.length; i++) {
        const a = lines[i].replace(/\s+$/, "");
        const b = lines[i + 1].replace(/^\s+/, "");
        // Markup on either side is fine — a space before an inline <code> is correct.
        if (/[<>{}=`]/.test(a) || /[<>{}=`]/.test(b)) continue;
        if (CJK_PUNCT_END.test(a) && CJK_START.test(b)) offenders.push(i + 1);
      }
      expect(offenders, `wrapped CJK text at lines ${offenders.join(", ")}`).toEqual([]);
    });
  }
});

/**
 * The links this change exists to fix. Counted from the parse tree so the
 * explanatory comments on the page cannot satisfy or break it.
 */
function placeholderAnchors(file: string): string[] {
  const src = read(file);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
      const open = ts.isJsxSelfClosingElement(node) ? node : node.openingElement;
      const tag = open.tagName.getText(sf);
      if (tag === "a" || tag === "Link") {
        for (const attr of open.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || attr.name.getText(sf) !== "href") continue;
          const init = attr.initializer;
          if (!init) continue;
          const value = ts.isJsxExpression(init) ? init.expression?.getText(sf) : init.getText(sf);
          if (value !== '"#"' && value !== "'#'" && value !== "{#}") continue;
          const text = ts.isJsxElement(node)
            ? node.children.map((c) => c.getText(sf)).join("").trim()
            : "(icon)";
          out.push(text.slice(0, 24));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe("the legal links actually go somewhere", () => {
  for (const file of ["src/app/landing/page.tsx", "src/components/layout/Footer.tsx"]) {
    it(`${file} no longer points 隐私政策 or 服务条款 at nothing`, () => {
      const dead = placeholderAnchors(file);
      expect(dead.filter((t) => /隐私|条款|政策/.test(t))).toEqual([]);
    });
  }

  it("links both routes from both footers", () => {
    for (const file of ["src/app/landing/page.tsx", "src/components/layout/Footer.tsx"]) {
      const src = read(file);
      expect(src, file).toMatch(/href="\/privacy"|href=\{"\/privacy"\}|href=\{`\/privacy`\}/);
      expect(src, file).toMatch(/href="\/terms"|href=\{"\/terms"\}/);
    }
  });
});
