import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportPng, type ExportStage } from '@/lib/io/png';
import { getSeats } from '@/lib/geometry/seats';
import { isTable } from '@/lib/types/doc';
import { formatDimensions } from '@/lib/units/format';
import { INK, TEXT_MUTED } from '@/lib/canvasTokens';
import type { Doc, Guest } from '@/lib/types/doc';
import type { TranslationKey } from '@/lib/i18n/en';

// Same shape as `useT()`'s return (`lib/i18n/useT.ts`), restated locally
// rather than imported: `useT` is a hook, and this file has to run from
// plain event-handler code, not a component — the caller passes its own
// already-called `t` down, the same pattern `lib/io/png.ts` uses for
// `ExportStage` to stay framework-lean.
type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

// A4 landscape, millimetres — jsPDF's own working unit here, matching the
// paper size this is actually meant to be printed on.
const PAGE_MARGIN_MM = 15;
const TITLE_BLOCK_MM = 10;         // page 1: title baseline to the room image's top
const DIM_BAR_GAP_MM = 6;          // room image bottom to the dimension bar
const DIM_TICK_MM = 3;             // dimension bar's end-tick height
const DIM_LABEL_GAP_MM = 5;        // dimension bar to its size label
const SECTION_HEADING_MM = 8;      // a table's own name to its guest list
const SECTION_GAP_MM = 8;          // one table's guest list to the next table's name
// Below this much room left on the page, a table's heading does not start —
// it would strand the heading with its own list beginning on the next page,
// which is exactly what "legible standing alone" rules out.
const MIN_SECTION_ROOM_MM = 26;

/**
 * Page 1: the room, rasterized through `exportPng` (so it is exactly the
 * same overlay- and selection-safe crop the PNG export produces — this
 * file never re-derives that), captioned with a plain dimension bar in the
 * plan's active unit. `times`/`courier`/`helvetica` (jsPDF's three built-in
 * fonts, no embedding needed) stand in for the app's own Newsreader/IBM
 * Plex Mono/UI sans respectively throughout this file — `times` for the
 * title here, matching `addGuestSections`' own table-name headings below.
 */
function addRoomPage(pdf: jsPDF, stage: ExportStage, doc: Doc, title: string): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setFont('times', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(INK);
  pdf.text(title, PAGE_MARGIN_MM, PAGE_MARGIN_MM + 4);

  const contentTop = PAGE_MARGIN_MM + TITLE_BLOCK_MM;
  const dimBlockHeight = DIM_BAR_GAP_MM + DIM_TICK_MM + DIM_LABEL_GAP_MM;
  const maxWidth = pageWidth - PAGE_MARGIN_MM * 2;
  const maxHeight = pageHeight - contentTop - PAGE_MARGIN_MM - dimBlockHeight;

  const dataUrl = exportPng(stage, doc.room);
  const { width: pxWidth, height: pxHeight } = pdf.getImageProperties(dataUrl);
  const aspect = pxWidth / pxHeight;

  let imgWidth = maxWidth;
  let imgHeight = imgWidth / aspect;
  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = imgHeight * aspect;
  }
  const imgX = PAGE_MARGIN_MM + (maxWidth - imgWidth) / 2;
  const imgY = contentTop;
  pdf.addImage(dataUrl, 'PNG', imgX, imgY, imgWidth, imgHeight);

  // Dimension bar: a plain ruler spanning the image's own width, end-ticked
  // and captioned with the room's size — the one piece of scale information
  // a floor plan image alone loses once it's off-screen and out of the app.
  const barY = imgY + imgHeight + DIM_BAR_GAP_MM;
  pdf.setDrawColor(INK);
  pdf.setLineWidth(0.2);
  pdf.line(imgX, barY, imgX + imgWidth, barY);
  pdf.line(imgX, barY - DIM_TICK_MM / 2, imgX, barY + DIM_TICK_MM / 2);
  pdf.line(imgX + imgWidth, barY - DIM_TICK_MM / 2, imgX + imgWidth, barY + DIM_TICK_MM / 2);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(TEXT_MUTED);
  const dimText = formatDimensions(doc.room.width, doc.room.height, doc.units);
  const textWidth = pdf.getTextWidth(dimText);
  pdf.text(dimText, imgX + (imgWidth - textWidth) / 2, barY + DIM_TICK_MM + DIM_LABEL_GAP_MM);
}

interface SeatedRow { seatNumber: number; guest: Guest }

/** Every occupied seat at `tableId`, in seat-index order (`getSeats`'s own build order — never reshuffled here). */
function seatedRowsOf(doc: Doc, tableId: string, seats: ReturnType<typeof getSeats>): SeatedRow[] {
  const rows: SeatedRow[] = [];
  for (const seat of seats) {
    const guestId = doc.seatAssignments[seat.id];
    const guest = guestId ? doc.guests[guestId] : undefined;
    if (guest) rows.push({ seatNumber: seat.index + 1, guest });
  }
  return rows;
}

/**
 * Page 2+: one section per table (`objectOrder`, the same order the room
 * itself places them in), each its own bold table-name heading followed by
 * a `jspdf-autotable` Seat/Guest/Dietary list. This is the artefact a
 * caterer works from standing alone, so a table with nobody seated still
 * gets its own section — marked empty via a single spanning row — rather
 * than silently vanishing, which would read as a missing table rather than
 * an empty one.
 *
 * Column fonts echo the app's own two-font system (`canvasTokens.ts`):
 * `times` for the Guest name column and every table-name heading (the
 * Newsreader role), `courier` for Seat and Dietary — both short data codes,
 * the IBM Plex Mono role — with Dietary set larger and bold specifically so
 * it "reads at arm's length" per the brief, since that is the one column a
 * kitchen actually has to act on.
 */
function addGuestSections(pdf: jsPDF, doc: Doc, t: Translate): void {
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.addPage();
  let cursorY = PAGE_MARGIN_MM;

  for (const objectId of doc.objectOrder) {
    const obj = doc.objects[objectId];
    if (!obj || !isTable(obj)) continue;

    const rows = seatedRowsOf(doc, objectId, getSeats(obj));

    if (cursorY + MIN_SECTION_ROOM_MM > pageHeight - PAGE_MARGIN_MM) {
      pdf.addPage();
      cursorY = PAGE_MARGIN_MM;
    }

    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(INK);
    pdf.text(obj.label, PAGE_MARGIN_MM, cursorY + 5);
    cursorY += SECTION_HEADING_MM;

    autoTable(pdf, {
      startY: cursorY,
      margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.2, textColor: INK, lineColor: TEXT_MUTED, lineWidth: 0.15 },
      headStyles: { font: 'helvetica', fontStyle: 'bold', fillColor: INK, textColor: '#FFFFFF' },
      head: [[t('pdfColumnSeat'), t('pdfColumnGuest'), t('pdfColumnDietary')]],
      body: rows.length > 0
        ? rows.map(({ seatNumber, guest }) => [String(seatNumber), guest.name, guest.dietary ?? ''])
        : [[{ content: t('pdfTableEmpty'), colSpan: 3, styles: { halign: 'center', fontStyle: 'italic', textColor: TEXT_MUTED } }]],
      columnStyles: {
        0: { font: 'courier', halign: 'center', cellWidth: 20 },
        1: { font: 'times' },
        2: { font: 'courier', fontStyle: 'bold', halign: 'center', cellWidth: 32, fontSize: 11 },
      },
      // `data.cursor` is where THIS call's drawing ended — on the final page
      // it touches, whether that's the same page the heading started on or
      // one this table's own (rare, long) guest list broke onto. Read fresh
      // on every page this table spans (autoTable fires this once per page,
      // including internal page breaks), so after the call it holds the
      // true end position regardless of how many pages that took.
      didDrawPage: (data) => { if (data.cursor) cursorY = data.cursor.y; },
    });

    cursorY += SECTION_GAP_MM;
  }
}

/**
 * Builds the full export: page 1 is `addRoomPage`, page 2 onward is
 * `addGuestSections`. Returns the `jsPDF` document itself rather than a
 * Blob/data URL — same division of labour as `exportPng` returning a data
 * URL and leaving "turn this into a download" to the caller — so
 * `ExportMenu.tsx` decides how it's saved/shown, consistent with how it
 * already handles the PNG and JSON exports.
 */
export function exportPdf(stage: ExportStage, doc: Doc, t: Translate): jsPDF {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const title = doc.title || t('untitledPlan');
  pdf.setProperties({ title });
  addRoomPage(pdf, stage, doc, title);
  addGuestSections(pdf, doc, t);
  return pdf;
}
