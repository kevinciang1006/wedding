# CLAUDE.md — working rules for this codebase

Setting is a floor-plan and seating-chart editor. It is a **drafting tool**, not
a diagram tool: the plan on screen is a measured drawing of a real room, and
almost every rule below follows from that one fact.

Read this before changing anything. Where a rule has a reason, the reason is the
rule — if you find yourself about to break one, the model is probably wrong
somewhere else.

## The invariants

**1 cm = 1 Konva unit.** Positions, dimensions and geometry are stored and
computed in centimetres and handed to Konva unchanged. Zoom and pan live *only*
on the `Stage` (`scaleX`, `scaleY`, `x`, `y`). There is no manual cm→px
conversion anywhere in the render path. A table is 180 units across because it
is 180 cm across.

**Anything measured in screen pixels is divided by the current stage scale
before use** — snap thresholds, hit tolerances, the dietary marker, ring widths.
The naming convention is `*_PX` in `lib/constants.ts`. A stroke that must not
grow with zoom uses `strokeScaleEnabled={false}` instead, which keeps it at a
literal screen width.

**Seats are derived, never stored.** A table stores its shape and a seat count;
`getSeats(obj)` (`lib/geometry/seats.ts`) computes the positions. Seat ids are
deterministic — `` `${tableId}:${index}` `` — which is what lets
`seatAssignments` be a flat `seatId -> guestId` map. Changing a table from 8
seats to 10 is a single field write, not a data migration.

**During a drag, never write to `docStore`.** Konva owns the node's position for
the whole gesture; the store is written exactly once, on `dragEnd`. This is why
a drag is one undo step and not sixty. Anything that must track a drag live
(alignment guides, the distance tape, the multi-select box, a ruler band) reads
`viewStore.dragDistance` and offsets the committed value by it — see
`components/canvas/Ruler.tsx` for the pattern.

**`commit(recipe, label)` is the only thing that may write to the document.**
Every mutation goes through it; nothing else touches `docStore`'s document
fields. `replaceDoc` exists for loading a document, and it *clears* history
rather than adding to it — opening a file is not an undoable edit.

**`Doc` is the entire persistent state.** Nothing else is saved. Autosave writes
to `localStorage` key `setting:doc:v1` on a 1 s debounce. If you add a field
that must survive a reload, it goes in `Doc` and in `isDoc`; if it must not, it
goes in `viewStore` or `uiStore`.

## The three stores

| Store | Holds | Persisted | Undoable |
|---|---|---|---|
| `docStore` | the `Doc` — room, objects, guests, seat assignments | yes | yes |
| `viewStore` | pan/zoom, **selection**, tool, transient drag state | no | no |
| `uiStore` | language, panels, filters, dialogs, toasts | no | no |

**Selection lives in `viewStore` specifically so that selecting is not
undoable.** `commit()` is the only path that creates a history entry and
`selectedIds` never passes through it. Pressing Cmd+Z after clicking a table
must undo that table's last *edit*, not silently deselect it.

## Colour has meaning

**Cool (`#1E62A8`) is tool state. Warm (`#B8762A`) is human state. They never
mix.** Cool never fills a shape a person occupies; warm never draws a tool
affordance. Selection, snap guides, focus rings and drop targets are cool.
Occupied seats, seated counts, the mobile viewer's "your table" ring are warm.
If you are reaching for a colour, first decide which of the two things you are
drawing.

Square corners everywhere. Border radius is `0` except for genuine circles
(seats, RSVP dots, the rotate handle).

## Code quality rules

- TypeScript strict. **No `any`, no non-null assertions (`!`), no `as` casts to
  escape a type error.** (`as const` on a literal is fine.) If a type fights
  you, fix the model. A validator that casts is not validating.
- Named exports everywhere except Next.js `page.tsx` / `layout.tsx`. **No barrel
  `index.ts` files.**
- **No `useEffect` for derived state.** Derive during render or in a selector.
  No bare `setState` in an effect body either — `useSyncExternalStore` or a lazy
  `useState` initializer covers nearly every case that tempts you
  (`components/mobile/useLayout.ts`, `components/chrome/TopBar.tsx`).
- **Zustand selectors must be narrow**: `useDocStore(s => s.objects[id])`, never
  `useDocStore(s => s.objects)`. Immer's structural sharing is what makes the
  narrow form bail out of re-renders; a wide selector throws that away. A
  selector that *builds* a value (an array, an object) needs `useShallow`, or it
  returns a fresh reference every call and loops.
- `useCallback` only where a handler crosses a memo boundary. Do not cargo-cult it.
- **Every function in `lib/geometry/` is pure** — plain data in, plain data out,
  no store access, no Konva. This is why they are the parts under unit test.
- Comments explain **why**, not what.
- No placeholders, no `// TODO`, no stubbed functions in delivered code.
- Every user-facing string goes through `useT()`. `en` and `es` have identical
  key sets, and the tests enforce it.
- Visible keyboard focus on every panel control. `prefers-reduced-motion` is
  respected (`app/globals.css` kills every animation under it).

## Two traps that have already cost time

**Cascade layers in `app/globals.css`.** Everything in that file is *unlayered*
and Tailwind's utilities are in `@layer utilities`. Unlayered rules always win
over layered ones **regardless of specificity**, so a Tailwind class can never
override the global control styles there. That is deliberate for the drafting
chrome (`border-radius: 0`, the focus ring), but it means any new rule matching
`button`/`input` must decide, on purpose, which way it should lose: put it in
`@layer base` if a component's own utility should be able to win.

**Konva arms drags from the global input stream**, independently of our React
handlers and not stopped by `preventDefault()`. `Konva.dragButtons` is consulted
only in that auto-arm path, never by an explicit `startDrag()`. `stopDrag()` is
*global* — it ends every active drag, not just one node's. Several fixes in this
codebase exist because of these three facts; see `components/canvas/CanvasStage.tsx`,
`useViewportKeyboard.ts` and `components/mobile/useMobileViewport.ts`.

## Verification

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

All four must pass, and `lint` must produce **zero output**, not merely zero
errors. `npm run build` needs network the first time in a session — `next/font`
fetches its font files at build time.

Rendering work is verified by running the app, not by unit tests: the pure
layers (`lib/geometry`, `lib/doc`, `lib/io`, `lib/units`) carry the tests, and
canvas behaviour is checked in a browser at real sizes. Before claiming a canvas
change works, look at it.
