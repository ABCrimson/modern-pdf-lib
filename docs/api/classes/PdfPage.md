[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfPage

# Class: PdfPage

Defined in: [src/core/pdfPage.ts:641](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L641)

A single page in a PDF document.

Drawing methods are synchronous and append PDF operators to an
internal string buffer.  The buffer is converted to a content stream
when the document is saved.

## Constructors

### Constructor

```ts
new PdfPage(
   w, 
   h, 
   registry): PdfPage;
```

Defined in: [src/core/pdfPage.ts:816](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L816)

#### Parameters

##### w

`number`

Page width in points.

##### h

`number`

Page height in points.

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

Object registry for allocating refs.

#### Returns

`PdfPage`

## Properties

### contentStreamRef

```ts
readonly contentStreamRef: PdfRef;
```

Defined in: [src/core/pdfPage.ts:728](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L728)

Pre-allocated indirect reference for this page's content stream.

***

### pageRef

```ts
readonly pageRef: PdfRef;
```

Defined in: [src/core/pdfPage.ts:725](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L725)

Pre-allocated indirect reference for this page's /Page dictionary.

## Accessors

### height

#### Get Signature

```ts
get height(): number;
```

Defined in: [src/core/pdfPage.ts:874](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L874)

Page height in points.

##### Returns

`number`

***

### width

#### Get Signature

```ts
get width(): number;
```

Defined in: [src/core/pdfPage.ts:869](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L869)

Page width in points.

##### Returns

`number`

## Methods

### addAltText()

```ts
addAltText(imageRef, altText): void;
```

Defined in: [src/core/pdfPage.ts:1998](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1998)

Associate alt text with an image reference on this page.

The alt text is stored and used during structure tree serialization
to create a Figure structure element with the `/Alt` attribute.

#### Parameters

##### imageRef

[`ImageRef`](../interfaces/ImageRef.md)

The image reference returned by `doc.embedPng()`
                 or `doc.embedJpeg()`.

##### altText

`string`

The alternative text describing the image.

#### Returns

`void`

***

### addAnnotation()

```ts
addAnnotation(type, options): PdfAnnotation;
```

Defined in: [src/core/pdfPage.ts:2041](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2041)

Add an annotation to this page.

#### Parameters

##### type

[`AnnotationType`](../type-aliases/AnnotationType.md)

The annotation subtype.

##### options

[`AnnotationOptions`](../interfaces/AnnotationOptions.md)

Annotation options (rect, contents, color, etc.).

#### Returns

[`PdfAnnotation`](PdfAnnotation.md)

The created PdfAnnotation.

***

### addWidgetAnnotation()

```ts
addWidgetAnnotation(widgetDict): void;
```

Defined in: [src/core/pdfPage.ts:2078](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2078)

Add a raw widget annotation dictionary to this page.

Used by form fields' `addToPage()` to register their widget
annotation without wrapping in a `PdfAnnotation` instance.

#### Parameters

##### widgetDict

[`PdfDict`](PdfDict.md)

The widget annotation dictionary.

#### Returns

`void`

***

### applySoftMask()

```ts
applySoftMask(mask): void;
```

Defined in: [src/core/pdfPage.ts:2498](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2498)

Apply a soft mask (luminosity-based) for subsequent drawing operations.

White regions in the mask are fully opaque; black regions are fully
transparent.  The mask stays active until [clearSoftMask](#clearsoftmask) is
called or the graphics state is restored.

#### Parameters

##### mask

[`SoftMaskRef`](../interfaces/SoftMaskRef.md)

A soft mask reference created by
             [PdfDocument.createSoftMask](PdfDocument.md#createsoftmask).

#### Returns

`void`

#### Example

```ts
const mask = doc.createSoftMask(200, 200, (b) => {
  b.drawRectangle(0, 0, 200, 200, 1);   // white = opaque
  b.drawCircle(100, 100, 80, 0);         // black = transparent
});
page.applySoftMask(mask);
page.drawImage(image, { x: 50, y: 50, width: 200, height: 200 });
page.clearSoftMask();
```

***

### beginLayer()

```ts
beginLayer(layer): void;
```

Defined in: [src/core/pdfPage.ts:2378](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2378)

Begin layer-specific content.

Content drawn after this call and before [endLayer](#endlayer) will be
associated with the given layer and can be shown/hidden by the
viewer.

#### Parameters

##### layer

[`PdfLayer`](PdfLayer.md)

The layer to begin.

#### Returns

`void`

***

### beginMarkedContent()

```ts
beginMarkedContent(tag, mcid): void;
```

Defined in: [src/core/pdfPage.ts:1975](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1975)

Begin a marked-content sequence in the content stream.

Must be paired with a call to [endMarkedContentSequence](#endmarkedcontentsequence).
Content added between the two calls will be associated with the
given structure element.

#### Parameters

##### tag

[`StructureType`](../type-aliases/StructureType.md)

The structure type tag.

##### mcid

`number`

The marked-content ID.

#### Returns

`void`

***

### beginTransparencyGroup()

```ts
beginTransparencyGroup(options?): void;
```

Defined in: [src/core/pdfPage.ts:2416](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2416)

Begin a transparency group.  All drawing operations until
[endTransparencyGroup](#endtransparencygroup) will be captured and composited as a
single Form XObject with a `/Group` transparency dictionary.

Transparency groups enable isolated and knockout compositing effects
that are not possible with simple opacity settings.

Groups can be nested — each call must be paired with a matching
[endTransparencyGroup](#endtransparencygroup).

#### Parameters

##### options?

[`TransparencyGroupOptions`](../interfaces/TransparencyGroupOptions.md)

Isolation, knockout, and color-space settings.

#### Returns

`void`

#### Example

```ts
page.beginTransparencyGroup({ isolated: true });
page.drawRectangle({ x: 50, y: 50, width: 100, height: 100, opacity: 0.5 });
page.drawCircle({ x: 100, y: 100, size: 60, opacity: 0.5 });
page.endTransparencyGroup();
```

***

### clearSoftMask()

```ts
clearSoftMask(): void;
```

Defined in: [src/core/pdfPage.ts:2521](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2521)

Clear the current soft mask, resetting to no masking.

This emits an ExtGState with `/SMask /None`, which removes any
previously applied soft mask for subsequent drawing operations.

#### Returns

`void`

***

### drawCircle()

```ts
drawCircle(options?): void;
```

Defined in: [src/core/pdfPage.ts:1493](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1493)

Draw a circle.

#### Parameters

##### options?

[`DrawCircleOptions`](../interfaces/DrawCircleOptions.md) = `{}`

#### Returns

`void`

***

### drawEllipse()

```ts
drawEllipse(options?): void;
```

Defined in: [src/core/pdfPage.ts:1550](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1550)

Draw an ellipse.

#### Parameters

##### options?

[`DrawEllipseOptions`](../interfaces/DrawEllipseOptions.md) = `{}`

#### Returns

`void`

***

### drawGradient()

```ts
drawGradient(gradient, rect): void;
```

Defined in: [src/core/pdfPage.ts:2308](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2308)

Draw a gradient fill (linear or radial) clipped to a rectangle.

The gradient is registered as a `/Pattern` resource on this page
and painted within the specified rectangular region.

#### Parameters

##### gradient

[`GradientFill`](../interfaces/GradientFill.md)

A gradient descriptor from [linearGradient](../functions/linearGradient.md)
                 or [radialGradient](../functions/radialGradient.md).

##### rect

The rectangle to fill.

###### height

`number`

###### width

`number`

###### x

`number`

###### y

`number`

#### Returns

`void`

***

### drawImage()

```ts
drawImage(image, options?): void;
```

Defined in: [src/core/pdfPage.ts:1232](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1232)

Draw an embedded image on this page.

#### Parameters

##### image

[`ImageRef`](../interfaces/ImageRef.md)

Image reference returned by `doc.embedPng()` or
                `doc.embedJpeg()`.

##### options?

[`DrawImageOptions`](../interfaces/DrawImageOptions.md) = `{}`

Position, dimensions, rotation.

#### Returns

`void`

***

### drawLine()

```ts
drawLine(options): void;
```

Defined in: [src/core/pdfPage.ts:1462](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1462)

Draw a straight line.

#### Parameters

##### options

[`DrawLineOptions`](../interfaces/DrawLineOptions.md)

#### Returns

`void`

***

### drawPage()

```ts
drawPage(embeddedPage, options?): void;
```

Defined in: [src/core/pdfPage.ts:1297](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1297)

Draw an embedded PDF page (Form XObject) on this page.

The embedded page is painted at the given position and scaled to the
specified dimensions.  If `width` or `height` is omitted, the
original page dimensions are used.

#### Parameters

##### embeddedPage

[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)

An embedded page returned by `doc.embedPdf()` or
                     `doc.embedPage()`.

##### options?

[`DrawPageOptions`](../interfaces/DrawPageOptions.md) = `{}`

Position, dimensions, rotation, opacity.

#### Returns

`void`

#### Example

```ts
const [embedded] = await doc.embedPdf(otherPdfBytes, [0]);
page.drawPage(embedded, { x: 50, y: 50, width: 300, height: 400 });
```

***

### drawPattern()

```ts
drawPattern(pattern, rect): void;
```

Defined in: [src/core/pdfPage.ts:2341](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2341)

Draw a tiling pattern fill clipped to a rectangle.

The pattern is registered as a `/Pattern` resource on this page
and painted within the specified rectangular region.

#### Parameters

##### pattern

[`PatternFill`](../interfaces/PatternFill.md)

A pattern descriptor from [tilingPattern](../functions/tilingPattern.md).

##### rect

The rectangle to fill.

###### height

`number`

###### width

`number`

###### x

`number`

###### y

`number`

#### Returns

`void`

***

### drawQrCode()

```ts
drawQrCode(data, options?): void;
```

Defined in: [src/core/pdfPage.ts:2242](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2242)

Draw a QR code at the specified position.

The QR code is rendered as native PDF vector graphics (filled
rectangles for each dark module), producing resolution-independent
output.

#### Parameters

##### data

`string`

The string to encode in the QR code.

##### options?

[`DrawQrCodeOptions`](../interfaces/DrawQrCodeOptions.md) = `{}`

Position, error correction level, colours, module size.

#### Returns

`void`

***

### drawRectangle()

```ts
drawRectangle(options?): void;
```

Defined in: [src/core/pdfPage.ts:1355](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1355)

Draw a rectangle.

By default the rectangle is filled with black.  Set `color` to
`undefined` and provide `borderColor` for stroke-only.

#### Parameters

##### options?

[`DrawRectangleOptions`](../interfaces/DrawRectangleOptions.md) = `{}`

#### Returns

`void`

***

### drawSquare()

```ts
drawSquare(options?): void;
```

Defined in: [src/core/pdfPage.ts:1437](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1437)

Draw a square (convenience wrapper around [drawRectangle](#drawrectangle)).

#### Parameters

##### options?

[`DrawSquareOptions`](../interfaces/DrawSquareOptions.md) = `{}`

Position, size, colours, rotation, opacity, blend mode.

#### Returns

`void`

***

### drawSvg()

```ts
drawSvg(svgString, options?): void;
```

Defined in: [src/core/pdfPage.ts:2146](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2146)

Draw an SVG image onto this page.

#### Parameters

##### svgString

`string`

The SVG markup string.

##### options?

[`SvgRenderOptions`](../interfaces/SvgRenderOptions.md)

Rendering options (position, size).

#### Returns

`void`

***

### drawSvgPath()

```ts
drawSvgPath(pathData, options?): void;
```

Defined in: [src/core/pdfPage.ts:2164](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2164)

Draw an SVG path data string onto this page.

The `pathData` parameter uses the same syntax as the SVG `<path d="...">`
attribute (M, L, C, Q, H, V, S, T, A, Z commands).

**Important:** SVG path coordinates use a top-down Y axis.  This
method applies a Y-axis flip so that the path renders correctly in
PDF's bottom-up coordinate system.  The `x` / `y` options position
the origin of the path in PDF space.

#### Parameters

##### pathData

`string`

SVG path data string (e.g. `"M 0 0 L 100 0 L 100 100 Z"`).

##### options?

[`DrawSvgPathOptions`](../interfaces/DrawSvgPathOptions.md) = `{}`

Drawing options (position, scale, colours).

#### Returns

`void`

***

### drawTable()

```ts
drawTable(options): TableRenderResult;
```

Defined in: [src/core/pdfPage.ts:2288](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2288)

Draw a table on this page.

The table is rendered as native PDF vector graphics (rectangles,
borders, and text operators).  The top-left corner of the table is
at `(options.x, options.y)` and rows extend downward.

#### Parameters

##### options

[`DrawTableOptions`](../interfaces/DrawTableOptions.md)

Table configuration: position, size, rows, columns,
                fonts, colours, borders, and padding.

#### Returns

[`TableRenderResult`](../interfaces/TableRenderResult.md)

A [TableRenderResult](../interfaces/TableRenderResult.md) with the computed
                dimensions and layout metrics.

#### Example

```ts
const result = page.drawTable({
  x: 50,
  y: 700,
  width: 500,
  rows: [
    { cells: ['Name', 'Age', 'City'] },
    { cells: ['Alice', '30', 'London'] },
    { cells: ['Bob', '25', 'Paris'] },
  ],
});
```

***

### drawText()

```ts
drawText(text, options?): void;
```

Defined in: [src/core/pdfPage.ts:1103](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1103)

Draw a text string at the specified position.

#### Parameters

##### text

`string`

The text to render.

##### options?

[`DrawTextOptions`](../interfaces/DrawTextOptions.md) = `{}`

Position, font, size, colour, rotation.

#### Returns

`void`

***

### endLayer()

```ts
endLayer(): void;
```

Defined in: [src/core/pdfPage.ts:2387](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2387)

End layer-specific content.

Must be preceded by a call to [beginLayer](#beginlayer).

#### Returns

`void`

***

### endMarkedContentSequence()

```ts
endMarkedContentSequence(): void;
```

Defined in: [src/core/pdfPage.ts:1984](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1984)

End a marked-content sequence in the content stream.

Must be preceded by a call to [beginMarkedContent](#beginmarkedcontent).

#### Returns

`void`

***

### endTransparencyGroup()

```ts
endTransparencyGroup(): void;
```

Defined in: [src/core/pdfPage.ts:2429](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2429)

End the current transparency group and composite it onto the page
as a Form XObject.

#### Returns

`void`

#### Throws

If there is no matching [beginTransparencyGroup](#begintransparencygroup).

***

### flattenAnnotations()

```ts
flattenAnnotations(): void;
```

Defined in: [src/core/pdfPage.ts:2089](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2089)

Flatten all annotations into the page content stream.

After flattening, annotations are rendered as part of the page
content and are no longer interactive.  The annotations are
removed from the page's annotation list.

#### Returns

`void`

***

### getAltText()

```ts
getAltText(imageRef): string | undefined;
```

Defined in: [src/core/pdfPage.ts:2008](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2008)

Get the alt text for an image, if set.

#### Parameters

##### imageRef

[`ImageRef`](../interfaces/ImageRef.md)

The image reference.

#### Returns

`string` \| `undefined`

The alt text, or `undefined`.

***

### getAnnotations()

```ts
getAnnotations(): PdfAnnotation[];
```

Defined in: [src/core/pdfPage.ts:2030](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2030)

Get all annotations on this page.

#### Returns

[`PdfAnnotation`](PdfAnnotation.md)[]

An array of PdfAnnotation instances.

***

### getArtBox()

```ts
getArtBox(): 
  | {
  height: number;
  width: number;
  x: number;
  y: number;
}
  | undefined;
```

Defined in: [src/core/pdfPage.ts:1834](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1834)

Get the art box if set, or undefined.

#### Returns

  \| \&#123;
  `height`: `number`;
  `width`: `number`;
  `x`: `number`;
  `y`: `number`;
\&#125;
  \| `undefined`

***

### getBleedBox()

```ts
getBleedBox(): 
  | {
  height: number;
  width: number;
  x: number;
  y: number;
}
  | undefined;
```

Defined in: [src/core/pdfPage.ts:1810](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1810)

Get the bleed box if set, or undefined.

#### Returns

  \| \&#123;
  `height`: `number`;
  `width`: `number`;
  `x`: `number`;
  `y`: `number`;
\&#125;
  \| `undefined`

***

### getContentStream()

```ts
getContentStream(): Uint8Array;
```

Defined in: [src/core/pdfPage.ts:2581](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2581)

Return this page's content stream as fully decoded bytes.

For a page parsed from a loaded PDF, the original (possibly compressed)
content stream(s) are resolved and decompressed; any operators added
afterwards (via [drawText](#drawtext), [drawImage](#drawimage), …) are appended.
Multiple content streams are joined with newline separators.

This is the public entry point for the text-extraction pipeline:

```ts
import { loadPdf, parseContentStream, extractTextWithPositions } from 'modern-pdf-lib';

const doc = await loadPdf(bytes);
const ops = parseContentStream(doc.getPage(0).getContentStream());
const items = extractTextWithPositions(ops);
```

#### Returns

`Uint8Array`

The decoded content-stream bytes (`Uint8Array`).

***

### getCropBox()

```ts
getCropBox(): 
  | {
  height: number;
  width: number;
  x: number;
  y: number;
}
  | undefined;
```

Defined in: [src/core/pdfPage.ts:1798](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1798)

Get the crop box if set, or undefined.

#### Returns

  \| \&#123;
  `height`: `number`;
  `width`: `number`;
  `x`: `number`;
  `y`: `number`;
\&#125;
  \| `undefined`

***

### getHeight()

```ts
getHeight(): number;
```

Defined in: [src/core/pdfPage.ts:1713](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1713)

Get the page height in points. Alias for the `height` getter.

#### Returns

`number`

***

### getMediaBox()

```ts
getMediaBox(): object;
```

Defined in: [src/core/pdfPage.ts:1785](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1785)

Get the media box for this page.

#### Returns

`object`

##### height

```ts
height: number;
```

##### width

```ts
width: number;
```

##### x

```ts
x: number;
```

##### y

```ts
y: number;
```

***

### getPosition()

```ts
getPosition(): object;
```

Defined in: [src/core/pdfPage.ts:964](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L964)

Get the current cursor position.

#### Returns

`object`

An object with `x` and `y` properties (in points).

##### x

```ts
x: number;
```

##### y

```ts
y: number;
```

***

### getRotation()

```ts
getRotation(): number;
```

Defined in: [src/core/pdfPage.ts:1667](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1667)

Get the current page rotation in degrees.

#### Returns

`number`

The rotation angle (0, 90, 180, or 270).

***

### getSize()

```ts
getSize(): object;
```

Defined in: [src/core/pdfPage.ts:1734](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1734)

Get the page width and height as an object.

#### Returns

`object`

##### height

```ts
height: number;
```

##### width

```ts
width: number;
```

***

### getTabOrder()

```ts
getTabOrder(): "S" | "R" | "C" | undefined;
```

Defined in: [src/core/pdfPage.ts:1687](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1687)

Get the current tab order for this page.

#### Returns

`"S"` \| `"R"` \| `"C"` \| `undefined`

`'S'` (structure), `'R'` (row), `'C'` (column), or
          `undefined` if not set.

***

### getTrimBox()

```ts
getTrimBox(): 
  | {
  height: number;
  width: number;
  x: number;
  y: number;
}
  | undefined;
```

Defined in: [src/core/pdfPage.ts:1822](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1822)

Get the trim box if set, or undefined.

#### Returns

  \| \&#123;
  `height`: `number`;
  `width`: `number`;
  `x`: `number`;
  `y`: `number`;
\&#125;
  \| `undefined`

***

### getWidth()

```ts
getWidth(): number;
```

Defined in: [src/core/pdfPage.ts:1708](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1708)

Get the page width in points. Alias for the `width` getter.

#### Returns

`number`

***

### getX()

```ts
getX(): number;
```

Defined in: [src/core/pdfPage.ts:973](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L973)

Get the current cursor X coordinate.

#### Returns

`number`

The X coordinate in points.

***

### getY()

```ts
getY(): number;
```

Defined in: [src/core/pdfPage.ts:982](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L982)

Get the current cursor Y coordinate.

#### Returns

`number`

The Y coordinate in points.

***

### markContent()

```ts
markContent(tag, mcid): void;
```

Defined in: [src/core/pdfPage.ts:1960](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1960)

Wrap the current content-stream operators in a marked-content
sequence.

This wraps ALL currently accumulated content in a BDC/EMC pair
with the given structure tag and marked-content ID (MCID).  The
MCID links the content to a structure element in the document's
structure tree.

Call this after adding content to the page and before adding
more content that belongs to a different structure element.

#### Parameters

##### tag

[`StructureType`](../type-aliases/StructureType.md)

The structure type tag (e.g. `"P"`, `"H1"`, `"Span"`).

##### mcid

`number`

The marked-content ID assigned by the structure tree.

#### Returns

`void`

***

### markForRedaction()

```ts
markForRedaction(rect, options?): void;
```

Defined in: [src/core/pdfPage.ts:2546](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2546)

Mark a rectangular region on this page for redaction.

The mark is stored but not applied until `doc.applyRedactions()`
is called.

#### Parameters

##### rect

\[`number`, `number`, `number`, `number`\]

The region to redact: [x, y, width, height].

##### options?

`Partial`\&lt;[`RedactionOptions`](../interfaces/RedactionOptions.md)\&gt;

Additional redaction options (overlay text, colour).

#### Returns

`void`

***

### moveDown()

```ts
moveDown(amount): void;
```

Defined in: [src/core/pdfPage.ts:1014](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1014)

Move the cursor downward by the given amount (decreases Y).

#### Parameters

##### amount

`number`

Distance in points.

#### Returns

`void`

***

### moveLeft()

```ts
moveLeft(amount): void;
```

Defined in: [src/core/pdfPage.ts:1032](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1032)

Move the cursor to the left by the given amount (decreases X).

#### Parameters

##### amount

`number`

Distance in points.

#### Returns

`void`

***

### moveRight()

```ts
moveRight(amount): void;
```

Defined in: [src/core/pdfPage.ts:1023](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1023)

Move the cursor to the right by the given amount (increases X).

#### Parameters

##### amount

`number`

Distance in points.

#### Returns

`void`

***

### moveTo()

```ts
moveTo(x, y): void;
```

Defined in: [src/core/pdfPage.ts:995](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L995)

Move the cursor to an absolute position.

Drawing methods that accept optional `x` / `y` parameters will use the
cursor position as a fallback when those parameters are omitted.

#### Parameters

##### x

`number`

The X coordinate in points.

##### y

`number`

The Y coordinate in points.

#### Returns

`void`

***

### moveUp()

```ts
moveUp(amount): void;
```

Defined in: [src/core/pdfPage.ts:1005](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1005)

Move the cursor upward by the given amount (increases Y).

#### Parameters

##### amount

`number`

Distance in points.

#### Returns

`void`

***

### popGraphicsState()

```ts
popGraphicsState(): void;
```

Defined in: [src/core/pdfPage.ts:1621](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1621)

Pop the most recently saved graphics state (`Q`).

#### Returns

`void`

***

### pushGraphicsState()

```ts
pushGraphicsState(): void;
```

Defined in: [src/core/pdfPage.ts:1614](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1614)

Push the current graphics state onto the stack (`q`).

Must be balanced with a matching [popGraphicsState](#popgraphicsstate) call.

#### Returns

`void`

***

### pushOperators()

```ts
pushOperators(operators): void;
```

Defined in: [src/core/pdfPage.ts:1655](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1655)

Append raw PDF operator string(s) to the content stream.

Use with caution — no validation is performed.

#### Parameters

##### operators

`string`

#### Returns

`void`

***

### removeAnnotation()

```ts
removeAnnotation(annotation): void;
```

Defined in: [src/core/pdfPage.ts:2062](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L2062)

Remove an annotation from this page.

#### Parameters

##### annotation

[`PdfAnnotation`](PdfAnnotation.md)

The annotation to remove.

#### Returns

`void`

***

### removeArtBox()

```ts
removeArtBox(): void;
```

Defined in: [src/core/pdfPage.ts:1865](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1865)

Remove the art box from this page (it will default to the crop box).

#### Returns

`void`

***

### removeBleedBox()

```ts
removeBleedBox(): void;
```

Defined in: [src/core/pdfPage.ts:1855](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1855)

Remove the bleed box from this page (it will default to the crop box).

#### Returns

`void`

***

### removeCropBox()

```ts
removeCropBox(): void;
```

Defined in: [src/core/pdfPage.ts:1850](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1850)

Remove the crop box from this page (it will default to the media box).

#### Returns

`void`

***

### removeTrimBox()

```ts
removeTrimBox(): void;
```

Defined in: [src/core/pdfPage.ts:1860](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1860)

Remove the trim box from this page (it will default to the crop box).

#### Returns

`void`

***

### resetPosition()

```ts
resetPosition(): void;
```

Defined in: [src/core/pdfPage.ts:1039](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1039)

Reset the cursor position to `(0, 0)`.

#### Returns

`void`

***

### resetSize()

```ts
resetSize(): void;
```

Defined in: [src/core/pdfPage.ts:1743](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1743)

Reset page dimensions to their original values from creation time.

#### Returns

`void`

***

### scale()

```ts
scale(xFactor, yFactor): void;
```

Defined in: [src/core/pdfPage.ts:1774](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1774)

Scale page dimensions, content, and annotations together.

#### Parameters

##### xFactor

`number`

##### yFactor

`number`

#### Returns

`void`

***

### scaleAnnotations()

```ts
scaleAnnotations(xFactor, yFactor): void;
```

Defined in: [src/core/pdfPage.ts:1759](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1759)

Scale annotation rectangles by the given factors.

#### Parameters

##### xFactor

`number`

##### yFactor

`number`

#### Returns

`void`

***

### scaleContent()

```ts
scaleContent(xFactor, yFactor): void;
```

Defined in: [src/core/pdfPage.ts:1754](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1754)

Scale page content by the given factors. Prepends a cm operator.

#### Parameters

##### xFactor

`number`

##### yFactor

`number`

#### Returns

`void`

***

### setArtBox()

```ts
setArtBox(
   x, 
   y, 
   width, 
   height): void;
```

Defined in: [src/core/pdfPage.ts:1841](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1841)

Set the art box for this page.

#### Parameters

##### x

`number`

##### y

`number`

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### setBleedBox()

```ts
setBleedBox(
   x, 
   y, 
   width, 
   height): void;
```

Defined in: [src/core/pdfPage.ts:1817](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1817)

Set the bleed box for this page.

#### Parameters

##### x

`number`

##### y

`number`

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### setCropBox()

```ts
setCropBox(
   x, 
   y, 
   width, 
   height): void;
```

Defined in: [src/core/pdfPage.ts:1805](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1805)

Set the crop box for this page.

#### Parameters

##### x

`number`

##### y

`number`

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### setFont()

```ts
setFont(font): void;
```

Defined in: [src/core/pdfPage.ts:921](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L921)

Set the default font used by [drawText](#drawtext) when the `font` option
is not provided.

#### Parameters

##### font

[`FontRef`](../interfaces/FontRef.md)

A [FontRef](../interfaces/FontRef.md) returned by `doc.embedFont()`.

#### Returns

`void`

***

### setFontColor()

```ts
setFontColor(color): void;
```

Defined in: [src/core/pdfPage.ts:941](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L941)

Set the default font colour used by [drawText](#drawtext) when the `color`
option is not provided.

#### Parameters

##### color

[`Color`](../type-aliases/Color.md)

A [Color](../type-aliases/Color.md) value (e.g. from `rgb()`, `cmyk()`, etc.).

#### Returns

`void`

***

### setFontSize()

```ts
setFontSize(size): void;
```

Defined in: [src/core/pdfPage.ts:931](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L931)

Set the default font size (in points) used by [drawText](#drawtext) when
the `size` option is not provided.

#### Parameters

##### size

`number`

Font size in points.

#### Returns

`void`

***

### setHeight()

```ts
setHeight(h): void;
```

Defined in: [src/core/pdfPage.ts:1723](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1723)

Set the page height in points.

#### Parameters

##### h

`number`

#### Returns

`void`

***

### setLineHeight()

```ts
setLineHeight(height): void;
```

Defined in: [src/core/pdfPage.ts:951](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L951)

Set the default line height used by [drawText](#drawtext) when the
`lineHeight` option is not provided.

#### Parameters

##### height

`number`

Line height in points.

#### Returns

`void`

***

### setMediaBox()

```ts
setMediaBox(
   x, 
   y, 
   width, 
   height): void;
```

Defined in: [src/core/pdfPage.ts:1790](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1790)

Set the media box (page dimensions) for this page.

#### Parameters

##### x

`number`

##### y

`number`

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### setSize()

```ts
setSize(w, h): void;
```

Defined in: [src/core/pdfPage.ts:1728](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1728)

Set both page width and height in points.

#### Parameters

##### w

`number`

##### h

`number`

#### Returns

`void`

***

### setTabOrder()

```ts
setTabOrder(order): void;
```

Defined in: [src/core/pdfPage.ts:1699](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1699)

Set the tab order for this page.

PDF/UA requires `'S'` (structure order) so that assistive technology
follows the logical structure tree.

#### Parameters

##### order

`"S"` \| `"R"` \| `"C"`

`'S'` (structure), `'R'` (row), or `'C'` (column).

#### Returns

`void`

***

### setTransform()

```ts
setTransform(
   a, 
   b, 
   c, 
   d, 
   tx, 
   ty): void;
```

Defined in: [src/core/pdfPage.ts:1635](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1635)

Concatenate an arbitrary transformation matrix with the CTM (`cm`).

#### Parameters

##### a

`number`

Horizontal scaling / rotation.

##### b

`number`

Rotation / skew.

##### c

`number`

Rotation / skew.

##### d

`number`

Vertical scaling / rotation.

##### tx

`number`

Horizontal translation.

##### ty

`number`

Vertical translation.

#### Returns

`void`

***

### setTrimBox()

```ts
setTrimBox(
   x, 
   y, 
   width, 
   height): void;
```

Defined in: [src/core/pdfPage.ts:1829](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1829)

Set the trim box for this page.

#### Parameters

##### x

`number`

##### y

`number`

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### setWidth()

```ts
setWidth(w): void;
```

Defined in: [src/core/pdfPage.ts:1718](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1718)

Set the page width in points.

#### Parameters

##### w

`number`

#### Returns

`void`

***

### translateContent()

```ts
translateContent(x, y): void;
```

Defined in: [src/core/pdfPage.ts:1749](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1749)

Translate all page content by (x, y) points. Prepends a cm operator.

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`void`

***

### validateBoxes()

```ts
validateBoxes(): object;
```

Defined in: [src/core/pdfPage.ts:1884](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L1884)

Validate that page boxes conform to the PDF specification nesting rules.

PDF spec §14.11.2 requirements:
- MediaBox is required on every page.
- CropBox defaults to MediaBox.
- BleedBox, TrimBox, and ArtBox default to CropBox.
- All boxes must be within or equal to the MediaBox.

#### Returns

`object`

An object with `valid` (boolean) and `issues` (string array).

##### issues

```ts
issues: string[];
```

##### valid

```ts
valid: boolean;
```
