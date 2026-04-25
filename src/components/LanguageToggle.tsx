"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Translate } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { lang, toggleLang } = useLanguage();

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={toggleLang}
      className="rounded-full bg-white/50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-all flex items-center gap-2"
    >
      <Translate className="w-4 h-4" />
      <span className="font-medium text-xs tracking-wider uppercase">{lang === 'en' ? 'EN' : '中'}</span>
    </Button>
  );
}
