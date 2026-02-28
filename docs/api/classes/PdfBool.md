[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfBool

# Class: PdfBool

Defined in: [src/core/pdfObjects.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L80)

A PDF boolean — `true` or `false`.

## Properties

### value

> `readonly` **value**: `boolean`

Defined in: [src/core/pdfObjects.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L87)

***

### FALSE

> `readonly` `static` **FALSE**: `PdfBool`

Defined in: [src/core/pdfObjects.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L82)

***

### TRUE

> `readonly` `static` **TRUE**: `PdfBool`

Defined in: [src/core/pdfObjects.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L81)

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:93](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L93)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### of()

> `static` **of**(`value`): `PdfBool`

Defined in: [src/core/pdfObjects.ts:89](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L89)

#### Parameters

##### value

`boolean`

#### Returns

`PdfBool`
