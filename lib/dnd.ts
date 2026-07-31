import type { ObjectType } from '@/lib/types/doc';

// Custom MIME type for the object palette's native HTML5 drag-and-drop, so
// `Editor.tsx`'s drop handler on the canvas viewport only ever reacts to a
// palette row being dragged onto it — not, say, a browser tab drag or a
// stray file drop.
export const PALETTE_DND_TYPE = 'application/x-setting-object-type';

const OBJECT_TYPES: ReadonlySet<string> = new Set<ObjectType>([
  'roundTable', 'rectTable', 'sweetheart', 'headTable',
  'danceFloor', 'stage', 'bar', 'buffet', 'label', 'rect',
]);

/** Narrows a `dataTransfer.getData(...)` string back to `ObjectType` without an `as` cast. */
export function isObjectType(value: string): value is ObjectType {
  return OBJECT_TYPES.has(value);
}
