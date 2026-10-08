// The settings page used to render a stranger: "Alex" / "Chen" /
// alex.chen@example.com / a five-year React bio, a "Save Profile" button with no
// handler, two notification toggles on channels the app cannot use (no mailer,
// no SMS provider), and a "Change Password" form on an app that stores no
// credential. The previous version of this spec asserted exactly those elements,
// which is how invented UI survives: the test certifies the fiction. Every
// assertion below is about what the page can actually show or do, and the
// identity case is two-sided — a different session must produce a different
// value, so a hard-coded string cannot pass.
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

async function openSettings(page: Page, email = "e2e@example.com"): Promise<void> {
  await loginAs(page, email);
  await page.goto("/dashboard/settings");
  await page.waitForLoadState("networkidle");
}

test.describe("Settings page reports real capability", () => {
  test("identity fields come from the session, not a constant", async ({ page }) => {
    await openSettings(page, "e2e@example.com");
    const emailField = page.locator("#identityEmail");
    await expect(emailField).toBeVisible();
    await expect(emailField).toHaveValue("e2e@example.com");
    await expect(emailField).toHaveAttribute("readonly");
    await expect(page.locator("#identityUsername")).toHaveValue("e2e");

    // Second, different identity in a fresh session: proves the card renders the
    // logged-in user rather than a placeholder that happens to look like one.
    await page.context().clearCookies();
    await openSettings(page, "rin.example@example.com");
    await expect(page.locator("#identityEmail")).toHaveValue("rin.example@example.com");
    await expect(page.locator("#identityUsername")).toHaveValue("rin.example");
  });

  test("the invented profile and its dead save button are gone", async ({ page }) => {
    await openSettings(page);
    await expect(page.locator("#firstName, #lastName, #bio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save Profile/i })).toHaveCount(0);
    const main = page.locator("main");
    await expect(main).not.toContainText("alex.chen@example.com");
    await expect(main).not.toContainText("Software Engineer with 5+ years");
  });

  test("notifications states that nothing is sent instead of offering switches", async ({ page }) => {
    await openSettings(page);
    await expect(page.getByText("Nothing is sent yet.")).toBeVisible();
    await expect(page.getByText(/no email sender and no SMS provider/)).toBeVisible();
    // The two `defaultChecked` checkboxes with no onChange are gone, and so is
    // the "30 minutes before" promise that belonged to neither of them.
    await expect(page.locator("#emailNotifications, #smsReminders")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/30 minutes before/);
  });

  test("password is declared unavailable, so there is no form to submit", async ({ page }) => {
    await openSettings(page);
    await expect(page.getByText(/There is no password to change yet/)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Update Password/i })).toHaveCount(0);
  });

  test("sign out ends this browser's session", async ({ page }) => {
    await openSettings(page);
    const signOut = page.getByRole("button", { name: "Sign out", exact: true });
    await expect(signOut).toBeVisible();
    await signOut.click();

    // dashboard-shell pushes /login once the client user is cleared.
    await expect(page).toHaveURL(/\/login/);

    // And the cookie is really gone: re-entering the route bounces back, which
    // fails if logout() only changed React state.
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the preference toggles that remain are the persisted ones", async ({ page }) => {
    // Deleting the fake controls must not delete the real ones, so assert the
    // real behaviour: calm mode flips and lands in the zustand persist store.
    // An `onClick` that only changed local state, or a decorative toggle written
    // back into this page, would not reach localStorage.
    await openSettings(page);
    const calm = page.getByRole("button", { name: /^Calm mode:/ });
    await expect(calm).toHaveAttribute("aria-pressed", "false");
    await calm.click();
    await expect(calm).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("accessibility-storage")))
      .toContain('"isCalmMode":true');
  });
});
