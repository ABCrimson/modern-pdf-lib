[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / MissingOnValueCheckError

# Class: MissingOnValueCheckError

Defined in: [src/errors.ts:117](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/errors.ts#L117)

Thrown when a checkbox or radio button is checked but no "on" value
can be determined from its appearance dictionary.

## Extends

- `Error`

## Constructors

### Constructor

> **new MissingOnValueCheckError**(`fieldName`, `options?`): `MissingOnValueCheckError`

Defined in: [src/errors.ts:119](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/errors.ts#L119)

#### Parameters

##### fieldName

`string`

##### options?

`ErrorOptions`

#### Returns

`MissingOnValueCheckError`

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

> `readonly` **name**: `"MissingOnValueCheckError"` = `'MissingOnValueCheckError'`

Defined in: [src/errors.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/errors.ts#L118)

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
