# Shapes

This guide covers drawing shapes, lines, and graphics primitives on PDF pages with `modern-pdf`.

## Rectangles

Draw filled and/or outlined rectangles with `page.drawRectangle()`:

```ts
import { createPdf, PageSizes, rgb } from 'modern-pdf';

const pdf = createPdf();
const page = pdf.addPage(PageSizes.A4);

// Filled rectangle
page.drawRectangle({
  x: 50,
  y: 600,
  width: 200,
  height: 100,
  color: rgb(0.2, 0.4, 0.8),
});

// Outlined rectangle
page.drawRectangle({
  x: 50,
  y: 470,
  width: 200,
  height: 100,
  borderColor: rgb(0, 0, 0),
  borderWidth: 2,
});

// Filled with border
page.drawRectangle({
  x: 50,
  y: 340,
  width: 200,
  height: 100,
  color: rgb(0.95, 0.95, 0.7),
  borderColor: rgb(0.6, 0.5, 0.1),
  borderWidth: 1,
});
```

### Rounded Rectangles

```ts
page.drawRectangle({
  x: 50,
  y: 200,
  width: 200,
  height: 80,
  color: rgb(0.9, 0.9, 0.9),
  borderColor: rgb(0.3, 0.3, 0.3),
  borderWidth: 1,
  borderRadius: 10,
});
```

## Lines

Draw lines between two points with `page.drawLine()`:

```ts
// Simple black line
page.drawLine({
  start: { x: 50, y: 750 },
  end: { x: 500, y: 750 },
  thickness: 1,
  color: rgb(0, 0, 0),
});

// Thick colored line
page.drawLine({
  start: { x: 50, y: 730 },
  end: { x: 500, y: 730 },
  thickness: 3,
  color: rgb(0.8, 0.2, 0.2),
});

// Dashed line
page.drawLine({
  start: { x: 50, y: 710 },
  end: { x: 500, y: 710 },
  thickness: 1,
  color: rgb(0.5, 0.5, 0.5),
  dashArray: [6, 3],
});
```

## Circles and Ellipses

### Circles

Draw circles with `page.drawCircle()`:

```ts
// Filled circle
page.drawCircle({
  x: 150,
  y: 500,
  radius: 50,
  color: rgb(0.1, 0.6, 0.3),
});

// Outlined circle
page.drawCircle({
  x: 300,
  y: 500,
  radius: 50,
  borderColor: rgb(0, 0, 0),
  borderWidth: 2,
});
```

### Ellipses

Draw ellipses with separate horizontal and vertical radii:

```ts
page.drawEllipse({
  x: 200,
  y: 350,
  xScale: 100,
  yScale: 50,
  color: rgb(0.6, 0.2, 0.8),
});

page.drawEllipse({
  x: 400,
  y: 350,
  xScale: 60,
  yScale: 80,
  borderColor: rgb(0.3, 0.3, 0.3),
  borderWidth: 1.5,
});
```

## Colors

`modern-pdf` supports three color spaces: RGB, CMYK, and Grayscale.

### RGB

Use `rgb()` for screen-optimized colors. Values range from 0 to 1:

```ts
import { rgb } from 'modern-pdf';

const red = rgb(1, 0, 0);
const green = rgb(0, 1, 0);
const blue = rgb(0, 0, 1);
const softBlue = rgb(0.3, 0.5, 0.9);
const white = rgb(1, 1, 1);
const black = rgb(0, 0, 0);
```

### CMYK

Use `cmyk()` for print-optimized colors. Values range from 0 to 1:

```ts
import { cmyk } from 'modern-pdf';

const cyan = cmyk(1, 0, 0, 0);
const magenta = cmyk(0, 1, 0, 0);
const yellow = cmyk(0, 0, 1, 0);
const richBlack = cmyk(0.75, 0.68, 0.67, 0.90);
```

> [!TIP]
> Use CMYK colors when generating PDFs intended for professional printing. RGB is sufficient for on-screen viewing and office printing.

### Grayscale

Use `grayscale()` for black-and-white content. The value ranges from 0 (black) to 1 (white):

```ts
import { grayscale } from 'modern-pdf';

const black = grayscale(0);
const darkGray = grayscale(0.3);
const lightGray = grayscale(0.8);
const white = grayscale(1);
```

## Borders and Fill

Shapes can have a fill color, a border, or both:

```ts
// Fill only (no border)
page.drawRectangle({
  x: 50, y: 600, width: 100, height: 60,
  color: rgb(0.9, 0.3, 0.3),
});

// Border only (no fill)
page.drawRectangle({
  x: 180, y: 600, width: 100, height: 60,
  borderColor: rgb(0.2, 0.2, 0.8),
  borderWidth: 2,
});

// Both fill and border
page.drawRectangle({
  x: 310, y: 600, width: 100, height: 60,
  color: rgb(0.9, 0.9, 0.5),
  borderColor: rgb(0.6, 0.5, 0.1),
  borderWidth: 1.5,
});
```

### Opacity

All shapes support an `opacity` option for the fill color and a `borderOpacity` option for the border:

```ts
page.drawRectangle({
  x: 50,
  y: 400,
  width: 200,
  height: 100,
  color: rgb(0, 0, 1),
  opacity: 0.5,
  borderColor: rgb(0, 0, 0),
  borderWidth: 2,
  borderOpacity: 0.8,
});
```

## Graphics State (Push/Pop)

Use `page.pushGraphicsState()` and `page.popGraphicsState()` to save and restore the current drawing state. This is useful when you need to apply temporary transformations or clipping without affecting subsequent drawing operations.

```ts
// Save current state
page.pushGraphicsState();

// Apply transformation — all drawing until pop is affected
page.setFillColor(rgb(1, 0, 0));
page.setLineWidth(3);
page.drawRectangle({ x: 50, y: 400, width: 100, height: 60 });

// Restore state — fill color and line width revert
page.popGraphicsState();

// This rectangle uses the original state
page.drawRectangle({ x: 200, y: 400, width: 100, height: 60 });
```

> [!WARNING]
> Every `pushGraphicsState()` must have a matching `popGraphicsState()`. Unbalanced calls will produce an invalid PDF.

### Common Use Cases

**Watermark with reduced opacity:**

```ts
page.pushGraphicsState();
page.setFillOpacity(0.15);
page.drawText('DRAFT', {
  x: 150,
  y: 400,
  size: 72,
  color: rgb(0.5, 0.5, 0.5),
  rotate: degrees(45),
});
page.popGraphicsState();
```

**Isolated drawing region:**

```ts
function drawCard(page: PdfPage, x: number, y: number): void {
  page.pushGraphicsState();

  page.drawRectangle({
    x, y, width: 200, height: 120,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    borderRadius: 8,
  });

  page.drawText('Card Title', {
    x: x + 16, y: y + 88,
    size: 14, color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText('Card description text here.', {
    x: x + 16, y: y + 64,
    size: 10, color: rgb(0.4, 0.4, 0.4),
  });

  page.popGraphicsState();
}
```

## Shapes Options Reference

### `drawRectangle()`

| Option | Type | Default | Description |
|---|---|---|---|
| `x` | `number` | Required | Left edge in points |
| `y` | `number` | Required | Bottom edge in points |
| `width` | `number` | Required | Width in points |
| `height` | `number` | Required | Height in points |
| `color` | `Color` | — | Fill color |
| `borderColor` | `Color` | — | Border color |
| `borderWidth` | `number` | `1` | Border thickness |
| `borderRadius` | `number` | `0` | Corner radius |
| `opacity` | `number` | `1` | Fill opacity |
| `borderOpacity` | `number` | `1` | Border opacity |
| `rotate` | `Angle` | `degrees(0)` | Rotation angle |

### `drawLine()`

| Option | Type | Default | Description |
|---|---|---|---|
| `start` | `{ x, y }` | Required | Start point |
| `end` | `{ x, y }` | Required | End point |
| `thickness` | `number` | `1` | Line thickness |
| `color` | `Color` | `rgb(0,0,0)` | Line color |
| `dashArray` | `number[]` | — | Dash pattern |
| `opacity` | `number` | `1` | Line opacity |

### `drawCircle()`

| Option | Type | Default | Description |
|---|---|---|---|
| `x` | `number` | Required | Center X |
| `y` | `number` | Required | Center Y |
| `radius` | `number` | Required | Radius in points |
| `color` | `Color` | — | Fill color |
| `borderColor` | `Color` | — | Border color |
| `borderWidth` | `number` | `1` | Border thickness |
| `opacity` | `number` | `1` | Fill opacity |

### `drawEllipse()`

| Option | Type | Default | Description |
|---|---|---|---|
| `x` | `number` | Required | Center X |
| `y` | `number` | Required | Center Y |
| `xScale` | `number` | Required | Horizontal radius |
| `yScale` | `number` | Required | Vertical radius |
| `color` | `Color` | — | Fill color |
| `borderColor` | `Color` | — | Border color |
| `borderWidth` | `number` | `1` | Border thickness |
| `opacity` | `number` | `1` | Fill opacity |
