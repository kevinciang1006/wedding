// Konva cannot read CSS custom properties, so canvas colours live here and are
// kept in sync with app/globals.css by hand. One module so later canvas work
// does not re-invent hex literals per component.
export const CANVAS_SURROUND = '#E8EDEF';
export const ROOM_FILL = '#FFFFFF';
export const ROOM_WALL = '#2B343A';
export const GRID_MINOR_COLOR = '#EDF1F3';
export const GRID_MAJOR_COLOR = '#E2E9EC';
export const COOL = '#1E62A8';
export const OBJECT_STROKE = '#B7C3CA';

// --- Table plate & canvas text -------------------------------------------
export const INK = '#171B1F';            // table label, text label
export const TEXT_MUTED = '#8A959C';     // fill count: no one seated yet
export const TEXT_SECONDARY = '#5B676F'; // fill count: partially filled; prop label
export const WARM = '#B8762A';           // fill count: full; occupied-seat stroke

// --- Seats -----------------------------------------------------------------
export const SEAT_EMPTY_STROKE = '#C3CDD3';
export const SEAT_DROP_FILL = '#E4EFF9';
export const SEAT_DROP_RING = 'rgba(30, 98, 168, 0.16)';
export const SEAT_OCCUPIED_FILL = '#EBD7B4';
export const FLAG = '#8E3B2F'; // dietary marker only

// --- Props -------------------------------------------------------------
export const PROP_FILL = '#F2F5F7';
export const HATCH_BAND = '#F6F8F9'; // dance floor's darker hatch band; the lighter band reuses ROOM_FILL

let cachedNameFont: string | null = null;
let cachedDataFont: string | null = null;

function resolveFontVar(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value === '' ? fallback : value;
}

/**
 * Konva draws text through the Canvas 2D `font` string, which — unlike DOM
 * CSS — cannot resolve `var(--font-name)`. The resolved value is read once
 * from the already-loaded `next/font` stylesheet and cached for the
 * session rather than requeried on every Text node.
 */
export function canvasNameFont(): string {
  cachedNameFont ??= resolveFontVar('--font-name', 'Georgia, serif');
  return cachedNameFont;
}

export function canvasDataFont(): string {
  cachedDataFont ??= resolveFontVar('--font-data', 'ui-monospace, monospace');
  return cachedDataFont;
}
