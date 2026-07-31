'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { useT } from '@/lib/i18n/useT';
import { seatIndexOfSeat, seatOfGuest, tableIdOfSeat } from '@/lib/doc/assignments';

interface Candidate { id: string; name: string; tableLabel: string | null; seatIndex: number | null }
interface SeatMenuTarget { seatId: string; x: number; y: number }

/**
 * The click-driven counterpart to Task 14's pointer drag: a plain click on a
 * seat (one that never crossed `startGuestDrag`'s arm threshold — see
 * `SeatNode.tsx`'s own header) opens this instead of starting a drag, so
 * assigning a guest is possible without ever picking anything up. Plain
 * HTML, positioned at the click's screen coordinates exactly like
 * `ContextMenu.tsx`, and closes the same way that one does: any pointerdown
 * outside it, or `Escape` (wired in `useKeyboard.ts`).
 *
 * Split into this thin shell plus `SeatMenuPanel` below purely so the
 * search text resets for free: `key={menu.seatId}` on the panel makes React
 * unmount and remount it — a fresh `useState('')` — every time the target
 * seat changes, rather than a `useEffect` that calls `setState` to reset it
 * (the lint-flagged "cascading render" anti-pattern React itself now warns
 * against). Every hook that only makes sense once a seat is actually chosen
 * (the doc-store reads, the outside-click listener, the autofocus) lives in
 * the panel too, so this shell stays a one-line gate.
 */
export function SeatMenu() {
  const menu = useViewStore((s) => s.seatMenu);
  if (!menu) return null;
  return <SeatMenuPanel key={menu.seatId} menu={menu} />;
}

/**
 * One seat's candidate list is never every guest: an EMPTY seat only offers
 * guests who are currently unseated (mirrors `seatingCounts`' own
 * definition — not seated, not declined); an OCCUPIED seat additionally
 * offers every OTHER seated guest, since picking one there is a swap, not
 * an assignment — either way `docStore.seatGuest` is the one call that
 * commits it, and `assignSeat` (Task 6) is what actually decides whether
 * that lands as a move, a swap, or a displacement. Declined guests never
 * appear in either list, matching every other bulk-seating action
 * (`seatAllRemaining`, `seatGroupAt`) already in this doc.
 */
function SeatMenuPanel({ menu }: { menu: SeatMenuTarget }) {
  const t = useT();
  const close = useViewStore((s) => s.closeSeatMenu);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const seatContext = useDocStore(useShallow((s) => {
    const table = s.objects[tableIdOfSeat(menu.seatId)];
    return { tableLabel: table?.label ?? null, seatIndex: seatIndexOfSeat(menu.seatId) };
  }));
  const occupant = useDocStore((s) => {
    const guestId = s.seatAssignments[menu.seatId];
    return guestId ? (s.guests[guestId] ?? null) : null;
  });
  // Four narrow, reference-stable reads (Immer keeps each of these the same
  // object across a commit that doesn't touch it) rather than one
  // `useShallow`-wrapped selector building `Candidate[]` directly: `useShallow`
  // only shallow-compares ONE level deep, and an array of freshly-`.map()`ed
  // plain objects never satisfies that — each element is a new object every
  // call even when its contents are identical, so the store would report a
  // "changed" snapshot on every read and React's own `useSyncExternalStore`
  // guard turns that into an infinite render loop (caught live in browser
  // verification, not just reasoned about — see the Task 14 report). Deriving
  // `candidates` as a plain computation in the render body below, from these
  // stable inputs, sidesteps the whole class of bug: Zustand never has to
  // decide whether the *array* changed, only whether `guests`/`seatAssignments`
  // /`objects`/`guestOrder` did.
  const guests = useDocStore((s) => s.guests);
  const seatAssignments = useDocStore((s) => s.seatAssignments);
  const objects = useDocStore((s) => s.objects);
  const guestOrder = useDocStore((s) => s.guestOrder);

  const occupantId = seatAssignments[menu.seatId] ?? null;
  const candidates: Candidate[] = guestOrder
    .filter((id) => id !== occupantId)
    .map((id) => guests[id])
    .filter((g) => g !== undefined && g.rsvp !== 'no')
    .filter((g) => occupantId !== null || seatOfGuest(seatAssignments, g.id) === null)
    .map((g) => {
      const seatId = seatOfGuest(seatAssignments, g.id);
      const table = seatId ? objects[tableIdOfSeat(seatId)] : undefined;
      return { id: g.id, name: g.name, tableLabel: table?.label ?? null, seatIndex: seatId ? seatIndexOfSeat(seatId) : null };
    });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Same convention as ContextMenu.tsx: registered only while open, and the
  // opening click has already finished dispatching by the time this effect
  // runs, so it never immediately closes the menu it just opened.
  useEffect(() => {
    function handlePointerDown(): void {
      close();
    }
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [close]);

  const filtered = candidates.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));

  function pick(guestId: string): void {
    useDocStore.getState().seatGuest(menu.seatId, guestId);
    useViewStore.getState().setJustSeated(menu.seatId);
    close();
  }

  function handleUnseat(): void {
    if (!occupant) return;
    useDocStore.getState().unseat(occupant.id);
    close();
  }

  return (
    <div
      className="fixed z-50 w-60 border border-panel-border bg-paper shadow-screen"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="border-b border-hairline px-3 py-2">
        {seatContext.tableLabel !== null && (
          <div className="truncate font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-ink">
            {seatContext.tableLabel}
          </div>
        )}
        <div className="font-[family-name:var(--font-data)] text-[9px] text-text-muted">
          {t('seatNumber', { n: seatContext.seatIndex + 1 })}
        </div>
      </div>

      {occupant !== null && (
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-[family-name:var(--font-data)] text-[9px] text-text-muted">{t('seatedHere')}</span>
            <span className="truncate font-[family-name:var(--font-name)] text-[13px] text-ink">{occupant.name}</span>
          </div>
          <button
            type="button"
            onClick={handleUnseat}
            className="shrink-0 font-[family-name:var(--font-ui)] text-[11.5px] font-medium text-cool"
          >
            {t('unseat')}
          </button>
        </div>
      )}

      <div className="px-2 pt-2">
        <input
          ref={inputRef}
          type="text"
          aria-label={t('searchGuests')}
          placeholder={t('searchGuests')}
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          // useKeyboard.ts's global Escape handler bails on any editable
          // target (isEditableTarget) before it ever reaches its own
          // closeSeatMenu() call, precisely so it never steps on a field's
          // own Escape semantics (the same reason `useCommitField` owns its
          // input's Escape locally) — but this input autofocuses the instant
          // the menu opens, so without a local handler here Escape would
          // silently do nothing for the one control most likely to have
          // focus. Handled here instead, not by special-casing Escape in the
          // shared guard, which would also change Escape's behaviour for
          // every OTHER editable-target-guarded field in the app.
          onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
          className="h-6 w-full border border-rule bg-paper px-1.5 font-[family-name:var(--font-ui)] text-[12px] text-ink outline-none"
        />
      </div>

      <div className="max-h-56 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <div className="px-1 py-1.5 font-[family-name:var(--font-ui)] text-[11.5px] text-text-muted">
            {t('noMatchingGuests')}
          </div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              className="flex w-full items-center justify-between gap-2 px-1 py-1.5 text-left hover:bg-cool-tint"
            >
              <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-name)] text-[12.5px] text-ink">
                {c.name}
              </span>
              {c.tableLabel !== null && c.seatIndex !== null && (
                <span className="shrink-0 font-[family-name:var(--font-data)] text-[9.5px] text-text-secondary">
                  {c.tableLabel}·{c.seatIndex + 1}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
