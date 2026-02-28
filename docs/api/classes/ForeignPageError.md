[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ForeignPageError

# Class: ForeignPageError

Defined in: [src/errors.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/errors.ts#L60)

Thrown when attempting to use a page from a different document without
first copying it.

## Extends

- `Error`

## Constructors

### Constructor

> **new ForeignPageError**(`options?`): `ForeignPageError`

Defined in: [src/errors.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/errors.ts#L62)

#### Parameters

##### options?

`ErrorOptions`

#### Returns

`ForeignPageError`

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

> `readonly` **name**: `"ForeignPageError"` = `'ForeignPageError'`

Defined in: [src/errors.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/errors.ts#L61)

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
