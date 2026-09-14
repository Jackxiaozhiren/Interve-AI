import type { NextConfig } from "next";

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  transpilePackages: ["recharts"],
  // KEEP: dsa-web is intentionally NOT merged into npm workspaces (see README).
  // Repo root has its own package-lock.json, so Next infers the workspace root
  // as the repo root and mis-resolves `@/*` — pinning turbopack.root fixes it.
  // Verified 2026-09-14: removing this breaks `npm --prefix apps/dsa-web run build`.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next inline scripts/styles + framer-motion; API + fonts.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              `connect-src 'self' ${API_ORIGIN} https://fonts.googleapis.com https://fonts.gstatic.com`,
              "img-src 'self' data: blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
