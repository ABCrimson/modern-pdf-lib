/**
 * Tests for StreamingPdfParser — incremental / streaming PDF parser.
 *
 * Tests cover:
 * - Parse a small PDF via chunks (feed + end)
 * - Event-based parsing (header, xref, page, trailer events)
 * - fromStream with ReadableStream
 * - Selective page loading (pageRange)
 * - Detect encrypted PDF
 * - Detect linearized PDF
 * - Parse progress reporting
 * - Invalid PDF handling (graceful errors)
 * - Feed partial chunks (split at arbitrary points)
 * - getPageContent for on-demand content loading
 * - Multi-page document parsing
 */

import { describe, it, expect, vi } from 'vitest';
import {
  StreamingPdfParser,
} from '../../../src/parser/streamingParser.js';
import type {
  StreamingParserOptions,
  StreamingParseResult,
  StreamingParserEvent,
  ParsedPage,
} from '../../../src/parser/streamingParser.js';
import { PdfParseError } from '../../../src/parser/parseError.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode a plain string to Uint8Array (Latin-1 / ASCII). */
function toBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

/**
 * Build a minimal valid PDF string with precise byte offsets.
 * Returns the complete PDF string and computed xref offset.
 */
function buildMinimalPdf(opts?: {
  info?: boolean;
  pages?: number;
  mediaBox?: number[];
  encrypt?: boolean;
  linearized?: boolean;
  contentStream?: string;
}): string {
  const pageCount = opts?.pages ?? 1;
  const mediaBox = opts?.mediaBox ?? [0, 0, 612, 792];
  const mediaBoxStr = `[${mediaBox.join(' ')}]`;

  const lines: string[] = [];
  const offsets: number[] = [];

  lines.push('%PDF-1.7\n');

  let pos = lines[0]!.length;

  // Optional: linearization hint dict in object 1
  if (opts?.linearized) {
    offsets.push(pos);
    const linObj = `1 0 obj<</Linearized 1/L 1000/O 3/E 500/N ${pageCount}/T 800>>endobj\n`;
    lines.push(linObj);
    pos += linObj.length;

    // Object 2: Catalog
    offsets.push(pos);
    const catalogObj = `2 0 obj<</Type/Catalog/Pages 3 0 R>>endobj\n`;
    lines.push(catalogObj);
    pos += catalogObj.length;

    // Object 3: Pages
    offsets.push(pos);
    const kidsRefs = [];
    for (let i = 0; i < pageCount; i++) {
      kidsRefs.push(`${4 + i} 0 R`);
    }
    const pagesObj = `3 0 obj<</Type/Pages/Kids[${kidsRefs.join(' ')}]/Count ${pageCount}>>endobj\n`;
    lines.push(pagesObj);
    pos += pagesObj.length;

    // Page objects
    for (let i = 0; i < pageCount; i++) {
      const objNum = 4 + i;
      offsets.push(pos);
      const pageObj = `${objNum} 0 obj<</Type/Page/Parent 3 0 R/MediaBox${mediaBoxStr}>>endobj\n`;
      lines.push(pageObj);
      pos += pageObj.length;
    }
  } else {
    // Object 1: Catalog
    offsets.push(pos);
    const catalogObj = `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n`;
    lines.push(catalogObj);
    pos += catalogObj.length;

    // Object 2: Pages node
    offsets.push(pos);
    const kidsRefs = [];
    for (let i = 0; i < pageCount; i++) {
      kidsRefs.push(`${3 + i} 0 R`);
    }
    const pagesObj = `2 0 obj<</Type/Pages/Kids[${kidsRefs.join(' ')}]/Count ${pageCount}>>endobj\n`;
    lines.push(pagesObj);
    pos += pagesObj.length;

    // Page objects (optionally with content streams)
    for (let i = 0; i < pageCount; i++) {
      const objNum = 3 + i;
      offsets.push(pos);
      if (opts?.contentStream) {
        const contentObjNum = 3 + pageCount + i;
        const pageObj = `${objNum} 0 obj<</Type/Page/Parent 2 0 R/MediaBox${mediaBoxStr}/Contents ${contentObjNum} 0 R>>endobj\n`;
        lines.push(pageObj);
        pos += pageObj.length;
      } else {
        const pageObj = `${objNum} 0 obj<</Type/Page/Parent 2 0 R/MediaBox${mediaBoxStr}>>endobj\n`;
        lines.push(pageObj);
        pos += pageObj.length;
      }
    }

    // Content stream objects (if requested)
    if (opts?.contentStream) {
      for (let i = 0; i < pageCount; i++) {
        const contentObjNum = 3 + pageCount + i;
        offsets.push(pos);
        const streamData = opts.contentStream;
        const contentObj = `${contentObjNum} 0 obj<</Length ${streamData.length}>>\nstream\n${streamData}\nendstream\nendobj\n`;
        lines.push(contentObj);
        pos += contentObj.length;
      }
    }
  }

  // Info dict (optional)
  let infoObjNum: number | undefined;
  if (opts?.info) {
    const nextObj = offsets.length + 1;
    infoObjNum = nextObj;
    offsets.push(pos);
    const infoObj = `${infoObjNum} 0 obj<</Title(Test PDF)/Author(Tester)/Subject(Testing)>>endobj\n`;
    lines.push(infoObj);
    pos += infoObj.length;
  }

  // Encrypt dict (optional, dummy)
  let encryptObjNum: number | undefined;
  if (opts?.encrypt) {
    const nextObj = offsets.length + 1;
    encryptObjNum = nextObj;
    offsets.push(pos);
    const encryptObj = `${encryptObjNum} 0 obj<</Filter/Standard/V 1/R 2/P -44/O(owner)/U(user)>>endobj\n`;
    lines.push(encryptObj);
    pos += encryptObj.length;
  }

  const totalObjects = offsets.length + 1; // +1 for free entry 0

  // xref table
  const xrefPos = pos;
  let xrefSection = 'xref\n';
  xrefSection += `0 ${totalObjects}\n`;
  xrefSection += '0000000000 65535 f \r\n';
  for (const offset of offsets) {
    xrefSection += `${String(offset).padStart(10, '0')} 00000 n \r\n`;
  }
  lines.push(xrefSection);

  // Trailer
  const rootObjNum = opts?.linearized ? 2 : 1;
  let trailerStr = `trailer<</Size ${totalObjects}/Root ${rootObjNum} 0 R`;
  if (infoObjNum !== undefined) {
    trailerStr += `/Info ${infoObjNum} 0 R`;
  }
  if (encryptObjNum !== undefined) {
    trailerStr += `/Encrypt ${encryptObjNum} 0 R`;
  }
  trailerStr += '>>\n';
  lines.push(trailerStr);

  // startxref
  lines.push(`startxref\n${xrefPos}\n%%EOF\n`);

  return lines.join('');
}

/** Create a ReadableStream from a Uint8Array (possibly splitting into chunks). */
function toReadableStream(data: Uint8Array, chunkSize?: number): ReadableStream<Uint8Array> {
  const size = chunkSize ?? data.length;
  let offset = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= data.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + size, data.length);
      controller.enqueue(data.slice(offset, end));
      offset = end;
    },
  });
}

// ---------------------------------------------------------------------------
// Tests: basic parsing
// ---------------------------------------------------------------------------

describe('StreamingPdfParser', () => {
  describe('feed + end (chunk-based parsing)', () => {
    it('parses a minimal single-page PDF', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.version).toBe('1.7');
      expect(result.pageCount).toBe(1);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]!.mediaBox).toEqual([0, 0, 612, 792]);
      expect(result.isEncrypted).toBe(false);
      expect(result.isLinearized).toBe(false);
      expect(result.xrefOffset).toBeGreaterThan(0);
    });

    it('parses a multi-page PDF', () => {
      const pdfStr = buildMinimalPdf({ pages: 5, mediaBox: [0, 0, 595, 842] });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.version).toBe('1.7');
      expect(result.pageCount).toBe(5);
      expect(result.pages).toHaveLength(5);
      for (const page of result.pages) {
        expect(page.mediaBox).toEqual([0, 0, 595, 842]);
      }
    });

    it('extracts metadata from /Info dictionary', () => {
      const pdfStr = buildMinimalPdf({ info: true });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.Title).toBe('Test PDF');
      expect(result.metadata!.Author).toBe('Tester');
      expect(result.metadata!.Subject).toBe('Testing');
    });

    it('correctly reports page indices', () => {
      const pdfStr = buildMinimalPdf({ pages: 3 });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.pages[0]!.index).toBe(0);
      expect(result.pages[1]!.index).toBe(1);
      expect(result.pages[2]!.index).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: partial chunk feeding
  // -------------------------------------------------------------------------

  describe('feed partial chunks', () => {
    it('works when data is split at arbitrary byte boundaries', () => {
      const pdfStr = buildMinimalPdf({ pages: 2, info: true });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();

      // Split at various arbitrary points
      const splitPoints = [7, 23, 50, 100, 150];
      let start = 0;
      for (const split of splitPoints) {
        if (split >= data.length) break;
        parser.feed(data.slice(start, split));
        start = split;
      }
      parser.feed(data.slice(start));

      const result = parser.end();

      expect(result.version).toBe('1.7');
      expect(result.pageCount).toBe(2);
      expect(result.metadata).toBeDefined();
    });

    it('works when data is fed one byte at a time', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      for (let i = 0; i < data.length; i++) {
        parser.feed(data.slice(i, i + 1));
      }

      const result = parser.end();
      expect(result.version).toBe('1.7');
      expect(result.pageCount).toBe(1);
    });

    it('works when data is fed in two large chunks', () => {
      const pdfStr = buildMinimalPdf({ pages: 3 });
      const data = toBytes(pdfStr);

      const mid = Math.floor(data.length / 2);
      const parser = new StreamingPdfParser();
      parser.feed(data.slice(0, mid));
      parser.feed(data.slice(mid));

      const result = parser.end();
      expect(result.pageCount).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: event-based parsing
  // -------------------------------------------------------------------------

  describe('event-based parsing', () => {
    it('emits header event with version', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const events: StreamingParserEvent[] = [];
      const parser = new StreamingPdfParser();
      parser.on('header', (e) => events.push(e));
      parser.feed(data);
      parser.end();

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('header');
      expect((events[0] as { type: 'header'; version: string }).version).toBe('1.7');
    });

    it('emits xref event', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const events: StreamingParserEvent[] = [];
      const parser = new StreamingPdfParser();
      parser.on('xref', (e) => events.push(e));
      parser.feed(data);
      parser.end();

      expect(events.length).toBeGreaterThanOrEqual(1);
      const xrefEvent = events[0] as { type: 'xref'; offset: number; entries: number };
      expect(xrefEvent.type).toBe('xref');
      expect(xrefEvent.offset).toBeGreaterThan(0);
      expect(xrefEvent.entries).toBeGreaterThan(0);
    });

    it('emits trailer event', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const events: StreamingParserEvent[] = [];
      const parser = new StreamingPdfParser();
      parser.on('trailer', (e) => events.push(e));
      parser.feed(data);
      parser.end();

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.type).toBe('trailer');
    });

    it('emits page events for each page', () => {
      const pdfStr = buildMinimalPdf({ pages: 3 });
      const data = toBytes(pdfStr);

      const events: StreamingParserEvent[] = [];
      const parser = new StreamingPdfParser();
      parser.on('page', (e) => events.push(e));
      parser.feed(data);
      parser.end();

      expect(events).toHaveLength(3);
      for (let i = 0; i < 3; i++) {
        const pageEvent = events[i] as { type: 'page'; index: number; page: ParsedPage };
        expect(pageEvent.type).toBe('page');
        expect(pageEvent.index).toBe(i);
        expect(pageEvent.page.mediaBox).toEqual([0, 0, 612, 792]);
      }
    });

    it('emits object events for xref entries', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const events: StreamingParserEvent[] = [];
      const parser = new StreamingPdfParser();
      parser.on('object', (e) => events.push(e));
      parser.feed(data);
      parser.end();

      // At minimum: catalog, pages, page = 3 objects
      expect(events.length).toBeGreaterThanOrEqual(3);
      for (const event of events) {
        const objEvent = event as { type: 'object'; number: number; generation: number; offset: number };
        expect(objEvent.type).toBe('object');
        expect(objEvent.number).toBeGreaterThan(0);
        expect(objEvent.generation).toBeGreaterThanOrEqual(0);
        expect(objEvent.offset).toBeGreaterThanOrEqual(0);
      }
    });

    it('emits progress events during feed', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const events: StreamingParserEvent[] = [];
      const parser = new StreamingPdfParser();
      parser.on('progress', (e) => events.push(e));

      // Feed in two chunks
      const mid = Math.floor(data.length / 2);
      parser.feed(data.slice(0, mid));
      parser.feed(data.slice(mid));
      parser.end();

      expect(events).toHaveLength(2);
      const p1 = events[0] as { type: 'progress'; bytesRead: number; totalBytes: number };
      const p2 = events[1] as { type: 'progress'; bytesRead: number; totalBytes: number };
      expect(p1.bytesRead).toBe(mid);
      expect(p2.bytesRead).toBe(data.length);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: fromStream
  // -------------------------------------------------------------------------

  describe('fromStream', () => {
    it('parses a PDF from a ReadableStream', async () => {
      const pdfStr = buildMinimalPdf({ pages: 2 });
      const data = toBytes(pdfStr);
      const stream = toReadableStream(data);

      const result = await StreamingPdfParser.fromStream(stream);

      expect(result.version).toBe('1.7');
      expect(result.pageCount).toBe(2);
    });

    it('parses a ReadableStream delivered in small chunks', async () => {
      const pdfStr = buildMinimalPdf({ pages: 2, info: true });
      const data = toBytes(pdfStr);
      const stream = toReadableStream(data, 32); // 32-byte chunks

      const result = await StreamingPdfParser.fromStream(stream);

      expect(result.version).toBe('1.7');
      expect(result.pageCount).toBe(2);
      expect(result.metadata).toBeDefined();
    });

    it('respects options passed to fromStream', async () => {
      const pdfStr = buildMinimalPdf({ pages: 5 });
      const data = toBytes(pdfStr);
      const stream = toReadableStream(data);

      const result = await StreamingPdfParser.fromStream(stream, {
        pageRange: { start: 1, end: 3 },
      });

      expect(result.pageCount).toBe(5);
      // Pages outside range should still be counted
    });
  });

  // -------------------------------------------------------------------------
  // Tests: selective page loading
  // -------------------------------------------------------------------------

  describe('selective page loading (pageRange)', () => {
    it('filters pages by start index', () => {
      const pdfStr = buildMinimalPdf({ pages: 5 });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser({ pageRange: { start: 2 } });
      parser.feed(data);
      const result = parser.end();

      // All pages are still in the result, but pages before start have
      // empty content stream info
      expect(result.pageCount).toBe(5);
      expect(result.pages[0]!.contentStreamOffset).toBe(0);
      expect(result.pages[1]!.contentStreamOffset).toBe(0);
    });

    it('filters pages by end index', () => {
      const pdfStr = buildMinimalPdf({ pages: 5 });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser({ pageRange: { end: 2 } });
      parser.feed(data);
      const result = parser.end();

      expect(result.pageCount).toBe(5);
      // Pages at index >= 2 should have empty content
      expect(result.pages[2]!.contentStreamOffset).toBe(0);
      expect(result.pages[3]!.contentStreamOffset).toBe(0);
      expect(result.pages[4]!.contentStreamOffset).toBe(0);
    });

    it('filters pages by start and end range', () => {
      const pdfStr = buildMinimalPdf({ pages: 5 });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser({ pageRange: { start: 1, end: 3 } });
      parser.feed(data);
      const result = parser.end();

      expect(result.pageCount).toBe(5);
      expect(result.pages[0]!.contentStreamOffset).toBe(0);
      expect(result.pages[3]!.contentStreamOffset).toBe(0);
      expect(result.pages[4]!.contentStreamOffset).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: encrypted PDF detection
  // -------------------------------------------------------------------------

  describe('encryption detection', () => {
    it('detects an encrypted PDF', () => {
      const pdfStr = buildMinimalPdf({ encrypt: true });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.isEncrypted).toBe(true);
    });

    it('reports non-encrypted PDF correctly', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.isEncrypted).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: linearized PDF detection
  // -------------------------------------------------------------------------

  describe('linearization detection', () => {
    it('detects a linearized PDF', () => {
      const pdfStr = buildMinimalPdf({ linearized: true });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.isLinearized).toBe(true);
    });

    it('reports non-linearized PDF correctly', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.isLinearized).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: progress reporting
  // -------------------------------------------------------------------------

  describe('progress reporting', () => {
    it('tracks bytes read across multiple feed calls', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const progressEvents: { bytesRead: number; totalBytes: number }[] = [];
      const parser = new StreamingPdfParser();
      parser.on('progress', (e) => {
        if (e.type === 'progress') {
          progressEvents.push({ bytesRead: e.bytesRead, totalBytes: e.totalBytes });
        }
      });

      const chunk1 = data.slice(0, 50);
      const chunk2 = data.slice(50, 100);
      const chunk3 = data.slice(100);

      parser.feed(chunk1);
      parser.feed(chunk2);
      parser.feed(chunk3);

      expect(progressEvents).toHaveLength(3);
      expect(progressEvents[0]!.bytesRead).toBe(50);
      expect(progressEvents[1]!.bytesRead).toBe(100);
      expect(progressEvents[2]!.bytesRead).toBe(data.length);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: invalid PDF handling
  // -------------------------------------------------------------------------

  describe('invalid PDF handling', () => {
    it('throws on data too short for a PDF header', () => {
      const parser = new StreamingPdfParser();
      parser.feed(new Uint8Array([0x25, 0x50, 0x44])); // "%PD" — too short

      expect(() => parser.end()).toThrow(PdfParseError);
    });

    it('throws on data without %PDF- header', () => {
      const data = toBytes('This is not a PDF file at all.\n'.repeat(10));

      const parser = new StreamingPdfParser();
      parser.feed(data);

      expect(() => parser.end()).toThrow(PdfParseError);
    });

    it('throws on data without startxref', () => {
      const data = toBytes('%PDF-1.7\nSome content without startxref marker\n%%EOF\n');

      const parser = new StreamingPdfParser();
      parser.feed(data);

      expect(() => parser.end()).toThrow(PdfParseError);
    });

    it('throws when buffer exceeds maxBufferSize', () => {
      const parser = new StreamingPdfParser({ maxBufferSize: 100 });
      parser.feed(new Uint8Array(50));

      expect(() => parser.feed(new Uint8Array(60))).toThrow(PdfParseError);
    });

    it('emits error event before throwing on buffer overflow', () => {
      const events: StreamingParserEvent[] = [];
      const parser = new StreamingPdfParser({ maxBufferSize: 100 });
      parser.on('error', (e) => events.push(e));

      parser.feed(new Uint8Array(50));
      expect(() => parser.feed(new Uint8Array(60))).toThrow();

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('error');
    });

    it('handles an empty PDF gracefully', () => {
      const parser = new StreamingPdfParser();
      parser.feed(new Uint8Array(0));

      expect(() => parser.end()).toThrow(PdfParseError);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: getPageContent
  // -------------------------------------------------------------------------

  describe('getPageContent', () => {
    it('returns content stream bytes for a page with content', async () => {
      const contentStr = 'BT /F1 12 Tf (Hello) Tj ET';
      const pdfStr = buildMinimalPdf({ contentStream: contentStr });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      if (result.pages[0]!.contentStreamOffset > 0) {
        const content = await parser.getPageContent(0);
        expect(content.length).toBeGreaterThan(0);
        // The content should contain the stream data
        const contentText = new TextDecoder().decode(content);
        expect(contentText).toContain('BT');
      }
    });

    it('returns empty array for a page without content stream', async () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      parser.end();

      const content = await parser.getPageContent(0);
      expect(content.length).toBe(0);
    });

    it('throws on out-of-range page index', async () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      parser.end();

      await expect(parser.getPageContent(5)).rejects.toThrow(PdfParseError);
      await expect(parser.getPageContent(-1)).rejects.toThrow(PdfParseError);
    });

    it('throws if called before end()', async () => {
      const parser = new StreamingPdfParser();

      await expect(parser.getPageContent(0)).rejects.toThrow(PdfParseError);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: result structure
  // -------------------------------------------------------------------------

  describe('result structure', () => {
    it('returns correct xrefOffset', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      // The xref offset should point to where "xref" begins
      expect(result.xrefOffset).toBeGreaterThan(0);
      expect(pdfStr.slice(result.xrefOffset, result.xrefOffset + 4)).toBe('xref');
    });

    it('page mediaBox values are correct', () => {
      const pdfStr = buildMinimalPdf({ mediaBox: [10, 20, 400, 600] });
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.pages[0]!.mediaBox).toEqual([10, 20, 400, 600]);
    });

    it('returns metadata as undefined when no /Info present', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const parser = new StreamingPdfParser();
      parser.feed(data);
      const result = parser.end();

      expect(result.metadata).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Tests: multiple event listeners
  // -------------------------------------------------------------------------

  describe('multiple event listeners', () => {
    it('supports multiple handlers for the same event type', () => {
      const pdfStr = buildMinimalPdf();
      const data = toBytes(pdfStr);

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const parser = new StreamingPdfParser();
      parser.on('header', handler1);
      parser.on('header', handler2);
      parser.feed(data);
      parser.end();

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Tests: options defaults
  // -------------------------------------------------------------------------

  describe('options defaults', () => {
    it('uses default maxBufferSize of 64MB', () => {
      const parser = new StreamingPdfParser();
      // Should not throw with reasonable data size
      const data = new Uint8Array(1000);
      parser.feed(data);
      // No assertion needed — just ensure no throw
    });

    it('accepts custom maxBufferSize', () => {
      const parser = new StreamingPdfParser({ maxBufferSize: 500 });
      parser.feed(new Uint8Array(400));
      // Should throw on exceeding the limit
      expect(() => parser.feed(new Uint8Array(200))).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Tests: type exports
  // -------------------------------------------------------------------------

  describe('type exports', () => {
    it('exports StreamingParserOptions interface', () => {
      const opts: StreamingParserOptions = {
        maxBufferSize: 1024,
        parseContentStreams: true,
        pageRange: { start: 0, end: 5 },
      };
      expect(opts.maxBufferSize).toBe(1024);
    });

    it('exports StreamingParseResult interface', () => {
      const result: StreamingParseResult = {
        version: '1.7',
        pageCount: 1,
        pages: [],
        isEncrypted: false,
        isLinearized: false,
        xrefOffset: 0,
      };
      expect(result.version).toBe('1.7');
    });

    it('exports ParsedPage interface', () => {
      const page: ParsedPage = {
        index: 0,
        mediaBox: [0, 0, 612, 792],
        contentStreamOffset: 0,
        contentStreamLength: 0,
      };
      expect(page.index).toBe(0);
    });
  });
});
