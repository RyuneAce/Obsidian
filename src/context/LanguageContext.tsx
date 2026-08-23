import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'hi' | 'en' | 'bi';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (hi: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'bi',
  setLang: () => {},
  t: (hi, en) => `${hi} / ${en}`,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('app_language') as Lang) || 'bi';
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('app_language', newLang);
  };

  const t = (hi: string, en: string): string => {
    if (lang === 'hi') return hi;
    if (lang === 'en') return en;
    return `${hi} / ${en}`;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
