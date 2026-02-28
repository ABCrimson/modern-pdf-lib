# Performance Tuning

This guide covers performance optimization techniques for `modern-pdf-lib`, from WASM acceleration and font subsetting to streaming output and memory management.

## Why Performance Matters

PDF generation can be CPU-intensive and memory-hungry. A 500-page report with embedded fonts and images may take seconds to generate and consume hundreds of megabytes of memory. With the right settings, you can cut generation time by 5-10x and reduce peak memory by 80% or more.

`modern-pdf-lib` is designed for performance out of the box: subsetting is automatic, compression is enabled by default, and the ESM-only architecture enables tree-shaking. This guide covers how to go further.

## WASM Acceleration

`modern-pdf-lib` ships with optional WASM modules that accelerate the most expensive operations. All WASM modules have pure-JS fallbacks, so your code runs everywhere -- WASM just makes it faster.

### When to Enable WASM

Enable WASM acceleration when:

- Generating large documents (100+ pages, many images)
- Running server-side where throughput matters
- Working with large fonts (CJK, Noto families)
- File size is critical (libdeflate produces smaller output at high levels)

### Initialization

Call `initWasm()` once at startup, before any `save()` calls:

#### Node / Bun

```ts
import { initWasm, createPdf, PageSizes, rgb } from 'modern-pdf-lib';

await initWasm({ deflate: true, fonts: true, png: true });

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);
page.drawText('WASM-accelerated PDF', { x: 50, y: 700, size: 24, color: rgb(0, 0, 0) });

const bytes = await pdf.save({ useWasm: true });
```

#### Browser

```ts
import { initWasm, createPdf } from 'modern-pdf-lib';

// Load WASM modules (fetched from your static assets)
await initWasm({ deflate: true, fonts: true, png: true });

const pdf = createPdf();
// ... build document ...
const blob = await pdf.saveAsBlob();
```

#### Deno

```ts
import { initWasm, createPdf } from 'modern-pdf-lib';

await initWasm({ deflate: true, fonts: true });

const pdf = createPdf();
// ... build document ...
const bytes = await pdf.save({ useWasm: true });
await Deno.writeFile('output.pdf', bytes);
```

#### Cloudflare Workers

```ts
import { initWasm, createPdf } from 'modern-pdf-lib';

// Initialize once at module scope (runs during cold start)
await initWasm({ deflate: true });

export default {
  async fetch(): Promise<Response> {
    const pdf = createPdf();
    // ... build document ...

    return new Response(pdf.saveAsStream(), {
      headers: { 'Content-Type': 'application/pdf' },
    });
  },
};
```

### Speedup by Module

| WASM Module | Operation | Typical Speedup | Notes |
|:---|:---|:---:|:---|
| `deflate` | Stream compression | 2-4x | Uses libdeflate; supports levels 1-12 |
| `fonts` | Font subsetting | 3-5x | Largest benefit with CJK fonts |
| `png` | PNG decoding | ~5x | Decodes PNG alpha and filters in WASM |
| `jbig2` | JBIG2 image decoding | ~3x | Bilevel image decompression |

> [!TIP]
> WASM is entirely optional. Every WASM module has a pure-JS fallback that produces identical output. You can ship without WASM and add it later as a performance optimization.

### Pre-loading WASM Bytes

If your environment does not support dynamic `import()` or you want to control how WASM files are loaded, pass the binary bytes directly:

```ts
import { initWasm } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const deflateWasm = new Uint8Array(await readFile('node_modules/modern-pdf-lib/wasm/deflate.wasm'));

await initWasm({ deflate: true, deflateWasm });
```

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

`modern-pdf-lib` compresses streams with FlateDecode by default at level 6. You can tune the trade-off between speed and file size.

### Compression Level Table

| Level | Speed | File Size | Engine |
|:---|:---:|:---:|:---|
| 1 | Fastest | Largest | fflate / libdeflate |
| 3 | Fast | Large | fflate / libdeflate |
| 6 (default) | Balanced | Balanced | fflate / libdeflate |
| 9 | Slow | Smallest (deflate) | fflate / libdeflate |
| 12 | Slowest | Smallest overall | libdeflate WASM only |

Levels 10-12 are only available when the libdeflate WASM module is loaded. These levels use a more aggressive search algorithm that can squeeze out an additional 3-8% reduction compared to level 9.

### Code Example

```ts
import { createPdf } from 'modern-pdf-lib';

const pdf = createPdf();
// ... build document ...

// Default: compress at level 6
const balanced = await pdf.save();

// Maximum compression with libdeflate WASM
const smallest = await pdf.save({ compress: true, compressionLevel: 9, useWasm: true });

// Fastest: level 1 for quick previews
const fast = await pdf.save({ compress: true, compressionLevel: 1 });

// No compression (useful for debugging, reading raw streams)
const raw = await pdf.save({ compress: false });
```

> [!WARNING]
> Disabling compression (`compress: false`) can increase file size by 3-10x. Only use this for debugging or when the output will be re-compressed by an outer container (e.g., gzip over HTTP).

## Streaming Output

For large documents, `saveAsStream()` serializes the PDF incrementally instead of building the entire byte array in memory.

### Memory Comparison

| Method | Peak Memory (500 pages, 50 images) | Time to First Byte |
|:---|:---:|:---:|
| `save()` | ~120 MB | After full generation |
| `saveAsStream()` | ~15 MB | Immediate |

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
for (let i = 0; i < 500; i++) {
  const page = pdf.addPage(PageSizes.A4);
  page.drawText(`Page ${i + 1}`, {
    x: 50,
    y: 750,
    size: 24,
    font: StandardFonts.Helvetica,
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

- **Lower peak memory** -- pages are serialized and flushed incrementally
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
const logo = pdf.embedPng(logoBytes);

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

For documents with hundreds or thousands of pages, use `saveAsStream()` to avoid holding the entire PDF in memory. The streaming serializer flushes page data incrementally.

```ts
const pdf = createPdf();

for (let i = 0; i < 2000; i++) {
  const page = pdf.addPage(PageSizes.A4);
  page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 18, font: StandardFonts.Helvetica });
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
| PNG (WASM) | WASM-accelerated decode | Medium -- faster and slightly less memory than pure JS |

**Recommendations:**

1. **Use JPEG for photographs.** JPEG data is embedded as-is, with no decompression or recompression. This is the fastest and most memory-efficient path.
2. **Scale images before embedding.** A 4000x3000 photograph displayed at 200x150 points wastes memory and file size. Resize images to the target display size before calling `embedPng()` or `embedJpeg()`.
3. **Enable WASM for PNG-heavy documents.** The WASM PNG decoder uses less memory and runs ~5x faster than the pure-JS fallback.
4. **Embed each image once.** Reuse the `ImageRef` across pages (see [Batch Operations](#batch-operations)).

### Memory Budget by Runtime

| Runtime | Typical Memory Limit | Recommendation |
|:---|:---:|:---|
| Node.js | 2-4 GB (configurable) | Use `save()` for most documents; `saveAsStream()` for 500+ pages |
| Bun | 2-4 GB | Same as Node |
| Deno | 2-4 GB | Same as Node |
| Cloudflare Workers | 128 MB | Always use `saveAsStream()`; keep documents under 100 pages |
| Browser | Device-dependent | Use `saveAsBlob()` for downloads; `saveAsStream()` for large docs |

## Cross-Runtime Performance

`modern-pdf-lib` runs in every JavaScript runtime. Performance characteristics vary:

| Runtime | Throughput | WASM Support | Notes |
|:---|:---:|:---:|:---|
| Node.js | Best | Full | Best for server-side batch generation |
| Bun | Comparable | Full | Slightly faster cold start than Node |
| Deno | Comparable | Full | Comparable to Node for PDF generation |
| Cloudflare Workers | Good | Full | 128 MB memory limit; use streaming |
| Browser | Device-dependent | Full | Performance varies with device hardware |

> [!TIP]
> For server-side generation, Node.js and Bun offer the best throughput. For edge deployments, Cloudflare Workers work well with streaming output and moderate document sizes. In the browser, prefer `saveAsBlob()` for the simplest user experience.

## Tree-Shaking and Bundle Size

`modern-pdf-lib` is ESM-only with granular exports, allowing bundlers (Vite, esbuild, Rollup, webpack 5) to tree-shake unused code.

### Bundle Size Breakdown

| Import | Approximate Size (minified + gzipped) |
|:---|:---:|
| Core (`createPdf`, `PdfPage`, `save`) | ~25 KB |
| Font embedding + subsetting | ~15 KB |
| Image embedding (JPEG + PNG) | ~10 KB |
| Form fields (AcroForm) | ~12 KB |
| Parser (`loadPdf`, `extractText`) | ~18 KB |
| Compression (fflate) | ~13 KB |
| Full library (all exports) | ~90 KB |

### Minimizing Bundle Size

Import only what you use:

```ts
// Minimal: just document creation and text
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

// The bundler can tree-shake away: forms, parser, annotations,
// signatures, accessibility, layers, outlines, SVG, etc.
```

> [!NOTE]
> WASM modules are loaded lazily via `initWasm()` and are never included in the main bundle. They are fetched at runtime only when explicitly requested. If you never call `initWasm()`, zero WASM bytes are loaded.

## Benchmarking

`modern-pdf-lib` includes benchmark suites that you can run to measure performance on your hardware and runtime.

### Running Benchmarks

```bash
npx vitest bench tests/benchmarks/
```

### Available Benchmark Suites

| Suite | File | What It Measures |
|:---|:---|:---|
| Full document | `tests/benchmarks/fullDocument.bench.ts` | End-to-end PDF creation: page creation, text drawing, serialization |
| Compression | `tests/benchmarks/compression.bench.ts` | fflate compress/decompress at various levels and data sizes |
| Font parsing | `tests/benchmarks/fontParsing.bench.ts` | Standard font lookup speed and text measurement throughput |
| Comparison | `tests/benchmarks/comparison.bench.ts` | Head-to-head: modern-pdf-lib vs pdf-lib across shared operations |

### Running a Single Suite

```bash
npx vitest bench tests/benchmarks/compression.bench.ts
```

### Performance Targets

These are the baseline targets from the benchmark suite:

| Operation | Target |
|:---|:---:|
| Empty 1-page PDF | < 1 ms |
| 10-page text document | < 10 ms |
| 100-page text document | < 50 ms |

> [!TIP]
> Run benchmarks before and after enabling WASM to measure the speedup on your specific workload. The benefit depends on document complexity -- image-heavy and font-heavy documents see the largest gains.

## Quick Reference

| Optimization | When to Use | Impact |
|:---|:---|:---|
| WASM acceleration | Large docs, server-side, CJK fonts | 2-10x faster |
| Font subsetting (default) | Always (disable only for form templates) | 90-99% smaller fonts |
| Compression level tuning | Adjust based on speed vs. size priority | 3-8% size difference |
| Streaming output | 50+ pages, HTTP responses, edge runtimes | 80% less memory |
| Batch embedding | Multi-page docs with shared fonts/images | Avoid duplicate data |
| JPEG over PNG | Photographs and complex images | Zero-copy, less memory |
| Tree-shaking | Browser bundles, edge functions | Import only what you use |
