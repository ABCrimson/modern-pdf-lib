[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RichTextFieldReadError

# Class: RichTextFieldReadError

Defined in: [src/errors.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/errors.ts#L172)

Thrown when attempting to read the rich text value (/RV) of a field
that does not support it or whose rich text is malformed.

## Extends

- `Error`

## Constructors

### Constructor

> **new RichTextFieldReadError**(`fieldName`, `options?`): `RichTextFieldReadError`

Defined in: [src/errors.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/errors.ts#L174)

#### Parameters

##### fieldName

`string`

##### options?

`ErrorOptions`

#### Returns

`RichTextFieldReadError`

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

> `readonly` **name**: `"RichTextFieldReadError"` = `'RichTextFieldReadError'`

Defined in: [src/errors.ts:173](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/errors.ts#L173)

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
