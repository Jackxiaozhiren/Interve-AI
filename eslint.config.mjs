import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // H1.5 a11y 闭环：next core-web-vitals 已带 6 条 jsx-a11y 规则，此处只加不减。
  // 三条零误报硬规则（本地 lint 0 errors 验证）：禁 autofocus、禁正 tabindex、
  // heading 必须有内容。F3 人工报告回来逐项再加。
  // F1（第三段）：+4 条（36-error 全仓审计后收敛）——aria-role（chat sender
  // prop 改名 sender，8 处）、label 关联（settings htmlFor + Label 直通原语
  // 单点注释放行，调用处照查）、log 区 tabindex（LiveCaptions 单点注释）、
  // tablist 可聚焦。刻意未进：anchor-is-valid（landing/footer 14 处 href="#"
  // 占位链，需产品定真实去向或移除，见 PAIN 登记）、click-events-have-key-events
  // + no-static-element-interactions（setup:1092 在他人脏树，禁碰，等 owner 修）。
  {
    rules: {
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/tabindex-no-positive": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-noninteractive-tabindex": "error",
      "jsx-a11y/interactive-supports-focus": "error",
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
