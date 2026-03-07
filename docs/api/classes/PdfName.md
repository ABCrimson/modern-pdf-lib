[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfName

# Class: PdfName

Defined in: [src/core/pdfObjects.ts:190](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfObjects.ts#L190)

A PDF name object — e.g. `/Type`, `/Page`.

The leading `/` is stored and serialized.  Characters outside the
printable ASCII range (33–126) and `#` are encoded as `#XX`.

## Properties

### value

> `readonly` **value**: `string`

Defined in: [src/core/pdfObjects.ts:199](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfObjects.ts#L199)

The name value *including* the leading `/`.

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:214](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfObjects.ts#L214)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### of()

> `static` **of**(`name`): `PdfName`

Defined in: [src/core/pdfObjects.ts:203](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pdfObjects.ts#L203)

Create or retrieve a cached `PdfName`.

#### Parameters

##### name

`string`

#### Returns

`PdfName`
