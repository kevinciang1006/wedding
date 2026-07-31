import { describe, expect, it } from 'vitest';
import {
  UNGROUPED, dietaryGuestCount, distinctGroups, filterGuestIds, filterGuestIdsInGroup,
  groupBuckets, groupCounts, hasUngroupedGuest,
} from '@/lib/doc/guestFilter';
import type { GuestFilter } from '@/lib/doc/guestFilter';
import { createEmptyDoc } from '@/stores/docStore';
import type { Doc, Guest } from '@/lib/types/doc';

const NO_FILTER: GuestFilter = { unseatedOnly: false, dietaryOnly: false, group: null, rsvp: null, query: '' };

function doc(guests: Guest[], seatAssignments: Record<string, string> = {}): Doc {
  return {
    ...createEmptyDoc(),
    guestOrder: guests.map((g) => g.id),
    guests: Object.fromEntries(guests.map((g) => [g.id, g])),
    seatAssignments,
  };
}

function guest(over: Partial<Guest> & { id: string; name: string }): Guest {
  return { group: null, dietary: null, rsvp: 'pending', plusOneOf: null, ...over };
}

describe('filterGuestIds', () => {
  it('unseatedOnly keeps guests with no seat and excludes declined guests', () => {
    const d = doc(
      [
        guest({ id: 'a', name: 'A', rsvp: 'yes' }),        // unseated, kept
        guest({ id: 'b', name: 'B', rsvp: 'yes' }),        // seated, dropped
        guest({ id: 'c', name: 'C', rsvp: 'no' }),         // declined, dropped
      ],
      { 't1:0': 'b' },
    );
    expect(filterGuestIds(d, { ...NO_FILTER, unseatedOnly: true })).toEqual(['a']);
  });

  it('dietaryOnly keeps only guests with a non-null dietary code', () => {
    const d = doc([
      guest({ id: 'a', name: 'A', dietary: 'GF' }),
      guest({ id: 'b', name: 'B', dietary: null }),
    ]);
    expect(filterGuestIds(d, { ...NO_FILTER, dietaryOnly: true })).toEqual(['a']);
  });

  it('group filter matches a real group name and the UNGROUPED sentinel separately', () => {
    const d = doc([
      guest({ id: 'a', name: 'A', group: 'Family' }),
      guest({ id: 'b', name: 'B', group: null }),
    ]);
    expect(filterGuestIds(d, { ...NO_FILTER, group: 'Family' })).toEqual(['a']);
    expect(filterGuestIds(d, { ...NO_FILTER, group: UNGROUPED })).toEqual(['b']);
  });

  it('query matches name or group, case-insensitively', () => {
    const d = doc([
      guest({ id: 'a', name: 'Ana Marín', group: 'Work' }),
      guest({ id: 'b', name: 'Julio Ruiz', group: 'Family — Marín' }),
    ]);
    expect(filterGuestIds(d, { ...NO_FILTER, query: 'marín' })).toEqual(['a', 'b']);
    expect(filterGuestIds(d, { ...NO_FILTER, query: 'JULIO' })).toEqual(['b']);
  });
});

describe('filterGuestIdsInGroup', () => {
  it('only returns ids in the requested bucket, further narrowed by the filter', () => {
    const d = doc([
      guest({ id: 'a', name: 'A', group: 'Family', rsvp: 'yes' }),
      guest({ id: 'b', name: 'B', group: 'Family', rsvp: 'yes' }),
      guest({ id: 'c', name: 'C', group: 'Work', rsvp: 'yes' }),
    ], { 't1:0': 'a' });
    expect(filterGuestIdsInGroup(d, 'Family', { ...NO_FILTER, unseatedOnly: true })).toEqual(['b']);
  });
});

describe('groupCounts', () => {
  it('reports the true total/seated for a bucket, ignoring any active filter', () => {
    const d = doc([
      guest({ id: 'a', name: 'A', group: 'Family' }),
      guest({ id: 'b', name: 'B', group: 'Family' }),
    ], { 't1:0': 'a' });
    expect(groupCounts(d, 'Family')).toEqual({ total: 2, seated: 1 });
  });
});

describe('groupBuckets', () => {
  it('alphabetises named groups and puts the ungrouped bucket last', () => {
    const d = doc([
      guest({ id: 'a', name: 'A', group: 'Zeta' }),
      guest({ id: 'b', name: 'B', group: 'Alpha' }),
      guest({ id: 'c', name: 'C', group: null }),
    ]);
    expect(groupBuckets(d)).toEqual(['Alpha', 'Zeta', UNGROUPED]);
  });

  it('omits the ungrouped bucket entirely when every guest has a group', () => {
    const d = doc([guest({ id: 'a', name: 'A', group: 'Alpha' })]);
    expect(groupBuckets(d)).toEqual(['Alpha']);
  });
});

describe('distinctGroups / hasUngroupedGuest / dietaryGuestCount', () => {
  it('collects distinct real group names, sorted, without the ungrouped bucket', () => {
    const d = doc([
      guest({ id: 'a', name: 'A', group: 'Zeta' }),
      guest({ id: 'b', name: 'B', group: 'Alpha' }),
      guest({ id: 'c', name: 'C', group: null }),
    ]);
    expect(distinctGroups(d)).toEqual(['Alpha', 'Zeta']);
    expect(hasUngroupedGuest(d)).toBe(true);
  });

  it('counts guests with a dietary code set', () => {
    const d = doc([
      guest({ id: 'a', name: 'A', dietary: 'GF' }),
      guest({ id: 'b', name: 'B', dietary: null }),
      guest({ id: 'c', name: 'C', dietary: 'VG' }),
    ]);
    expect(dietaryGuestCount(d)).toBe(2);
  });
});
