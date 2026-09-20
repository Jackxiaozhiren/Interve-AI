// Phase 13: authenticated performance probe (keyless, local prod server).
// Measures LCP/CLS/TBT/transfer/heap on guarded pages Lighthouse cannot
// reach without a login flow. Run: `node scripts/perf-probe.mjs [baseURL]`.
import { chromium } from "playwright";

const ARGS = process.argv.slice(2);
// NOTE: flags must be filtered out of the positional BASE — `npm run
// perf:assert` passes `--assert` as argv[2], which is not a URL.
const ASSERT = ARGS.includes("--assert");
const BASE = ARGS.find((a) => !a.startsWith("-")) || "http://localhost:3100";

const now = Date.now();
const uid = `00000000-0000-4000-8000-${String(now).slice(-12).padStart(12, "0")}`;

async function login(context) {
  const res = await context.request.post(`${BASE}/api/session`, {
    data: { id: uid, email: "perf@local.test", username: "perf" },
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  return uid;
}

async function seedLocal(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("interve_has_seen_onboarding", "true");
  });
}

// H1.4: mobile 4x 节流常态化 — `node scripts/perf-probe.mjs [baseURL] --mobile`
// 4x CPU throttle (CDP Emulation.setCPUThrottlingRate) + 390x844 viewport.
// 默认桌面档（行为不变）；--mobile 只影响本探针，不碰业务代码。
const MOBILE = process.argv.includes("--mobile");

async function measure(browser, path) {
  const context = await browser.newContext(
    MOBILE ? { viewport: { width: 390, height: 844 }, isMobile: true } : {}
  );
  await login(context);
  const page = await context.newPage();
  if (MOBILE) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  await seedLocal(page);
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  // Let LCP/CLS settle; animations keep running but entries stabilize.
  await page.waitForTimeout(6000);
  const metrics = await page.evaluate(() => {
    const paints = performance.getEntriesByType("paint").reduce((a, p) => {
      a[p.name] = Math.round(p.startTime);
      return a;
    }, {});
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
    const lcp = lcpEntries.length > 0 ? Math.round(lcpEntries[lcpEntries.length - 1].startTime) : null;
    let cls = 0;
    for (const e of performance.getEntriesByType("layout-shift")) {
      if (!e.hadRecentInput) cls += e.value;
    }
    let tbt = 0;
    for (const e of performance.getEntriesByType("longtask")) {
      tbt += Math.max(0, e.duration - 50);
    }
    const nav = performance.getEntriesByType("navigation")[0];
    let transfer = 0;
    for (const r of performance.getEntriesByType("resource")) transfer += r.transferSize || 0;
    const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    return {
      paints, lcp, cls: Math.round(cls * 1000) / 1000, tbt: Math.round(tbt),
      transferKB: Math.round(((nav ? nav.transferSize : 0) + transfer) / 1024),
      heapMB: heap,
    };
  });
  await context.close();
  return metrics;
}

const browser = await chromium.launch();
// Transfer budgets (KB, desktop prod). Policy: ~10% headroom over the
// 2026-09-19 measured baselines (setup 391 / dashboard 720 / interview 1033 /
// practice 474). The 1032KB interview line (PERF_REPORT) lives inside the
// 1150 budget — headroom absorbs font/CDN/headless variance, the budget
// catches real bloat (e.g. an ungated heavy import). Tighten only from fresh
// baselines, never blind. Enforced with --assert (CI); plain runs print only.
const TRANSFER_BUDGETS = {
  "/setup": 450,
  "/dashboard": 800,
  "/interview?id=perf-probe&testMode=true": 1150,
  "/practice": 550,
};
try {
  for (const path of Object.keys(TRANSFER_BUDGETS)) {
    try {
      const m = await measure(browser, path);
      console.log(path, JSON.stringify(m));
      if (ASSERT && m.transferKB > TRANSFER_BUDGETS[path]) {
        console.error(`TRANSFER-BUDGET: ${path} ${m.transferKB}KB > ${TRANSFER_BUDGETS[path]}KB`);
        process.exitCode = 1;
      }
    } catch (e) {
      console.log(path, JSON.stringify({ error: String(e).slice(0, 160) }));
      if (ASSERT) {
        console.error(`TRANSFER-BUDGET: ${path} probe failed`);
        process.exitCode = 1;
      }
    }
  }
} finally {
  await browser.close();
}
