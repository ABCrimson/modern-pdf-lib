# Migrating from pdf-lib

This guide helps you migrate existing projects from `pdf-lib` to `modern-pdf-lib`. The API has been redesigned from the ground up, but the core concepts remain familiar.

## Key Differences

| Aspect | pdf-lib | modern-pdf-lib |
|---|---|---|
| Module format | CJS + ES module builds (ES5 syntax) + UMD | ESM-first (ESM + CJS builds) |
| TypeScript | 3.9 (declarations) | 7.1 (dev build, pinned in package.json) with strict types |
| Target | ES5 | ESNext |
| Buffer usage | `Buffer` in Node APIs | `Uint8Array` everywhere |
| Async model | Mixed sync/async | Async-first |
| Scope | Read + Create + Modify | Read + Create + Modify + Forms + Signatures + Accessibility |
| Compression | Pure JS (pako) | Pure JS (fflate) |
| Font shaping | fontkit layout (kerning, ligatures); no complex-script shaping | None: `drawText` writes one glyph per character (a `cmap` lookup for embedded fonts, the literal string for standard fonts); no ligatures, kerning or mark positioning |
| Streaming | Not supported | `ReadableStream` output |
| Node version | no declared minimum | 26.4+ |
| Performance | Baseline | 37 comparison benchmarks against pdf-lib; `pnpm run bench` prints the results for your machine |

The pdf-lib column reflects pdf-lib 1.17.1.

## API Comparison

### Creating a Document

```ts
// pdf-lib
import { PDFDocument } from 'pdf-lib';
const pdfDoc = await PDFDocument.create();

// modern-pdf-lib
import { createPdf } from 'modern-pdf-lib';
const pdf = createPdf();
```

### Adding a Page

```ts
// pdf-lib
import { PDFDocument } from 'pdf-lib';
const page = pdfDoc.addPage([595.28, 841.89]); // A4

// modern-pdf-lib
import { createPdf, PageSizes } from 'modern-pdf-lib';
const page = pdf.addPage(PageSizes.A4);
```

### Drawing Text

```ts
// pdf-lib
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage();
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
page.drawText('Hello!', {
  x: 50,
  y: 700,
  size: 24,
  font,
  color: rgb(0, 0, 0),
});

// modern-pdf-lib
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';
const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);
const font = await pdf.embedFont(StandardFonts.Helvetica);
page.drawText('Hello!', {
  x: 50,
  y: 700,
  size: 24,
  font,
  color: rgb(0, 0, 0),
});
```

### Embedding Custom Fonts

```ts
// pdf-lib
const fontBytes = fs.readFileSync('font.ttf');
const font = await pdfDoc.embedFont(fontBytes);

// modern-pdf-lib
const fontBytes = await readFile('font.ttf');
const font = await pdf.embedFont(fontBytes);
```

### Embedding Images

```ts
// pdf-lib
const pngBytes = fs.readFileSync('image.png');
const image = await pdfDoc.embedPng(pngBytes);
const dims = image.scale(0.5);
page.drawImage(image, {
  x: 50,
  y: 500,
  width: dims.width,
  height: dims.height,
});

// modern-pdf-lib
const pngBytes = await readFile('image.png');
const image = await pdf.embedPng(pngBytes);
const dims = image.scale(0.5);
page.drawImage(image, {
  x: 50,
  y: 500,
  width: dims.width,
  height: dims.height,
});
```

`image.scale(f)` works as in pdf-lib; `image.scaleToFit(maxWidth, maxHeight)` is also available.

### Drawing Shapes

```ts
// pdf-lib
page.drawRectangle({
  x: 50,
  y: 400,
  width: 200,
  height: 100,
  color: rgb(0, 0.5, 1),
  borderColor: rgb(0, 0, 0),
  borderWidth: 2,
});

// modern-pdf-lib — identical API
page.drawRectangle({
  x: 50,
  y: 400,
  width: 200,
  height: 100,
  color: rgb(0, 0.5, 1),
  borderColor: rgb(0, 0, 0),
  borderWidth: 2,
});
```

### Saving the Document

```ts
// pdf-lib
const pdfBytes = await pdfDoc.save();
fs.writeFileSync('output.pdf', pdfBytes);

// modern-pdf-lib — save() returns Uint8Array
const bytes = await pdf.save();
await writeFile('output.pdf', bytes);

// modern-pdf-lib — or stream it (unencrypted documents only; an encrypted
// document throws UnsupportedEncryptionError, use save())
const stream = pdf.saveAsStream();
await stream.pipeTo(Writable.toWeb(createWriteStream('output.pdf')));
```

### Colors

```ts
// pdf-lib
import { rgb, cmyk, grayscale } from 'pdf-lib';
const color = rgb(0.5, 0.5, 0.5);

// modern-pdf-lib — identical API
import { rgb, cmyk, grayscale } from 'modern-pdf-lib';
const color = rgb(0.5, 0.5, 0.5);
```

### Rotation

```ts
// pdf-lib
import { degrees, radians } from 'pdf-lib';
page.drawText('Rotated', { font, rotate: degrees(45) });

// modern-pdf-lib — identical API
import { degrees, radians } from 'modern-pdf-lib';
page.drawText('Rotated', { font, rotate: degrees(45) });
```

## Common Patterns Translated

### Multi-page Document with Header/Footer

```ts
// pdf-lib
const pdfDoc = await PDFDocument.create();
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
for (let i = 0; i < 10; i++) {
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  page.drawText(`Page ${i + 1}`, {
    x: width / 2 - 20,
    y: 30,
    size: 10,
    font,
  });
}

// modern-pdf-lib
const pdf = createPdf();
const font = await pdf.embedFont(StandardFonts.Helvetica);
for (let i = 0; i < 10; i++) {
  const page = pdf.addPage(PageSizes.A4);
  const [width] = PageSizes.A4;
  page.drawText(`Page ${i + 1}`, {
    x: width / 2 - 20,
    y: 30,
    size: 10,
    font,
  });
}
```

### Generating an Invoice

```ts
// modern-pdf-lib
import { createPdf, PageSizes, rgb, StandardFonts } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);
const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

// Header
page.drawText('INVOICE', {
  x: 50, y: 780, size: 28,
  font: helveticaBold,
  color: rgb(0.1, 0.1, 0.1),
});

// Table header line
page.drawLine({
  start: { x: 50, y: 700 },
  end: { x: 545, y: 700 },
  thickness: 1,
  color: rgb(0, 0, 0),
});

// Line items
const items = [
  { desc: 'Widget A', qty: 10, price: 9.99 },
  { desc: 'Widget B', qty: 5, price: 24.99 },
];

let y = 680;
for (const item of items) {
  page.drawText(item.desc, { x: 50, y, size: 11, font: helvetica });
  page.drawText(String(item.qty), { x: 350, y, size: 11, font: helvetica });
  page.drawText(`$${(item.qty * item.price).toFixed(2)}`, { x: 450, y, size: 11, font: helvetica });
  y -= 20;
}

const bytes = await pdf.save();
```

## Breaking Changes from pdf-lib

### 1. `PDFDocument` → `PdfDocument`

The class is `PdfDocument`. `PdfDocument.load(bytes)` and `PdfDocument.create()` still exist; the free functions `loadPdf()` and `createPdf()` are the preferred form. `create()` is synchronous, so drop `await`:

```ts
// pdf-lib
const doc = await PDFDocument.create();
const pdfDoc = await PDFDocument.load(existingPdfBytes);

// modern-pdf-lib
import { createPdf, loadPdf } from 'modern-pdf-lib';
const doc = createPdf(); // synchronous, no await needed
const pdf = await loadPdf(existingPdfBytes);
```

PDFs that use object streams or cross-reference streams, including pdf-lib's default output, do not load in this release; files saved with `useObjectStreams: false` do.

### 2. `Uint8Array` in and out

APIs accept `Uint8Array`; a Node `Buffer` is a `Uint8Array` and is accepted as-is. Outputs such as `save()` are plain `Uint8Array`; wrap with `Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)` only where an API demands a `Buffer`.

### 3. CommonJS

`require()` works: the root, `/create`, `/parse` and `/forms` entries ship CJS builds. The `/browser` entry is ESM-only.

### 4. No Default Font

pdf-lib embeds Helvetica when `drawText` is called without a `font`; `modern-pdf-lib` does not, and the text does not render. Pass `font: await doc.embedFont(StandardFonts.Helvetica)` (or another embedded font) to `drawText`, or set a page default with `page.setFont(font)`.

### 5. Standard Fonts: Same Pattern, Watch the `font` Option Type

Standard fonts use the **same** `embedFont(StandardFonts.X)` pattern as `pdf-lib` — no glyph data is written, only a small font dictionary:

```ts
// Identical in both libraries
const font = await doc.embedFont(StandardFonts.Helvetica);
page.drawText('Hello', { font, size: 16, x: 50, y: 700 });
```

One trap: `modern-pdf-lib`'s `drawText` also accepts a **string** for `font`, but a string is treated as a raw page font *resource name* (e.g. `'F1'`), not as a font to load. Passing `StandardFonts.Helvetica` (the string `'Helvetica'`) directly produces a PDF whose content stream references a font resource that was never registered — text will not render. Always pass the `FontRef` returned by `embedFont()`.

### 6. `getPages()` Returns a Readonly Array

In both `pdf-lib` and `modern-pdf-lib`, `getPages()` returns all pages. The main difference is that `modern-pdf-lib` returns a `readonly` array:

```ts
// pdf-lib
const pages = pdfDoc.getPages();
const firstPage = pages[0];

// modern-pdf-lib — same pattern, readonly return type
const pages = pdf.getPages();
const firstPage = pages[0];
```

## Checklist

Use this checklist when migrating a project:

- [ ] Replace `pdf-lib` with `modern-pdf-lib` in `package.json`
- [ ] Update all imports from `pdf-lib` to `modern-pdf-lib`
- [ ] Rename `PDFDocument` to `PdfDocument` (or switch to `createPdf()`/`loadPdf()`); drop `await` on `create()`
- [ ] Pass `font` to every `drawText` call or set one with `page.setFont(font)`; there is no built-in default font
- [ ] Keep standard font usage as-is (`await doc.embedFont(StandardFonts.X)` works unchanged)
- [ ] Update file writing from `fs.writeFileSync` to `await writeFile`
- [ ] CommonJS projects can keep `require()`: the root, `/create`, `/parse` and `/forms` entries ship CJS builds; the `/browser` entry is ESM-only
- [ ] Ensure Node 26.4+ or a compatible runtime
- [ ] Test all generated PDFs for visual correctness
