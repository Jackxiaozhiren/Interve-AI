// supabase/migrations/README.md is the authority for which file to run and in
// what order — it is also the only thing standing between a fresh project and
// the frozen 0001 (UUID keys) instead of 001 (BIGSERIAL), which the whole client
// assumes (src/lib/db.ts:22). Prose like this goes stale the moment a file is
// added, and I did it myself: 005 landed and the list still stopped at 004.
//
// GREEN ON ARRIVAL: it passes because the README was corrected first, so it is
// not proof of a caught bug. Its bite is proven by the last test, which feeds the
// same predicate a hypothetical 006 instead of writing into the repo — a temp
// file here would race the other spec files that read this directory.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../../supabase/migrations/", import.meta.url);
const readme = () => readFileSync(new URL("README.md", DIR), "utf8");

/** Every numbered migration file a fresh project should run, excluding frozen 0001. */
const runnable = () =>
  readdirSync(DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f) && !f.startsWith("0001_"))
    .sort();

const unlisted = (files: string[], text: string) => files.filter((f) => !text.includes(f));

describe("migrations README vs the files on disk", () => {
  it("lists every migration a fresh project should run", () => {
    const missing = unlisted(runnable(), readme());
    expect(missing, `unlisted: ${missing.join(", ")}`).toEqual([]);
  });

  it("lists them in ascending numeric order", () => {
    const text = readme();
    const positions = runnable().map((f) => text.indexOf(f));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("keeps the frozen file out of the run order", () => {
    const text = readme();
    const listBlock = text.slice(0, text.indexOf("## 冻结文件"));
    expect(listBlock).not.toContain("0001_initial_schema.sql");
  });

  it("names 005 as not-yet-applied, so nobody runs it blind", () => {
    expect(readme()).toMatch(/005_[a-z_]+\.sql[^\n]*[\s\S]{0,400}未在任何环境应用/);
  });

  // A gate nobody can turn red is decoration.
  it("would report an added migration as unlisted", () => {
    expect(unlisted([...runnable(), "006_future.sql"], readme())).toEqual(["006_future.sql"]);
  });
});
