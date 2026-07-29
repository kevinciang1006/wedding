'use client';

import { memo, useMemo } from 'react';
import { Circle, Group, Rect, Text } from 'react-konva';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { SeatNode } from '@/components/canvas/SeatNode';
import { getSeats } from '@/lib/geometry/seats';
import { getBounds, isOutsideRoom } from '@/lib/geometry/bounds';
import { tableFill } from '@/lib/doc/derive';
import { isTable } from '@/lib/types/doc';
import {
  COOL, INK, OBJECT_STROKE, ROOM_FILL, TEXT_MUTED, TEXT_SECONDARY, WARM,
  canvasDataFont, canvasNameFont,
} from '@/lib/canvasTokens';
import { DATA_FONT_SIZE, NAME_FONT_SIZE, OUTSIDE_ROOM_OPACITY } from '@/lib/constants';

interface TableNodeProps { id: string }

function fillCountColor(seated: number, total: number): string {
  if (seated === 0) return TEXT_MUTED;
  if (seated >= total) return WARM;
  return TEXT_SECONDARY;
}

/**
 * One table: a plate (Circle for round, Rect for the rest), its label and
 * seated-count, and its seats. `getSeats(obj)` is memoised on `obj` here —
 * SeatNode only ever receives an already-resolved `Seat`, so mounting N
 * seats never recomputes the whole ring N times, and re-rendering this
 * component for a reason unrelated to `obj` (a fill-count change, a
 * selection toggle) doesn't hand every seat a fresh object either.
 *
 * The plate/label and the seats are two independent Konva `Group`s rather
 * than one nested pair: `getSeats` already returns seat positions in
 * absolute world cm (rotated and translated), so nesting a `SeatNode` inside
 * a `Group` that also carries the table's own `x`/`y`/`rotation` would
 * double-apply that transform. Only the plate/label content — drawn here in
 * the table's own local space, centred on 0,0 — gets that Group's
 * transform; the seat Group carries opacity only.
 */
export const TableNode = memo(function TableNode({ id }: TableNodeProps) {
  const obj = useDocStore((s) => s.objects[id]);
  const room = useDocStore((s) => s.room);
  const selected = useViewStore((s) => s.selectedIds.includes(id));
  // useShallow bails the re-render unless *this* table's own seated/total
  // pair actually changed — without it, seating a guest anywhere in the doc
  // would re-render every mounted table, since tableFill() returns a fresh
  // object on every call and plain Object.is would never consider two calls
  // equal.
  const { seated, total } = useDocStore(useShallow((s) => tableFill(s, id)));
  // `obj` is referentially stable from the narrow docStore selector — Immer
  // shares untouched branches across a commit that doesn't touch this
  // object — so this only recomputes on a real shape/position change, not
  // on every render this component happens to do for an unrelated reason
  // (`selected` toggling, this table's own fill count changing). Without
  // it, `getSeats` would hand every `SeatNode` a fresh `Seat` object on
  // those renders too, and `React.memo`'s shallow prop comparison would
  // treat that as a change, defeating seat-level isolation.
  const seats = useMemo(() => (obj ? getSeats(obj) : []), [obj]);

  if (!obj || !isTable(obj)) return null;

  const opacity = isOutsideRoom(getBounds(obj), room) ? OUTSIDE_ROOM_OPACITY : 1;
  const stroke = selected ? COOL : OBJECT_STROKE;
  const plateWidth = obj.type === 'roundTable' ? obj.diameter : obj.width;

  const labelH = NAME_FONT_SIZE * 1.3;
  const fillH = DATA_FONT_SIZE * 1.3;
  const gap = 2; // cm between the label and the fill-count line
  const labelY = -(fillH / 2 + gap / 2);
  const fillY = labelH / 2 + gap / 2;

  return (
    <>
      <Group x={obj.x} y={obj.y} rotation={obj.rotation} opacity={opacity}>
        {obj.type === 'roundTable' ? (
          <Circle radius={obj.diameter / 2} fill={ROOM_FILL} stroke={stroke} strokeWidth={1.5} strokeScaleEnabled={false} />
        ) : (
          <Rect
            x={-obj.width / 2}
            y={-obj.height / 2}
            width={obj.width}
            height={obj.height}
            fill={ROOM_FILL}
            stroke={stroke}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
          />
        )}
        <Text
          text={obj.label}
          fontFamily={canvasNameFont()}
          fontSize={NAME_FONT_SIZE}
          letterSpacing={NAME_FONT_SIZE * 0.01}
          fill={INK}
          y={labelY}
          width={plateWidth}
          height={labelH}
          offsetX={plateWidth / 2}
          offsetY={labelH / 2}
          align="center"
          verticalAlign="middle"
          wrap="none"
        />
        <Text
          text={`${seated}/${total}`}
          fontFamily={canvasDataFont()}
          fontSize={DATA_FONT_SIZE}
          letterSpacing={DATA_FONT_SIZE * 0.04}
          fill={fillCountColor(seated, total)}
          y={fillY}
          width={plateWidth}
          height={fillH}
          offsetX={plateWidth / 2}
          offsetY={fillH / 2}
          align="center"
          verticalAlign="middle"
          wrap="none"
        />
      </Group>
      <Group opacity={opacity}>
        {seats.map((seat) => <SeatNode key={seat.id} seat={seat} />)}
      </Group>
    </>
  );
});
