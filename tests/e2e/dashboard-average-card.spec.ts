/**
 * The readiness card, rendered with the state that used to be wrong.
 *
 * `tests/helpers.ts` already carries an in-memory PostgREST stand-in (`createPostgrestStub`),
 * keyed on the request's pathname rather than its host, so rows posted from the
 * page and rows the app lists land in one store. That makes it possible to put a
 * user in the exact state the headline used to misread: two completed sessions,
 * only one of which has a renderable evaluation.
 *
 * Before this slice the card averaged `sessionScore(s) ?? 0` over both and read
 * 40/100 under the label "Composite". The honest reading is 80 — the scored
 * session's own number — with the denominator next to it, because the second
 * session was never scored rather than scored zero.
 */
import { test, expect } from "@playwright/test";
import { loginAs, seedSupabaseSession, createPostgrestStub } from "../helpers";

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse("2026-09-01T12:00:00Z");

const scoredSession = {
  title: "Behavioral warm-up",
  status: "completed",
  interviewType: "behavioral",
  createdAt: new Date(NOW - 2 * DAY).toISOString(),
  updatedAt: new Date(NOW - 2 * DAY).toISOString(),
  evaluationV2: {
    version: "2.0",
    rubricId: "behavioral-v1",
    readiness: "developing",
    readinessRationale: "Two answers carried evidence.",
    dimensions: [
      { id: "clarity", score: 4, evidence: ["I cut p95 by 30%"], rationale: "r", confidence: "high", improvement: "i" },
    ],
    strengths: ["structure"],
    weaknesses: ["brevity"],
    nextDrills: ["drill"],
    qaReview: [],
  },
};

// Completed, and nothing the adapter can turn into a score: no evaluationV2, no
// radar axes. It belongs in the denominator and not in the average.
const unscoredSession = {
  title: "Session without an evaluation",
  status: "completed",
  interviewType: "system-design",
  createdAt: new Date(NOW - DAY).toISOString(),
  updatedAt: new Date(NOW - DAY).toISOString(),
  hireVerdict: "leaning_hire",
};

/**
 * Post through the browser so the shared stub stores the row. The stub keys on the
 * path segment, so the host here only has to be a URL the route matches — and the
 * rows must carry `user_id`, because the page asks for
 * `?select=*&user_id=eq.<uid>`, which is exactly the ownership predicate the
 * dashboard depends on.
 */
async function seedViaAppNetwork(page: import("@playwright/test").Page, uid: string, rows: Record<string, unknown>[]) {
  await page.evaluate(async ({ payloads, owner }) => {
    for (const payload of payloads) {
      await fetch("https://placeholder.supabase.co/rest/v1/interviews", {
        method: "POST",
        headers: { "content-type": "application/json", prefer: "return=representation" },
        body: JSON.stringify({ ...payload, user_id: owner }),
      });
    }
  }, { payloads: rows, owner: uid });
}

async function openDashboard(page: import("@playwright/test").Page, rows: Record<string, unknown>[]) {
  await page.route("**/rest/v1/*", createPostgrestStub());
  const uid = await seedSupabaseSession(page);
  await loginAs(page);
  await seedViaAppNetwork(page, uid, rows);
  await page.goto("/dashboard");
  await expect(page.getByText("Average Score", { exact: true })).toBeVisible({ timeout: 20_000 });
}

/**
 * The card's big number. Two cards on the page share the display class, so this
 * walks from the heading to its sibling instead of matching on style — a class
 * selector here would silently assert on the session-count card.
 */
function averageScoreNumber(page: import("@playwright/test").Page) {
  return page
    .getByText("Average Score", { exact: true })
    .locator("xpath=ancestor::div[2]/following-sibling::div[1]");
}

test.describe("the readiness headline names its denominator", () => {
  test("averages the scored session only, and says 1/2 evaluated", async ({ page }) => {
    await openDashboard(page, [scoredSession, unscoredSession]);

    await expect(page.getByText("1/2 evaluated")).toBeVisible();
    // The big number is AnimatedCounter's container; it counts up, so match the
    // settled value with a regex rather than exact text.
    const value = averageScoreNumber(page);
    await expect(value).toHaveText(/80/, { timeout: 10_000 });
    await expect(value).not.toHaveText(/40/);
  });

  test("shows no number at all when nothing has been evaluated", async ({ page }) => {
    await openDashboard(page, [unscoredSession]);

    await expect(page.getByText("0/1 evaluated")).toBeVisible();
    const value = averageScoreNumber(page);
    await expect(value).toHaveText("—");
  });
});
