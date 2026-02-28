[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfNumber

# Class: PdfNumber

Defined in: [src/core/pdfObjects.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfObjects.ts#L113)

A PDF numeric object (integer or real).

## Constructors

### Constructor

> **new PdfNumber**(`value`): `PdfNumber`

Defined in: [src/core/pdfObjects.ts:117](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfObjects.ts#L117)

#### Parameters

##### value

`number`

#### Returns

`PdfNumber`

## Properties

### value

> `readonly` **value**: `number`

Defined in: [src/core/pdfObjects.ts:117](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfObjects.ts#L117)

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:123](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfObjects.ts#L123)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### of()

> `static` **of**(`value`): `PdfNumber`

Defined in: [src/core/pdfObjects.ts:119](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfObjects.ts#L119)

#### Parameters

##### value

`number`

#### Returns

`PdfNumber`
