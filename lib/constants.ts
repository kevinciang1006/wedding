export const SEAT_OFFSET = 35;      // cm from table edge to seat centre
export const SEAT_RADIUS = 20;      // cm, drawn radius of a seat circle
export const GRID_MINOR = 100;      // cm
export const GRID_MAJOR = 500;      // cm
export const GRID_SNAP_STEP = 25;   // cm
export const SNAP_PX = 8;           // screen px, divided by stage scale before use
export const SNAP_NEIGHBOUR_RANGE = 300; // cm
export const SEAT_DROP_RANGE = 40;  // cm
export const NUDGE = 10;            // cm
export const NUDGE_LARGE = 100;     // cm
export const DUPLICATE_OFFSET = 30; // cm
export const ROTATION_SNAP = 15;    // degrees while Shift is held
export const HISTORY_CAP = 100;
export const AUTOSAVE_MS = 1000;
export const LS_KEY = 'setting:doc:v1';
export const RULER_SIZE = 28;       // px
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 6;
export const GRID_HIDE_BELOW = 0.25;
export const FIT_PADDING = 150;     // cm of breathing room around the room on Shift+1 fit-to-room
export const ZOOM_KEY_STEP = 1.2;   // multiplicative scale factor per +/- keypress
export const SEAT_INITIALS_ABOVE = 0.6;
export const SEAT_NAMES_ABOVE = 1.0;
export const CM_PER_FOOT = 30.48;

// Object rendering (Task 9).
export const NAME_FONT_SIZE = 13;         // Newsreader "13 on canvas": table label, seat initials, seat name
export const DATA_FONT_SIZE = 9;          // IBM Plex Mono — table fill count
export const PROP_LABEL_FONT_SIZE = 10;   // IBM Plex Mono — prop label
export const DIETARY_DOT_SCREEN_PX = 2;   // screen px radius (4px diameter per spec), divided by stage scale before use
export const SEAT_NAME_GAP = 10;          // cm beyond SEAT_RADIUS where the outside name label sits
export const SEAT_NAME_LABEL_WIDTH = 220; // cm, generous centring box for the outside name label
export const SETTLE_MS = 320;
export const OUTSIDE_ROOM_OPACITY = 0.45;

// Selection and manipulation (Task 10). All *_PX constants are screen
// measures — divided by the current stage scale before use, same rule as
// SNAP_PX/DIETARY_DOT_SCREEN_PX above, since 1 Konva unit = 1 room cm here,
// not 1 screen px.
export const TRANSFORMER_ANCHOR_PX = 8;
export const TRANSFORMER_ANCHOR_STROKE_PX = 1.5;
export const TRANSFORMER_BORDER_PX = 1;
export const TRANSFORMER_BORDER_DASH_PX: [number, number] = [4, 4];
export const ROTATE_HANDLE_PX = 10;
export const ROTATE_HANDLE_OFFSET_PX = 32;
export const GUIDE_MARKER_PX = 13;

// Rulers and measurement readout (Task 11). RULER_* live inside a ruler's
// own small, unscaled Konva Stage (1 Konva unit = 1 screen px there) and are
// used as literal px. Everything else here is drawn inside the MAIN (scaled)
// Stage and is divided by stage scale before use — same rule as
// SNAP_PX/DIETARY_DOT_SCREEN_PX above.
export const RULER_MINOR_TICK_PX = 5;
export const RULER_MAJOR_TICK_PX = 10;
export const RULER_LABEL_FONT_PX = 9;
export const RULER_LABEL_INSET_PX = 3; // gap between a tick's line and its label
export const RULER_EXTENT_CAP_PX = 2;  // the selection-extent band's inner-edge cap

export const DRAG_CAP_PX = 18;           // full length of a live-drag distance line's end cap
export const MEASURE_BADGE_FONT_PX = 9.5; // live-drag badge + snap label text
export const MEASURE_BADGE_PAD_X_PX = 5;
export const MEASURE_BADGE_PAD_Y_PX = 1;
export const SNAP_LABEL_OFFSET_PX = 10;  // snap label's clearance from its guide's marker

// Guest-to-seat pointer drag (Task 14).
export const GUEST_DRAG_ARM_PX = 4; // screen px of movement before pointerdown becomes a drag, not a click

// Responsive breakpoints (Task 17), in CSS px. At or below PHONE_MAX_PX the
// app renders the read-only mobile viewer instead of the editor; between
// that and TABLET_MAX_PX it is the full editor with the palette and guest
// panel as slide-over sheets and pointer targets grown to 44px; above, the
// full editor with both panels docked. Read through `matchMedia`
// (components/mobile/useLayout.ts), never by CSS alone — the phone boundary
// decides whether a Konva editor stage is mounted at all, which no media
// query can express.
//
// The 44px target itself is not a constant here: it is only ever used by the
// `[data-touch]` rules in `app/globals.css`, and CSS cannot read a TS export.
// A second copy of the number living here that nothing imports would be a
// constant to keep in sync, not a source of truth.
export const PHONE_MAX_PX = 767;
export const TABLET_MAX_PX = 1023;

// The mobile viewer's plan window (Task 17): its fixed height, and the warm
// ring drawn around the searched guest's table. The ring measures are screen
// px — divided by stage scale before use, same rule as SNAP_PX above.
export const MOBILE_PLAN_HEIGHT_PX = 300;
export const MOBILE_RING_PX = 2;
export const MOBILE_RING_GLOW_PX = 5;
export const MOBILE_TABLEMATE_CHIPS = 5;
export const MOBILE_MATCH_LIST_MAX = 8;

// Empty state and first-load restore (Task 16). The top bar's room-width
// input needs a stable DOM id so the "Start empty" card can hand it focus
// after creating a blank doc — "sets the room size" means literally landing
// the user's cursor in that field, ready to type the venue's real
// dimensions, not just picking defaults silently.
export const ROOM_WIDTH_INPUT_ID = 'room-width-input';
