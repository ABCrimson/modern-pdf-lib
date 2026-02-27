# Getting Started

## Installation

Install `modern-pdf-lib` with your preferred package manager:

::: code-group

```sh [npm]
npm install modern-pdf-lib
```

```sh [pnpm]
pnpm add modern-pdf-lib
```

```sh [bun]
bun add modern-pdf-lib
```

:::

> [!NOTE]
> `modern-pdf-lib` is ESM-only. It requires Node 25.7 or later, or any runtime with native ES module support.

## Your First PDF

Create a simple "Hello World" PDF in just a few lines:

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);

page.drawText('Hello, Modern PDF!', {
  x: 50,
  y: 700,
  size: 24,
  color: rgb(0.1, 0.1, 0.1),
});

const bytes = await pdf.save();
```

The `bytes` variable is a `Uint8Array` containing a valid PDF document.

## Running in Node

Write the PDF to a file using the Node `fs` module:

```ts
import { writeFile } from 'node:fs/promises';
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);

page.drawText('Hello from Node!', {
  x: 50,
  y: 700,
  size: 24,
  color: rgb(0, 0, 0),
});

const bytes = await pdf.save();
await writeFile('output.pdf', bytes);
console.log('Wrote output.pdf');
```

You can also stream the output directly to a file to reduce peak memory usage:

```ts
import { createWriteStream } from 'node:fs';
import { Writable } from 'node:stream';

const stream = pdf.saveAsStream();
const fileStream = createWriteStream('output.pdf');

await stream.pipeTo(Writable.toWeb(fileStream));
```

## Running in the Browser

In a browser context you can trigger a download or display the PDF in an iframe:

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);

page.drawText('Hello from the browser!', {
  x: 50,
  y: 700,
  size: 24,
  color: rgb(0, 0, 0),
});

const blob = await pdf.saveAsBlob();
const url = URL.createObjectURL(blob);

// Trigger a download
const a = document.createElement('a');
a.href = url;
a.download = 'document.pdf';
a.click();

// Clean up
URL.revokeObjectURL(url);
```

## Running in Cloudflare Workers

Return the PDF as a streaming HTTP response:

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';

export default {
  async fetch(): Promise<Response> {
    const pdf = createPdf();
    const page = pdf.addPage(PageSizes.A4);

    page.drawText('Hello from Workers!', {
      x: 50,
      y: 700,
      size: 24,
      color: rgb(0, 0, 0),
    });

    const stream = pdf.saveAsStream();

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
    });
  },
};
```

## WASM Initialization

`modern-pdf-lib` ships with optional WebAssembly modules that accelerate compression, PNG decoding, font parsing, and text shaping. Without WASM, the library falls back to pure-JavaScript implementations.

### Automatic Initialization

In most environments, WASM modules are loaded automatically on first use. No extra configuration is needed:

```ts
// WASM is loaded lazily when save() needs compression
const bytes = await pdf.save();
```

### Explicit Initialization

If you want to control when the WASM binary is loaded (for example, during application startup), call `initWasm()` explicitly:

```ts
import { initWasm } from 'modern-pdf-lib';

// Load WASM during app startup
await initWasm();

// All subsequent operations use WASM-accelerated paths
```

You can also provide a custom URL to the `.wasm` file if your deployment requires a specific asset path:

```ts
await initWasm(new URL('./wasm/modern_pdf_bg.wasm', import.meta.url));
```

> [!TIP]
> WASM acceleration is entirely optional. The pure-JS fallback produces identical PDFs — just slightly slower for large documents.

## Next Steps

- [Text Drawing](/guide/text) — Fonts, sizes, colors, and positioning
- [Images](/guide/images) — Embed PNGs and JPEGs
- [Fonts](/guide/fonts) — Custom fonts, subsetting, and complex scripts
- [Shapes](/guide/shapes) — Rectangles, circles, lines, and colors
- [Streaming](/guide/streaming) — Memory-efficient output for large documents
- [API Reference](/api/) — Full TypeDoc-generated reference
