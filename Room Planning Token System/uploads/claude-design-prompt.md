# Claude Design prompt — Setting

Paste the whole thing below into Claude Design.

---

Design the interface for **Setting**, a venue floor plan and seating chart editor for weddings. This is a working tool people spend hours inside, not a landing page.

## Who uses it

Two audiences with opposite instincts. **Wedding planners** are professionals running many events; they need precision, speed, and a plan they can hand to a caterer. **Couples** use it once, care enormously, and are easily intimidated by anything that looks like CAD software.

## The thesis

A precision instrument for an emotional job.

The tool itself behaves like a drafting application — real venue dimensions, snapping, keyboard shortcuts, a live measurement readout. All the warmth lives in the content: guest names, table names, the plan taking shape. The chrome must never get sentimental.

Design against the two obvious failure modes:

- **Not wedding-industry default.** No blush pink, no script or calligraphic display faces, no floral ornament, no gold foil, no eucalyptus green.
- **Not generic design-tool default.** Not a near-black canvas with one acid accent, not warm cream with a high-contrast serif and a terracotta accent, not a hairline-rule broadsheet grid. If the direction lands on any of these, change it.

The visual world to draw from instead: architectural drafting, venue floor plans, surveyor's marks, seating cards, linen, table settings.

## A color idea worth pushing on

Make color carry meaning rather than mood. Two accent families that never mix:

- **Cool** = tool state — selection, snap guides, measurements, active tool, focus rings
- **Warm** = human state — a seated guest, a filled seat, a group tag, RSVP confirmed

Then a person can read the plan's completeness at a glance: cool means the machine is talking, warm means a person is placed. Pick the actual hexes yourself, but hold that split. Canvas surface should be pale and cool enough that warm content reads as content.

## Typography

Three roles:

1. **UI** — dense, technical, legible at 12–14px in tight panels. Not Inter's regular width if you can find something with more character.
2. **Names on the plan** — this is the one place that gets warmth. A serif with real personality that still reads at small sizes on canvas. Not Playfair.
3. **Measurements and data** — monospace, for dimensions, coordinates, counts, keyboard shortcut hints.

## The signature element

The measurement system. Ruler gutters along the top and left edges of the canvas in real-world units, where the selected object's extent is highlighted on both rulers, plus a live readout showing its dimensions and rotation. This is what makes it a venue planner rather than a toy, so it should be the most considered thing on screen. Make it feel like an instrument.

## Screens to design

**1. The editor (desktop, primary).** Full-bleed canvas centre, left toolbar of objects to place, right panel with the guest list, top bar with room dimensions, unit toggle, undo/redo, zoom, export, and an EN/ES language switch. Show it mid-work: a partially seated 120-guest wedding, some tables full, some empty, one table selected with the transformer and the rulers highlighting its extent, and alignment guides visible from a drag in progress.

**2. The guest panel in detail.** Grouped by tag with collapse, dietary flags, RSVP status, a filter for unseated only, drag-handles on the chips, and the `142 guests · 118 seated · 24 unseated` counter. Show a chip mid-drag with the drop target seat highlighted.

**3. Empty state.** First load, before anything exists. It should invite an action, not apologise for being empty, and it needs to offer both "start from a sample wedding" and "start empty" without making either feel like the lesser option.

**4. Mobile viewer (<768px).** Read-only. Pan and zoom the plan, plus a search field answering "where am I sitting". This is the version a guest opens at the venue.

## Interaction details worth specifying

- What a seat looks like empty, hovered as a drop target, occupied, and occupied by someone with a dietary flag
- Alignment guide and snap feedback — this should feel crisp, not decorative
- The selected-object transformer handles, in a style consistent with the rulers
- The drag state of a guest chip leaving the panel and entering the canvas

## Copy

Write the real strings. Plain verbs, sentence case, active voice. Name things the way a wedding planner would — "table 4", "sweetheart table", "head table", "seat 7" — not the way the data model does. The export button says "Export plan" and produces a toast that says "Plan exported". Empty and error states explain what to do next.

## Constraints

- Responsive down to 768px for panels; canvas editing is desktop and tablet only
- Visible keyboard focus everywhere
- `prefers-reduced-motion` respected
- Motion should be restrained — a snap should feel mechanical and instant, a guest settling into a seat can have a little weight to it, nothing else should animate

Work out the token system first — 4–6 named colors, the three type roles with real faces and a scale, the layout structure — and check it against the two failure modes above before you build anything.
