# modern-pdf

[![CI](https://github.com/user/modern-pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/user/modern-pdf/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/modern-pdf)](https://www.npmjs.com/package/modern-pdf)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A modern, WASM-accelerated PDF creation engine for every JavaScript runtime.

`modern-pdf` is an ESM-only, TypeScript-first library for generating PDF documents from scratch. It runs in Node 22+, Deno, Bun, Cloudflare Workers, and all modern browsers. Optional WebAssembly modules provide hardware-speed compression, PNG decoding, font parsing, and text shaping.

## Features

- **Universal runtime** — Node 22+, Deno, Bun, Cloudflare Workers, browsers
- **WASM-accelerated** — Optional WebAssembly modules for 5-10x faster compression, PNG decoding, font parsing, and text shaping
- **Streaming output** — Generate PDFs as a `ReadableStream` for low-memory server workloads
- **Tree-shakable** — ESM-only, zero side effects. Core bundle under 20 KB gzipped
- **TypeScript-first** — Written in TypeScript 6.0 with strict types and full IntelliSense
- **PDF/A support** — Generate archival-grade PDF/A-2b documents
- **No dependencies on Node APIs** — Uses `Uint8Array` everywhere, no `Buffer` or `fs` required
- **Font subsetting** — Automatic subsetting for TrueType and OpenType fonts
- **Complex script support** — Arabic, Hebrew, Devanagari, Thai, and other complex scripts via rustybuzz

## Quick Start

```sh
npm install modern-pdf
```

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);

page.drawText('Hello, Modern PDF!', {
  x: 50,
  y: 700,
  size: 24,
  color: rgb(0.1, 0.1, 0.1),
});

// Full buffer
const bytes = await pdf.save();

// Streaming (low memory)
const stream = pdf.saveAsStream();

// Browser blob
const blob = await pdf.saveAsBlob();
```

## Architecture

`modern-pdf` uses a multi-stage pipeline to transform high-level drawing commands into a compliant PDF byte stream:

```
  Authoring          Asset Resolution       Compilation         Output
 ───────────       ──────────────────     ─────────────       ──────────
 createPdf()  ──►  Font embedding    ──►  PDF objects   ──►  Uint8Array
 addPage()         Image embedding        Cross-ref          ReadableStream
 drawText()        Font subsetting        Compression        Blob
 drawImage()       Text shaping           Serialization
 drawRect()
```

| Stage | Description |
|---|---|
| **Authoring** | High-level API calls build an in-memory document model |
| **Asset Resolution** | Fonts are parsed and subsetted, images are decoded and compressed |
| **Compilation** | The document model is serialized into PDF objects, cross-reference tables, and trailer |
| **Output** | The byte stream is emitted as a buffer, stream, or blob |

## Runtime Support

| Runtime | Version | Status |
|---|---|---|
| Node.js | 22+ | Fully supported |
| Deno | 1.40+ | Fully supported |
| Bun | 1.0+ | Fully supported |
| Cloudflare Workers | — | Fully supported |
| Chrome / Edge | 109+ | Fully supported |
| Firefox | 115+ | Fully supported |
| Safari | 16.4+ | Fully supported |

## Performance Targets

| Operation | Target | WASM Boost |
|---|---|---|
| Hello World PDF | < 1 ms | — |
| 100-page text document | < 50 ms | 2x faster compression |
| Embed 5 MB PNG | < 15 ms | 5x faster decode |
| Embed 50 KB TTF + subset | < 5 ms | 3x faster parsing |
| Complex script shaping (1000 chars) | < 10 ms | 10x faster shaping |

## WASM Modules

All WASM modules are optional. Without them, `modern-pdf` falls back to pure-JavaScript implementations that produce identical output.

| Module | Crate | Purpose |
|---|---|---|
| `libdeflate` | libdeflate (via flate2) | Deflate compression for PDF streams |
| `png` | png | PNG image decoding with alpha support |
| `ttf` | ttf-parser | TrueType/OpenType font parsing and subsetting |
| `shaping` | rustybuzz | OpenType text shaping for complex scripts |

Initialize WASM explicitly for best performance:

```ts
import { initWasm } from 'modern-pdf';
await initWasm();
```

## Installation

### npm / pnpm / bun

```sh
npm install modern-pdf
pnpm add modern-pdf
bun add modern-pdf
```

### CDN (ESM)

```ts
import { createPdf, PageSizes, rgb } from 'https://esm.sh/modern-pdf';
```

## Documentation

- [Getting Started](https://user.github.io/modern-pdf/getting-started)
- [Text Drawing](https://user.github.io/modern-pdf/guide/text)
- [Images](https://user.github.io/modern-pdf/guide/images)
- [Fonts](https://user.github.io/modern-pdf/guide/fonts)
- [Shapes](https://user.github.io/modern-pdf/guide/shapes)
- [Streaming](https://user.github.io/modern-pdf/guide/streaming)
- [API Reference](https://user.github.io/modern-pdf/api/)
- [Migration from pdf-lib](https://user.github.io/modern-pdf/migration/from-pdf-lib)

## Contributing

Contributions are welcome. Please follow these steps:

1. **Fork** the repository and create your branch from `main`.
2. **Install dependencies**: `npm install`
3. **Build WASM modules** (requires Rust and wasm-pack): `npm run build:wasm`
4. **Build TypeScript**: `npm run build`
5. **Run tests**: `npm test`
6. **Run linting**: `npm run lint`
7. **Submit a pull request** with a clear description of your changes.

### Development Prerequisites

- Node.js 22+
- Rust stable toolchain with the `wasm32-unknown-unknown` target
- wasm-pack 0.14+

### Project Structure

```
modern-pdf/
  src/
    core/           # PDF document model, objects, writer, page
    compression/    # Compression adapters (WASM + JS fallback)
    runtime/        # Runtime detection and adapters
    wasm/           # WASM crate source (Rust)
      libdeflate/   #   Deflate compression
      png/          #   PNG decoding
      ttf/          #   Font parsing
      shaping/      #   Text shaping
    index.ts        # Public API entry point
  tests/            # Unit and integration tests
  docs/             # VitePress documentation site
  scripts/          # Build and utility scripts
```

## License

[MIT](LICENSE)
