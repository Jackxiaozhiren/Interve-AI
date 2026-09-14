import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SiteHeader } from "@/app/components/layout/SiteHeader";
import { SiteFooter } from "@/app/components/layout/SiteFooter";
import { SubSidebar } from "@/app/components/layout/SubSidebar";
import "@/app/globals.css";

// Inter via next/font (same family already first in tailwind font-sans stack — visuals unchanged)
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Source: TailAdmin + next-shadcn-dashboard shell reference (sticky topbar + sidebar + max-w-6xl content)
export const metadata: Metadata = {
  title: "DSA · Evidence before claim",
  description: "Ask. Analyze. Verify. Reproduce. Evidence-linked data analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-zinc-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
          >
            Skip to content
          </a>
          <SiteHeader />
          <div className="mx-auto flex w-full max-w-6xl items-start gap-6 px-4 py-8 sm:px-6">
            <SubSidebar />
            <main id="main-content" className="min-w-0 flex-1">
              {children}
            </main>
          </div>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
