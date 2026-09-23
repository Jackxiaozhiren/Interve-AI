// G1 deploy-consistency pins (static, $0).
//
// V5 G1: vercel.json vs output:standalone consistency belongs in CI;
// Dockerfile base must track engines.node; robots must keep the
// practice-only crawl surface (public marketing + auth only).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), "utf8");

describe("deploy consistency (G1)", () => {
  it("vercel.json does not fight output:standalone", () => {
    const vercel = JSON.parse(root("vercel.json")) as Record<string, unknown>;
    // Standalone is a Docker concern; Vercel builds natively. Any `output`
    // or custom build/output keys here would silently fork the two paths.
    expect(vercel, "vercel.json output key").not.toHaveProperty("output");
    expect(vercel, "vercel.json builds key").not.toHaveProperty("builds");
    expect(root("next.config.ts"), "standalone").toContain("output: 'standalone'");
  });

  it("Dockerfile base tracks engines.node (24)", () => {
    const docker = root("Dockerfile");
    const pkg = JSON.parse(root("package.json")) as { engines: { node: string } };
    expect(pkg.engines.node).toContain("24");
    expect(docker.split("\n")[0]).toMatch(/^FROM node:24/);
    expect(docker, "non-root").toContain("USER nextjs");
  });

  it("robots keeps the practice-only crawl surface", () => {
    const robots = root("src/app/robots.ts");
    for (const pub of ["/landing", "/login", "/signup"]) {
      expect(robots, `allow ${pub}`).toContain(pub);
    }
    for (const priv of ["/api/", "/dashboard", "/interview", "/practice", "/chat", "/recruiter", "/setup"]) {
      expect(robots, `disallow ${priv}`).toContain(priv);
    }
    // Sitemap stays ungenerated until a prod domain exists (comments may
    // explain why; the returned object must carry no sitemap field).
    expect(robots, "no sitemap field").not.toMatch(/^\s*sitemap\s*:/m);
  });
});
