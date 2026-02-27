# Images

This guide covers embedding and drawing images in PDF documents with `modern-pdf`.

## Overview

`modern-pdf` supports two image formats:

- **PNG** — Full support including alpha transparency. Decoded using a WASM-accelerated PNG decoder (with a pure-JS fallback).
- **JPEG** — Passed through directly to the PDF without re-encoding, making JPEG embedding extremely fast.

## Embedding a PNG

Load the image data as a `Uint8Array` and pass it to `pdf.embedPng()`:

```ts
import { createPdf, PageSizes } from 'modern-pdf';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);

// In Node
import { readFile } from 'node:fs/promises';
const pngBytes = new Uint8Array(await readFile('logo.png'));

// In the browser
// const pngBytes = new Uint8Array(await fetch('/logo.png').then(r => r.arrayBuffer()));

const image = await pdf.embedPng(pngBytes);

page.drawImage(image, {
  x: 50,
  y: 600,
  width: 200,
  height: 100,
});

const bytes = await pdf.save();
```

### Transparency

PNG images with alpha channels are fully supported. The alpha channel is separated into a PDF soft mask automatically, preserving transparency when the PDF is rendered.

```ts
// PNGs with transparency work out of the box
const transparentLogo = await pdf.embedPng(pngWithAlpha);
page.drawImage(transparentLogo, { x: 50, y: 500, width: 150, height: 150 });
```

## Embedding a JPEG

JPEG embedding is a zero-copy operation. The raw JPEG data is written directly into the PDF stream, so there is no decoding or re-encoding overhead.

```ts
const jpegBytes = new Uint8Array(await readFile('photo.jpg'));
const photo = await pdf.embedJpeg(jpegBytes);

page.drawImage(photo, {
  x: 50,
  y: 300,
  width: 400,
  height: 300,
});
```

> [!TIP]
> Use JPEG for photographs and complex images where file size matters. Use PNG for images that require transparency or pixel-perfect rendering (logos, icons, diagrams).

## Image Positioning and Scaling

### Explicit Dimensions

Specify `width` and `height` to set the exact size of the drawn image in PDF points:

```ts
page.drawImage(image, {
  x: 100,
  y: 500,
  width: 300,
  height: 200,
});
```

### Using Original Dimensions

If you omit `width` and `height`, the image is drawn at its original pixel dimensions (1 pixel = 1 point):

```ts
// Draws at the image's native resolution
page.drawImage(image, {
  x: 50,
  y: 400,
});
```

### Scaling Proportionally

Use the image's intrinsic dimensions to calculate proportional scaling:

```ts
const image = await pdf.embedPng(pngBytes);
const { width: origWidth, height: origHeight } = image;

const maxWidth = 400;
const scale = maxWidth / origWidth;

page.drawImage(image, {
  x: 50,
  y: 400,
  width: origWidth * scale,
  height: origHeight * scale,
});
```

### Fitting Within a Bounding Box

To fit an image within a box while preserving its aspect ratio:

```ts
function fitImage(
  image: { width: number; height: number },
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  return {
    width: image.width * scale,
    height: image.height * scale,
  };
}

const fitted = fitImage(image, 300, 200);
page.drawImage(image, {
  x: 50,
  y: 500,
  ...fitted,
});
```

## Image Optimization Options

### PNG Optimization

When saving the PDF, PNG image data is compressed using the same deflate compression as the rest of the PDF. The WASM-accelerated compressor (libdeflate) provides significantly better compression ratios and speed:

```ts
import { initWasm } from 'modern-pdf';

// Enable WASM for better PNG compression
await initWasm();

const bytes = await pdf.save();
```

### Reusing Embedded Images

Each call to `embedPng()` or `embedJpeg()` creates a new image object in the PDF. If you need to draw the same image on multiple pages, embed it once and reuse the reference:

```ts
// Embed once
const logo = await pdf.embedPng(logoBytes);

// Draw on every page
for (let i = 0; i < 10; i++) {
  const page = pdf.addPage(PageSizes.A4);
  page.drawImage(logo, { x: 50, y: 750, width: 80, height: 30 });
  page.drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 14 });
}
```

The image data is stored only once in the final PDF, regardless of how many times it is drawn.

## Options Reference

The full set of options accepted by `page.drawImage()`:

| Option | Type | Default | Description |
|---|---|---|---|
| `x` | `number` | Required | Horizontal position in points |
| `y` | `number` | Required | Vertical position in points (from bottom) |
| `width` | `number` | Image's native width | Width in points |
| `height` | `number` | Image's native height | Height in points |
| `rotate` | `Angle` | `degrees(0)` | Rotation angle |
| `opacity` | `number` | `1` | Image opacity (0 to 1) |
