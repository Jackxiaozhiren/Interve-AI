import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // Phase D2 verdict (2026-09-17): runtimeCaching/offline work was reverted —
  // production builds run on Turbopack, under which this webpack-based plugin
  // emits NO service worker at all (verified: no public/sw.js across builds,
  // never tracked in git). Dead config pretends; see PERF_REPORT §5 for the
  // unblock conditions (webpack builds or a Turbopack-native SW pipeline).
});

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse'],
  images: {
    remotePatterns: [
      // OAuth avatars bridged into the app session (Google / GitHub).
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      // Mock-login avatar host (local dev login).
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
  webpack: (config) => {
    // Ignore node-specific modules when bundling for the browser
    // This is required for @huggingface/transformers to work properly in the browser
    config.resolve.alias = {
        ...config.resolve.alias,
        "sharp$": false,
        "onnxruntime-node$": false,
    }
    return config;
  },
  turbopack: {
    root: __dirname,
  },
};

export default withPWA(nextConfig);
