# PRD — Setting

A venue floor plan and seating chart editor for weddings.

Working name: **Setting** (place setting / venue setting). Alternates: Banquette, Aisle, Placement.
Target URL: `setting.kevinciang.com` (Vercel + CNAME).

---

## 1. Why this exists

Two audiences with opposite needs:

- **Wedding planners** — professionals, use it weekly across many events, need precision (real venue dimensions), speed (keyboard-driven), and export they can hand to a caterer or venue manager.
- **Couples** — use it once, emotionally invested, need it to be legible and non-intimidating.

Existing tools split badly. Consumer tools (WeddingWire, Planning.Wedding) are approachable but imprecise and slow to operate. Professional tools (Prismm, Social Tables) are precise but priced and shaped for venues, not couples.

The product thesis: **a precision instrument for an emotional job.** The tool chrome behaves like a drafting application — real units, snapping, keyboard shortcuts, a live dimension readout. The warmth comes only from the content: guest names, table names, the plan itself.

## 2. Scope

### Phase 1 — the buildable demo (3–4 days)

Entirely client-side. No auth, no backend. State in memory + localStorage. This is what ships for the proposal.

### Phase 2 — the product (later)

Supabase auth, multi-event dashboard, share links, realtime collaboration, RSVP integration, print-ready escort cards.

Phase 1 must be architected so Phase 2 is an addition, not a rewrite. Specifically: the document model must be serialisable to a single JSON blob that can later become a Postgres row.

---

## 3. Phase 1 functional requirements

### 3.1 Canvas

- Pan: space + drag, middle-mouse drag, or two-finger trackpad scroll
- Zoom: `Ctrl/Cmd + wheel`, pinch, `+`/`-` keys, and a zoom control in the toolbar
- `Shift+1` fit to room, `Shift+0` reset to 100%
- Ruler gutters on the top and left edges showing real-world units, with tick marks that highlight the selected object's extent
- Grid rendered in real units (default 50cm), toggleable, snap-to-grid toggleable

### 3.2 The room

- Rectangular room with editable width/height in cm or ft (unit toggle, stored always in cm)
- Room outline rendered as a drafting-style boundary
- Objects can be dragged outside the room, but render at reduced opacity with a warning count in the toolbar

### 3.3 Objects

| Type | Configurable |
|---|---|
| Round table | diameter, seat count (1–16) |
| Rectangular table | width, height, seats per side |
| Sweetheart table | fixed 2 seats |
| Head table | length, seats on one side |
| Dance floor | width, height |
| Stage | width, height |
| Bar | width, height |
| Buffet | width, height |
| Text label | text content, font size |
| Custom rectangle | width, height, label |

Every object: position (cm), rotation (deg), label, z-order.

### 3.4 Manipulation

- Click to select; shift-click to add; marquee drag on empty canvas to multi-select
- Drag to move (single or multi)
- Konva `Transformer` for resize and rotate on non-table objects; tables resize via diameter/dimension inputs only (prevents non-uniform table scaling)
- Rotation snaps to 15° increments while `Shift` is held
- Alignment guides: when a dragged object's edge or centre comes within 8px of another object's edge or centre, show a guide line on the overlay layer and snap
- Arrow keys nudge 10cm, `Shift+arrow` nudges 100cm
- `Cmd+D` duplicate, `Delete` remove, `Cmd+A` select all, `Escape` deselect
- Bring forward / send backward via right-click context menu

### 3.5 Seats

**Seats are derived geometry, never stored objects.** A table stores shape + seat count; seat positions are computed from that.

- Round table: seats evenly distributed on a circle at `radius + 35cm`
- Rectangular table: seats distributed along the long edges
- Head table / sweetheart: seats on one side only
- Seat IDs are deterministic: `${tableId}:${index}`
- Empty seat renders as a hollow circle; occupied seat renders filled with the guest's initials, and the full name below the table when zoom > 60%

### 3.6 Guests

Right-hand panel.

- Add manually (name, group, dietary flag, RSVP status, +1)
- CSV import with column mapping (name / group / email / dietary / rsvp)
- Group by tag; collapse/expand groups
- Filter: unseated only, by group, by RSVP status
- Counter: `142 guests · 118 seated · 24 unseated`

### 3.7 Assignment

- Drag a guest chip from the panel onto a seat
- Drag a seated guest to another seat to swap or move
- Drag a seated guest off the table to unseat
- Click a seat to open a searchable dropdown of unseated guests
- "Seat this group here" — right-click a table, pick a group, fill remaining seats in order
- Assignment stored as `Record<seatId, guestId>`; guests are never nested inside tables

### 3.8 History

- `Cmd+Z` / `Cmd+Shift+Z`
- Implemented as an Immer patch stack (forward patches + inverse patches), capped at 100 entries
- Drags produce one history entry on `dragEnd`, not per frame
- History covers object changes and seat assignments; not view state (pan/zoom) or panel filters

### 3.9 Persistence and export

- Autosave the whole document to localStorage on a 1s debounce
- Export JSON / import JSON
- Export PNG: `stage.toDataURL({ pixelRatio: 3 })` with UI chrome hidden
- Export PDF: page 1 is the scaled floor plan with a dimension bar, page 2+ is a table-by-table guest list with dietary flags. jsPDF + the PNG at pixelRatio 3.

### 3.10 i18n

English and Spanish, toggled in the header. All UI strings in a flat dictionary. Celentie is a bilingual product; this is deliberate.

### 3.11 Responsive

- Desktop (≥1024px): full editor
- Tablet: full editor, larger hit targets, panels become sheets
- Mobile (<768px): read-only viewer with pan/zoom and a searchable "where am I sitting" lookup. Editing on a phone is a bad experience and shipping a bad one is worse than not shipping it.

### 3.12 Quality floor

- Visible keyboard focus on all panel controls
- `prefers-reduced-motion` respected
- Canvas is not keyboard-accessible in Phase 1 — state this in the README rather than pretending otherwise
- Empty state on first load: a pre-seeded 120-guest sample wedding, with a "start empty" option

---

## 4. Architecture

### 4.1 Stack

- Next.js 15 (App Router), React 19, TypeScript strict
- Tailwind + shadcn/ui for panels and chrome
- Zustand + Immer for document state
- react-konva for the canvas
- `papaparse` for CSV, `jspdf` for PDF
- Vitest for unit tests, deployed on Vercel

The canvas component is `'use client'` and loaded via `next/dynamic` with `ssr: false` — Konva requires `window`.

### 4.2 Document model

```ts
type Cm = number;

interface SceneObject {
  id: string;
  type: 'roundTable' | 'rectTable' | 'sweetheart' | 'headTable'
      | 'danceFloor' | 'stage' | 'bar' | 'buffet' | 'label' | 'rect';
  x: Cm; y: Cm;          // centre point, real-world
  rotation: number;      // degrees
  label: string;
  z: number;
  // discriminated per type
  diameter?: Cm;
  width?: Cm; height?: Cm;
  seatCount?: number;
  seatsPerSide?: number;
  fontSize?: number;
}

interface Guest {
  id: string;
  name: string;
  group: string | null;
  dietary: string | null;
  rsvp: 'yes' | 'no' | 'pending';
  plusOneOf: string | null;
}

interface Doc {
  version: 1;
  room: { width: Cm; height: Cm };
  units: 'cm' | 'ft';
  objects: Record<string, SceneObject>;
  objectOrder: string[];
  guests: Record<string, Guest>;
  guestOrder: string[];
  seatAssignments: Record<string, string>;   // seatId -> guestId
}
```

`Doc` is the entire serialisable state. Nothing else persists. In Phase 2 this becomes a `jsonb` column.

### 4.3 Store shape

Three separate Zustand slices, kept apart on purpose:

- `docStore` — the `Doc` above, all mutations via Immer producers that emit patches
- `viewStore` — pan, zoom, selection ids, active tool, snap toggles. Never in history, never persisted.
- `uiStore` — panel open/closed, filters, language

Selection lives in `viewStore`, not `docStore`, so selecting something is not undoable.

### 4.4 Rendering rules

Three Konva layers:

1. **Static** — room outline, grid, rulers. `listening={false}`. Redraws only on room or zoom change.
2. **Objects** — tables, props, seats, labels.
3. **Overlay** — selection outlines, transformer, alignment guides, marquee.

Performance rules to follow strictly:

- During a drag, do not write to `docStore`. Konva owns the node's position. Commit once on `dragEnd`.
- Seat geometry is memoised per `(type, dimensions, seatCount)` — recompute only when those change.
- Objects that haven't changed must not re-render: memoise each object component on its own slice of state, not on the whole `objects` record.
- Call `.cache()` on the static layer.

### 4.5 Snapping

On each drag frame, compute the dragged object's AABB and compare its left/centre-x/right and top/centre-y/bottom against the same six values for every other object within 300cm. Nearest match under 8 screen-px wins; snap the position and draw a guide on the overlay layer. Grid snap applies afterwards if enabled and no alignment snap fired.

### 4.6 Testing

Vitest, focused on the parts where bugs are invisible:

- Seat position computation for each table type and seat count
- Undo/redo round-trip: apply N operations, undo N times, assert document deep-equals the original
- CSV import column mapping and malformed-row handling
- Assignment invariants: no guest in two seats, no seat with two guests
- Real-world-unit to screen-px conversion at various zoom levels

Do not write tests for React rendering in Phase 1.

---

## 5. Out of scope for Phase 1

Stated explicitly so the build doesn't drift:

- Auth, accounts, multi-event
- Realtime collaboration
- Non-rectangular rooms, curved walls, columns
- Venue floor plan image import and tracing
- Automatic seating optimisation
- Escort card / place card printing
- Mobile editing
