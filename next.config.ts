import type { NextConfig } from "next";

// Phase D2 (2026-09-17) recorded that @ducanh2912/next-pwa emits no service
// worker under Turbopack; re-verified before removing it: `withPWA` only hooks
// config.webpack (its dist composes user webpack at index.js:720 and needs
// workbox-webpack-plugin), every build path is plain `next build`
// (package.json, Dockerfile:30-32, ci.yml:26), and the current build contains
// zero `__PWA_SW__` defines, no sw.js and no workbox chunk. The old `webpack:`
// aliases (sharp$, onnxruntime-node$) died with that path, so they are gone
// rather than kept as decoration — see git blame for the @huggingface worker
// they were meant for (src/workers/whisper.worker.ts).
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
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
