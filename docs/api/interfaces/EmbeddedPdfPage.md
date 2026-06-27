[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbeddedPdfPage

# Interface: EmbeddedPdfPage

Defined in: [src/core/pdfEmbed.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L44)

Handle for a page that has been embedded as a Form XObject.

Returned by `PdfDocument.embedPdf()` and `PdfDocument.embedPage()`.
Pass it to `PdfPage.drawPage()` to paint the embedded page.

## Properties

### height

```ts
readonly height: number;
```

Defined in: [src/core/pdfEmbed.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L52)

Original page height in points.

***

### name

```ts
readonly name: string;
```

Defined in: [src/core/pdfEmbed.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L46)

XObject resource name (e.g. `'XF1'`).

***

### ref

```ts
readonly ref: PdfRef;
```

Defined in: [src/core/pdfEmbed.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L48)

Indirect reference to the Form XObject in the target registry.

***

### width

```ts
readonly width: number;
```

Defined in: [src/core/pdfEmbed.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L50)

Original page width in points.

## Methods

### scale()

```ts
scale(factor): object;
```

Defined in: [src/core/pdfEmbed.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L59)

Return the dimensions after applying a uniform scale factor.

#### Parameters

##### factor

`number`

Scale factor (e.g. `0.5` for half size).

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

### scaleToFit()

```ts
scaleToFit(maxW, maxH): object;
```

Defined in: [src/core/pdfEmbed.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L68)

Compute dimensions that fit within the given maximum size while
preserving the original aspect ratio.

#### Parameters

##### maxW

`number`

Maximum width.

##### maxH

`number`

Maximum height.

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
