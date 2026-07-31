import Papa from 'papaparse';
import type { Guest, Rsvp } from '@/lib/types/doc';

export interface CsvColumnMap {
  name: number;
  group: number | null;
  email: number | null;
  dietary: number | null;
  rsvp: number | null;
}

export interface CsvRowError {
  row: number;
  reason: 'noName' | 'badRsvp' | 'empty';
}

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

/**
 * Splits a raw CSV file into its header row and data rows. `skipEmptyLines`
 * drops genuinely blank lines (a trailing newline at end-of-file, most
 * commonly) so callers never see a phantom last row of `['']`. An empty
 * file parses to zero data rows — Papa still returns `data: []` for `''`
 * regardless of this option, so there is no header row to split off either.
 */
export function parseCsv(text: string): CsvParseResult {
  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: true });
  if (data.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = data;
  return { headers, rows };
}

// Column-header keywords the guesser matches against, after normalising
// both the header and these keywords to lower-case ASCII with punctuation
// stripped (see `normalizeHeader`) — English and Spanish side by side per
// field, so "e-mail"/"correo" and "GRUPO"/"tag" all resolve the same way.
const FIELD_KEYWORDS: { field: 'name' | 'group' | 'email' | 'dietary' | 'rsvp'; keywords: string[] }[] = [
  // name is matched first: `guessColumns` must always resolve a name
  // column (falling back to column 0 otherwise), and resolving it before
  // group/email/etc. means a header that could plausibly match more than
  // one field (unlikely with this keyword set, but not impossible) prefers
  // "this is who the row is about" over any other reading.
  { field: 'name', keywords: ['name', 'nombre', 'guest', 'invitado'] },
  { field: 'group', keywords: ['group', 'grupo', 'tag'] },
  { field: 'email', keywords: ['email', 'correo'] },
  { field: 'dietary', keywords: ['dietary', 'dieta', 'alergia'] },
  { field: 'rsvp', keywords: ['rsvp', 'confirmado'] },
];

/**
 * Lower-cases, strips accents (NFD decomposition + combining-mark removal,
 * so "María"/"Maria" and "GRUPO"/"Grupo" compare equal) and drops every
 * character that isn't a-z0-9 (so "e-mail" and "E-Mail" both normalise to
 * "email", matching the plain "email" keyword by substring).
 */
function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Guesses which CSV column holds which guest field from the header row
 * alone — no reading of the data rows. Each header can be claimed by at
 * most one field (first match wins, in `FIELD_KEYWORDS` order), and a
 * header already claimed by an earlier field is skipped for later ones.
 * `name` always resolves to a real column index — a spreadsheet with no
 * header that looks like a name still needs *some* column read as the
 * guest's name (falling back to column 0) so `buildGuests` can report
 * genuinely-blank name cells as `noName` errors, rather than the map
 * itself pointing nowhere and every row losing its name silently.
 */
export function guessColumns(headers: string[]): CsvColumnMap {
  const normalized = headers.map(normalizeHeader);
  const claimed = new Set<number>();

  function findColumn(keywords: string[]): number | null {
    const index = normalized.findIndex((h, i) => !claimed.has(i) && keywords.some((k) => h.includes(k)));
    if (index === -1) return null;
    claimed.add(index);
    return index;
  }

  const found: Partial<Record<'name' | 'group' | 'email' | 'dietary' | 'rsvp', number | null>> = {};
  for (const { field, keywords } of FIELD_KEYWORDS) {
    found[field] = findColumn(keywords);
  }

  let name = found.name ?? null;
  if (name === null) {
    name = 0;
    claimed.add(0);
  }

  return { name, group: found.group ?? null, email: found.email ?? null, dietary: found.dietary ?? null, rsvp: found.rsvp ?? null };
}

/** Trims a cell's text; blank (or missing, for a ragged row) becomes `null` rather than `''`. */
function cellOrNull(row: string[], column: number | null): string | null {
  if (column === null) return null;
  const text = (row[column] ?? '').trim();
  return text === '' ? null : text;
}

const RECOGNISED_RSVP = new Set<string>(['yes', 'no', 'pending']);

function isRsvp(value: string): value is Rsvp {
  return RECOGNISED_RSVP.has(value);
}

let importCounter = 0;

/** Mirrors `lib/doc/factory.ts`'s `nextId`: a millisecond timestamp plus a per-call counter, so importing hundreds of rows inside one synchronous batch never collides even when several land in the same millisecond. */
function nextGuestId(): string {
  importCounter += 1;
  return `guest-${Date.now().toString(36)}-${importCounter.toString(36)}`;
}

/**
 * Builds a `Guest` per data row, keyed by `map`. Every row produces either a
 * guest, an error, or both — never neither, so a malformed row is always
 * visible in the dialog's error list rather than quietly vanishing:
 *
 * - A row with every cell blank reports `empty` and is not imported.
 * - A row whose name cell is blank reports `noName` and is not imported.
 * - A row whose RSVP cell is present but not `yes`/`no`/`pending` (case-
 *   insensitively) reports `badRsvp` *and* is still imported, RSVP set to
 *   `pending` — a typo in one column shouldn't cost the whole row.
 *
 * `row` numbers in the returned errors are file line numbers (the data
 * row's own 0-based index + 2, to account for the header row and for the
 * file's first line being line 1, not 0).
 */
export function buildGuests(rows: string[][], map: CsvColumnMap): { guests: Guest[]; errors: CsvRowError[] } {
  const guests: Guest[] = [];
  const errors: CsvRowError[] = [];

  rows.forEach((row, index) => {
    const fileLine = index + 2;

    if (row.every((cell) => cell.trim() === '')) {
      errors.push({ row: fileLine, reason: 'empty' });
      return;
    }

    const name = (row[map.name] ?? '').trim();
    if (name === '') {
      errors.push({ row: fileLine, reason: 'noName' });
      return;
    }

    const group = cellOrNull(row, map.group);
    const dietaryRaw = cellOrNull(row, map.dietary);
    const dietary = dietaryRaw === null ? null : dietaryRaw.toUpperCase();

    const rsvpRaw = (map.rsvp === null ? '' : (row[map.rsvp] ?? '')).trim().toLowerCase();
    let rsvp: Rsvp = 'pending';
    if (rsvpRaw !== '') {
      if (isRsvp(rsvpRaw)) {
        rsvp = rsvpRaw;
      } else {
        errors.push({ row: fileLine, reason: 'badRsvp' });
      }
    }

    guests.push({ id: nextGuestId(), name, group, dietary, rsvp, plusOneOf: null });
  });

  return { guests, errors };
}
