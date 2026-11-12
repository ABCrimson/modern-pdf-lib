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

```sh [deno]
deno add npm:modern-pdf-lib
```

:::

> [!NOTE]
> `modern-pdf-lib` is ESM-first and also ships CJS compatibility builds (`require('modern-pdf-lib')` works). It requires Node 26.4 or later, or one of the runtimes listed below.

::: details Supported Runtimes
| Runtime | Minimum Version | Notes |
|---|---|---|
| Node.js | 26.4+ | Unit tests gate on Node 26 in CI |
| Deno | 2.5+ | Via the `npm:` specifier; not tested in CI |
| Bun | 1.1.22+ | Not tested in CI |
| Cloudflare Workers | current workerd (V8 14.0+) | Streaming output, no file system; not tested in CI |
| Chrome / Edge | 140+ | End-to-end tests run in Chromium |
| Firefox | 133+ | End-to-end tests run in Firefox |
| Safari | 18.2+ | End-to-end tests run in WebKit |

The Deno, Bun and browser minimums are the first versions with `Uint8Array.prototype.toBase64`/`toHex` and `Uint8Array.fromBase64`/`fromHex`, which the library calls without a guard (MDN browser-compat-data, read 2026-11-11).
:::

## Your First PDF

Create a simple "Hello World" PDF in just a few lines:

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);
const font = await pdf.embedFont(StandardFonts.Helvetica);

page.drawText('Hello, Modern PDF!', {
  x: 50,
  y: 700,
  size: 24,
  font,
  color: rgb(0.1, 0.1, 0.1),
});

const bytes = await pdf.save();
```

The `bytes` variable is a `Uint8Array` that holds the PDF document.

## Running in Node

Write the PDF to a file using the Node `fs` module:

```ts
import { writeFile } from 'node:fs/promises';
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);
const font = await pdf.embedFont(StandardFonts.Helvetica);

page.drawText('Hello from Node!', {
  x: 50,
  y: 700,
  size: 24,
  font,
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

`saveAsStream()` does not encrypt. For a document with `encrypt()` configured it throws `UnsupportedEncryptionError` (code `unsupported-encryption-path`); use `save()` instead.

## Running in the Browser

In a browser context you can trigger a download or display the PDF in an iframe:

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);
const font = await pdf.embedFont(StandardFonts.Helvetica);

page.drawText('Hello from the browser!', {
  x: 50,
  y: 700,
  size: 24,
  font,
  color: rgb(0, 0, 0),
});

const blob = await pdf.saveAsBlob();
const url = URL.createObjectURL(blob);

// Trigger a download
const a = document.createElement('a');
a.href = url;
a.download = 'document.pdf';
a.click();

// Revoke after the download has started
setTimeout(() => URL.revokeObjectURL(url), 0);
```

## Running in Cloudflare Workers

Return the PDF as a streaming HTTP response:

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

export default {
  async fetch(): Promise<Response> {
    const pdf = createPdf();
    const page = pdf.addPage(PageSizes.A4);
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    page.drawText('Hello from Workers!', {
      x: 50,
      y: 700,
      size: 24,
      font,
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

## WebAssembly Builds

The package ships WebAssembly builds of six Rust crates under `dist/wasm/`, but this release's JavaScript does not run them; all work runs in pure JavaScript. Compression, image decoding and font handling need no setup.

The binaries are published under the `modern-pdf-lib/wasm/*` subpath export, one directory per crate, each with a `.js` glue file next to the binary:

| Crate directory | Binary |
|---|---|
| `libdeflate` | `modern_pdf_libdeflate_bg.wasm` |
| `png` | `modern_pdf_png_bg.wasm` |
| `ttf` | `modern_pdf_ttf_bg.wasm` |
| `jpeg` | `modern_pdf_jpeg_bg.wasm` |
| `shaping` | `modern_pdf_shaping_bg.wasm` |
| `jbig2` | `modern_pdf_jbig2_bg.wasm` |

`initWasm` still exists, but it does not enable a WASM path: `initWasm({ deflate: true })` rejects, `png`, `fonts` and `jpeg` resolve without effect, and a call with no argument returns at once.

> [!TIP]
> To rule WASM out entirely (strict CSP without `wasm-unsafe-eval`, for example), call `configureWasmLoader({ disableWasm: true })`. See the [CSP guide](/guide/csp).

## Next Steps

| Guide | Covers |
|---|---|
| [Text Drawing](/guide/text) | Fonts, sizes, colors, and positioning |
| [Images](/guide/images) | Embedding PNG, JPEG, WebP, and TIFF |
| [Fonts](/guide/fonts) | Custom fonts, subsetting, and complex scripts |
| [Shapes](/guide/shapes) | Rectangles, circles, lines, and colors |
| [Coordinates](/guide/coordinates) | The y-up user space and how to think in it |
| [Streaming](/guide/streaming) | Memory-efficient output for large documents |
| [Troubleshooting](/guide/troubleshooting) | The nine errors newcomers hit most |
| [API Reference](/api/) | Full TypeDoc reference, regenerated from source on every docs deploy |
