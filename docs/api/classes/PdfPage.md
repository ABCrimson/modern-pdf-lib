[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfPage

# Class: PdfPage

Defined in: [src/core/pdfPage.ts:610](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L610)

A single page in a PDF document.

Drawing methods are synchronous and append PDF operators to an
internal string buffer.  The buffer is converted to a content stream
when the document is saved.

## Constructors

### Constructor

> **new PdfPage**(`w`, `h`, `registry`): `PdfPage`

Defined in: [src/core/pdfPage.ts:773](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L773)

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

> `readonly` **contentStreamRef**: [`PdfRef`](PdfRef.md)

Defined in: [src/core/pdfPage.ts:697](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L697)

Pre-allocated indirect reference for this page's content stream.

***

### pageRef

> `readonly` **pageRef**: [`PdfRef`](PdfRef.md)

Defined in: [src/core/pdfPage.ts:694](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L694)

Pre-allocated indirect reference for this page's /Page dictionary.

## Accessors

### height

#### Get Signature

> **get** **height**(): `number`

Defined in: [src/core/pdfPage.ts:831](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L831)

Page height in points.

##### Returns

`number`

***

### width

#### Get Signature

> **get** **width**(): `number`

Defined in: [src/core/pdfPage.ts:826](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L826)

Page width in points.

##### Returns

`number`

## Methods

### addAltText()

> **addAltText**(`imageRef`, `altText`): `void`

Defined in: [src/core/pdfPage.ts:1847](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1847)

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

> **addAnnotation**(`type`, `options`): [`PdfAnnotation`](PdfAnnotation.md)

Defined in: [src/core/pdfPage.ts:1890](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1890)

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

> **addWidgetAnnotation**(`widgetDict`): `void`

Defined in: [src/core/pdfPage.ts:1927](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1927)

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

> **applySoftMask**(`mask`): `void`

Defined in: [src/core/pdfPage.ts:2347](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2347)

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

> **beginLayer**(`layer`): `void`

Defined in: [src/core/pdfPage.ts:2227](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2227)

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

> **beginMarkedContent**(`tag`, `mcid`): `void`

Defined in: [src/core/pdfPage.ts:1824](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1824)

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

> **beginTransparencyGroup**(`options?`): `void`

Defined in: [src/core/pdfPage.ts:2265](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2265)

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

> **clearSoftMask**(): `void`

Defined in: [src/core/pdfPage.ts:2370](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2370)

Clear the current soft mask, resetting to no masking.

This emits an ExtGState with `/SMask /None`, which removes any
previously applied soft mask for subsequent drawing operations.

#### Returns

`void`

***

### drawCircle()

> **drawCircle**(`options?`): `void`

Defined in: [src/core/pdfPage.ts:1453](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1453)

Draw a circle.

#### Parameters

##### options?

[`DrawCircleOptions`](../interfaces/DrawCircleOptions.md) = `{}`

#### Returns

`void`

***

### drawEllipse()

> **drawEllipse**(`options?`): `void`

Defined in: [src/core/pdfPage.ts:1510](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1510)

Draw an ellipse.

#### Parameters

##### options?

[`DrawEllipseOptions`](../interfaces/DrawEllipseOptions.md) = `{}`

#### Returns

`void`

***

### drawGradient()

> **drawGradient**(`gradient`, `rect`): `void`

Defined in: [src/core/pdfPage.ts:2157](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2157)

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

> **drawImage**(`image`, `options?`): `void`

Defined in: [src/core/pdfPage.ts:1192](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1192)

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

> **drawLine**(`options`): `void`

Defined in: [src/core/pdfPage.ts:1422](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1422)

Draw a straight line.

#### Parameters

##### options

[`DrawLineOptions`](../interfaces/DrawLineOptions.md)

#### Returns

`void`

***

### drawPage()

> **drawPage**(`embeddedPage`, `options?`): `void`

Defined in: [src/core/pdfPage.ts:1257](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1257)

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

> **drawPattern**(`pattern`, `rect`): `void`

Defined in: [src/core/pdfPage.ts:2190](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2190)

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

> **drawQrCode**(`data`, `options?`): `void`

Defined in: [src/core/pdfPage.ts:2091](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2091)

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

> **drawRectangle**(`options?`): `void`

Defined in: [src/core/pdfPage.ts:1315](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1315)

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

> **drawSquare**(`options?`): `void`

Defined in: [src/core/pdfPage.ts:1397](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1397)

Draw a square (convenience wrapper around [drawRectangle](#drawrectangle)).

#### Parameters

##### options?

[`DrawSquareOptions`](../interfaces/DrawSquareOptions.md) = `{}`

Position, size, colours, rotation, opacity, blend mode.

#### Returns

`void`

***

### drawSvg()

> **drawSvg**(`svgString`, `options?`): `void`

Defined in: [src/core/pdfPage.ts:1995](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1995)

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

> **drawSvgPath**(`pathData`, `options?`): `void`

Defined in: [src/core/pdfPage.ts:2013](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2013)

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

> **drawTable**(`options`): [`TableRenderResult`](../interfaces/TableRenderResult.md)

Defined in: [src/core/pdfPage.ts:2137](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2137)

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

> **drawText**(`text`, `options?`): `void`

Defined in: [src/core/pdfPage.ts:1060](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1060)

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

> **endLayer**(): `void`

Defined in: [src/core/pdfPage.ts:2236](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2236)

End layer-specific content.

Must be preceded by a call to [beginLayer](#beginlayer).

#### Returns

`void`

***

### endMarkedContentSequence()

> **endMarkedContentSequence**(): `void`

Defined in: [src/core/pdfPage.ts:1833](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1833)

End a marked-content sequence in the content stream.

Must be preceded by a call to [beginMarkedContent](#beginmarkedcontent).

#### Returns

`void`

***

### endTransparencyGroup()

> **endTransparencyGroup**(): `void`

Defined in: [src/core/pdfPage.ts:2278](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2278)

End the current transparency group and composite it onto the page
as a Form XObject.

#### Returns

`void`

#### Throws

If there is no matching [beginTransparencyGroup](#begintransparencygroup).

***

### flattenAnnotations()

> **flattenAnnotations**(): `void`

Defined in: [src/core/pdfPage.ts:1938](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1938)

Flatten all annotations into the page content stream.

After flattening, annotations are rendered as part of the page
content and are no longer interactive.  The annotations are
removed from the page's annotation list.

#### Returns

`void`

***

### getAltText()

> **getAltText**(`imageRef`): `string` \| `undefined`

Defined in: [src/core/pdfPage.ts:1857](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1857)

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

> **getAnnotations**(): [`PdfAnnotation`](PdfAnnotation.md)[]

Defined in: [src/core/pdfPage.ts:1879](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1879)

Get all annotations on this page.

#### Returns

[`PdfAnnotation`](PdfAnnotation.md)[]

An array of PdfAnnotation instances.

***

### getArtBox()

> **getArtBox**(): \{ `height`: `number`; `width`: `number`; `x`: `number`; `y`: `number`; \} \| `undefined`

Defined in: [src/core/pdfPage.ts:1772](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1772)

Get the art box if set, or undefined.

#### Returns

\{ `height`: `number`; `width`: `number`; `x`: `number`; `y`: `number`; \} \| `undefined`

***

### getBleedBox()

> **getBleedBox**(): \{ `height`: `number`; `width`: `number`; `x`: `number`; `y`: `number`; \} \| `undefined`

Defined in: [src/core/pdfPage.ts:1748](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1748)

Get the bleed box if set, or undefined.

#### Returns

\{ `height`: `number`; `width`: `number`; `x`: `number`; `y`: `number`; \} \| `undefined`

***

### getCropBox()

> **getCropBox**(): \{ `height`: `number`; `width`: `number`; `x`: `number`; `y`: `number`; \} \| `undefined`

Defined in: [src/core/pdfPage.ts:1736](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1736)

Get the crop box if set, or undefined.

#### Returns

\{ `height`: `number`; `width`: `number`; `x`: `number`; `y`: `number`; \} \| `undefined`

***

### getHeight()

> **getHeight**(): `number`

Defined in: [src/core/pdfPage.ts:1651](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1651)

Get the page height in points. Alias for the `height` getter.

#### Returns

`number`

***

### getMediaBox()

> **getMediaBox**(): `object`

Defined in: [src/core/pdfPage.ts:1723](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1723)

Get the media box for this page.

#### Returns

`object`

##### height

> **height**: `number`

##### width

> **width**: `number`

##### x

> **x**: `number`

##### y

> **y**: `number`

***

### getPosition()

> **getPosition**(): `object`

Defined in: [src/core/pdfPage.ts:921](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L921)

Get the current cursor position.

#### Returns

`object`

An object with `x` and `y` properties (in points).

##### x

> **x**: `number`

##### y

> **y**: `number`

***

### getRotation()

> **getRotation**(): `number`

Defined in: [src/core/pdfPage.ts:1627](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1627)

Get the current page rotation in degrees.

#### Returns

`number`

The rotation angle (0, 90, 180, or 270).

***

### getSize()

> **getSize**(): `object`

Defined in: [src/core/pdfPage.ts:1672](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1672)

Get the page width and height as an object.

#### Returns

`object`

##### height

> **height**: `number`

##### width

> **width**: `number`

***

### getTrimBox()

> **getTrimBox**(): \{ `height`: `number`; `width`: `number`; `x`: `number`; `y`: `number`; \} \| `undefined`

Defined in: [src/core/pdfPage.ts:1760](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1760)

Get the trim box if set, or undefined.

#### Returns

\{ `height`: `number`; `width`: `number`; `x`: `number`; `y`: `number`; \} \| `undefined`

***

### getWidth()

> **getWidth**(): `number`

Defined in: [src/core/pdfPage.ts:1646](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1646)

Get the page width in points. Alias for the `width` getter.

#### Returns

`number`

***

### getX()

> **getX**(): `number`

Defined in: [src/core/pdfPage.ts:930](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L930)

Get the current cursor X coordinate.

#### Returns

`number`

The X coordinate in points.

***

### getY()

> **getY**(): `number`

Defined in: [src/core/pdfPage.ts:939](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L939)

Get the current cursor Y coordinate.

#### Returns

`number`

The Y coordinate in points.

***

### markContent()

> **markContent**(`tag`, `mcid`): `void`

Defined in: [src/core/pdfPage.ts:1809](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1809)

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

> **markForRedaction**(`rect`, `options?`): `void`

Defined in: [src/core/pdfPage.ts:2395](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L2395)

Mark a rectangular region on this page for redaction.

The mark is stored but not applied until `doc.applyRedactions()`
is called.

#### Parameters

##### rect

\[`number`, `number`, `number`, `number`\]

The region to redact: [x, y, width, height].

##### options?

`Partial`\<[`RedactionOptions`](../interfaces/RedactionOptions.md)\>

Additional redaction options (overlay text, colour).

#### Returns

`void`

***

### moveDown()

> **moveDown**(`amount`): `void`

Defined in: [src/core/pdfPage.ts:971](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L971)

Move the cursor downward by the given amount (decreases Y).

#### Parameters

##### amount

`number`

Distance in points.

#### Returns

`void`

***

### moveLeft()

> **moveLeft**(`amount`): `void`

Defined in: [src/core/pdfPage.ts:989](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L989)

Move the cursor to the left by the given amount (decreases X).

#### Parameters

##### amount

`number`

Distance in points.

#### Returns

`void`

***

### moveRight()

> **moveRight**(`amount`): `void`

Defined in: [src/core/pdfPage.ts:980](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L980)

Move the cursor to the right by the given amount (increases X).

#### Parameters

##### amount

`number`

Distance in points.

#### Returns

`void`

***

### moveTo()

> **moveTo**(`x`, `y`): `void`

Defined in: [src/core/pdfPage.ts:952](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L952)

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

> **moveUp**(`amount`): `void`

Defined in: [src/core/pdfPage.ts:962](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L962)

Move the cursor upward by the given amount (increases Y).

#### Parameters

##### amount

`number`

Distance in points.

#### Returns

`void`

***

### popGraphicsState()

> **popGraphicsState**(): `void`

Defined in: [src/core/pdfPage.ts:1581](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1581)

Pop the most recently saved graphics state (`Q`).

#### Returns

`void`

***

### pushGraphicsState()

> **pushGraphicsState**(): `void`

Defined in: [src/core/pdfPage.ts:1574](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1574)

Push the current graphics state onto the stack (`q`).

Must be balanced with a matching [popGraphicsState](#popgraphicsstate) call.

#### Returns

`void`

***

### pushOperators()

> **pushOperators**(`operators`): `void`

Defined in: [src/core/pdfPage.ts:1615](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1615)

Append raw PDF operator string(s) to the content stream.

Use with caution — no validation is performed.

#### Parameters

##### operators

`string`

#### Returns

`void`

***

### removeAnnotation()

> **removeAnnotation**(`annotation`): `void`

Defined in: [src/core/pdfPage.ts:1911](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1911)

Remove an annotation from this page.

#### Parameters

##### annotation

[`PdfAnnotation`](PdfAnnotation.md)

The annotation to remove.

#### Returns

`void`

***

### resetPosition()

> **resetPosition**(): `void`

Defined in: [src/core/pdfPage.ts:996](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L996)

Reset the cursor position to `(0, 0)`.

#### Returns

`void`

***

### resetSize()

> **resetSize**(): `void`

Defined in: [src/core/pdfPage.ts:1681](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1681)

Reset page dimensions to their original values from creation time.

#### Returns

`void`

***

### scale()

> **scale**(`xFactor`, `yFactor`): `void`

Defined in: [src/core/pdfPage.ts:1712](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1712)

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

> **scaleAnnotations**(`xFactor`, `yFactor`): `void`

Defined in: [src/core/pdfPage.ts:1697](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1697)

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

> **scaleContent**(`xFactor`, `yFactor`): `void`

Defined in: [src/core/pdfPage.ts:1692](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1692)

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

> **setArtBox**(`x`, `y`, `width`, `height`): `void`

Defined in: [src/core/pdfPage.ts:1779](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1779)

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

> **setBleedBox**(`x`, `y`, `width`, `height`): `void`

Defined in: [src/core/pdfPage.ts:1755](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1755)

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

> **setCropBox**(`x`, `y`, `width`, `height`): `void`

Defined in: [src/core/pdfPage.ts:1743](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1743)

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

> **setFont**(`font`): `void`

Defined in: [src/core/pdfPage.ts:878](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L878)

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

> **setFontColor**(`color`): `void`

Defined in: [src/core/pdfPage.ts:898](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L898)

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

> **setFontSize**(`size`): `void`

Defined in: [src/core/pdfPage.ts:888](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L888)

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

> **setHeight**(`h`): `void`

Defined in: [src/core/pdfPage.ts:1661](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1661)

Set the page height in points.

#### Parameters

##### h

`number`

#### Returns

`void`

***

### setLineHeight()

> **setLineHeight**(`height`): `void`

Defined in: [src/core/pdfPage.ts:908](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L908)

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

> **setMediaBox**(`x`, `y`, `width`, `height`): `void`

Defined in: [src/core/pdfPage.ts:1728](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1728)

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

> **setSize**(`w`, `h`): `void`

Defined in: [src/core/pdfPage.ts:1666](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1666)

Set both page width and height in points.

#### Parameters

##### w

`number`

##### h

`number`

#### Returns

`void`

***

### setTransform()

> **setTransform**(`a`, `b`, `c`, `d`, `tx`, `ty`): `void`

Defined in: [src/core/pdfPage.ts:1595](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1595)

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

> **setTrimBox**(`x`, `y`, `width`, `height`): `void`

Defined in: [src/core/pdfPage.ts:1767](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1767)

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

> **setWidth**(`w`): `void`

Defined in: [src/core/pdfPage.ts:1656](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1656)

Set the page width in points.

#### Parameters

##### w

`number`

#### Returns

`void`

***

### translateContent()

> **translateContent**(`x`, `y`): `void`

Defined in: [src/core/pdfPage.ts:1687](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L1687)

Translate all page content by (x, y) points. Prepends a cm operator.

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`void`
