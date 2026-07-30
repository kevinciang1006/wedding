'use client';

import { Layer, Rect, Shape, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { getBounds, getBoundsAt } from '@/lib/geometry/bounds';
import { tickLadder } from '@/lib/geometry/ticks';
import { formatLength } from '@/lib/units/format';
import type { Units } from '@/lib/types/doc';
import {
  COOL, COOL_DEEP, RULER_EXTENT_LEFT, RULER_EXTENT_TOP, RULER_TICK_MAJOR, RULER_TICK_MINOR,
  TEXT_SECONDARY, canvasDataFont,
} from '@/lib/canvasTokens';
import {
  RULER_EXTENT_CAP_PX, RULER_LABEL_FONT_PX, RULER_LABEL_INSET_PX,
  RULER_MAJOR_TICK_PX, RULER_MINOR_TICK_PX, RULER_SIZE,
} from '@/lib/constants';

interface RulerProps { orientation: 'top' | 'left'; length: number }

/** Every whole multiple of `step` that falls within [min, max], ascending. */
function ticksInRange(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max; v += step) out.push(v);
  return out;
}

/**
 * World cm -> this ruler's own local screen px. The one legitimate place cm
 * and screen px mix directly: a ruler is a second, deliberately UNscaled
 * Konva Stage (1 Konva unit = 1 screen px here) sitting beside the main
 * Stage (1 Konva unit = 1 room cm, scaled by `scale`). Reusing the main
 * Stage's own `scale`/pan here is what keeps a tick aligned, pixel for
 * pixel, with the world coordinate it names on the canvas beneath it.
 */
function worldToLocal(worldCm: number, scale: number, pan: number): number {
  return worldCm * scale + pan;
}

function drawTicks(
  ctx: Konva.Context, shape: Konva.Shape, ticks: number[], scale: number, pan: number,
  isTop: boolean, tickPx: number,
): void {
  ctx.beginPath();
  for (const t of ticks) {
    const p = worldToLocal(t, scale, pan);
    if (isTop) {
      ctx.moveTo(p, RULER_SIZE - tickPx);
      ctx.lineTo(p, RULER_SIZE);
    } else {
      ctx.moveTo(RULER_SIZE - tickPx, p);
      ctx.lineTo(RULER_SIZE, p);
    }
  }
  ctx.strokeShape(shape);
}

interface Band { start: number; end: number; extent: number }

/**
 * A small Konva `Stage` — `fullWidth × 28` for the top ruler, `28 ×
 * fullHeight` for the left one — living beside (not inside) the main Stage.
 * Ticks come from `tickLadder(scale)` (the room grid is a fixed, different
 * thing); the selection-extent band, when exactly one object is selected,
 * bands that object's world extent on the same axis. Both read `scale` and
 * only the ONE pan axis this ruler actually draws along, so a vertical-only
 * pan re-renders the left ruler but not the top one.
 */
export function Ruler({ orientation, length }: RulerProps) {
  const isTop = orientation === 'top';
  const scale = useViewStore((s) => s.scale);
  const pan = useViewStore((s) => (isTop ? s.x : s.y));
  const units = useDocStore((s) => s.units);
  const selectedId = useViewStore((s) => (s.selectedIds.length === 1 ? s.selectedIds[0] : null));
  const obj = useDocStore((s) => (selectedId ? s.objects[selectedId] : undefined));
  const drag = useViewStore((s) => s.dragDistance);

  const ladder = tickLadder(scale);
  const worldMin = -pan / scale;
  const worldMax = (length - pan) / scale;
  const minorTicks = ticksInRange(worldMin, worldMax, ladder.minor);
  const majorTicks = ticksInRange(worldMin, worldMax, ladder.major);

  // Same "docStore value + live drag delta" trick SelectionTransformer's
  // multi-select box uses: dragDistance is only ever set while dragging the
  // single object this ruler could possibly be selected on (the readout/
  // rulers only ever show a band for exactly one selection), so applying it
  // here keeps the band tracking the object for the whole gesture instead of
  // freezing until the eventual dragEnd commit.
  let band: Band | null = null;
  if (obj) {
    const bounds = drag
      ? getBoundsAt(obj, obj.x + (drag.to.x - drag.from.x), obj.y + (drag.to.y - drag.from.y))
      : getBounds(obj);
    band = isTop
      ? { start: bounds.left, end: bounds.right, extent: bounds.width }
      : { start: bounds.top, end: bounds.bottom, extent: bounds.height };
  }

  const width = isTop ? length : RULER_SIZE;
  const height = isTop ? RULER_SIZE : length;
  const labelH = RULER_LABEL_FONT_PX * 1.3;

  return (
    <div className={`bg-paper border-ruler-border ${isTop ? 'border-b' : 'border-r'}`} style={{ width, height }}>
      <Stage width={width} height={height} listening={false}>
        <Layer listening={false}>
          <Shape
            stroke={RULER_TICK_MINOR}
            strokeWidth={1}
            strokeScaleEnabled={false}
            sceneFunc={(ctx, shape) => drawTicks(ctx, shape, minorTicks, scale, pan, isTop, RULER_MINOR_TICK_PX)}
          />
          <Shape
            stroke={RULER_TICK_MAJOR}
            strokeWidth={1}
            strokeScaleEnabled={false}
            sceneFunc={(ctx, shape) => drawTicks(ctx, shape, majorTicks, scale, pan, isTop, RULER_MAJOR_TICK_PX)}
          />
          {/* Skip an axis label wherever the selection-extent band already covers
              that world position: the left band's fill is intentionally
              translucent (rgba, not solid, per its own spec below), so an
              axis tick landing inside the band was not being hidden by it —
              the plain grey axis label and the band's own rotated blue label
              were compositing on top of each other into illegible double
              exposure. The top band's opaque fill happened to mask the same
              case by accident of colour, not by design, so both axes are
              filtered here rather than relying on that coincidence. */}
          {majorTicks.filter((t) => !band || t < band.start || t > band.end).map((t) => {
            const p = worldToLocal(t, scale, pan);
            const label = formatLength(t, units);
            return isTop ? (
              <Text
                key={t} x={p + RULER_LABEL_INSET_PX} y={RULER_LABEL_INSET_PX} text={label}
                fontFamily={canvasDataFont()} fontSize={RULER_LABEL_FONT_PX} fill={TEXT_SECONDARY}
              />
            ) : (
              <Text
                key={t} x={RULER_LABEL_INSET_PX} y={p + RULER_LABEL_INSET_PX} text={label}
                fontFamily={canvasDataFont()} fontSize={RULER_LABEL_FONT_PX} fill={TEXT_SECONDARY}
              />
            );
          })}
          {band && (isTop ? (
            <TopBand band={band} scale={scale} pan={pan} units={units} labelH={labelH} />
          ) : (
            <LeftBand band={band} scale={scale} pan={pan} units={units} labelH={labelH} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

interface BandProps { band: Band; scale: number; pan: number; units: Units; labelH: number }

function TopBand({ band, scale, pan, units, labelH }: BandProps) {
  const s = worldToLocal(band.start, scale, pan);
  const e = worldToLocal(band.end, scale, pan);
  return (
    <>
      <Rect x={s} y={0} width={e - s} height={RULER_SIZE} fill={RULER_EXTENT_TOP} />
      <Shape
        stroke={COOL} strokeWidth={1} strokeScaleEnabled={false}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(s, 0); ctx.lineTo(s, RULER_SIZE);
          ctx.moveTo(e, 0); ctx.lineTo(e, RULER_SIZE);
          ctx.strokeShape(shape);
        }}
      />
      <Rect x={s} y={RULER_SIZE - RULER_EXTENT_CAP_PX} width={e - s} height={RULER_EXTENT_CAP_PX} fill={COOL} />
      <Text
        x={s} y={RULER_LABEL_INSET_PX} width={e - s} height={labelH} align="center" verticalAlign="middle"
        text={formatLength(band.extent, units)} fontFamily={canvasDataFont()} fontSize={RULER_LABEL_FONT_PX} fill={COOL_DEEP}
      />
    </>
  );
}

function LeftBand({ band, scale, pan, units, labelH }: BandProps) {
  const s = worldToLocal(band.start, scale, pan);
  const e = worldToLocal(band.end, scale, pan);
  return (
    <>
      <Rect x={0} y={s} width={RULER_SIZE} height={e - s} fill={RULER_EXTENT_LEFT} />
      <Shape
        stroke={COOL} strokeWidth={1} strokeScaleEnabled={false}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(0, s); ctx.lineTo(RULER_SIZE, s);
          ctx.moveTo(0, e); ctx.lineTo(RULER_SIZE, e);
          ctx.strokeShape(shape);
        }}
      />
      <Rect x={RULER_SIZE - RULER_EXTENT_CAP_PX} y={s} width={RULER_EXTENT_CAP_PX} height={e - s} fill={COOL} />
      {/* Rotated -90°, reading bottom-to-top along the band's own length —
          a 28px-wide band has no room for an upright label once the value
          runs past a couple of characters. `offsetY={labelH / 2}` pivots on
          the text box's own vertical MIDDLE (not its top-left corner), which
          is what centres the rotated text across the ruler's 28px width;
          `width`/`align="center"` then centre it along the band itself. */}
      <Text
        x={RULER_SIZE / 2} y={e} width={e - s} height={labelH} offsetY={labelH / 2} rotation={-90}
        align="center" verticalAlign="middle"
        text={formatLength(band.extent, units)} fontFamily={canvasDataFont()} fontSize={RULER_LABEL_FONT_PX} fill={COOL_DEEP}
      />
    </>
  );
}

/** The 28×28 cell above the left ruler / left of the top ruler: the active unit. Plain HTML — a single static glyph, no tick math to share with the Konva rulers. */
export function RulerCorner() {
  const units = useDocStore((s) => s.units);
  return (
    <div
      className="border-ruler-border bg-paper flex items-center justify-center border-r border-b font-[family-name:var(--font-data)] text-[10px] text-text-body"
      style={{ width: RULER_SIZE, height: RULER_SIZE }}
    >
      {units}
    </div>
  );
}
