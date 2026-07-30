'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/lib/i18n/useT';
import { buildGuests, guessColumns, parseCsv } from '@/lib/io/csv';
import type { CsvColumnMap, CsvParseResult, CsvRowError } from '@/lib/io/csv';
import type { TranslationKey } from '@/lib/i18n/en';

type ColumnField = 'name' | 'group' | 'email' | 'dietary' | 'rsvp' | 'ignore';

const FIELD_OPTIONS: { value: ColumnField; labelKey: TranslationKey }[] = [
  { value: 'name', labelKey: 'csvColumnName' },
  { value: 'group', labelKey: 'csvColumnGroup' },
  { value: 'email', labelKey: 'csvColumnEmail' },
  { value: 'dietary', labelKey: 'csvColumnDietary' },
  { value: 'rsvp', labelKey: 'csvColumnRsvp' },
  { value: 'ignore', labelKey: 'csvIgnore' },
];

const REASON_KEY: Record<CsvRowError['reason'], TranslationKey> = {
  noName: 'csvNoName',
  badRsvp: 'csvBadRsvp',
  empty: 'csvRowEmpty',
};

function isColumnField(value: string): value is ColumnField {
  return FIELD_OPTIONS.some((opt) => opt.value === value);
}

/** `guessColumns`' single-index-per-field `CsvColumnMap` recast as one field choice per column — the shape a row of `<select>`s can each own independently. */
function columnMapToAssignments(headerCount: number, map: CsvColumnMap): ColumnField[] {
  return Array.from({ length: headerCount }, (_, i) => {
    if (i === map.name) return 'name';
    if (i === map.group) return 'group';
    if (i === map.email) return 'email';
    if (i === map.dietary) return 'dietary';
    if (i === map.rsvp) return 'rsvp';
    return 'ignore';
  });
}

/**
 * Only one column may claim a given field at a time — reassigning column
 * `columnIndex` to `field` silently demotes whichever *other* column
 * currently holds that field to `ignore`, the same "first/only claim wins"
 * rule `guessColumns` itself follows, just now user-driven instead of
 * keyword-driven.
 */
function reassignColumn(assignments: ColumnField[], columnIndex: number, field: ColumnField): ColumnField[] {
  return assignments.map((current, i) => {
    if (i === columnIndex) return field;
    if (field !== 'ignore' && current === field) return 'ignore';
    return current;
  });
}

function assignmentsToColumnMap(assignments: ColumnField[]): CsvColumnMap {
  const indexOf = (field: ColumnField): number | null => {
    const i = assignments.indexOf(field);
    return i === -1 ? null : i;
  };
  const nameIndex = assignments.indexOf('name');
  // The 'ignore' option is disabled on whichever column currently holds
  // 'name' (see the mapping table below), so `nameIndex` is never -1 in
  // practice; the fallback exists only so this returns a definite `number`
  // for TypeScript, not because it's expected to run.
  return {
    name: nameIndex === -1 ? 0 : nameIndex,
    group: indexOf('group'),
    email: indexOf('email'),
    dietary: indexOf('dietary'),
    rsvp: indexOf('rsvp'),
  };
}

const sectionHeading = 'font-[family-name:var(--font-data)] text-[9px] uppercase tracking-[0.08em] text-text-muted';
const cellText = 'border-b border-divider-light py-1 pr-3 align-top';

/**
 * The guest-panel-launched column-mapping dialog: pick a `.csv`, map each of
 * its columns to a guest field (defaulting to `guessColumns`' own read of
 * the header row), preview the first three rows, see any unreadable rows by
 * file line number, then import. `buildGuests` runs fresh off `parsed` +
 * `assignments` via `useMemo` rather than on every keystroke elsewhere in
 * the dialog — nothing here changes fast enough for that to matter at
 * typical guest-list sizes, but there's no reason to recompute it on a
 * render this state doesn't affect either.
 *
 * The whole import — however many guests parse cleanly — lands in exactly
 * one `commit`, matching the panel's own "one action, one history entry"
 * rule; a bad-RSVP or nameless row is reported, never silently dropped nor
 * allowed to abort rows that *did* parse.
 */
export function CsvImportDialog() {
  const t = useT();
  const open = useUiStore((s) => s.dialog === 'csv');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [assignments, setAssignments] = useState<ColumnField[]>([]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const columnMap = useMemo(() => (parsed ? assignmentsToColumnMap(assignments) : null), [parsed, assignments]);
  const built = useMemo(
    () => (parsed && columnMap ? buildGuests(parsed.rows, columnMap) : { guests: [], errors: [] }),
    [parsed, columnMap],
  );

  if (!open) return null;

  function handleClose(): void {
    useUiStore.getState().closeDialog();
    setParsed(null);
    setAssignments([]);
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const result = parseCsv(text);
    setParsed(result);
    setAssignments(columnMapToAssignments(result.headers.length, guessColumns(result.headers)));
  }

  function handleImport(): void {
    if (built.guests.length === 0) return;
    const count = built.guests.length;
    useDocStore.getState().commit((d) => {
      for (const guest of built.guests) {
        d.guests[guest.id] = guest;
        d.guestOrder.push(guest.id);
      }
    }, 'import guests');
    useUiStore.getState().showToast(t('csvImportCount', { count }));
    handleClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,32,40,0.4)]"
      onMouseDown={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('csvTitle')}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[600px] flex-col gap-4 overflow-y-auto border border-panel-border bg-paper p-5 shadow-screen"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-[family-name:var(--font-ui)] text-[14px] font-semibold text-ink">{t('csvTitle')}</div>
            <div className="mt-1 font-[family-name:var(--font-ui)] text-[12px] text-text-secondary">{t('csvBody')}</div>
          </div>
          <button
            type="button"
            aria-label={t('cancelAction')}
            onClick={handleClose}
            className="shrink-0 font-[family-name:var(--font-data)] text-[14px] text-text-muted"
          >
            ×
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />

        {parsed === null && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-fit items-center bg-ink px-3.5 font-[family-name:var(--font-ui)] text-[12.5px] font-medium text-paper"
          >
            {t('csvChooseFile')}
          </button>
        )}

        {parsed !== null && parsed.headers.length === 0 && (
          <>
            <div className="font-[family-name:var(--font-ui)] text-[12.5px] text-flag">{t('csvEmpty')}</div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-8 w-fit items-center border border-ink px-3.5 font-[family-name:var(--font-ui)] text-[12.5px] font-medium text-ink"
            >
              {t('csvChooseAnother')}
            </button>
          </>
        )}

        {parsed !== null && parsed.headers.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-fit font-[family-name:var(--font-ui)] text-[11.5px] text-cool"
            >
              {t('csvChooseAnother')}
            </button>

            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className={`${sectionHeading} border-b border-divider pb-1`}>{t('csvColumnHeading')}</th>
                  <th className={`${sectionHeading} border-b border-divider pb-1`}>{t('csvMapsTo')}</th>
                </tr>
              </thead>
              <tbody>
                {parsed.headers.map((header, i) => (
                  <tr key={i}>
                    <td className={`${cellText} font-[family-name:var(--font-data)] text-[11px] text-ink`}>{header || '—'}</td>
                    <td className={cellText}>
                      <select
                        aria-label={header || t('csvColumnHeading')}
                        value={assignments[i] ?? 'ignore'}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          const value = e.target.value;
                          if (!isColumnField(value)) return;
                          setAssignments((a) => reassignColumn(a, i, value));
                        }}
                        className="h-6 border border-rule bg-paper px-1 font-[family-name:var(--font-data)] text-[11px] text-ink outline-none"
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} disabled={opt.value === 'ignore' && assignments[i] === 'name'}>
                            {t(opt.labelKey)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div>
              <div className={`${sectionHeading} mb-1`}>{t('csvPreviewHeading')}</div>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    {parsed.headers.map((header, i) => (
                      <th key={i} className={`${cellText} font-[family-name:var(--font-data)] text-[9.5px] font-normal text-text-secondary`}>
                        {header || '—'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 3).map((row, ri) => (
                    <tr key={ri}>
                      {parsed.headers.map((_, ci) => (
                        <td key={ci} className={`${cellText} max-w-[140px] truncate font-[family-name:var(--font-ui)] text-[11px] text-ink`}>
                          {row[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {built.errors.length > 0 && (
              <div>
                <div className={`${sectionHeading} mb-1`}>{t('csvErrorsHeading')}</div>
                <ul className="flex flex-col gap-0.5">
                  {built.errors.map((err, i) => (
                    <li key={i} className="font-[family-name:var(--font-data)] text-[10.5px] text-flag">
                      {t('csvRowError', { row: err.row, reason: t(REASON_KEY[err.reason]) })}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 items-center px-3.5 font-[family-name:var(--font-ui)] text-[12.5px] text-text-secondary"
              >
                {t('cancelAction')}
              </button>
              <button
                type="button"
                disabled={built.guests.length === 0}
                onClick={handleImport}
                className={`flex h-8 items-center px-3.5 font-[family-name:var(--font-ui)] text-[12.5px] font-medium ${
                  built.guests.length === 0 ? 'bg-divider text-text-disabled' : 'bg-ink text-paper'
                }`}
              >
                {t('csvImportCount', { count: built.guests.length })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
