// Rater-pack generator (multi-rater milestone enabler, keyless).
//
// Human labels are the only honest fix for single-author-band calibration
// gaps (EVAL_REPORT §5). This script packages everything 2+ independent
// raters need WITHOUT leaking the answers: transcripts only — no authored
// bands, no model outputs. Raters score blind; adjudication + kappa
// graduation follow docs/audit/EVAL_REPORT.md §6.
//
// Blinding is by identifier, not just by body text: the source ids carry the
// expected verdict ("behavioral-strong-01"), so cases ship under seeded-shuffled
// blind ids and the mapping goes to key.csv, which must never reach a rater.
// The seed is fixed so regeneration reproduces the same ids.
//
// Usage: node scripts/rater-pack.mjs [--out rater-pack] [--raters 2]
// The output dir is gitignored (generated artifact, not source).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const out = args[args.indexOf("--out") + 1] || "rater-pack";
const nRaters = Number(args[args.indexOf("--raters") + 1]) || 2;

const BLIND_SEED = 20261002;

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, seed) {
  const rand = mulberry32(seed);
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

const ROOT = new URL("../", import.meta.url);
const load = (p) => JSON.parse(readFileSync(new URL(p, ROOT), "utf8"));

const golden = load("evals/golden.json");
const practice = load("evals/practice-golden.json");

mkdirSync(join(out, "cases"), { recursive: true });
mkdirSync(join(out, "scores"), { recursive: true });

const sheetRows = ["rater_id,case_id,item,value"];
const caseIndex = [];

const entries = [
  ...golden.cases.map((c) => ({ lane: "interview", sourceId: c.id, c })),
  ...practice.cases.map((c) => ({ lane: "practice", sourceId: c.id, c })),
];
const blindCases = shuffled(entries, BLIND_SEED).map((e, i) => ({
  ...e,
  blindId: `case-${String(i + 1).padStart(2, "0")}`,
}));

const keyRows = ["blind_id,lane,source_id"];
for (const b of blindCases) keyRows.push(`${b.blindId},${b.lane},${b.sourceId}`);
writeFileSync(join(out, "key.csv"), `${keyRows.join("\n")}\n`);

for (const { blindId, lane, c } of blindCases) {
  if (lane === "interview") {
    const lines = [
      `# ${blindId} (track: ${c.track}, rubric: ${c.rubricId})`,
      "",
      "> BLIND PACK: score ONLY from the transcript below. Do not look at",
      "> evals/golden.json (authored bands), key.csv, or any model output.",
      "",
      ...c.messages.flatMap((m) => [`**${m.role}:** ${m.content}`, ""]),
    ];
    writeFileSync(join(out, "cases", `${blindId}.md`), lines.join("\n"));
    caseIndex.push(`- ${blindId} — track ${c.track}, rubric ${c.rubricId}`);
    for (let r = 1; r <= nRaters; r++) {
      for (const dim of Object.keys(c.expected.dimensions)) {
        sheetRows.push(`rater-${r},${blindId},${dim},`);
      }
      sheetRows.push(`rater-${r},${blindId},READINESS,`);
    }
  } else {
    const lines = [
      `# ${blindId} (practice lane)`,
      "",
      "> BLIND PACK: score ONLY from the question/answer below.",
      "",
      `**Question:** ${c.question.title}`,
      ...(c.question.description ? [`**Brief:** ${c.question.description}`, ""] : [""]),
      `**Answer:** ${c.answer}`,
      "",
    ];
    writeFileSync(join(out, "cases", `${blindId}.md`), lines.join("\n"));
    caseIndex.push(`- ${blindId} — practice lane (0-100 score)`);
    for (let r = 1; r <= nRaters; r++) {
      sheetRows.push(`rater-${r},${blindId},SCORE,`);
    }
  }
}

for (let r = 1; r <= nRaters; r++) {
  const rows = sheetRows.filter((row) => row.startsWith("rater_id,") || row.startsWith(`rater-${r},`));
  writeFileSync(join(out, "scores", `sheet-rater-${r}.csv`), rows.join("\n") + "\n");
}

const readme = `# Rater pack (generated ${new Date().toISOString().slice(0, 10)} — do not edit by hand, regenerate)

## Protocol (binding for label quality)
1. ${nRaters} raters score INDEPENDENTLY and BLIND (never open evals/*.json expected fields or model outputs).
2. Interview cases: every dimension 1-5 against the anchors in \`src/ai/rubrics\` (+ lower-on-tie); READINESS one of \`needs_foundation | developing | interview_ready | strongly_prepared\` (see READINESS_META in \`src/ai/evaluation-contract.ts\`).
3. Practice cases: SCORE 0-100 holistic, grounded in the answer only.
4. Agreement = exact readiness/score-band match AND every dimension within 1. Disagreements go to an adjudicator (third rater); majority wins, dissent recorded.
5. Graduation: quadratic-weighted kappa >= 0.6 on the 12 interview cases (see \`weightedKappaQuadratic\` in \`src/ai/evals/metrics.ts\`) before authored bands are replaced. Below that, bands stay provisional and the pack is re-rated after anchor clarification.

## Contents
- \`cases/\`: ${golden.cases.length} interview + ${practice.cases.length} practice blind transcripts, under seeded-shuffled ids:
${caseIndex.join("\n")}
- \`scores/sheet-rater-N.csv\`: one sheet per rater (long format: case_id, item, value).
- \`key.csv\`: blind id -> source id. HAND THIS TO NOBODY UNTIL BOTH SHEETS ARE
  RETURNED AND SEALED — it is the only thing that maps a case to its authored
  band, and the ids above are shuffled precisely so a rater cannot recover it.
- All transcripts are SYNTHETIC — no PII, no candidate data.

## Regenerate
\`node scripts/rater-pack.mjs --out rater-pack --raters ${nRaters}\`
`;
writeFileSync(join(out, "README.md"), readme);

console.log(`rater-pack: ${golden.cases.length + practice.cases.length} cases, ${nRaters} sheets -> ${out}/`);
