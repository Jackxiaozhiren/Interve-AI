// Phase F4: crawl policy (practice-only launch surface).
//
// Public: marketing + auth entry points. Everything else (dashboards,
// interview rooms, all /api/*) is session-gated AND disallowed here.
// No sitemap line yet: sitemap.xml needs absolute URLs. The app does deploy to
// production (https://interve-ai.vercel.app, verified live 2026-09-26), but
// NEXT_PUBLIC_SITE_URL is not set in the Vercel project, so there is still no
// base URL to emit — set it there, then add src/app/sitemap.ts.
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing", "/login", "/signup"],
        disallow: ["/api/", "/dashboard", "/interview", "/practice", "/chat", "/recruiter", "/setup"],
      },
    ],
  };
}
