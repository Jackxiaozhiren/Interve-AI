import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/**",
      "refactor.js",
      "eslint-errors*.json",
      "eslint-errors*.txt",
      "eslint-*.txt",
      "eslint-*.json",
      "lint_*.txt",
      "lint-*.txt"
    ]
  }
]);

export default eslintConfig;
