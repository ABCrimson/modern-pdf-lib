[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / NoSuchFieldError

# Class: NoSuchFieldError

Defined in: [src/errors.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/errors.ts#L88)

Thrown when looking up a form field by name that does not exist.

## Extends

- `Error`

## Constructors

### Constructor

> **new NoSuchFieldError**(`fieldName`, `options?`): `NoSuchFieldError`

Defined in: [src/errors.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/errors.ts#L90)

#### Parameters

##### fieldName

`string`

##### options?

`ErrorOptions`

#### Returns

`NoSuchFieldError`

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

> `readonly` **name**: `"NoSuchFieldError"` = `'NoSuchFieldError'`

Defined in: [src/errors.ts:89](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/errors.ts#L89)

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
