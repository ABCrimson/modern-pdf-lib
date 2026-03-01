[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfParseError

# Class: PdfParseError

Defined in: [src/parser/parseError.ts:7](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/parser/parseError.ts#L7)

## Extends

- `Error`

## Constructors

### Constructor

> **new PdfParseError**(`options`): `PdfParseError`

Defined in: [src/parser/parseError.ts:14](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/parser/parseError.ts#L14)

#### Parameters

##### options

###### actual?

`string`

###### cause?

`Error`

###### data?

`Uint8Array`\<`ArrayBufferLike`\>

###### expected?

`string`

###### message

`string`

###### offset

`number`

#### Returns

`PdfParseError`

#### Overrides

`Error.constructor`

## Properties

### actual

> `readonly` **actual**: `string`

Defined in: [src/parser/parseError.ts:11](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/parser/parseError.ts#L11)

***

### cause?

> `optional` **cause**: `unknown`

Defined in: node\_modules/typescript/lib/lib.es2022.error.d.ts:24

#### Inherited from

`Error.cause`

***

### expected

> `readonly` **expected**: `string`

Defined in: [src/parser/parseError.ts:10](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/parser/parseError.ts#L10)

***

### hexContext

> `readonly` **hexContext**: `string`

Defined in: [src/parser/parseError.ts:12](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/parser/parseError.ts#L12)

***

### message

> **message**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1075

#### Inherited from

`Error.message`

***

### name

> `readonly` **name**: `"PdfParseError"` = `'PdfParseError'`

Defined in: [src/parser/parseError.ts:8](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/parser/parseError.ts#L8)

#### Overrides

`Error.name`

***

### offset

> `readonly` **offset**: `number`

Defined in: [src/parser/parseError.ts:9](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/parser/parseError.ts#L9)

***

### stack?

> `optional` **stack**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.stack`

## Methods

### isError()

> `static` **isError**(`error`): `error is Error`

Defined in: node\_modules/typescript/lib/lib.esnext.error.d.ts:21

Indicates whether the argument provided is a built-in Error instance or not.

#### Parameters

##### error

`unknown`

#### Returns

`error is Error`

#### Inherited from

`Error.isError`
