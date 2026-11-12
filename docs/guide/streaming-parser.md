---
title: Streaming Parser
---

# Streaming Parser

modern-pdf-lib includes a streaming PDF parser that accepts a PDF as chunks and performs a structure-only parse. It buffers the whole file and parses it when `end()` is called; it skips content-stream decoding and object-graph construction. It reads input through the Web Streams API (`ReadableStream`). Deno, Bun and Cloudflare Workers are not tested in CI.

---

## Why Streaming?

The standard `PdfDocument.load()` method reads the entire PDF and builds the full object graph. The `StreamingPdfParser` also buffers the whole file, but it does less work on it:

1. **Accepting chunks** via the `feed()` method or a `ReadableStream` and buffering them until `end()`
2. **Parsing structure only** -- extracting page metadata, cross-reference tables, and document info without decoding every content stream
3. **Loading page content on demand** via `getPageContent()` after the structural parse completes

---

## Quick Start

### From a Fetch Response

The simplest way to parse a remote PDF is with `fromStream()`:

```ts
import { StreamingPdfParser } from 'modern-pdf-lib';

const response = await fetch('https://example.com/large-report.pdf');
const result = await StreamingPdfParser.fromStream(response.body!);

console.log(`PDF version: ${result.version}`);
console.log(`Pages: ${result.pageCount}`);
console.log(`Encrypted: ${result.isEncrypted}`);
console.log(`Linearized: ${result.isLinearized}`);

for (const page of result.pages) {
  console.log(`Page ${page.index}: ${page.mediaBox}`);
}
```

### From a File (Node.js / Deno / Bun)

```ts
import { StreamingPdfParser } from 'modern-pdf-lib';

const result = await StreamingPdfParser.fromFile('/path/to/large.pdf');
console.log(`${result.pageCount} pages found`);
```

### Manual Chunk Feeding

For full control over data ingestion, use the `feed()` / `end()` pattern:

```ts
import { StreamingPdfParser } from 'modern-pdf-lib';

const parser = new StreamingPdfParser({ maxBufferSize: 128 * 1024 * 1024 });

// Feed chunks as they arrive
parser.feed(chunk1);
parser.feed(chunk2);
parser.feed(chunk3);

// Finalize and get the result
const result = parser.end();
```

---

## Parser Options

Configure the parser with `StreamingParserOptions`:

```ts
import { StreamingPdfParser } from 'modern-pdf-lib';

const parser = new StreamingPdfParser({
  maxBufferSize: 128 * 1024 * 1024,  // 128 MB (default: 64 MB)
  pageRange: { start: 0, end: 10 },   // Pages 0-9 (end is exclusive)
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `maxBufferSize` | `number` | `64 * 1024 * 1024` | Maximum bytes to buffer before throwing |
| `parseContentStreams` | `boolean` | `false` | Reserved; currently ignored |
| `pageRange` | `{ start?, end? }` | all pages | Restrict which pages to extract metadata for; `end` is exclusive. Pages outside the range still appear in `result.pages` with zero content offsets, and `pageCount` is the full count |

::: tip Selective Page Loading
Use `pageRange` when you only need metadata for a subset of pages. This reduces the work done during the structure phase but does not reduce the amount of data that must be buffered (the full file is still needed to locate `startxref`).
:::

---

## Parse Result

`StreamingPdfParser` returns a `StreamingParseResult`:

```ts
interface StreamingParseResult {
  version: string;                    // e.g. "1.7", "2.0"
  pageCount: number;                  // Total pages in the document
  pages: ParsedPage[];                // Structural metadata per page
  metadata?: Record<string, string>;  // /Info dictionary entries
  isEncrypted: boolean;               // Whether the PDF uses encryption
  isLinearized: boolean;              // Whether the PDF is web-optimized
  xrefOffset: number;                 // Byte offset of the xref section
}
```

Each `ParsedPage` contains:

```ts
interface ParsedPage {
  index: number;                                  // Zero-based page index
  mediaBox: [number, number, number, number];     // Page dimensions
  cropBox?: [number, number, number, number];     // Visible area (if set)
  rotation?: number;                              // 0, 90, 180, or 270
  contentStreamOffset: number;                    // Byte offset in the PDF
  contentStreamLength: number;                    // Stream length in bytes
  resourcesOffset?: number;                       // /Resources dict offset
}
```

---

## On-Demand Page Content

After calling `end()`, you can retrieve the raw content stream bytes for any page:

```ts
const parser = new StreamingPdfParser();
parser.feed(pdfData);
const result = parser.end();

// Load content for page 3 only
const contentBytes = await parser.getPageContent(2);
console.log(`Content stream: ${contentBytes.length} bytes`);
```

::: warning
`getPageContent()` returns the raw (possibly compressed) bytes of the page content stream. You will need to decompress (e.g., with FlateDecode) and interpret the PDF operators yourself if you need to extract text or graphics.
:::

---

## Event System

The parser emits events during processing, useful for progress tracking and debugging:

```ts
import { StreamingPdfParser } from 'modern-pdf-lib';

const parser = new StreamingPdfParser();

parser.on('header', (event) => {
  if (event.type === 'header') console.log(`PDF version: ${event.version}`);
});

parser.on('page', (event) => {
  if (event.type === 'page') {
    console.log(`Found page ${event.index}: ${event.page.mediaBox}`);
  }
});

parser.on('progress', (event) => {
  if (event.type === 'progress') {
    console.log(`Read ${event.bytesRead} bytes`);
  }
});

parser.on('error', (event) => {
  if (event.type === 'error') {
    console.error(`Parse error at offset ${event.offset}: ${event.message}`);
  }
});

parser.feed(pdfData);
const result = parser.end();
```

### Event Types

| Event | Fields | Description |
|---|---|---|
| `header` | `version` | PDF header version parsed |
| `xref` | `offset`, `entries` | Cross-reference section found |
| `trailer` | `dict` | Trailer dictionary parsed |
| `page` | `index`, `page` | Page metadata extracted |
| `object` | `number`, `generation`, `offset` | Indirect object located |
| `progress` | `bytesRead`, `totalBytes` | Data ingestion progress; both fields are the running total so far (the total size is unknown while streaming) |
| `error` | `message`, `offset` | Non-fatal parse issue |

---

## Best Practices

1. **Set `maxBufferSize` to the largest file you expect** -- the parser holds the whole file in memory until the instance is dropped, and `feed()` throws a `PdfParseError` once the bytes fed would pass `maxBufferSize` (default 64 MB). While chunks are fed, the buffer's capacity is up to twice the bytes fed, and `feed()` takes time linear in the bytes fed whatever the chunk size. Raising `maxBufferSize` raises the memory the parser may hold by the same amount, so a service that handles untrusted files should also run the parser under operating-system limits.

2. **Use `fromStream()` for network data** -- it handles the `ReadableStream` reader lifecycle automatically and is the most ergonomic API for `fetch` responses.

3. **Use `fromFile()` for server-side batch processing** -- it handles Node.js/Deno/Bun file reading automatically.

4. **Prefer the streaming parser for metadata extraction** -- if you only need page counts, dimensions, or document info, the streaming parser skips content-stream decoding and object-graph construction, so it does less work than a full `PdfDocument.load()`.

5. **Check `isEncrypted` before accessing content** -- encrypted PDFs require decryption before content streams can be read. The streaming parser detects encryption but does not decrypt.

6. **Handle linearized PDFs** -- linearized (web-optimized) PDFs have their first page data near the start of the file. The `isLinearized` flag tells you whether the PDF supports progressive loading.

---

## API Reference

| Export | Description |
|---|---|
| `StreamingPdfParser` | The streaming parser class |
| `StreamingParserOptions` | Configuration options interface |
| `StreamingParseResult` | Result of the structural parse |
| `ParsedPage` | Per-page structural metadata |
| `StreamingParserEvent` | Union type of all parser events |
