/**
 * Tests for the server adapter helpers in
 * {@link module:runtime/serverAdapters}.
 *
 * These cover:
 *  - Header construction (Content-Type / Content-Length /
 *    Content-Disposition, RFC 6266 `filename*` for non-ASCII).
 *  - Web-standard `Response` construction (status + headers + body).
 *  - Streaming `Response` (Content-Length omitted unless byteLength given).
 *  - The Node-style `sendPdfToNodeResponse` helper.
 *  - End-to-end: a real saved PDF flows through `pdfResponse` unchanged.
 */

import { describe, it, expect } from 'vitest';
import {
  pdfHeaders,
  pdfResponse,
  pdfStreamResponse,
  sendPdfToNodeResponse,
  type NodeServerResponseLike,
} from '../../../src/runtime/serverAdapters.js';
import { createPdf, PageSizes } from '../../../src/index.js';

// ---------------------------------------------------------------------------
// pdfHeaders
// ---------------------------------------------------------------------------

describe('pdfHeaders', () => {
  it('sets Content-Type and Content-Length', () => {
    const h = pdfHeaders(1234);
    expect(h['Content-Type']).toBe('application/pdf');
    expect(h['Content-Length']).toBe('1234');
  });

  it('defaults to inline disposition when download is omitted', () => {
    const h = pdfHeaders(10);
    expect(h['Content-Disposition']).toBe('inline');
  });

  it('uses inline disposition when download is false', () => {
    const h = pdfHeaders(10, { download: false, filename: 'x.pdf' });
    expect(h['Content-Disposition']).toBe('inline; filename="x.pdf"');
  });

  it('builds an attachment disposition with an ASCII filename', () => {
    const h = pdfHeaders(1234, { filename: 'report.pdf', download: true });
    expect(h['Content-Type']).toBe('application/pdf');
    expect(h['Content-Length']).toBe('1234');
    expect(h['Content-Disposition']).toBe('attachment; filename="report.pdf"');
  });

  it('adds an RFC 6266 filename* form for a non-ASCII filename', () => {
    const h = pdfHeaders(99, { filename: 'résumé.pdf', download: true });
    const cd = h['Content-Disposition'] ?? '';
    expect(cd.startsWith('attachment')).toBe(true);
    // ASCII fallback (filename=) must still be present...
    expect(cd).toContain('filename="resume.pdf"');
    // ...and the UTF-8 percent-encoded extended form.
    expect(cd).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
  });

  it('escapes quotes and backslashes in the ASCII filename', () => {
    const h = pdfHeaders(5, { filename: 'a"b\\c.pdf', download: true });
    expect(h['Content-Disposition']).toContain('filename="a\\"b\\\\c.pdf"');
  });

  it('includes Cache-Control and Last-Modified when supplied', () => {
    const when = new Date('2026-01-02T03:04:05Z');
    const h = pdfHeaders(1, {
      cacheControl: 'public, max-age=3600',
      lastModified: when,
    });
    expect(h['Cache-Control']).toBe('public, max-age=3600');
    expect(h['Last-Modified']).toBe(when.toUTCString());
  });

  it('merges custom headers (and lets them be overridden by core ones)', () => {
    const h = pdfHeaders(7, {
      headers: { 'X-Custom': 'yes', 'Content-Type': 'text/plain' },
    });
    expect(h['X-Custom']).toBe('yes');
    // Core PDF content-type wins over a custom override.
    expect(h['Content-Type']).toBe('application/pdf');
  });
});

// ---------------------------------------------------------------------------
// pdfResponse
// ---------------------------------------------------------------------------

describe('pdfResponse', () => {
  it('returns a 200 Response with correct headers and body', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const res = pdfResponse(bytes);
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Length')).toBe('5');
    const ab = await res.arrayBuffer();
    expect(new Uint8Array(ab)).toEqual(bytes);
  });

  it('honours a custom status code', () => {
    const res = pdfResponse(new Uint8Array([0]), { status: 201 });
    expect(res.status).toBe(201);
  });

  it('sets an attachment disposition for downloads', () => {
    const res = pdfResponse(new Uint8Array([0]), {
      filename: 'doc.pdf',
      download: true,
    });
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="doc.pdf"',
    );
  });
});

// ---------------------------------------------------------------------------
// pdfStreamResponse
// ---------------------------------------------------------------------------

describe('pdfStreamResponse', () => {
  function singleChunkStream(data: Uint8Array): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
  }

  it('omits Content-Length when byteLength is unknown', async () => {
    const stream = singleChunkStream(new Uint8Array([9, 8, 7]));
    const res = pdfStreamResponse(stream);
    expect(res.headers.get('Content-Length')).toBeNull();
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    const ab = await res.arrayBuffer();
    expect(new Uint8Array(ab)).toEqual(new Uint8Array([9, 8, 7]));
  });

  it('includes Content-Length when byteLength is given', () => {
    const stream = singleChunkStream(new Uint8Array([1, 2]));
    const res = pdfStreamResponse(stream, { byteLength: 2 });
    expect(res.headers.get('Content-Length')).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// sendPdfToNodeResponse
// ---------------------------------------------------------------------------

describe('sendPdfToNodeResponse', () => {
  function makeFakeRes(): NodeServerResponseLike & {
    statusCode?: number;
    sentHeaders?: Record<string, string>;
    body?: Uint8Array;
  } {
    return {
      writeHead(status, headers) {
        this.statusCode = status;
        this.sentHeaders = headers;
      },
      end(chunk) {
        this.body = chunk;
      },
    };
  }

  it('writes status, headers, and body to a Node-style response', () => {
    const res = makeFakeRes();
    const bytes = new Uint8Array([42, 43, 44]);
    sendPdfToNodeResponse(res, bytes, { filename: 'r.pdf', download: true });

    expect(res.statusCode).toBe(200);
    expect(res.sentHeaders?.['Content-Type']).toBe('application/pdf');
    expect(res.sentHeaders?.['Content-Length']).toBe('3');
    expect(res.sentHeaders?.['Content-Disposition']).toBe(
      'attachment; filename="r.pdf"',
    );
    expect(res.body).toEqual(bytes);
  });

  it('honours a custom status code', () => {
    const res = makeFakeRes();
    sendPdfToNodeResponse(res, new Uint8Array([0]), { status: 206 });
    expect(res.statusCode).toBe(206);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: a real generated PDF survives the round trip.
// ---------------------------------------------------------------------------

describe('serverAdapters end-to-end', () => {
  it('serves a real, valid PDF through pdfResponse unchanged', async () => {
    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    page.drawText('Hello from a server adapter', { x: 50, y: 750, size: 24 });
    const bytes = await doc.save();

    // Sanity: it is actually a PDF.
    const header = new TextDecoder().decode(bytes.subarray(0, 5));
    expect(header).toBe('%PDF-');

    const res = pdfResponse(bytes, { filename: 'hello.pdf', download: true });
    expect(res.headers.get('Content-Length')).toBe(String(bytes.byteLength));

    const roundTripped = new Uint8Array(await res.arrayBuffer());
    expect(roundTripped).toEqual(bytes);
    // The round-tripped bytes still start with the PDF magic.
    expect(new TextDecoder().decode(roundTripped.subarray(0, 5))).toBe('%PDF-');
  });
});
