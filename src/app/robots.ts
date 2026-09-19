// Phase F4: crawl policy (practice-only launch surface).
//
// Public: marketing + auth entry points. Everything else (dashboards,
// interview rooms, all /api/*) is session-gated AND disallowed here.
// No sitemap line yet: sitemap.xml needs absolute URLs and no prod domain
// is configured — set NEXT_PUBLIC_SITE_URL, then add src/app/sitemap.ts.
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
