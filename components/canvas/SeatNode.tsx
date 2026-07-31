'use client';

import { memo, useEffect, useRef } from 'react';
import Konva from 'konva';
import { Circle, Group, Text } from 'react-konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { startGuestDrag } from '@/components/dnd/useGuestDrag';
import type { Seat } from '@/lib/geometry/seats';
import {
  COOL, FLAG, ROOM_FILL, SEAT_DROP_FILL, SEAT_DROP_RING, SEAT_EMPTY_STROKE,
  SEAT_OCCUPIED_FILL, WARM, INK, canvasNameFont,
} from '@/lib/canvasTokens';
import {
  DIETARY_DOT_SCREEN_PX, NAME_FONT_SIZE, SEAT_INITIALS_ABOVE, SEAT_NAMES_ABOVE,
  SEAT_NAME_GAP, SEAT_NAME_LABEL_WIDTH, SEAT_RADIUS, SETTLE_MS,
} from '@/lib/constants';

interface SeatNodeProps { seat: Seat }

interface SeatPaint { fill: string; stroke: string; strokeWidth: number; dash?: number[] }

function seatPaint(dropTarget: boolean, occupied: boolean): SeatPaint {
  if (dropTarget) return { fill: SEAT_DROP_FILL, stroke: COOL, strokeWidth: 2 };
  if (occupied) return { fill: SEAT_OCCUPIED_FILL, stroke: WARM, strokeWidth: 1.5 };
  return { fill: ROOM_FILL, stroke: SEAT_EMPTY_STROKE, strokeWidth: 1.5, dash: [4, 4] };
}

/** First + last initial; a single-word name just gives its first letter. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

/**
 * One seat, positioned by its already-resolved `Seat` (world cm, produced
 * by TableNode's single, `useMemo`-cached `getSeats` call — never
 * recomputed here). That memoisation is load-bearing for this component's
 * own isolation, not just TableNode's own re-render count: `getSeats`
 * builds a fresh array on every call, so without memoising it on the
 * table's `obj`, any table-level re-render for a reason unrelated to seat
 * geometry (this table's own fill count changing, `selected` toggling)
 * would hand every seat here a brand-new `Seat` object, and `React.memo`'s
 * shallow prop comparison would treat that as a change — defeating
 * isolation for every seat at this table, table-level counters wouldn't
 * even show it.
 *
 * Given a stable `seat` prop, three independent, narrow store slices, each
 * keyed to this one seat, so a change to any *other* seat's occupant — or
 * any unrelated object entirely — never re-renders this one:
 * `seatAssignments[seat.id]`, the assigned guest's own record, and the two
 * `viewStore` seat-transient flags scoped to `seat.id`. `scale` is the one
 * deliberately broad subscription: every seat has to react to the D6 zoom
 * ladder, and that isolation guarantee is about "moving one table" (or
 * "seating one guest"), not about zooming the whole canvas.
 *
 * `handlePointerDown`/`handleClick` below (Task 14) add no subscriptions of
 * their own — both call `startGuestDrag`/`viewStore.getState().openSeatMenu`
 * imperatively, the same `getState()`-not-`useStore()` rule `useObjectDrag.ts`
 * follows for the identical reason: a real subscription to, say,
 * `viewStore.guestDrag` here would re-render every mounted seat on every
 * pointermove of any guest drag, not just the one seat a gesture actually
 * touches.
 */
export const SeatNode = memo(function SeatNode({ seat }: SeatNodeProps) {
  const guestId = useDocStore((s) => s.seatAssignments[seat.id] ?? null);
  const guest = useDocStore((s) => (guestId ? (s.guests[guestId] ?? null) : null));
  const isHovered = useViewStore((s) => s.hoveredSeatId === seat.id);
  const isJustSeated = useViewStore((s) => s.justSeatedSeatId === seat.id);
  const scale = useViewStore((s) => s.scale);
  const groupRef = useRef<Konva.Group | null>(null);

  useEffect(() => {
    if (!isJustSeated) return;
    const node = groupRef.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      useViewStore.getState().setJustSeated(null);
      return;
    }
    // `settle` (globals.css) has three keyframes — 0% scale 1.18, 60% scale
    // 0.96, 100% scale 1 — but Konva.Tween only interpolates between two
    // states, so the 0% frame is applied instantly (nothing to tween into,
    // it's the starting point) and the remaining two legs are chained tweens
    // covering 60% (192ms) then the remaining 40% (128ms) of the 320ms total.
    node.scale({ x: 1.18, y: 1.18 });
    let active = new Konva.Tween({
      node,
      duration: (SETTLE_MS * 0.6) / 1000,
      scaleX: 0.96,
      scaleY: 0.96,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => {
        active = new Konva.Tween({
          node,
          duration: (SETTLE_MS * 0.4) / 1000,
          scaleX: 1,
          scaleY: 1,
          easing: Konva.Easings.EaseOut,
          onFinish: () => {
            // Only clear the trigger if it's still ours: a second guest
            // could in principle be seated here before this finishes (a
            // fast swap), and clearing then would cancel that later run's
            // own turn to play.
            if (useViewStore.getState().justSeatedSeatId === seat.id) {
              useViewStore.getState().setJustSeated(null);
            }
          },
        });
        active.play();
      },
    });
    active.play();
    return () => { active.destroy(); };
  }, [isJustSeated, seat.id]);

  const { fill, stroke, strokeWidth, dash } = seatPaint(isHovered, guest !== null);
  const angleRad = (seat.angle * Math.PI) / 180;
  // The design's 4px dot is a screen measure, so divide out the stage scale.
  // Cap at a quarter of the seat so it cannot swamp the seat when zoomed far out.
  const dotRadius = Math.min(SEAT_RADIUS * 0.25, DIETARY_DOT_SCREEN_PX / scale);

  // An occupied seat can be picked straight up and dragged (moved, swapped,
  // or unseated by dragging it off every table) — `startGuestDrag` itself
  // withholds any effect until its own arm threshold, and its `onTap`
  // fires here only if the gesture never crossed it, opening `SeatMenu`
  // exactly as a plain click would. An empty seat has no guest to drag, so
  // it only ever needs the plain-click path below.
  function handlePointerDown(e: Konva.KonvaEventObject<PointerEvent>): void {
    if (guest === null) return;
    e.cancelBubble = true;
    startGuestDrag(guest.id, e.evt, (clientX, clientY) => {
      useViewStore.getState().openSeatMenu({ seatId: seat.id, x: clientX, y: clientY });
    });
  }

  // Occupied seats are handled entirely by the pointerdown/onTap path above
  // (both a plain click and a drag start there); this only ever fires for
  // an empty seat, where there is nothing to arm a drag over.
  function handleClick(e: Konva.KonvaEventObject<MouseEvent>): void {
    if (guest !== null) return;
    e.cancelBubble = true;
    useViewStore.getState().openSeatMenu({ seatId: seat.id, x: e.evt.clientX, y: e.evt.clientY });
  }

  return (
    <Group ref={groupRef} x={seat.x} y={seat.y} onPointerDown={handlePointerDown} onClick={handleClick}>
      {isHovered && (
        <Circle radius={SEAT_RADIUS + 3} stroke={SEAT_DROP_RING} strokeWidth={4} strokeScaleEnabled={false} />
      )}
      <Circle radius={SEAT_RADIUS} fill={fill} stroke={stroke} strokeWidth={strokeWidth} dash={dash} strokeScaleEnabled={false} />
      {guest !== null && guest.dietary !== null && (
        <Circle
          // Offset to the seat's upper-right edge rather than the centre: initials
          // and the settle scale both originate from the centre, and a centred dot
          // is unreliably covered by the initials text at exactly the zoom range
          // (>SEAT_INITIALS_ABOVE) where both are visible. A fixed local offset
          // stays screen-consistent regardless of the table's own rotation — this
          // Group carries the seat's position but never its rotation (only the
          // outside-name Text below applies `seat.angle`, to itself, not here).
          // The white ring (reusing ROOM_FILL, this token set's one white) is what
          // keeps the marker legible against both the seat fill and the initials,
          // same idiom as the mobile viewer's own dietary marker.
          x={SEAT_RADIUS * 0.707}
          y={-SEAT_RADIUS * 0.707}
          radius={dotRadius}
          fill={FLAG}
          stroke={ROOM_FILL}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      )}
      {guest !== null && scale > SEAT_INITIALS_ABOVE && (
        <Text
          text={initialsOf(guest.name)}
          fontFamily={canvasNameFont()}
          fontSize={NAME_FONT_SIZE}
          fill={INK}
          width={SEAT_RADIUS * 2}
          height={SEAT_RADIUS * 2}
          offsetX={SEAT_RADIUS}
          offsetY={SEAT_RADIUS}
          align="center"
          verticalAlign="middle"
          wrap="none"
        />
      )}
      {guest !== null && scale > SEAT_NAMES_ABOVE && (
        <Text
          text={guest.name}
          fontFamily={canvasNameFont()}
          fontSize={NAME_FONT_SIZE}
          fill={INK}
          width={SEAT_NAME_LABEL_WIDTH}
          height={NAME_FONT_SIZE * 1.4}
          offsetX={SEAT_NAME_LABEL_WIDTH / 2}
          offsetY={(NAME_FONT_SIZE * 1.4) / 2}
          align="center"
          verticalAlign="middle"
          wrap="none"
          // Outward from the table, just clear of the seat's own edge, then
          // rotated to seat.angle itself per D6 — literally, not "for
          // readability": at some angles this does read upside down from a
          // fixed viewing direction, same as a physical name card laid flush
          // with the chair.
          //
          // seat.angle is a *Konva* rotation (clockwise, matching
          // rotatePoint/vec.ts, not raw trig): applied to a seat's default
          // "faces up" orientation (0,-1), a seat's facing vector is
          // rotatePoint(0, -1, angle) = (sin, -cos). Outward is the negation
          // of that, (-sin, cos) — not (-cos, -sin), which is what a plain
          // "angle as a bearing" reading would give and points 90° off.
          x={-Math.sin(angleRad) * (SEAT_RADIUS + SEAT_NAME_GAP)}
          y={Math.cos(angleRad) * (SEAT_RADIUS + SEAT_NAME_GAP)}
          rotation={seat.angle}
        />
      )}
    </Group>
  );
});
