# V11 findings register

> Opened 2026-10-22. The living half of `docs/audit`: one row per defect this round has
> evidence for, and `debt.auditDocsLines` pays for it. Superseded round reports moved to
> `docs/audit/archive/` in the same change that opened this file — the headroom is spent
> on findings, not on history.

**Rule each row has to satisfy:** name the predicate that would catch it again, or say in
so many words that no predicate exists yet and what it would cost. A row that cites only a
feeling is not a finding, and a row that cites a check nobody runs is worse, because it
reads as covered.

| ID | Finding | Status | Evidence and check |
|---|---|---|---|
| V11-01 | The axe interview-room arm cannot see contrast on the room's translucent surfaces: axe answers `incomplete`, not `violation`, for text over alpha, so a real low-contrast label passes a settled scan. | OPEN, no predicate yet | Witnessed while planting AXP4, which escaped. Two costed options, neither taken: composite the translucent layer and assert on `incomplete`, or move essential text off alpha backgrounds. The settle fix (#62) removed the timing flake; it did not make the blind spot visible. |
| V11-02 | Five fixed `waitForTimeout` calls remain in browser specs CI actually runs, and they are not one class: three wait for a screenshot or an absence, two wait before an assertion that already retries. | OPEN, inventory measured | `tests/clipboard-disclosure.spec.ts:96`, `tests/e2e/interview-interactive.spec.ts:33,53,79`, `tests/dashboard.spec.ts:51`. `dashboard.spec.ts:51` is load-bearing and adjudicated (the tour reveals itself 1 s after mount, and the arm asserts the dialog stays hidden). `tests/e2e/core-visual-consistency.spec.ts` holds eight more but no CI lane runs it and `specs-must-assert.test.ts` already records why. |
| V11-03 | The visual lane masked a zero-area element, so both ubuntu baselines contained Next's dev-tools indicator instead of the product. | CLOSED by PR #147 | Measured from that run's artefacts: zero magenta pixels in either capture; the baselines differ from chrome-free captures only inside `x[1..74] y[661..733]` (landing) and `x[1..156] y[656..719]` (login). Replaced by a document-level hide with two assertions; `DCM1` and `DCM2` each redden it. |
| V11-04 | Next's dev server reports one issue on `/` and `/login` in CI; the same pages report zero console errors and zero page errors locally. | OPEN, unreproduced, therefore not claimed as a defect | Found as the cause of V11-03's pill. Environment-conditional is the only thing measured. Next step if picked up: make the smoke lane print the dev-tools host's shadow text so the message is attributable. The visual lane no longer depends on the answer. |
| V11-05 | Five of the sixteen notes in `docs/audit/facts.limits.json` were not the collector's own text, in both directions — the ledger carried a current queue the code did not, and the code carried detail the ledger did not. | CLOSED by this register's own change | `_keys` is a copy written from `RATCHET_KEYS` by `--seed`, and nothing compared them. `facts-ratchet.test.ts` now asserts equality over the union of keys, so a one-sided edit is red; the merged text is the union of both sides' true claims. |
| V11-06 | `debt.auditDocsLines` was saturated at exactly its ceiling, so recording a finding required deleting a line elsewhere. | DECIDED, reversible | Nine registers whose names carry their round moved to `docs/audit/archive/`, which the non-recursive ruler does not descend into; ceiling 2520 → 2050 against 1933 measured. Arrival there is declared in `tests/unit/audit-archive-is-declared.test.ts`, which holds the whole inventory and fails any live file still pointing at a pre-move path. |
