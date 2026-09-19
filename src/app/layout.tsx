import { Providers } from "@/components/providers";
import { SkipLink } from "@/components/layout/SkipLink";
import { Toaster } from "sonner";
import type { Metadata } from "next";
import "./globals.css";

// Phase 13: document title + description (Lighthouse document-title and
// meta-description checks; also the browser tab / share baseline).
// Phase F4: OG + twitter cards (no url/images — no prod domain configured;
// adding metadataBase/sitemap waits for NEXT_PUBLIC_SITE_URL, see robots.ts).
export const metadata: Metadata = {
  title: {
    default: "Interve AI — AI 面试训练平台",
    template: "%s · Interve AI",
  },
  description:
    "Evidence-grounded multimodal AI interview practice: adaptive mock interviews, rubric-based feedback, coding and system-design drills.",
  openGraph: {
    title: "Interve AI — AI 面试训练平台",
    description:
      "Evidence-grounded multimodal AI interview practice: adaptive mock interviews, rubric-based feedback, coding and system-design drills.",
    type: "website",
    locale: "zh_CN",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary",
    title: "Interve AI — AI 面试训练平台",
    description:
      "Evidence-grounded multimodal AI interview practice: adaptive mock interviews, rubric-based feedback, coding and system-design drills.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans tracking-tight">
        <SkipLink />
        <Providers>
          {/* tabIndex -1: skip-link focus target (not in tab order). */}
          <div id="main-content" tabIndex={-1} className="outline-none">{children}</div>
        </Providers>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(0, 0, 0, 0.04)',
              color: '#1D2129',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              borderRadius: '12px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 500,
            },
            className: 'glass-toast',
          }}
        />
      </body>
    </html>
  );
}
