[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawRectangleOptions

# Interface: DrawRectangleOptions

Defined in: [src/core/pdfPage.ts:250](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L250)

Options for [PdfPage.drawRectangle](../classes/PdfPage.md#drawrectangle).

## Properties

### blendMode?

```ts
optional blendMode?: BlendMode;
```

Defined in: [src/core/pdfPage.ts:270](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L270)

Blend mode for compositing.

***

### borderColor?

```ts
optional borderColor?: Color;
```

Defined in: [src/core/pdfPage.ts:262](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L262)

Border (stroke) colour.  Set to `undefined` for no stroke.

***

### borderDashArray?

```ts
optional borderDashArray?: number[];
```

Defined in: [src/core/pdfPage.ts:276](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L276)

Dash pattern for border `[dashLen, gapLen, ...]`.

***

### borderDashPhase?

```ts
optional borderDashPhase?: number;
```

Defined in: [src/core/pdfPage.ts:278](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L278)

Dash phase offset for border.

***

### borderLineCap?

```ts
optional borderLineCap?: 0 | 1 | 2;
```

Defined in: [src/core/pdfPage.ts:280](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L280)

Line cap style for border (0 = butt, 1 = round, 2 = projecting square).

***

### borderOpacity?

```ts
optional borderOpacity?: number;
```

Defined in: [src/core/pdfPage.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L282)

Border stroke opacity `[0, 1]`, separate from fill opacity.

***

### borderWidth?

```ts
optional borderWidth?: number;
```

Defined in: [src/core/pdfPage.ts:264](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L264)

Border width in points.

***

### color?

```ts
optional color?: Color;
```

Defined in: [src/core/pdfPage.ts:260](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L260)

Fill colour.  Set to `undefined` for no fill.

***

### height?

```ts
optional height?: number;
```

Defined in: [src/core/pdfPage.ts:258](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L258)

Rectangle height.

***

### opacity?

```ts
optional opacity?: number;
```

Defined in: [src/core/pdfPage.ts:268](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L268)

Opacity `[0, 1]`.

***

### rotate?

```ts
optional rotate?: Angle;
```

Defined in: [src/core/pdfPage.ts:266](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L266)

Rotation angle.

***

### width?

```ts
optional width?: number;
```

Defined in: [src/core/pdfPage.ts:256](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L256)

Rectangle width.

***

### x?

```ts
optional x?: number;
```

Defined in: [src/core/pdfPage.ts:252](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L252)

X coordinate.

***

### xSkew?

```ts
optional xSkew?: Angle;
```

Defined in: [src/core/pdfPage.ts:272](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L272)

Horizontal skew angle.

***

### y?

```ts
optional y?: number;
```

Defined in: [src/core/pdfPage.ts:254](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L254)

Y coordinate.

***

### ySkew?

```ts
optional ySkew?: Angle;
```

Defined in: [src/core/pdfPage.ts:274](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L274)

Vertical skew angle.
