[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfDict

# Class: PdfDict

Defined in: [src/core/pdfObjects.ts:265](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L265)

A PDF dictionary `<< … >>`.

## Constructors

### Constructor

> **new PdfDict**(`entries?`): `PdfDict`

Defined in: [src/core/pdfObjects.ts:271](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L271)

#### Parameters

##### entries?

`Iterable`\<readonly \[`string`, [`PdfObject`](../type-aliases/PdfObject.md)\], `any`, `any`\>

#### Returns

`PdfDict`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [src/core/pdfObjects.ts:308](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L308)

Number of entries.

##### Returns

`number`

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<\[`string`, [`PdfObject`](../type-aliases/PdfObject.md)\]\>

Defined in: [src/core/pdfObjects.ts:313](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L313)

Iterate over entries as `[key, value]` pairs.

#### Returns

`IterableIterator`\<\[`string`, [`PdfObject`](../type-aliases/PdfObject.md)\]\>

***

### delete()

> **delete**(`key`): `boolean`

Defined in: [src/core/pdfObjects.ts:302](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L302)

Delete a key.

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### get()

> **get**(`key`): [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

Defined in: [src/core/pdfObjects.ts:290](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L290)

Get a value by key.

#### Parameters

##### key

`string`

#### Returns

[`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

***

### has()

> **has**(`key`): `boolean`

Defined in: [src/core/pdfObjects.ts:296](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L296)

Check if a key exists.

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:317](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L317)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### set()

> **set**(`key`, `value`): `this`

Defined in: [src/core/pdfObjects.ts:283](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfObjects.ts#L283)

Set a key-value pair.  Keys are always stored / looked up *with*
the leading `/`.

#### Parameters

##### key

`string`

##### value

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

`this`
