import { Language } from './i18n';

/**
 * Formats a date string or Date object into JJ/MM/AAAA.
 * Systematically handles translations depending on the current user's language setting.
 */
export function formatDate(date: string | Date | null | undefined, language: Language = 'fr'): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Invalid date fallback
  if (isNaN(d.getTime())) return '';
  
  const locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}
