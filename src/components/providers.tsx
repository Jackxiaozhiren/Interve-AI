"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";
import { useEffect } from "react";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { AuthProvider } from "@/context";
import { GlobalShortcutsProvider } from "@/components/global-shortcuts-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const isCalmMode = useAccessibilityStore((state) => state.isCalmMode);

  useEffect(() => {
    if (isCalmMode) {
      document.body.classList.add("calm-mode");
    } else {
      document.body.classList.remove("calm-mode");
    }
  }, [isCalmMode]);

  return (
    <NextThemesProvider attribute="class" defaultTheme="light" forcedTheme="light">
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider delay={150}>
            <GlobalShortcutsProvider />
            {children}
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </NextThemesProvider>
  );
}
