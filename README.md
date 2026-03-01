<div align="center">

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/modern--pdf--lib-fff?style=for-the-badge&labelColor=000&color=000&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjhsLTYtNloiLz48cG9seWxpbmUgcG9pbnRzPSIxNCAyIDE0IDggMjAgOCIvPjxsaW5lIHgxPSIxNiIgeTE9IjEzIiB4Mj0iOCIgeTI9IjEzIi8+PGxpbmUgeDE9IjE2IiB5MT0iMTciIHgyPSI4IiB5Mj0iMTciLz48bGluZSB4MT0iMTAiIHkxPSI5IiB4Mj0iOCIgeTI9IjkiLz48L3N2Zz4" />
  <img src="https://img.shields.io/badge/modern--pdf--lib-000?style=for-the-badge&labelColor=fff&color=fff&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjhsLTYtNloiLz48cG9seWxpbmUgcG9pbnRzPSIxNCAyIDE0IDggMjAgOCIvPjxsaW5lIHgxPSIxNiIgeTE9IjEzIiB4Mj0iOCIgeTI9IjEzIi8+PGxpbmUgeDE9IjE2IiB5MT0iMTciIHgyPSI4IiB5Mj0iMTciLz48bGluZSB4MT0iMTAiIHkxPSI5IiB4Mj0iOCIgeTI9IjkiLz48L3N2Zz4" alt="modern-pdf-lib" />
</picture>

### The PDF engine for modern JavaScript

Create, parse, fill, merge, sign, and manipulate PDF documents<br />in Node, Deno, Bun, Cloudflare Workers, and every browser.

<br />

[![npm version](https://img.shields.io/npm/v/modern-pdf-lib?style=flat-square&color=cb3837)](https://www.npmjs.com/package/modern-pdf-lib)
[![bundle size](https://img.shields.io/badge/gzip-36kb_core-blue?style=flat-square)](https://bundlephobia.com/package/modern-pdf-lib)
[![tests](https://img.shields.io/badge/tests-2%2C323_passing-brightgreen?style=flat-square)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat-square&logo=typescript&logoColor=white)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](LICENSE)

<br />

[Get Started](#quick-start) · [Features](#features) · [API](#api-surface) · [Why This?](#why-modern-pdf-lib)

<br />

</div>

---

<br />

## Quick Start

```sh
npm install modern-pdf-lib
```

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

page.drawText('Hello from modern-pdf-lib', {
  x: 50,
  y: 750,
  size: 28,
  color: rgb(0.13, 0.13, 0.13),
});

const bytes = await doc.save();          // Uint8Array
const stream = doc.saveAsStream();       // ReadableStream
const blob = await doc.saveAsBlob();     // Blob (browsers)
```

<br />

## Features

<table>
<tr>
<td width="50%" valign="top">

**Create & Draw**
- Pages, text, images, shapes, SVG paths
- TrueType & OpenType font embedding
- Automatic font subsetting
- JPEG / PNG image embedding
- Image optimization (JPEG recompression, dedup, grayscale)
- RGB, CMYK, grayscale colors
- Linear & radial gradients, tiling patterns
- Text layout (multiline, combed, auto-size)

</td>
<td width="50%" valign="top">

**Parse & Modify**
- Load existing PDFs (encrypted too)
- Extract text with positions
- Fill & flatten AcroForm fields
- Merge, split, copy pages
- Add / remove / reorder pages
- Incremental saves

</td>
</tr>
<tr>
<td width="50%" valign="top">

**Secure & Compliant**
- AES-256 / RC4 encryption & decryption
- Digital signatures (PKCS#7, visible/invisible, timestamps)
- PDF/A-1b through PDF/A-3u validation
- Tagged PDF / PDF/UA accessibility
- Structure tree & marked content
- Redaction with content removal

</td>
<td width="50%" valign="top">

**Advanced**
- Outlines / bookmarks
- Optional content layers (OCGs)
- File attachments
- Watermarks
- Linearization (fast web view)
- 60+ low-level PDF operators
- Custom appearance providers
- CLI: `npx modern-pdf optimize`

</td>
</tr>
</table>

<br />

## Why modern-pdf-lib?

<table>
<tr>
<th></th>
<th align="center"><strong>modern-pdf-lib</strong></th>
<th align="center">pdf-lib</th>
</tr>

<tr><td><strong>Runtime</strong></td>
<td align="center">Node, Deno, Bun, CF Workers, browsers</td>
<td align="center">Node, browsers</td></tr>

<tr><td><strong>Module format</strong></td>
<td align="center">ESM + CJS</td>
<td align="center">CJS (with ESM wrapper)</td></tr>

<tr><td><strong>TypeScript</strong></td>
<td align="center">6.0 strict</td>
<td align="center">3.x</td></tr>

<tr><td><strong>Parse existing PDFs</strong></td>
<td align="center">Yes (with decryption)</td>
<td align="center">Yes</td></tr>

<tr><td><strong>Text extraction</strong></td>
<td align="center">Yes (with positions)</td>
<td align="center">No</td></tr>

<tr><td><strong>Encryption</strong></td>
<td align="center">AES-256 + RC4</td>
<td align="center">No</td></tr>

<tr><td><strong>Digital signatures</strong></td>
<td align="center">PKCS#7, timestamps</td>
<td align="center">No</td></tr>

<tr><td><strong>Forms</strong></td>
<td align="center">Full (7 field types)</td>
<td align="center">Full</td></tr>

<tr><td><strong>PDF/A compliance</strong></td>
<td align="center">1a/1b through 3a/3b/3u</td>
<td align="center">No</td></tr>

<tr><td><strong>Accessibility (PDF/UA)</strong></td>
<td align="center">Structure tree, checker</td>
<td align="center">No</td></tr>

<tr><td><strong>Merge & split</strong></td>
<td align="center">Built-in</td>
<td align="center">Copy pages only</td></tr>

<tr><td><strong>Annotations</strong></td>
<td align="center">18 types + appearances</td>
<td align="center">No</td></tr>

<tr><td><strong>Streaming output</strong></td>
<td align="center">ReadableStream</td>
<td align="center">No</td></tr>

<tr><td><strong>Layers (OCG)</strong></td>
<td align="center">Yes</td>
<td align="center">No</td></tr>

<tr><td><strong>Outlines</strong></td>
<td align="center">Yes</td>
<td align="center">No</td></tr>

<tr><td><strong>Watermarks</strong></td>
<td align="center">Yes</td>
<td align="center">No</td></tr>

<tr><td><strong>Redaction</strong></td>
<td align="center">Yes</td>
<td align="center">No</td></tr>

<tr><td><strong>Linearization</strong></td>
<td align="center">Yes</td>
<td align="center">No</td></tr>

<tr><td><strong>Image optimization</strong></td>
<td align="center">JPEG recompress, dedup, grayscale</td>
<td align="center">No</td></tr>

<tr><td><strong>WASM acceleration</strong></td>
<td align="center">Optional (compression, PNG, fonts, JBIG2, JPEG)</td>
<td align="center">No</td></tr>

<tr><td><strong>Dependencies</strong></td>
<td align="center">1 (fflate)</td>
<td align="center">0</td></tr>

<tr><td><strong>Maintained</strong></td>
<td align="center">Active</td>
<td align="center">Inactive since 2021</td></tr>

</table>

<br />

## Runtimes

| Runtime | Version | Status |
|:---|:---|:---:|
| **Node.js** | 25.7+ | Fully supported |
| **Deno** | 1.40+ | Fully supported |
| **Bun** | 1.0+ | Fully supported |
| **Cloudflare Workers** | &mdash; | Fully supported |
| **Chrome / Edge** | 109+ | Fully supported |
| **Firefox** | 115+ | Fully supported |
| **Safari** | 16.4+ | Fully supported |

<br />

## API Surface

<details>
<summary><strong>Document</strong> &mdash; create, load, save, metadata</summary>

```ts
import { createPdf, loadPdf, PageSizes } from 'modern-pdf-lib';

// Create from scratch
const doc = createPdf();
doc.setTitle('Invoice #1042');
doc.setLanguage('en');

// Load existing
const existing = await loadPdf(pdfBytes, { password: 'secret' });

// Save
const bytes = await doc.save();
const stream = doc.saveAsStream();
```
</details>

<details>
<summary><strong>Pages</strong> &mdash; draw text, images, shapes, SVG</summary>

```ts
const page = doc.addPage(PageSizes.LETTER);

page.drawText('Hello', { x: 50, y: 700, size: 24 });
page.drawImage(imageRef, { x: 50, y: 400, width: 200, height: 200 });
page.drawRectangle({ x: 50, y: 300, width: 100, height: 50, color: rgb(0, 0.5, 1) });
page.drawCircle({ x: 200, y: 325, radius: 25 });
page.drawSvgPath('M 0 0 L 100 0 L 50 80 Z', { x: 300, y: 300 });
```
</details>

<details>
<summary><strong>Fonts</strong> &mdash; embed, subset, standard 14</summary>

```ts
// Standard fonts (no embedding needed)
const helvetica = doc.embedStandardFont('Helvetica');

// Custom TrueType / OpenType
const fontBytes = await readFile('Inter.ttf');
const inter = await doc.embedFont(fontBytes, { subset: true });

page.drawText('Custom font', { x: 50, y: 500, font: inter, size: 18 });
```
</details>

<details>
<summary><strong>Forms</strong> &mdash; fill, create, flatten</summary>

```ts
const form = doc.getForm();

form.getTextField('name').setText('Jane Doe');
form.getCheckbox('agree').check();
form.getDropdown('country').select('Canada');

form.flatten(); // Burn values into page content
```
</details>

<details>
<summary><strong>Merge & Split</strong></summary>

```ts
import { mergePdfs, splitPdf, copyPages } from 'modern-pdf-lib';

const merged = await mergePdfs([pdf1Bytes, pdf2Bytes]);
const pages = await splitPdf(pdfBytes, [
  { start: 0, end: 4 },   // Pages 1-5
  { start: 5, end: 9 },   // Pages 6-10
]);
```
</details>

<details>
<summary><strong>Encryption</strong> &mdash; AES-256, RC4, permissions</summary>

```ts
const bytes = await doc.save({
  userPassword: 'reader',
  ownerPassword: 'admin',
  permissions: { printing: true, copying: false },
});
```
</details>

<details>
<summary><strong>Digital Signatures</strong></summary>

```ts
import { signPdf, verifySignatures } from 'modern-pdf-lib';

const signed = await signPdf(pdfBytes, 'Signature1', {
  certificate: certDer,
  privateKey: keyDer,
  reason: 'Approved',
  appearance: {                    // optional visible signature
    rect: [50, 50, 200, 80],
    fontSize: 10,
  },
});

const results = await verifySignatures(signed);
```
</details>

<details>
<summary><strong>Text Extraction</strong></summary>

```ts
import { loadPdf, extractTextWithPositions } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const page = doc.getPage(0);
const items = extractTextWithPositions(page.getOperators(), page.getResources());

for (const item of items) {
  console.log(`"${item.text}" at (${item.x}, ${item.y})`);
}
```
</details>

<details>
<summary><strong>Image Optimization</strong> &mdash; batch compress, deduplicate, CLI</summary>

```ts
import { loadPdf, initWasm, optimizeAllImages, deduplicateImages } from 'modern-pdf-lib';

await initWasm({ jpeg: true });

const doc = await loadPdf(pdfBytes);

// Deduplicate identical images
const dedupReport = deduplicateImages(doc);

// Optimize all images (JPEG recompression)
const report = await optimizeAllImages(doc, {
  quality: 75,
  progressive: true,
  autoGrayscale: true,
});

console.log(`${report.optimizedImages}/${report.totalImages} images optimized`);
console.log(`Savings: ${report.savings.toFixed(1)}%`);

const optimized = await doc.save();
```

**CLI:**
```sh
npx modern-pdf optimize report.pdf report-opt.pdf --quality 60 --grayscale --dedup -v
```
</details>

<details>
<summary><strong>PDF/A & Accessibility</strong></summary>

```ts
import { enforcePdfA, checkAccessibility } from 'modern-pdf-lib';

// Enforce PDF/A-2b compliance
const archival = enforcePdfA(pdfBytes, '2b');

// Check accessibility
const issues = checkAccessibility(doc);
for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
}
```
</details>

<br />

## Install

```sh
# npm
npm install modern-pdf-lib

# pnpm
pnpm add modern-pdf-lib

# yarn
yarn add modern-pdf-lib

# bun
bun add modern-pdf-lib

# deno
import { createPdf } from 'npm:modern-pdf-lib';
```

<br />

## WASM Acceleration

All WASM modules are **optional**. Without them, identical output is produced using pure-JS fallbacks.

```ts
import { initWasm } from 'modern-pdf-lib';

await initWasm({
  deflate: true,   // Faster compression
  png: true,       // Faster PNG decoding
  fonts: true,     // Faster font subsetting
  jpeg: true,      // JPEG encode/decode for image optimization
});
```

| Module | Purpose | Speedup |
|:---|:---|:---:|
| libdeflate | Stream compression | ~2x |
| png | PNG image decoding | ~5x |
| ttf | Font parsing & subsetting | ~3x |
| shaping | Complex script layout | ~10x |
| jbig2 | JBIG2 bilevel image decoding | ~3x |
| jpeg | JPEG encode/decode for image optimization | Required |

<br />

## Project Structure

```
modern-pdf-lib/
  src/
    core/           PDF document model, objects, writer, pages
    parser/         PDF loading, text extraction, content streams
    form/           AcroForm fields (7 types) + appearances
    annotation/     18 annotation types + appearance generators
    accessibility/  Structure tree, marked content, PDF/UA checker
    compliance/     PDF/A validation & enforcement
    signature/      PKCS#7 signatures, timestamps, verification
    crypto/         AES-256, RC4, MD5, SHA-256/384/512
    compression/    Deflate (fflate + optional WASM)
    assets/         Font metrics/embed/subset, image embed, SVG
    layers/         Optional content groups (OCG)
    outline/        Bookmarks / document outline
    metadata/       XMP metadata, viewer preferences
    wasm/           Rust crate sources (6 modules)
    cli/            CLI tool (modern-pdf optimize)
  tests/            2,323 tests across 110 suites
  docs/             VitePress documentation
```

<br />

## Contributing

```sh
git clone https://github.com/ABCrimson/modern-pdf-lib.git
cd modern-pdf-lib
npm install
npm test          # 2,323 tests
npm run typecheck # TypeScript 6.0 strict
npm run build     # ESM + CJS + declarations
```

<br />

## License

[MIT](LICENSE) &copy; 2026

</div>
