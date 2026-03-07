[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldAlreadyExistsError

# Class: FieldAlreadyExistsError

Defined in: [src/errors.ts:131](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/errors.ts#L131)

Thrown when creating a form field with a name that is already in use.

## Extends

- `Error`

## Constructors

### Constructor

> **new FieldAlreadyExistsError**(`fieldName`, `options?`): `FieldAlreadyExistsError`

Defined in: [src/errors.ts:133](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/errors.ts#L133)

#### Parameters

##### fieldName

`string`

##### options?

`ErrorOptions`

#### Returns

`FieldAlreadyExistsError`

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

> `readonly` **name**: `"FieldAlreadyExistsError"` = `'FieldAlreadyExistsError'`

Defined in: [src/errors.ts:132](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/errors.ts#L132)

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
