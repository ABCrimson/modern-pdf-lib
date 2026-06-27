# Rendering & Rasterization

Turn PDF pages into pixels. modern-pdf-lib ships a dependency-free rendering
stack: a content-stream **interpreter** produces a resolution-independent
display list, which a pure-JS **rasterizer** turns into RGBA/PNG, or a **Canvas
adapter** paints onto a 2D context (with native, pixel-accurate text in the
browser). On top sit thumbnails, image/font extraction, visual diffing, an OCR
overlay hook, and true content-removal redaction.

## Render a page to a PNG

```ts
import { loadPdf, renderPageToImage } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const page = doc.getPage(0);

const { data, width, height } = await renderPageToImage(page, { dpi: 150 });
// `data` is PNG bytes (Uint8Array); write it anywhere
await writeFile('page-1.png', data);
```

`RenderOptions`: `scale` (1 = 72 dpi), `dpi`, `background` (an `[r,g,b,a]` or
`'transparent'`), and `renderText`. The pure-JS rasterizer renders vector paths
and strokes at full fidelity with anti-aliasing and the nonzero/even-odd rules;
text is approximated as positioned glyph boxes (no bundled font engine).

## Render onto a Canvas (high-fidelity text)

In a browser or Worker, the Canvas adapter uses the platform's native graphics —
including real text via `fillText`:

```ts
import { renderPageToCanvas } from 'modern-pdf-lib';

const scale = 2; // HiDPI
canvas.width = page.width * scale;
canvas.height = page.height * scale;
renderPageToCanvas(page, canvas.getContext('2d')!, { scale, pixelRatio: 1 });
```

## The display list

Both renderers run on an interpreted display list — useful if you want to
inspect or transform page content:

```ts
import { interpretPage } from 'modern-pdf-lib';

const dl = interpretPage(page);
for (const item of dl.items) {
  if (item.type === 'text') console.log(item.text, 'at', item.transform);
  if (item.type === 'fill') console.log('fill', item.color, item.subpaths.length, 'subpaths');
}
```

## Thumbnails

```ts
import { generateThumbnail } from 'modern-pdf-lib';

const thumb = await generateThumbnail(page, { maxSize: 256 }); // PNG, longest side 256px
```

## Visual diff (regression testing)

Rasterize two pages and score their difference — per-pixel count, a heatmap, and
an SSIM structural-similarity score:

```ts
import { comparePages } from 'modern-pdf-lib';

const { changedPixels, changedRatio, ssim, heatmap } = await comparePages(pageA, pageB, { scale: 1 });
if (ssim < 0.98) console.warn(`pages differ (${changedPixels} px, SSIM ${ssim.toFixed(3)})`);
```

## Extract embedded images & fonts

```ts
import { extractPageImages, extractFonts } from 'modern-pdf-lib';

for (const img of extractPageImages(page)) {
  console.log(`${img.name}: ${img.width}×${img.height}, ${img.channels}ch, alpha=${img.hasAlpha}`);
  // img.pixels is interleaved 8-bit RGBA / RGB / gray
}

for (const font of extractFonts(page)) {
  console.log(`${font.baseFont} (${font.format}${font.subset ? ', subset' : ''})`);
  await writeFile(`${font.baseFont}.${font.format === 'cff' ? 'cff' : 'otf'}`, font.data);
}
```

## OCR overlay (make scans searchable)

Provide any `OcrEngine`; `applyOcr` rasterizes the page, runs recognition, and
writes the results as an **invisible** text layer (render mode 3) so the text is
selectable and searchable without altering the visible page:

```ts
import { applyOcr, type OcrEngine } from 'modern-pdf-lib';

const engine: OcrEngine = {
  async recognize(rgba, width, height) {
    // call Tesseract/cloud OCR; return page-space (y-up) word boxes
    return [{ text: 'Invoice', x: 72, y: 700, width: 60, height: 14 }];
  },
};

const words = await applyOcr(page, engine, { dpi: 150 });
const out = await doc.save(); // the page is now searchable
```

## Redaction by content removal

Unlike a black box drawn on top, `redactRegions` re-emits the content stream with
the underlying text/image operators in the rect **removed** — the data is gone:

```ts
import { redactRegions } from 'modern-pdf-lib';

const { removedText, removedImages } = redactRegions(page, [{ x: 0, y: 90, width: 200, height: 30 }]);
// extracted text from the saved PDF no longer contains the redacted runs
```

## Tiling huge pages

For very large pages, render in bounded memory tile-by-tile, with an LRU cache:

```ts
import { computeTileGrid, renderPageTile, RenderCache } from 'modern-pdf-lib';

const grid = computeTileGrid(page, { tileSize: 512, dpi: 300 });
for (let row = 0; row < grid.rows; row++) {
  for (let col = 0; col < grid.columns; col++) {
    const tile = renderPageTile(page, col, row, { tileSize: 512, dpi: 300 });
    // composite `tile` (RGBA) at (col·512, row·512)
  }
}
```
