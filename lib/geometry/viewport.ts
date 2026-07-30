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
