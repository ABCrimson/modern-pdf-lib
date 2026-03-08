[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfBool

# Class: PdfBool

Defined in: [src/core/pdfObjects.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L90)

A PDF boolean — `true` or `false`.

## Properties

### value

> `readonly` **value**: `boolean`

Defined in: [src/core/pdfObjects.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L97)

***

### FALSE

> `readonly` `static` **FALSE**: `PdfBool`

Defined in: [src/core/pdfObjects.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L92)

***

### TRUE

> `readonly` `static` **TRUE**: `PdfBool`

Defined in: [src/core/pdfObjects.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L91)

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L103)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### of()

> `static` **of**(`value`): `PdfBool`

Defined in: [src/core/pdfObjects.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L99)

#### Parameters

##### value

`boolean`

#### Returns

`PdfBool`
