import { describe, expect, it } from "vitest";
import { shouldOcrFallback } from "@/lib/resume/text-quality";

/**
 * The OCR fallback exists for PDFs with no text layer. What actually detects
 * that case is length: a measured image-only PDF (a PNG put through cupsfilter)
 * extracts to `"\n\n-- 1 of 1 --\n\n"` — 16 characters.
 *
 * The quality test that used to sit next to it counted `[a-zA-Z0-9]`, so any
 * document written in Chinese, Japanese, Korean, Cyrillic, Arabic or Greek read
 * as garbage. Measured on a realistic 540-character Chinese resume: Latin ratio
 * 0.29 against a 0.3 threshold, i.e. it fired — and fired from a position so
 * close to the boundary that the outcome depended on how much English a resume
 * happened to contain. Every CJK user was therefore routed to a vision model
 * call for text the parser had already extracted correctly, which is the path
 * this app's parse-resume route has no duration budget for.
 */
const ENGLISH_RESUME =
  "JACKSON MICHAEL Senior Frontend Engineer Experience built React apps for five years at a fintech company " +
  "Skills TypeScript Next.js testing accessibility performance work Education Bachelor of Statistics";

const CHINESE_RESUME =
  "Jackson Michael 资深前端工程师，五年金融科技经验，负责核心交易界面的架构与性能优化。" +
  "精通 TypeScript、React、Next.js，主导无障碍与测试覆盖率改进，将首屏时间从 3.2 秒降至 1.1 秒。" +
  "统计学本科，持续学习分布式系统与数据可视化。负责核心交易界面的架构与性能优化，主导团队技术评审。" +
  "负责核心交易界面的架构与性能优化，主导团队技术评审与招聘面试。" +
  "负责核心交易界面的架构与性能优化，主导团队技术评审与招聘面试。" +
  "负责核心交易界面的架构与性能优化，主导团队技术评审与招聘面试。" +
  "负责核心交易界面的架构与性能优化，主导团队技术评审与招聘面试。";

describe("shouldOcrFallback", () => {
  it("accepts a Latin-script resume", () => {
    expect(shouldOcrFallback(ENGLISH_RESUME)).toBe(false);
  });

  it("accepts a Chinese resume — the case the old Latin-only ratio rejected", () => {
    // Guard the premise, or this test proves nothing: if the fixture ever stops
    // looking like the bug, the assertion below would pass for the wrong reason.
    const latinRatio = (CHINESE_RESUME.match(/[a-zA-Z0-9]/g) ?? []).length / CHINESE_RESUME.length;
    expect(CHINESE_RESUME.length).toBeGreaterThan(200);
    expect(latinRatio).toBeLessThan(0.3);
    expect(shouldOcrFallback(CHINESE_RESUME)).toBe(false);
  });

  it("routes a text-less PDF to OCR (measured: a scanned page yields only the page marker)", () => {
    expect(shouldOcrFallback("\n\n-- 1 of 1 --\n\n")).toBe(true);
  });

  it("routes empty and whitespace-only extraction to OCR", () => {
    expect(shouldOcrFallback("")).toBe(true);
    expect(shouldOcrFallback("   \n\t  \n   ".repeat(20))).toBe(true);
  });

  it("routes a too-short extraction to OCR whatever its script", () => {
    expect(shouldOcrFallback("张三 前端工程师")).toBe(true);
    expect(shouldOcrFallback("Jane Doe, engineer")).toBe(true);
  });

  it("accepts other non-Latin scripts", () => {
    const cyrillic = "Джаксон Майкл старший фронтенд-инженер, пять лет опыта в финтехе, TypeScript React Next.js, доступность и производительность интерфейсов, статистика.".repeat(3);
    expect(shouldOcrFallback(cyrillic)).toBe(false);
  });

  it("treats a page-marker tail as content, not as the whole document", () => {
    // pdf-parse appends `-- N of M --` per page; a long marker run must not by
    // itself look like a usable resume.
    expect(shouldOcrFallback("-- 1 of 200 --".repeat(10))).toBe(true);
  });
});
