/**
 * The `/recruiter` decision, enforced.
 *
 * Question on the table: build it for real, or delete it. The answer came out of
 * measuring what is actually there rather than from the label in ARCHITECTURE.md:
 *
 * - `/recruiter` is an interface demo. Its candidate rows are invented
 *   (C-101…C-105, "Emily Rodriguez", an "Offer" funnel stage) and it writes
 *   nothing, after 5941118 removed the handler that used to persist notes keyed
 *   on those ids.
 * - `/recruiter/assessments` is a real feature with nothing demo about it: it
 *   calls the generation route, handles a zero-question response and a provider
 *   failure distinctly, and saves the *user's own* generated assessment locally.
 *
 * So the area stays, and what keeps it safe is a set of invariants rather than a
 * promise to remember. Each is checked against primary artifacts: the route
 * files, the proxy's protected list, and robots.ts.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

const DEMO = "src/app/recruiter/page.tsx";
const REAL = "src/app/recruiter/assessments/page.tsx";
const PROXY = "src/proxy.ts";
const ROBOTS = "src/app/robots.ts";

describe("/recruiter stays a labelled demo", () => {
  it("shows the demo notice inline, not only as a transient toast", () => {
    const body = read(DEMO);
    expect(body).toMatch(/\{t\.recruiter\.demoNotice\}/);
    expect(body).toMatch(/t\.recruiter\.demoNotice/);
  });

  it("persists nothing about the invented candidates", () => {
    const body = read(DEMO);
    expect(body).not.toMatch(/db\.evaluations\.(add|update|put)\(/);
    expect(body).not.toMatch(/db\.candidates\.(add|update|put)\(/);
    expect(body).toMatch(/mockCandidates/);
  });

  it("is unreachable by anonymous visitors", () => {
    // The protected list is a prefix match, so '/recruiter' covers the sub-routes.
    const proxy = read(PROXY);
    const list = proxy.slice(proxy.indexOf("PROTECTED_PAGE_PREFIXES"), proxy.indexOf("];", proxy.indexOf("PROTECTED_PAGE_PREFIXES")));
    expect(list).toMatch(/'\/recruiter'/);
  });

  it("is kept out of the index", () => {
    expect(read(ROBOTS)).toMatch(/"\/recruiter"/);
  });
});

describe("/recruiter/assessments is real and must not be labelled otherwise", () => {
  it("goes through the shared API reader instead of inventing content", () => {
    const body = read(REAL);
    expect(body).toMatch(/readApiJson/);
    expect(body).toMatch(/describeApiFailure/);
    expect(body).toMatch(/fetch\("\/api\/parse-jd"/);
  });

  it("treats an empty question set as a failure, not as success", () => {
    const body = read(REAL);
    expect(body).toMatch(/questions\.length === 0/);
  });

  it("carries no demo notice, because nothing on it is a demo", () => {
    // Guards against blanket-labelling the whole recruiter area, which would
    // tell users their own generated assessments are fake.
    expect(read(REAL)).not.toMatch(/demoNotice/);
  });

  it("saves only what the user generated", () => {
    const body = read(REAL);
    expect(body).toMatch(/db\.assessments\.add\(\{\s*\.\.\.generatedData/);
  });
});
