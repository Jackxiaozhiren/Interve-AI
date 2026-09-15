# DEVELOPMENT

## Prereqs

Node>=20.9 (local 24 OK, Docker 20-alpine OK), npm, no paid keys needed for keyless work.

## Clean room

```bash
git clone https://github.com/Jackxiaozhiren/Interve-AI.git
cd Interve-AI
npm ci
cp .env.example .env.local
# fill ZHIPU_API_KEY for AI; generate SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run verify
npm run dev
```

Keyless: pages render, `npm run test` (196) + `build` pass; AI routes 401 without session; `AI_MOCK=1` exercises handlers schema-deep with zero keys (`tests/integration/mock-contract.test.ts`).

## Daily commands

`npm run dev --turbopack` · `npm run lint` (0/0 required) · `npm run typecheck` · `npm run test` · `npm run test:eval` · `npm run test:e2e:smoke` (chrome-1280x720) · `npm run build`.

## Rules (iron laws)

- HEAD code is truth; never trust README/commits/old prompts over files.
- No deleting tests to pass, no lint ignores without basis, no TS strictness downgrades, no mock/fake/random as AI, no unplanned rewrites, no guessed latest APIs — verify via `node_modules/next/dist/docs` + Context7 + official sources, record in `docs/research/TECH_RESEARCH.md`.
- DB: only additive migrations with rollback headers; never edit `0001/001`.
- Every score needs evidence + uncertainty; never hire verdicts / culture-fit / emotion-personality inference.
- Each phase ends with its gate (`npm run verify` + lane re-runs); fix-first, auto-continue, stop only on Blocking (paid key / third-party account / irreconcilable product fork).
