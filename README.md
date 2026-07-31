# Setting

A floor-plan and seating-chart editor for weddings. Draw the room to its real
dimensions, place tables, drag guests into seats, and hand the caterer a PDF
that lists every table's guests by seat number.

It is built as a drafting tool rather than a diagram tool: the plan is a
measured drawing of a real room, so everything on it has a real size, rulers
frame the canvas, and the readout tells you the clearance between two tables in
metres or feet.

![Screenshot placeholder — the editor at 1440×900: top bar, object palette, the
room with twelve round tables and a head table, the guest panel on the right](docs/screenshot.png)

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint — must produce zero output
npm run test         # vitest run
npm run build        # needs network: next/font fetches at build time
```

There is no backend, no database and no account. The document lives in
`localStorage` and is exported as JSON, PNG or PDF.

## How it works, and why

**Real-world units — 1 cm = 1 Konva unit.** Positions and sizes are stored in
centimetres and handed to the canvas unchanged; zoom and pan live only on the
Konva `Stage` transform. The plan is a measured drawing, not a picture, so
"180" means 180 cm of table whatever the zoom happens to be. It also means the
PDF, the rulers and the clearance readout all read the same numbers the document
stores, with no conversion layer to disagree about.

**Seats are derived, never stored.** A table stores its shape and a seat count;
seat positions are computed from that (`lib/geometry/seats.ts`), with
deterministic ids of the form `tableId:index`. Changing a table from 8 seats to
10 is therefore one field write — not a migration that has to invent, place and
reconcile two new seat records. Seat assignments stay a flat `seatId -> guestId`
map, which is what makes "swap these two guests" a two-key edit.

**Patch-based history.** Every edit goes through one `commit(recipe, label)`
call, which runs the recipe through Immer and keeps the forward and inverse
patch sets (`lib/history/patchStack.ts`). Undo applies the inverse. A 120-guest
document is a substantial object graph and snapshotting it on every nudge would
be wasteful; a patch pair for "moved one table 10 cm" is a few dozen bytes. The
cap is 100 entries.

**Three-layer rendering.** The canvas is one `Stage` with three `Layer`s:
static (room and grid, cached to a bitmap), objects (tables, props, labels,
seats), overlay (selection, guides, the drag tape). Konva repaints a layer at a
time, so dragging a table never repaints the grid, and the grid's cache is
rebuilt only when the room's own size changes. The rulers are two further, small,
deliberately unscaled Stages beside the main one, which is what keeps a tick
aligned pixel-for-pixel with the coordinate it names.

**During a drag, nothing is written to the store.** Konva owns the node position
for the gesture and the document is committed exactly once on `dragEnd` — one
undo step per drag, and no React render in the pointer-move path.

**Three stores, split by lifetime.** `docStore` holds the document (persisted,
undoable); `viewStore` holds pan/zoom, selection and transient drag state;
`uiStore` holds language, panels and dialogs. Selection sits in `viewStore`
specifically so that clicking a table is not an undoable step.

### Why Konva

- **Fabric.js** — its React story is thin: it wants to own the DOM node and its
  own object model, which leaves you syncing two sources of truth by hand.
- **Pixi** — a game renderer. Excellent at throughput, but its hit-testing and
  scene model are not built for the CAD-ish work here (precise picking, snapping,
  transform handles, layer-granular repaint).
- **React Flow** — a graph layout tool. Its node model wants to position things
  for you; here positions are fixed real-world coordinates that the user sets,
  and fighting that would mean disabling most of what it does.

Konva gives a scene graph with real hit-testing, per-layer caching and repaint,
a transformer, and a React binding (`react-konva`) that treats the scene graph
as ordinary component tree — which is what this editor actually needs.

## Responsive behaviour

- **≥1024px** — the full editor, palette and guest panel docked.
- **768–1023px** — the full editor, with the palette and guest panel as
  slide-over sheets and pointer targets grown to 44px.
- **<768px** — a **read-only viewer**: a guest types their name and gets their
  table, their seat, a ring around that table on the plan, and the names of the
  people they are sitting with. The editor is not merely hidden at this width;
  it is never mounted.

## Known limitations

Stated plainly rather than buried:

- **The canvas is not keyboard-accessible in Phase 1.** Panel controls, fields
  and menus are keyboard-operable and have visible focus; the canvas itself is
  not. Selecting, moving and seating with the keyboard alone is not possible
  yet. This is the most significant gap in the product.
- **No mobile editing.** Below 768px the app is read-only by design.
- **No auth and no collaboration.** One document, one browser, no sharing beyond
  exporting a file.
- **Rectangular rooms only.** No L-shaped rooms, and no walls, doors or columns.
- The document lives in `localStorage`, so clearing site data loses it. Export
  the JSON if it matters.

## Deployment

Deployed on Vercel. The production domain is `setting.kevinciang.com`, pointed
at the Vercel deployment with a CNAME record.
