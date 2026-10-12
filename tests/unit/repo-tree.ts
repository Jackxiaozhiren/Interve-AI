/**
 * One walk of the repository tree, shared by the guards that inventory files.
 *
 * Six of them each carried their own copy of the same five lines — `readdirSync`
 * on a `file://` URL, a recursive descent, a filename filter. Copying it was not
 * free: five copies used `statSync().isDirectory()` and the sixth treated any
 * entry without a dot as a directory, which mis-reads a real file named `LICENSE`
 * as a folder to descend into and crashes. The predicate here is the second form,
 * so a dotless file is a file.
 *
 * Paths come back repo-relative (`src/app/page.tsx`) and are resolved against
 * this file's own directory, so a caller never rebuilds the `../../` prefix.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";

/** Repository root, resolved from this module's location. */
const ROOT = new URL("../../", import.meta.url);

/** Every file under `dir` (repo-relative) whose relative path satisfies `matches`. */
export function walkRepo(dir: string, matches: (rel: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(new URL(dir, ROOT))) {
    const rel = `${dir}/${entry}`;
    if (statSync(new URL(rel, ROOT)).isDirectory()) out.push(...walkRepo(rel, matches));
    else if (matches(rel)) out.push(rel);
  }
  return out;
}

/** Contents of a repo-relative path, read the way the walk found it. */
export function readRepo(rel: string): string {
  return readFileSync(new URL(rel, ROOT), "utf8");
}
