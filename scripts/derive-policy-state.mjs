/**
 * The RLS policy set the migrations *should* leave in the database.
 *
 * `docs/SECURITY.md` has been asserting that migration 006 closed the legacy
 * anon bridge on the content tables, while 006's own header says "STATUS: DRAFT
 * — NOT APPLIED ANYWHERE". Both sentences can be found in the repo at the same
 * time, which is the signature of a claim no check owns. This module turns the
 * migration files into the expected state, so the live `pg_policies` dump is
 * compared against something derived from the source rather than against prose.
 *
 * It is a policy *state machine*, not a SQL engine: it understands exactly the
 * statements the migrations in this repository use (CREATE POLICY, DROP POLICY,
 * ALTER TABLE ... ENABLE ROW LEVEL SECURITY, CREATE TABLE, and 006's
 * FOREACH-over-an-array-literal block). Anything it does not recognise is
 * collected in `unparsed`, and the test requires that list to be empty — so a
 * future migration written in a form this cannot follow fails the gate instead
 * of silently changing the expected set.
 *
 * Pure: takes text, returns data. No fs, so it runs in a test without touching
 * the working tree.
 */

/** `(table, policy)` — the pair `pg_policies.tablename / .policyname` reports. */
export function policyKey(table, name) {
  return `${table}::${name}`;
}

const CREATE_POLICY_RE =
  /CREATE\s+(?:OR\s+REPLACE\s+)?POLICY\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_]+))\s+ON\s+(?:public\.)?([a-z_]+)/gi;
const DROP_POLICY_RE =
  /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_]+))\s+ON\s+(?:public\.)?([a-z_]+)/gi;
const ENABLE_RLS_RE =
  /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
const CREATE_TABLE_RE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_]+)/gi;

/**
 * 006 closes the bridge with a DO block rather than 20 literal statements:
 *
 *   FOREACH t IN ARRAY ARRAY['interviews', ...] LOOP
 *     EXECUTE format('DROP POLICY IF EXISTS %I ON %I', '<name>', t);
 *
 * Both the array and the name list are read here and expanded. The shapes are
 * asserted rather than assumed — a rewrite that stops matching this pattern ends
 * up in `unparsed`, which the gate treats as a failure to reason about.
 */
function expandDropLoop(block) {
  const tables = /FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\[(.*?)\]/is.exec(block);
  if (!tables) return null;
  const names = [...tables[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const targets = [...block.matchAll(/EXECUTE\s+format\(\s*'DROP POLICY IF EXISTS %I ON %I'\s*,\s*'([^']+)'\s*,\s*(\w+)\s*\)/gi)];
  if (targets.length === 0) return null;
  const dropped = [];
  for (const t of targets) {
    const policyName = t[1];
    const variable = t[2];
    const list = variable === "t" ? names : null;
    if (!list) return null;
    for (const table of list) dropped.push({ table, name: policyName });
  }
  return { dropped, arrayTables: names };
}

/**
 * @param {{sql: string, name?: string}[] | string[]} migrations ordered by filename,
 *   as `run` applies them. Strings are allowed; the name is then positional.
 * @returns {{policies: Map<string,string>, rlsEnabled: Set<string>, tables: Set<string>, unparsed: string[], applied: number}}
 */
export function derivePolicyState(migrations) {
  const policies = new Map();
  const rlsEnabled = new Set();
  const tables = new Set();
  const unparsed = [];
  let applied = 0;

  for (const entry of migrations) {
    const sql = typeof entry === "string" ? entry : entry.sql;
    const name = typeof entry === "string" ? `migration[${migrations.indexOf(entry)}]` : (entry.name ?? "?");
    // Strip comments, whole-line and trailing, so the rollback recipes in
    // 003/006's headers — literal `CREATE POLICY ...` text inside comments — are
    // not mistaken for statements.
    const body = sql
      .split("\n")
      .map((line) => line.replace(/--.*$/,""))
      .join("\n");

    for (const m of body.matchAll(CREATE_TABLE_RE)) tables.add(m[1]);
    for (const m of body.matchAll(ENABLE_RLS_RE)) rlsEnabled.add(m[1]);

    const blocks = [...body.matchAll(/DO\s+\$\$([\s\S]*?)\$\$/gi)];
    let consumed = 0;
    for (const b of blocks) {
      const expansion = expandDropLoop(b[1]);
      const mentions = (b[1].match(/\bPOLICY\b/gi) ?? []).length;
      if (expansion) {
        for (const d of expansion.dropped) {
          policies.delete(policyKey(d.table, d.name));
          applied += 1;
        }
        consumed += mentions;
      }
      // A DO block this cannot expand contributes mentions and no consumption,
      // which the reconciliation below reports as unexplained.
    }

    const outside = body.split(/DO\s+\$\$[\s\S]*?\$\$/gi).join("\n");
    for (const m of outside.matchAll(DROP_POLICY_RE)) {
      const name2 = m[1] || m[2] || m[3];
      policies.delete(policyKey(m[4], name2));
      applied += 1;
      consumed += 1;
    }
    for (const m of outside.matchAll(CREATE_POLICY_RE)) {
      const name2 = m[1] || m[2] || m[3];
      policies.set(policyKey(m[4], name2), name2);
      applied += 1;
      consumed += 1;
    }

    // Reconcile by occurrence, not by leading keyword. `ALTER POLICY`, a policy
    // created through a different EXECUTE shape, or a policy inside a comment
    // that survived stripping all show up here as a count the derivation cannot
    // account for — where a `starts with CREATE|DROP` filter would have ignored
    // them and quietly changed the expected set.
    const mentions = (body.match(/\bPOLICY\b/gi) ?? []).length;
    if (mentions !== consumed) {
      unparsed.push(
        `${name}: ${mentions} POLICY occurrences, ${consumed} accounted for (${mentions - consumed} unexplained)`
      );
    }
  }

  return { policies, rlsEnabled, tables, unparsed, applied };
}

/** The bridge policies 006 exists to remove, and the tables it targets. */
export const LEGACY_BRIDGE_POLICIES = [
  "Legacy anon select unowned",
  "Legacy anon insert unowned",
  "Legacy anon update unowned",
  "Legacy anon delete unowned",
];

/**
 * Split the derived state into what the live dump must show.
 * `closed[]` — content tables 006 drops the bridge from;
 * `open[]`  — tables the migration deliberately keeps bridged, so a dump that
 * shows them gone is not "more secure", it is unexplained drift.
 */
export function classifyBridge(state, closedTables, openTables) {
  const closed = [];
  const open = [];
  for (const table of closedTables) {
    for (const name of LEGACY_BRIDGE_POLICIES) {
      closed.push({ table, name, present: state.policies.has(policyKey(table, name)) });
    }
  }
  for (const table of openTables) {
    for (const name of LEGACY_BRIDGE_POLICIES) {
      open.push({ table, name, present: state.policies.has(policyKey(table, name)) });
    }
  }
  return { closed, open };
}
