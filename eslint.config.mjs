import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // H1.5 a11y 闭环：next core-web-vitals 已带 6 条 jsx-a11y 规则，此处只加不减。
  // 三条零误报硬规则（本地 lint 0 errors 验证）：禁 autofocus、禁正 tabindex、
  // heading 必须有内容。F3 人工报告回来逐项再加。
  {
    rules: {
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/tabindex-no-positive": "error",
      "jsx-a11y/heading-has-content": "error",
    },
  },
  {
    ignores: [
      ".next/**",
      "**/.next/**",
      "out/**",
      "**/out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
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
