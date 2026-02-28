# Migrating from pdf-lib

This guide helps you migrate existing projects from `pdf-lib` to `modern-pdf-lib`. The API has been redesigned from the ground up, but the core concepts remain familiar.

## Key Differences

| Aspect | pdf-lib | modern-pdf-lib |
|---|---|---|
| Module format | CJS + ESM | ESM-only |
| TypeScript | 4.x | 6.0 with strict types |
| Target | ES2017 | ESNext |
| Buffer usage | `Buffer` in Node APIs | `Uint8Array` everywhere |
| Async model | Mixed sync/async | Async-first |
| Scope | Read + Create + Modify | Read + Create + Modify + Forms + Signatures + Accessibility |
| Compression | Pure JS (pako) | WASM-accelerated (libdeflate) + JS fallback |
| Font shaping | None | WASM text shaping (rustybuzz) |
| Streaming | Not supported | `ReadableStream` output |
| Node version | 10+ | 25.7+ |
| Performance | Baseline | 32/35 benchmarks faster (up to 97,545x) |

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
page.drawText('Hello!', {
  x: 50,
  y: 700,
  size: 24,
  font: StandardFonts.Helvetica,
  color: rgb(0, 0, 0),
});
```

### Embedding Custom Fonts

```ts
// pdf-lib
const fontBytes = fs.readFileSync('font.ttf');
const font = await pdfDoc.embedFont(fontBytes);

// modern-pdf-lib
const fontBytes = new Uint8Array(await readFile('font.ttf'));
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

// modern-pdf-lib (embedPng is synchronous)
const pngBytes = new Uint8Array(await readFile('image.png'));
const image = pdf.embedPng(pngBytes);
page.drawImage(image, {
  x: 50,
  y: 500,
  width: image.width * 0.5,
  height: image.height * 0.5,
});
```

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

// modern-pdf-lib — or stream it
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
page.drawText('Rotated', { rotate: degrees(45) });

// modern-pdf-lib — identical API
import { degrees, radians } from 'modern-pdf-lib';
page.drawText('Rotated', { rotate: degrees(45) });
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
for (let i = 0; i < 10; i++) {
  const page = pdf.addPage(PageSizes.A4);
  const [width] = PageSizes.A4;
  page.drawText(`Page ${i + 1}`, {
    x: width / 2 - 20,
    y: 30,
    size: 10,
    font: StandardFonts.Helvetica,
  });
}
```

### Generating an Invoice

```ts
// modern-pdf-lib
import { createPdf, PageSizes, rgb, StandardFonts } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);

// Header
page.drawText('INVOICE', {
  x: 50, y: 780, size: 28,
  font: StandardFonts.HelveticaBold,
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
  page.drawText(item.desc, { x: 50, y, size: 11 });
  page.drawText(String(item.qty), { x: 350, y, size: 11 });
  page.drawText(`$${(item.qty * item.price).toFixed(2)}`, { x: 450, y, size: 11 });
  y -= 20;
}

const bytes = await pdf.save();
```

## Breaking Changes from pdf-lib

### 1. `PDFDocument.load()` → `loadPdf()`

Loading existing PDFs uses a different function name:

```ts
// pdf-lib
const pdfDoc = await PDFDocument.load(existingPdfBytes);

// modern-pdf-lib
import { loadPdf } from 'modern-pdf-lib';
const pdf = await loadPdf(existingPdfBytes);
```

### 2. No `Buffer` Support

All binary data uses `Uint8Array`. If you have a `Buffer`, convert it:

```ts
// pdf-lib accepted Buffer directly
const font = await pdfDoc.embedFont(bufferData);

// modern-pdf-lib requires Uint8Array
const font = await pdf.embedFont(new Uint8Array(bufferData));
```

### 3. ESM-Only

`modern-pdf-lib` cannot be loaded with `require()`:

```ts
// This will NOT work
const { createPdf } = require('modern-pdf-lib');

// Use ESM import instead
import { createPdf } from 'modern-pdf-lib';
```

### 4. No `PDFDocument.create()` — Use `createPdf()`

The factory function is a plain function, not a static class method:

```ts
// pdf-lib
const doc = await PDFDocument.create();

// modern-pdf-lib
const doc = createPdf(); // synchronous, no await needed
```

### 5. Standard Fonts Without Embedding

In `pdf-lib`, standard fonts had to be embedded via `embedFont()`. In `modern-pdf-lib`, standard fonts can be used directly:

```ts
// pdf-lib
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
page.drawText('Hello', { font, size: 16, x: 50, y: 700 });

// modern-pdf-lib
page.drawText('Hello', {
  font: StandardFonts.Helvetica,
  size: 16,
  x: 50,
  y: 700,
});
```

### 6. Image `scale()` Removed

Use the image's `width` and `height` properties directly:

```ts
// pdf-lib
const dims = image.scale(0.5);
page.drawImage(image, { ...dims });

// modern-pdf-lib
page.drawImage(image, {
  width: image.width * 0.5,
  height: image.height * 0.5,
});
```

### 7. `getPages()` Returns a Readonly Array

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
- [ ] Replace `PDFDocument.create()` with `createPdf()`
- [ ] Replace `Buffer` usage with `Uint8Array`
- [ ] Replace `PDFDocument.load()` with `loadPdf()`
- [ ] Update standard font usage (no embedding required)
- [ ] Replace `image.scale()` with manual width/height calculation
- [ ] Update file writing from `fs.writeFileSync` to `await writeFile`
- [ ] Ensure your project uses ESM (`"type": "module"` in `package.json`)
- [ ] Ensure Node 25.7+ or a compatible runtime
- [ ] Test all generated PDFs for visual correctness
