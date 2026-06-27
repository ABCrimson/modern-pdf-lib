[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageRef

# Interface: ImageRef

Defined in: [src/core/pdfPage.ts:538](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L538)

Opaque handle for an image that has been embedded in the document.

## Properties

### height

```ts
readonly height: number;
```

Defined in: [src/core/pdfPage.ts:546](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L546)

Intrinsic height in pixels.

***

### name

```ts
readonly name: string;
```

Defined in: [src/core/pdfPage.ts:540](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L540)

Resource name used in content-stream operators (e.g. `Im1`).

***

### ref

```ts
readonly ref: PdfRef;
```

Defined in: [src/core/pdfPage.ts:542](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L542)

Indirect reference to the image XObject.

***

### width

```ts
readonly width: number;
```

Defined in: [src/core/pdfPage.ts:544](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L544)

Intrinsic width in pixels.

## Methods

### scale()

```ts
scale(factor): object;
```

Defined in: [src/core/pdfPage.ts:552](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L552)

Return a new `{ width, height }` scaled by the given factor.

#### Parameters

##### factor

`number`

Scale multiplier (e.g. `0.5` for half size).

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
scaleToFit(maxWidth, maxHeight): object;
```

Defined in: [src/core/pdfPage.ts:560](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfPage.ts#L560)

Return a new `{ width, height }` that fits within the given bounds
while preserving the aspect ratio.

#### Parameters

##### maxWidth

`number`

Maximum allowed width.

##### maxHeight

`number`

Maximum allowed height.

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
