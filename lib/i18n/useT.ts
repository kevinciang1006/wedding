'use client';

import { useUiStore } from '@/stores/uiStore';
import { en, type TranslationKey } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';

const DICTIONARIES = { en, es } as const;

export function useT(): (key: TranslationKey, vars?: Record<string, string | number>) => string {
  const language = useUiStore((s) => s.language);
  const dict = DICTIONARIES[language];
  return (key, vars) => {
    const template = dict[key];
    if (!vars) return template;
    return Object.entries(vars).reduce(
      (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
      String(template),
    );
  };
}
