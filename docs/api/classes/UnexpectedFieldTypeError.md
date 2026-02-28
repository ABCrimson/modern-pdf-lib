[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / UnexpectedFieldTypeError

# Class: UnexpectedFieldTypeError

Defined in: [src/errors.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/errors.ts#L102)

Thrown when a form field is accessed via the wrong typed getter
(e.g. calling `getTextField()` on a checkbox field).

## Extends

- `Error`

## Constructors

### Constructor

> **new UnexpectedFieldTypeError**(`fieldName`, `expected`, `actual`, `options?`): `UnexpectedFieldTypeError`

Defined in: [src/errors.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/errors.ts#L104)

#### Parameters

##### fieldName

`string`

##### expected

`string`

##### actual

`string`

##### options?

`ErrorOptions`

#### Returns

`UnexpectedFieldTypeError`

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

> `readonly` **name**: `"UnexpectedFieldTypeError"` = `'UnexpectedFieldTypeError'`

Defined in: [src/errors.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/errors.ts#L103)

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
