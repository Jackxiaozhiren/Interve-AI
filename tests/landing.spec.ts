// Phase 2: local landing smoke (replaces the create-playwright scaffold that
// tested https://playwright.dev/ — zero product value and network-dependent).
import { test, expect } from '@playwright/test';
import { BASE_URL } from '../playwright.config';
import { loginAs } from './helpers';

test.describe('Landing', () => {
  test('should render hero and primary CTAs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: /免费开始|Sign up/i }).first()).toBeVisible();
  });

  test('login page should render the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('a Google press opens the provider door on the page that can receive it', async ({ page }) => {
    // With this client's `implicit` flowType, `signInWithOAuth` builds the provider
    // URL locally and gives it straight to `window.location.assign` — the press's
    // first network act is the navigation itself, and once it starts the document
    // is gone, so what is observable (and what has no other witness) is the URL
    // the press produced. It is the whole of `src/lib/auth.ts`'s contract: the
    // right provider, and a `redirect_to` on a page `src/proxy.ts` does not guard,
    // because a 307 in front of the fragment is how a sign-in loses its session.
    const navigations: string[] = [];
    await page.route(/\/auth\/v1\/authorize/, async (route) => {
      navigations.push(route.request().url());
      await route.abort();
    });

    await page.goto('/login');
    const google = page.getByRole('button', { name: 'Google' });
    await expect(google).toBeEnabled();
    await google.click();

    await expect.poll(() => navigations.length, { timeout: 5000 }).toBe(1);
    const url = new URL(navigations[0]);
    expect(url.pathname).toBe('/auth/v1/authorize');
    expect(url.searchParams.get('provider')).toBe('google');
    // Decoded, because gotrue receives it percent-encoded and appends its own
    // fragment to it; what has to match is the page, not the spelling.
    expect(url.searchParams.get('redirect_to')).toBe(`${BASE_URL}/login`);
  });

  test('a provider handoff that came back failed says so, and leaves the address bar', async ({ page }) => {
    // The state a visitor is left in when they cancel at Google, or gotrue
    // refuses the exchange: /login again, with the failure only in the fragment.
    // Before this shipped the page rendered as if nothing had happened and the
    // `#error=…` survived every reload, so the only available action was to press
    // the button again — which is what "several clicks" looked like from the
    // other side. Nothing here mocks a provider: the URL is the whole input.
    await page.goto('/login#error=access_denied&error_description=User+cancelled+the+flow');

    const notice = page.locator('[role="status"]').filter({ hasText: /Provider sign-in did not complete/ });
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText('(access_denied)');
    // gotrue's and the provider's wording stays out of this app's sentence.
    await expect(notice).not.toContainText(/cancelled the flow/i);
    // And the fragment is gone, so a reload does not re-report a handoff that
    // already happened.
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('');
  });

  test('a signed-in visit never leaves the site, whatever ?from= claims', async ({ page }) => {
    // Measured before this shipped: with a session in place,
    // /login?from=https://evil.example completed the flow and then navigated the
    // visitor off-site — the run ended on chrome-error://chromewebdata/, i.e. the
    // browser had left this origin. A protocol-relative //evil.example was its
    // quieter half: nothing navigated, so a signed-in visitor stayed on the door
    // that exists to send them in. Both are asserted as behaviour, because the
    // unit arms only prove the decision function is right about a string.
    await loginAs(page);

    for (const hostile of ['https://evil.example/y', '//evil.example/x', '/%5C%5Cevil.example']) {
      await page.goto(`/login?from=${hostile}`);
      await expect.poll(() => page.url(), { timeout: 10000, message: `from=${hostile}` }).toMatch(
        new RegExp(`^${BASE_URL}/dashboard`)
      );
    }

    // And the honest case still lands where the guard bounced the visitor, so the
    // fix has not flattened the feature it guards.
    await page.goto('/login?from=/practice');
    await expect.poll(() => page.url(), { timeout: 10000 }).toMatch(new RegExp(`^${BASE_URL}/practice`));
  });

  test('the signup door sends an already-signed-in visitor in, like the login door does', async ({ page }) => {
    // /login has redirected an authenticated visitor onward since the first
    // version of the app; /signup never did, so the page a signed-in account can
    // reach from the footer offers them a *new* demo identity and, on submit,
    // replaces the account the UI shows them with a random one. Same door, same
    // rule: if you are already in, go in.
    await loginAs(page);
    await page.goto('/signup');
    await expect.poll(() => page.url(), { timeout: 10000 }).toMatch(new RegExp(`^${BASE_URL}/dashboard`));
  });

  test('a failed signup press says so instead of sitting silent', async ({ page }) => {
    // `login()` POSTs /api/session, and its rejection used to be caught and
    // written to the console only: the visitor pressed Sign Up, and the page did
    // not move, change, or explain. Same defect class as the provider button on
    // this page, which reported nothing either.
    let attempted = 0;
    await page.route('**/api/session', async (route) => {
      attempted += 1;
      await route.abort();
    });
    await page.goto('/signup');
    // Both fields: `Full Name` is `required`, so leaving it out stops the form at
    // native validation and the handler never runs — which reads exactly like the
    // silence this arm is meant to detect. First run of this test was red for that
    // reason alone, with no request fired at all.
    await page.getByLabel('Full Name').fill('New Candidate');
    await page.getByLabel('Email address').fill('new.candidate@example.com');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // The press has to have reached the server for the rest of this to mean
    // anything: without this, a form that never submits would "pass" by showing
    // nothing and going nowhere.
    await expect.poll(() => attempted, { timeout: 5000 }).toBe(1);
    const notice = page.locator('[role="alert"], [role="status"]').filter({ hasText: /sign up failed/i });
    await expect.poll(async () => page.url(), { timeout: 5000 }).toMatch(/\/signup/);
    await expect(notice).toBeVisible();
  });

  test('the data strip admits it cannot know anything about a signed-out visitor', async ({ page }) => {
    // The numbers here come from the account's rows, and an anonymous read
    // answers `[]` — which used to render as "本地模拟面试 0" under a hint saying
    // the data was local and never uploaded. Both halves were false
    // (tests/unit/no-unverifiable-claims.test.ts owns the reason), so assert what
    // a stranger is actually shown, in the rendered DOM rather than the source.
    await page.goto('/');
    const strip = page.locator('section[aria-label="数据概览"]');
    await expect(strip).toBeVisible();

    const text = await strip.innerText();
    expect(text, `rendered: ${text}`).toMatch(/登录后查看/);
    // No digits: the count and the rate are placeholders, not a computed zero.
    expect(text, `rendered: ${text}`).not.toMatch(/\d/);
    expect(text, `rendered: ${text}`).not.toMatch(/IndexedDB|localStorage|Dexie|无需上传|本地模拟面试/);
  });
});
