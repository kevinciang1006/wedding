'use client';

import type { ReactNode } from 'react';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { useT } from '@/lib/i18n/useT';
import { useCommitField } from '@/components/chrome/useCommitField';
import { formatValue, parseLength } from '@/lib/units/format';
import { isProp, type SceneObject, type Units } from '@/lib/types/doc';
import type { TranslationKey } from '@/lib/i18n/en';

/** Same palette-name keys `ObjectPalette.tsx` uses for its rows — one source for "what do we call this type", not a second copy that could drift. */
const TYPE_NAME_KEY: Record<SceneObject['type'], TranslationKey> = {
  roundTable: 'roundTable', rectTable: 'banquetTable', sweetheart: 'sweetheartTable', headTable: 'headTable',
  danceFloor: 'danceFloor', stage: 'stage', bar: 'bar', buffet: 'buffet', label: 'textLabel', rect: 'rectangle',
};

function commitObject(id: string, mutate: (obj: SceneObject) => void, label: string): void {
  useDocStore.getState().commit((d) => {
    const obj = d.objects[id];
    if (!obj) return;
    mutate(obj);
  }, label);
}

function FieldShell({ labelText, children }: { labelText: string; children: ReactNode }) {
  return (
    <div className="border-r border-divider px-2.5 py-[6px] last:border-r-0">
      <div className="font-[family-name:var(--font-data)] text-[9px] text-text-muted">{labelText}</div>
      {children}
    </div>
  );
}

const fieldInputClass = 'w-full bg-transparent p-0 font-[family-name:var(--font-data)] text-[13px] font-medium text-ink outline-none';

interface LengthFieldProps { labelText: string; cm: number; units: Units; onCommitCm: (cm: number) => void }

/** A length in room cm, displayed/parsed in the active unit — the rule that covers X/Y, diameter, width/height and font size alike. */
function LengthField({ labelText, cm, units, onCommitCm }: LengthFieldProps) {
  const field = useCommitField(formatValue(cm, units), (text) => {
    const parsed = parseLength(text, units);
    if (parsed === null) return false;
    onCommitCm(parsed);
    return true;
  });
  return (
    <FieldShell labelText={labelText}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={labelText}
        value={field.text}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
        className={fieldInputClass}
      />
    </FieldShell>
  );
}

interface IntFieldProps { labelText: string; value: number; onCommit: (n: number) => void }

/** An integer seat count, clamped to 1–16 rather than rejected outright — only genuinely non-numeric text reverts. */
function IntField({ labelText, value, onCommit }: IntFieldProps) {
  const field = useCommitField(String(value), (text) => {
    const n = Number(text);
    if (!Number.isFinite(n)) return false;
    onCommit(Math.min(16, Math.max(1, Math.round(n))));
    return true;
  });
  return (
    <FieldShell labelText={labelText}>
      <input
        type="text"
        inputMode="numeric"
        aria-label={labelText}
        value={field.text}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
        className={fieldInputClass}
      />
    </FieldShell>
  );
}

function RotationField({ value, onCommit }: { value: number; onCommit: (deg: number) => void }) {
  const t = useT();
  const normalized = ((value % 360) + 360) % 360;
  const field = useCommitField(String(Math.round(normalized)), (text) => {
    const n = Number(text);
    if (!Number.isFinite(n)) return false;
    onCommit(((n % 360) + 360) % 360);
    return true;
  });
  return (
    <FieldShell labelText="R">
      <div className="flex items-baseline gap-0.5">
        <input
          type="text"
          inputMode="numeric"
          // Visible label stays the bare "R" (matches the readout's W/H/R/X/Y
          // density convention), but a bare letter is not universal shorthand
          // for screen-reader users the way "X"/"Y" are — the accessible name
          // is the spelled-out, translated word instead.
          aria-label={t('rotation')}
          value={field.text}
          onChange={field.onChange}
          onBlur={field.onBlur}
          onKeyDown={field.onKeyDown}
          className={fieldInputClass}
        />
        <span className="font-[family-name:var(--font-data)] text-[13px] font-medium text-ink">°</span>
      </div>
    </FieldShell>
  );
}

function LabelField({ value, onCommit }: { value: string; onCommit: (s: string) => void }) {
  const t = useT();
  const field = useCommitField(value, (text) => { onCommit(text.trim()); return true; });
  return (
    <div className="px-2.5 py-2">
      <div className="font-[family-name:var(--font-data)] text-[9px] text-text-muted">{t('objectLabel')}</div>
      <input
        type="text"
        aria-label={t('objectLabel')}
        value={field.text}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
        className="w-full bg-transparent p-0 font-[family-name:var(--font-name)] text-[14px] text-ink outline-none"
      />
    </div>
  );
}

/**
 * Floating property panel, top-right of the canvas viewport — the same
 * absolutely-positioned-HUD technique `Readout` (bottom-left) and
 * `ScaleBadge` (bottom-right) already use, so it needs no change to
 * `Editor.tsx`'s flex shape and stays clear of both. The opposite corner
 * from the readout was the deliberate choice: the two are often relevant at
 * the same time (readout shows live drag geometry, inspector lets you type
 * an exact one), and Editor's row has no fourth docked slot to spare for it
 * — the palette and guest-panel columns are already spoken for.
 *
 * Shown only when exactly one object is selected, matching the readout's
 * own single-selection rule. Every commit here goes through `commitObject`
 * — one `docStore.commit` per completed field edit, never per keystroke and
 * never mid-drag (dragging is `useObjectDrag`'s territory, untouched by
 * this component).
 */
export function Inspector() {
  const t = useT();
  const units = useDocStore((s) => s.units);
  const selectedId = useViewStore((s) => (s.selectedIds.length === 1 ? s.selectedIds[0] : null));
  const obj = useDocStore((s) => (selectedId ? s.objects[selectedId] : undefined));

  if (!obj) return null;
  const id = obj.id;

  return (
    <div className="absolute right-5 top-5 w-[280px] border border-readout-border bg-paper shadow-readout">
      <div className="border-b border-divider bg-subtle px-2.5 pt-2">
        <span className="font-[family-name:var(--font-data)] text-[9px] uppercase tracking-[0.06em] text-text-secondary">
          {t(TYPE_NAME_KEY[obj.type])}
        </span>
        <LabelField value={obj.label} onCommit={(v) => commitObject(id, (o) => { o.label = v; }, 'rename')} />
      </div>

      <div className="grid grid-cols-3 border-b border-divider">
        <LengthField
          labelText="X"
          cm={obj.x}
          units={units}
          onCommitCm={(cm) => commitObject(id, (o) => { o.x = cm; }, 'move')}
        />
        <LengthField
          labelText="Y"
          cm={obj.y}
          units={units}
          onCommitCm={(cm) => commitObject(id, (o) => { o.y = cm; }, 'move')}
        />
        <RotationField
          value={obj.rotation}
          onCommit={(deg) => commitObject(id, (o) => { o.rotation = deg; }, 'rotate')}
        />
      </div>

      {obj.type === 'roundTable' && (
        <div className="grid grid-cols-2">
          <LengthField
            labelText={t('diameter')}
            cm={obj.diameter}
            units={units}
            onCommitCm={(cm) => commitObject(id, (o) => { if (o.type === 'roundTable') o.diameter = Math.max(1, cm); }, 'resize')}
          />
          <IntField
            labelText={t('seats')}
            value={obj.seatCount}
            onCommit={(n) => commitObject(id, (o) => { if (o.type === 'roundTable') o.seatCount = n; }, 'reseat')}
          />
        </div>
      )}

      {obj.type === 'rectTable' && (
        <div className="grid grid-cols-3">
          <LengthField
            labelText={t('width')}
            cm={obj.width}
            units={units}
            onCommitCm={(cm) => commitObject(id, (o) => { if (o.type === 'rectTable') o.width = Math.max(1, cm); }, 'resize')}
          />
          <LengthField
            labelText={t('height')}
            cm={obj.height}
            units={units}
            onCommitCm={(cm) => commitObject(id, (o) => { if (o.type === 'rectTable') o.height = Math.max(1, cm); }, 'resize')}
          />
          <IntField
            labelText={t('seatsPerSide')}
            value={obj.seatsPerSide}
            onCommit={(n) => commitObject(id, (o) => { if (o.type === 'rectTable') o.seatsPerSide = n; }, 'reseat')}
          />
        </div>
      )}

      {obj.type === 'headTable' && (
        <div className="grid grid-cols-3">
          <LengthField
            labelText={t('width')}
            cm={obj.width}
            units={units}
            onCommitCm={(cm) => commitObject(id, (o) => { if (o.type === 'headTable') o.width = Math.max(1, cm); }, 'resize')}
          />
          <LengthField
            labelText={t('height')}
            cm={obj.height}
            units={units}
            onCommitCm={(cm) => commitObject(id, (o) => { if (o.type === 'headTable') o.height = Math.max(1, cm); }, 'resize')}
          />
          <IntField
            labelText={t('seats')}
            value={obj.seatCount}
            onCommit={(n) => commitObject(id, (o) => { if (o.type === 'headTable') o.seatCount = n; }, 'reseat')}
          />
        </div>
      )}

      {(obj.type === 'sweetheart' || isProp(obj)) && (
        <div className="grid grid-cols-2">
          <LengthField
            labelText={t('width')}
            cm={obj.width}
            units={units}
            onCommitCm={(cm) => commitObject(id, (o) => { if (o.type === 'sweetheart' || isProp(o)) o.width = Math.max(1, cm); }, 'resize')}
          />
          <LengthField
            labelText={t('height')}
            cm={obj.height}
            units={units}
            onCommitCm={(cm) => commitObject(id, (o) => { if (o.type === 'sweetheart' || isProp(o)) o.height = Math.max(1, cm); }, 'resize')}
          />
        </div>
      )}

      {obj.type === 'label' && (
        <div className="grid grid-cols-2">
          <LengthField
            labelText={t('fontSize')}
            cm={obj.fontSize}
            units={units}
            onCommitCm={(cm) => commitObject(id, (o) => { if (o.type === 'label') o.fontSize = Math.max(1, cm); }, 'resize')}
          />
        </div>
      )}
    </div>
  );
}
