/**
 * Browser utilities for saving and displaying PDF documents.
 *
 * These helpers convert raw PDF bytes into browser-native formats
 * for downloading, embedding, and previewing.
 *
 * @module browser/download
 */

/**
 * Trigger a browser file download for PDF bytes.
 *
 * Creates a temporary `<a>` element with a Blob URL and clicks it
 * to start the download. The Blob URL is revoked after the download
 * starts.
 *
 * @param bytes    - The PDF document bytes.
 * @param filename - Download filename (defaults to `'document.pdf'`).
 *
 * @example
 * ```ts
 * import { createPdf, saveAsDownload } from 'modern-pdf-lib/browser';
 *
 * const doc = createPdf();
 * doc.addPage().drawText('Hello!', { x: 50, y: 750, size: 24 });
 * const bytes = await doc.save();
 * saveAsDownload(bytes, 'hello.pdf');
 * ```
 */
export function saveAsDownload(bytes: Uint8Array, filename: string = 'document.pdf'): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick to allow the download to start
  queueMicrotask(() => URL.revokeObjectURL(url));
}

/**
 * Convert PDF bytes to a Blob.
 *
 * Useful for uploading PDFs via `fetch()` or `FormData`, or for
 * passing to other browser APIs that accept Blobs.
 *
 * @param bytes - The PDF document bytes.
 * @returns A Blob with MIME type `application/pdf`.
 *
 * @example
 * ```ts
 * const blob = saveAsBlob(bytes);
 * const formData = new FormData();
 * formData.append('document', blob, 'report.pdf');
 * await fetch('/upload', { method: 'POST', body: formData });
 * ```
 */
export function saveAsBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Create an object URL for PDF bytes.
 *
 * The returned URL can be used as the `src` of an `<iframe>` or
 * `<embed>` element to preview the PDF in the browser.
 *
 * **Important:** Call `URL.revokeObjectURL(url)` when you're done
 * with the URL to free memory.
 *
 * @param bytes - The PDF document bytes.
 * @returns A `blob:` URL string.
 *
 * @example
 * ```ts
 * const url = saveAsDataUrl(bytes);
 * const iframe = document.getElementById('preview') as HTMLIFrameElement;
 * iframe.src = url;
 * // Later: URL.revokeObjectURL(url);
 * ```
 */
export function saveAsDataUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

/**
 * Open a PDF in a new browser tab/window.
 *
 * @param bytes    - The PDF document bytes.
 * @param target   - Window target (defaults to `'_blank'`).
 * @returns The opened window reference, or `null` if blocked by popup blocker.
 *
 * @example
 * ```ts
 * openInNewTab(bytes);
 * ```
 */
export function openInNewTab(bytes: Uint8Array, target: string = '_blank'): Window | null {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const win = globalThis.open(url, target);
  // Revoke after a delay to allow the tab to load
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return win;
}
