[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawTextOptions

# Interface: DrawTextOptions

Defined in: [src/core/pdfPage.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L170)

Options for [PdfPage.drawText](../classes/PdfPage.md#drawtext).

## Properties

### blendMode?

```ts
optional blendMode?: BlendMode;
```

Defined in: [src/core/pdfPage.ts:196](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L196)

Blend mode for compositing.

***

### color?

```ts
optional color?: Color;
```

Defined in: [src/core/pdfPage.ts:188](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L188)

Text colour.  Defaults to black.

***

### font?

```ts
optional font?: string | FontRef;
```

Defined in: [src/core/pdfPage.ts:184](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L184)

Font to use for rendering.

Accepts either a [FontRef](FontRef.md) object (returned by `doc.embedFont()`)
or a font resource name string (e.g. `'F1'`).

When a `FontRef` is provided, its `name` property is used as the
resource name and its CID encoder (if any) is used automatically.

***

### lineHeight?

```ts
optional lineHeight?: number;
```

Defined in: [src/core/pdfPage.ts:192](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L192)

Line height for multi-line text.

***

### maxWidth?

```ts
optional maxWidth?: number;
```

Defined in: [src/core/pdfPage.ts:213](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L213)

Maximum width in points before text is automatically wrapped.

When provided with a [FontRef](FontRef.md) font (which has `widthOfTextAtSize`),
the text is broken at word boundaries to fit within this width.
If a single word exceeds `maxWidth`, it is broken at character level.

When the font is a plain string (no measurement available), this
option is ignored.

***

### opacity?

```ts
optional opacity?: number;
```

Defined in: [src/core/pdfPage.ts:194](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L194)

Opacity `[0, 1]`.

***

### renderingMode?

```ts
optional renderingMode?: TextRenderingMode;
```

Defined in: [src/core/pdfPage.ts:198](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L198)

Text rendering mode (fill, stroke, invisible, clip, etc.).

***

### rotate?

```ts
optional rotate?: Angle;
```

Defined in: [src/core/pdfPage.ts:190](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L190)

Rotation angle.

***

### size?

```ts
optional size?: number;
```

Defined in: [src/core/pdfPage.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L186)

Font size in points.

***

### wordBreaks?

```ts
optional wordBreaks?: string[];
```

Defined in: [src/core/pdfPage.ts:224](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L224)

Characters at which text may be broken when wrapping.

Defaults to `[' ']` (space only).  Pass additional characters such as
`[' ', '-', '/']` to allow breaks at hyphens, slashes, etc.

The break character is kept at the **end** of the preceding line
(e.g. `'hello-'` / `'world'`), except for space which is consumed
as in the default behaviour.

***

### x?

```ts
optional x?: number;
```

Defined in: [src/core/pdfPage.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L172)

X coordinate.

***

### xSkew?

```ts
optional xSkew?: Angle;
```

Defined in: [src/core/pdfPage.ts:200](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L200)

Horizontal skew angle (italic-like effect).

***

### y?

```ts
optional y?: number;
```

Defined in: [src/core/pdfPage.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L174)

Y coordinate.

***

### ySkew?

```ts
optional ySkew?: Angle;
```

Defined in: [src/core/pdfPage.ts:202](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L202)

Vertical skew angle.
