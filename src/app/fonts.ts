import localFont from "next/font/local";

/**
 * S0 of the design-system convergence (report §12.9.6, option ①).
 *
 * The palette has referenced `var(--font-inter)` since v1.0 (globals.css:16, :18
 * and :498) but nothing ever defined it: no `next/font`, no `@font-face`, no
 * bundled file. Every page therefore rendered the OS stack — SF Pro on macOS,
 * Segoe UI on Windows — while the design system's own header claimed an
 * Apple / Stripe / Linear benchmark. The reference is kept; this module is the
 * definition it was always pointing at.
 *
 * Self-hosted rather than pulled from a remote font provider for two enforced
 * reasons, not one: the CSP is `font-src 'self'` (src/proxy.ts) and the privacy
 * page tells candidates that no font request leaves for a third party. A remote
 * provider would have to be added to both.
 *
 * One variable file covers the weights the token layer actually asks for
 * (`--font-weight-*`: 400 body, 500 label, 600 heading); the latin subset keeps
 * it at ~48KB, and CJK falls through to the platform faces named in
 * `--font-sans` instead of being bundled.
 */
export const inter = localFont({
  src: "./fonts/InterVariable-latin.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
  style: "normal",
  preload: true,
  // Matches the order in globals.css so the metrics-adjusted fallback and the
  // fallback chain after a failed load describe the same stack.
  fallback: [
    "Inter",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    "sans-serif",
  ],
  adjustFontFallback: "Arial",
});
