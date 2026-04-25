import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse'],
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
