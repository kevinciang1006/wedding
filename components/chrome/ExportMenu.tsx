'use client';

import { useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { getDoc, useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/lib/i18n/useT';
import { docToJson, parseDocJson, DocVersionError } from '@/lib/io/json';
import { downloadUrl, dataUrlToBlobUrl, planFilename } from '@/lib/io/download';
import { exportPng } from '@/lib/io/png';
import { exportPdf } from '@/lib/io/pdf';
import type { Viewport } from '@/components/canvas/useViewport';

// How long a JSON export's object URL is kept alive: long enough that the
// toast's own "Show file" link (which opens this exact URL) still works for
// the whole time that link is visible, short enough not to leak object URLs
// across a long editing session. The toast itself auto-dismisses at 5s
// (`Toast.tsx`), so 15s is a deliberately generous margin past that, not a
// number tied to it.
const OBJECT_URL_LIFETIME_MS = 15_000;

interface MenuItemProps { label: string; onSelect: () => void }

function MenuItem({ label, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="block w-full whitespace-nowrap px-3 py-1.5 text-left font-[family-name:var(--font-ui)] text-[12.5px] text-ink hover:bg-cool-tint hover:text-cool-deep"
    >
      {label}
    </button>
  );
}

interface ExportMenuProps { viewport: Viewport }

/**
 * The top bar's export button and its dropdown: Export image (PNG) / Export
 * PDF / Export data (JSON) / Import plan. A plain boolean in `uiStore`
 * (`exportMenuOpen`) rather than local component state, because `⌘E`
 * (`useKeyboard.ts`) toggles the same menu from outside React's render
 * tree — it can only reach a store, not this component's own `useState`.
 *
 * Takes `viewport` (the one instance `Editor.tsx` owns, threaded down
 * through `TopBar`) purely for its `stageRef`: PNG export reads the live
 * Konva `Stage` directly rather than through any store, since the crop
 * rect it needs (`lib/io/png.ts`) depends on the Stage's own current
 * pan/zoom transform, not persisted document state.
 */
export function ExportMenu({ viewport }: ExportMenuProps) {
  const t = useT();
  const open = useUiStore((s) => s.exportMenuOpen);
  const toggle = useUiStore((s) => s.toggleExportMenu);
  const close = useUiStore((s) => s.closeExportMenu);
  const showToast = useUiStore((s) => s.showToast);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Closes on any click outside the trigger+panel, and on Escape. Scoped to
  // `wrapperRef` (button and panel share one wrapper) rather than
  // `ContextMenu.tsx`'s "any mousedown closes, items call close() manually"
  // approach — this menu's own trigger button lives inside the same
  // listened-on subtree, so a naive global listener would close the menu on
  // the down-stroke of the very click that's about to toggle it back open.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) close();
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  function handleExportJson(): void {
    const doc = getDoc();
    const blob = new Blob([docToJson(doc)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, planFilename(doc.title, 'json'));
    showToast(t('planExported'), null, { label: t('showFile'), onClick: () => window.open(url, '_blank') });
    setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
    close();
  }

  function handleExportPng(): void {
    // No stage yet (mounted-but-not-yet-measured, or this menu somehow
    // reachable before `CanvasStage` itself is): nothing to rasterize, and
    // silently no-op is safer than a crash on a menu click.
    const stage = viewport.stageRef.current;
    if (!stage) return;
    const doc = getDoc();
    const dataUrl = exportPng(stage, doc.room);
    downloadUrl(dataUrl, planFilename(doc.title, 'png'));
    // "Show file" needs a real Blob URL, not the `data:` URL `toDataURL`
    // returns directly — see `dataUrlToBlobUrl`'s own header comment for why.
    const blobUrl = dataUrlToBlobUrl(dataUrl);
    showToast(t('planExported'), null, { label: t('showFile'), onClick: () => window.open(blobUrl, '_blank') });
    setTimeout(() => URL.revokeObjectURL(blobUrl), OBJECT_URL_LIFETIME_MS);
    close();
  }

  function handleExportPdf(): void {
    // Same guard as PNG export above — nothing to render the room page
    // from without a mounted stage.
    const stage = viewport.stageRef.current;
    if (!stage) return;
    const doc = getDoc();
    const pdf = exportPdf(stage, doc, t);
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    downloadUrl(url, planFilename(doc.title, 'pdf'));
    showToast(t('planExported'), null, { label: t('showFile'), onClick: () => window.open(url, '_blank') });
    setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
    close();
  }

  function handleImportClick(): void {
    close();
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    // Reset immediately, not just on success: without this, re-choosing the
    // exact same filename after a failed import fires no further `change`
    // event (the input's value never actually changed), so the user's
    // second attempt at the same file would silently do nothing.
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const doc = parseDocJson(text);
      useDocStore.getState().replaceDoc(doc);
      showToast(t('planImported'));
    } catch (error) {
      if (error instanceof DocVersionError) {
        showToast(t('importVersionMismatch', { version: String(error.foundVersion) }));
      } else {
        // Covers `InvalidDocError` (malformed JSON, or JSON that isn't a
        // Setting plan) and anything else file-reading could throw — every
        // path out of a failed import ends at a named, visible reason, not
        // a caught-and-forgotten error.
        showToast(t('importInvalidFile'));
      }
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-7 items-center gap-2 bg-ink px-3.5 font-[family-name:var(--font-ui)] text-[12.5px] font-medium text-paper"
      >
        {t('exportPlan')}
        <span className="font-[family-name:var(--font-data)] text-[10px] text-[#93A0A7]">⌘E</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-48 border border-panel-border bg-paper py-1 shadow-screen"
        >
          <MenuItem label={t('exportPng')} onSelect={handleExportPng} />
          <MenuItem label={t('exportPdf')} onSelect={handleExportPdf} />
          <MenuItem label={t('exportJson')} onSelect={handleExportJson} />
          <div className="my-1 border-t border-hairline" />
          <MenuItem label={t('importJson')} onSelect={handleImportClick} />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => { void handleFileChange(e); }}
      />
    </div>
  );
}
