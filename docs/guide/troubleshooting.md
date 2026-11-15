# Troubleshooting

This guide covers the most common issues encountered when working with `modern-pdf-lib`, along with explanations and working fixes for each.

Find your symptom, jump to the fix:

| Symptom | Section |
|---|---|
| `EncryptedPdfError` on `loadPdf()` | [1. EncryptedPdfError](#_1-encryptedpdferror) |
| The PDF opens but the text is invisible | [2. Text Doesn't Render](#_2-text-doesn-t-render-missing-font) |
| Content lands upside down or off the page | [3. Coordinate Confusion](#_3-coordinate-confusion) |
| WASM fails to load or initialize | [4. WASM Initialization Errors](#_4-wasm-initialization-errors) |
| Out-of-memory on a large document | [5. Large PDF Memory Issues](#_5-large-pdf-memory-issues) |
| Works in Node, breaks in Deno / Workers / the browser | [6. Cross-Runtime Quirks](#_6-cross-runtime-quirks) |
| Extracted text is mojibake | [7. Text Extraction Garbage](#_7-text-extraction-garbage) |
| `Form field "x" not found.` when filling a form | [8. Form Field Not Found](#_8-form-field-not-found) |
| A real-world PDF fails to parse | [9. Common Parsing Failures](#_9-common-parsing-failures) |
| `ResourceLimitError` or `UnsupportedFilterError` is thrown | [10. ResourceLimitError and UnsupportedFilterError](#_10-resourcelimiterror-and-unsupportedfiltererror) |
| `UnsupportedEncryptionError` on `save()` of a loaded encrypted document | [11. UnsupportedEncryptionError when saving a loaded document](#_11-unsupportedencryptionerror-when-saving-a-loaded-document) |
| `ModernPdfLibWarning` in the console (`MPL_LEGACY_R6_KEY`, `MPL_IGNORED_OPTION`) | [12. ModernPdfLibWarning](#_12-modernpdflibwarning-mpl-legacy-r6-key-and-mpl-ignored-option) |
| `throwOnInvalidObject: true` throws on a file that loads otherwise | [13. Strict mode throws on a recovered stream](#_13-strict-mode-throws-on-a-recovered-stream) |

## 1. EncryptedPdfError

### What happens

You call `loadPdf()` on a PDF file and get an error:

```
EncryptedPdfError: The PDF is encrypted. Please provide a password.
```

### Why it happens

The PDF was saved with encryption (password protection). The parser detects the `/Encrypt` dictionary in the trailer and refuses to proceed without credentials.

### How to fix it

Pass the `password` option when loading:

```ts
import { loadPdf } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const bytes = new Uint8Array(await readFile('protected.pdf'));

const doc = await loadPdf(bytes, { password: 'secret123' });

const pages = doc.getPages();
console.log(`Loaded ${pages.length} pages from encrypted PDF`);
```

> [!TIP]
> If you only know the owner password (not the user password), pass it in the same `password` field. The parser tries both owner and user password verification automatically. A wrong password throws a `PdfParseError` ("Failed to decrypt PDF: the provided password is incorrect").

The loaded document holds decrypted objects. To write it, call `encrypt()` on it first (see [11. UnsupportedEncryptionError when saving a loaded document](#_11-unsupportedencryptionerror-when-saving-a-loaded-document)).

If you want to load the document structure without decrypting streams (for inspection only), use the `ignoreEncryption` option; such a document keeps its streams as stored when it is written:

```ts
const doc = await loadPdf(bytes, { ignoreEncryption: true });
```

## 2. Text Doesn't Render (Missing Font)

### What happens

`drawText()` and `save()` both succeed, but the text is invisible in the viewer — or the viewer reports an error such as "Cannot find font resource".

### Why it happens

`drawText()` needs a font that is actually registered on the document. If you skip the `font` option (and no font has been embedded), the content stream references a default font resource name (`F1`) that does not exist in the page's `/Font` resources — the PDF saves without error but is invalid, and viewers cannot render the text. The same happens if you pass a `StandardFonts` name string directly as `font:` — that string is treated as a raw resource name, not as a font to load.

### How to fix it

Always draw with a `FontRef` returned by `embedFont()`. Standard fonts and custom fonts both go through it:

**Option A — Standard font (no glyph data embedded, smallest output):**

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

const helvetica = await doc.embedFont(StandardFonts.Helvetica);

page.drawText('Hello with Helvetica', {
  x: 50,
  y: 700,
  size: 16,
  font: helvetica,
  color: rgb(0, 0, 0),
});

const bytes = await doc.save();
```

**Option B — Embedded custom font:**

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

const fontBytes = new Uint8Array(await readFile('fonts/Inter-Regular.ttf'));
const inter = await doc.embedFont(fontBytes);

page.drawText('Hello with Inter', {
  x: 50,
  y: 700,
  size: 16,
  font: inter,
  color: rgb(0, 0, 0),
});

const bytes = await doc.save();
```

> [!WARNING]
> Standard fonts only support the WinAnsi (Latin-1) character set. If your text contains characters outside this set (CJK, Arabic, Cyrillic, emoji, etc.), you **must** embed a custom TrueType or OpenType font that contains those glyphs. See the [Fonts guide](./fonts.md) for details.

## 3. Coordinate Confusion

### What happens

Text or shapes appear in unexpected positions — upside down, at the bottom instead of the top, or off the page entirely.

### Why it happens

PDF uses a **bottom-left origin** coordinate system. The point `(0, 0)` is at the bottom-left corner of the page, with `x` increasing to the right and `y` increasing upward. This is opposite to most screen coordinate systems (HTML Canvas, DOM), where `(0, 0)` is at the **top-left** and `y` increases downward.

### How to fix it

Use this formula to convert from a top-left mental model to PDF coordinates:

```
pdfY = pageHeight - topDownY
```

Here is a complete example placing text at what you would think of as "50 pixels from the top":

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);
const helvetica = await doc.embedFont(StandardFonts.Helvetica);

const pageWidth = page.getWidth();   // 595.28 for A4
const pageHeight = page.getHeight(); // 841.89 for A4

// Place text 50 points from the top, 50 points from the left
const topMargin = 50;
const leftMargin = 50;

page.drawText('This is near the top of the page', {
  x: leftMargin,
  y: pageHeight - topMargin,
  size: 16,
  font: helvetica,
  color: rgb(0, 0, 0),
});

// Place text 50 points from the bottom
page.drawText('This is near the bottom of the page', {
  x: leftMargin,
  y: topMargin,
  size: 16,
  font: helvetica,
  color: rgb(0, 0, 0),
});

const bytes = await doc.save();
```

> [!NOTE]
> PDF coordinates are measured in **points** (1 point = 1/72 inch). An A4 page is 595.28 x 841.89 points. A US Letter page is 612 x 792 points.

## 4. WASM Initialization Errors

### What happens

`initWasm({ deflate: true })` rejects with an error such as `Failed to initialize libdeflate WASM`.

### Why it happens

The package ships WebAssembly builds of six Rust crates under `dist/wasm/`, but this release's JavaScript does not run them; all work runs in pure JavaScript. `initWasm()` without an argument returns at once, the `png`, `fonts` and `jpeg` options resolve without enabling anything, and `deflate` rejects. Passing bytes (`deflateWasm`) does not change this.

### How to fix it

Remove the `initWasm()` call. Compression (fflate), image decoding, font subsetting and the other work run in JavaScript, so no `.wasm` file is needed in any runtime. `save({ useWasm: true })` is accepted, and fflate still produces the output.

## 5. Large PDF Memory Issues

### What happens

Calling `doc.save()` on a document with hundreds of pages or many large images causes the process to run out of memory (OOM), or the browser tab crashes. If the memory runs out while loading or decoding a file you did not write, see [10. ResourceLimitError and UnsupportedFilterError](#_10-resourcelimiterror-and-unsupportedfiltererror).

### Why it happens

`save()` serializes the entire PDF into a single `Uint8Array` in memory. For very large documents (hundreds of MB), this can exceed available heap space.

### How to fix it

Use `saveAsStream()` to serialize the PDF as a `ReadableStream<Uint8Array>`, which emits chunks incrementally without building the entire file in one buffer:

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';
import { createWriteStream } from 'node:fs';
import { Writable } from 'node:stream';

const doc = createPdf();
const helvetica = await doc.embedFont(StandardFonts.Helvetica);

// Add many pages
for (let i = 0; i < 500; i++) {
  const page = doc.addPage(PageSizes.A4);
  page.drawText(`Page ${i + 1}`, {
    x: 50,
    y: 750,
    size: 24,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
}

// Stream to disk instead of buffering the entire PDF in memory
const stream = doc.saveAsStream();
await stream.pipeTo(Writable.toWeb(createWriteStream('large-output.pdf')));

console.log('Large PDF written to disk via streaming');
```

`saveAsStream()` does not encrypt. For a document with `encrypt()` configured it throws `UnsupportedEncryptionError` (code `unsupported-encryption-path`); use `save()` instead. An encrypted document cannot use this fix in this release.

> [!TIP]
> In edge/serverless environments, you can return the `ReadableStream` directly as the HTTP response body, avoiding any in-memory buffering.

## 6. Cross-Runtime Quirks

### What happens

Code that works in Node.js fails or behaves differently in Deno, Bun, or Cloudflare Workers.

### Why it happens

Each runtime has its own security model, file system access rules, and module system constraints.

### How to fix it

Runtime support (Node.js `engines` `>=26.4`; the other minimums are from MDN browser-compat-data, read 2026-11-15, for the `Uint8Array` base64 and hex methods and the iterator helpers the library calls without a guard):

<!-- capabilities:begin guide-troubleshooting-runtimes -->

| Runtime | Minimum | Tested in CI |
|---|---|---|
| Node.js | 26.4 (`engines`); `Uint8Array` base64 from 25.0.0 | Yes (Node 26 gates; Node 24 and the `devEngines` Node 28 nightly are non-gating probes) |
| Deno | 2.5.0 | No |
| Bun | 1.1.31 | No |
| Cloudflare Workers | none stated | No |
| Browsers | Chrome 140, Firefox 133, Safari 18.4 (see the [Browser guide](./browser.md#browser-compatibility)) | Playwright E2E on Chromium, Firefox and WebKit |

<!-- capabilities:end -->

**Deno** requires explicit permissions:

```bash
# File system access for reading fonts/PDFs
deno run --allow-read main.ts

# Network access for fetching remote PDFs
deno run --allow-read --allow-net main.ts

# Or allow everything (development only)
deno run -A main.ts
```

```ts
// Deno — reading a file
const fontBytes = await Deno.readFile('fonts/Inter-Regular.ttf');
const font = await doc.embedFont(fontBytes);
```

**Cloudflare Workers** have no filesystem and a 128 MB memory limit:

```ts
// Cloudflare Workers — no fs module, fetch everything
export default {
  async fetch(request: Request): Promise<Response> {
    const { createPdf, PageSizes, StandardFonts, rgb } = await import('modern-pdf-lib');

    const doc = createPdf();
    const page = doc.addPage(PageSizes.A4);
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Generated on the edge', {
      x: 50,
      y: 700,
      size: 20,
      font: helvetica,
      color: rgb(0, 0, 0),
    });

    // Stream the response to stay within memory limits
    const stream = doc.saveAsStream();
    return new Response(stream, {
      headers: { 'Content-Type': 'application/pdf' },
    });
  },
};
```

> [!WARNING]
> Cloudflare Workers have a 128 MB memory limit. For large PDFs, use `saveAsStream()` instead of `save()` for an unencrypted document. This release's JavaScript does not load WebAssembly, so no `.wasm` file needs to be bundled for Workers.

**Bun** works out of the box with no special configuration:

```ts
// Bun — works just like Node.js
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);
const helvetica = await doc.embedFont(StandardFonts.Helvetica);
page.drawText('Hello from Bun', {
  x: 50,
  y: 700,
  size: 20,
  font: helvetica,
  color: rgb(0, 0, 0),
});

const bytes = await doc.save();
await Bun.write('output.pdf', bytes);
```

## 7. Text Extraction Garbage

### What happens

`extractText()` or `extractTextWithPositions()` returns garbled characters, empty strings, or seemingly random sequences instead of the expected text.

### Why it happens

There are three common causes:

1. **The PDF is encrypted and no password was provided.** Encrypted streams yield raw cipher bytes, which cannot be decoded into meaningful text.
2. **The font has no ToUnicode CMap.** Many PDFs use custom encodings (especially with subsetted fonts). Without a `/ToUnicode` mapping, the library cannot translate glyph IDs to Unicode characters.
3. **The PDF is image-only (scanned document).** The pages contain raster images of text, not actual text operators. There is no text to extract.

### How to fix it

**For encrypted PDFs:** provide the password when loading.

```ts
import { loadPdf, extractTextWithPositions, parseContentStream } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const bytes = new Uint8Array(await readFile('encrypted-doc.pdf'));
const doc = await loadPdf(bytes, { password: 'mypassword' });

const page = doc.getPage(0);
const operators = parseContentStream(page.getContentStream());
const items = extractTextWithPositions(operators, page.getOriginalResources());
const text = items.map((item) => item.text).join(' ');
console.log(text);
```

**For missing ToUnicode CMaps:** there is no automatic fix. The text may partially decode using the font's built-in encoding, but unmapped glyphs will appear as replacement characters. This is a limitation of the source PDF, not the library.

**For scanned (image-only) PDFs:** text extraction is not possible. You need an OCR engine (such as Tesseract) to convert the images to text before processing.

> [!NOTE]
> You can detect whether a page contains actual text operators by checking the parsed content stream for `BT`/`ET` (begin/end text) operators. If a page has no text operators, it is likely image-only.

## 8. Form Field Not Found

### What happens

You call `form.getTextField('fieldName')` and get:

```
Error: Form field "fieldName" not found.
```

### Why it happens

The field name you specified does not match any field in the PDF's AcroForm. This commonly occurs because:

- The field has a different name than expected (field names are case-sensitive).
- The field uses a fully-qualified name with dot-separated parts (e.g., `form1.section2.name`).
- The PDF has no form fields at all.

### How to fix it

Discover the actual field names by listing all fields:

```ts
import { loadPdf } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const bytes = new Uint8Array(await readFile('form.pdf'));
const doc = await loadPdf(bytes);
const form = doc.getForm();

// List all fields with their names and types
const fields = form.getFields();
for (const field of fields) {
  console.log(`Name: "${field.getName()}"  Type: ${field.constructor.name}`);
}

// Now use the correct name
const nameField = form.getTextField('applicant.firstName');
nameField.setText('Jane');

const savedBytes = await doc.save();
```

> [!TIP]
> Field names in PDF forms are case-sensitive and often hierarchical. A field displayed as "First Name" in a viewer might have the internal name `form1.applicant.firstName`. Always enumerate fields first to find the exact names.

## 9. Common Parsing Failures

### What happens

`loadPdf()` throws an error during parsing, such as:

- `Error: Invalid xref table`
- `Error: Expected 'obj' keyword`
- `Error: Unterminated string`

### Why it happens

The PDF file is malformed. Common causes include:

- Truncated downloads (incomplete file).
- PDFs generated by buggy software with broken cross-reference tables.
- Corrupted files with invalid object boundaries or missing stream terminators.

### How to fix it

Use the `throwOnInvalidObject` and `capNumbers` load options to control how strictly the parser handles errors:

```ts
import { loadPdf } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const bytes = new Uint8Array(await readFile('possibly-broken.pdf'));

// Lenient parsing — skip broken objects, clamp extreme numbers
const doc = await loadPdf(bytes, {
  throwOnInvalidObject: false,  // default: skip malformed objects silently
  capNumbers: true,             // clamp extreme floats to safe range
});

console.log(`Loaded ${doc.getPages().length} pages (some objects may have been skipped)`);
```

If you want to **detect** that a PDF is malformed (for validation), enable strict mode:

```ts
import { loadPdf } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const bytes = new Uint8Array(await readFile('suspect.pdf'));

try {
  const doc = await loadPdf(bytes, {
    throwOnInvalidObject: true,
  });
  console.log('PDF is well-formed');
} catch (err) {
  console.error('PDF is malformed:', (err as Error).message);
}
```

> [!NOTE]
> The default behavior (`throwOnInvalidObject: false`) silently skips unparseable objects. This is usually what you want for production code, since many real-world PDFs contain minor structural errors that do not affect the visible content. Enable `throwOnInvalidObject: true` only when you need strict validation. Strict mode also throws on a stream whose `/Length` had to be recovered (see [13. Strict mode throws on a recovered stream](#_13-strict-mode-throws-on-a-recovered-stream)). A `ResourceLimitError` is never skipped, in either mode: `loadPdf()` throws it (see [10. ResourceLimitError and UnsupportedFilterError](#_10-resourcelimiterror-and-unsupportedfiltererror)).


## 10. ResourceLimitError and UnsupportedFilterError

### What happens

A load, decode, text-extraction, rendering or embedding call throws `ResourceLimitError` (code `resource-limit-exceeded`):

```
ResourceLimitError: Input exceeds the internal limit maxImageDimension (65536 pixels).
```

Or a decode call throws `UnsupportedFilterError` (code `unsupported-filter`):

```
UnsupportedFilterError: JPEG 2000 (JPXDecode) image data is not decoded in this release.
```

`ResourceLimitError` carries `limit` (the name of the limit), `max` (its value) and `actual` (the size the input needed, or `undefined` when that is not a finite number). `UnsupportedFilterError` carries `filter`, which is `'JPXDecode'`, `'JBIG2Decode'` or `'VP8'`.

Two calls do not throw for these errors: signature verification reports the one signature as not valid and still checks the others, and `extractPageImages()` skips the one image it cannot decode. Rendering draws no images in this release.

### Why it happens

- **`ResourceLimitError`:** the input needs more than one of the library's internal limits allows. The limits bound one stream, one table or one call, they are fixed in this version, and every file of the test corpus stays at or below a quarter of each of them. The values are listed under [Input limits](./performance.md#input-limits).
- **`UnsupportedFilterError`:** the data uses a format this release does not decode: JPEG 2000 (`/JPXDecode`), JBIG2 (`/JBIG2Decode`) or lossy WebP (VP8). The error is thrown before any of the data is read, so no wrong pixels are returned.

### How to fix it

The limits cannot be changed in this version. Treat a file that throws `ResourceLimitError` as one this version does not process: reject it, or hand it to a tool that does. For an image above the size limits, scale it down before you embed it. Do not retry the same call on the same bytes.

```ts
import { loadPdf, ResourceLimitError, UnsupportedFilterError } from 'modern-pdf-lib';

try {
  const doc = await loadPdf(bytes);
  // ... work with doc ...
} catch (err) {
  if (err instanceof ResourceLimitError) {
    console.error(`Refused by ${err.limit}: the input needs more than ${err.max}`);
  } else if (err instanceof UnsupportedFilterError) {
    console.error(`Not decoded in this release: ${err.filter}`);
  } else {
    throw err;
  }
}
```

For `UnsupportedFilterError`:

- **Lossy WebP:** convert the image to PNG or JPEG before embedding it. Lossless WebP still embeds.
- **A PDF that holds JPEG 2000 or JBIG2 images:** the file still loads, saves, merges and copies, and those streams are written back unchanged. `extractImages()` returns such images with their encoded bytes, which a dedicated decoder can read. `decodeImageStream()` and `decodeStream()` throw for them.

> [!WARNING]
> The limits keep one call bounded; they do not bound a process, and nothing caps the total over many streams or files. For untrusted files, run each one in a worker or child process with its own time and memory limit.

## 11. UnsupportedEncryptionError when saving a loaded document

### What happens

You load an encrypted PDF with its password, change it, and `save()` throws:

```
UnsupportedEncryptionError: save() would write content decrypted from an encrypted PDF without encryption; call encrypt() on this document before saving it.
```

`saveAsStream()`, `saveAsBlob()`, `saveAsBase64()`, `serializePdf()`, the writers, `saveIncremental()`, `saveDocumentIncremental()` and `sanitizePdf()` throw it too, and so does the save of a document that received pages, objects or metadata from the loaded one through `copy()`, `copyPages()`, `addPage()` with one of its pages, `mergePdfs()`, `splitPdf()` or the embed calls. `copy()` of such a document does not call the `onAfterSave` hooks of registered plugins.

### Why it happens

`loadPdf()` decrypts the objects of the file with the password, so the document holds plaintext. The library does not write that plaintext without protection by accident: there is no silent plaintext save and no option that turns the check off.

### How to fix it

Call `encrypt()` on the document you save, with the passwords and algorithm you want for the output, then `save()`:

```ts
import { loadPdf } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const bytes = new Uint8Array(await readFile('protected.pdf'));
const doc = await loadPdf(bytes, { password: 'old-password' });

await doc.encrypt({ userPassword: 'new-user', ownerPassword: 'new-owner', algorithm: 'aes-256' });
const saved = await doc.save();
```

The result is a new encryption of the decrypted objects, not a byte copy: strings that hold bytes above 0x7F are rewritten on save until 0.41.0. The re-encrypted document does not keep the permissions of the source: without a `permissions` argument `encrypt()` denies every permission (measured with qpdf 12.4.2: `/P` -3904, all denied, for a source that allowed everything). Pass them to grant some, for example `permissions: { printing: true, copying: true }`. The save rule covers what the library writes; it does not cover content you read from the document and feed back, or content the library derives from it, such as extracted text.

For a merge or a copy, call `encrypt()` on the target document. After `encrypt()`, `save()`, `saveAsBlob()`, `saveAsBase64()`, `serializePdf()` and `PdfWriter` write the document encrypted; `saveAsStream()`, `PdfStreamWriter`, `saveIncremental()` and `saveDocumentIncremental()` stay refused because they cannot encrypt, so use `save()`. A load with `{ ignoreEncryption: true }` is a different case: its streams are written as loaded. The full rules are in [Loading and saving encrypted documents](./security.md#loading-and-saving-encrypted-documents).

The same error type is thrown on load, instead of returning data that is still encrypted, for a security handler other than Standard, an unknown `/V` or crypt filter method, a crypt filter name the file does not define, an `/Encrypt` dictionary that cannot be honoured, and damaged AES data. No password fixes those files.

## 12. ModernPdfLibWarning: MPL_LEGACY_R6_KEY and MPL_IGNORED_OPTION

### What happens

Node prints a warning of type `ModernPdfLibWarning` once per process, for example:

```
(node:1234) [MPL_LEGACY_R6_KEY] ModernPdfLibWarning: The AES-256 key of this document was derived the way modern-pdf-lib 0.26.0 to 0.40.8 wrote it, which other PDF software does not accept. Call encrypt() and save to write it with the standard derivation.
(node:1234) [MPL_IGNORED_OPTION] ModernPdfLibWarning: `embedFont()`: the option `features` has no effect in this version.
```

### Why it happens

- **`MPL_LEGACY_R6_KEY`:** the file is AES-256 and was written by modern-pdf-lib 0.26.0 to 0.40.8, whose password hash deviates from ISO 32000-2 Algorithm 2.B. The file opens with its passwords, but qpdf and pdf.js do not open it. The warning is emitted once per process, however many such files you load.
- **`MPL_IGNORED_OPTION`:** you passed an option that the function accepts and does not act on in this version. The message names the function and the option, never the value. Each option warns once per process. The options are: `signPdf` (`timestampUrl`, `contactInfo`, and `reason` and `location` unless a visible appearance shows them), `setCertificationLevel()`, `addFieldLock()`, `verifySignatureDetailed` (`timeout`, a non-empty `trustedCerts`), `validateCertificateChain` (`checkRevocation: true`), `saveIncrementalWithSignaturePreservation` and `appendIncrementalUpdate` (`compress: true`), `saveIncremental` (`objectStreamThreshold`, `useWasm: true`), `saveAsStream` (a finite `objectStreamThreshold`), `embedFont` (`subset: false`, `features`), `StreamingPdfParser` (`parseContentStreams: true`), `optimizeAllImages` (`maxDpi`), `metadataPlugin` (`creator`, `defaultTitle`, `defaultAuthor`), `applyTablePreset` (`hasHeader`), `buildPdfX6OutputIntent` (`variant`), the structure elements of the accessibility helpers (`scope`, `rowSpan`), and the barcode renderers (`showText: true`, `fontSize`, `includeCheckDigit: true`, `wideToNarrowRatio`, `errorCorrection`, `columns` and `errorLevel` in the options of the `*ToOperators()` functions).

### How to fix it

- For `MPL_LEGACY_R6_KEY`, call `encrypt()` on the loaded document and `save()` it (see [11](#_11-unsupportedencryptionerror-when-saving-a-loaded-document)). The new file uses the standard derivation.
- For `MPL_IGNORED_OPTION`, remove the option from the call, or move it to the function that uses it (for example the encoder instead of the `*ToOperators()` renderer). The guide of the feature says what the option would have done.
- To silence the warnings in Node, start the process with `--disable-warning=ModernPdfLibWarning` (every warning of the library), `--disable-warning=MPL_LEGACY_R6_KEY` or `--disable-warning=MPL_IGNORED_OPTION`, or put the flag in `NODE_OPTIONS`. The library has no hook of its own for them. In a runtime without `process.emitWarning` the message goes to `console.warn`.

## 13. Strict mode throws on a recovered stream

### What happens

`loadPdf(bytes, { throwOnInvalidObject: true })` throws a parse error for a file that loads without it:

```
PdfParseError: Failed to parse indirect object 4 0 at offset 202
```

### Why it happens

The `/Length` of a stream can be wrong, missing, or an indirect reference defined later in the file. A lenient load does not drop such a stream: when the declared length does not end at `endstream`, the data ends at the first `endstream` (or `endobj`), less at most one end-of-line marker. An indirect `/Length` is resolved even when its object comes later in the file. Strict mode treats a recovered stream as a malformed object and throws. A lenient load emits no warning for a recovered stream.

### How to fix it

Use strict mode only to detect a malformed file. To read the file, load it without `throwOnInvalidObject` (the default). A well-formed file, where `/Length` is correct and followed by `endstream`, loads in both modes with the same stream data.
