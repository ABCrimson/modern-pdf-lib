[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfNumber

# Class: PdfNumber

Defined in: [src/core/pdfObjects.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L103)

A PDF numeric object (integer or real).

## Constructors

### Constructor

> **new PdfNumber**(`value`): `PdfNumber`

Defined in: [src/core/pdfObjects.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L107)

#### Parameters

##### value

`number`

#### Returns

`PdfNumber`

## Properties

### value

> `readonly` **value**: `number`

Defined in: [src/core/pdfObjects.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L107)

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L113)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### of()

> `static` **of**(`value`): `PdfNumber`

Defined in: [src/core/pdfObjects.ts:109](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L109)

#### Parameters

##### value

`number`

#### Returns

`PdfNumber`
