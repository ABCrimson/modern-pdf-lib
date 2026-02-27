[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfArray

# Class: PdfArray

Defined in: [src/core/pdfObjects.ts:225](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L225)

A PDF array `[…]`.

## Constructors

### Constructor

> **new PdfArray**(`items?`): `PdfArray`

Defined in: [src/core/pdfObjects.ts:229](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L229)

#### Parameters

##### items?

[`PdfObject`](../type-aliases/PdfObject.md)[] = `[]`

#### Returns

`PdfArray`

## Properties

### items

> `readonly` **items**: [`PdfObject`](../type-aliases/PdfObject.md)[] = `[]`

Defined in: [src/core/pdfObjects.ts:229](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L229)

## Accessors

### length

#### Get Signature

> **get** **length**(): `number`

Defined in: [src/core/pdfObjects.ts:246](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L246)

Number of items.

##### Returns

`number`

## Methods

### push()

> **push**(`item`): `void`

Defined in: [src/core/pdfObjects.ts:241](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L241)

Add an item.

#### Parameters

##### item

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

`void`

***

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:250](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L250)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### fromNumbers()

> `static` **fromNumbers**(`values`): `PdfArray`

Defined in: [src/core/pdfObjects.ts:236](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L236)

Convenience: create an array of PdfNumbers.

#### Parameters

##### values

`number`[]

#### Returns

`PdfArray`

***

### of()

> `static` **of**(`items`): `PdfArray`

Defined in: [src/core/pdfObjects.ts:231](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L231)

#### Parameters

##### items

[`PdfObject`](../type-aliases/PdfObject.md)[]

#### Returns

`PdfArray`
