import { isDoc } from '@/stores/docStore';
import type { Doc } from '@/lib/types/doc';

/**
 * The parsed JSON is not shaped like a Setting plan at all — missing
 * fields, wrong types, or not even an object. Kept distinct from
 * `DocVersionError` (below) so a caller can tell "this was never ours" from
 * "this is ours, but from a version this build doesn't understand": the
 * latter has a value worth showing the user, the former doesn't.
 */
export class InvalidDocError extends Error {
  constructor() {
    super('That file is not a valid Setting plan.');
    this.name = 'InvalidDocError';
  }
}

/**
 * The parsed JSON has a `version` field, but not the `1` this build reads.
 * Checked before the full `isDoc` shape check runs, so a version bump is
 * never swallowed by (and misreported as) a generic "invalid file" —
 * `isDoc` itself already rejects a non-1 version, but folds that into the
 * same false as every other shape mismatch, which is exactly the silent
 * failure this class exists to prevent.
 */
export class DocVersionError extends Error {
  readonly foundVersion: unknown;
  constructor(foundVersion: unknown) {
    super(`Unsupported plan version: ${String(foundVersion)}`);
    this.name = 'DocVersionError';
    this.foundVersion = foundVersion;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The raw `Doc`, pretty-printed — nothing added or stripped, so export then import is lossless. */
export function docToJson(doc: Doc): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * Parses and validates an imported plan file. Throws `DocVersionError` for a
 * recognisable-but-unsupported version, `InvalidDocError` for anything else
 * that isn't valid JSON or doesn't pass `isDoc` — never returns a
 * best-guess document, and never fails silently.
 */
export function parseDocJson(text: string): Doc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidDocError();
  }
  if (isRecord(parsed) && 'version' in parsed && parsed.version !== 1) {
    throw new DocVersionError(parsed.version);
  }
  if (!isDoc(parsed)) {
    throw new InvalidDocError();
  }
  return parsed;
}
