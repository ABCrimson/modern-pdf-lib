# Performance Tuning

This guide covers performance optimization techniques for `modern-pdf-lib`, from compression settings and font subsetting to streaming output and memory management.

## Why Performance Matters

PDF generation can be CPU-intensive and memory-hungry. A 500-page report with embedded fonts and images may take seconds to generate and consume hundreds of megabytes of memory. Compression level, font subsetting, streaming output and reusing embedded fonts and images are the main levers.

`modern-pdf-lib` is designed for performance out of the box: subsetting is automatic, compression is enabled by default, and the ESM-first architecture enables tree-shaking. This guide covers how to go further.

## WebAssembly Modules

The package ships WebAssembly builds of six Rust crates under `dist/wasm/` (libdeflate, png, ttf, shaping, jbig2 and jpeg, exposed through the `modern-pdf-lib/wasm/*` subpath export), but this release's JavaScript does not run them; all work runs in pure JavaScript.

### What runs today

- Stream compression uses fflate.
- PNG and JPEG decoding, font parsing and subsetting, and JBIG2 decoding run in JavaScript.
- `initWasm()` without an argument returns at once. `initWasm({ deflate: true })` rejects with "Failed to initialize libdeflate WASM", and the `png`, `fonts` and `jpeg` options resolve without enabling anything.
- `save({ useWasm: true })` is accepted, and fflate still produces the output.
- JPEG recompression in `optimizeAllImages()` and `modern-pdf optimize` needs the JPEG WASM encoder, so it changes no image.

Application code does not need to call `initWasm()`.

## Font Subsetting

Font subsetting is enabled by default. When you embed a font, only the glyphs actually used in the document are included in the output PDF. This has a dramatic impact on file size.

### File Size Impact

| Font | Full Size | Subsetted (typical) | Reduction |
|:---|:---:|:---:|:---:|
| Inter Regular | 310 KB | ~15 KB | 95% |
| Roboto Regular | 170 KB | ~12 KB | 93% |
| Noto Sans CJK | 16 MB | ~50 KB | 99.7% |
| Noto Serif | 290 KB | ~18 KB | 94% |

### How It Works

```ts
import { createPdf, rgb } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const pdf = createPdf();
const page = pdf.addPage();

const fontBytes = new Uint8Array(await readFile('fonts/Inter-Regular.ttf'));
const font = await pdf.embedFont(fontBytes);

// Only the glyphs for "Hello, world!" are embedded
page.drawText('Hello, world!', { x: 50, y: 700, font, size: 16, color: rgb(0, 0, 0) });

const bytes = await pdf.save();
```

### Disabling Subsetting

In rare cases, such as PDF form templates where users may enter arbitrary text at view time, embed the full font:

```ts
const font = await pdf.embedFont(fontBytes, { subset: false });
```

> [!NOTE]
> Standard 14 PDF fonts (Helvetica, Times Roman, Courier, etc.) never require embedding or subsetting. They are built into every PDF viewer and add zero bytes to the output. Use them when Unicode support is not needed.

## Compression Levels

`modern-pdf-lib` compresses streams with FlateDecode (fflate) by default at level 6. `compressionLevel` accepts 1 to 9, so you can tune the trade-off between speed and file size.

### Compression Level Table

| Level | Speed | File Size | Engine |
|:---|:---:|:---:|:---|
| 1 | Fastest | Largest | fflate |
| 3 | Fast | Large | fflate |
| 6 (default) | Balanced | Balanced | fflate |
| 9 | Slowest | Smallest | fflate |

### Code Example

```ts
import { createPdf } from 'modern-pdf-lib';

const pdf = createPdf();
// ... build document ...

// Default: compress at level 6
const balanced = await pdf.save();

// Smallest output: level 9
const smallest = await pdf.save({ compress: true, compressionLevel: 9 });

// Fastest: level 1 for quick previews
const fast = await pdf.save({ compress: true, compressionLevel: 1 });

// No compression (useful for debugging, reading raw streams)
const raw = await pdf.save({ compress: false });
```

> [!WARNING]
> Disabling compression (`compress: false`) can increase file size substantially. Only use this for debugging or when the output will be re-compressed by an outer container (e.g., gzip over HTTP).

## Streaming Output

For large documents, `saveAsStream()` emits the PDF as a stream of chunks instead of building the final byte array in one buffer. The document model (all pages, fonts and images) stays in memory, and each stream object is compressed and serialized into a temporary buffer.

### When to Use Streaming

- Documents with 50+ pages
- Documents with more than 10 MB of embedded images
- Server-side PDF generation where you are piping to an HTTP response
- Memory-constrained environments (Cloudflare Workers, edge functions)

### Streaming to a File

```ts
import { createWriteStream } from 'node:fs';
import { Writable } from 'node:stream';
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
for (let i = 0; i < 500; i++) {
  const page = pdf.addPage(PageSizes.A4);
  page.drawText(`Page ${i + 1}`, {
    x: 50,
    y: 750,
    size: 24,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
}

const stream = pdf.saveAsStream();
const fileStream = createWriteStream('large-report.pdf');
await stream.pipeTo(Writable.toWeb(fileStream));
```

### Streaming to an HTTP Response

```ts
export default {
  async fetch(): Promise<Response> {
    const pdf = createPdf();
    // ... build a large document ...

    return new Response(pdf.saveAsStream(), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="report.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  },
};
```

The benefits of streaming:

- **No single output buffer** -- objects are serialized and emitted in chunks
- **Faster time-to-first-byte** -- the HTTP response starts before the entire PDF is generated
- **Backpressure support** -- the stream pauses generation if the consumer is slower than the producer

## Batch Operations

When generating multi-page documents, embed fonts and images once and reuse the references across all pages.

### Embed Once, Reuse Everywhere

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const pdf = createPdf();

// Embed font and image ONCE
const fontBytes = new Uint8Array(await readFile('fonts/Inter-Regular.ttf'));
const font = await pdf.embedFont(fontBytes);

const logoBytes = new Uint8Array(await readFile('images/logo.png'));
const logo = await pdf.embedPng(logoBytes);

// Reuse across all pages
for (let i = 0; i < 200; i++) {
  const page = pdf.addPage(PageSizes.A4);
  page.drawImage(logo, { x: 50, y: 770, width: 100, height: 40 });
  page.drawText(`Invoice #${i + 1}`, { x: 50, y: 720, font, size: 20, color: rgb(0, 0, 0) });
  page.drawText('Thank you for your business.', { x: 50, y: 690, font, size: 12, color: rgb(0, 0, 0) });
}

const bytes = await pdf.save();
```

> [!WARNING]
> Do not call `embedFont()` or `embedPng()` / `embedJpeg()` inside a loop. Each call parses, subsets, and compresses the data from scratch. Embedding the same font 200 times wastes memory and CPU, and bloats the output file because 200 copies of the font data are written.

### Before and After

```ts
// BAD: embeds the font 100 times
for (let i = 0; i < 100; i++) {
  const font = await pdf.embedFont(fontBytes); // 100 copies of the font data
  const page = pdf.addPage();
  page.drawText('Hello', { x: 50, y: 700, font, size: 16 });
}

// GOOD: embeds the font once
const font = await pdf.embedFont(fontBytes); // 1 copy of the font data
for (let i = 0; i < 100; i++) {
  const page = pdf.addPage();
  page.drawText('Hello', { x: 50, y: 700, font, size: 16 });
}
```

## Memory Considerations

### Large Documents (1000+ Pages)

For documents with hundreds or thousands of pages, use `saveAsStream()` to avoid materializing the whole file in one buffer. The streaming serializer emits the serialized objects in chunks; the document model stays in memory.

```ts
const pdf = createPdf();
const helvetica = await pdf.embedFont(StandardFonts.Helvetica);

for (let i = 0; i < 2000; i++) {
  const page = pdf.addPage(PageSizes.A4);
  page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 18, font: helvetica });
}

// Stream to disk instead of buffering the entire PDF
const stream = pdf.saveAsStream();
// ... pipe to file or HTTP response
```

### Image-Heavy Documents

Image handling varies significantly by format:

| Format | Behavior | Memory Impact |
|:---|:---|:---|
| JPEG | Zero-copy passthrough | Low -- raw JPEG bytes are embedded directly |
| PNG | Decompressed, re-encoded | High -- full RGBA bitmap is held in memory during embedding |

**Recommendations:**

1. **Use JPEG for photographs.** JPEG data is embedded as-is, with no decompression or recompression. This is the fastest and most memory-efficient path.
2. **Scale images before embedding.** A 4000x3000 photograph displayed at 200x150 points wastes memory and file size. Resize images to the target display size before calling `embedPng()` or `embedJpeg()`.
3. **Embed each image once.** Reuse the `ImageRef` across pages (see [Batch Operations](#batch-operations)).

### Memory Budget by Runtime

| Runtime | Typical Memory Limit | Recommendation |
|:---|:---:|:---|
| Node.js | 2-4 GB (configurable) | Use `save()` for most documents; `saveAsStream()` for 500+ pages |
| Bun | 2-4 GB | Same as Node |
| Deno | 2-4 GB | Same as Node |
| Cloudflare Workers | 128 MB | Use `saveAsStream()` for responses |
| Browser | Device-dependent | Use `saveAsBlob()` for downloads; `saveAsStream()` for large docs |

## Concurrency & resource control

### Memory budget (untrusted input)

When processing PDFs from untrusted sources, a `MemoryBudget` rejects work that
would exceed a ceiling **before** the allocation happens — a guard against
decompression bombs. It is a pure accounting guard (callers report the size they
are about to allocate); it does not measure real RSS.

```ts
import { createMemoryBudget, MemoryBudgetExceededError } from 'modern-pdf-lib';

const budget = createMemoryBudget(256 * 1024 * 1024); // 256 MB ceiling
try {
  budget.allocate(expectedInflatedLength); // throws if it would exceed
  // … decode the stream …
} catch (e) {
  if (e instanceof MemoryBudgetExceededError) { /* reject the document */ }
} finally {
  budget.release(expectedInflatedLength);
}
// Or scope it automatically:
budget.withAllocation(size, () => decodeStream(/* … */));
```

### Shared-memory primitives

For coordinating work across Web Workers / worker threads, `SharedArrayBuffer` +
`Atomics` primitives are provided: an atomic `SharedCounter`, a `SharedFlag`
(Atomics wait/notify gate), and an SPSC `SharedRingBuffer`. `isSharedMemoryAvailable()`
reports whether shared memory is usable in the current context (it requires
cross-origin isolation in browsers).

```ts
import { isSharedMemoryAvailable, SharedCounter, SharedRingBuffer } from 'modern-pdf-lib';

if (isSharedMemoryAvailable()) {
  const counter = new SharedCounter();      // post counter.buffer to a worker
  counter.add(1);                            // atomic; returns the pre-add value
  const ring = new SharedRingBuffer(1 << 16);// byte queue shared across workers
}
```

These are thin correctness wrappers — they add no acceleration of their own.

### Runtime capability detection

`detectRuntimeCapabilities()` honestly probes the host for WASM SIMD/threads/
bulk-memory, `SharedArrayBuffer`/`Atomics`, and `hardwareConcurrency`, so you can
gate fast paths:

```ts
import { detectRuntimeCapabilities, SIMD_NOTE } from 'modern-pdf-lib';

const caps = detectRuntimeCapabilities();
// { wasm, wasmSimd, wasmThreads, sharedArrayBuffer, atomics, hardwareConcurrency, … }
```

> [!NOTE]
> A `wasmSimd: true` means a SIMD-enabled build *would* run here — it does **not**
> mean modern-pdf-lib is currently using SIMD. The bundled WASM is built without
> SIMD today (`SIMD_NOTE` documents this); SIMD acceleration requires a
> SIMD-enabled rebuild.

## Cross-Runtime Performance

`modern-pdf-lib` targets Node.js (`engines` `>=26.4`), browsers, Deno, Bun and Cloudflare Workers. The library calls `Uint8Array` base64 and hex methods without a guard; MDN browser-compat-data (read 2026-11-11) lists them from Node.js 25.0.0, Deno 2.5.0, Bun 1.1.22, Chrome 140, Firefox 133 and Safari 18.2.

| Runtime | Tested in CI | Notes |
|:---|:---:|:---|
| Node.js | Yes | Unit tests gate on Node 26; Node 24 and the `devEngines` Node 28 nightly run as non-gating probes |
| Bun | No | Not tested in CI |
| Deno | No | Not tested in CI |
| Cloudflare Workers | No | 128 MB memory limit; use streaming |
| Browser | Yes | Playwright E2E on Chromium, Firefox and WebKit |

> [!TIP]
> For edge deployments, return `saveAsStream()` as the response body. In the browser, prefer `saveAsBlob()` for the simplest user experience.

## Tree-Shaking and Bundle Size

`modern-pdf-lib` ships ES module builds behind subpath exports (`.`, `./create`, `./parse`, `./forms`, `./browser`, `./wasm/*`), CommonJS builds for `.`, `./create`, `./parse` and `./forms`, and `"sideEffects": false`, allowing bundlers (Vite, esbuild, Rollup, webpack 5) to tree-shake unused code. The IIFE bundle (`dist/modern-pdf-lib.iife.js`) is for script tags and is not an export.

### Bundle Size Breakdown

Measured 2026-11-11 from the built `dist/` with esbuild 0.28.2 (`--bundle --minify`) and gzip level 9:

| Scenario | Size (minified + gzipped) |
|:---|:---:|
| Minimal document (`export { createPdf } from 'modern-pdf-lib'`, `node:*` external) | ~108 KB (110,411 B) |
| Entire library (`dist/modern-pdf-lib.iife.js`) | ~267 KB (273,001 B) |

### Minimizing Bundle Size

Import only what you use:

```ts
// Minimal: just document creation and text
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

// The bundler can tree-shake away: forms, parser, annotations,
// signatures, accessibility, layers, outlines, SVG, etc.
```

> [!NOTE]
> The WebAssembly builds under `dist/wasm/` are separate files and are never part of the JavaScript bundles; this release's JavaScript does not run them.

## Benchmarking

`modern-pdf-lib` includes benchmark suites that you can run to measure performance on your hardware and runtime.

### Running Benchmarks

```bash
pnpm exec vitest bench tests/benchmarks/
```

### Available Benchmark Suites

| Suite | File | What It Measures |
|:---|:---|:---|
| Full document | `tests/benchmarks/fullDocument.bench.ts` | End-to-end PDF creation: page creation, text drawing, serialization |
| Compression | `tests/benchmarks/compression.bench.ts` | fflate compress/decompress at various levels and data sizes |
| Font parsing | `tests/benchmarks/fontParsing.bench.ts` | Standard font lookup speed and text measurement throughput |
| Image optimization | `tests/benchmarks/imageOptimize.bench.ts` | Image optimization throughput |

The `*.bench.ts` files use the `bench` fixture of vitest 5.1 (5.1.0, pinned in `package.json`) through `tests/benchmarks/vitestBench.ts`. The head-to-head comparison against `pdf-lib` (a devDependency, pinned in `package.json`) lives in `tests/benchmarks/comparison.ts` and runs on a standalone tinybench harness:

```bash
pnpm run bench
```

The comparison covers 37 operations. The harness prints how many of them each library wins on the machine that runs it; the counts vary by machine.

### Running a Single Suite

```bash
pnpm exec vitest bench tests/benchmarks/compression.bench.ts
```

The benchmarks report timings; no assertion or CI job enforces a time target.

## Quick Reference

| Optimization | When to Use | Impact |
|:---|:---|:---|
| Font subsetting (default) | Always (disable only for form templates) | Smaller embedded fonts |
| Compression level tuning | Adjust based on speed vs. size priority | Level 1 to 9 trade-off |
| Streaming output | 50+ pages, HTTP responses, edge runtimes | No single output buffer |
| Batch embedding | Multi-page docs with shared fonts/images | Avoid duplicate data |
| JPEG over PNG | Photographs and complex images | Zero-copy, less memory |
| Tree-shaking | Browser bundles, edge functions | Import only what you use |
