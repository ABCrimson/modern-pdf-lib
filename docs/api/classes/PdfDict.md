[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfDict

# Class: PdfDict

Defined in: [src/core/pdfObjects.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfObjects.ts#L275)

A PDF dictionary `<< … >>`.

## Constructors

### Constructor

> **new PdfDict**(`entries?`): `PdfDict`

Defined in: [src/core/pdfObjects.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfObjects.ts#L281)

#### Parameters

##### entries?

`Iterable`\<readonly \[`string`, [`PdfObject`](../type-aliases/PdfObject.md)\], `any`, `any`\>

#### Returns

`PdfDict`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [src/core/pdfObjects.ts:318](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfObjects.ts#L318)

Number of entries.

##### Returns

`number`

## Methods

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<\[`string`, [`PdfObject`](../type-aliases/PdfObject.md)\]\>

Defined in: [src/core/pdfObjects.ts:323](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfObjects.ts#L323)

Iterate over entries as `[key, value]` pairs.

#### Returns

`IterableIterator`\<\[`string`, [`PdfObject`](../type-aliases/PdfObject.md)\]\>

***

### delete()

> **delete**(`key`): `boolean`

Defined in: [src/core/pdfObjects.ts:312](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfObjects.ts#L312)

Delete a key.

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### get()

> **get**(`key`): [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

Defined in: [src/core/pdfObjects.ts:300](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfObjects.ts#L300)

Get a value by key.

#### Parameters

##### key

`string`

#### Returns

[`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

***

### has()

> **has**(`key`): `boolean`

Defined in: [src/core/pdfObjects.ts:306](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfObjects.ts#L306)

Check if a key exists.

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:327](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfObjects.ts#L327)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### set()

> **set**(`key`, `value`): `this`

Defined in: [src/core/pdfObjects.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfObjects.ts#L293)

Set a key-value pair.  Keys are always stored / looked up *with*
the leading `/`.

#### Parameters

##### key

`string`

##### value

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

`this`
