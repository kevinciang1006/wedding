'use client';

import type { DragEvent } from 'react';
import { useViewStore } from '@/stores/viewStore';
import { useT } from '@/lib/i18n/useT';
import { placeObject } from '@/components/canvas/useKeyboard';
import { viewportCentreCm } from '@/lib/geometry/viewport';
import { PALETTE_DND_TYPE } from '@/lib/dnd';
import type { Viewport } from '@/components/canvas/useViewport';
import type { ObjectType } from '@/lib/types/doc';
import type { TranslationKey } from '@/lib/i18n/en';

interface ObjectPaletteProps { viewport: Viewport }

interface PaletteItem {
  type: ObjectType;
  labelKey: TranslationKey;
  // Default seat count shown at a glance, mirroring `lib/doc/factory.ts`'s
  // `createObject` defaults (roundTable 10, rectTable 4/side * 2 sides,
  // headTable 8) plus the sweetheart table's geometry-fixed 2 (it has no
  // seat-count field of its own — `lib/geometry/seats.ts` always seats it
  // 2). `undefined` for every ROOM item: props and labels have no seats.
  seats?: number;
}

const PLACE_ITEMS: PaletteItem[] = [
  { type: 'roundTable', labelKey: 'roundTable', seats: 10 },
  { type: 'rectTable', labelKey: 'banquetTable', seats: 8 },
  { type: 'sweetheart', labelKey: 'sweetheartTable', seats: 2 },
  { type: 'headTable', labelKey: 'headTable', seats: 8 },
];

const ROOM_ITEMS: PaletteItem[] = [
  { type: 'danceFloor', labelKey: 'danceFloor' },
  { type: 'stage', labelKey: 'stage' },
  { type: 'bar', labelKey: 'bar' },
  { type: 'buffet', labelKey: 'buffet' },
  { type: 'label', labelKey: 'textLabel' },
  { type: 'rect', labelKey: 'rectangle' },
];

/**
 * A small line-drawing glyph per object type — plain bordered `div`s, not
 * SVG assets, matching how the rest of this app avoids an icon library.
 * Square corners throughout (the one global drafting-tool rule) except the
 * round table's circle; the dance floor's dashed border mirrors its real
 * `PropNode` treatment on canvas. Border colour tracks `active` the same
 * way the row itself does — ink when this is the current tool, the plainer
 * body colour otherwise.
 */
function PaletteGlyph({ type, active }: { type: ObjectType; active: boolean }) {
  const stroke = active ? 'border-ink' : 'border-text-body';
  switch (type) {
    case 'roundTable':
      return <div className={`h-4 w-4 shrink-0 rounded-full border-[1.5px] ${stroke}`} />;
    case 'rectTable':
      return <div className={`h-2 w-5 shrink-0 border-[1.5px] ${stroke}`} />;
    case 'sweetheart':
      return <div className={`h-2 w-3.5 shrink-0 border-[1.5px] ${stroke}`} />;
    case 'headTable':
      return <div className={`h-1.5 w-[22px] shrink-0 border-[1.5px] ${stroke}`} />;
    case 'danceFloor':
      return <div className={`h-3.5 w-[18px] shrink-0 border-[1.5px] border-dashed ${stroke}`} />;
    case 'stage':
      return <div className={`h-2 w-[18px] shrink-0 border-[1.5px] ${stroke}`} />;
    case 'bar':
      return <div className={`h-1.5 w-5 shrink-0 border-[1.5px] ${stroke}`} />;
    case 'buffet':
      return <div className={`h-1.5 w-5 shrink-0 border-[1.5px] ${stroke}`} />;
    case 'rect':
      return <div className={`h-[11px] w-[18px] shrink-0 border-[1.5px] ${stroke}`} />;
    case 'label':
      return (
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center font-[family-name:var(--font-name)] text-[13px] leading-none ${active ? 'text-ink' : 'text-text-body'}`}
        >
          T
        </span>
      );
  }
}

function PaletteRow({ item, viewport }: { item: PaletteItem; viewport: Viewport }) {
  const t = useT();
  const active = useViewStore((s) => s.tool === item.type);

  function handleDragStart(e: DragEvent<HTMLButtonElement>): void {
    e.dataTransfer.setData(PALETTE_DND_TYPE, item.type);
    e.dataTransfer.effectAllowed = 'copy';
    useViewStore.getState().setTool(item.type);
  }

  function handleDragEnd(): void {
    useViewStore.getState().setTool(null);
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => placeObject(item.type, viewportCentreCm(viewport))}
      className={`flex h-8 items-center gap-2.5 px-2 text-left ${
        active ? 'border border-cool bg-cool-tint' : 'border border-transparent'
      }`}
    >
      <PaletteGlyph type={item.type} active={active} />
      <span className="flex-1 truncate font-[family-name:var(--font-ui)] text-[12.5px] text-ink">
        {t(item.labelKey)}
      </span>
      {item.seats !== undefined && (
        <span className={`shrink-0 font-[family-name:var(--font-data)] text-[10px] ${active ? 'text-cool' : 'text-text-muted'}`}>
          {item.seats}
        </span>
      )}
    </button>
  );
}

/**
 * 200px left palette: PLACE (tables, the seated types) and ROOM (props and
 * the text label) sections, plus a footer of shortcut hints. Click places
 * at the viewport centre; native HTML5 drag-and-drop places at the drop
 * point (`Editor.tsx`'s `onDrop`, which reads `PALETTE_DND_TYPE` off the
 * `DragEvent`). `viewport` is the one instance `Editor.tsx` owns — needed
 * here only for the click-to-place centre calculation, never for a second
 * `useViewport()` call.
 */
export function ObjectPalette({ viewport }: ObjectPaletteProps) {
  const t = useT();

  return (
    <div className="flex w-[200px] shrink-0 flex-col border-r border-panel-border bg-toolbar">
      <div className="px-3 pb-1.5 pt-3 font-[family-name:var(--font-data)] text-[10px] uppercase tracking-[0.1em] text-text-muted">
        {t('place')}
      </div>
      <div className="flex flex-col gap-px px-2">
        {PLACE_ITEMS.map((item) => <PaletteRow key={item.type} item={item} viewport={viewport} />)}
      </div>

      <div className="px-3 pb-1.5 pt-3.5 font-[family-name:var(--font-data)] text-[10px] uppercase tracking-[0.1em] text-text-muted">
        {t('roomSection')}
      </div>
      <div className="flex flex-col gap-px px-2">
        {ROOM_ITEMS.map((item) => <PaletteRow key={item.type} item={item} viewport={viewport} />)}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-1.5 border-t border-divider-light px-3 py-2.5">
        <span className="font-[family-name:var(--font-data)] text-[10px] text-text-muted">T&nbsp;&nbsp;{t('newTable')}</span>
        <span className="font-[family-name:var(--font-data)] text-[10px] text-text-muted">⌥&nbsp;&nbsp;{t('dragDuplicateHint')}</span>
        <span className="font-[family-name:var(--font-data)] text-[10px] text-text-muted">esc&nbsp;&nbsp;{t('cancel')}</span>
      </div>
    </div>
  );
}
