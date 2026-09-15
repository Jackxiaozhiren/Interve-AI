// Phase 14: full user-journey e2e WITHOUT keys or database.
//
// Runs ONLY under `npm run test:e2e:mock` (E2E_MOCK=1), which starts the
// dev server with AI_MOCK=1 (deterministic canned AI) while this spec
// stubs the Supabase PostgREST surface in-memory. It proves the whole
// wiring chain: signup/login → setup → upload → JD → preflight →
// interview → answer → finish → analysis → replay → retry → compare →
// export → delete. It does NOT prove provider quality or real persistence
// (those need funded keys + staging — tracked).
import { test, expect, type Route } from '@playwright/test';

test.skip(!process.env.E2E_MOCK, 'needs E2E_MOCK=1 (mock AI server + stubbed DB)');

interface Row {
  id: number;
  [k: string]: unknown;
}

function createPostgrestStub() {
  const tables = new Map<string, Map<number, Row>>();
  let nextId = 1;
  const table = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };

  return async function handler(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const tableName = url.pathname.split('/').pop() ?? '';
    const method = req.method();
    const q = url.searchParams;

    if (tableName === 'telemetry' || tableName === 'achievements' || tableName === 'evaluations' || tableName === 'assessments' || tableName === 'orama_index') {
      if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    }

    if (tableName !== 'interviews' && tableName !== 'practice_sessions') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    const store = table(tableName);

    if (method === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>;
      const row = { ...body, id: nextId++ } as Row;
      store.set(row.id, row);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) });
    }
    if (method === 'PATCH' || method === 'PUT') {
      const idEq = q.get('id');
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      if (idEq?.startsWith('eq.')) {
        const id = Number(idEq.slice(3));
        const prev = store.get(id);
        if (prev) store.set(id, { ...prev, ...body });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (method === 'DELETE') {
      const idEq = q.get('id');
      if (idEq?.startsWith('eq.')) store.delete(Number(idEq.slice(3)));
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    // GET
    const idEq = q.get('id');
    if (idEq?.startsWith('eq.')) {
      const row = store.get(Number(idEq.slice(3)));
      if (!row) {
        return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'no rows' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) });
    }
    let rows = [...store.values()];
    for (const [k, v] of q.entries()) {
      if (k === 'select' || k === 'order') continue;
      if (v.startsWith('eq.')) rows = rows.filter((r) => String(r[k]) === v.slice(3));
    }
    const order = q.get('order');
    if (order) {
      const [field, dir] = order.split('.');
      rows.sort((a, b) => {
        const av = String(a[field] ?? '');
        const bv = String(b[field] ?? '');
        return dir === 'desc' ? (av < bv ? 1 : -1) : av < bv ? -1 : 1;
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  };
}

test.describe('Mock full journey (no keys, no DB)', () => {
  test.setTimeout(180000);

  test('signup → setup → interview → analysis → replay → retry → export → delete', async ({ page }) => {
    await page.route('https://placeholder.supabase.co/rest/v1/*', createPostgrestStub());

    // 1. Signup (mock auth accepts anything) → dashboard.
    // NOTE: signup does not auto-redirect (tracked UX debt) — navigate on.
    await page.goto('/signup');
    await page.getByLabel('Full Name').fill('Journey Tester');
    await page.getByLabel(/Email/i).fill('journey@example.com');
    await page.getByRole('button', { name: /Sign Up|Create|注册/i }).click();
    // Signup has no auto-redirect (tracked UX debt): wait for the session
    // to land before navigating, or the in-flight login POST gets aborted.
    await page.waitForFunction(() => !!localStorage.getItem('interveai_user'), null, { timeout: 30000 });
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // First-run onboarding tour blocks dashboard CTAs until dismissed.
    // Step through the real dismissal path (Next ×2 → Get Started), which
    // also covers the tour itself; absent on repeat visits (flag persisted).
    // Generous window: the tour fires 1s after hydration, and cold-compile
    // hydration alone can exceed 15s on a fresh dev server (a short window
    // here silently skips, leaving the overlay to block the Start click below).
    const tour = page.getByRole('dialog', { name: /Welcome to Interve AI|Mock Interviews|Analytics/ });
    if (await tour.isVisible({ timeout: 45000 }).catch(() => false)) {
      for (let i = 0; i < 4; i++) {
        const done = tour.getByRole('button', { name: 'Get Started' });
        if (await done.isVisible({ timeout: 2000 }).catch(() => false)) {
          await done.click();
          break;
        }
        await tour.getByRole('button', { name: 'Next' }).click();
      }
      await expect(tour).toBeHidden({ timeout: 10000 });
    }

    // 2. Setup selections.
    // Late-tour guard: if the overlay arrived after the window above (cold
    // dev compile), Escape-dismiss via the pinned WCAG path instead of
    // letting it block the Start click for the full test timeout.
    if (await tour.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(tour).toBeHidden({ timeout: 10000 });
    }
    const startLink = page.getByRole('link', { name: /New Mock Interview/i });
    const startBtn = page.getByRole('button', { name: /Start Your First Mock Interview/i });
    await expect(startLink.or(startBtn)).toBeVisible();
    if (await startLink.isVisible()) await startLink.click();
    else await startBtn.click();
    await expect(page).toHaveURL(/.*\/setup/);

    await page.getByText('Frontend Engineer').click();
    await page.getByText('Mid-Level').click();
    await page.getByRole('button', { name: /Next Step/i }).click();
    await page.getByText('General Tech').click();
    await page.getByRole('button', { name: /Next Step/i }).click();
    await page.getByText('Supportive Mentor').click();
    await page.getByRole('button', { name: /Next Step/i }).click();
    await page.getByText('Google Gemini (1.5 Pro)').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // 3. Upload resume (mock OCR returns canned text regardless of bytes).
    await page.locator('#resume-upload').setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock resume\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
    });
    await expect(page.getByText(/chars extracted/)).toBeVisible({ timeout: 30000 });

    // 4. Paste JD.
    await page.getByPlaceholder(/Paste job description/).fill('Senior Frontend Engineer. Must have React, TypeScript, and system design experience.');
    await page.getByRole('button', { name: /Next Step/i }).click();

    // 5. Start (hardware step) → interview room.
    const startSession = page.getByRole('button', { name: /Start Session|Start without Mic/i });
    await expect(startSession).toBeEnabled({ timeout: 30000 });
    await startSession.click();
    await expect(page).toHaveURL(/.*\/interview/, { timeout: 30000 });

    // 6. Preflight bypass → standby → enter.
    const bypass = page.getByRole('button', { name: /跳过语音测试/i });
    await expect(bypass).toBeVisible({ timeout: 15000 });
    await bypass.click();
    const enter = page.getByRole('button', { name: /开始面试|强制开始/i });
    await expect(enter).toBeEnabled({ timeout: 35000 });
    await enter.click();
    await expect(page.getByRole('button', { name: /结束面试/i })).toBeVisible({ timeout: 15000 });

    // 7. Answer a question via text (mock AI streams canned reply, no keys).
    // NOTE: scoped to the transcript log — the pinned-question header shows
    // the same canned mock line, so an unscoped getByText is ambiguous
    // (strict-mode violation), not a missing reply.
    const input = page.getByLabel(/输入您的回答/);
    await input.fill('I led a state-management migration with measured results.');
    await page.getByRole('button', { name: /发送消息/ }).click();
    await expect(page.getByRole('log').getByText(/Mock interviewer/)).toBeVisible({ timeout: 60000 });

    // 8. Finish → analysis report renders the V2 mock evaluation.
    await page.getByRole('button', { name: /结束面试/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard\/report\/\d+/, { timeout: 90000 });
    await expect(page.getByText(/Developing|Interview Ready|Needs Foundation|Strongly Prepared/)).toBeVisible({ timeout: 30000 });

    const reportId = page.url().match(/report\/(\d+)/)?.[1];
    expect(reportId).toBeTruthy();

    // 9. Replay renders transcript + dimensions.
    await page.goto(`/dashboard/replay/${reportId}`);
    await expect(page.getByRole('tab', { name: /Dimensions/i })).toBeVisible({ timeout: 30000 });
    await page.getByRole('tab', { name: /Dimensions/i }).click();
    await expect(page.getByText(/relevance/i)).toBeVisible();

    // 10. Retry drill → custom practice → mock-graded feedback + compare.
    const retryQ = 'What was the measurable impact?';
    await page.goto(`/practice?retry=${Buffer.from(retryQ).toString('base64url')}`);
    await expect(page.getByText('Retry drill')).toBeVisible({ timeout: 30000 });
    await page.getByPlaceholder(/Type your answer/).fill('We cut latency 40 percent over six weeks.');
    await page.getByRole('button', { name: /Submit for Feedback/i }).click();
    await expect(page.getByText(/Analysis Complete/)).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(/Your attempts on this question/)).toBeVisible();

    // 11. Export downloads JSON.
    await page.goto('/dashboard/privacy');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出我的全部数据/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/interve-ai-export-.*\.json/);

    // 12. Delete the session from Privacy Center.
    const rows = page.locator('li', { hasText: /Untitled Session|Interview/ });
    await expect(rows.first()).toBeVisible({ timeout: 30000 });
    await rows.first().getByRole('button', { name: /删除/ }).click();
    await page.getByRole('button', { name: /确认删除/ }).click();
    await expect(page.getByText(/已删除/)).toBeVisible({ timeout: 30000 });
  });
});
