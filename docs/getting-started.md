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
> `modern-pdf-lib` is ESM-first and also ships CJS compatibility builds (`require('modern-pdf-lib')` works). It requires Node 26.4 or later, or any runtime with native ES module support.

::: details Supported Runtimes
| Runtime | Minimum Version | Notes |
|---|---|---|
| Node.js | 26.4+ | Full support including WASM acceleration |
| Deno | Latest | Full support via `npm:` specifier |
| Bun | Latest | Full support |
| Cloudflare Workers | — | Streaming output, no file system |
| Browsers | ES2024+ | All modern browsers via bundler |
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

The `bytes` variable is a `Uint8Array` containing a valid PDF document.

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

// Clean up
URL.revokeObjectURL(url);
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

## WASM Initialization

`modern-pdf-lib` ships optional WebAssembly modules that accelerate the hot paths. Without WASM, the library falls back to pure-JavaScript implementations that produce **identical output** — just slower on large documents.

### Modules you can enable

`initWasm` takes one flag per module, plus an optional byte-array override for each:

| Flag | Byte override | Accelerates |
|---|---|---|
| `deflate` | `deflateWasm` | Stream compression (`FlateDecode`) on save |
| `png` | `pngWasm` | PNG decoding during image embedding |
| `fonts` | `fontWasm` | TrueType/OpenType parsing and subsetting |
| `jpeg` | `jpegWasm` | JPEG encoding and decoding |

All four default to `false`.

### How It Works

WASM modules are **not** loaded automatically — you must ask for them by name. `initWasm` is idempotent, so calling it more than once is safe.

```ts
import { initWasm } from 'modern-pdf-lib';

// Load specific WASM modules during app startup
await initWasm({ deflate: true, png: true, fonts: true });

// All subsequent operations use WASM-accelerated paths
const bytes = await pdf.save();
```

Pass pre-loaded bytes when your deployment controls where assets live — the required approach on Cloudflare Workers and other runtimes without a filesystem. The binaries are published under the `modern-pdf-lib/wasm/*` subpath export, one directory per crate:

::: code-group

```ts [Node.js]
import { readFile } from 'node:fs/promises';
import { initWasm } from 'modern-pdf-lib';

const [deflateWasm, pngWasm] = await Promise.all([
  readFile(new URL(import.meta.resolve('modern-pdf-lib/wasm/libdeflate/modern_pdf_libdeflate_bg.wasm'))),
  readFile(new URL(import.meta.resolve('modern-pdf-lib/wasm/png/modern_pdf_png_bg.wasm'))),
]);

await initWasm({ deflateWasm, pngWasm });
```

```ts [Vite / browser]
import { initWasm } from 'modern-pdf-lib';
// Vite's `?url` suffix emits the binary as a hashed asset and gives you its URL.
// (webpack 5 users: copy the file into your asset pipeline and fetch it by path.)
import deflateUrl from 'modern-pdf-lib/wasm/libdeflate/modern_pdf_libdeflate_bg.wasm?url';

const deflateWasm = new Uint8Array(await fetch(deflateUrl).then((r) => r.arrayBuffer()));
await initWasm({ deflateWasm });
```

:::

| Crate directory | Binary |
|---|---|
| `libdeflate` | `modern_pdf_libdeflate_bg.wasm` |
| `png` | `modern_pdf_png_bg.wasm` |
| `ttf` | `modern_pdf_ttf_bg.wasm` |
| `jpeg` | `modern_pdf_jpeg_bg.wasm` |
| `shaping` | `modern_pdf_shaping_bg.wasm` |
| `jbig2` | `modern_pdf_jbig2_bg.wasm` |

> [!TIP]
> WASM acceleration is entirely optional. The pure-JS fallback produces identical PDFs — just slightly slower for large documents. To rule WASM out entirely (strict CSP without `wasm-unsafe-eval`, for example), call `configureWasmLoader({ disableWasm: true })`. See the [CSP guide](/guide/csp).

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
