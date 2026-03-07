/**
 * Service Worker helpers for offline PDF generation.
 *
 * Service Workers run in a context that has `self`, `fetch`, `caches`,
 * and `Response`, but no DOM (`document`, `window`). This module
 * provides lightweight utilities for generating and serving PDFs from
 * within a Service Worker.
 *
 * @example
 * ```ts
 * // Inside a Service Worker
 * import { handlePdfRequest, createPdfResponse } from 'modern-pdf-lib/browser';
 *
 * self.addEventListener('fetch', (event) => {
 *   if (event.request.url.endsWith('/generate-pdf')) {
 *     event.respondWith(
 *       handlePdfRequest(event.request, async (pdf) => {
 *         const doc = pdf.createPdf();
 *         const page = doc.addPage(pdf.PageSizes.A4);
 *         page.drawText('Hello from Service Worker!', { x: 50, y: 750, size: 24 });
 *         return doc.save();
 *       }),
 *     );
 *   }
 * });
 * ```
 *
 * @module browser/serviceWorker
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The handler function receives the full modern-pdf-lib module and must
 * return the generated PDF bytes.
 */
type PdfGeneratorHandler = (
  pdf: typeof import('../index.js'),
) => Promise<Uint8Array>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Handle a fetch request by generating a PDF and returning it as a
 * {@link Response} with appropriate headers.
 *
 * This is a convenience wrapper that catches errors from the handler
 * and returns a 500 response with the error message instead of
 * letting the Service Worker fail silently.
 *
 * @param request  - The incoming {@link Request} (used for context;
 *                   currently informational).
 * @param handler  - An async function that receives the `modern-pdf-lib`
 *                   module and returns PDF bytes.
 * @returns A {@link Response} with `content-type: application/pdf`.
 *
 * @example
 * ```ts
 * self.addEventListener('fetch', (event) => {
 *   event.respondWith(
 *     handlePdfRequest(event.request, async (pdf) => {
 *       const doc = pdf.createPdf();
 *       doc.addPage();
 *       return doc.save();
 *     }),
 *   );
 * });
 * ```
 */
export async function handlePdfRequest(
  _request: Request,
  handler: PdfGeneratorHandler,
): Promise<Response> {
  try {
    // Dynamic import so this module itself stays lightweight and
    // does not eagerly pull in the entire library at parse time.
    const pdf = await import('../index.js');
    const bytes = await handler(pdf);
    return createPdfResponse(bytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`PDF generation failed: ${message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

/**
 * Wrap raw PDF bytes in a {@link Response} with the correct
 * `Content-Type` and optional `Content-Disposition` headers.
 *
 * @param bytes     - The PDF file contents as a `Uint8Array`.
 * @param filename  - If provided, a `Content-Disposition: attachment`
 *                    header is added so browsers prompt a download.
 * @returns A ready-to-send {@link Response}.
 *
 * @example
 * ```ts
 * const bytes = doc.save();
 * const response = createPdfResponse(bytes, 'invoice.pdf');
 * ```
 */
export function createPdfResponse(
  bytes: Uint8Array,
  filename?: string,
): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/pdf',
    'content-length': String(bytes.byteLength),
  };

  if (filename) {
    headers['content-disposition'] = `attachment; filename="${filename}"`;
  }

  return new Response(bytes, {
    status: 200,
    headers,
  });
}

/**
 * Check whether the Cache API is available in the current context.
 *
 * In Service Workers the Cache API (`caches`) is typically available,
 * but this helper guards against edge cases (e.g., opaque origins,
 * disabled storage, or running outside a Service Worker).
 *
 * @returns `true` if `caches` is defined and accessible.
 *
 * @example
 * ```ts
 * if (isCacheAvailable()) {
 *   const cache = await caches.open('pdf-cache');
 *   await cache.put(request, response.clone());
 * }
 * ```
 */
export function isCacheAvailable(): boolean {
  try {
    return typeof caches !== 'undefined' && typeof caches.open === 'function';
  } catch {
    // SecurityError can be thrown in opaque origins
    return false;
  }
}
