[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfArray

# Class: PdfArray

Defined in: [src/core/pdfObjects.ts:235](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L235)

A PDF array `[…]`.

## Constructors

### Constructor

> **new PdfArray**(`items?`): `PdfArray`

Defined in: [src/core/pdfObjects.ts:239](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L239)

#### Parameters

##### items?

[`PdfObject`](../type-aliases/PdfObject.md)[] = `[]`

#### Returns

`PdfArray`

## Properties

### items

> `readonly` **items**: [`PdfObject`](../type-aliases/PdfObject.md)[] = `[]`

Defined in: [src/core/pdfObjects.ts:239](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L239)

## Accessors

### length

#### Get Signature

> **get** **length**(): `number`

Defined in: [src/core/pdfObjects.ts:256](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L256)

Number of items.

##### Returns

`number`

## Methods

### push()

> **push**(`item`): `void`

Defined in: [src/core/pdfObjects.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L251)

Add an item.

#### Parameters

##### item

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

`void`

***

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:260](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L260)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### fromNumbers()

> `static` **fromNumbers**(`values`): `PdfArray`

Defined in: [src/core/pdfObjects.ts:246](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L246)

Convenience: create an array of PdfNumbers.

#### Parameters

##### values

`number`[]

#### Returns

`PdfArray`

***

### of()

> `static` **of**(`items`): `PdfArray`

Defined in: [src/core/pdfObjects.ts:241](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L241)

#### Parameters

##### items

[`PdfObject`](../type-aliases/PdfObject.md)[]

#### Returns

`PdfArray`
