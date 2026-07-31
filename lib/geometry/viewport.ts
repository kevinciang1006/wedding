import { MAX_SCALE, MIN_SCALE } from '@/lib/constants';
import type { Cm } from '@/lib/types/doc';

/**
 * The subset of `useViewport`'s return value this module's maths actually
 * needs — a structural type rather than importing the full `Viewport`
 * interface (refs, event handlers) into `lib/`, which stays free of
 * component/Konva concerns.
 */
export interface ViewportTransform {
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
}

/**
 * Converts a point already expressed in container-relative screen px (e.g.
 * `clientX/Y` minus the container's own `getBoundingClientRect()` origin)
 * into room centimetres — the inverse of the scale/translate the Konva
 * `Stage` itself applies. Used for drag-and-drop placement from the palette,
 * where the drop point is a native `DragEvent`'s screen coordinates, not a
 * Konva pointer event.
 */
export function screenPointToRoomCm(v: ViewportTransform, screenX: number, screenY: number): { x: Cm; y: Cm } {
  return { x: (screenX - v.x) / v.scale, y: (screenY - v.y) / v.scale };
}

/**
 * The room-cm point currently at the centre of the viewport — where a
 * palette click or the `T` shortcut places a new object, so it lands
 * somewhere visible regardless of the current pan/zoom.
 */
export function viewportCentreCm(v: ViewportTransform): { x: Cm; y: Cm } {
  return screenPointToRoomCm(v, v.width / 2, v.height / 2);
}

/** The stage transform alone — what every zoom/fit calculation below produces. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Zoom toward a point, never the origin: reproject the room point currently
 * under `pointer` at the OLD scale, then choose x/y so that same room point
 * lands back under the pointer at the new, clamped scale.
 *
 * Pure, and shared by every zoom path in the app — the editor's wheel/pinch/
 * keyboard zoom (`useViewport`) and the mobile viewer's pinch and +/− stepper
 * (`useMobileViewport`) — so the two surfaces cannot drift apart on either
 * the pinning maths or the scale limits.
 */
export function zoomAt(view: View, nextScale: number, pointer: { x: number; y: number }): View {
  const clamped = clampScale(nextScale);
  const world = { x: (pointer.x - view.x) / view.scale, y: (pointer.y - view.y) / view.scale };
  return { scale: clamped, x: pointer.x - world.x * clamped, y: pointer.y - world.y * clamped };
}

/** The view that puts the room's centre at the viewport's centre, at (a clamped) `scale`. */
export function centredView(
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
  room: { width: Cm; height: Cm },
): View {
  const clamped = clampScale(scale);
  return {
    scale: clamped,
    x: viewportWidth / 2 - (room.width / 2) * clamped,
    y: viewportHeight / 2 - (room.height / 2) * clamped,
  };
}

/** The view that shows the whole room, centred, with `padding` cm of breathing room on every side. */
export function fitView(
  viewportWidth: number,
  viewportHeight: number,
  room: { width: Cm; height: Cm },
  padding: Cm,
): View {
  const scale = Math.min(
    viewportWidth / (room.width + padding * 2),
    viewportHeight / (room.height + padding * 2),
  );
  return centredView(scale, viewportWidth, viewportHeight, room);
}
