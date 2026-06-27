[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfNumber

# Class: PdfNumber

Defined in: [src/core/pdfObjects.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L113)

A PDF numeric object (integer or real).

## Constructors

### Constructor

```ts
new PdfNumber(value): PdfNumber;
```

Defined in: [src/core/pdfObjects.ts:117](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L117)

#### Parameters

##### value

`number`

#### Returns

`PdfNumber`

## Properties

### value

```ts
readonly value: number;
```

Defined in: [src/core/pdfObjects.ts:117](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L117)

## Methods

### serialize()

```ts
serialize(writer): void;
```

Defined in: [src/core/pdfObjects.ts:123](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L123)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### of()

```ts
static of(value): PdfNumber;
```

Defined in: [src/core/pdfObjects.ts:119](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L119)

#### Parameters

##### value

`number`

#### Returns

`PdfNumber`
