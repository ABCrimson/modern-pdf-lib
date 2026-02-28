[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FontNotEmbeddedError

# Class: FontNotEmbeddedError

Defined in: [src/errors.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/errors.ts#L40)

Thrown when a font operation requires an embedded font but none has been
registered or the font reference is invalid.

## Extends

- `Error`

## Constructors

### Constructor

> **new FontNotEmbeddedError**(`fontName?`, `options?`): `FontNotEmbeddedError`

Defined in: [src/errors.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/errors.ts#L42)

#### Parameters

##### fontName?

`string`

##### options?

`ErrorOptions`

#### Returns

`FontNotEmbeddedError`

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

> `readonly` **name**: `"FontNotEmbeddedError"` = `'FontNotEmbeddedError'`

Defined in: [src/errors.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/errors.ts#L41)

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
