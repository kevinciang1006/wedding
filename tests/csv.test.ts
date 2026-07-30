import { describe, expect, it } from 'vitest';
import { buildGuests, guessColumns, parseCsv } from '@/lib/io/csv';

const FILE = `Name,Group,Email,Dietary,RSVP
Ana Marín,Family — Marín,ana@example.com,GF,yes
Julio Marín,Family — Marín,,,yes
,Family — Marín,orphan@example.com,,yes
Pilar Ruiz,Family — Marín,pilar@example.com,VG,maybe
Ana Marín,Work — Ana,ana2@example.com,,no
`;

describe('parseCsv', () => {
  it('separates the header row from the data rows', () => {
    const { headers, rows } = parseCsv(FILE);
    expect(headers).toEqual(['Name', 'Group', 'Email', 'Dietary', 'RSVP']);
    expect(rows).toHaveLength(5);
  });

  it('returns no rows for an empty file', () => {
    expect(parseCsv('').rows).toEqual([]);
  });
});

describe('guessColumns', () => {
  it('matches headers case- and accent-insensitively', () => {
    expect(guessColumns(['name', 'GRUPO', 'e-mail', 'Dietary', 'rsvp'])).toEqual({
      name: 0, group: 1, email: 2, dietary: 3, rsvp: 4,
    });
  });

  it('leaves unmatched columns null but always resolves a name column', () => {
    const map = guessColumns(['Guest', 'Notes']);
    expect(map.name).toBe(0);
    expect(map.group).toBeNull();
  });
});

describe('buildGuests', () => {
  const { headers, rows } = parseCsv(FILE);
  const map = guessColumns(headers);

  it('imports every row that has a name', () => {
    expect(buildGuests(rows, map).guests).toHaveLength(4);
  });

  it('reports the nameless row by its file line number, not silently dropping it', () => {
    const { errors } = buildGuests(rows, map);
    expect(errors).toContainEqual({ row: 4, reason: 'noName' });
  });

  it('falls back to pending for an unrecognised rsvp value', () => {
    const pilar = buildGuests(rows, map).guests.find((g) => g.name === 'Pilar Ruiz');
    expect(pilar?.rsvp).toBe('pending');
  });

  it('keeps duplicate names as separate guests with distinct ids', () => {
    const anas = buildGuests(rows, map).guests.filter((g) => g.name === 'Ana Marín');
    expect(anas).toHaveLength(2);
    expect(anas[0].id).not.toBe(anas[1].id);
  });

  it('normalises the dietary code to upper case and nulls the blanks', () => {
    const guests = buildGuests(rows, map).guests;
    expect(guests[0].dietary).toBe('GF');
    expect(guests[1].dietary).toBeNull();
  });
});
