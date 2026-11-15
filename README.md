<div align="center">

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/modern--pdf--lib-fff?style=for-the-badge&labelColor=000&color=000&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjhsLTYtNloiLz48cG9seWxpbmUgcG9pbnRzPSIxNCAyIDE0IDggMjAgOCIvPjxsaW5lIHgxPSIxNiIgeTE9IjEzIiB4Mj0iOCIgeTI9IjEzIi8+PGxpbmUgeDE9IjE2IiB5MT0iMTciIHgyPSI4IiB5Mj0iMTciLz48bGluZSB4MT0iMTAiIHkxPSI5IiB4Mj0iOCIgeTI9IjkiLz48L3N2Zz4" />
  <img src="https://img.shields.io/badge/modern--pdf--lib-000?style=for-the-badge&labelColor=fff&color=fff&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjhsLTYtNloiLz48cG9seWxpbmUgcG9pbnRzPSIxNCAyIDE0IDggMjAgOCIvPjxsaW5lIHgxPSIxNiIgeTE9IjEzIiB4Mj0iOCIgeTI9IjEzIi8+PGxpbmUgeDE9IjE2IiB5MT0iMTciIHgyPSI4IiB5Mj0iMTciLz48bGluZSB4MT0iMTAiIHkxPSI5IiB4Mj0iOCIgeTI9IjkiLz48L3N2Zz4" alt="modern-pdf-lib" />
</picture>

### The PDF engine for modern JavaScript

Create, parse, fill, merge, sign, and manipulate PDF documents<br />in Node 26.4+ and current browsers (Deno, Bun, and Workers are not tested in CI).

<br />

[![npm version](https://img.shields.io/npm/v/modern-pdf-lib?style=flat-square&color=cb3837)](https://www.npmjs.com/package/modern-pdf-lib)
[![createPdf bundle](https://img.shields.io/badge/createPdf_bundle-101_KiB_gzip-blue?style=flat-square)](#install)
[![tests](https://img.shields.io/badge/tests-8%2C853_passing-brightgreen?style=flat-square)](https://github.com/ABCrimson/modern-pdf-lib/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.1_dev-3178c6?style=flat-square&logo=typescript&logoColor=white)](./tsconfig.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](LICENSE)

<br />

[Get Started](#quick-start) · [Features](#features) · [API](#api-surface) · [Why This?](#why-modern-pdf-lib) · [Docs](https://abcrimson.github.io/modern-pdf-lib/)

<br />

</div>

---

<br />

## Quick Start

```sh
npm install modern-pdf-lib
```

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);
const font = await doc.embedFont(StandardFonts.Helvetica);

page.drawText('Hello from modern-pdf-lib', {
  x: 50,
  y: 750,
  size: 28,
  font,
  color: rgb(0.13, 0.13, 0.13),
});

const bytes = await doc.save();          // Uint8Array
const stream = doc.saveAsStream();       // ReadableStream (not after encrypt())
const blob = await doc.saveAsBlob();     // Blob (browsers)
```

`saveAsStream()` throws `UnsupportedEncryptionError` (code `unsupported-encryption-path`) for a document with `encrypt()` configured; use `save()` for an encrypted document.

### CDN (no install)

Use directly in the browser via CDN — no bundler required:

```html
<script type="module">
  import { createPdf, PageSizes, StandardFonts, rgb } from 'https://cdn.jsdelivr.net/npm/modern-pdf-lib/dist/browser.mjs';

  const doc = createPdf();
  const page = doc.addPage(PageSizes.A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Hello from CDN!', { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
  const bytes = await doc.save();
  console.log('PDF size:', bytes.length, 'bytes');
</script>
```

Also available via:
- **unpkg:** `https://unpkg.com/modern-pdf-lib/dist/browser.mjs`
- **esm.sh:** `https://esm.sh/modern-pdf-lib`

Pin a version in production, for example `modern-pdf-lib@0.40.9`.

### Script Tag (no modules)

For a plain `<script>` tag without `type="module"`, use the IIFE bundle, which exposes a `window.ModernPdf` global (shipped in the package from 0.40.4; same runtime minimums as the [Runtimes](#runtimes) table):

```html
<script src="https://cdn.jsdelivr.net/npm/modern-pdf-lib/dist/modern-pdf-lib.iife.js"></script>
<script>
  const { createPdf, PageSizes, StandardFonts, rgb } = ModernPdf;

  const doc = createPdf();
  const page = doc.addPage(PageSizes.A4);
  doc.embedFont(StandardFonts.Helvetica).then(function (font) {
    page.drawText('Hello from script tag!', { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
    return doc.save();
  }).then(function (bytes) {
    console.log('PDF size:', bytes.length, 'bytes');
  });
</script>
```

<br />

## Features

<!-- capabilities:begin readme-features -->

<table>
<tr>
<td width="50%" valign="top">

**Create & Draw**
- Pages, text, images, shapes, SVG paths
- TrueType & OpenType font embedding
- Automatic font subsetting
- JPEG / PNG image embedding
- Image optimization (JPEG recompression leaves images unchanged: `initWasm({ jpeg: true })` does not initialise the JPEG WASM encoder; dedup works)
- RGB, CMYK, grayscale, spot, DeviceN colors
- Linear & radial gradients, tiling patterns
- Text layout (multiline, combed, auto-size)
- Header/footer engine with templates
- Advanced text layout (Knuth-Plass, hyphenation)

</td>
<td width="50%" valign="top">

**Parse, Render & Modify**
- Load existing PDFs (an encrypted PDF opens with its password and its objects are decrypted, including AES-256 files written by qpdf; saving it needs `encrypt()` first)
- Extract text with positions (text from fonts that use indirect references or compressed ToUnicode maps, most real-world PDFs, is not decoded correctly)
- Render pages to PNG / Canvas (any DPI)
- Thumbnails & visual diff (pixel + SSIM)
- Extract embedded images & fonts
- OCR overlay; redaction marking (applying redactions throws `RedactionIncompleteError`, code `redaction-incomplete`, in this release)
- Fill & flatten AcroForm fields
- Merge, split, copy pages (pages copied, merged or split from a loaded PDF are written without their content; pages created in the same session copy correctly); incremental saves

</td>
</tr>
<tr>
<td width="50%" valign="top">

**Secure & Compliant**
- RC4, AES-128 and AES-256 (R6) encryption on `save()`; AES-256 files open in qpdf and pdf.js (`saveAsStream()`, `objectStreamThreshold` and `saveDocumentIncremental()` throw `UnsupportedEncryptionError`, code `unsupported-encryption-path`, for an encrypted document, and the functions that sign or append an incremental update to PDF bytes throw it for an encrypted file; a document loaded from an encrypted file cannot be written until `encrypt()` is called on it)
- Digital signatures (PKCS#7, visible/invisible; `requestTimestamp` checks the response's hash and nonce against the request, but the token's signature and the TSA certificate are not verified, and `signPdf` does not embed a timestamp: its `timestampUrl` option has no effect)
- OCSP revocation checking (an answer that cannot be authenticated reports `unknown`), CRL lookup (a CRL's signature is not verified), certificate chain validation against `trustedCerts` (with none listed, no chain is valid)
- Incremental save with signature preservation
- Multi-signature chains, MDP certification reading (`setCertificationLevel` has no effect: `signPdf` writes no DocMDP), LTV archival (a signature followed by a later update, such as a second signature or LTV data added with `embedLtvData`, reports `valid: false` with `coversWholeDocument: false`, and `detectModifications` reports a later signature as an `unknown` violation)
- Counter-signatures; field locks are read, not written (`addFieldLock` has no effect: `signPdf` writes no `/Lock` dictionary)
- PDF/A-1b through PDF/A-3u validation, PDF/A-4/4e/4f (output is not validated against veraPDF; `enforcePdfA` and `enforcePdfX` output has an invalid cross-reference offset)
- PDF/X-6, PDF/VT, Factur-X / ZUGFeRD e-invoicing
- Tagged PDF / PDF/UA-1 & PDF/UA-2 accessibility
- Structure tree & marked content
- Redaction marks and `/Redact` annotations (applying them throws `RedactionIncompleteError`, code `redaction-incomplete`, in this release)
- PDF/UA validation & auto-enforcement

</td>
<td width="50%" valign="top">

**Advanced**
- QR codes & barcodes (9 formats; Code 128, QR version 7+, Data Matrix and PDF417 symbols are not readable by standard scanners)
- Table layout engine with pagination
- JSX / VDOM component renderer (`renderJsxToPdf`)
- JSON Schema &rarr; AcroForm generation
- Server adapters (`pdfResponse` for Workers/Deno/Bun/Node)
- JPEG2000 header reading (`parseTileInfo`); decoding throws `UnsupportedFilterError` (code `unsupported-filter`) in this release
- WebP embedding (lossless and alpha; lossy VP8 images throw `UnsupportedFilterError`, code `unsupported-filter`)
- TIFF image embedding (multi-page)
- Image format auto-detection (PNG/JPEG/WebP/TIFF)
- Form field JavaScript is not evaluated (`createSandbox().execute()` throws `ScriptExecutionDisabledError`, code `script-execution-disabled`); scripts in a document run only in a viewer
- Outlines / bookmarks
- Optional content layers (OCGs)
- File attachments & watermarks
- PDF 2.0: associated files (Factur-X), document parts, soft masks
- Linearization (writes a /Linearized dictionary and reorders objects; output is not a conforming linearized file)
- Browser helpers (download, blob, data URL)
- Service Worker & Web Worker support
- Batch processing with memory pressure handling
- Spot colors (Separation) & DeviceN
- CLI: `npx modern-pdf-lib optimize`

</td>
</tr>
</table>

<!-- capabilities:end -->

**Input limits.** Decode paths refuse input above internal limits with `ResourceLimitError` (code `resource-limit-exceeded`, with `limit`, `max` and `actual`). The limits are per stream, per table and per call, they are fixed in this release, and every file of the test corpus uses at most a quarter of each of them; the values, and what a decode at a limit costs, are in the [Performance guide](./docs/guide/performance.md#input-limits). JPEG 2000 (`/JPXDecode`), JBIG2 (`/JBIG2Decode`) and lossy WebP (VP8) data is not decoded: `decodeStream()`, `decodeImageStream()` and the decoders of those formats throw `UnsupportedFilterError`, while `extractImages()` still returns such images with their encoded bytes and a PDF that holds them loads, saves, merges and copies with those streams unchanged. `extractPageImages()` leaves out an image it cannot decode, and rendering draws no images in this release. See the security advisory published with 0.40.8 on the [advisories page](https://github.com/ABCrimson/modern-pdf-lib/security/advisories). A service that handles untrusted files should still run each file under operating-system limits on time and memory.

**Known limits.** A file written by modern-pdf-lib 0.40.6 or earlier holds raw DEFLATE data under `/FlateDecode`. It loads, and `save()` writes those streams back as zlib data, but `saveDocumentIncremental()`, `saveIncremental()` and `signPdf()` keep the file's existing bytes and `linearizePdf()` and `enforcePdfA()` copy its objects as they are, so load such a file and `save()` it before you pass it to them. A document loaded from an encrypted file is decrypted, and it can be written only after `encrypt()` is called on it. Strings with bytes above 0x7F are rewritten on save (planned for 0.41.0), which also applies to a decrypted document that is re-encrypted and saved; incremental and streamed encrypted saves are planned for 0.41.2. AES-256 files written by modern-pdf-lib 0.26.0 to 0.40.8 open with their passwords and emit one `MPL_LEGACY_R6_KEY` warning per process; AES-256 files written from 0.40.9 on cannot be opened by 0.40.3 to 0.40.8. The open findings that are safe to publish, with the release planned to close each one, are listed in [`audit/open-highs.json`](./audit/open-highs.json).

<br />

## Why modern-pdf-lib?

<!-- capabilities:begin readme-comparison -->

<table>
<tr>
<th></th>
<th align="center"><strong>modern-pdf-lib</strong></th>
<th align="center">pdf-lib</th>
</tr>

<tr><td><strong>Runtime</strong></td>
<td align="center">Node 26.4+, current browsers (Deno, Bun, Workers not tested in CI)</td>
<td align="center">Node, browsers, Deno, React Native</td></tr>

<tr><td><strong>Module format</strong></td>
<td align="center">ESM + CJS</td>
<td align="center">CJS + ES module builds</td></tr>

<tr><td><strong>TypeScript</strong></td>
<td align="center">7.1 dev build, strict</td>
<td align="center">3.x</td></tr>

<tr><td><strong>Parse existing PDFs</strong></td>
<td align="center">Yes (an encrypted file opens with its password and its objects are decrypted; saving it needs <code>encrypt()</code> first)</td>
<td align="center">Yes</td></tr>

<tr><td><strong>Text extraction</strong></td>
<td align="center">Yes (with positions; indirect-reference fonts and compressed ToUnicode maps are not decoded)</td>
<td align="center">No</td></tr>

<tr><td><strong>Encryption</strong></td>
<td align="center">RC4 + AES-128 + AES-256 on <code>save()</code>; AES-256 output opens in qpdf and pdf.js (streaming, object streams and incremental saves throw <code>UnsupportedEncryptionError</code>, code <code>unsupported-encryption-path</code>, for an encrypted document, and so does signing an encrypted file)</td>
<td align="center">No</td></tr>

<tr><td><strong>Digital signatures</strong></td>
<td align="center">PKCS#7, CRL/OCSP, LTV, MDP reading; <code>signPdf</code> embeds no timestamp and writes no DocMDP or field lock (chain trust needs <code>trustedCerts</code>; timestamp signatures and CRLs are not authenticated)</td>
<td align="center">No</td></tr>

<tr><td><strong>Incremental save</strong></td>
<td align="center">Signature-preserving, multi-sig chains (not for an encrypted file)</td>
<td align="center">No</td></tr>

<tr><td><strong>WebP images</strong></td>
<td align="center">Lossless, alpha (lossy throws <code>UnsupportedFilterError</code>)</td>
<td align="center">No</td></tr>

<tr><td><strong>TIFF images</strong></td>
<td align="center">Multi-page</td>
<td align="center">No</td></tr>

<tr><td><strong>JPEG2000 decoding</strong></td>
<td align="center">JPXDecode (JP2 + J2K) is recognised; decoding throws <code>UnsupportedFilterError</code> in this release</td>
<td align="center">No</td></tr>

<tr><td><strong>Form JavaScript</strong></td>
<td align="center">Not evaluated (<code>execute()</code> throws <code>ScriptExecutionDisabledError</code>, code <code>script-execution-disabled</code>)</td>
<td align="center">No</td></tr>

<tr><td><strong>Forms</strong></td>
<td align="center">Full (7 field types)</td>
<td align="center">Full</td></tr>

<tr><td><strong>PDF/A compliance</strong></td>
<td align="center">1a/1b through 3a/3b/3u + 4/4e/4f (writer, not validated)</td>
<td align="center">No</td></tr>

<tr><td><strong>JSX / VDOM rendering</strong></td>
<td align="center">JSX runtime + component renderer</td>
<td align="center">No</td></tr>

<tr><td><strong>Accessibility (PDF/UA)</strong></td>
<td align="center">Structure tree, checker</td>
<td align="center">No</td></tr>

<tr><td><strong>Merge & split</strong></td>
<td align="center">Built-in (pages from loaded PDFs are written without their content)</td>
<td align="center">Copy pages only</td></tr>

<tr><td><strong>Annotations</strong></td>
<td align="center">18 types + appearances</td>
<td align="center">No</td></tr>

<tr><td><strong>Streaming output</strong></td>
<td align="center">ReadableStream (not for encrypted documents)</td>
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
<td align="center">Marking only</td>
<td align="center">No</td></tr>

<tr><td><strong>Linearization</strong></td>
<td align="center">Partial</td>
<td align="center">No</td></tr>

<tr><td><strong>QR codes & barcodes</strong></td>
<td align="center">9 formats (QR, EAN, Code 128, PDF417…); Code 128, QR 7+, Data Matrix and PDF417 are not scanner-readable</td>
<td align="center">No</td></tr>

<tr><td><strong>Spot / DeviceN colors</strong></td>
<td align="center">Separation, multi-ink, conversion</td>
<td align="center">No</td></tr>

<tr><td><strong>Header / footer engine</strong></td>
<td align="center">Templates, page numbers, dates</td>
<td align="center">No</td></tr>

<tr><td><strong>Table layout</strong></td>
<td align="center">Spanning, pagination, presets, overflow</td>
<td align="center">No</td></tr>

<tr><td><strong>Browser utilities</strong></td>
<td align="center">Download, blob, Web Worker, Service Worker</td>
<td align="center">No</td></tr>

<tr><td><strong>Image optimization</strong></td>
<td align="center">Dedup; JPEG recompression leaves images unchanged (`initWasm({ jpeg: true })` does not initialise the JPEG WASM encoder)</td>
<td align="center">No</td></tr>

<tr><td><strong>WASM modules</strong></td>
<td align="center">Not run (modules ship in dist/wasm/)</td>
<td align="center">No</td></tr>

<tr><td><strong>Dependencies</strong></td>
<td align="center">1 (fflate)</td>
<td align="center">4 (pako, tslib, @pdf-lib/standard-fonts, @pdf-lib/upng)</td></tr>

<!-- capabilities:end -->

<tr><td><strong>Maintained</strong></td>
<td align="center">Active</td>
<td align="center">Inactive since 2021</td></tr>

</table>

<br />

## Runtimes

<!-- capabilities:begin readme-runtimes -->

| Runtime | Version | Status |
|:---|:---|:---:|
| **Node.js** | 26.4+ | Tested in CI (Node 26) |
| **Deno** | 2.5+ | Not tested in CI |
| **Bun** | 1.1.31+ | Not tested in CI |
| **Cloudflare Workers** | current workerd (V8 14.0+) | Not tested in CI |
| **Chrome / Edge** | 140+ | Chromium tested in CI (Playwright); Edge not tested |
| **Firefox** | 133+ | Tested in CI (Playwright) |
| **Safari** | 18.4+ | WebKit tested in CI (Playwright); Safari not tested |

<!-- capabilities:end -->

The browser, Deno and Bun minimums are the first versions with both the Uint8Array base64/hex methods (`Uint8Array.prototype.toBase64`/`toHex`, `Uint8Array.fromBase64`/`fromHex`) and the iterator helpers (`Iterator.from`, `.map`, `.toArray`), which the library calls without a guard (MDN browser-compat-data, read 2026-11-15). The Node minimum is the `engines` range in package.json.

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
const stream = doc.saveAsStream(); // throws UnsupportedEncryptionError (code 'unsupported-encryption-path') after doc.encrypt()
```
</details>

<details>
<summary><strong>Pages</strong> &mdash; draw text, images, shapes, SVG</summary>

```ts
const page = doc.addPage(PageSizes.Letter);
const font = await doc.embedFont(StandardFonts.Helvetica);

page.drawText('Hello', { x: 50, y: 700, size: 24, font });
const imageRef = await doc.embedPng(pngBytes);
page.drawImage(imageRef, { x: 50, y: 400, width: 200, height: 200 });
page.drawRectangle({ x: 50, y: 300, width: 100, height: 50, color: rgb(0, 0.5, 1) });
page.drawCircle({ x: 200, y: 325, radius: 25 });
page.drawSvgPath('M 0 0 L 100 0 L 50 80 Z', { x: 300, y: 300 });
```
</details>

<details>
<summary><strong>Fonts</strong> &mdash; embed, subset, standard 14</summary>

```ts
// Standard fonts (no glyph data embedded — just a font dictionary)
const helvetica = await doc.embedFont(StandardFonts.Helvetica);

// Custom TrueType / OpenType (readFile from 'node:fs/promises')
const fontBytes = await readFile('Inter.ttf');
const inter = await doc.embedFont(fontBytes);

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
import { loadPdf, mergePdfs, splitPdf } from 'modern-pdf-lib';

// mergePdfs / splitPdf operate on PdfDocument objects — load the bytes first.
const merged = await mergePdfs([await loadPdf(pdf1Bytes), await loadPdf(pdf2Bytes)]);
const pages = await splitPdf(await loadPdf(pdfBytes), [
  [0, 4],   // Pages 1-5 (zero-based, inclusive)
  [5, 9],   // Pages 6-10
]);
```

Pages copied, merged or split from a loaded PDF are written without their content; pages created in the same session copy correctly.
</details>

<details>
<summary><strong>Encryption</strong> &mdash; RC4, AES-128, AES-256, permissions</summary>

```ts
// Configure encryption with doc.encrypt(), then save().
await doc.encrypt({
  userPassword: 'reader',
  ownerPassword: 'admin',
  permissions: { printing: true, copying: false },
});
const bytes = await doc.save();
```

For an encrypted document, `saveAsStream()` throws and a save with `objectStreamThreshold` or `saveDocumentIncremental()` rejects with `UnsupportedEncryptionError` (code `unsupported-encryption-path`). The functions that append an incremental update to PDF bytes (`signPdf`, `prepareForSigning`, `addCounterSignature`, `embedLtvData`, `saveIncremental`, `saveIncrementalWithSignaturePreservation`, `optimizeIncrementalSave` and `appendIncrementalUpdate`) throw the same error for an encrypted file, because they would append unencrypted objects to an encrypted file. `linearizePdf` throws it for an encrypted file too, and `delinearizePdf` does for a linearized file that has `/Encrypt`: their output would have no `/Encrypt` entry. `flattenTransparency`, `stripProhibitedFeatures`, `enforcePdfA`, `enforcePdfAFull` and `enforcePdfX` throw it for an encrypted file too. For the sixteen functions named here that take PDF bytes (all of them except `saveAsStream()`), a file counts as encrypted when its bytes contain the name `/Encrypt` anywhere, whatever follows it; a name written with `#` escapes, such as `/Encr#79pt`, counts, and `/EncryptMetadata` and `/Encrypt2` do not, except in `enforcePdfA`, `enforcePdfAFull` and `enforcePdfX`, which also refuse any file whose text contains `/Encrypt`, so `/EncryptMetadata` and `/Encrypt2` as well. An unencrypted file that holds the name `/Encrypt` anywhere outside a compressed stream, for example inside an uncompressed content stream or as text that looks like a name, is refused as well. A document loaded from an encrypted file has its objects decrypted and reports `isEncrypted()` as `false`; `save()`, `saveAsStream()`, `saveAsBlob()`, `saveAsBase64()` and the other writers throw `UnsupportedEncryptionError` until `encrypt()` is called on it, and then `save()` writes it encrypted with the new parameters. The [security guide](./docs/guide/security.md#loading-and-saving-encrypted-documents) has the rules, a sample and the compatibility table.
</details>

<details>
<summary><strong>Digital Signatures</strong></summary>

```ts
import { signPdf, verifySignatures, validateCertificateChain } from 'modern-pdf-lib';

const signed = await signPdf(pdfBytes, 'Signature1', {
  certificate: certDer,
  privateKey: keyDer,
  reason: 'Approved',
  appearance: {                    // optional visible signature
    rect: [50, 50, 200, 80],
    fontSize: 10,
  },
});

// valid = digest + signature + the ByteRange covers the whole file (coversWholeDocument).
// It does not say the signer is trusted.
const results = await verifySignatures(signed);

// Trust: validate the signer's chain (leaf first) against the roots you trust.
// Without trustedCerts no chain is valid.
const trust = await validateCertificateChain([certDer, rootDer], { trustedCerts: [rootDer] });
console.log(results[0]?.valid, trust.valid);
```

A signature followed by a later incremental update (a second signature, or LTV data added with `embedLtvData`) reports `valid: false` with `coversWholeDocument: false`; its `integrityValid` and `certificateValid` still report the digest and signature checks.

`signPdf`, `addCounterSignature` and `embedLtvData` do not encrypt what they append: for an encrypted PDF they throw `UnsupportedEncryptionError` (code `unsupported-encryption-path`).
</details>

<details>
<summary><strong>Text Extraction</strong></summary>

```ts
import { loadPdf, parseContentStream, extractTextWithPositions } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const page = doc.getPage(0);
const operators = parseContentStream(page.getContentStream());
const items = extractTextWithPositions(operators);

for (const item of items) {
  console.log(`"${item.text}" at (${item.x}, ${item.y})`);
}
```

Text from fonts that use indirect references or compressed ToUnicode maps (most real-world PDFs) is not decoded correctly.
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

In this release `initWasm({ jpeg: true })` does not initialise the JPEG WASM encoder, and `optimizeAllImages` and `modern-pdf optimize` leave JPEG images unchanged (`deduplicateImages` still works).

**CLI:**
```sh
npx modern-pdf-lib optimize report.pdf report-opt.pdf --quality 60 --grayscale --dedup -v
```
</details>

<details>
<summary><strong>Tables</strong> &mdash; layout engine with spanning, pagination, presets</summary>

```ts
import { createPdf, PageSizes, professionalPreset, applyPreset } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

page.drawTable(applyPreset(professionalPreset(), {
  x: 50,
  y: 750,
  width: 495,
  headerRows: 1,
  rows: [
    { cells: ['Product', 'Qty', 'Price', 'Total'] },
    { cells: ['Widget A', '10', '$5.00', '$50.00'] },
    { cells: ['Widget B', '25', '$3.50', '$87.50'] },
    { cells: [{ content: 'Grand Total', colSpan: 3, align: 'right' }, '$137.50'] },
  ],
  columns: [{ flex: 2 }, { width: 60 }, { width: 80 }, { width: 80, align: 'right' }],
}));
```
</details>

<details>
<summary><strong>QR Codes & Barcodes</strong> &mdash; 9 formats</summary>

```ts
import { createPdf, PageSizes } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

// QR code: moduleSize is the width of one square in points, so the printed
// width is (modules + 2 * quietZone) * moduleSize; for this URL (25 modules,
// default quiet zone of 4) a moduleSize of 3.6 gives about 119 pt.
page.drawQrCode('https://example.com', { x: 50, y: 700, moduleSize: 3.6 });

// Barcodes (Code 128, EAN-13, UPC-A, Code 39, ITF, PDF417, Data Matrix)
import { encodeCode128, encodeEan13, renderStyledBarcode } from 'modern-pdf-lib';

const barcode = encodeCode128('ABC-12345');
const ops = renderStyledBarcode(barcode, 50, 500, 'ABC-12345', { height: 60 });
```

Code 128, QR version 7+, Data Matrix and PDF417 symbols are not readable by standard scanners.
</details>

<details>
<summary><strong>PDF/A & Accessibility</strong></summary>

```ts
import { enforcePdfA, loadPdf, checkAccessibility } from 'modern-pdf-lib';

// Enforce PDF/A-2b compliance
const archival = await enforcePdfA(pdfBytes, '2b');
const doc = await loadPdf(archival);

// Check accessibility
const issues = checkAccessibility(doc);
for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
}
```

`enforcePdfA` output is not validated against veraPDF, and `enforcePdfA` and `enforcePdfX` output has an invalid cross-reference offset.
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
deno add npm:modern-pdf-lib
```

<br />

## WASM Modules

The package ships WebAssembly builds of six Rust crates under `dist/wasm/` (libdeflate, png, ttf, shaping, jbig2, jpeg; exported as `modern-pdf-lib/wasm/*`), but this release's JavaScript does not run them; all work runs in pure JavaScript (fflate for Flate).

`initWasm()` with no argument returns at once. `initWasm({ deflate: true })` rejects, `png` and `jpeg` resolve without enabling a module, `fonts` does nothing, and ttf, shaping and jbig2 have no option. JPEG recompression (`optimizeAllImages`, `modern-pdf optimize`) needs the JPEG encoder, so it leaves JPEG images unchanged.

<br />

## Project Structure

```
modern-pdf-lib/
  src/
    core/           PDF document model, objects, writer, pages
    parser/         PDF loading, text extraction, content streams
    render/         Content-stream interpreter, rasterizer, Canvas, thumbnails, OCR, redactRegions (throws RedactionIncompleteError, code redaction-incomplete)
    form/           AcroForm fields (7 types), appearances, JSON Schema forms
    annotation/     18 annotation types + appearance generators
    accessibility/  Structure tree, marked content, PDF/UA-1 & UA-2 checkers, auto-tagging
    compliance/     PDF/A & PDF/X validation, PDF/A-4, Factur-X / e-invoicing
    signature/      PKCS#7 signatures, timestamps, verification, CRL/OCSP, LTV
    security/       Threat scanner, sanitizer, redaction verifier, encryption inspector
    crypto/         AES, RC4, MD5, SHA-256/384/512
    codecs/         Stream filters, Deflate (fflate; WASM bridge not loaded), CCITT, JPEG 2000 and JBIG2 entry modules
    assets/         Font metrics/embed/subset, image embed, SVG
    text/           BiDi (UAX #9) text ordering
    color/          Color conversion & ICC transforms
    barcode/        QR, Code 128, EAN, UPC, Code 39, ITF, PDF417, Data Matrix
    layout/         Tables, headers/footers, Knuth-Plass text layout, hyphenation
    jsx/            JSX runtime + renderJsxToPdf component renderer
    browser/        Download helpers, Service Worker, Web Worker
    runtime/        Server adapters, capability detection, memory budget
    batch/          Batch processing with memory pressure handling
    layers/         Optional content groups (OCG)
    outline/        Bookmarks / document outline
    metadata/       XMP metadata, viewer preferences
    plugins/        Plugin manager & hooks
    internal/       Resource limits and runtime warnings shared by every domain
    wasm/           WASM loader and the TypeScript side of the crates
    cli/            CLI tool (modern-pdf optimize)
  crates/           Rust crates built to WebAssembly (6 crates, one Cargo root each)
  tests/            8,902 tests in 373 files (projects unit, integration, oracle, adversarial)
  audit/            open-highs.json: the public ledger of open audit findings
  docs/             VitePress documentation
```

<br />

## Contributing

```sh
git clone https://github.com/ABCrimson/modern-pdf-lib.git
cd modern-pdf-lib
pnpm install
pnpm test          # 373 files, 8,902 tests: with qpdf 8,853 pass, 49 expected failures; without qpdf 8,484 pass, 11 expected failures, 407 skip
pnpm run typecheck # TypeScript 7.1 dev build: src, cli, scripts, tests, security-tests
pnpm run build     # ESM + CJS + declarations + IIFE
```

<br />

## License

[MIT](LICENSE) &copy; 2026 Albert Badalov
