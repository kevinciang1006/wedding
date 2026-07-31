import { describe, expect, it } from 'vitest';
import { docToJson, parseDocJson, DocVersionError, InvalidDocError } from '@/lib/io/json';
import { createEmptyDoc } from '@/stores/docStore';
import type { Doc, Guest } from '@/lib/types/doc';

const SAMPLE_DOC: Doc = {
  ...createEmptyDoc(),
  title: 'Ana & José',
  units: 'ft',
  objects: {
    t1: {
      id: 't1', type: 'roundTable', x: 100, y: 100, rotation: 15,
      diameter: 150, seatCount: 4, label: 'Table 1', z: 0,
    },
  },
  objectOrder: ['t1'],
  guestOrder: ['g1'],
  guests: { g1: { id: 'g1', name: 'María Ruiz', rsvp: 'yes', group: 'Family', dietary: 'GF', plusOneOf: null } satisfies Guest },
  seatAssignments: { 't1:0': 'g1' },
};

describe('docToJson / parseDocJson', () => {
  it('round-trips a document exactly, including accented names and rotation', () => {
    const json = docToJson(SAMPLE_DOC);
    expect(parseDocJson(json)).toEqual(SAMPLE_DOC);
  });

  it('rejects malformed JSON with InvalidDocError', () => {
    expect(() => parseDocJson('not json {{{')).toThrow(InvalidDocError);
  });

  it('rejects well-formed JSON that is not a Setting plan with InvalidDocError', () => {
    expect(() => parseDocJson(JSON.stringify({ hello: 'world' }))).toThrow(InvalidDocError);
  });

  it('rejects a document whose version is not 1 with DocVersionError, carrying the found version', () => {
    // Mutate the version on already-parsed JSON, rather than constructing a
    // mistyped `Doc` — a version-2 document breaks the `Doc` type by
    // definition, which is exactly the case under test.
    const parsed: Record<string, unknown> = JSON.parse(docToJson(SAMPLE_DOC));
    parsed.version = 2;
    const raw = JSON.stringify(parsed);

    expect(() => parseDocJson(raw)).toThrow(DocVersionError);
    try {
      parseDocJson(raw);
      expect.unreachable('parseDocJson should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DocVersionError);
      if (error instanceof DocVersionError) expect(error.foundVersion).toBe(2);
    }
  });

  it('does not fold a version mismatch into a generic InvalidDocError', () => {
    const parsed: Record<string, unknown> = JSON.parse(docToJson(SAMPLE_DOC));
    parsed.version = 2;
    let caught: unknown;
    try {
      parseDocJson(JSON.stringify(parsed));
    } catch (error) {
      caught = error;
    }
    expect(caught).not.toBeInstanceOf(InvalidDocError);
  });
});
