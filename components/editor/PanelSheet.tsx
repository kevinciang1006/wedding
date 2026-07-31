'use client';

import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/useT';

export type SheetName = 'palette' | 'guests';

interface SheetBarProps {
  open: SheetName | null;
  onToggle: (sheet: SheetName) => void;
}

/**
 * The 44px strip under the top bar that opens the two panels on a tablet.
 * Named buttons rather than glyphs: a 44px icon on a rail would have to
 * invent a pictogram for "palette", and this app draws its object glyphs
 * from bordered divs precisely because it has no icon vocabulary to lean on.
 * Both labels come from the dictionary already (`Place`, `Guests`), so this
 * costs no new strings in either language.
 */
export function SheetBar({ open, onToggle }: SheetBarProps) {
  const t = useT();
  const items: { name: SheetName; label: string }[] = [
    { name: 'palette', label: t('place') },
    { name: 'guests', label: t('guests') },
  ];

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-panel-border bg-toolbar px-2">
      {items.map((item) => (
        <button
          key={item.name}
          type="button"
          onClick={() => onToggle(item.name)}
          aria-expanded={open === item.name}
          className={`flex h-8 items-center px-3 font-[family-name:var(--font-ui)] text-[12.5px] ${
            open === item.name ? 'border border-ink bg-ink text-paper' : 'border border-rule bg-paper text-ink'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface PanelSheetProps {
  side: 'left' | 'right';
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A docked panel, slid over the canvas instead of taking a permanent 200 or
 * 320px bite out of a 768–1023px viewport. The panel inside is the exact
 * same component the desktop docks — it is where it sits that changes, not
 * what it is.
 *
 * The close control is its own 44px column beside the panel rather than a
 * `×` floated into a corner: both panels already put controls in their top
 * corners (the guest panel's Add/Import, the palette's section heading), and
 * an overlaid button would sit on top of one of them.
 *
 * No Escape handler here on purpose. `useKeyboard` already owns Escape for
 * the canvas (clearing the selection and cancelling a pending tool), and
 * this surface is reached by touch, where there is no Escape key to reach
 * for. The scrim, the close column and the bar's own toggle are the three
 * ways out.
 */
export function PanelSheet({ side, label, onClose, children }: PanelSheetProps) {
  const t = useT();
  return (
    <>
      <div className="absolute inset-0 z-10 bg-ink/20" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={label}
        className={`absolute inset-y-0 z-20 flex shadow-screen ${side === 'left' ? 'left-0' : 'right-0 flex-row-reverse'}`}
      >
        {children}
        <div className={`flex w-11 shrink-0 justify-center bg-paper pt-2 ${side === 'left' ? 'border-r' : 'border-l'} border-panel-border`}>
          <button
            type="button"
            aria-label={t('cancelAction')}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-[15px] text-text-body"
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}
