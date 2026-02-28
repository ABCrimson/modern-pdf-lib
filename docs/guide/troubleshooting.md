# Troubleshooting

This guide covers the most common issues encountered when working with `modern-pdf-lib`, along with explanations and working fixes for each.

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
> If you only know the owner password (not the user password), pass it in the same `password` field. The parser tries both owner and user password verification automatically.

If you want to load the document structure without decrypting streams (for inspection only), use the `ignoreEncryption` option:

```ts
const doc = await loadPdf(bytes, { ignoreEncryption: true });
```

## 2. FontNotEmbeddedError

### What happens

You call `page.drawText()` and get:

```
FontNotEmbeddedError: No font has been embedded. Call doc.embedFont() first.
```

### Why it happens

Every `drawText()` call requires a font. If you do not pass a `font` option, the library looks for a default embedded font on the document. When none has been embedded yet, it throws.

### How to fix it

Either embed a custom font or use one of the 14 standard PDF fonts:

**Option A — Standard font (simplest, no embedding needed):**

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

page.drawText('Hello with Helvetica', {
  x: 50,
  y: 700,
  size: 16,
  font: StandardFonts.Helvetica,
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
> Standard fonts only support the WinAnsi (Latin-1) character set. If your text contains characters outside this set (CJK, Arabic, Cyrillic, emoji, etc.), you **must** embed a custom TrueType or OpenType font that contains those glyphs. See the [Fonts guide](./fonts) for details.

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

const pageWidth = page.getWidth();   // 595.28 for A4
const pageHeight = page.getHeight(); // 841.89 for A4

// Place text 50 points from the top, 50 points from the left
const topMargin = 50;
const leftMargin = 50;

page.drawText('This is near the top of the page', {
  x: leftMargin,
  y: pageHeight - topMargin,
  size: 16,
  font: StandardFonts.Helvetica,
  color: rgb(0, 0, 0),
});

// Place text 50 points from the bottom
page.drawText('This is near the bottom of the page', {
  x: leftMargin,
  y: topMargin,
  size: 16,
  font: StandardFonts.Helvetica,
  color: rgb(0, 0, 0),
});

const bytes = await doc.save();
```

> [!NOTE]
> PDF coordinates are measured in **points** (1 point = 1/72 inch). An A4 page is 595.28 x 841.89 points. A US Letter page is 612 x 792 points.

## 4. WASM Initialization Errors

### What happens

`initWasm()` throws an error, or WASM-related features (compression, font subsetting acceleration) silently fail in restricted runtime environments like Cloudflare Workers or older browsers.

### Why it happens

Some runtimes restrict dynamic WASM compilation (`WebAssembly.compile` / `WebAssembly.instantiate` from a fetched URL). Cloudflare Workers, for instance, only allow WASM modules that are pre-compiled and imported as bindings.

### How to fix it

Pass pre-loaded WASM bytes directly to `initWasm()` instead of relying on dynamic loading:

```ts
import { createPdf, initWasm, PageSizes } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

// Load WASM bytes ahead of time
const deflateWasm = new Uint8Array(await readFile('wasm/deflate.wasm'));

await initWasm({
  deflate: true,
  deflateWasm,
});

// Now all save() calls will use WASM-accelerated compression
const doc = createPdf();
doc.addPage(PageSizes.A4);
const bytes = await doc.save();
```

> [!TIP]
> WASM modules are entirely optional. If `initWasm()` is never called, the library falls back to pure-JS implementations (fflate for compression, JS for font subsetting). The pure-JS path works in every runtime without restrictions.

## 5. Large PDF Memory Issues

### What happens

Calling `doc.save()` on a document with hundreds of pages or many large images causes the process to run out of memory (OOM), or the browser tab crashes.

### Why it happens

`save()` serializes the entire PDF into a single `Uint8Array` in memory. For very large documents (hundreds of MB), this can exceed available heap space.

### How to fix it

Use `saveAsStream()` to serialize the PDF as a `ReadableStream<Uint8Array>`, which emits chunks incrementally without holding the entire file in memory at once:

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';
import { createWriteStream } from 'node:fs';
import { Writable } from 'node:stream';

const doc = createPdf();

// Add many pages
for (let i = 0; i < 500; i++) {
  const page = doc.addPage(PageSizes.A4);
  page.drawText(`Page ${i + 1}`, {
    x: 50,
    y: 750,
    size: 24,
    font: StandardFonts.Helvetica,
    color: rgb(0, 0, 0),
  });
}

// Stream to disk instead of buffering the entire PDF in memory
const stream = doc.saveAsStream();
const fileStream = createWriteStream('large-output.pdf');

const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  fileStream.write(value);
}
fileStream.end();

console.log('Large PDF written to disk via streaming');
```

> [!TIP]
> In edge/serverless environments, you can return the `ReadableStream` directly as the HTTP response body, avoiding any in-memory buffering.

## 6. Cross-Runtime Quirks

### What happens

Code that works in Node.js fails or behaves differently in Deno, Bun, or Cloudflare Workers.

### Why it happens

Each runtime has its own security model, file system access rules, and module system constraints.

### How to fix it

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
    page.drawText('Generated on the edge', {
      x: 50,
      y: 700,
      size: 20,
      font: StandardFonts.Helvetica,
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
> Cloudflare Workers have a 128 MB memory limit. For large PDFs, always use `saveAsStream()` instead of `save()`. Also note that WASM modules must be pre-compiled — pass bytes directly to `initWasm({ deflateWasm: wasmBytes })`.

**Bun** works out of the box with no special configuration:

```ts
// Bun — works just like Node.js
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);
page.drawText('Hello from Bun', {
  x: 50,
  y: 700,
  size: 20,
  font: StandardFonts.Helvetica,
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

const page = doc.getPages()[0];
const operators = parseContentStream(page.getContentStreamData());
const items = extractTextWithPositions(operators);
const text = items.map((item) => item.text).join(' ');
console.log(text);
```

**For missing ToUnicode CMaps:** there is no automatic fix. The text may partially decode using the font's built-in encoding, but unmapped glyphs will appear as replacement characters. This is a limitation of the source PDF, not the library.

**For scanned (image-only) PDFs:** text extraction is not possible. You need an OCR engine (such as Tesseract) to convert the images to text before processing.

> [!NOTE]
> You can detect whether a page contains actual text operators by checking the parsed content stream for `BT`/`ET` (begin/end text) operators. If a page has no text operators, it is likely image-only.

## 8. NoSuchFieldError

### What happens

You call `form.getTextField('fieldName')` and get:

```
NoSuchFieldError: No form field named "fieldName" exists in this document.
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
> The default behavior (`throwOnInvalidObject: false`) silently skips unparseable objects. This is usually what you want for production code, since many real-world PDFs contain minor structural errors that do not affect the visible content. Enable `throwOnInvalidObject: true` only when you need strict validation.
