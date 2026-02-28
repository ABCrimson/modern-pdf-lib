# Coordinates

This guide explains how the PDF coordinate system works, how it differs from screen/DOM coordinates, and how to position content precisely with `modern-pdf-lib`.

## PDF Coordinate System

PDF uses a Cartesian coordinate system with the **origin at the bottom-left** corner of the page. The X axis increases to the right and the Y axis increases **upward**. Units are measured in **points** (1 point = 1/72 inch).

Here is the layout for a standard A4 page (595.28 x 841.89 points):

```
                    595.28 pt
        +-------------------------------+
841.89  |                               |  Y
  pt    |                               |  ^
        |                               |  |
        |         Page Content          |  |
        |                               |  |
        |                               |  |
        |                               |  |
        | (0, 0)                        |
        +-------------------------------+---> X
      Origin
    (bottom-left)
```

- `(0, 0)` is the **bottom-left** corner.
- `(595.28, 841.89)` is the **top-right** corner of an A4 page.
- Moving **right** increases X.
- Moving **up** increases Y.

## Screen/DOM Coordinate System

Web browsers and most screen-based systems use a coordinate system with the **origin at the top-left**. The Y axis increases **downward**:

```
      Origin
    (top-left)
        +-------------------------------+---> X
        | (0, 0)                        |
        |                               |  |
        |                               |  |
        |         Screen Content        |  v
        |                               |
        |                               |  Y
        |                               |
        |                        (w, h) |
        +-------------------------------+
```

- `(0, 0)` is the **top-left** corner.
- Moving **right** increases X.
- Moving **down** increases Y.

## The Key Difference

> [!WARNING]
> The Y axis is **flipped** between PDF and screen coordinates. In PDF, Y increases upward. On screen, Y increases downward. Forgetting this is the single most common cause of incorrectly positioned content.

The X axis works the same in both systems -- only Y needs conversion.

## Converting Between Systems

The conversion formulas are straightforward. You only need the page height:

```
pdfY    = pageHeight - screenY
screenY = pageHeight - pdfY
```

### Screen to PDF

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);
const pageHeight = page.getHeight(); // 841.89

// A click at screen position (100, 50) maps to:
const screenX = 100;
const screenY = 50;

const pdfX = screenX;                    // X is the same
const pdfY = pageHeight - screenY;       // 841.89 - 50 = 791.89

page.drawCircle({
  x: pdfX,
  y: pdfY,
  radius: 5,
  color: rgb(1, 0, 0),
});
```

### PDF to Screen

```ts
// A text item extracted at PDF position (200, 700) maps to:
const pdfX = 200;
const pdfY = 700;
const pageHeight = 841.89;

const screenX = pdfX;                    // X is the same
const screenY = pageHeight - pdfY;       // 841.89 - 700 = 141.89
```

## How drawText Works

When you call `page.drawText()`, the `x` and `y` options specify the **baseline start position** of the text -- not the top-left corner. The baseline is the line that letters sit on; descenders (like "g" and "p") extend below it.

```ts
page.drawText('Hello, world!', {
  x: 50,
  y: 700,
  size: 16,
  font: StandardFonts.Helvetica,
  color: rgb(0, 0, 0),
});
```

In the example above, `(50, 700)` is where the left edge of the "H" sits on the baseline. The top of the text is approximately at `700 + ascent` and the bottom of any descenders is at `700 + descent` (descent is a negative number).

### Multi-line Text

Because Y increases upward, drawing text from top to bottom means **decreasing** Y for each line:

```ts
const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4'];
const fontSize = 14;
const lineHeight = fontSize * 1.4;
let y = 750; // Start near the top

for (const line of lines) {
  page.drawText(line, {
    x: 50,
    y,
    size: fontSize,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight; // Move DOWN the page (Y decreases)
}
```

> [!TIP]
> Use a "cursor" variable that starts near the top of the page and decreases with each element you draw. This top-down pattern makes layout intuitive even though the PDF Y axis points upward.

## Text Extraction Positions

The `extractTextWithPositions()` function returns text items with coordinates in **PDF space** (origin at bottom-left, Y increases upward). To process extracted text in visual top-to-bottom reading order, sort by Y **descending**:

```ts
import { loadPdf, extractTextWithPositions, parseContentStream } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const pdfBytes = new Uint8Array(await readFile('document.pdf'));
const pdf = await loadPdf(pdfBytes);

// Get the first page's content stream operators
const page = pdf.getPages()[0]!;
const streamData = page.getContentStreamData();
const operators = parseContentStream(streamData);

// Extract positioned text items
const items = extractTextWithPositions(operators);

// Sort top-to-bottom, then left-to-right
const sorted = [...items].sort((a, b) => {
  if (Math.abs(a.y - b.y) > 5) return b.y - a.y; // Top-to-bottom (higher Y first)
  return a.x - b.x;                                // Left-to-right within same line
});

for (const item of sorted) {
  console.log(`"${item.text}" at (${item.x.toFixed(1)}, ${item.y.toFixed(1)})`);
}
```

Each `TextItem` has the following properties:

| Property | Type | Description |
|---|---|---|
| `text` | `string` | The extracted text content |
| `x` | `number` | Horizontal position (PDF coordinates) |
| `y` | `number` | Vertical position (PDF coordinates) |
| `width` | `number` | Approximate text width in points |
| `height` | `number` | Approximate text height in points |

## Page Rotation

PDF pages can have a `/Rotate` entry (0, 90, 180, or 270 degrees). This is purely a **display hint** -- it tells viewers how to present the page to the user. The underlying coordinate system does **not** rotate.

```ts
const page = pdf.addPage([595.28, 841.89], { rotation: 90 });

// Even with 90-degree rotation, (0, 0) is still the bottom-left
// of the UNROTATED page. The viewer rotates the result for display.
page.drawText('Rotated page', {
  x: 50,
  y: 400,
  size: 16,
  color: rgb(0, 0, 0),
});
```

> [!NOTE]
> When working with rotated pages, the coordinate system stays the same, but what the user sees as "width" and "height" are swapped. A 90-degree-rotated A4 page still has width=595.28 and height=841.89 in PDF coordinates, but the viewer displays it in landscape orientation. If you need to reason about the visual layout, swap your x/y logic accordingly.

## Page Boxes

PDF defines five page boundary boxes. Each is a rectangle specified in PDF coordinates:

| Box | Purpose | Required |
|---|---|---|
| **MediaBox** | Physical page size (paper). This is the overall boundary. | Yes |
| **CropBox** | Visible region when displayed. Defaults to MediaBox. | No |
| **BleedBox** | Region to which content extends for printing bleed. | No |
| **TrimBox** | Intended finished size after trimming. | No |
| **ArtBox** | Meaningful content area (used by placing applications). | No |

```ts
const page = pdf.getPages()[0]!;

const media = page.getMediaBox();
console.log(`MediaBox: ${media.x}, ${media.y}, ${media.width}, ${media.height}`);

const crop = page.getCropBox();
if (crop) {
  console.log(`CropBox: ${crop.x}, ${crop.y}, ${crop.width}, ${crop.height}`);
}

const trim = page.getTrimBox();
if (trim) {
  console.log(`TrimBox: ${trim.x}, ${trim.y}, ${trim.width}, ${trim.height}`);
}
```

> [!WARNING]
> Do not assume the MediaBox origin is `(0, 0)`. Some PDFs use a non-zero origin (for example, `[-50, -50, 645.28, 891.89]`). Always read the box coordinates rather than assuming they start at zero. Use `page.getMediaBox()` to get the actual values.

## Common Patterns

### Top-Down Drawing with a Cursor

The most practical approach for document layout is to maintain a Y cursor that starts at the top and decreases:

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);
const pageHeight = page.getHeight();
const margin = 50;

let cursor = pageHeight - margin; // Start at top margin

// Title
page.drawText('Document Title', {
  x: margin,
  y: cursor,
  size: 24,
  font: StandardFonts.HelveticaBold,
  color: rgb(0, 0, 0),
});
cursor -= 36; // Move down past the title

// Subtitle
page.drawText('A subtitle goes here', {
  x: margin,
  y: cursor,
  size: 14,
  font: StandardFonts.Helvetica,
  color: rgb(0.4, 0.4, 0.4),
});
cursor -= 28;

// Horizontal rule
page.drawLine({
  start: { x: margin, y: cursor },
  end: { x: page.getWidth() - margin, y: cursor },
  thickness: 1,
  color: rgb(0.8, 0.8, 0.8),
});
cursor -= 20;

// Body text
const bodyLines = [
  'First paragraph of body text.',
  'Second paragraph continues here.',
  'Third paragraph wraps up the section.',
];

for (const line of bodyLines) {
  page.drawText(line, {
    x: margin,
    y: cursor,
    size: 12,
    color: rgb(0, 0, 0),
  });
  cursor -= 18;
}
```

### Centering Text Horizontally

```ts
function drawCenteredText(
  page: PdfPage,
  text: string,
  font: FontRef,
  fontSize: number,
  y: number,
): void {
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const pageWidth = page.getWidth();
  const x = (pageWidth - textWidth) / 2;

  page.drawText(text, { x, y, font, size: fontSize, color: rgb(0, 0, 0) });
}
```

### Centering Text Vertically

```ts
function drawVerticallyCentered(
  page: PdfPage,
  text: string,
  font: FontRef,
  fontSize: number,
  x: number,
): void {
  const metrics = font.metricsAtSize(fontSize);
  const textHeight = metrics.ascent - metrics.descent;
  const pageHeight = page.getHeight();
  const y = (pageHeight - textHeight) / 2 - metrics.descent;

  page.drawText(text, { x, y, font, size: fontSize, color: rgb(0, 0, 0) });
}
```

### Right-Aligning Text

```ts
function drawRightAligned(
  page: PdfPage,
  text: string,
  font: FontRef,
  fontSize: number,
  y: number,
  marginRight: number = 50,
): void {
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const x = page.getWidth() - marginRight - textWidth;

  page.drawText(text, { x, y, font, size: fontSize, color: rgb(0, 0, 0) });
}
```

### Positioning an Element at a Specific Page Fraction

```ts
const pageWidth = page.getWidth();
const pageHeight = page.getHeight();

// Place something at 25% from left, 75% from bottom
const x = pageWidth * 0.25;
const y = pageHeight * 0.75;

page.drawCircle({ x, y, radius: 10, color: rgb(0, 0.5, 1) });
```

## Quick Reference Table

| Operation | Formula |
|---|---|
| Screen Y to PDF Y | `pdfY = pageHeight - screenY` |
| PDF Y to Screen Y | `screenY = pageHeight - pdfY` |
| Next line below | `y -= lineHeight` |
| Center horizontally | `x = (pageWidth - contentWidth) / 2` |
| Center vertically | `y = (pageHeight - contentHeight) / 2` |
| Right-align | `x = pageWidth - marginRight - contentWidth` |
| Bottom margin | `y = margin` |
| Top margin | `y = pageHeight - margin` |
| Points to inches | `inches = points / 72` |
| Inches to points | `points = inches * 72` |
| Points to mm | `mm = points * 25.4 / 72` |
| mm to points | `points = mm * 72 / 25.4` |
