/**
 * The event date as a reader would write it, in the active language.
 * Shared by the top bar and the mobile viewer's header — the mobile bundle
 * must not have to import `TopBar` (and with it the export menu, jsPDF and
 * the PNG writer) to format one date.
 */
export function formatEventDate(language: 'en' | 'es', eventDate: string | null, fallback: string): string {
  if (!eventDate) return fallback;
  // Appending a local midnight time avoids `new Date('yyyy-mm-dd')` parsing
  // as UTC, which can print a day earlier than the stored date in any
  // timezone west of UTC — a wedding date is a calendar day, not an instant.
  const parsed = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en-US', { dateStyle: 'medium' }).format(parsed);
}
