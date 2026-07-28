# Claude Code build prompt — Setting

Paste everything below into Claude Code. Fill the DESIGN TOKENS block first.

---

**Do not write any code until I have reviewed and approved a plan.**

Enter plan mode. Read this entire brief, then produce a build plan covering: the file tree you intend to create, the order you'll build in, the exact package versions you'll install, and any point where this brief is ambiguous or where you disagree with an architectural decision. Wait for my approval. Only then start writing files.

---

## 1. What we're building

**Setting** — a venue floor plan and seating chart editor for weddings. Canvas-based drag-and-drop: place tables and props on a scaled floor plan, then drag guests from a list onto individual seats. Entirely client-side; no backend, no auth.

It is a working tool people spend hours inside, not a landing page.

## 2. Design tokens

Derive every color, typeface, size, and spacing decision from the block below. Do not invent tokens. If something isn't specified there, pick the option most consistent with what is, and note it in your plan.

```
<<<PASTE THE CLAUDE DESIGN OUTPUT HERE — palette hexes, typefaces and scale,
spacing system, layout structure, component styling notes>>>
```

Two rules that hold regardless of what's in that block:

- Cool accents mean tool state (selection, snap guides, measurements, focus). Warm accents mean human state (a seated guest, a filled seat, a group tag). They never mix.
- The chrome stays technical. Warmth appears only in content — guest names, table names.

## 3. Stack

- Next.js 15, App Router, TypeScript strict mode
- React 19
- Tailwind CSS + shadcn/ui
- Zustand + Immer for state
- `konva` + `react-konva` for the canvas
- `papaparse` for CSV, `jspdf` + `jspdf-autotable` for PDF
- Vitest for unit tests

Install the latest `konva` and `react-konva`, and verify react-konva's React peer dependency actually resolves against React 19 before proceeding. If it doesn't, tell me — do not paper over it with `--force` or `--legacy-peer-deps`.

### Two setup gotchas to handle up front

**Konva needs `window`.** The canvas root must be a client component loaded via `next/dynamic` with `ssr: false`. Nothing that imports `konva` may be reachable from a server component.

**Konva tries to require node-canvas during bundling.** Add to `next.config.ts`:

```ts
webpack: (config) => {
  config.externals = [...(config.externals ?? []), { canvas: 'canvas' }];
  return config;
}
```

If the project uses Turbopack, use `turbopack.resolveAlias` to stub `canvas` instead. Confirm the dev server starts clean before building anything else.

## 4. The single most important convention

**1 cm = 1 Konva unit.**

All object positions, dimensions, and geometry are stored and computed in centimetres, and passed to Konva unchanged. Zoom and pan live entirely on the `Stage` (`scaleX`, `scaleY`, `x`, `y`). There is no manual cm→px conversion anywhere in the render path.

Consequences to respect:

- A 12m × 8m room is a 1200 × 800 Konva rectangle. Default view is zoom-to-fit, roughly 0.5 scale.
- Anything measured in screen pixels (snap thresholds, hit tolerances, stroke widths that must not scale) divides by the current stage scale.
- Imperial display is a formatting concern only. `units: 'ft'` changes what the UI renders; it never changes what's stored.

## 5. Domain model

```ts
type Cm = number;

type ObjectType =
  | 'roundTable' | 'rectTable' | 'sweetheart' | 'headTable'
  | 'danceFloor' | 'stage' | 'bar' | 'buffet' | 'label' | 'rect';

interface SceneObject {
  id: string;
  type: ObjectType;
  x: Cm;              // centre point
  y: Cm;              // centre point
  rotation: number;   // degrees, clockwise
  label: string;
  z: number;
  diameter?: Cm;      // roundTable
  width?: Cm;         // rect-shaped types
  height?: Cm;        // rect-shaped types
  seatCount?: number;      // roundTable, headTable, sweetheart
  seatsPerSide?: number;   // rectTable
  fontSize?: number;       // label
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
  objectOrder: string[];       // z-order, back to front
  guests: Record<string, Guest>;
  guestOrder: string[];
  seatAssignments: Record<string, string>;  // seatId -> guestId
}
```

`Doc` is the entire persistent state. Nothing else is saved. Type it with a discriminated union on `type` rather than the optional-field soup above if you can do it cleanly — the optional fields are illustrative, not prescriptive.

## 6. Seats are derived, never stored

This is non-negotiable and it's the decision the whole app hangs on. A table stores its shape and seat count. Seat positions are computed from that on demand. Changing a table from 8 seats to 10 is then a single field write, not a data migration.

Seat IDs are deterministic: `` `${tableId}:${index}` ``.

Implement in `lib/geometry/seats.ts`:

```ts
interface Seat { id: string; index: number; x: Cm; y: Cm; angle: number; }
function getSeats(obj: SceneObject): Seat[];  // world coordinates
```

Geometry, with `SEAT_OFFSET = 35` (cm from table edge to seat centre):

- **roundTable** — seat `i` of `n` at angle `(2π · i / n) − π/2`, at radius `diameter/2 + SEAT_OFFSET`. Starting at −π/2 puts seat 1 at the top.
- **rectTable** — `seatsPerSide` seats along each long edge. Along one edge: `y = ±(height/2 + SEAT_OFFSET)`, and seat `k` at `x = −width/2 + (width / seatsPerSide) · (k + 0.5)`. Index seats down one side then back along the other.
- **headTable** — `seatCount` seats on one long edge only, at `y = −(height/2 + SEAT_OFFSET)`, so guests face into the room. Same spacing formula.
- **sweetheart** — exactly 2 seats, one edge, same rule.
- Everything else returns `[]`.

Compute local coordinates first, then rotate each by the object's `rotation` about the origin and translate by the object's `x`/`y`. A seat's `angle` is the direction it faces (toward the table centre) and is used to orient the name label.

Memoise on `(type, diameter, width, height, seatCount, seatsPerSide)` — position and rotation are applied afterwards, so moving a table must not invalidate the cache.

## 7. Store architecture

Three separate Zustand stores. Keeping them apart is deliberate.

**`stores/docStore.ts`** — holds `Doc`. Every mutation goes through one function:

```ts
commit(recipe: (draft: Doc) => void, label: string): void
```

`commit` uses Immer's `produceWithPatches`, applies the next state, and pushes `{ patches, inversePatches, label }` onto the history stack. Nothing else may write to the doc.

Autosave to `localStorage` on a 1s debounce, keyed `setting:doc:v1`.

**`stores/viewStore.ts`** — pan, zoom, `selectedIds: string[]`, active tool, snap-to-grid on/off, grid visible, marquee rect, active alignment guides. Never persisted, never in history. Selection lives here specifically so that selecting something is not undoable.

**`stores/uiStore.ts`** — panel open/closed, guest filters, language, dialogs.

### History

`lib/history/patchStack.ts`. Two arrays of `{ patches, inversePatches, label }`, undo and redo. `undo()` applies the top entry's inverse patches and moves it to the redo stack; any new commit clears redo. Cap at 100 entries. `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z`.

A drag produces exactly one history entry, on `dragEnd`. Not one per frame.

## 8. Canvas rendering

Three Konva `Layer`s inside one `Stage`, in this order:

1. **Static** — room outline, grid. `listening={false}`. Grid drawn at 50cm intervals within the room bounds only, hidden entirely when stage scale < 0.25. Call `.cache()` on it and invalidate only when room dimensions or grid settings change.
2. **Objects** — tables, props, seats, labels.
3. **Overlay** — selection outlines, `Transformer`, alignment guides, marquee rectangle.

### Performance rules — follow these strictly

- **During a drag, do not write to `docStore`.** Set `draggable` on the node and let Konva own its position. On `dragMove`, compute snapping and update only `viewStore.activeGuides`. On `dragEnd`, read `node.x()` / `node.y()` and `commit` once.
- Each object is its own memoised component subscribed to `state.objects[id]` via a selector — never to the whole `objects` record. Moving one table must not re-render the other thirty-nine.
- Multi-select drag: on `dragMove` of the grabbed node, apply the same delta imperatively to the other selected nodes via refs. Commit all of them in a single `commit` on `dragEnd`.
- Seat labels render only when stage scale > 0.6. Below that, seats are dots.

### Rulers

Two separate small Konva `Stage`s outside the main one — top (full width × 24px) and left (24px × full height) — reading pan and zoom from `viewStore`. Ticks at 100cm with labels, minor ticks at 50cm. When exactly one object is selected, highlight that object's extent on both rulers using the cool accent. This is the signature element of the interface; give it real attention.

### Snapping — `lib/geometry/snap.ts`

On each `dragMove`, build the dragged object's axis-aligned bounding box and extract six candidate values: left, centre-x, right, top, centre-y, bottom. Compare against the same six for every other object whose centre is within 300cm. Threshold is `8 / stageScale` in cm. Nearest match on each axis wins; snap the position and emit a guide line spanning both objects.

Grid snap applies only if enabled and no alignment snap fired on that axis. Rotation snaps to 15° increments while `Shift` is held.

## 9. Interaction spec

**Canvas**
- Pan: space+drag, middle-mouse drag, two-finger trackpad scroll
- Zoom: `Ctrl/Cmd+wheel`, pinch, `+` / `-`; zoom toward the pointer, not the origin
- `Shift+1` fit to room, `Shift+0` reset to 100%
- Click select, shift-click add to selection, marquee drag on empty canvas, `Escape` deselect

**Objects**
- `Transformer` with resize and rotate for props (danceFloor, stage, bar, buffet, rect, label)
- Tables get rotate only — their dimensions change through the inspector, never by dragging a handle. This prevents non-uniform table scaling, which is meaningless for a real table.
- Arrow keys nudge 10cm, `Shift+arrow` 100cm
- `Cmd+D` duplicate (offset 30cm), `Delete` remove, `Cmd+A` select all
- Right-click context menu: bring forward, send backward, duplicate, delete, and for tables "seat a group here"

**Seats**
- Empty: hollow circle. Hovered as a drop target: cool accent ring. Occupied: filled warm, showing initials. Occupied with a dietary flag: a small marker.
- Click an occupied seat to unseat or swap; click an empty seat to open a searchable dropdown of unseated guests.

**Guest assignment**
- HTML5-free drag: use pointer events. A guest chip dragged from the panel follows the cursor; on entering the canvas, hit-test seat positions and highlight the nearest within 40cm; on release, assign.
- Dragging a seated guest to another seat moves them, or swaps if that seat is occupied.
- Dragging a seated guest off any table unseats them.
- Invariant, enforced in the store: a guest occupies at most one seat, a seat holds at most one guest.

## 10. Panels

**Top bar** — room width/height inputs, cm/ft toggle, undo/redo, zoom control, export menu (PNG / PDF / JSON), import JSON, EN/ES switch.

**Left toolbar** — the object palette. Click to place at viewport centre, or drag onto the canvas.

**Right panel — guests** — add guest form, CSV import, list grouped by tag with collapse, per-guest dietary flag and RSVP status, filters (unseated only, by group, by RSVP), and a counter reading `142 guests · 118 seated · 24 unseated`.

**Inspector** — appears when exactly one object is selected. Label, position, dimensions or diameter, seat count, rotation. All in the active unit. Editing a field commits immediately.

## 11. Import, export, i18n

**CSV** (`lib/io/csv.ts`) — papaparse with header detection, then a column-mapping dialog (name / group / email / dietary / rsvp). Malformed rows are reported by row number, not silently dropped.

**PNG** (`lib/io/png.ts`) — hide the overlay layer, `stage.toDataURL({ pixelRatio: 3, ...roomBounds })`, restore.

**PDF** (`lib/io/pdf.ts`) — A4 landscape. Page 1: the plan image with a dimension bar showing the room size. Page 2+: `jspdf-autotable`, one section per table, listing seat number, guest name, and dietary flag. This is the artefact a caterer receives, so it has to be legible on its own.

**JSON** — export and import the raw `Doc`, validated on import against the version field.

**i18n** (`lib/i18n/`) — no library. Flat `en` and `es` dictionaries with identical key sets, and a `useT()` hook reading language from `uiStore`. Every user-facing string goes through it. Add a test asserting the two dictionaries have matching keys.

## 12. Responsive

- ≥1024px: full editor
- 768–1023px: full editor, panels become slide-over sheets, larger hit targets
- <768px: `components/mobile/MobileViewer.tsx` — read-only. Pan and zoom the plan plus a search field answering "where am I sitting". Editing on a phone is a bad experience; shipping a bad one is worse than not shipping it.

## 13. Empty state and sample data

On first load with no saved document, show an empty state offering "Start from a sample wedding" and "Start empty" as equal options. `lib/sample/sampleWedding.ts` generates a realistic 120-guest wedding: a 14m × 10m room, one sweetheart table, twelve round tables of ten, a head table, dance floor, stage, bar, buffet, guests across six named groups with a scattering of dietary flags, and about 80% of them already seated.

## 14. Code quality

- TypeScript strict. **No `any`, no non-null assertions, no `as` casts to escape a type error.** If a type is fighting you, the model is wrong — fix the model.
- Named exports everywhere except Next.js page and layout files.
- No barrel `index.ts` files.
- No `useEffect` for derived state. Derive during render or with a selector.
- Zustand selectors must be narrow. `useDocStore(s => s.objects[id])`, never `useDocStore(s => s.objects)`.
- Event handlers wrapped in `useCallback` only where they cross a memo boundary. Don't cargo-cult it everywhere.
- Every geometry function is pure, takes plain data, and returns plain data. No store access inside `lib/geometry/`.
- Comments explain why, not what. Do not narrate the code.

## 15. Tests

Vitest, targeting the places where bugs are invisible in the UI:

- `seats.ts` — position and count for every table type across seat counts 1–16, and correctness under rotation
- History — apply 20 mixed operations, undo 20 times, assert the document deep-equals the initial state; then redo 20 and assert it equals the final state
- `snap.ts` — alignment detection at threshold boundaries, and that grid snap defers to alignment snap
- CSV import — column mapping, malformed rows, duplicate names, empty file
- Assignment invariants — no guest in two seats, no seat with two guests, across a randomised sequence of assign/move/swap/unseat
- Unit conversion — cm↔ft formatting round-trips
- i18n key parity

No React rendering tests.

## 16. Out of scope — do not build these

Auth, accounts, multi-event, realtime collaboration, non-rectangular rooms, walls, columns, floor plan image import, automatic seating optimisation, escort card printing, mobile editing.

## 17. Deliverables

Complete, working files. No placeholders, no `// TODO`, no stubbed functions.

A `CLAUDE.md` at the root capturing: the 1cm = 1 Konva unit rule, the derived-seats rule, the no-writes-during-drag rule, the store separation, and the code quality rules above — so future sessions don't violate them.

A `README.md` with: what it is, a screenshot placeholder, local setup, the architecture decisions and why (real-world units, derived seats, patch-based history, three-layer rendering, why Konva over Fabric/Pixi/React Flow), the known limitations including that the canvas is not keyboard-accessible, and deployment steps.

Deploy target is Vercel with a custom domain. Include a GitHub Actions workflow running typecheck, lint, and tests on push.

---

Produce the plan now. Do not write code.
