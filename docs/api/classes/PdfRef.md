[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfRef

# Class: PdfRef

Defined in: [src/core/pdfObjects.ts:401](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L401)

An indirect reference `N G R`.

## Constructors

### Constructor

> **new PdfRef**(`objectNumber`, `generationNumber?`): `PdfRef`

Defined in: [src/core/pdfObjects.ts:405](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L405)

#### Parameters

##### objectNumber

`number`

Object number (≥ 1).

##### generationNumber?

`number` = `0`

Generation number (usually 0).

#### Returns

`PdfRef`

## Properties

### generationNumber

> `readonly` **generationNumber**: `number` = `0`

Defined in: [src/core/pdfObjects.ts:409](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L409)

Generation number (usually 0).

***

### objectNumber

> `readonly` **objectNumber**: `number`

Defined in: [src/core/pdfObjects.ts:407](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L407)

Object number (≥ 1).

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:417](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L417)

The string form used inside PDF bodies: `N G R`.

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### toObjectFooter()

> **toObjectFooter**(): `string`

Defined in: [src/core/pdfObjects.ts:427](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L427)

Return `endobj`.

#### Returns

`string`

***

### toObjectHeader()

> **toObjectHeader**(): `string`

Defined in: [src/core/pdfObjects.ts:422](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L422)

Return the `N G obj` header for an indirect-object definition.

#### Returns

`string`

***

### toString()

> **toString**(): `string`

Defined in: [src/core/pdfObjects.ts:431](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L431)

#### Returns

`string`

***

### of()

> `static` **of**(`objectNumber`, `generationNumber?`): `PdfRef`

Defined in: [src/core/pdfObjects.ts:412](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfObjects.ts#L412)

#### Parameters

##### objectNumber

`number`

##### generationNumber?

`number` = `0`

#### Returns

`PdfRef`
