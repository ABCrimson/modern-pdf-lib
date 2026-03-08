[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EncryptedPdfError

# Class: EncryptedPdfError

Defined in: [src/errors.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/errors.ts#L22)

Thrown when attempting to load or manipulate an encrypted PDF without
providing the correct password.

## Extends

- `Error`

## Constructors

### Constructor

> **new EncryptedPdfError**(`message?`, `options?`): `EncryptedPdfError`

Defined in: [src/errors.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/errors.ts#L24)

#### Parameters

##### message?

`string` = `'The PDF is encrypted. Please provide a password.'`

##### options?

`ErrorOptions`

#### Returns

`EncryptedPdfError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause**: `unknown`

Defined in: node\_modules/typescript/lib/lib.es2022.error.d.ts:24

#### Inherited from

`Error.cause`

***

### message

> **message**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1075

#### Inherited from

`Error.message`

***

### name

> `readonly` **name**: `"EncryptedPdfError"` = `'EncryptedPdfError'`

Defined in: [src/errors.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/errors.ts#L23)

#### Overrides

`Error.name`

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
