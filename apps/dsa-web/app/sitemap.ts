import type { MetadataRoute } from "next";

const STATIC_ROUTES = [
  "",
  "/analysis",
  "/benchmarks",
  "/datasets",
  "/evaluations",
  "/failures",
  "/mcp",
  "/reports",
  "/research",
  "/runs",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const now = new Date();
  return STATIC_ROUTES.map((r) => ({
    url: `${base}${r || "/"}`,
    lastModified: now,
  }));
}
