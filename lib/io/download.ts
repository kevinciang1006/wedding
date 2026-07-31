/**
 * Filename for a downloaded export: the plan's title, slugified to
 * lower-case-hyphenated so accents/spaces/punctuation in a couple's own
 * title (or an apostrophe, a slash) can't produce a filename the OS mangles
 * — falling back to a generic name for an untitled plan. Same accent-
 * stripping recipe as `lib/io/csv.ts`'s header normaliser.
 */
export function planFilename(title: string, extension: string): string {
  const slug = title
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'plan'}.${extension}`;
}

/**
 * Triggers the browser's native "save this file" flow for a `data:` or
 * `blob:` URL — an off-DOM anchor with a `download` attribute, clicked once
 * and discarded. This is the only way to prompt a save from a page; the
 * `download` attribute makes the browser save the URL's bytes rather than
 * navigating to (and rendering) them, so it works directly on a `data:` URL,
 * unlike opening one in a new tab (see `dataUrlToBlobUrl` below).
 */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Converts a base64 `data:` URL (the form Konva's `stage.toDataURL()`
 * returns) into an object URL backed by a real `Blob` — the form a browser
 * will actually navigate to. Chromium refuses to open a `data:` URL as a
 * new top-level tab (a long-standing anti-phishing restriction), so the
 * PNG export's "Show file" toast action needs this even though the download
 * itself (`downloadUrl` above) works on the `data:` URL directly.
 */
export function dataUrlToBlobUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  const mimeMatch = /data:([^;]+)/.exec(dataUrl.slice(0, commaIndex));
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(dataUrl.slice(commaIndex + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
