# RISK_REGISTER — living risk log

> Severity: Critical / High / Medium / Low. Status: open / mitigated /
> accepted / tracked. Updated per phase; newest entries first.

| ID | Risk | Severity | Status | Mitigation / evidence |
|---|---|---|---|---|
| R-251 | Legacy anon rows readable via direct anon key until Supabase Auth cutover | Critical | Open | 002 containment (`user_id IS NULL` scope); session-gated APIs; RLS contract tests. Needs staging project for live tests + cutover. |
| R-252 | LLM scores uncalibrated vs human raters | High | Partially mitigated | Evidence+anchors+confidence shipped (P4); eval harness + golden/injection/fairness suites built (P11, provisional bars); agreement/variance keyed runs + multi-rater labels still need funded keys. |
| R-253 | Prompt injection via resume/JD/transcript | High | Mitigated | Bounded inputs, Zod gates, output schemas, rate limits; injection eval suite tracked. |
| R-254 | Quota burn / API abuse | High | Mitigated | Auth + per-IP limits + byte caps on 17 routes; single-instance limiter (Upstash tracked). |
| R-255 | Emotion/personality inference resurfacing | High | Mitigated | Fake vision deleted; sentiment pipeline callerless+deprecated; prohibitions test locks 6 banned pairings. Residual: `analyze-chunk` endpoint exists (no callers). |
| R-256 | Employment-decision misuse of practice scores | High | Mitigated | Hire verdicts retired for new sessions; readiness + disclaimer; legacy rows badged. No employer adjudication surface. |
| R-257 | PII in logs / third-party retention | Medium | Accepted | PII-free log envelope enforced; provider-side retention governed by deployer DPA (documented, not controlled here). |
| R-258 | Triple mic streams (cost/echo/permission UX) | Medium | Accepted | AEC constraints + guards; single-stream refactor queued behind real-device CI. |
| R-259 | No server-side retention purge yet | Medium | Open | Local 30-day expiry shipped; scheduled DB purge tracked. |
| R-260 | Interview prompt U+FFFD corruption | Medium | Accepted | Byte-preserved + locked by test; measured repair tracked. |
| R-261 | Full-matrix e2e + keyed AI e2e absent locally | Medium | Open | Chrome project green; matrix + keyed lanes are CI work with funded keys. |
| R-262 | Demo-grade identity (any email logs in) | Medium | Accepted | Sessions unforgeable (HMAC); real credential verification = Auth cutover (same project as R-251). |

Historic (closed): P0 fake vision persisted as scores (P3); open RLS `USING(true)` (P2 transitional); 16/16 unauthenticated AI routes (P2); `proxy` default-export inert guard (P2); migration UUID↔BIGSERIAL drift (P2 additive fix).
