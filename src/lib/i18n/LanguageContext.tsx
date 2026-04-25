"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { dictionaries, Language, Dictionary } from "./dictionaries";

interface LanguageContextType {
  lang: Language;
  t: Dictionary;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLang = localStorage.getItem("interve-lang") as Language;
    if (savedLang && (savedLang === "en" || savedLang === "zh")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(savedLang);
    } else {
      // Auto-detect based on browser
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith("zh")) {
         
        setLangState("zh");
      }
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("interve-lang", newLang);
  };

  const toggleLang = () => {
    setLang(lang === "en" ? "zh" : "en");
  };

  const value = {
    lang,
    t: dictionaries[lang],
    setLang,
    toggleLang,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
