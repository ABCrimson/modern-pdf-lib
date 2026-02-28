[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfName

# Class: PdfName

Defined in: [src/core/pdfObjects.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L180)

A PDF name object — e.g. `/Type`, `/Page`.

The leading `/` is stored and serialized.  Characters outside the
printable ASCII range (33–126) and `#` are encoded as `#XX`.

## Properties

### value

> `readonly` **value**: `string`

Defined in: [src/core/pdfObjects.ts:189](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L189)

The name value *including* the leading `/`.

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:204](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L204)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### of()

> `static` **of**(`name`): `PdfName`

Defined in: [src/core/pdfObjects.ts:193](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L193)

Create or retrieve a cached `PdfName`.

#### Parameters

##### name

`string`

#### Returns

`PdfName`
