// S5 slice 3: three route pages are pure composition — links, copy and shared
// components — and were marked client only because the surrounding era was.
// Their interactive children keep their own boundaries; lifting the directive
// lets the page shell render on the server and lowers use-client for real.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const PAGES = [
  "src/app/login/page.tsx",
  "src/app/dashboard/resume/page.tsx",
  "src/app/dashboard/interview/page.tsx",
];

describe("static route shells stay on the server", () => {
  for (const file of PAGES) {
    it(`${file} has no client directive or interactive code`, () => {
      const src = readFileSync(new URL(file, ROOT), "utf8");
      expect(src).not.toMatch(/^\s*["']use client["']/m);
      expect(src, "a hook would require a client boundary").not.toMatch(
        /\buse(State|Effect|Ref|Memo|Callback|Reducer|Router|Params|SearchParams)\s*\(/
      );
      expect(src, "a DOM or browser call would require a client boundary").not.toMatch(
        /\b(window|document|localStorage|sessionStorage|navigator)\./
      );
      expect(src, "an inline handler would require a client boundary").not.toMatch(
        /\bon[A-Z]\w+\s*=/
      );
    });
  }

  it("still composes client children where interaction really lives", () => {
    const login = readFileSync(new URL(PAGES[0], ROOT), "utf8");
    expect(login).toContain("import { LoginForm }");
    expect(login).toContain("<Suspense");
  });
});
