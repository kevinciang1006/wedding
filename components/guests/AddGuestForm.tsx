'use client';

import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useDocStore } from '@/stores/docStore';
import { useT } from '@/lib/i18n/useT';
import type { Guest, Rsvp } from '@/lib/types/doc';

interface AddGuestFormProps { open: boolean; onClose: () => void }

interface Draft { name: string; group: string; dietary: string; rsvp: Rsvp }

const EMPTY_DRAFT: Draft = { name: '', group: '', dietary: '', rsvp: 'pending' };

const RSVP_OPTIONS: { value: Rsvp; labelKey: 'rsvpYes' | 'rsvpNo' | 'rsvpPending' }[] = [
  { value: 'pending', labelKey: 'rsvpPending' },
  { value: 'yes', labelKey: 'rsvpYes' },
  { value: 'no', labelKey: 'rsvpNo' },
];

function isRsvp(value: string): value is Rsvp {
  return value === 'yes' || value === 'no' || value === 'pending';
}

let counter = 0;

/** Same shape as `lib/io/csv.ts`'s private `nextGuestId` and `lib/doc/factory.ts`'s `nextId` — each id-producing module keeps its own counter rather than sharing one, and the millisecond-plus-counter pair makes two independently-running counters colliding a non-issue in practice. */
function nextGuestId(): string {
  counter += 1;
  return `guest-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/**
 * Plain controlled inputs, not `useCommitField`: that hook buffers a field
 * locally and only writes out on blur, which is exactly right for editing
 * one field of an *existing*, already-canonical value (every Inspector
 * field, the top bar's room dims) — but wrong here. This form's whole
 * point is that all four fields land in the doc together, as the *one*
 * `commit` a fresh "Add guest" click produces; gating that commit on
 * `useCommitField`'s buffered `text` would mean the Add button stays
 * disabled on whatever the user just typed until they tab away first, and
 * committing per-field on blur would turn one guest into several history
 * entries. `GuestFilters.tsx`'s search field is where this codebase's
 * `useCommitField` reuse actually lives — see its own comment for why that
 * one *does* fit.
 */
export function AddGuestForm({ open, onClose }: AddGuestFormProps) {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  if (!open) return null;

  function setField<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit(): void {
    const name = draft.name.trim();
    if (name === '') return;
    const guest: Guest = {
      id: nextGuestId(),
      name,
      group: draft.group.trim() === '' ? null : draft.group.trim(),
      dietary: draft.dietary.trim() === '' ? null : draft.dietary.trim().toUpperCase(),
      rsvp: draft.rsvp,
      plusOneOf: null,
    };
    // One commit for the whole guest — the required "adding is one history
    // entry" rule — not one per field.
    useDocStore.getState().commit((d) => {
      d.guests[guest.id] = guest;
      d.guestOrder.push(guest.id);
    }, 'add guest');
    setDraft(EMPTY_DRAFT);
    onClose();
  }

  function handleCancel(): void {
    setDraft(EMPTY_DRAFT);
    onClose();
  }

  const disabled = draft.name.trim() === '';

  return (
    <div className="flex flex-col gap-2 border-b border-panel-border bg-subtle px-3 py-2.5">
      <div className="font-[family-name:var(--font-ui)] text-[11.5px] font-semibold text-ink">{t('addAGuest')}</div>

      <label className="flex flex-col gap-0.5">
        <span className="font-[family-name:var(--font-data)] text-[9px] text-text-muted">{t('csvColumnName')}</span>
        <input
          type="text"
          value={draft.name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setField('name', e.target.value)}
          className="h-6 border border-rule bg-paper px-1.5 font-[family-name:var(--font-name)] text-[13px] text-ink outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="font-[family-name:var(--font-data)] text-[9px] text-text-muted">{t('csvColumnGroup')}</span>
          <input
            type="text"
            value={draft.group}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('group', e.target.value)}
            className="h-6 border border-rule bg-paper px-1.5 font-[family-name:var(--font-ui)] text-[12px] text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="font-[family-name:var(--font-data)] text-[9px] text-text-muted">{t('csvColumnDietary')}</span>
          <input
            type="text"
            value={draft.dietary}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('dietary', e.target.value)}
            className="h-6 border border-rule bg-paper px-1.5 font-[family-name:var(--font-data)] text-[11px] uppercase text-ink outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-0.5">
        <span className="font-[family-name:var(--font-data)] text-[9px] text-text-muted">{t('csvColumnRsvp')}</span>
        <select
          value={draft.rsvp}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            if (isRsvp(e.target.value)) setField('rsvp', e.target.value);
          }}
          className="h-6 border border-rule bg-paper px-1.5 font-[family-name:var(--font-data)] text-[11px] text-ink outline-none"
        >
          {RSVP_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
        </select>
      </label>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleCancel}
          className="flex h-7 items-center px-3 font-[family-name:var(--font-ui)] text-[12px] text-text-secondary"
        >
          {t('cancelAction')}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleSubmit}
          className={`flex h-7 items-center px-3 font-[family-name:var(--font-ui)] text-[12.5px] font-medium ${
            disabled ? 'bg-divider text-text-disabled' : 'bg-ink text-paper'
          }`}
        >
          {t('addGuest')}
        </button>
      </div>
    </div>
  );
}
