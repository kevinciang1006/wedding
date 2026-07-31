'use client';

import { useState } from 'react';
import { useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/lib/i18n/useT';
import { formatEventDate } from '@/lib/i18n/date';
import { MobilePlan } from '@/components/mobile/MobilePlan';
import { MobileSeatCard, MobileTablemates } from '@/components/mobile/MobileSeatCard';
import { findGuestsByName, lookupSeat } from '@/lib/doc/lookup';
import { formatDimensions } from '@/lib/units/format';
import { MOBILE_MATCH_LIST_MAX } from '@/lib/constants';
import type { Guest } from '@/lib/types/doc';

/** EN|ES, the same segmented control the top bar carries, at the phone's own scale. */
function LanguageToggle() {
  const t = useT();
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  return (
    <div role="group" aria-label={t('language')} className="flex h-6 shrink-0 border border-rule bg-paper">
      {(['en', 'es'] as const).map((code, i) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={`flex items-center px-[7px] font-[family-name:var(--font-data)] text-[10px] ${i > 0 ? 'border-l border-rule' : ''} ${
            language === code ? 'bg-ink text-paper' : 'bg-paper text-text-secondary'
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/**
 * The phone surface: one question ("where am I sitting?"), asked by typing a
 * name, answered with a table, a seat, a ring on the plan and the names of
 * the people either side.
 *
 * Read-only by construction rather than by discipline — this component
 * mounts no editor chrome at all, and the plan it does mount has hit-testing
 * switched off (see `MobilePlan`). The only writes it makes anywhere are to
 * `uiStore.language` and `viewStore`'s pan/zoom; `docStore.commit` is never
 * reachable from this tree.
 */
export function MobileViewer() {
  const t = useT();
  const language = useUiStore((s) => s.language);
  const title = useDocStore((s) => s.title);
  const eventDate = useDocStore((s) => s.eventDate);
  const room = useDocStore((s) => s.room);
  const units = useDocStore((s) => s.units);
  // Four narrow slices rather than the whole document: each is a stable
  // reference from Immer, so this never re-renders on an unrelated change.
  const guests = useDocStore((s) => s.guests);
  const guestOrder = useDocStore((s) => s.guestOrder);
  const objects = useDocStore((s) => s.objects);
  const seatAssignments = useDocStore((s) => s.seatAssignments);

  // Filtering happens per keystroke here, unlike every text field in the
  // editor (which commits on blur, because those write to the document).
  // Nothing is being written, and a guest hunting for their name should see
  // the list narrow as they type rather than have to dismiss the keyboard to
  // find out whether they guessed the spelling right.
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);

  const matches = findGuestsByName({ guests, guestOrder }, query);
  // A picked guest holds only while they are still among the matches, so
  // typing on after picking one clears the card instead of leaving a stale
  // answer on screen. A single match needs no picking.
  const picked: Guest | null = matches.length === 1
    ? matches[0]
    : matches.find((g) => g.id === pickedId) ?? null;
  const seat = picked ? lookupSeat({ guests, objects, seatAssignments }, picked.id) : null;

  const dateText = formatEventDate(language, eventDate, t('noDateSet'));
  const listed = matches.slice(0, MOBILE_MATCH_LIST_MAX);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-paper" data-touch="true">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-divider px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-[family-name:var(--font-name)] text-[19px] leading-tight text-ink">
            {title || t('untitledPlan')}
          </span>
          <span className="truncate font-[family-name:var(--font-data)] text-[10px] text-text-muted">
            {dateText} · {formatDimensions(room.width, room.height, units)}
          </span>
        </div>
        <span className="shrink-0 border border-rule px-[5px] py-0.5 font-[family-name:var(--font-data)] text-[9.5px] text-text-secondary">
          {t('viewOnly')}
        </span>
        <LanguageToggle />
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="shrink-0 px-4 pb-2.5 pt-3.5">
          {/* The input itself is the 48px box — `field-boxed` gives it the
              resting border (see `app/globals.css`), and the app's own focus
              style then rings that box. A bordered wrapper with a bare input
              inside, the pattern the editor's denser fields use, would ring
              the text node and leave the box around it unlit. */}
          <div className="relative">
            <input
              type="search"
              aria-label={t('findYourSeat')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="field-boxed h-12 w-full bg-paper pl-3 pr-14 font-[family-name:var(--font-ui)] text-[15px] text-ink outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query !== '' && (
              <button
                type="button"
                onClick={() => { setQuery(''); setPickedId(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-[family-name:var(--font-data)] text-[10px] text-text-muted"
              >
                {t('clear')}
              </button>
            )}
          </div>
          <p className="mt-2 font-[family-name:var(--font-ui)] text-[12px] text-text-secondary">{t('findYourSeat')}</p>
        </div>

        {query.trim() !== '' && matches.length === 0 && (
          <div className="mx-4 mt-1 flex flex-col gap-2.5 border border-divider p-4">
            <p className="font-[family-name:var(--font-ui)] text-[13px] font-semibold text-ink">{t('noGuestByName')}</p>
            <p className="font-[family-name:var(--font-ui)] text-[12.5px] leading-relaxed text-text-secondary text-pretty">
              {t('noGuestHelp')}
            </p>
          </div>
        )}

        {/* More than one guest can share a name — the sample wedding has such
            a pair — so the choice goes to the person who knows which one they
            are, rather than to whichever match happened to be first. */}
        {picked === null && matches.length > 1 && (
          <div className="mx-4 mt-1 flex flex-col border border-divider">
            <div className="border-b border-divider px-3 py-2 font-[family-name:var(--font-data)] text-[10px] uppercase tracking-[0.1em] text-text-muted">
              {t('matches', { count: matches.length })}
            </div>
            {listed.map((g) => {
              const where = lookupSeat({ guests, objects, seatAssignments }, g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setPickedId(g.id)}
                  className="flex items-baseline justify-between gap-3 border-b border-hairline px-3 py-2.5 text-left last:border-b-0"
                >
                  <span className="min-w-0 truncate font-[family-name:var(--font-ui)] text-[14px] text-ink">{g.name}</span>
                  <span className="shrink-0 font-[family-name:var(--font-data)] text-[10.5px] text-text-secondary">
                    {where ? where.tableLabel : t('unseated')}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {picked && <MobileSeatCard guest={picked} seat={seat} />}

        <MobilePlan tableId={seat ? seat.tableId : null} />

        {seat && <MobileTablemates tablemates={seat.tablemates} />}

        <div className="h-4 shrink-0" />
      </div>

      <footer className="shrink-0 border-t border-divider px-4 py-3 font-[family-name:var(--font-ui)] text-[12px] leading-relaxed text-text-muted text-pretty">
        {t('seatingMayChange')}
      </footer>
    </div>
  );
}
