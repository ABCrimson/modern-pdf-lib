[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawLineOptions

# Interface: DrawLineOptions

Defined in: [src/core/pdfPage.ts:286](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L286)

Options for [PdfPage.drawLine](../classes/PdfPage.md#drawline).

## Properties

### blendMode?

```ts
optional blendMode?: BlendMode;
```

Defined in: [src/core/pdfPage.ts:302](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L302)

Blend mode for compositing.

***

### color?

```ts
optional color?: Color;
```

Defined in: [src/core/pdfPage.ts:292](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L292)

Line colour.

***

### dashArray?

```ts
optional dashArray?: number[];
```

Defined in: [src/core/pdfPage.ts:296](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L296)

Dash pattern `[dashLength, gapLength]`.

***

### dashPhase?

```ts
optional dashPhase?: number;
```

Defined in: [src/core/pdfPage.ts:298](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L298)

Dash phase.

***

### end

```ts
end: Point;
```

Defined in: [src/core/pdfPage.ts:290](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L290)

End point.

***

### opacity?

```ts
optional opacity?: number;
```

Defined in: [src/core/pdfPage.ts:300](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L300)

Opacity `[0, 1]`.

***

### start

```ts
start: Point;
```

Defined in: [src/core/pdfPage.ts:288](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L288)

Start point.

***

### thickness?

```ts
optional thickness?: number;
```

Defined in: [src/core/pdfPage.ts:294](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L294)

Line width.
