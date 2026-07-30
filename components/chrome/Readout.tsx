'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { useT } from '@/lib/i18n/useT';
import { tableFill } from '@/lib/doc/derive';
import { aabbGap, getBounds, getBoundsAt } from '@/lib/geometry/bounds';
import { formatLength } from '@/lib/units/format';
import { isTable, type SceneObject, type TableObject } from '@/lib/types/doc';
import { GRID_SNAP_STEP } from '@/lib/constants';
import type { TranslationKey } from '@/lib/i18n/en';

type T = ReturnType<typeof useT>;

function shapeWord(t: T, obj: TableObject): string {
  switch (obj.type) {
    case 'roundTable': return t('shapeRound');
    case 'rectTable': return t('shapeBanquet');
    case 'sweetheart': return t('shapeSweetheart');
    case 'headTable': return t('shapeHead');
  }
}

// Every non-table object type maps straight onto its existing palette-name
// key, lowercased for the readout's mono summary line — tables get their own
// shorter shape word (see `shapeWord`) instead, since "table" is already
// implied by sitting under the object's own name.
const PROP_SUMMARY_KEY: Record<Exclude<SceneObject['type'], TableObject['type']>, TranslationKey> = {
  danceFloor: 'danceFloor', stage: 'stage', bar: 'bar', buffet: 'buffet', rect: 'rectangle', label: 'textLabel',
};

function summaryText(t: T, obj: SceneObject, fill: { seated: number; total: number } | null): string {
  if (isTable(obj)) {
    return fill ? t('tableSummary', { shape: shapeWord(t, obj), total: fill.total, seated: fill.seated }) : '';
  }
  // `isTable` returning false narrows `obj` here to exactly the non-table
  // types `PROP_SUMMARY_KEY` is keyed by — no runtime check or cast needed.
  return t(PROP_SUMMARY_KEY[obj.type]).toLowerCase();
}

/** Rotation normalised into [0, 360) and rounded — Konva reports whatever raw degrees a rotate gesture accumulated, which can be negative or exceed 360. */
function normalizedDegrees(deg: number): number {
  return Math.round(((deg % 360) + 360) % 360);
}

interface FieldProps { label: string; value: string; position?: boolean }

function Field({ label, value, position = false }: FieldProps) {
  return (
    <div className="border-divider border-r px-2.5 py-[7px] last:border-r-0">
      <div className="font-[family-name:var(--font-data)] text-[9px] text-text-muted">{label}</div>
      <div className={`font-[family-name:var(--font-data)] text-[13px] font-medium ${position ? 'text-cool-deep' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Bottom-left measurement HUD, shown only while exactly one object is
 * selected. A passive reader of docStore + viewStore — it never calls
 * `commit`. During a live drag it derives the object's on-screen position
 * from `viewStore.dragDistance` the same way `SelectionTransformer`'s
 * multi-select box does (docStore itself is never touched mid-drag), so
 * X/Y/CLEAR track the object live instead of freezing until the eventual
 * dragEnd commit lands.
 */
export function Readout() {
  const t = useT();
  const units = useDocStore((s) => s.units);
  const selectedId = useViewStore((s) => (s.selectedIds.length === 1 ? s.selectedIds[0] : null));
  const obj = useDocStore((s) => (selectedId ? s.objects[selectedId] : undefined));
  const objects = useDocStore((s) => s.objects);
  const objectOrder = useDocStore((s) => s.objectOrder);
  const drag = useViewStore((s) => s.dragDistance);
  const fill = useDocStore(useShallow((s) => (obj && isTable(obj) ? tableFill(s, obj.id) : null)));
  // Every other object's AABB, recomputed only when the doc's objects, their
  // order, or the selection actually change — not on every render. During a
  // drag none of those change (the drag never touches docStore, only
  // `viewStore.dragDistance`), so this stays cheap on every drag frame even
  // as the plan grows past the dozens of tables it's meant to hold; only the
  // dragged object's OWN bounds (`bounds` below) still needs to recompute
  // live, and that's a single `getBoundsAt` call, not an O(objects) scan.
  const neighbourBounds = useMemo(() => (
    objectOrder
      .filter((id) => id !== selectedId)
      .map((id) => objects[id])
      .filter((o): o is SceneObject => o !== undefined)
      .map(getBounds)
  ), [objects, objectOrder, selectedId]);

  if (!obj) return null;

  const liveX = obj.x + (drag ? drag.to.x - drag.from.x : 0);
  const liveY = obj.y + (drag ? drag.to.y - drag.from.y : 0);
  const bounds = drag ? getBoundsAt(obj, liveX, liveY) : getBounds(obj);

  const clear = neighbourBounds.length > 0
    ? Math.min(...neighbourBounds.map((n) => aabbGap(bounds, n)))
    : null;

  return (
    <div className="border-readout-border shadow-readout absolute bottom-5 left-5 w-[280px] border bg-paper">
      <div className="border-divider bg-subtle flex min-w-0 items-baseline gap-2 border-b px-2.5 py-2">
        <span className="shrink-0 font-[family-name:var(--font-name)] text-[14px] text-ink">{obj.label}</span>
        <span className="truncate font-[family-name:var(--font-data)] text-[9.5px] uppercase tracking-[0.06em] text-text-secondary">
          {summaryText(t, obj, fill)}
        </span>
      </div>
      <div className="border-divider grid grid-cols-3 border-b">
        <Field label="W" value={formatLength(bounds.width, units)} />
        <Field label="H" value={formatLength(bounds.height, units)} />
        <Field label="R" value={`${normalizedDegrees(obj.rotation)}°`} />
      </div>
      <div className="grid grid-cols-3">
        <Field label="X" value={formatLength(liveX, units)} position />
        <Field label="Y" value={formatLength(liveY, units)} position />
        <Field label={t('clearance')} value={clear === null ? '—' : formatLength(clear, units)} />
      </div>
      <div className="border-divider bg-subtle flex gap-3 border-t px-2.5 py-1.5">
        <span className="font-[family-name:var(--font-data)] text-[9.5px] text-text-muted">⇧ {t('constrain')}</span>
        <span className="font-[family-name:var(--font-data)] text-[9.5px] text-text-muted">
          G {t('snapHint', { step: formatLength(GRID_SNAP_STEP, units) })}
        </span>
        <span className="font-[family-name:var(--font-data)] text-[9.5px] text-text-muted">R {t('rotateHint')}</span>
      </div>
    </div>
  );
}
